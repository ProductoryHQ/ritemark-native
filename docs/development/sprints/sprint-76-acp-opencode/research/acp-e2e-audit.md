# ACP e2e Audit — OpenCode over Agent Client Protocol

**Sprint:** 76 (ACP client + OpenCode BYOK runtime) · **Phase:** 0a · **Date:** 2026-06-01
**Resolves:** technical-plan Workstream 0 `research/acp-e2e-audit.md`; mechanism for spec R6; trigger for R3; gating contract for R4.

> Environment caveat: run on **Linux x64** container (binary `opencode-linux-x64` 1.15.13), not
> darwin-arm64. Protocol mechanics are platform-independent and the bundled darwin binary is the
> same Bun-compiled OpenCode build, so findings transfer — but anything marked **darwin-residual**
> must be re-confirmed on Apple Silicon before R-sign-off. No real LLM API key was available;
> LLM-output-dependent steps are marked **verified up to auth boundary**.

---

## What we tested

| # | Test | Tooling |
| --- | --- | --- |
| T1 | Install `opencode-ai` + `@agentclientprotocol/sdk`, run `opencode --version` | npm |
| T2 | Enumerate the ACP SDK client API (exports, ClientSideConnection, Client interface) | node_modules `.d.ts` |
| T3 | Spawn `opencode acp`, `initialize`, `session/new`, inspect handshake payloads | `acp-e2e.mjs` |
| T4 | `session/prompt` **with no API keys** | `acp-e2e.mjs nokeys` |
| T5 | `session/prompt` after selecting a Google model, **bogus Gemini key** | `acp-autherr.mjs` |
| T6 | Model selection mechanism (modes? models? config options? CLI? env?) | `acp-model.mjs` |
| T7 | File-write: does OpenCode call `fs/write_text_file` / `session/request_permission`, or write disk directly? | `acp-fstest.mjs` |
| T8 | File-write with `OPENCODE_PERMISSION={"edit":"ask",…}` in spawn env | `acp-perm.mjs` |
| T9 | `session/cancel` behaviour | `acp-model.mjs` |

**Exact versions installed (T1):**
- `opencode-ai` **1.15.13** (MIT) → platform binary `opencode-linux-x64@1.15.13`; `opencode --version` → `1.15.13`.
- `@agentclientprotocol/sdk` **0.22.1** (Apache-2.0). `PROTOCOL_VERSION === 1`.

---

## What we observed

### SDK API surface (T2) — names the technical plan must use

`@agentclientprotocol/sdk` main entry `dist/acp.js`. Client side:

```js
import * as acp from "@agentclientprotocol/sdk";
const stream = acp.ndJsonStream(Writable.toWeb(proc.stdin), Readable.toWeb(proc.stdout));
const conn   = new acp.ClientSideConnection((agent) => clientHandler, stream);
acp.PROTOCOL_VERSION // === 1
```

- **`ClientSideConnection`** (the object the extension drives) exposes, among others:
  `initialize`, `newSession`, `loadSession`, `prompt`, `cancel`, `setSessionMode`,
  `setSessionConfigOption`, `unstable_setSessionModel`, `authenticate`, `closeSession`,
  `listSessions`, `resumeSession`. Note the camelCase SDK names map to slash wire methods
  (e.g. `setSessionConfigOption` → `session/set_config_option`, `cancel` → `session/cancel`).
- **`Client`** (the handler **we** implement; agent → client requests). Methods that matter:
  `requestPermission(params)`, `sessionUpdate(params)` (notification), and the **optional**
  `writeTextFile(params)` / `readTextFile(params)`. Terminal methods are optional too.
- Stream wiring is exactly the `codexAppServer.ts` shape but the SDK owns JSON-RPC framing,
  id correlation and ndjson parsing — confirming the technical-plan claim that the SDK replaces
  `codexProtocol.ts`'s hand-written layer.

### Handshake (T3)

`initialize({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } } })` →

```json
{
  "protocolVersion": 1,
  "agentCapabilities": {
    "loadSession": true,
    "mcpCapabilities": { "http": true, "sse": true },
    "promptCapabilities": { "embeddedContext": true, "image": true },
    "sessionCapabilities": { "close": {}, "fork": {}, "list": {}, "resume": {} }
  },
  "authMethods": [
    { "id": "opencode-login", "name": "Login with opencode",
      "description": "Run `opencode auth login` in the terminal" }
  ],
  "agentInfo": { "name": "OpenCode", "version": "1.15.13" }
}
```

