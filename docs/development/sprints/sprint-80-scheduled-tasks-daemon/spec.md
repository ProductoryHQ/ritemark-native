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

**Fields (as rendered in the editor):**

| Field | Control | Required | Description |
|---|---|---|---|
| Cron | mono `Input` + inline "Cron help" link | Yes | Standard 5-field cron expression (minute hour dom month dow) |
| Label | text `Input` | No | Human-readable name shown in status bar and run history. Falls back to file name. |
| Enabled | toggle `switch` | Yes | On to activate. Off pauses without deleting the schedule. |

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

Clicking the item runs `ritemark.showScheduledRuns` → reveals the Library's Scheduled section.

**Notifications** — native VS Code toasts via `showInformationMessage` / `showWarningMessage`, with action buttons mapped to the return value:

- *Completed:* info toast — label + first line of output. Buttons: **Open result**, **Show runs**.
- *Blocked:* warning toast — names the blocked action (`notes/2026-06-09.md`). Buttons: **Review & approve** (depends on inline approval — see scope note), **Dismiss**.

**Run history** — surfaced as a new collapsible **SCHEDULED** section in the Agent Library (between COMMANDS and FLOWS), reusing the existing `.section-header` + `.item` markup in `AgentLibraryViewProvider.ts`. Each row: status-tinted 32×32 icon chip · label · relative time · description (first lines of output) · outcome pill (Completed / Blocked / Errored / In progress), with the amber `.item-hint` style when an action is needed. Stored in `workspaceState` (DaemonResultStore), isolated from interactive chat history.

---

## Out of scope (this sprint)

- Running tasks when Ritemark is closed (background daemon). Scheduled tasks only fire while the app is open.
- Editing schedules through a UI. The frontmatter is the only interface.
- Chaining tasks or dependencies between agent files.
- Per-task model selection. Scheduled agents use the workspace default model.
- Approval UI within the run history for blocked writes — blocked actions are notified but not actionable inline yet.
