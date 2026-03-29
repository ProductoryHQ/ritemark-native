# Sprint 47 Research: Codex Flow Node

## Summary

All infrastructure needed for this sprint already exists. The task is to wire Codex into the Flows system, following the same pattern as the existing `claude-code` node.

---

## Existing Codex Infrastructure

Located in `extensions/ritemark/src/codex/`:

| File | Role |
|------|------|
| `codexManager.ts` | Binary detection (`findBinaryPath`, `getBinaryStatus`), process lifecycle (`ensureRunning`, `spawn`, `dispose`) |
| `codexAppServer.ts` | `CodexAppServer` class: JSON-RPC 2.0 over stdio. Key methods: `ensureInitialized()`, `threadStart()`, `turnStart()`, `turnInterrupt()`, `sendApprovalResponse()` |
| `codexProtocol.ts` | TypeScript types for all protocol messages |
| `codexAuth.ts` | `CodexAuth` class: wraps `CodexAppServer`, exposes `getAuthStatus()`, login/logout helpers |
| `codexModels.ts` | `getCodexModels()` — reads `~/.codex/models_cache.json`, falls back to hardcoded list |
| `codexApproval.ts` | `routeApprovalRequest()` — maps JSON-RPC method names to `command` / `fileChange` / `denied` |

### Feature Flag

`codex-integration` already exists in `src/features/flags.ts` with status `'experimental'`. `CodexManager.ensureRunning()` already checks this flag and throws if disabled.

### Key AppServer Events

`CodexAppServer` extends `EventEmitter`. Events emitted during a turn:
- `turn/delta` — streaming text chunks
- `turn/completed` — turn finished
- `server-request` — server-initiated approval (command execution, file change)
- `exit` — process died

---

## Existing Flow Node Pattern (Claude Code)

Reference implementation: `src/flows/nodes/ClaudeCodeNodeExecutor.ts`

Relevant characteristics:
- Calls `getSetupStatus()` and `runAgent()` from `../../agent`
- Contains a standalone `interpolateVariables()` function (same logic for both nodes)
- Returns `{ text: string; files: string[]; error?: string }`
- Accepts `abortSignal` and `onProgress` callback

The `ProgressCallback` type in `types.ts` accepts: `'init' | 'tool_use' | 'thinking' | 'text' | 'done'`. Claude Code maps unsupported event types to `'done'`.

### FlowNode type union (types.ts line 38)

```typescript
type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code';
```

Needs `'codex'` appended.

### FlowExecutor.ts

Switch statement at line 92 dispatches by `node.type`. A new `case 'codex':` is required.

---

## Frontend Touchpoints

| File | What changes |
|------|-------------|
| `webview/src/components/flows/nodes/ClaudeCodeNode.tsx` | Template — copy and adapt for Codex |
| `webview/src/components/flows/nodes/index.ts` | Register `codexNode` in `nodeTypes` map |
| `webview/src/components/flows/NodePalette.tsx` | Add entry to AI category |
| `webview/src/components/flows/NodeConfigPanel.tsx` | Add `CodexNodeConfig` component and render branch |
| `webview/src/components/flows/stores/flowEditorStore.ts` | Add `CodexNodeData` interface; add `'codex'` to the `Flow.nodes[].type` union; add default data in `createNode` |

### flowEditorStore.ts node type union (line 90)

```typescript
type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code';
```

Needs `'codex'` appended.

### Model selector

`getCodexModels()` is backend-only (reads filesystem). The webview cannot call it directly. The extension must push model list to webview on init, similar to how `flow:modelConfig` works for LLM models. The simplest path: send a `flow:codexModels` message from the extension when the flow editor opens, store in a small Zustand slice or React context.

Alternatively (simpler for a first version): hardcode the same fallback models in the webview and allow free-text model entry. This avoids a new message round-trip.

Decision for sprint plan: fetch models from extension via a `flow:codexModels` request/response pair (keeps webview in sync with user's actual installed models).

---

## Approval Policy

The existing Codex sidebar uses `ritemark.codex.approvalPolicy` (values: `'suggest'`, `'auto-approve-read'`, `'auto-approve-all'`). In a flow context, blocking for user approval is impractical. Recommended approach:

- Default to `'auto-approve-all'` for flow execution
- Allow per-node override via a dropdown in the config panel
- The executor reads the setting from the node data; falls back to the global VS Code config value

---

## Tests

Existing test files to model after:
- `src/flows/nodes/ClaudeCodeNodeExecutor.test.ts` — tests `interpolateVariables` and type checks
- `src/flows/FlowIntegration.test.ts` — integration tests with mock executors

New tests needed:
- `src/flows/nodes/CodexNodeExecutor.test.ts` — unit tests for variable interpolation (can share the same function) and execution path validation
- Update `FlowIntegration.test.ts` — add `'codex'` to the `FlowNode.type` union in test types; add a mock codex node test

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Codex app-server startup is async (~100ms) | `CodexAppServer.ensureInitialized()` already handles this; executor just awaits it |
| Turn completion detection | Must listen for `turn/completed` event with correct `turnId`; timeout from node config |
| Approval requests during flow execution | Default to auto-approve-all in flow context; use `sendApprovalResponse()` |
| Model list not available in webview | Send via `flow:codexModels` message on flow editor init |
| Feature flag off | Executor must catch the flag error and return it as a `{ error }` result, not a throw |
