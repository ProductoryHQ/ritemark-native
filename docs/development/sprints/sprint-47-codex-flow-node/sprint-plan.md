# Sprint 47: Codex Flow Node

## Goal

Add a "Codex" node to Ritemark Flows that runs autonomous coding tasks via the OpenAI Codex CLI, mirroring the existing Claude Code node in interface and output shape.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - The `codex-integration` flag (id: `codex-integration`, status: `experimental`) already exists in `src/features/flags.ts`. `CodexManager.ensureRunning()` already enforces it. The new executor will inherit this gate automatically by calling `ensureRunning()`.
  - No new flag needed — the existing flag covers all Codex features including this node.

## Success Criteria

- [ ] A "Codex" node appears in the Node Palette under the AI category
- [ ] Dragging it onto the canvas creates a node with a distinct visual identity (different color/icon from Claude Code)
- [ ] The config panel allows editing: label, prompt (with `{Variable}` insertion), model, timeout, and approval policy
- [ ] Model dropdown is populated from `getCodexModels()` (with fallback to hardcoded list)
- [ ] Executing a flow with a Codex node runs `codex app-server`, sends the interpolated prompt, and collects results
- [ ] Execution result shape is `{ text, files, error }` — identical to Claude Code node output, so downstream nodes work without change
- [ ] If Codex is not installed or not authenticated, execution fails gracefully with a setup message
- [ ] The `codex-integration` feature flag gates the node: if disabled, the executor throws with instructions
- [ ] Approval policy: defaults to auto-approve in flow context; config panel shows the setting with a note
- [ ] Variable interpolation (`{Label}` syntax) works in the prompt field

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `src/flows/nodes/CodexNodeExecutor.ts` | Backend executor — initializes app-server, starts thread+turn, collects events, auto-approves, returns `{ text, files, error }` |
| `src/flows/nodes/interpolate.ts` | Extracted shared utility for `interpolateVariables()` (currently private in ClaudeCodeNodeExecutor) |
| `src/flows/types.ts` (edit) | Add `'codex'` to `FlowNode.type` union and add `CodexProgress` / reuse `ClaudeCodeProgress` |
| `src/flows/FlowExecutor.ts` (edit) | Add `case 'codex':` dispatch |
| `webview/.../nodes/CodexNode.tsx` | Canvas node component — purple/indigo header, terminal icon |
| `webview/.../nodes/index.ts` (edit) | Register `codexNode` type |
| `webview/.../NodeConfigPanel.tsx` (edit) | Add `CodexNodeConfig` component and `codexNode` dispatch |
| `webview/.../NodePalette.tsx` (edit) | Add Codex entry to AI category |
| `webview/.../stores/flowEditorStore.ts` (edit) | Add `CodexNodeData` type, type maps, default data, union update, serialization cast |
| `src/flows/nodes/CodexNodeExecutor.test.ts` | Unit tests: variable interpolation, auth-not-ready error, successful execution mock |
| Message handler (edit) | Handle `codex:getModels` request in the extension's webview message handler to send model list to the config panel |

## Implementation Checklist

### Phase 1: Backend — Shared Utility and Types

- [ ] Create `src/flows/nodes/interpolate.ts` — export `interpolateVariables()` extracted from `ClaudeCodeNodeExecutor.ts`
- [ ] Update `src/flows/nodes/ClaudeCodeNodeExecutor.ts` to import `interpolateVariables` from the new shared file (remove local copy)
- [ ] Add `'codex'` to the `FlowNode.type` union in `src/flows/types.ts`

### Phase 2: Backend — Executor

- [ ] Create `src/flows/nodes/CodexNodeExecutor.ts`:
  - Define `CodexNodeData` interface: `{ label, prompt, model, timeout, approvalPolicy }`
  - Define `CodexResult` interface: `{ text, files, error }` (same shape as `ClaudeCodeResult`)
  - `executeCodexNode(node, context, abortSignal?, onProgress?)`:
    1. Check `isEnabled('codex-integration')` — throw with setup message if false
    2. Validate `prompt`
    3. Call `interpolateVariables(prompt, context)`
    4. Call `appServer.ensureInitialized()` — throws if binary not found/not runnable
    5. Check auth via `appServer.getAccount()` — throw with login instructions if not authenticated
    6. `appServer.threadStart({ cwd: context.workspacePath })` → `threadId`
    7. `appServer.turnStart(threadId, interpolatedPrompt, model)` → `turnId`
    8. Listen on `appServer` notifications for `turn/delta`, `turn/complete`, `turn/error`; map to `onProgress` callbacks
    9. Auto-approve all `server-request` events (approval policy = `auto-approve` in flow context)
    10. Accumulate text from `turn/delta` events; collect modified files from `turn/complete`
    11. Respect `abortSignal` — call `appServer.turnInterrupt(threadId, turnId)` if aborted
    12. Return `{ text, files, error }`
  - Export a singleton `appServer` (or accept it as a parameter for testability — prefer parameter)

