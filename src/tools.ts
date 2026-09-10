import { Schema } from "effect"
import { Bitbucket } from "./bitbucket/client.ts"
import type { McpTool } from "./mcp/tool.ts"
import * as Tool from "./mcp/tool.ts"

const repoSlug = Schema.String.annotate({ description: "The repository slug" })
const prId = Schema.Int.annotate({ description: "The pull request ID" })
const sourceBranch = Schema.String.annotate({ description: "The source branch name" })
const destinationBranch = Schema.String.annotate({ description: "The destination branch name" })
const RepoParams = Schema.Struct({ repo_slug: repoSlug })

const PrParams = Schema.Struct({ repo_slug: repoSlug, pr_id: prId })

const CompareParams = Schema.Struct({
  repo_slug: repoSlug,
  source_branch: sourceBranch,
  destination_branch: destinationBranch
})

export const tools: ReadonlyArray<McpTool<Bitbucket>> = [
  Tool.make({
    name: "list_repositories",
    description: "List all repositories in the Bitbucket workspace",
    parameters: Schema.Struct({}),
    handler: () => Bitbucket.use((bitbucket) => bitbucket.listRepositories)
  }),

  Tool.make({
    name: "list_branches",
    description: "List branches for a Bitbucket repository",
    parameters: RepoParams,
    handler: (params) => Bitbucket.use((bitbucket) => bitbucket.listBranches(params.repo_slug))
  }),

  Tool.make({
    name: "list_pull_requests",
    description: "List pull requests for a Bitbucket repository",
    parameters: Schema.Struct({
      repo_slug: repoSlug,
      state: Schema.optionalKey(
        Schema.Literals(["OPEN", "MERGED", "DECLINED", "SUPERSEDED"]).annotate({
          description: "The PR state filter; defaults to OPEN"
        })
      )
    }),
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.listPullRequests(params.repo_slug, params.state))
  }),

  Tool.make({
    name: "get_pull_request",
    description: "Get a specific pull request by ID",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.getPullRequest(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "create_pull_request",
    description: "Create a new pull request in a Bitbucket repository",
    write: true,
    parameters: Schema.Struct({
      repo_slug: repoSlug,
      title: Schema.String.annotate({ description: "The PR title" }),
      source_branch: sourceBranch,
      destination_branch: destinationBranch,
      description: Schema.optionalKey(
        Schema.String.annotate({ description: "Optional PR description in markdown" })
      ),
      draft: Schema.optionalKey(
        Schema.Boolean.annotate({ description: "Open the PR as a draft; defaults to false" })
      )
    }),
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.createPullRequest({
          repoSlug: params.repo_slug,
          title: params.title,
          sourceBranch: params.source_branch,
          destinationBranch: params.destination_branch,
          description: params.description,
          draft: params.draft
        })
      )
  }),

  Tool.make({
    name: "update_pull_request",
    description: "Update an existing pull request's title and/or description",
    write: true,
    parameters: Schema.Struct({
      repo_slug: repoSlug,
      pr_id: prId,
      title: Schema.optionalKey(
        Schema.String.annotate({ description: "Optional new title for the PR" })
      ),
      description: Schema.optionalKey(
        Schema.String.annotate({ description: "Optional new description for the PR (markdown)" })
      )
    }),
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.updatePullRequest({
          repoSlug: params.repo_slug,
          prId: params.pr_id,
          title: params.title,
          description: params.description
        })
      )
  }),

  Tool.make({
    name: "set_pr_draft",
    description:
      "Move a pull request to draft, or back to ready for review. Only open pull requests can be changed",
    write: true,
    parameters: Schema.Struct({
      repo_slug: repoSlug,
      pr_id: prId,
      draft: Schema.Boolean.annotate({
        description: "true moves the PR to draft, false marks it ready for review"
      })
    }),
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.updatePullRequest({
          repoSlug: params.repo_slug,
          prId: params.pr_id,
          draft: params.draft
        })
      )
  }),

  Tool.make({
    name: "list_pr_commits",
    description: "List commits for a pull request",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.listPrCommits(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "list_pr_comments",
    description: "List all comments on a pull request (both general and inline code comments)",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.listPrComments(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "list_pr_activity",
    description:
      "List the full activity stream for a pull request (comments, approvals, changes-requested, source-branch updates)",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.listPrActivity(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "get_pr_diff",
    description: "Get the unified diff for a pull request",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.getPrDiff(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "get_pr_diffstat",
    description: "Get the diffstat (file-level change summary) for a pull request",
    parameters: PrParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) => bitbucket.getPrDiffstat(params.repo_slug, params.pr_id))
  }),

  Tool.make({
    name: "compare_branches_diff",
    description: "Get the raw unified diff between two branches in a repository",
    parameters: CompareParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.compareBranchesDiff({
          repoSlug: params.repo_slug,
          sourceBranch: params.source_branch,
          destinationBranch: params.destination_branch
        })
      )
  }),

  Tool.make({
    name: "compare_branches_diffstat",
    description: "Get the file-level diffstat between two branches in a repository",
    parameters: CompareParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.compareBranchesDiffstat({
          repoSlug: params.repo_slug,
          sourceBranch: params.source_branch,
          destinationBranch: params.destination_branch
        })
      )
  }),

  Tool.make({
    name: "compare_branches_commits",
    description: "List commits reachable from the source branch but not the destination branch",
    parameters: CompareParams,
    handler: (params) =>
      Bitbucket.use((bitbucket) =>
        bitbucket.compareBranchesCommits({
          repoSlug: params.repo_slug,
          sourceBranch: params.source_branch,
          destinationBranch: params.destination_branch
        })
      )
  })
]
