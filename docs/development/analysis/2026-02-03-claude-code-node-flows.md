# Claude Code Node for Ritemark Flows

**Date:** 2026-02-03
**Status:** Research & Planning
**Author:** Claude (Engineering)

---

## Executive Summary

This analysis explores adding a **Claude Code node** to Ritemark Flows - a node that executes Claude Code tasks and outputs results to downstream nodes. Unlike the existing LLM node (single API call, text generation), a Claude Code node would provide **workspace-aware, multi-step autonomous code execution**.

---

## 1. Current Flows Architecture

### Node Execution Model

```
Trigger → LLM/Image → Save File
    ↓
  inputs    →    context.outputs.set(nodeId, result)    →    downstream reads
```

**Key patterns already established:**
- **Topological execution** - Kahn's algorithm determines order
- **Context passing** - `ExecutionContext` with inputs, outputs, workspacePath
- **Variable interpolation** - `{Label}` syntax resolves to inputs or upstream outputs
- **File reading** - LLM node auto-reads text file paths referenced in prompts
- **AbortSignal** - Cancellation support throughout pipeline

### Current Node Types

| Node | Input | Output | Duration |
|------|-------|--------|----------|
| Trigger | User inputs | `Record<string, unknown>` | Instant |
| LLM | Prompt + context | `string` (text) | 5-30s |
| Image | Prompt | `{ url, localPath, revisedPrompt }` | 10-60s |
| Save File | Source node ID | `{ path, size }` | Instant |

### Subprocess Pattern (from whisperCpp.ts)

The codebase already has a robust pattern for CLI execution:
```typescript
const proc = child_process.spawn(binaryPath, args, {
  env: { ...process.env, DYLD_LIBRARY_PATH: binaryDir }
});

proc.stdout?.on('data', (data) => { /* capture */ });
proc.stderr?.on('data', (data) => { /* capture */ });
proc.on('exit', (code) => { /* handle result */ });

setTimeout(() => { proc.kill(); }, 30000); // Timeout
```

---

## 2. Claude Code Capabilities

### CLI Modes

| Mode | Command | Use Case |
|------|---------|----------|
| Interactive | `claude` | Human conversation |
| **Headless** | `claude -p "prompt" --output-format json` | **Automation** |
| Resume | `claude -c` | Continue session |

### Key Differentiators vs LLM Node

| Aspect | LLM Node | Claude Code Node |
|--------|----------|------------------|
| Context | Prompt text only | **Full workspace awareness** |
| Capability | Text generation | **Code tasks + file ops + bash** |
| Execution | Single API call | **Multi-step autonomous agent** |
| Duration | 5-30 seconds | **Minutes to hours** |
| Output | Text response | **Structured JSON + file changes** |

### Claude Agent SDK

Available as `@anthropic-ai/claude-agent-sdk` (NPM) with:
- Same tools as Claude Code CLI
- Programmatic session management
- Subagent support
- Memory persistence

---

## 3. Implementation Options

### Option A: CLI Subprocess (Recommended)

Execute Claude Code in headless mode:
```typescript
const proc = spawn('claude', [
  '-p', prompt,
  '--output-format', 'json',
  '--dangerously-skip-permissions'  // For automation
], { cwd: workspacePath });
```

**Pros:**
- Uses official CLI with full capabilities
- Leverages existing auth (`~/.claude/`)
- JSON output is parseable
- No additional dependencies

**Cons:**
- Requires Claude Code installed
- Long-running (needs extended timeout)
- No streaming progress to UI

### Option B: Agent SDK Integration

Use `@anthropic-ai/claude-agent-sdk` directly:
```typescript
import { ClaudeSDKClient } from '@anthropic-ai/claude-agent-sdk';

const client = new ClaudeSDKClient();
const result = await client.query(prompt, {
  workspacePath,
  tools: ['file_read', 'file_write', 'bash'],
  abortSignal
});
```

**Pros:**
- Tighter integration
- Streaming progress possible
- More control over tools/permissions

**Cons:**
- Additional dependency
- May need separate API key management
- SDK maturity unknown

### Option C: VS Code Terminal (Not Recommended)

Create terminal and capture output via terminal buffer.

**Cons:**
- Hard to capture structured output
- User sees raw terminal (UX issue)
- No programmatic control

---

## 4. Creative Use Cases

### 4.1 Code Generation Pipeline

```
Trigger (spec.md) → Claude Code (implement) → Save File (src/*.ts)
```

User provides a spec file, Claude Code generates implementation across multiple files.

### 4.2 Codebase Q&A Flow

```
Trigger (question) → Claude Code (analyze codebase) → LLM (format answer)
```

Leverage Claude Code's codebase understanding for complex questions, then format with LLM.

### 4.3 Automated Refactoring

```
Trigger (refactoring instructions) → Claude Code (refactor) → LLM (generate PR description)
```

Claude Code does the heavy lifting, LLM summarizes changes for PR.

### 4.4 Documentation Generator

```
Trigger (file paths) → Claude Code (analyze & document) → Save File (docs/*.md)
```

Point at code files, get documentation generated with full context.

### 4.5 Test Generation Pipeline

```
Trigger (source file) → Claude Code (analyze & generate tests) → Save File (*.test.ts)
```

Understands implementation details, generates meaningful tests.

### 4.6 Multi-Agent Collaboration

```
Trigger → LLM (plan) → Claude Code (execute plan) → LLM (review) → Save File
```

LLM plans, Claude Code executes, LLM reviews - best of both worlds.

### 4.7 Issue-to-PR Workflow

```
Trigger (GitHub issue URL) → Claude Code (implement fix) → Save File (changed files)
```

Connected to GitHub, automatically implements issue fixes.

---