### Phase 3: Backend — Wiring

- [ ] Update `src/flows/FlowExecutor.ts`: add `import { executeCodexNode }` and `case 'codex':` in `executeNode()`

### Phase 4: Backend — `codex:getModels` Message Handler

- [ ] Find where extension webview messages are handled (the `flow:*` message handler)
- [ ] Add handler for `codex:getModels`: call `getCodexModels()`, post back `{ type: 'codex:modelsResult', models }`

### Phase 5: Frontend — Node Data Types and Store

- [ ] Add `CodexNodeData` interface to `webview/.../stores/flowEditorStore.ts`: `{ label, prompt, model, timeout, approvalPolicy }`
- [ ] Add `CodexNodeData` to `FlowNodeData` union
- [ ] Update `Flow.nodes[].type` union in the store to include `'codex'`
- [ ] Add `'codex': 'codexNode'` to `flowTypeToReactFlowType`
- [ ] Add `'codexNode': 'codex'` to `reactFlowTypeToFlowType`
- [ ] Add `case 'codexNode':` to `getDefaultNodeData()` returning `{ label: 'Codex', prompt: '', model: '', timeout: 5, approvalPolicy: 'auto-approve' }`
- [ ] Update the serialization `as` cast at line ~630 to include `'codex'`

### Phase 6: Frontend — Canvas Node Component

- [ ] Create `webview/.../nodes/CodexNode.tsx` — model after `ClaudeCodeNode.tsx`:
  - Use `Terminal` icon from lucide-react (or `Code2`)
  - Header color: `var(--vscode-charts-purple)` (distinct from Claude Code orange)
  - Show: label, truncated prompt, model (if set), timeout

### Phase 7: Frontend — Node Registry

- [ ] Update `webview/.../nodes/index.ts`: import `CodexNode`, export it, add `codexNode: CodexNode` to `nodeTypes`

### Phase 8: Frontend — Config Panel

- [ ] Add `CodexNodeConfig` component to `NodeConfigPanel.tsx`:
  - Label field (Input)
  - Prompt field (PromptTextArea with variable insertion)
  - Model selector (Select populated from `codex:modelsResult`; shows loading state; defaults to first model)
  - Timeout field (number input, 1–60 min)
  - Approval policy info note: "Flows always auto-approve Codex actions. Configure default policy in Settings."
- [ ] Add `codexNode` dispatch in `NodeConfigPanel` render section

### Phase 9: Frontend — Node Palette

- [ ] Update `NodePalette.tsx`: add `codexNode` entry to AI category with `Code2` or `Terminal` icon and description "Run autonomous coding tasks with OpenAI Codex"

### Phase 10: Tests

- [ ] Create `src/flows/nodes/CodexNodeExecutor.test.ts`:
  - Test: missing prompt throws
  - Test: `codex-integration` flag disabled throws with setup message
  - Test: not authenticated throws with login message
  - Test: variable interpolation is applied to prompt before execution
  - Test: successful mock execution returns `{ text, files }` in correct shape
  - Test: abort signal calls `turnInterrupt`

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Codex `turn/complete` event shape differs from assumption | Medium | Inspect actual events in existing sidebar code; verify field names before implementing |
| `appServer` singleton lifecycle conflicts with sidebar usage | Medium | Pass `appServer` as a parameter to executor; the flow executor creates its own instance |
| Model list unavailable (no cache file) | Low | `getCodexModels()` already has a hardcoded fallback list |
| `turn/delta` does not include file modification info | Medium | File list may only be available in `turn/complete`; research actual protocol event shape |

## Notes on AppServer Instance

The Codex AI sidebar uses its own `CodexAppServer` instance managed by `UnifiedViewProvider`. The flow executor must use a separate instance (or a shared one accessed via a service locator). For simplicity in v1, the executor creates its own `CodexAppServer` instance per execution. This avoids coupling but means two app-server processes if the sidebar is also open. A future sprint can unify via a singleton service.

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes — waiting for Jarmo's approval before Phase 3

## Approval

- [ ] Jarmo approved this sprint plan
