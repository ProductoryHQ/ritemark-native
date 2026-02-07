# AgentRunner Extraction Strategy

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07

## Goal

Extract the Claude Agent SDK integration from `ClaudeCodeNodeExecutor.ts` into a reusable service that can be called from:
- Unified AI View (sidebar chat)
- Flows (existing)
- Future: Command palette, context menus, etc.

## Current Structure

```
extensions/ritemark/src/flows/nodes/ClaudeCodeNodeExecutor.ts
├── getQuery() - Dynamic SDK import
├── executeClaudeCodeNode() - Flow-specific execution
├── interpolateVariables() - Template variable replacement
└── Event handling (system, assistant, result)
```

**Problem:** Tightly coupled to Flow node execution context.

## Target Structure

```
extensions/ritemark/src/agent/
├── AgentRunner.ts          # Core agent execution service
├── types.ts                # Shared types
├── tools.ts                # Tool definitions
└── permissions.ts          # Folder permission logic

extensions/ritemark/src/flows/nodes/
└── ClaudeCodeNodeExecutor.ts  # Now uses AgentRunner

extensions/ritemark/src/views/
└── UnifiedViewProvider.ts     # Now uses AgentRunner
```

## AgentRunner API Design

### Interface

```typescript
export interface AgentRunnerOptions {
  prompt: string;
  workspacePath: string;
  permissionMode: 'ask' | 'allow' | 'deny';
  allowedFolders?: string[];  // For 'allow' mode
  allowedTools?: string[];    // Subset of all available tools
  timeout?: number;           // In milliseconds
  abortSignal?: AbortSignal;
  onProgress?: ProgressCallback;
}

export interface AgentRunnerResult {
  success: boolean;
  text: string;
  filesModified: string[];
  duration: number;
  cost: number;
  error?: string;
}

export type ProgressCallback = (event: AgentProgressEvent) => void;

export interface AgentProgressEvent {
  type: 'init' | 'tool_use' | 'thinking' | 'text' | 'done' | 'error';
  message: string;
  tool?: string;
  file?: string;
  timestamp?: number;
}
```

### Usage

```typescript
import { AgentRunner } from '../agent/AgentRunner';

const runner = new AgentRunner();

const result = await runner.execute({
  prompt: 'Reorganize my research notes',
  workspacePath: '/Users/jarmo/Documents',
  permissionMode: 'allow',
  allowedFolders: ['/Users/jarmo/Documents/research'],
  allowedTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
  timeout: 5 * 60 * 1000, // 5 minutes
  onProgress: (event) => {
    console.log(event.type, event.message);
  }
});

console.log('Modified files:', result.filesModified);
```

## Extraction Steps

### Step 1: Create Core AgentRunner Class

Move reusable logic:
- Dynamic SDK import (`getQuery`)
- Event stream parsing
- File modification tracking
- Cost/duration tracking

Keep Flow-specific logic in `ClaudeCodeNodeExecutor`:
- Variable interpolation
- Flow node context
- Output value mapping

### Step 2: Define Shared Types

Extract to `agent/types.ts`:
- `AgentProgressEvent`
- `AgentRunnerOptions`
- `AgentRunnerResult`

### Step 3: Implement Permission System

Create `agent/permissions.ts`:
- Folder validation
- Path normalization
- Permission checking middleware for tools

### Step 4: Refactor ClaudeCodeNodeExecutor

Replace inline SDK calls with AgentRunner:
```typescript
export async function executeClaudeCodeNode(
  node: FlowNode,
  context: ExecutionContext,
  abortSignal?: AbortSignal,
  onProgress?: ProgressCallback
): Promise<ClaudeCodeResult> {
  const data = node.data as ClaudeCodeNodeData;
  const interpolatedPrompt = interpolateVariables(data.prompt, context);

  const runner = new AgentRunner();
  const result = await runner.execute({
    prompt: interpolatedPrompt,
    workspacePath: context.workspacePath,
    permissionMode: 'allow', // Flows are autonomous
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    timeout: data.timeout * 60 * 1000,
    abortSignal,
    onProgress
  });

  return {
    text: result.text,
    files: result.filesModified,
    error: result.error
  };
}
```

### Step 5: Integrate into UnifiedViewProvider

Add agent mode handler:
```typescript
case 'ai-execute-agent':
  await this._handleAgentExecution(
    message.prompt,
    message.mode, // 'ask' | 'allow' | 'deny'
    message.allowedFolders
  );
  break;

private async _handleAgentExecution(
  prompt: string,
  mode: 'ask' | 'allow' | 'deny',
  allowedFolders?: string[]
) {
  const runner = new AgentRunner();
  const result = await runner.execute({
    prompt,
    workspacePath: this._workspacePath,
    permissionMode: mode,
    allowedFolders,
    onProgress: (event) => {
      this._view?.webview.postMessage({
        type: 'agent-progress',
        event
      });
    }
  });

  this._view?.webview.postMessage({
    type: 'agent-result',
    result
  });
}
```

## Validation Criteria

- [ ] AgentRunner works standalone (no Flow dependencies)
- [ ] ClaudeCodeNodeExecutor still works (no regression)
- [ ] UnifiedViewProvider can call AgentRunner
- [ ] Progress events stream correctly
- [ ] File modification tracking works
- [ ] Cost/duration tracking works
- [ ] Abort signal works
- [ ] Permission system enforces folder restrictions

## Edge Cases

1. **No workspace open:** AgentRunner should error gracefully
2. **Invalid folder paths:** Permission system validates before execution
3. **SDK import fails:** Provide clear error message
4. **API key missing:** Check before execution, not during
5. **Timeout during tool execution:** SDK handles this, AgentRunner propagates

## Testing Strategy

1. **Unit tests for AgentRunner:**
   - Mock SDK calls
   - Test event stream parsing
   - Test file tracking
   - Test permission validation

2. **Integration tests:**
   - Execute from Flows (regression)
   - Execute from sidebar (new)
   - Test abort handling
   - Test timeout handling

3. **Manual testing:**
   - Real Claude API calls
   - File modifications in workspace
   - Permission boundary enforcement