## 5. UX Considerations

### Progress Indication

Industry best practice (from research):
- **Real-time streaming** of agent reasoning
- **Step-by-step visualization** showing current action
- **Collapsible reasoning** for debugging

**Proposed for Ritemark:**
```
┌─────────────────────────────────────┐
│ Claude Code                      ⏳ │
│ ├─ Reading src/flows/types.ts   ✓  │
│ ├─ Analyzing architecture       ✓  │
│ └─ Writing implementation       ⟳  │
│                                     │
│ [Cancel]                            │
└─────────────────────────────────────┘
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| Prompt | textarea | Task description |
| System Prompt | textarea | Role/constraints |
| Allowed Tools | multi-select | file_read, file_write, bash, etc. |
| Timeout | number | Max execution time (minutes) |
| Output Format | select | text, json, files |

### Human-in-the-Loop

Critical pattern from industry: **Don't let agents continue until earlier steps verified.**

Options:
1. **Auto-continue** - Full automation, no stops
2. **Pause after Claude Code** - Human reviews before downstream
3. **Approval required** - Node waits for explicit approval

---

## 6. Technical Considerations

### Timeout Handling

Current LLM node: 90 seconds
Claude Code typical: 1-10 minutes
Complex tasks: 30+ minutes

**Recommendation:** Configurable timeout per node (default: 5 minutes, max: 60 minutes)

### Output Structure

Claude Code JSON output:
```json
{
  "result": "Task completed successfully",
  "files_modified": ["src/foo.ts", "src/bar.ts"],
  "files_created": ["src/new.ts"],
  "conversation_id": "abc123"
}
```

**Flow output should include:**
- `text` - Summary/result text
- `files` - Array of modified/created file paths
- `sessionId` - For potential resume capability

### Authentication

Options:
1. **Inherit from CLI** - Use `~/.claude/` credentials (simplest)
2. **Separate API key** - Store in VS Code secrets
3. **Reuse Anthropic key** - If compatible with Agent SDK

### Sandboxing

Claude Code has its own permission model. For Flow automation:
- `--dangerously-skip-permissions` for full automation
- Or pre-approve specific tools in node config

---

## 7. Node Data Interface (Draft)

```typescript
export interface ClaudeCodeNodeData extends Record<string, unknown> {
  label: string;
  prompt: string;
  systemPrompt?: string;
  allowedTools: ('file_read' | 'file_write' | 'bash' | 'web_search')[];
  timeout: number;  // Minutes
  outputFormat: 'text' | 'json' | 'files';
  workspaceScope: 'full' | 'folder' | 'files';
  scopePath?: string;  // If folder/files scope
  pauseAfter: boolean;  // Human-in-the-loop
}

export interface ClaudeCodeResult {
  text: string;
  files?: string[];
  sessionId?: string;
  error?: string;
}
```

---

## 8. Implementation Phases

### Phase 1: MVP
- Basic prompt execution with JSON output
- Fixed timeout (5 minutes)
- Text output to downstream nodes
- CLI subprocess approach

### Phase 2: Enhanced
- Configurable timeout
- Tool restrictions
- Progress streaming
- File output tracking

### Phase 3: Advanced
- Session resume capability
- Human-in-the-loop pause
- Multi-turn within flow
- Agent SDK integration

---

## 9. Open Questions for Product Owner

### Use Cases & Priority

1. **What's the #1 workflow you envision?**
   - Code generation from specs?
   - Automated refactoring?
   - Documentation generation?
   - Test generation?
   - Something else?

2. **Who is the target user?**
   - Power users comfortable with CLI tools?
   - Non-technical users needing simple automation?
   - Teams wanting standardized workflows?

3. **Should Claude Code node modify files directly?**
   - Direct modification = more power, less control
   - Output paths only = safer, fits existing flow pattern

### Technical Scope

4. **Should Claude Code CLI be a prerequisite?**
   - Require pre-installation (simpler for us)
   - Bundle/manage it (better UX, more complexity)

5. **What timeout is acceptable?**
   - Quick tasks only (5 min max)?
   - Long-running allowed (30+ min)?
   - User-configurable per node?

6. **How should auth work?**
   - Inherit from CLI (~/.claude/)
   - New API key in settings
   - Reuse Anthropic key

### UX & Integration

7. **How important is progress visibility?**
   - Simple "running..." indicator
   - Step-by-step progress
   - Full streaming output

8. **Should this be behind a feature flag?**
   - Yes - gradual rollout, testing
   - No - ship to all users

9. **Integration with existing tools?**
   - GitHub issues/PRs?
   - Project management (Linear)?
   - CI/CD pipelines?

10. **What happens when Claude Code fails mid-task?**
    - Fail the flow entirely
    - Return partial results
    - Allow retry/resume

---

## 10. Competitive Analysis

| Tool | Agent Integration | Progress UI | Checkpoints |
|------|-------------------|-------------|-------------|
| n8n | Node-based agents | Step indicators | Manual |
| Langflow | ReAct loops | Reasoning visible | None |
| Flowise | Multi-agent flows | Basic progress | None |
| Cursor | Multi-agent parallel | Streaming | Auto-save |
| **Ritemark (proposed)** | Claude Code node | Step-by-step | Optional pause |

---

## Recommendation

**Start with Option A (CLI subprocess)** for MVP:
1. Lowest complexity
2. Uses existing auth
3. JSON output is structured
4. Can evolve to Agent SDK later

**Key MVP features:**
- Prompt + system prompt configuration
- Configurable timeout (1-30 minutes)
- JSON output parsed to text + file list
- AbortSignal for cancellation
- Basic progress indicator ("Claude Code is working...")

This delivers value quickly while leaving room for enhancement based on user feedback.
