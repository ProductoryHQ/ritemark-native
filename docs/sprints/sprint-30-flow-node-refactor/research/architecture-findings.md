# Architecture Findings - Claude Code Node

**Sprint:** 01 - Claude Code Node for Flows
**Date:** 2026-02-03
**Phase:** Research

---

## Current Flow Architecture

### Node Execution Model

Flows use **topological execution** with Kahn's algorithm:
1. `FlowExecutor.ts` determines execution order based on edges
2. Each node gets `ExecutionContext` with:
   - `inputs` - User-provided inputs from trigger
   - `outputs` - Map of nodeId → output value
   - `workspacePath` - Current workspace root
   - `inputLabels` - Map of input label → value
   - `nodeLabels` - Map of node label → nodeId
3. Node executors return values that are stored in `context.outputs.set(nodeId, result)`
4. Downstream nodes access upstream outputs via variable interpolation

### Variable Interpolation Pattern

From `LLMNodeExecutor.ts`:
- **New syntax:** `{Label}` - resolves to input label or node label
- **Legacy syntax:** `{{inputs.key}}` or `{{nodeId}}` - resolves by ID
- **File reading:** If a value looks like a text file path, auto-reads contents
- Uses `interpolateVariables()` function (async, supports parallel file reads)

### Existing Node Types

| Type | Executor | Input | Output | Duration |
|------|----------|-------|--------|----------|
| `trigger` | Built-in | User inputs | `Record<string, unknown>` | Instant |
| `llm-prompt` | `LLMNodeExecutor.ts` | Prompt + context | `string` | 5-30s |
| `image-prompt` | `ImageNodeExecutor.ts` | Prompt | `{ url, localPath, revisedPrompt }` | 10-60s |
| `save-file` | `SaveFileNodeExecutor.ts` | Source node ID | `{ path, size }` | Instant |

### Subprocess Pattern (from whisperCpp.ts)

```typescript
const proc = child_process.spawn(binaryPath, args, {
  env: { ...process.env, DYLD_LIBRARY_PATH: binaryDir }
});

let stdout = '';
let stderr = '';

proc.stdout?.on('data', (data: Buffer) => {
  stdout += data.toString('utf-8');
});

proc.stderr?.on('data', (data: Buffer) => {
  stderr += data.toString('utf-8');
});

proc.on('error', (error: Error) => {
  // Handle error
});

proc.on('exit', (code: number | null) => {
  if (code === 0) {
    // Success - parse stdout
  } else {
    // Failure - report stderr
  }
});

// Timeout handling
setTimeout(() => {
  proc.kill();
  resolve({ error: 'Timeout' });
}, timeoutMs);
```

**Key patterns:**
- Collect stdout/stderr in buffers
- Use `spawn()` not `exec()` for long-running processes
- Set environment variables for binaries (e.g., DYLD_LIBRARY_PATH)
- Implement timeout with kill()
- Parse output in 'exit' event

---

## Claude Code CLI

### Headless Mode

```bash
claude -p "prompt" --output-format json
```

**Output format (expected):**
```json
{
  "result": "Task completed successfully",
  "files_modified": ["src/foo.ts", "src/bar.ts"],
  "files_created": ["src/new.ts"],
  "conversation_id": "abc123"
}
```

### Key Differences vs LLM Node

| Aspect | LLM Node | Claude Code Node |
|--------|----------|------------------|
| Context | Prompt text only | Full workspace awareness |
| Capability | Text generation | Code tasks + file ops + bash |
| Execution | Single API call | Multi-step autonomous agent |
| Duration | 5-30 seconds | **Minutes to hours** |
| Output | Text response | Structured JSON + file changes |

### Authentication

Claude Code CLI uses `~/.claude/` for:
- API key storage
- Session management
- Auth tokens

**Decision:** Inherit from CLI (no separate API key needed)

---

## Product Owner Decisions

From Jarmo:

1. **Killer use case:** Office automation flows - creating documents (offers, PRDs, etc.)
2. **File modification:** Direct modification allowed (not output-only)
3. **CLI prerequisite:** Claude Code CLI must be pre-installed
4. **Technical approach:** Option A - CLI subprocess
5. **Timeout:** Configurable (default 5 minutes)
6. **Cancellation:** Use AbortSignal pattern

---

## Implementation Patterns

### Node Registration

In `FlowExecutor.ts`, add to `executeNode()` switch:

```typescript
case 'claude-code':
  return await executeClaudeCodeNode(node, context);
```

### Node Data Type

In `types.ts`:

```typescript
export interface FlowNode {
  id: string;
  type: 'trigger' | 'llm-prompt' | 'image-prompt' | 'save-file' | 'claude-code';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}
```

### Webview Integration

In `flowEditorStore.ts`:

```typescript
export interface ClaudeCodeNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  timeout: number; // Minutes
}

const flowTypeToReactFlowType = {
  // ...existing
  'claude-code': 'claudeCodeNode',
};
```

---

## File Modification Strategy

**Decision:** Direct modification (not output-only)

Claude Code will:
1. Execute task with file write permissions
2. Modify files directly in workspace
3. Return list of modified/created files in output
4. Output format: `{ text: string, files: string[] }`

Downstream nodes can:
- Access summary text via `{ClaudeCode}` syntax
- Read modified files if paths are known
- Use file paths for further processing

---

## Key Risks

1. **Long execution time** - Users expect instant feedback, but Claude Code can take 5+ minutes
   - Mitigation: Clear timeout configuration, progress indication
2. **Binary dependency** - Requires Claude Code CLI installed
   - Mitigation: Clear error message with installation instructions
3. **File system safety** - Claude Code has file write access
   - Mitigation: Runs in workspace context only, user-initiated
4. **Authentication** - Inherits from ~/.claude/
   - Mitigation: Check auth before execution, clear error if not configured
5. **Output parsing** - JSON output may vary
   - Mitigation: Defensive parsing with fallbacks

---

## References

- Analysis doc: `/home/user/ritemark-native/docs/analysis/2026-02-03-claude-code-node-flows.md`
- Flow types: `/home/user/ritemark-native/extensions/ritemark/src/flows/types.ts`
- Flow executor: `/home/user/ritemark-native/extensions/ritemark/src/flows/FlowExecutor.ts`
- LLM pattern: `/home/user/ritemark-native/extensions/ritemark/src/flows/nodes/LLMNodeExecutor.ts`
- Subprocess pattern: `/home/user/ritemark-native/extensions/ritemark/src/voiceDictation/whisperCpp.ts`
- Webview store: `/home/user/ritemark-native/extensions/ritemark/webview/src/components/flows/stores/flowEditorStore.ts`
