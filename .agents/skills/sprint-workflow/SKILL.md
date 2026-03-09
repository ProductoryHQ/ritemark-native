---
name: sprint-workflow
description: Follow the repository sprint documentation workflow when the user is working in an explicit sprint context. Use for sprint planning, phase tracking, research notes, deliverable checklists, and keeping docs/development/sprints aligned with implementation.
---

# Sprint Workflow

Use this skill when the task is explicitly framed as sprint work. This is documentation and execution discipline, not a hard prompt gate.

## Default Behavior

- Keep implementation moving unless the user explicitly wants approval gates.
- Still maintain sprint docs so research, plan, and outcomes are recorded.

## Sprint Layout

```text
docs/development/sprints/sprint-XX-name/
  sprint-plan.md
  research/
  notes/
```

## Workflow

1. Find the active sprint folder or create one when starting new sprint work.
2. Capture research in `research/`.
3. Keep `sprint-plan.md` current with goals, success criteria, and checklist state.
4. Record meaningful implementation notes in `notes/` when the work spans multiple sessions or has architectural decisions worth preserving.

## When To Escalate

- Ask for approval only if the user clearly wants gated sprint phases.
- Otherwise treat the sprint docs as traceability, not as a blocker to coding.

## Deep References

- `.claude/agents/sprint-manager.md`
- `docs/development/sprints/`
