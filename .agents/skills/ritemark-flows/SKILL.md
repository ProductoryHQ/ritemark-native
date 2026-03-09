---
name: ritemark-flows
description: Build, edit, and debug Ritemark Flows stored as .flow.json files and their backend/webview integrations. Use when changing .ritemark/flows, flow node types, execution wiring, or variable interpolation behavior.
---

# Ritemark Flows

Use this skill when the task touches the visual workflow system.

## Scope

- `.ritemark/flows/*.flow.json`
- `extensions/ritemark/src/flows/**`
- `extensions/ritemark/webview/src/components/flows/**`

## Working Rules

1. Keep backend node types, executor routing, and webview node mappings aligned.
2. Preserve deterministic execution order and variable interpolation semantics.
3. When adding a new node type, update both backend and webview surfaces in the same task.

## Validation

Targeted safe test set:

```bash
cd extensions/ritemark
npx tsx src/flows/flowTypes.test.ts
npx tsx src/flows/FlowExecutor.test.ts
npx tsx src/flows/nodes/ClaudeCodeNodeExecutor.test.ts
npx tsx src/flows/FlowIntegration.test.ts
```

## Deep References

- `.claude/skills/ritemark-flows/SKILL.md`
- `.claude/skills/flow-testing/SKILL.md`
- `docs/development/analysis/node-based-ai-automation-flows/STRATEGY-ritemark-flows.md`
- `docs/development/analysis/2026-02-03-claude-code-node-flows.md`
