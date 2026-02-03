# Flow Testing Skill

Testing procedures for Ritemark Flows - visual AI workflows.

---

## Quick Reference

```bash
# Run all unit/mock tests (fast, free)
cd extensions/ritemark && npm test

# Run only flow integration tests (mock)
cd extensions/ritemark && npx tsx src/flows/FlowIntegration.test.ts

# Run executor integration tests (real file I/O, free)
cd extensions/ritemark && npm run test:integration:free

# Run ALL integration tests (includes real API calls, costs money)
cd extensions/ritemark && npm run test:integration

# Run everything
cd extensions/ritemark && npm run test:all
```

---

## Test Files Overview

| Test File | Purpose | Cost |
|-----------|---------|------|
| `src/flows/flowTypes.test.ts` | Node type mappings between backend and React Flow | Free |
| `src/flows/FlowExecutor.test.ts` | Executor routing to correct node handlers | Free |
| `src/flows/nodes/ClaudeCodeNodeExecutor.test.ts` | Variable interpolation, Claude Code node | Free |
| `src/flows/FlowIntegration.test.ts` | Full flow validation against real `.flow.json` files | Free |
| `src/flows/nodes/SaveFileNodeExecutor.integration.test.ts` | Real file I/O operations | Free |
| `src/flows/nodes/LLMNodeExecutor.integration.test.ts` | Real OpenAI/Gemini API calls | ~$0.02 |
| `src/flows/nodes/ClaudeCodeNodeExecutor.integration.test.ts` | Real Claude Code SDK calls | ~$0.10 |

---

## What Each Test Validates

### 1. Flow Types (`flowTypes.test.ts`)
- Backend types have React Flow mappings
- React Flow types have backend mappings
- Mappings are symmetric (roundtrip works)
- Claude Code mappings: `claude-code` ↔ `claudeCodeNode`
- Save File mappings: `save-file` ↔ `saveFileNode`

### 2. Flow Executor (`FlowExecutor.test.ts`)
- `trigger` → `handleTrigger`
- `llm-prompt` → `executeLLMNode`
- `image-prompt` → `executeImageNode`
- `save-file` → `executeSaveFileNode`
- `claude-code` → `executeClaudeCodeNode`

### 3. Claude Code Node (`ClaudeCodeNodeExecutor.test.ts`)
- Variable interpolation with `{Label}` syntax
- Input labels resolution
- Node labels resolution
- Empty string handling
- Legacy `{{syntax}}` support

### 4. Flow Integration (`FlowIntegration.test.ts`)
Tests run against ALL `.flow.json` files in `.ritemark/flows/`:
- Flow loads without errors
- Flow passes validation (has trigger, processing nodes, valid edges)
- Execution order is deterministic (topological sort)
- Input variables interpolate correctly
- Mock execution completes without errors
- Node outputs available to downstream nodes

---

## Manual Testing Procedures

### Testing a New Flow

1. **Create the flow** in Flows panel or manually as `.flow.json`

2. **Run integration tests** to validate structure:
   ```bash
   cd extensions/ritemark && npx tsx src/flows/FlowIntegration.test.ts
   ```

3. **Test in UI**:
   - Open flow in Flow Editor
   - Click Run button
   - Fill required inputs
   - Verify each step completes
   - Check output values

### Testing Claude Code Node

1. **Create simple flow**: Trigger → Claude Code

2. **Set prompt** with variable: `Create a file about {Topic}`

3. **Run flow** and verify:
   - Progress messages appear (init, tool_use, done)
   - Files are created as expected
   - Output contains `{ text, files }` JSON

4. **Test chaining**: Trigger → Claude Code → Save File
   - Verify Save File receives Claude Code output

### Testing Variable Interpolation

1. **Input variables**: `{Input Label}` should resolve to input value
2. **Node labels**: `{Node Label}` should resolve to that node's output
3. **Chaining**: Downstream nodes see upstream outputs

---

## Adding New Node Types

When adding a new node type:

1. **Update `src/flows/types.ts`**:
   ```typescript
   type: 'trigger' | 'llm-prompt' | ... | 'new-type';
   ```

2. **Add executor** in `src/flows/nodes/NewTypeExecutor.ts`

3. **Update `FlowEditorProvider.ts`** executeNode switch

4. **Update `FlowTestRunner.ts`** if applicable

5. **Add to tests**:
   - `flowTypes.test.ts` - type mappings
   - `FlowExecutor.test.ts` - executor routing
   - `FlowIntegration.test.ts` - mock executor

6. **Update webview**:
   - `ExecutionPanel.tsx` - add icon, type to validation
   - `NodePalette.tsx` - add to palette
   - Create `nodes/NewTypeNode.tsx`

---

## Common Issues

### "Unknown node type: X"
- Check `FlowEditorProvider.ts` has case for type
- Check `FlowTestRunner.ts` has case for type
- Verify type mapping in webview

### Variable not interpolating
- Check label matches exactly (case-sensitive)
- Verify node has `data.label` set
- Check upstream node executed before downstream

### Claude Code hangs
- Check timeout setting (default 5 min)
- Verify SDK is installed: `@anthropic-ai/claude-agent-sdk`
- Check Claude authentication is valid

### Flow validation fails
- Must have trigger node
- Must have at least one processing node (LLM, Image, Claude Code, or Save)
- All edge sources/targets must exist

---

## Test Flow Files Location

Test flows are stored in: `.ritemark/flows/`

Current test flows:
- `simple-blog-post.flow.json` - LLM → Save
- `image-generator.flow.json` - Image → Save
- `claude-code-task.flow.json` - Claude Code only
- `research-and-implement.flow.json` - LLM → Claude Code
- `translate-chain.flow.json` - LLM → LLM → LLM → Save
- `summarize-file.flow.json` - Claude → LLM → Save

Integration tests automatically discover and test all `.flow.json` files in this directory.
