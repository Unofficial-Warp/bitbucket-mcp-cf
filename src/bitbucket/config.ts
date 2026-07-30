import { Context, Effect, Layer, Schema } from "effect"

export class MissingCredentials extends Schema.TaggedErrorClass<MissingCredentials>()(
  "MissingCredentials",
  { message: Schema.String }
) {}

export class InvalidWorkspace extends Schema.TaggedErrorClass<InvalidWorkspace>()(
  "InvalidWorkspace",
  { message: Schema.String }
) {}

export type BitbucketConfigError = MissingCredentials | InvalidWorkspace

const WORKSPACE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

export interface BitbucketCredentials {
  readonly workspace: string
  readonly authorization: string | undefined
}

/**
 * Per-request Bitbucket identity. The worker stores no credentials of its own:
 * the caller's `Authorization` header is forwarded to the Bitbucket API as-is.
 */
export class BitbucketConfig extends Context.Service<BitbucketConfig, {
  readonly workspace: string
  readonly authorization: string
}>()("bitbucket_mcp/bitbucket/BitbucketConfig") {
  static readonly fromRequest = (credentials: BitbucketCredentials) =>
    Layer.effect(
      BitbucketConfig,
      Effect.gen(function*() {
        const authorization = credentials.authorization?.trim()
        if (!authorization) {
          return yield* new MissingCredentials({
            message:
              "missing Authorization header; send `Basic <base64 of email:api-token>` for a Bitbucket API token"
          })
        }
        if (!/^(Basic|Bearer) \S/.test(authorization)) {
          return yield* new MissingCredentials({
            message: "Authorization header must use the Basic or Bearer scheme"
          })
        }
        if (!WORKSPACE_PATTERN.test(credentials.workspace)) {
          return yield* new InvalidWorkspace({
            message: `invalid workspace slug: ${credentials.workspace}`
          })
        }
        return BitbucketConfig.of({ workspace: credentials.workspace, authorization })
      })
    )
}
