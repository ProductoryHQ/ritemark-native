# Sprint 80: Scheduled Tasks Daemon — Feature Spec

**Track:** SDD
**Branch:** sprint-80-scheduled-tasks-daemon
**Status:** Phase 2 (PLAN)

---

## Overview

Ritemark can run AI agents on a schedule. You mark a `.md` agent file with a schedule in its frontmatter, and Ritemark fires the agent automatically at the configured time — while the app is open.

This is for recurring tasks: daily briefings, weekly summaries, morning to-do generation, automated note-taking from a data source. You set it up once in the file; the scheduler handles the rest.

---

## R1 — Scheduling an agent task via frontmatter

A Ritemark agent file (`.md`) can be scheduled by adding a `schedule` block to its frontmatter:

```yaml
---
title: Daily Brief
schedule:
  cron: "0 9 * * 1-5"
  label: "Daily brief"
  enabled: true
---
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `cron` | string | Yes | Standard 5-field cron expression (minute hour dom month dow) |
| `label` | string | No | Human-readable name shown in status bar and run history. Falls back to file name. |
| `enabled` | boolean | Yes | `true` to activate scheduling. Set to `false` to pause without deleting the schedule. |

The schedule is per-file. One file = one schedule. A file with no `schedule` block is not scheduled.

Ritemark watches the workspace for frontmatter changes. Editing a cron expression or toggling `enabled` takes effect without restarting the app.

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

## R3 — Status bar and notifications

Ritemark shows a live indicator during scheduled runs.

**While a task is running:**

The status bar shows a pulsing indicator with the task label:

```
⟳ Daily brief...
```

The indicator is visible in the bottom status bar for the duration of the run.

**When a task completes:**

A toast notification appears with the task label and the first line of the agent's output:

```
Daily brief finished
"Here's your summary for Monday 9 June: three meetings, two open PRs..."
```

The toast is dismissible. It does not interrupt editing.

**When a task is blocked (file write or shell command):**

A toast notification appears explaining what was blocked:

```
Daily brief paused — approval needed
Agent wants to write to "notes/2026-06-09.md". Open run history to review.
```

**Run history:**

All completed and blocked runs are stored and viewable. Each entry shows: task label, file path, start time, duration, outcome (completed / blocked / errored), and the first lines of output.

---

## Out of scope (this sprint)

- Running tasks when Ritemark is closed (background daemon). Scheduled tasks only fire while the app is open.
- Editing schedules through a UI. The frontmatter is the only interface.
- Chaining tasks or dependencies between agent files.
- Per-task model selection. Scheduled agents use the workspace default model.
- Approval UI within the run history for blocked writes — blocked actions are notified but not actionable inline yet.
