# Sprint 80: Scheduled Tasks Daemon — Test Scenarios

**Track:** SDD
**Linked spec:** [spec.md](spec.md)

Each scenario maps to one or more spec requirements (R1, R2, R3, R4).

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
- No toast or notification about the missed run
- Scheduler registers the next upcoming trigger from the cron expression
- Run history shows an entry for the missed 09:00 slot with outcome `missed` — no output, no action buttons available

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
- Entries are ordered most-recent first; only the 10 most recent runs are shown
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

## S11 — User approves blocked file-write from toast

**Covers:** R4

**Setup:**
- Agent file is scheduled and enabled
- Agent's task instructs it to write `notes/2026-06-09.md`
- Run fires headlessly; file-write is blocked (S3 precondition)
- Warning toast is showing: "Daily brief paused — approval needed" with **Review & approve** and **Dismiss** buttons

**Steps:**
1. User clicks **Review & approve** in the toast

**Expected:**
- `ritemark.daemon.approveScheduledAction(taskId, runId)` is invoked
- Agent re-runs from the start with `notes/2026-06-09.md` write on the one-time allow-list
- File is written during the re-run
- `DaemonResultStore` records a new result entry with outcome `completed`; the previous `blocked` entry is superseded (or clearly marked as superseded)
- Status bar returns to idle state: `$(clock) 1 scheduled`
- Completion toast appears: "Daily brief finished" + first line of output
- The standing `AutoApprovalPolicy` is unchanged — future runs still block file-writes unless approved again

---

## S12 — User approves blocked action from Agent Library SCHEDULED row

**Covers:** R4, R3

**Setup:**
- Same post-block state as S11, but user dismisses the toast without clicking Review & approve

**Steps:**
1. User opens Agent Library and navigates to the SCHEDULED section
2. The blocked run row shows an amber hint: "Approval needed — click to review"
3. User clicks the hint or a row action button to approve

**Expected:**
- Same re-run and result-flip behaviour as S11
- Amber hint disappears from the row after the re-run completes
- Row outcome pill updates from `Blocked` to `Completed`

---

## S13 — Approved action re-runs but a different action is blocked

**Covers:** R4

**Setup:**
- Agent's first blocked action (file-write to `notes/2026-06-09.md`) is approved
- During the re-run, the agent also attempts to execute a shell command

**Expected:**
- First file-write proceeds (it was approved)
- Shell command is blocked (it was not approved; policy still blocks shell commands)
- Re-run outcome is `blocked` (not `completed`)
- New `DaemonResultStore` entry reflects the new blocked action (shell command detail)
- Toast shows the shell command as the new blocker

---

## S14 — Approval attempted when Sprint 79 is absent

**Covers:** R4 (Sprint 79 guard)

**Setup:**
- A run result with outcome `blocked` exists in `DaemonResultStore`
- User clicks **Review & approve**
- Sprint 79 `AgentRuntime` is NOT present in the codebase

**Expected:**
- `ritemark.daemon.approveScheduledAction` fires the `[S79]` guard check
- No re-run is attempted
- A warning toast explains: "Cannot retry — AgentRuntime unavailable. Ensure Sprint 79 is merged."
- `DaemonResultStore` entry remains unchanged (still `blocked`)
- No crash

---

## S15 — Workspace changed since block (staleness)

**Covers:** R4

**Setup:**
- A run was blocked because the agent tried to write `notes/2026-06-09.md`
- The user manually creates `notes/2026-06-09.md` (or deletes it) after the block, before clicking **Review & approve**

**Steps:**
1. User clicks **Review & approve** after the workspace state has changed

**Expected:**
- The re-run proceeds from the start regardless — the allow-list still permits the write to `notes/2026-06-09.md`
- If the file now exists, the agent may overwrite it (standard file-write semantics; no staleness abort)
- No special warning is shown about the changed workspace state — the approval is unconditional (approve-as-is per R4)
- The re-run outcome reflects what actually happened (completed or blocked again if a different action is hit)

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
