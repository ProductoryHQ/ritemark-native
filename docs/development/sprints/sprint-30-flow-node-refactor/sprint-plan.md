# Sprint 30: Claude Code Node & Flow Architecture

## Goal

Make Claude Code node fully functional and improve flow node architecture for better usability.

## Status

**Status:** Completed
**Date:** 2026-02-03

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - **NO** - Bug fixes and UX improvements, no experimental features
  - **Reasoning:**
    - Claude Code was already in UI, just didn't work
    - Category rename is pure UX
    - Progress feedback is always good to have

---

## Summary of Work Done

### 1. Claude Code Node - Fixed & Working

**Problem:** Claude Code node was added to UI but execution didn't work. CLI subprocess approach failed silently.

**Solution:** Migrated from CLI subprocess to official Agent SDK (`@anthropic-ai/claude-agent-sdk`).

**Key Technical Challenges Solved:**
- ES Module import in CommonJS environment (VS Code extensions use CommonJS)
- Used `new Function('specifier', 'return import(specifier)')` workaround to bypass TypeScript's `import()` → `require()` transformation
- SDK uses existing Claude Code authentication automatically

**Files Modified:**
| File | Change |
|------|--------|
| `src/flows/nodes/ClaudeCodeNodeExecutor.ts` | Complete rewrite using Agent SDK |
| `src/flows/FlowEditorProvider.ts` | Added claude-code case to executeNode |
| `src/flows/FlowTestRunner.ts` | Added claude-code case |
| `package.json` | Added `@anthropic-ai/claude-agent-sdk` dependency |

### 2. Visual Progress Feedback

**Problem:** Claude Code node ran silently with no feedback during execution.

**Solution:** Added real-time progress messages showing what Claude is doing.

**Progress Types:**
- `init` - Starting Claude Code (shows model)
- `tool_use` - Using Read, Write, Edit, Bash, etc.
- `thinking` - Claude's reasoning snippets
- `done` - Completion with duration

**Files Modified:**
| File | Change |
|------|--------|
| `src/flows/nodes/ClaudeCodeNodeExecutor.ts` | Added `onProgress` callback |
| `src/flows/FlowEditorProvider.ts` | Pass webview for progress messages |
| `src/flows/types.ts` | Added `ClaudeCodeProgress` type |
| `webview/src/components/flows/ExecutionPanel.tsx` | Display progress UI |

### 3. Save File Node Architecture

**Problem:** Save File in "Output" category implied it was terminal. Users didn't know they could chain after it.

**Solution:**
- Renamed category "Output" → "Actions"
- Updated description to clarify it outputs a path
- Enabled output handle (`showSourceHandle={true}`)

**Files Modified:**
| File | Change |
|------|--------|
| `webview/src/components/flows/NodePalette.tsx` | Category rename, description update |
| `webview/src/components/flows/nodes/SaveFileNode.tsx` | Enabled output handle |
| `webview/src/components/flows/NodeConfigPanel.tsx` | Added file path tip for Claude Code |

### 4. Flow Validation Fix

**Problem:** Flow with only Trigger → Claude Code showed "Flow needs at least one AI or Output node".

**Solution:** Added `claude-code` to processing node validation check.

**Files Modified:**
| File | Change |
|------|--------|
| `webview/src/components/flows/ExecutionPanel.tsx` | Added claude-code to hasProcessingNode |

### 5. Test Infrastructure

**Created:**
- `src/flows/FlowIntegration.test.ts` - Tests all flows in `.ritemark/flows/`
- `src/flows/nodes/ClaudeCodeNodeExecutor.test.ts` - Unit tests for interpolation
- `src/flows/flowTypes.test.ts` - Type mapping tests
- `src/flows/FlowExecutor.test.ts` - Executor routing tests

**Test Coverage:**
- 48 integration tests (6 per flow × 8 flows)
- Flow loading and validation
- Execution order (topological sort)
- Variable interpolation
- Node chaining

### 6. Test Flows Created

Created sample flows in `.ritemark/flows/`:
| Flow | Nodes | Purpose |
|------|-------|---------|
| `simple-blog-post.flow.json` | Trigger → LLM → Save | Basic LLM flow |
| `image-generator.flow.json` | Trigger → Image → Save | Image generation |
| `claude-code-task.flow.json` | Trigger → Claude Code | Autonomous coding |
| `research-and-implement.flow.json` | Trigger → LLM → Claude Code | LLM plans, Claude implements |
| `translate-chain.flow.json` | Trigger → LLM → LLM → LLM → Save | Translation chain |
| `summarize-file.flow.json` | Trigger → Claude → LLM → Save | File reading & summary |

### 7. Documentation & Skills

**Created:**
- `.claude/skills/flow-testing/SKILL.md` - Complete flow testing guide

**Updated:**
- `.claude/agents/qa-validator.md` - Added flow tests as Check #7, references skill

---

## Technical Details

### Claude Code SDK Integration

```typescript
// Dynamic import for ES Module in CommonJS
const dynamicImport = new Function('specifier', 'return import(specifier)');
const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');

const result = sdk.query({
  prompt: interpolatedPrompt,
  options: {
    cwd: context.workspacePath,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    abortController,
  },
});

for await (const message of result) {
  // Handle progress, results, errors
}
```

### Variable Interpolation

Claude Code (and all nodes) support `{Label}` syntax:
- `{Input Label}` → resolves to flow input value
- `{Node Label}` → resolves to that node's output
- Works recursively through flow

### Output Format

Claude Code returns:
```json
{
  "text": "Summary of what was done",
  "files": ["/path/to/created/file.ts", "/path/to/edited/file.ts"]
}
```

---

## Verification Checklist

- [x] Claude Code node executes successfully
- [x] Progress feedback shows during execution
- [x] "Actions" category visible in Node Palette
- [x] Save File has output handle
- [x] Can chain Save File → Claude Code
- [x] Variable interpolation works
- [x] All 48 integration tests pass
- [x] Flow testing skill created
- [x] QA agent updated

---

## Commands

```bash
# Run all tests
cd extensions/ritemark && npm test

# Run only flow integration tests
cd extensions/ritemark && npx tsx src/flows/FlowIntegration.test.ts

# Rebuild webview
cd extensions/ritemark/webview && npm run build

# Compile extension
cd extensions/ritemark && npm run compile
```

---

## References

- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` v0.2.29
- **Flow testing skill:** `.claude/skills/flow-testing/SKILL.md`
- **QA validator:** `.claude/agents/qa-validator.md`
- **Test flows:** `.ritemark/flows/`
