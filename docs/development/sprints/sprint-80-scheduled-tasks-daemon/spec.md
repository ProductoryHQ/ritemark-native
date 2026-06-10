# Sprint 80: Scheduled Tasks Daemon — Feature Spec

**Track:** SDD
**Branch:** sprint-80-scheduled-tasks-daemon
**Status:** Phase 2 (PLAN)

---

## Overview

Ritemark can run AI agents on a schedule. You mark a `.md` agent file with a schedule in its frontmatter, and Ritemark fires the agent automatically at the configured time — while the app is open.

This is for recurring tasks: daily briefings, weekly summaries, morning to-do generation, automated note-taking from a data source. You set it up once in the file; the scheduler handles the rest.

---

## R1 — Scheduling an agent task in the Agent editor

The schedule is authored in the **Agent editor pane** (the structured left panel in `AgentConfiguratorPanel.tsx`), as a **Schedule** field group alongside Description / Model / Tools — not as hand-typed frontmatter. It follows the existing `SectionLabel` + `FieldRow` pattern. The fields serialize to a `schedule:` frontmatter block underneath:

```yaml
schedule:
  cron: "0 9 * * 1-5"
  label: "Daily brief"
  enabled: true
```

**Fields (as rendered in the editor — `ScheduleEditor.tsx`, Jarmo decision #7):**

The cron expression is authored through a structured **picker**, not a raw text field:

| Control | Description |
|---|---|
| Mode segmented control | **Interval** (every N minutes/hours from presets) or **Days** (weekday chips Mon–Sun + recurrence presets Every day / Weekdays / Weekends / Custom + time `HH:MM`) |
| Summary banner | Live human-readable readout, e.g. "Runs daily at 09:00" |
| Advanced (cron) | Collapsible escape hatch: editable 5-field cron expression + copy button. If a file's cron cannot be represented by the two picker modes, the editor opens directly in Advanced mode. |
| Label | text `Input` — human-readable name shown in status bar and run history. Falls back to file name. |
| Enabled | shadcn `Switch` — on to activate. Off pauses without deleting the schedule. |

The picker serializes to the same `schedule.cron` string (`webview/src/components/agent/cronSchedule.ts` owns the cron ↔ UI mapping; round-trip unit-tested).

The schedule is per-file. One file = one schedule. A file with no `schedule` block is not scheduled.

Ritemark watches the workspace for frontmatter changes. Editing the cron or toggling Enabled takes effect without restarting the app. (Raw frontmatter editing still works for power users — the editor is the primary path, not the only one.)

---

## R2 — What the agent runs as

When a scheduled task fires, Ritemark runs the agent file headlessly — the same agent that would run if you opened the file and pressed Run, but without requiring a chat window to be open.

The agent runs in a fresh session. It does not have access to previous conversations; its memory is its own written files. Results are stored in Ritemark's internal run history (not mixed into any open chat).

**Auto-approval policy for scheduled runs:**

Because you are not present to approve every action, Ritemark applies a conservative policy:

- File reads: auto-approved.
- File writes: blocked. A notification appears so you can review and decide.
- Shell commands: blocked. A notification appears.

This means scheduled agents are safe to run unattended for read-only tasks (summarise, analyse, report). Write-heavy tasks will generate notifications and wait for your review.

---

## R3 — Status bar and notifications (VS Code native)

Both surfaces use VS Code native primitives — no custom webview chrome. See `mocks/touchpoints.html` for the rendered states.

**Status bar** — a native `StatusBarItem` (right-aligned, same idiom as `connectivity.ts` and the word-count item), with three states driven by codicon + text + `backgroundColor`:

| State | Render | Notes |
|---|---|---|
| Idle (task registered) | `$(clock) 1 scheduled` | accent foreground |
| Running | `$(sync~spin) Daily brief…` | spinner codicon during the run |
| Needs review (blocked run) | `$(warning) 1 needs review` | uses built-in `statusBarItem.warningBackground` (amber) |

Clicking the item runs `ritemark.daemon.showScheduledRuns` → reveals the Library's Scheduled section.

**Notifications** — native VS Code toasts via `showInformationMessage` / `showWarningMessage`, with action buttons mapped to the return value:

- *Completed:* info toast — label + first line of output. Buttons: **Open result**, **Show runs**.
- *Blocked:* warning toast — names the blocked action (`notes/2026-06-09.md`). Buttons: **Review & approve**, **Dismiss**.

**Run history** — surfaced as a new collapsible **SCHEDULED** section in the Agent Library (between COMMANDS and FLOWS), reusing the existing `.section-header` + `.item` markup in `AgentLibraryViewProvider.ts`. Each row: status-tinted 32×32 icon chip · label · relative time · description (first lines of output) · outcome pill (Completed / Blocked / Errored / In progress), with the amber `.item-hint` style when an action is needed. Stored in `workspaceState` (DaemonResultStore), isolated from interactive chat history.

---

## R4 — Inline approval of blocked actions

When a scheduled run is paused because a file-write or shell command was blocked, the user can approve that specific action directly from the notification toast or from the Agent Library's SCHEDULED section — without opening a full agent session.

**Entry points** (both are committed UX from the design mockup):

- The blocked warning toast shows a **Review & approve** button alongside Dismiss.
- The SCHEDULED section row shows an amber hint line: "Approval needed — click to review". Clicking it (or a dedicated row action) opens the same approval review.

**What "approve" does:**

Approving re-runs the scheduled agent from the start with the previously-blocked action added to a one-time allow-list for that run. The allow-list is scoped to the single re-run — it does not change the standing `AutoApprovalPolicy` or persist to future scheduled runs. The previous blocked result is superseded in `DaemonResultStore`; the run outcome flips from `blocked` to `completed` (or `blocked` again if a different action is blocked in the re-run).

**What is not in scope within this flow:**

- Editing the action before approving (e.g. changing the target path). Approve = approve as-is.
- Bulk-approving multiple blocked runs at once.
- Changing the standing policy for future runs (that is a separate settings concern).

**Command:** `ritemark.daemon.approveScheduledAction(taskId, runId)` — resolves the pending blocked result from `DaemonResultStore`, constructs an allow-list entry for the blocked action, and re-invokes `AgentTaskHandler.run()` with that allow-list applied.

**Sprint 79 dependency:** Re-running via `AgentTaskHandler` requires the `AgentRuntime` interface. The approval command must apply the same `[S79]` guard — if `AgentRuntime` is absent, the command logs a warning and shows a toast explaining the action cannot be retried yet.

---

## Out of scope (this sprint)

- Running tasks when Ritemark is closed (background daemon). Scheduled tasks only fire while the app is open.
- A standalone schedule-management UI (calendar view, cross-file schedule list). Schedules are authored per-file in the Agent editor (R1); there is no aggregate scheduling dashboard this sprint.
- Chaining tasks or dependencies between agent files.
- Per-task model selection. Scheduled agents use the workspace default model.
- Editing the blocked action before approving (e.g. changing the target path). Approve means approve as-is.
- Bulk-approving multiple blocked runs at once.
- Changing the standing `AutoApprovalPolicy` for future runs (separate settings concern).
