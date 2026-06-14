---
name: sprint-workflow
description: Follow the repository sprint documentation workflow when the user is working in an explicit sprint context. Use for sprint planning, phase tracking, research notes, deliverable checklists, and keeping docs/development/sprints aligned with implementation.
---

# Sprint Workflow

Use this skill only when the user explicitly asks for `sprint-workflow`. This is documentation and execution discipline, not a hard prompt gate.

## Default Behavior

- Keep implementation moving unless the user explicitly wants approval gates.
- Still maintain sprint docs so research, plan, and outcomes are recorded.

## Sprint Layout

```text
docs/development/releases/vX.Y.Z/sprint-XX-name/
  sprint-plan.md
  research/
  notes/
```

## Workflow

1. Find the parent release folder under `docs/development/releases/vX.Y.Z/`, then find or create the sprint folder there. Do not create new release-bound sprints in the legacy global `docs/development/sprints/` path.
2. Capture research in `research/`.
3. Keep `sprint-plan.md` current with goals, success criteria, and checklist state; update the parent release plan tracker when branch/PR/issue status changes.
4. Record meaningful implementation notes in `notes/` when the work spans multiple sessions or has architectural decisions worth preserving.
5. Before sprint closeout or readiness handoff, check whether user-facing behavior changed. Update `docs/CHANGELOG.md` and the relevant `docs/releases/<version>/release-notes.md`, or record why no release note is needed in the sprint plan.

## When To Escalate

- Ask for approval only if the user clearly wants gated sprint phases.
- Otherwise treat the sprint docs as traceability, not as a blocker to coding.

## Deep References

- `.claude/agents/sprint-manager.md`
- `docs/development/sprints/`
