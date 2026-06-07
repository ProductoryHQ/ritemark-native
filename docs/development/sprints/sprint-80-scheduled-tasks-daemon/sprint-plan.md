# Sprint 80: Scheduled Tasks Daemon

Track: SDD
Branch: sprint-80-scheduled-tasks-daemon
Status: Phase 2 (PLAN) — awaiting Jarmo approval

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth)
- [scenarios.md](scenarios.md) — BDD examples (manual QA matrix)
- [technical-plan.md](technical-plan.md) — architecture and file map
- [tasks.md](tasks.md) — implementation checklist
- [sprint-plan.md](sprint-plan.md) — this file (intent + status)

---

## Goal

Introduce a background scheduler that runs AI agent tasks headlessly on a cron schedule defined in each agent file's frontmatter, stores results, and notifies the user on completion or when an action requires approval.

## Linked Issues

- GitHub: this sprint implements the core daemon infrastructure referenced in the Sprint 79 architecture pre-work (last updated 2026-06-07 in `docs/development/architecture.md`).

---

## MVP Scope

**In scope:**

- `schedule:` frontmatter block (`cron`, `label`, `enabled`) as the sole scheduling interface
- `Scheduler.ts` — cron-driven task runner, file watcher, concurrency guard
- `AgentTaskHandler.ts` — headless agent execution via `AgentRuntime.prompt()` `[Sprint 79 dependent]`
- `DaemonResultStore.ts` — workspaceState persistence, 50-entry cap per task, `supersede()` for re-run result replacement
- `DaemonStatusEvents.ts` — status bar pulse during run + completion/blocked toast with **Review & approve** button
- `scheduleParser.ts` — frontmatter parser + cron validator
- `GitSyncHandler.ts`, `ScriptHandler.ts` — interface-only stubs proving extensibility
- Feature flag `scheduled-tasks-daemon` (default: disabled)
- Command `ritemark.showDaemonHistory`
- Command `ritemark.approveScheduledAction(taskId, runId)` — inline approval from toast or Library row `[Sprint 79 dependent]`
- Agent Library SCHEDULED row: amber hint + approve action for blocked runs
- Architecture doc update

**Out of scope:** Run-when-closed (OS daemon), GUI schedule editor, handler activation beyond agents, cross-workspace history, per-task model selection, editing the blocked action before approving, bulk-approving multiple runs, changing standing `AutoApprovalPolicy` for future runs.

---

## Sprint 79 Dependency

`AgentTaskHandler` requires `src/runtime/AgentRuntime.ts` and `RuntimeRegistry.ts` from Sprint 79. Sprint 80 is designed to merge before or after Sprint 79 — all components except `AgentTaskHandler` are independent. The `Scheduler.ts` dynamic import guard ensures no runtime error if Sprint 79 has not merged. When Sprint 79 lands and the feature flag is toggled on, `AgentTaskHandler` activates automatically.

Phase 3 tasks marked `[S79]` are deferred if Sprint 79 has not merged by the time Sprint 80 reaches Phase 5 QA. They become the first commit after Sprint 79 merges.

---

## Product Decisions

- **2026-06-07:** Isolated daemon sessions — scheduled runs are always fresh sessions; they never read from or write to interactive conversation history. (Jarmo decision #2)
- **2026-06-07:** Frontmatter format — structured `schedule: { cron, label, enabled }` block. (Jarmo decision #3)
- **2026-06-07:** Status UX — active pulse in status bar during run + completion toast with first line of output. (Jarmo decision #4)
- **2026-06-07:** Sprint 79 parallel build — build all daemon infra now; gate `AgentTaskHandler` activation behind feature flag + dynamic import guard. (Jarmo decision #1)
- **2026-06-07:** Inline approval is IN scope — blocked runs are approvable directly from the warning toast ("Review & approve" button) and from the Agent Library SCHEDULED row. Approve re-runs the agent from the start with the blocked action on a one-time allow-list; the standing policy is unchanged. (Jarmo decision #5)

---

## Success Criteria

- [ ] A `.md` file with a valid `schedule:` block fires the scheduled agent at the cron-specified time
- [ ] Disabled schedules (`enabled: false`) never fire
- [ ] File writes and shell commands are blocked in headless runs; user is notified with toast
- [ ] Run results persist in workspaceState across app restarts
- [ ] Status bar shows live pulse during run; toast shows first line of output on completion
- [ ] Sprint 79 absence does not crash the extension — tasks are silently skipped with a status bar warning
- [ ] Feature flag `scheduled-tasks-daemon` is `disabled` by default in the merged artifact
- [ ] All 10 base QA scenarios (S1–S10) pass
- [ ] Inline approval QA scenarios (S11–S15) pass `[Sprint 79 dependent]`
- [ ] Approving a blocked run re-executes the agent with the action permitted; outcome flips from Blocked to Completed
- [ ] The standing `AutoApprovalPolicy` is not modified by an approval action
- [ ] Architecture doc updated

---

## Pre-Implementation Gate

Before Phase 3 begins:

1. Jarmo approves this sprint plan (phrase: "approved", "Jarmo approved", or "proceed")
2. Sprint branch created: `git checkout -b sprint-80-scheduled-tasks-daemon`
3. Current branch verified: `git branch --show-current` must return `sprint-80-scheduled-tasks-daemon`

No code edits on `main`.

---

## Approval

- [ ] Jarmo approved this sprint plan
