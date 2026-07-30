import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from "@modelcontextprotocol/sdk/types.js"
import { Cause, Exit } from "effect"
import type { ManagedRuntime } from "effect"
import type { McpTool } from "./tool.ts"

// Tool errors are read by a model, so send the message rather than a stack trace.
export const errorText = (cause: Cause.Cause<unknown>): string => {
  const error = Cause.squash(cause)
  if (error instanceof Error && error.message !== "") {
    return error.message
  }
  return Cause.pretty(cause)
}

export const make = <R, ER>(options: {
  readonly name: string
  readonly version: string
  readonly tools: ReadonlyArray<McpTool<R>>
  readonly runtime: ManagedRuntime.ManagedRuntime<R, ER>
}): Server => {
  const server = new Server(
    { name: options.name, version: options.version },
    { capabilities: { tools: {} } }
  )

  const byName = new Map(options.tools.map((tool) => [tool.name, tool]))

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: options.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as { type: "object" }
    }))
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name)
    if (tool === undefined) {
      throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${request.params.name}`)
    }

    const exit = await options.runtime.runPromiseExit(tool.run(request.params.arguments))
    if (Exit.isSuccess(exit)) {
      return { content: [{ type: "text" as const, text: exit.value }] }
    }
    return {
      content: [{ type: "text" as const, text: errorText(exit.cause) }],
      isError: true
    }
  })

  return server
}
