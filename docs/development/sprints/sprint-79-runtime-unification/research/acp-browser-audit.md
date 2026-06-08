# ACP Browser MCP Injection Audit

**Sprint:** 79 — Runtime Unification  
**Date:** 2026-06-07  
**Question:** Does ACP `initialize` accept `mcpServers`? Can `BrowserToolsInjector` inject browser MCP tools into the ACP runtime via the standard protocol?

---

## 1. ACP `initialize` fields

`InitializeRequest` (schema `x-method: initialize`) accepts:

| Field | Required | Notes |
|---|---|---|
| `protocolVersion` | yes | Sent as `acp.PROTOCOL_VERSION` |
| `clientInfo` | no | `{ name, version }` |
| `clientCapabilities` | no | `{ fs, auth, terminal, elicitation, nes, positionEncodings }` |
| `_meta` | no | Extensibility bag |

**`mcpServers` is NOT a field of `initialize`.** There is no mechanism to inject MCP server config during the handshake.

Current Ritemark call site (`acpClient.ts` line 133–139):

```typescript
const result = await this.connection.initialize({
  protocolVersion: acp.PROTOCOL_VERSION,
  clientInfo: { name: 'ritemark-native', version: '1.7.2' },
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
  },
});
```

This is correct and complete — nothing more to add here.

---

## 2. ACP `session/new` fields — the actual injection point

`NewSessionRequest` (schema `x-method: session/new`) accepts:

| Field | Required | Notes |
|---|---|---|
| `cwd` | yes | Absolute path |
| `mcpServers` | yes | Array (may be empty) |
| `additionalDirectories` | no | UNSTABLE — extra workspace roots |
| `_meta` | no | Extensibility bag |

**`mcpServers` is a required field of `session/new`, not `initialize`.** This is the correct injection point.

Current Ritemark call site (`acpClient.ts` line 147–149):

```typescript
const result = await connection.newSession({ cwd, mcpServers: [] });
```

An empty array is already passed and satisfies the schema requirement. Injecting browser tools means replacing `[]` with one or more `McpServer` entries.

---

## 3. McpServer transport options

The `McpServer` union supports four transports. Only **stdio** is universally required:

| Transport | Availability | Schema required fields |
|---|---|---|
| `stdio` | All agents MUST support | `name`, `command`, `args`, `env` |
| `http` | Only if `agentCapabilities.mcpCapabilities.http = true` | `name`, `url`, `headers` |
| `sse` | Only if `agentCapabilities.mcpCapabilities.sse = true` | `name`, `url`, `headers` |
| `acp` | UNSTABLE — only if `mcpCapabilities.acp = true` | `name`, `id` |

For `BrowserToolsInjector`, the only viable transport is **stdio**, because:
- `BrowserMcpServer` is an in-process Claude SDK server (not a separately spawned HTTP/SSE server).
- OpenCode's `mcpCapabilities` defaults are `{ acp: false, http: false, sse: false }`.
- Stdio is the only transport all ACP agents must support.

However, there is a fundamental mismatch: the existing `browserMcpServer.ts` builds a Claude Agent SDK in-process server object via `sdk.createSdkMcpServer(...)`. This is wired directly into the Claude Code SDK agent session — it is not a stdio-addressable subprocess. To use it with ACP `mcpServers`, a separately spawned stdio MCP process would be needed, not an in-process object.

---

## 4. Current `BrowserMcpServer` architecture

`extensions/ritemark/src/browser/browserMcpServer.ts`:

- Uses `@anthropic-ai/claude-agent-sdk` (`sdk.createSdkMcpServer`, `sdk.tool`).
- Returns an in-process object compatible with the Claude Code SDK's `mcpServers` array in `AgentSession` config.
- Does **not** expose a stdio transport or HTTP endpoint.
- This object **cannot** be passed as an ACP `McpServer` entry — the types and lifecycle are incompatible.

To inject browser tools into ACP via `NewSessionRequest.mcpServers`, a stdio-based MCP server process would need to exist: a separate Node.js script (or binary) that speaks the MCP stdio protocol and proxies calls to `BrowserActionTools`. The ACP agent would spawn it as a subprocess.

---

## 5. Decision

**Path A (MCP injection via `newSession.mcpServers` stdio transport) — NOT feasible this sprint.**

Reasons:
1. `BrowserMcpServer` is an in-process Claude SDK object, not a stdio subprocess. Adapting it requires building a standalone MCP stdio server wrapper.
2. That wrapper would need to be either bundled as a new binary or launched as a Node.js child process with a known entry point — a non-trivial build/packaging change outside Sprint 79's scope.
3. The `initialize` call is confirmed as not the right place (as originally suspected); `newSession` is — but the transport incompatibility remains.

**Recommended Sprint 79 approach: stub with "not supported" message.**

In `BrowserToolsInjector`, when the runtime is ACP/OpenCode:
- Skip MCP injection (pass `mcpServers: []` as today).
- Optionally surface a `console.warn` or trace log explaining that browser tools are not available for the ACP runtime until a stdio adapter is built.
- Track the stdio adapter work as a follow-on GitHub Issue.

The Claude Code SDK runtime continues to work via in-process `BrowserMcpServer` unchanged.

---

## 6. Summary table

| Question | Answer |
|---|---|
| Does `initialize` accept `mcpServers`? | No |
| Does `session/new` accept `mcpServers`? | Yes — it is a required field |
| What transports are available? | stdio (universal), http/sse (capability-gated), acp (unstable) |
| Can existing `BrowserMcpServer` be injected? | No — it is a Claude SDK in-process object, not a stdio process |
| Is MCP injection feasible this sprint? | No — requires a new stdio adapter binary/script |
| Recommended Sprint 79 decision | Defer: stub ACP browser tools as "not supported"; file follow-on issue |
