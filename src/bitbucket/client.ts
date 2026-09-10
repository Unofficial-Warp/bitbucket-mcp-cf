import { Context, Effect, flow, Layer, Schema } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpIncomingMessage
} from "effect/unstable/http"
import { BitbucketConfig } from "./config.ts"
import * as Domain from "./domain.ts"

const apiBase = "https://api.bitbucket.org/2.0"

export class BitbucketError extends Schema.TaggedErrorClass<BitbucketError>()(
  "BitbucketError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect())
  }
) {}

export interface CreatePullRequestInput {
  readonly repoSlug: string
  readonly title: string
  readonly sourceBranch: string
  readonly destinationBranch: string
  readonly description?: string | undefined
  readonly draft?: boolean | undefined
}

export interface UpdatePullRequestInput {
  readonly repoSlug: string
  readonly prId: number
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly draft?: boolean | undefined
}

export interface CompareBranchesInput {
  readonly repoSlug: string
  readonly sourceBranch: string
  readonly destinationBranch: string
}

type Repository = typeof Domain.Repository["Type"]
type Branch = typeof Domain.Branch["Type"]
type PullRequest = typeof Domain.PullRequest["Type"]
type Commit = typeof Domain.Commit["Type"]
type DiffstatEntry = typeof Domain.DiffstatEntry["Type"]
type Comment = typeof Domain.Comment["Type"]
type Activity = typeof Domain.Activity["Type"]

