# Phase 0 Audit: Codex MCP Injection

**Date:** 2026-06-07
**Auditor:** Claude Code (automated read audit — no Codex process spawned)
**Status:** COMPLETE — decision reached

---

## 1. How Codex Session Initialization Works Today

Codex runs as a child process (`codex app-server` or the standalone `codex-app-server` binary) communicating via JSON-RPC 2.0 over stdio (JSONL framing). The startup sequence is:

### Step 1 — Process spawn
`CodexManager.spawn()` forks the binary with `stdio: ['pipe', 'pipe', 'pipe']`.
No arguments are passed at fork time that affect tool capabilities.
Source: `src/codex/codexManager.ts` — `buildAppServerArgs()` returns `[]` for `codex-app-server` or `['app-server']` for the CLI launcher.

### Step 2 — `initialize` RPC (connection handshake)
`CodexAppServer.ensureInitialized()` sends:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "clientInfo": { "name": "ritemark-native", "title": "Ritemark Native", "version": "1.4.0" },
    "capabilities": { "experimentalApi": true }
  }
}
```

`InitializeParams` has two fields only: `clientInfo` and `capabilities`. There is no `mcpServers`, `mcp`, or `tools` field.
Source: `src/codex/codexProtocol.ts` — `InitializeParams`.

### Step 3 — `thread/start` RPC (session creation)
`CodexAppServer.threadStart()` sends `ThreadStartParams` which includes:

```typescript
export interface ThreadStartParams {
  model?: string | null;
  modelProvider?: string | null;
  cwd?: string | null;
  approvalPolicy?: 'untrusted' | 'on-failure' | 'on-request' | 'never' | null;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access' | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  experimentalRawEvents: boolean;
  persistExtendedHistory: boolean;
  /** Experimental Codex App Server feature — see DynamicToolDefinition. */
  dynamicTools?: DynamicToolDefinition[];
}
```

**This is the only mechanism for injecting extra tools into a Codex session.**
Source: `src/codex/codexProtocol.ts` — `ThreadStartParams`.

### Step 4 — Dynamic tool call/response cycle
When the model invokes a dynamic tool, Codex sends an `item/tool/call` server-initiated JSON-RPC request (with an id) to the client. The client must respond with `{ contentItems: [{ type: 'inputText', text }], success }` using that same request id.
Source: `src/codex/codexProtocol.ts` — `ToolCallRequestParams`, `ToolCallResponse`.

---

## 2. Current Browser Tool Injection Mechanism

`src/browser/codexBrowserTools.ts` defines:

- `buildCodexBrowserDynamicTools()` — returns 6 `DynamicToolDefinition` objects with the `ritemark_browser_*` prefix (to avoid collision with Codex reserved namespaces: `functions`, `browser`, `computer`, `terminal`, etc.)
- `dispatchCodexBrowserToolCall()` — dispatches incoming `item/tool/call` requests to `BrowserActionTools` and formats the result for the response

These are wired in `UnifiedViewProvider.ts`:

```typescript
// Line 1513 — thread/start call
const dynamicTools = browserControlEnabled ? buildCodexBrowserDynamicTools() : undefined;
const result = await appServer.threadStart({
  ...
  ...(dynamicTools ? { dynamicTools } : {}),
});
this._codexBrowserToolsEnabledForThread = Boolean(dynamicTools?.length);
```

And the tool-call response path:

```typescript
// Line 2084 area — server-request handler
// dispatches item/tool/call to dispatchCodexBrowserToolCall()
// then calls appServer.sendToolCallResponse(requestId, text, success)
```

The `_codexBrowserToolsEnabledForThread` flag on `UnifiedViewProvider` is used to track whether the current thread was started with dynamic tools (so the pre-action browser navigation fallback path is correctly skipped).

---

## 3. Can MCP Servers Be Passed at Session Start?

**No.**

Neither `InitializeParams` nor `ThreadStartParams` contains an `mcpServers` field or any MCP-protocol-level injection mechanism. The Codex App Server protocol does not speak MCP — it is a proprietary JSON-RPC 2.0 protocol with its own tool model (`dynamicTools`).

Checked:
- `codexProtocol.ts` (all exported types) — no MCP fields
- `codexAppServer.ts` (initialize + threadStart call sites) — no MCP parameters
- `node_modules/` — no `@openai/codex` package installed (the binary is bundled, not an npm dep); no codex-related `.d.ts` files with MCP/mcpServers references

The `dynamicTools` mechanism in `ThreadStartParams` is the one and only supported extension point for custom tools in Codex. It requires `capabilities.experimentalApi: true` in the `initialize` handshake (already set in the current implementation).

---

## 4. Decision

**Path B — keep dynamic injection, move inside `CodexRuntime` adapter.**

### Rationale

Codex has no MCP protocol support. Replacing `dynamicTools` with MCP injection is not possible without Codex upstream changes. Path A cannot be implemented.

Path B as defined in `technical-plan.md` § Workstream 3:

- `codexBrowserTools.ts` is **kept** (not deleted)
- The `dynamicTools` injection logic moves from `UnifiedViewProvider` into `CodexRuntime.start()` or `CodexRuntime.prompt()` as appropriate
- `_codexBrowserToolsEnabledForThread` state moves from `UnifiedViewProvider` to `CodexRuntime`
- `BrowserToolsInjector` has two modes: `mode: 'mcp'` (Claude Code, ACP) and `mode: 'dynamic-tools'` (Codex fallback)
- Record as ARCH-8 debt in `docs/development/architecture.md`

### Consequence for `CodexRuntime` adapter design

`CodexRuntime.start(config: RuntimeSessionConfig)` must:
1. Receive `mcpServers` from `RuntimeSessionConfig` (present when `BrowserToolsInjector` is in `'mcp'` mode — ignored for Codex)
2. Internally call `buildCodexBrowserDynamicTools()` when the `browser-agent-control` feature flag is on
3. Pass `dynamicTools` to `threadStart()` (current behavior, unchanged in substance)
4. Own the `codexBrowserToolsEnabledForThread` flag

The `dispatchCodexBrowserToolCall()` dispatch logic and `appServer.sendToolCallResponse()` call currently inside `UnifiedViewProvider` move to `CodexRuntime` unchanged.

### No impact on Claude Code or ACP runtimes

`ClaudeCodeRuntime` and `AcpRuntime` use `RuntimeSessionConfig.mcpServers` via `BrowserToolsInjector` in `mode: 'mcp'` — they do not touch `dynamicTools`. These paths are independent of this audit result.

---

## 5. Files Relevant to This Decision

| File | Role |
|---|---|
| `src/codex/codexProtocol.ts` | Protocol type definitions — confirms no MCP fields |
| `src/codex/codexAppServer.ts` | `ensureInitialized()` + `threadStart()` — the session init path |
| `src/codex/codexManager.ts` | Process lifecycle — spawn args, no MCP hooks |
| `src/browser/codexBrowserTools.ts` | Dynamic tools implementation — stays, moves into `CodexRuntime` |
| `src/views/UnifiedViewProvider.ts` | Lines 1509–1531 + ~2084 — current wiring to be migrated to `CodexRuntime` |
| `src/runtime/BrowserToolsInjector.ts` (to be created) | Must expose `mode: 'mcp' | 'dynamic-tools'` |
