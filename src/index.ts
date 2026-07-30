import { StreamableHTTPTransport } from "@hono/mcp"
import { Cause, Exit, Layer, ManagedRuntime } from "effect"
import { Hono } from "hono"
import { Bitbucket } from "./bitbucket/client.ts"
import { BitbucketConfig } from "./bitbucket/config.ts"
import type { BitbucketCredentials } from "./bitbucket/config.ts"
import * as McpServer from "./mcp/server.ts"
import { homePage } from "./site/page.ts"
import { tools } from "./tools.ts"

const SERVER_NAME = "bitbucket-mcp"
const SERVER_VERSION = "1.0.0"

// Built per request: the layer closes over the caller's credentials, so sharing
// a memo map across requests would hand one caller's identity to the next.
const makeRuntime = (credentials: BitbucketCredentials) => {
  const config = BitbucketConfig.fromRequest(credentials)
  return ManagedRuntime.make(
    Layer.mergeAll(config, Bitbucket.layer.pipe(Layer.provide(config)))
  )
}

const app = new Hono()

app.get("/", (c) =>
  c.html(
    homePage({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      origin: new URL(c.req.url).origin,
      tools
    })
  ))

app.all("/:workspace/mcp", async (c) => {
  const runtime = makeRuntime({
    workspace: c.req.param("workspace"),
    authorization: c.req.header("authorization")
  })

  const config = await runtime.runPromiseExit(BitbucketConfig.useSync((config) => config))
  if (Exit.isFailure(config)) {
    const error = Cause.squash(config.cause)
    const detail = McpServer.errorText(config.cause)
    if (typeof error === "object" && error !== null && "_tag" in error) {
      if (error._tag === "MissingCredentials") {
        c.header("WWW-Authenticate", `Basic realm="${SERVER_NAME}"`)
        return c.json({ error: detail }, 401)
      }
      if (error._tag === "InvalidWorkspace") {
        return c.json({ error: detail }, 400)
      }
    }
    return c.json({ error: detail }, 500)
  }

  const server = McpServer.make({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    tools,
    runtime
  })
  const transport = new StreamableHTTPTransport()
  await server.connect(transport)

  return transport.handleRequest(c)
})

export default app
