# bitbucket-mcp

An MCP (Model Context Protocol) server that exposes Bitbucket Cloud repository and pull request
data as tools consumable by any MCP-compatible client (Claude, Cursor, etc.).

This is a port of the original Go stdio server
([bradlycarpenter/bitbucket-mcp](https://github.com/bradlycarpenter/bitbucket-mcp)) to a Hono app running on
Cloudflare Workers, built with Effect.

## How it works

The worker serves the MCP **streamable HTTP** transport at `POST /:workspace/mcp` via `@hono/mcp`.
It is fully stateless and stores **no credentials of its own**: each caller creates their own
Bitbucket API token, sends it on every request, and the worker relays the call to the Bitbucket
API on their behalf. Every action is therefore attributed to the caller's own Bitbucket account.

Everything below the transport is Effect:

- `src/bitbucket/config.ts` — `BitbucketConfig` service, built per request from the caller's
  workspace and `Authorization` header
- `src/bitbucket/client.ts` — `Bitbucket` service wrapping the Bitbucket Cloud REST API on
  `HttpClient`, returning typed errors
- `src/bitbucket/domain.ts` — `Schema` definitions used to decode (and trim) API responses
- `src/mcp/tool.ts` — tool definitions whose parameters are `Schema`s; JSON Schema for the MCP
  tool list is derived from them
- `src/index.ts` — a `ManagedRuntime` per request bridges Effect into the Hono handler

## Tools

| Tool | Description |
|---|---|
| `list_repositories` | List all repositories in the configured workspace |
| `list_branches` | List branches for a repository |
| `list_pull_requests` | List pull requests, optionally filtered by state |
| `get_pull_request` | Get a specific pull request by ID |
| `create_pull_request` | Create a new pull request |
| `update_pull_request` | Update a pull request title and/or description |
| `list_pr_commits` | List commits on a pull request |
| `list_pr_comments` | List all comments on a pull request |
| `list_pr_activity` | Full activity stream for a pull request |
| `get_pr_diff` | Unified diff for a pull request |
| `get_pr_diffstat` | File-level change summary for a pull request |
| `compare_branches_diff` | Unified diff between two branches |
| `compare_branches_diffstat` | File-level diffstat between two branches |
| `compare_branches_commits` | Commits in source branch not in destination branch |

## Setup page

`GET /` serves a setup page: enter your workspace, email and API token, and it generates the
`claude mcp add` command (and an equivalent JSON config) ready to copy. It also lists every tool
with its arguments, rendered from the same `tools` array the server registers, so it cannot drift.

The form is inert — there is no submit handler and no fetch. The base64 encoding happens in
`btoa` in the browser, so the token only ever leaves the machine on the MCP requests your client
makes afterwards.

## Request contract

There is nothing to configure on the worker — no environment variables, no secrets. Every request
carries its own identity:

| | |
|---|---|
| URL | `POST https://<worker>/<workspace-slug>/mcp` |
| Header | `Authorization: Basic <base64 of email:api-token>` |

The `Authorization` header is forwarded verbatim to `api.bitbucket.org`; `Bearer` is accepted too
if you are using an OAuth access token. A request without credentials gets a `401`, and a
workspace slug outside `[A-Za-z0-9][A-Za-z0-9_.-]*` gets a `400`.

Because callers bring their own tokens, an unauthenticated request can do nothing, and the worker
never sees more access than the token it was handed. Do not add request logging that captures
headers — the credential is on every call.

### Creating an API token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**, label it, and copy the token — it is not shown again
3. Base64-encode it together with your Atlassian account email:

```sh
printf 'you@yourcompany.com:<api-token>' | base64
```

Required scopes:

| Scope | Purpose |
|---|---|
| `read:repository:bitbucket` | List repositories and branches |
| `read:pullrequest:bitbucket` | Read pull requests, commits, diffs, comments, and activity |
| `write:pullrequest:bitbucket` | Create and update pull requests |

## Local development

```sh
pnpm install
pnpm dev
```

The endpoint is `http://localhost:5173/<workspace-slug>/mcp`.

## Deploying

```sh
pnpm deploy
```

## MCP client configuration

```json
{
  "mcpServers": {
    "bitbucket": {
      "type": "http",
      "url": "https://<your-worker>.workers.dev/<workspace-slug>/mcp",
      "headers": {
        "Authorization": "Basic <base64 of email:api-token>"
      }
    }
  }
}
```

Or with the Claude Code CLI:

```sh
claude mcp add --transport http bitbucket \
  https://<your-worker>.workers.dev/<workspace-slug>/mcp \
  --header "Authorization: Basic <base64 of email:api-token>"
```
