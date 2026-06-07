# Sprint 80: Scheduled Tasks Daemon — Test Scenarios

**Track:** SDD
**Linked spec:** [spec.md](spec.md)

Each scenario maps to one or more spec requirements (R1, R2, R3).

---

## S1 — Happy path: agent fires on schedule

**Covers:** R1, R2, R3

**Setup:**
- Agent file `agents/daily-brief.md` has frontmatter: `schedule: { cron: "0 9 * * 1-5", label: "Daily brief", enabled: true }`
- Current time advances past 09:00 on a weekday
- Sprint 79 `AgentRuntime` interface is present; `scheduled-tasks-daemon` feature flag is enabled

**Steps:**
1. Open Ritemark with the agent file in the workspace
2. Wait for the cron trigger time to pass

**Expected:**
- Status bar shows `⟳ Daily brief...` while the agent runs
- Agent runs headlessly (no chat window opened)
- On completion, toast appears: "Daily brief finished" + first line of agent output
- Run is recorded in `DaemonResultStore` with outcome `completed`
- No interactive conversation history is modified

---

## S2 — Disabled schedule is skipped

**Covers:** R1

**Setup:**
- Agent file has `schedule: { cron: "0 9 * * 1-5", label: "Test", enabled: false }`

**Steps:**
1. Advance time past the cron trigger

**Expected:**
- No agent run fires
- No status bar change
- No toast notification
- `DaemonResultStore` has no new entry for this file

---

## S3 — File-write blocked and user notified

**Covers:** R2, R3

**Setup:**
- Agent file is scheduled and enabled
- Agent's task prompt instructs it to write a new file to disk

**Steps:**
1. Trigger fires; agent starts
2. Agent attempts a file-write operation

**Expected:**
- File write is blocked (not executed)
- Toast appears: "Daily brief paused — approval needed" + file path
- Status bar indicator stops (run considered blocked/paused)
- Run recorded in `DaemonResultStore` with outcome `blocked`, including which operation was blocked and the target path

---

## S4 — Shell command blocked and user notified

**Covers:** R2, R3

**Setup:**
- Agent attempts a shell command during a scheduled run

**Expected:**
- Shell command is blocked
- Toast appears with explanation
- Run recorded with outcome `blocked`

---

## S5 — Frontmatter change takes effect without restart

**Covers:** R1

**Setup:**
- Agent file is scheduled and running (or waiting for next trigger)

**Steps:**
1. Edit frontmatter: change `cron` expression to a different schedule

**Expected:**
- Scheduler picks up the updated cron expression on next evaluation cycle
- Old trigger is cancelled; new trigger is registered
- No app restart required

**Variant — disable in place:**
1. Edit `enabled: true` → `enabled: false`

**Expected:**
- Scheduler cancels the pending trigger immediately
- No future runs until re-enabled

---

## S6 — App closed during scheduled window (missed run)

**Covers:** R1, R2

**Setup:**
- Agent scheduled for 09:00
- Ritemark is not running at 09:00 (app closed)
- App is opened at 10:30

**Expected:**
- Missed run is NOT executed retroactively (no catch-up)
- No error or notification about the missed run
- Scheduler registers the next upcoming trigger from the cron expression
- Run history shows no entry for the missed 09:00 slot

---

## S7 — Run history display

**Covers:** R3

**Setup:**
- Several runs have completed, one was blocked, one errored

**Steps:**
1. Open run history view

**Expected:**
- Each entry shows: task label, file path, start time, duration, outcome (completed / blocked / errored)
- Completed entries show first lines of agent output
- Blocked entries show which operation was blocked and the target path
- Entries are ordered most-recent first
- History persists across app restarts (stored in workspaceState)

---

## S8 — Sprint 79 not yet merged: feature flag inactive

**Covers:** R2 (AgentRuntime dependency gate)

**Setup:**
- `scheduled-tasks-daemon` feature flag is enabled
- Sprint 79 `AgentRuntime` interface is NOT present in the codebase (e.g. running on a branch without Sprint 79)

**Steps:**
1. Agent file has a valid schedule and `enabled: true`
2. Cron trigger fires

**Expected:**
- `AgentTaskHandler` does NOT run (activation guard prevents it)
- Scheduler logs a warning that `AgentRuntime` is unavailable
- No crash, no uncaught exception
- Status bar shows nothing (task silently skipped)
- Run recorded in `DaemonResultStore` with outcome `skipped` and reason `agent-runtime-unavailable`

---

## S9 — No `schedule` block in frontmatter

**Covers:** R1

**Setup:**
- `.md` file in workspace has no `schedule` field in frontmatter

**Expected:**
- File is ignored by the scheduler entirely
- No error

---

## S10 — Malformed cron expression

**Covers:** R1

**Setup:**
- Frontmatter has `schedule: { cron: "not-a-cron", label: "Bad", enabled: true }`

**Expected:**
- Scheduler logs a parse error for this file
- No crash
- No run is scheduled
- All other scheduled files continue to operate normally
