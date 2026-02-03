# Sprint 01: Claude Code Node for Ritemark Flows

## Goal

Add a Claude Code node to Ritemark Flows that executes autonomous coding tasks via Claude Code CLI, enabling office automation workflows like document generation, code refactoring, and codebase analysis.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - **NO** - This is a new node type that users explicitly add to flows
  - **Reasoning:**
    - Not platform-specific (Claude Code CLI is cross-platform)
    - Not experimental (well-tested CLI tool)
    - User-initiated (only runs when added to a flow and executed)
    - No large downloads (uses pre-installed CLI)
    - No kill-switch needed (node execution is synchronous and user-controlled)

## Success Criteria

- [x] Claude Code node appears in Flow Editor node palette
- [x] Node configuration UI allows prompt input and timeout setting
- [x] Node executes Claude Code CLI in headless mode with user's prompt
- [x] Node outputs both text summary and file paths for downstream nodes
- [x] Timeout is enforced (default 5 minutes, configurable up to 60 minutes)
- [x] Clear error messages when Claude Code CLI not installed or not authenticated
- [x] Flows with Claude Code node can be saved and reloaded
- [x] AbortSignal cancellation works (user can stop execution)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `ClaudeCodeNodeExecutor.ts` | Backend executor using subprocess pattern from whisperCpp.ts |
| Type updates | Add `claude-code` to FlowNode type union |
| FlowExecutor integration | Register Claude Code executor in executeNode() switch |
| `ClaudeCodeNode.tsx` | React component for node rendering in Flow Editor |
| Node configuration panel | UI for editing prompt, timeout, and viewing output |
| Webview store updates | Add ClaudeCodeNodeData type and node creation logic |
| Error handling | Clear messages for missing CLI, auth failures, timeouts |

## Implementation Checklist

### Phase 1: Backend - Node Executor

- [ ] Create `extensions/ritemark/src/flows/nodes/ClaudeCodeNodeExecutor.ts`
  - [ ] Import child_process, path, fs
  - [ ] Define `ClaudeCodeNodeData` interface (prompt, timeout)
  - [ ] Define `ClaudeCodeResult` interface (text, files, error)
  - [ ] Implement `findClaudeCodeBinary()` - check common paths
  - [ ] Implement `checkClaudeCodeAuth()` - verify ~/.claude/ exists
  - [ ] Implement `executeClaudeCodeNode()` function:
    - [ ] Validate node data (prompt required)
    - [ ] Interpolate variables in prompt using existing pattern
    - [ ] Check Claude Code binary exists
    - [ ] Spawn subprocess with args: `-p`, prompt, `--output-format json`
    - [ ] Set cwd to workspacePath
    - [ ] Collect stdout/stderr
    - [ ] Implement timeout (configurable, default 5 min)
    - [ ] Parse JSON output on success
    - [ ] Return `{ text, files }` for downstream nodes
    - [ ] Handle errors: binary not found, auth failure, timeout, JSON parse error

### Phase 2: Backend - Integration

- [ ] Update `extensions/ritemark/src/flows/types.ts`
  - [ ] Add `'claude-code'` to FlowNode type union
- [ ] Update `extensions/ritemark/src/flows/FlowExecutor.ts`
  - [ ] Import `executeClaudeCodeNode`
  - [ ] Add case `'claude-code'` to executeNode() switch

### Phase 3: Webview - UI Components

- [ ] Update `webview/src/components/flows/stores/flowEditorStore.ts`
  - [ ] Add `ClaudeCodeNodeData` interface
  - [ ] Add `'claude-code': 'claudeCodeNode'` to type mapping
  - [ ] Add Claude Code node to default node types
  - [ ] Implement `addClaudeCodeNode()` helper
- [ ] Create `webview/src/components/flows/nodes/ClaudeCodeNode.tsx`
  - [ ] Import React Flow Handle components
  - [ ] Render node with label, icon, input/output handles
  - [ ] Show prompt preview (first 50 chars)
  - [ ] Show timeout setting
  - [ ] Show output summary when executed
- [ ] Create `webview/src/components/flows/panels/ClaudeCodeNodePanel.tsx`
  - [ ] Textarea for prompt (with {Label} syntax help text)
  - [ ] Number input for timeout (1-60 minutes)
  - [ ] Hint about variable interpolation
  - [ ] Display output text and file list after execution
