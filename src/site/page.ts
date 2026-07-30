import type { McpTool } from "../mcp/tool.ts"

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "\"":
        return "&quot;"
      default:
        return "&#39;"
    }
  })

interface Argument {
  readonly name: string
  readonly type: string
  readonly required: boolean
  readonly description: string
}

const argumentsOf = (tool: McpTool<unknown>): ReadonlyArray<Argument> => {
  const schema = tool.inputSchema as {
    properties?: Record<string, { type?: string; enum?: ReadonlyArray<string>; description?: string }>
    required?: ReadonlyArray<string>
  }
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: property.enum ? property.enum.join(" | ") : property.type ?? "any",
    required: required.has(name),
    description: property.description ?? ""
  }))
}

const toolRow = (tool: McpTool<unknown>) => {
  const args = argumentsOf(tool)
  const argsHtml = args.length === 0
    ? `<span class="muted">none</span>`
    : args
      .map((argument) =>
        `<code class="arg${argument.required ? " required" : ""}" title="${
          escapeHtml(argument.description)
        }">${escapeHtml(argument.name)}<span class="type">${escapeHtml(argument.type)}</span></code>`
      )
      .join(" ")

  return `<tr>
    <td><code class="tool">${escapeHtml(tool.name)}</code></td>
    <td>${escapeHtml(tool.description)}</td>
    <td class="args">${argsHtml}</td>
  </tr>`
}