- The **only** advertised `authMethod` is `opencode-login` (the OpenCode Zen subscription OAuth).
  BYOK provider keys are **not** an ACP auth method — they are consumed purely from process env
  (confirms R3's env-injection design; no `authenticate` call is needed for BYOK).
- `session/new` (`newSession({ cwd, mcpServers: [] })`) requires absolute `cwd` and an
  `mcpServers` array (may be empty). It returned:

```json
{
  "sessionId": "ses_17cd8c2e7ffe…",
  "configOptions": [ { "id": "model", … }, { "id": "mode", … }, { "id": "effort", … } ],
  "modes": <absent>,
  "models": <absent>
}
```

  **Key:** OpenCode populates `NewSessionResponse.configOptions`, **not** the ACP-standard
  `models` (`SessionModelState`) or `modes` (`SessionModeState`) fields. See model-selection below.

### Prompt without keys (T4) — **R3 trigger is NOT "no key = error"**

With **zero** provider env vars, `prompt({ sessionId, prompt:[{type:"text",text:"Say hello in one word."}] })`
**succeeded**:

```json
{ "stopReason": "end_turn",
  "usage": { "inputTokens": 8170, "outputTokens": 2, "totalTokens": 8183 } }
```

Streamed `agent_thought_chunk` updates then an `agent_message_chunk` "Hello". OpenCode fell back to
its built-in default model **`opencode/big-pickle`** (the OpenCode Zen hosted free tier) which needs
no user key. Implication for R3: selecting OpenCode with no BYOK keys does **not** produce a
hard error; it silently uses OpenCode Zen. The R3 setup-prompt must therefore be driven by
**Ritemark's own "no BYOK key configured" state**, not by an ACP error — see Decisions.

### Auth boundary with a real provider model (T5) — **verified up to auth boundary**

Selecting `google/gemini-2.5-pro` (via T6 mechanism) with a **bogus** `GEMINI_API_KEY` then
prompting returned:

```json
{ "stopReason": "end_turn",
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 } }
```

No text, **no error surfaced over ACP, nothing on stderr.** A bad/absent key for a selected provider
produces a **silent empty turn**, not a typed error. This is a meaningful gap (see Residual R-1 and
the R5 error-surfacing note). We could not observe a *successful* real-model turn (no valid key).

### Model selection mechanism (T6) — **THE primary finding (resolves R6 mechanism)**

OpenCode communicates model choice through ACP **session config options**, surfaced in
`NewSessionResponse.configOptions` and changed at runtime with `session/set_config_option`:

- `newSession` returns a `configOptions` array. The model selector is:
  ```json
  { "id": "model", "name": "Model", "category": "model", "type": "select",
    "currentValue": "opencode/big-pickle",
    "options": [ { "value": "google/gemini-2.5-pro", "name": "Google/Gemini 2.5 Pro" },
                 { "value": "openai/gpt-5.2", "name": "OpenAI/GPT-5.2" },
                 { "value": "opencode/big-pickle", "name": "OpenCode Zen/Big Pickle" }, … ] }
  ```
  Values use `provider/model` form — **exactly the `opencode:<provider>/<model>` composite the
  R6 acceptance criteria already specify** (drop the `opencode:` prefix to get the config value).
- There are **two more** config options: `mode` (`build` default / `plan` — plan disallows edits)
  and `effort` (`high` / `max`; reasoning level, model-dependent).
- To set the model at runtime, call (SDK):
  ```js
  await conn.setSessionConfigOption({ sessionId, configId: "model", value: "google/gemini-2.5-pro" });
  ```
  **Exact param names matter:** the request body is `{ configId, sessionId, value }` (wire method
  `session/set_config_option`). A first attempt with `optionId` (wrong) was silently dropped and
  returned `-32602 Invalid params … configId: expected string, received undefined`. The SDK type is
  `SetSessionConfigOptionRequest` and the validator is `zSetSessionConfigOptionRequest`.
  On success it echoes the **full refreshed `configOptions`** with the new `currentValue`.
- The standard ACP `setSessionMode` / `unstable_setSessionModel` methods exist in the SDK but
  OpenCode 1.15.13 routes everything through `configOptions` instead. **Use
  `setSessionConfigOption` with `configId:"model"`.** (`unstable_setSessionModel` was not exercised
  against OpenCode and is UNVERIFIED for it; do not rely on it.)
- The model list is **provider-filtered by env keys server-side**: the option list grows once a
  provider key is present in env. So R6's "only show Gemini models if a Gemini key exists" can be
  satisfied either by Ritemark filtering its curated `BYOK_PROVIDER_MODELS` by configured providers
  (preferred, per CLAUDE.md single-source rule) **or** by reading the live `configOptions` list.
- Alternative mechanisms checked and **not** needed: no `--model` CLI flag is required on
  `opencode acp`; `OPENCODE_MODEL` env / `opencode.json` were not necessary because the in-session
  `set_config_option` path works and is the cleanest.

### Filesystem behaviour (T7/T8) — **CRITICAL for R4**

- **Default behaviour (T7): OpenCode writes files DIRECTLY to disk.** Asked to create `demo.txt`,
  the file appeared on disk (`/tmp/acp-audit/demo.txt` = "banana"), and our client's
  `writeTextFile`/`readTextFile`/`requestPermission` handlers were **never called**
  (`perm=0 write=0 read=0`) — even though we declared `fs.readTextFile:true` /
  `fs.writeTextFile:true` in `initialize`. We only saw informational `tool_call` /
  `tool_call_update` notifications (`title:"write"`, `kind:"edit"`, `locations[].path`).
  **Out of the box, R4 approval gating does not engage.**

- **Fix (T8): set `OPENCODE_PERMISSION` in the spawn env.** With
  `OPENCODE_PERMISSION={"edit":"ask","bash":"ask","webfetch":"ask"}` the same write request:
  1. emitted a real `session/request_permission`:
     ```json
     { "toolCall": { "title": "edit", … },
       "options": [ { "optionId": "once",   "kind": "allow_once",   "name": "Allow once" },
                    { "optionId": "always", "kind": "allow_always", "name": "Always allow" },
                    { "optionId": "reject", "kind": "reject_once",  "name": "Reject" } ] }
     ```
  2. routed the actual write through our client's **`fs/write_text_file`** handler
     (`FS_WRITE /tmp/acp-audit/demo2.txt`).
  The three options map 1:1 to existing Codex approval semantics, **including the "always allow for
  this session"** that R4 requires (`allow_always`). Responding with
  `{ outcome: { outcome: "selected", optionId } }` or `{ outcome: { outcome: "cancelled" } }`
  works as the example client shows.

  ⇒ **R4 design must inject `OPENCODE_PERMISSION` (edit/bash/webfetch = "ask") into the spawn env**
  alongside the BYOK keys. This is the lever that turns OpenCode's autonomous writes into
  client-gated, proxied writes. Without it, R4's "no silent writes, ever" invariant is violated.

### Permission request / response shape (T8, restated for R4 wiring)

- Request method: `session/request_permission`, params `{ sessionId, toolCall, options[] }`,
  each option `{ optionId, kind, name }`, `kind ∈ {allow_once, allow_always, reject_once}`.
- Response: `{ outcome: { outcome: "selected", optionId } }` or `{ outcome: { outcome: "cancelled" } }`.
- File writes additionally arrive as `fs/write_text_file` `{ sessionId, path, content }` and reads
  as `fs/read_text_file` `{ sessionId, path, line?, limit? }` — so `acpFsProxy.ts` (backed by
  `vscode.workspace.fs`) and the workspace-root path check in `acpApproval.ts` are both reachable.

### Cancellation (T9) — **R5 gap**

`conn.cancel({ sessionId })` (wire `session/cancel`) returned **`-32601 "Method not found"`** on
OpenCode 1.15.13:

```
Error handling notification … session/cancel … { code: -32601, message: "\"Method not found\": session/cancel" }
```

OpenCode does **not** implement ACP cancellation. The in-flight "count to 100" prompt ran to
completion (`stopReason:"end_turn"`) and ignored the cancel. R5's "cancellation returns UI to idle
within 2 s" cannot be met by sending `session/cancel` alone — see Residual R-2.

---

## Decision

**SHIP via ACP/stdio** — the core protocol path works end-to-end against the real OpenCode binary:
handshake, `session/new`, streaming `session/update` (thought + message chunks, tool_call updates,
usage_update), `session/prompt`, model selection, and (with the permission-env lever) client-proxied
`fs/write_text_file` + `session/request_permission` approval gating. The HTTP-server fallback
(`opencode serve`) is **not** needed.

Decision is conditional on three implementation requirements that the audit surfaced:

1. **R4 — inject `OPENCODE_PERMISSION` env** (`{"edit":"ask","bash":"ask","webfetch":"ask"}`) at
   spawn. This is mandatory, not optional: it is the only thing that makes OpenCode request
   permission and proxy writes through the client instead of writing disk directly.
2. **R6 — model selection = `setSessionConfigOption({ configId:"model", value:"<provider>/<model>"})`**
   after `session/new` (or read `configOptions[id=model]` for the live list). Not `setSessionMode`,
   not `unstable_setSessionModel`. Param key is `configId` (not `optionId`).
3. **R3 — setup-prompt trigger is Ritemark-side state, not an ACP error.** OpenCode with no key
   silently uses `opencode/big-pickle` (OpenCode Zen). Show the "Set up your keys" card when the
   user has no BYOK key configured in Settings, before/independent of any ACP call.

---

## Blockers / residuals

| # | Item | Severity | Notes |
| --- | --- | --- | --- |
| R-1 | **Bad/missing provider key → silent empty turn** (`end_turn`, 0 tokens, no ACP error, no stderr). | High for R5 ("errors surface as actionable text"). | Verified up to auth boundary only. Mitigation: when a BYOK provider model is selected, gate on Ritemark's key presence first; consider treating a 0-token `end_turn` with empty content as a soft error in the UI. Needs re-test with a **real** key to confirm whether a *valid*-but-rate-limited/quota error surfaces differently. |
| R-2 | **`session/cancel` not implemented** (`-32601`). | High for R5 cancellation criterion. | OpenCode 1.15.13 ignores cancel. Options: (a) kill/restart the child process on cancel (heavy, drops session); (b) check newer OpenCode versions for cancel support before pinning; (c) accept "cancel = abandon turn output, process keeps running until end_turn" as a documented limitation. Re-verify against the pinned bundle version. |
| R-3 | **Real successful model turn never observed** (no API key in env). | Medium. | Handshake/session/prompt verified up to auth boundary; streaming of a *real* provider response (Gemini/OpenAI) and the exact `session/update` shapes for a long answer with tool calls should be re-confirmed once a key is available. The `opencode/big-pickle` free turn did exercise the streaming path successfully, so update plumbing is proven. |
| R-4 | **darwin-arm64 not exercised** (audit ran on linux-x64). | Medium (darwin-residual). | Re-run `acp-e2e.mjs` against the bundled darwin-arm64 binary on Apple Silicon to confirm identical handshake/config-options/permission behaviour and no Gatekeeper interference with the spawned child. |
| R-5 | **First `opencode acp` run does a one-time sqlite migration** ("Performing one time database migration… sqlite-migration:done"), printed to stderr, adding cold-start latency. | Low. | Mirror codex's `thread/start` slow-first-call handling: emit a "Starting OpenCode…" progress event after ~10 s; don't treat the migration stderr as an error. |
| R-6 | **SDK is pre-1.0** (`@agentclientprotocol/sdk@0.22.1`) and several relevant methods are `unstable_*`. | Low/Medium. | Pin exact version in `package.json` (technical-plan already requires this). The methods we depend on (`initialize`, `newSession`, `prompt`, `setSessionConfigOption`, `requestPermission`, `sessionUpdate`, `writeTextFile`/`readTextFile`) are stable, non-`unstable_` surface. |
| R-7 | **Tool-call progress mapping needs `tool_call`/`tool_call_update` handling**, not just message/thought chunks. | Low. | Observed update types: `available_commands_update`, `agent_thought_chunk`, `agent_message_chunk`, `tool_call`, `tool_call_update`, `usage_update`. Extend the technical-plan progress mapping (which lists `tool_call (pending)` → tool_use) to also consume `tool_call_update` for status/locations and ignore `available_commands_update`/`usage_update` for the baseline UI. |
