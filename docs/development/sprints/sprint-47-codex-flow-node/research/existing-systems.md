# Sprint 47 Research: Existing Systems

## Feature Flag

`codex-integration` (id: `codex-integration`) already exists in `src/features/flags.ts`.
Status: `experimental`, all platforms. The `CodexManager.ensureRunning()` already gates on this flag — the executor must call `ensureRunning()` and the error will propagate naturally.

## Backend: Codex Integration Layer

Located in `extensions/ritemark/src/codex/`:

| File | Role |
|------|------|
| `codexManager.ts` | Binary detection, `getBinaryStatus()`, `ensureRunning()`, `spawn()`, `send()` |
| `codexAppServer.ts` | JSON-RPC client (EventEmitter). Key methods: `ensureInitialized()`, `threadStart({ cwd })`, `turnStart(threadId, prompt, model)`, `sendApprovalResponse(requestId, decision)`, `on('server-request', ...)`, `on(method, ...)` |
| `codexApproval.ts` | `routeApprovalRequest()` maps server-request method names to typed results |
| `codexAuth.ts` | `CodexAuth` class — exposes `getStatus()` returning `CodexAuthStatus { authenticated, authMethod, email, plan }` |
| `codexModels.ts` | `getCodexModels()` — reads `~/.codex/models_cache.json`, falls back to hardcoded list |

### Codex execution pattern (how the AI sidebar does it)

1. `appServer.ensureInitialized()` — starts binary + RPC handshake
2. `appServer.threadStart({ cwd: workspacePath })` → `{ threadId }`
3. `appServer.turnStart(threadId, prompt, model)` → `{ turnId }`
4. Listen on `appServer.on('notification', ...)` for turn events
5. Key notification methods: `turn/delta`, `turn/complete`, `turn/error`
6. Approval requests arrive as `server-request` events; respond with `appServer.sendApprovalResponse(id, 'approve' | 'deny')`

## Backend: Flow Executor

`src/flows/FlowExecutor.ts` — `executeNode()` switch dispatches by `node.type`. Adding `case 'codex':` is all that's needed on the executor side.

`src/flows/types.ts` — `FlowNode.type` union is a literal type: `'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code'`. Must add `'codex'`.

`src/flows/types.ts` — `ClaudeCodeProgress` type is used for the `ProgressCallback`. The Codex executor can reuse `ProgressCallback` as-is (same shape is acceptable — type fields map naturally).

## Backend: Claude Code Executor Pattern

`src/flows/nodes/ClaudeCodeNodeExecutor.ts` is the template:
- Reads `node.data as ClaudeCodeNodeData`
- Validates `prompt`
- Calls `interpolateVariables(prompt, context)` (helper in same file — must be extracted or duplicated)
- Calls external runner, maps progress, returns `{ text, files, error }`

The `interpolateVariables` function is not exported. The Codex executor either duplicates it or we export it. Best approach: extract to a shared `src/flows/nodes/interpolate.ts` utility during implementation.

## Frontend: Node Type System

### flowEditorStore.ts
- `Flow.nodes[].type` union: `'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code'` — must add `'codex'`
- `flowTypeToReactFlowType` map — must add `'codex': 'codexNode'`
- `reactFlowTypeToFlowType` map — must add `'codexNode': 'codex'`
- `getDefaultNodeData(type)` switch — must add `case 'codexNode':`
- `FlowNodeData` union — must add `CodexNodeData`
- Serialization cast at line 630 — must add `'codex'` to the `as` cast

### nodes/index.ts
- Must import and export `CodexNode`
- Must add `codexNode: CodexNode` to `nodeTypes` map

### NodePalette.tsx
- AI category already has `claudeCodeNode` entry; add `codexNode` entry with a distinct icon

### NodeConfigPanel.tsx
- Switch-style rendering at lines 91–129; add `{selectedNode.type === 'codexNode' && <CodexNodeConfig ... />}`
- `CodexNodeConfig` component needs: label, prompt textarea (with variable insertion via PromptTextArea), model selector (populated from `codex:getModels` message), timeout, approval policy

## Frontend: Model Data

The webview does not have direct access to `getCodexModels()`. The extension must send model data via a message (same pattern as `flow:modelConfig`). A new message type `codex:getModels` / `codex:modelsResult` should be added, or models can be included in node initialization data. The simplest approach: request models when CodexNodeConfig mounts, via `vscode.postMessage({ type: 'codex:getModels' })`, and receive `{ type: 'codex:modelsResult', models: [...] }`.

## Approval Policy

The Codex sidebar has an approval policy setting (`ritemark.codex.approvalPolicy`). In flow context, the safest default is `auto-approve` since flows are non-interactive. The node config should allow override: `auto-approve` | `use-settings`. If `use-settings` is chosen and the running approval policy requires user input, the executor should deny all and note the limitation. Simplest for v1: always auto-approve in flow context, with a note in the UI.

## Tests

No existing test files found under `src/flows/`. The context mentions `src/flows/FlowIntegration.test.ts` but it does not exist yet. Tests should be created as part of this sprint.