export class Bitbucket extends Context.Service<Bitbucket, {
  readonly listRepositories: Effect.Effect<ReadonlyArray<Repository>, BitbucketError>
  listBranches(repoSlug: string): Effect.Effect<ReadonlyArray<Branch>, BitbucketError>
  listPullRequests(
    repoSlug: string,
    state?: string | undefined
  ): Effect.Effect<ReadonlyArray<PullRequest>, BitbucketError>
  getPullRequest(repoSlug: string, prId: number): Effect.Effect<PullRequest, BitbucketError>
  createPullRequest(input: CreatePullRequestInput): Effect.Effect<PullRequest, BitbucketError>
  updatePullRequest(input: UpdatePullRequestInput): Effect.Effect<PullRequest, BitbucketError>
  listPrCommits(repoSlug: string, prId: number): Effect.Effect<ReadonlyArray<Commit>, BitbucketError>
  listPrComments(
    repoSlug: string,
    prId: number
  ): Effect.Effect<ReadonlyArray<Comment>, BitbucketError>
  listPrActivity(
    repoSlug: string,
    prId: number
  ): Effect.Effect<ReadonlyArray<Activity>, BitbucketError>
  getPrDiff(repoSlug: string, prId: number): Effect.Effect<string, BitbucketError>
  getPrDiffstat(
    repoSlug: string,
    prId: number
  ): Effect.Effect<ReadonlyArray<DiffstatEntry>, BitbucketError>
  compareBranchesDiff(input: CompareBranchesInput): Effect.Effect<string, BitbucketError>
  compareBranchesDiffstat(
    input: CompareBranchesInput
  ): Effect.Effect<ReadonlyArray<DiffstatEntry>, BitbucketError>
  compareBranchesCommits(
    input: CompareBranchesInput
  ): Effect.Effect<ReadonlyArray<Commit>, BitbucketError>
}>()("bitbucket_mcp/bitbucket/Bitbucket") {
  static readonly layer = Layer.effect(
    Bitbucket,
    Effect.gen(function*() {
      const config = yield* BitbucketConfig
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(flow(
          HttpClientRequest.prependUrl(apiBase),
          HttpClientRequest.setHeader("Authorization", config.authorization)
        ))
      )

      const repo = (repoSlug: string) =>
        `/repositories/${encodeURIComponent(config.workspace)}/${encodeURIComponent(repoSlug)}`

      const send = Effect.fn("Bitbucket.send")(function*(
        request: HttpClientRequest.HttpClientRequest
      ) {
        const response = yield* client.execute(request).pipe(
          Effect.mapError((cause) =>
            new BitbucketError({ message: `bitbucket request failed: ${cause.message}`, cause })
          )
        )
        if (response.status < 200 || response.status >= 300) {
          const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
          return yield* new BitbucketError({
            message: `bitbucket API error ${response.status}: ${body}`
          })
        }
        return response
      })

      const json = <S extends Schema.Top>(
        request: HttpClientRequest.HttpClientRequest,
        schema: S
      ): Effect.Effect<S["Type"], BitbucketError, S["DecodingServices"]> =>
        send(HttpClientRequest.acceptJson(request)).pipe(
          Effect.flatMap(HttpIncomingMessage.schemaBodyJson(schema)),
          Effect.mapError((cause) =>
            cause._tag === "BitbucketError"
              ? cause
              : new BitbucketError({
                message: `failed to decode bitbucket response: ${cause.message}`,
                cause
              })
          )
        )

      // Diff endpoints return text/plain, so they must not be decoded as JSON.
      const text = (request: HttpClientRequest.HttpClientRequest) =>
        send(request).pipe(
          Effect.flatMap((response) =>
            response.text.pipe(
              Effect.mapError((cause) =>
                new BitbucketError({
                  message: `failed to read bitbucket response: ${cause.message}`,
                  cause
                })
              )
            )
          )
        )

      const paged = <S extends Schema.Top>(
        request: HttpClientRequest.HttpClientRequest,
        schema: S
      ): Effect.Effect<ReadonlyArray<S["Type"]>, BitbucketError, S["DecodingServices"]> =>
        json(request, Domain.Paged(schema)).pipe(
          Effect.map((page) => (page.values ?? []) as ReadonlyArray<S["Type"]>)
        )

      const listRepositories = paged(
        HttpClientRequest.get(`/repositories/${encodeURIComponent(config.workspace)}`).pipe(
          HttpClientRequest.setUrlParams({ pagelen: "100", sort: "-updated_on" })
        ),
        Domain.Repository
      ).pipe(Effect.withSpan("Bitbucket.listRepositories"))

      const listBranches = Effect.fn("Bitbucket.listBranches")(function*(repoSlug: string) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/refs/branches`).pipe(
            HttpClientRequest.setUrlParams({ pagelen: "100" })
          ),
          Domain.Branch
        )
      })

      const listPullRequests = Effect.fn("Bitbucket.listPullRequests")(function*(
        repoSlug: string,
        state?: string | undefined
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests`).pipe(
            HttpClientRequest.setUrlParams({ state: state || "OPEN", pagelen: "50" })
          ),
          Domain.PullRequest
        )
      })

      const getPullRequest = Effect.fn("Bitbucket.getPullRequest")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* json(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}`),
          Domain.PullRequest
        )
      })

      const createPullRequest = Effect.fn("Bitbucket.createPullRequest")(function*(
        input: CreatePullRequestInput
      ) {
        return yield* json(
          HttpClientRequest.post(`${repo(input.repoSlug)}/pullrequests`).pipe(
            HttpClientRequest.bodyJsonUnsafe({
              title: input.title,
              ...(input.description ? { description: input.description } : {}),
              ...(input.draft === undefined ? {} : { draft: input.draft }),
              source: { branch: { name: input.sourceBranch } },
              destination: { branch: { name: input.destinationBranch } }
            })
          ),
          Domain.PullRequest
        )
      })

      const updatePullRequest = Effect.fn("Bitbucket.updatePullRequest")(function*(
        input: UpdatePullRequestInput
      ) {
        return yield* json(
          HttpClientRequest.put(`${repo(input.repoSlug)}/pullrequests/${input.prId}`).pipe(
            HttpClientRequest.bodyJsonUnsafe({
              // `description: ""` (clear it) and `draft: false` (mark ready for review) are
              // both meaningful, so absence is the only thing that means "leave unchanged".
              ...(input.title === undefined ? {} : { title: input.title }),
              ...(input.description === undefined ? {} : { description: input.description }),
              ...(input.draft === undefined ? {} : { draft: input.draft })
            })
          ),
          Domain.PullRequest
        )
      })

      const listPrCommits = Effect.fn("Bitbucket.listPrCommits")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}/commits`).pipe(
            HttpClientRequest.setUrlParams({ pagelen: "50" })
          ),
          Domain.Commit
        )
      })

      const listPrComments = Effect.fn("Bitbucket.listPrComments")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}/comments`).pipe(
            HttpClientRequest.setUrlParams({ pagelen: "100" })
          ),
          Domain.Comment
        )
      })

      const listPrActivity = Effect.fn("Bitbucket.listPrActivity")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}/activity`).pipe(
            HttpClientRequest.setUrlParams({ pagelen: "50" })
          ),
          Domain.Activity
        )
      })

      const getPrDiff = Effect.fn("Bitbucket.getPrDiff")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* text(HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}/diff`))
      })

      const getPrDiffstat = Effect.fn("Bitbucket.getPrDiffstat")(function*(
        repoSlug: string,
        prId: number
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(repoSlug)}/pullrequests/${prId}/diffstat`),
          Domain.DiffstatEntry
        )
      })

      const spec = (input: CompareBranchesInput) =>
        `${encodeURIComponent(input.sourceBranch)}..${encodeURIComponent(input.destinationBranch)}`

      const compareBranchesDiff = Effect.fn("Bitbucket.compareBranchesDiff")(function*(
        input: CompareBranchesInput
      ) {
        return yield* text(
          HttpClientRequest.get(`${repo(input.repoSlug)}/diff/${spec(input)}`)
        )
      })

      const compareBranchesDiffstat = Effect.fn("Bitbucket.compareBranchesDiffstat")(function*(
        input: CompareBranchesInput
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(input.repoSlug)}/diffstat/${spec(input)}`).pipe(
            HttpClientRequest.setUrlParams({ pagelen: "100" })
          ),
          Domain.DiffstatEntry
        )
      })

      const compareBranchesCommits = Effect.fn("Bitbucket.compareBranchesCommits")(function*(
        input: CompareBranchesInput
      ) {
        return yield* paged(
          HttpClientRequest.get(`${repo(input.repoSlug)}/commits`).pipe(
            HttpClientRequest.setUrlParams({
              include: input.sourceBranch,
              exclude: input.destinationBranch,
              pagelen: "100"
            })
          ),
          Domain.Commit
        )
      })

      return Bitbucket.of({
        listRepositories,
        listBranches,
        listPullRequests,
        getPullRequest,
        createPullRequest,
        updatePullRequest,
        listPrCommits,
        listPrComments,
        listPrActivity,
        getPrDiff,
        getPrDiffstat,
        compareBranchesDiff,
        compareBranchesDiffstat,
        compareBranchesCommits
      })
    })
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