- [ ] Update `webview/src/components/flows/FlowCanvas.tsx`
  - [ ] Register claudeCodeNode in nodeTypes
- [ ] Update `webview/src/components/flows/NodePalette.tsx`
  - [ ] Add Claude Code node to palette
  - [ ] Use icon (code + sparkles or robot)
  - [ ] Description: "Run autonomous coding tasks with Claude Code"

### Phase 4: Error Handling & UX

- [ ] Implement binary detection
  - [ ] Check `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`, `~/.npm/bin/claude`
  - [ ] If not found, show error: "Claude Code CLI not installed. Install from [link]"
- [ ] Implement auth check
  - [ ] Check if `~/.claude/` directory exists
  - [ ] If not, show error: "Claude Code not authenticated. Run `claude` in terminal first."
- [ ] Implement timeout handling
  - [ ] Show timeout value in node UI
  - [ ] On timeout, show error: "Claude Code execution timed out after X minutes"
  - [ ] Include partial output if available
- [ ] Implement cancellation
  - [ ] Respect AbortSignal in executor
  - [ ] Kill subprocess on abort
  - [ ] Show "Cancelled by user" message

### Phase 5: Testing

- [ ] Manual testing checklist:
  - [ ] Create new flow with Trigger → Claude Code → Save File
  - [ ] Configure Claude Code with simple prompt: "Create a markdown file with project README"
  - [ ] Execute flow with timeout = 2 minutes
  - [ ] Verify: Output text appears in node, files list populated
  - [ ] Verify: Save File node can reference created files
  - [ ] Test cancellation: Start flow, click cancel, verify subprocess killed
  - [ ] Test timeout: Set timeout to 1 second, verify timeout error
  - [ ] Test missing binary: Rename claude binary, verify error message
  - [ ] Test variable interpolation: Use {InputLabel} in prompt
  - [ ] Test save/reload: Save flow, reload, verify node data preserved

### Phase 6: Documentation

- [ ] Update `docs/analysis/2026-02-03-claude-code-node-flows.md` with "Implemented" status
- [ ] Add example flow in `docs/sprints/sprint-01-claude-code-node/notes/example-flow.md`
- [ ] Document node configuration options in sprint notes

## Status

**Current Phase:** 1 (RESEARCH)
**Approval Required:** Yes (Phase 2→3 gate)

## Approval

- [ ] Jarmo reviewed this sprint plan
- [ ] Jarmo approved proceeding to Phase 3 (implementation)

---

## Notes

### CLI Command Pattern

```bash
claude -p "Create a README.md file for a markdown editor app" --output-format json
```

### Expected JSON Output

```json
{
  "result": "Created README.md with project overview, features, and installation instructions",
  "files_modified": [],
  "files_created": ["README.md"],
  "conversation_id": "abc123"
}
```

### Node Output Format

For downstream nodes:
- **Text output:** `result` field (summary of what was done)
- **Files array:** `files_modified + files_created` combined
- **Variable interpolation:** `{ClaudeCode}` resolves to text output

### Subprocess Timeout Calculation

- User sets timeout in **minutes** (1-60)
- Convert to milliseconds: `timeout * 60 * 1000`
- Default: 5 minutes = 300000ms

### Error Message Templates

| Error | Message |
|-------|---------|
| Binary not found | `Claude Code CLI not found. Install it from https://github.com/anthropics/claude-code` |
| Auth failure | `Claude Code not authenticated. Run 'claude' in your terminal to set up.` |
| Timeout | `Claude Code execution timed out after {X} minutes. Try increasing the timeout or simplifying the task.` |
| JSON parse error | `Failed to parse Claude Code output. Raw output: {stdout}` |
| Cancelled | `Execution cancelled by user.` |

---

## References

- **Analysis doc:** `/home/user/ritemark-native/docs/analysis/2026-02-03-claude-code-node-flows.md`
- **Architecture findings:** `docs/sprints/sprint-01-claude-code-node/research/architecture-findings.md`
- **Flow types:** `extensions/ritemark/src/flows/types.ts`
- **Flow executor:** `extensions/ritemark/src/flows/FlowExecutor.ts`
- **LLM node pattern:** `extensions/ritemark/src/flows/nodes/LLMNodeExecutor.ts`
- **Subprocess pattern:** `extensions/ritemark/src/voiceDictation/whisperCpp.ts`
- **Webview store:** `extensions/ritemark/webview/src/components/flows/stores/flowEditorStore.ts`