export const homePage = (options: {
  readonly name: string
  readonly version: string
  readonly origin: string
  readonly tools: ReadonlyArray<McpTool<unknown>>
}) => {
  const writeTools = options.tools.filter((tool) =>
    tool.name.startsWith("create_") || tool.name.startsWith("update_")
  ).length

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.name)} — setup</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --panel: #f6f7f9;
    --border: #dfe3e8;
    --text: #172b4d;
    --muted: #6b778c;
    --accent: #0052cc;
    --accent-text: #ffffff;
    --code-bg: #0b1220;
    --code-text: #e6edf3;
    --ok: #216e4e;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #10141c;
      --panel: #171d28;
      --border: #2a3342;
      --text: #e6edf3;
      --muted: #97a3b6;
      --accent: #4c9aff;
      --accent-text: #0b1220;
      --code-bg: #0b1220;
      --code-text: #e6edf3;
      --ok: #7ee2b8;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2.5rem 1.25rem 4rem;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 1.75rem; margin: 0 0 .35rem; letter-spacing: -.02em; }
  h2 { font-size: 1.05rem; margin: 2.5rem 0 .75rem; letter-spacing: -.01em; }
  p { margin: 0 0 1rem; }
  .lede { color: var(--muted); margin-bottom: 2rem; }
  .badge {
    display: inline-block; font-size: .75rem; padding: .1rem .45rem; border-radius: 999px;
    border: 1px solid var(--border); color: var(--muted); vertical-align: middle; margin-left: .5rem;
  }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  label { display: block; font-size: .8rem; font-weight: 600; margin-bottom: .3rem; }
  .hint { display: block; font-weight: 400; color: var(--muted); font-size: .75rem; margin-top: .15rem; }
  input {
    width: 100%; padding: .55rem .7rem; border-radius: 7px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); font: inherit; font-size: .9rem;
  }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .privacy { margin: 1rem 0 0; font-size: .8rem; color: var(--muted); }
  .privacy strong { color: var(--text); }
  .output { position: relative; margin-top: .75rem; }
  pre {
    margin: 0; padding: 1rem 1rem; overflow-x: auto; border-radius: 10px;
    background: var(--code-bg); color: var(--code-text);
    font: .82rem/1.7 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  pre.pending { opacity: .55; }
  button {
    position: absolute; top: .6rem; right: .6rem; padding: .3rem .7rem; font: inherit; font-size: .75rem;
    border-radius: 6px; border: 1px solid transparent; background: var(--accent); color: var(--accent-text);
    cursor: pointer;
  }
  button:disabled { opacity: .45; cursor: not-allowed; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  td.args { white-space: normal; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; }
  code.tool { color: var(--accent); font-weight: 600; white-space: nowrap; }
  code.arg {
    display: inline-block; margin: 0 .25rem .25rem 0; padding: .05rem .4rem; border-radius: 5px;
    border: 1px dashed var(--border); color: var(--muted);
  }
  code.arg.required { border-style: solid; color: var(--text); }
  code.arg .type { color: var(--muted); font-size: .72rem; margin-left: .35rem; }
  .muted { color: var(--muted); }
  a { color: var(--accent); }
  .table-wrap { overflow-x: auto; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(options.name)}<span class="badge">v${escapeHtml(options.version)}</span></h1>
  <p class="lede">
    A remote MCP server for Bitbucket Cloud. It stores no credentials — you bring your own API
    token and every call is made as you.
  </p>

  <h2>1. Create a Bitbucket API token</h2>
  <p>
    Create one at
    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer noopener">id.atlassian.com</a>
    with the scopes <code>read:repository:bitbucket</code>, <code>read:pullrequest:bitbucket</code>
    and <code>write:pullrequest:bitbucket</code>.
  </p>

  <h2>2. Fill in your details</h2>
  <div class="panel">
    <div class="grid">
      <div>
        <label for="workspace">Workspace slug
          <span class="hint">From bitbucket.org/<b>your-workspace</b></span>
        </label>
        <input id="workspace" placeholder="companyname-devops" autocomplete="off" spellcheck="false">
      </div>
      <div>
        <label for="email">Atlassian email
          <span class="hint">The account the token belongs to</span>
        </label>
        <input id="email" type="email" placeholder="you@yourcompany.com" autocomplete="off" spellcheck="false">
      </div>
      <div>
        <label for="token">API token
          <span class="hint">Stays in this browser tab</span>
        </label>
        <input id="token" type="password" placeholder="ATATT…" autocomplete="off" spellcheck="false">
      </div>
    </div>
    <p class="privacy">
      <strong>Nothing here is submitted.</strong> The command below is assembled by JavaScript in
      your browser; your token is never sent to this server, stored, or logged. It reaches
      Bitbucket only later, on the requests your MCP client makes.
    </p>
  </div>

  <h2>3. Run this command</h2>
  <div class="output">
    <pre id="command" class="pending">Fill in the fields above to generate your command.</pre>
    <button id="copy" type="button" disabled>Copy</button>
  </div>
  <p class="privacy">
    Add <code>--scope user</code> to make it available in every project, or
    <code>--scope project</code> to share it with your team via <code>.mcp.json</code> — but note
    that the header contains your personal token.
  </p>

  <h2>Other MCP clients</h2>
  <div class="output">
    <pre id="json" class="pending">Fill in the fields above to generate your config.</pre>
    <button id="copy-json" type="button" disabled>Copy</button>
  </div>

  <h2>Capabilities <span class="badge">${options.tools.length} tools · ${writeTools} write</span></h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tool</th><th>Description</th><th>Arguments</th></tr></thead>
      <tbody>
        ${options.tools.map(toolRow).join("\n")}
      </tbody>
    </table>
  </div>
  <p class="privacy">Solid arguments are required, dashed are optional. Hover for details.</p>
</main>

<script>
  var ORIGIN = ${JSON.stringify(options.origin)};
  var fields = {
    workspace: document.getElementById('workspace'),
    email: document.getElementById('email'),
    token: document.getElementById('token')
  };
  var commandEl = document.getElementById('command');
  var jsonEl = document.getElementById('json');
  var copyBtn = document.getElementById('copy');
  var copyJsonBtn = document.getElementById('copy-json');

  function basic(email, token) {
    var bytes = new TextEncoder().encode(email + ':' + token);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'Basic ' + btoa(binary);
  }

  function render() {
    var workspace = fields.workspace.value.trim();
    var email = fields.email.value.trim();
    var token = fields.token.value.trim();

    if (!workspace || !email || !token) {
      commandEl.textContent = 'Fill in the fields above to generate your command.';
      jsonEl.textContent = 'Fill in the fields above to generate your config.';
      commandEl.classList.add('pending');
      jsonEl.classList.add('pending');
      copyBtn.disabled = true;
      copyJsonBtn.disabled = true;
      return;
    }

    var url = ORIGIN + '/' + encodeURIComponent(workspace) + '/mcp';
    var header = basic(email, token);

    commandEl.textContent = 'claude mcp add --transport http bitbucket \\\\\\n' +
      '  ' + url + ' \\\\\\n' +
      '  --header "Authorization: ' + header + '"';

    jsonEl.textContent = JSON.stringify({
      mcpServers: {
        bitbucket: { type: 'http', url: url, headers: { Authorization: header } }
      }
    }, null, 2);

    commandEl.classList.remove('pending');
    jsonEl.classList.remove('pending');
    copyBtn.disabled = false;
    copyJsonBtn.disabled = false;
  }

  function copier(button, source) {
    button.addEventListener('click', function () {
      navigator.clipboard.writeText(source.textContent).then(function () {
        var previous = button.textContent;
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = previous; }, 1500);
      });
    });
  }

  Object.keys(fields).forEach(function (key) {
    fields[key].addEventListener('input', render);
  });
  copier(copyBtn, commandEl);
  copier(copyJsonBtn, jsonEl);
  render();
</script>
</body>
</html>
`
}
