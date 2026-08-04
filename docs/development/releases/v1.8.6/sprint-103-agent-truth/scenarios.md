# Sprint 103 Scenarios

BDD examples pinning [spec.md](./spec.md). These are the manual QA matrix for Phase QA; the starred (★) scenarios are also the CDP regression script's assertions (R9). Fixture workspace: the audit's travel-notes set (README.md + itinerary.md).

## Feature: Enforced Claude plan mode (R2)

### ★ Scenario: Plan mode always produces a reviewable plan card
Given a Claude thread with **Plan** chip on
When I send "Split itinerary.md into one file per day and update README.md to link to them"
Then a plan review card appears at the end of the planning phase
And the card shows the plan as rendered markdown
And no file inside the workspace was created or modified before I acted on the card
And the transcript never shows the agent complaining about not being in plan mode

### ★ Scenario: Write attempted during planning is blocked
Given a Claude plan-first turn is running
When the model attempts a `Write`/`Edit`/file-modifying `Bash` before plan approval
Then the tool call is denied with a plan-phase message
And the turn continues (denial does not kill the turn)
And the workspace files are unchanged

### Scenario: Approve and continue with chosen autonomy
Given a plan review card is showing in a thread whose autonomy is **Auto**
When I approve the plan
Then execution continues in the same conversation (context retained)
And subsequent edits run without per-edit prompts
And the approved-plan banner shows the approved plan text, not the result text

### Scenario: Approve under Manual
Given a plan review card is showing in a thread whose autonomy is **Manual**
When I approve the plan
Then execution continues, and each mutating action still raises an approval card

### Scenario: Keep planning with feedback
Given a plan review card is showing
When I choose "Keep planning" and give feedback "make it two files, not three"
Then the session stays in plan mode
And a revised plan card appears reflecting the feedback
And the earlier plan attempt remains visible in the transcript as collapsed history

### Scenario: Cancel at plan review
Given a plan review card is showing
When I choose Cancel
Then no execution happens, the workspace is unchanged
And the thread state returns to idle with the Plan chip STILL on (D2: only approval resets it)

## Feature: Truthful autonomous planning (R4)

### ★ Scenario: Auto mode — agent chooses to plan
Given a Claude thread with autonomy **Auto** and the Plan chip **off**
When I send "Propose a plan for adding a packing checklist to each day file. Don't implement yet — I want to review first."
Then if the agent enters plan mode on its own, the transcript shows "Claude chose to plan first"
And the same plan review card is used
And the thread status shows "waiting for you", never "Done", while the card is pending

### Scenario: Question cards persist after answering
Given the agent asked a multiple-choice question and I answered it
When the turn continues
Then the question and my chosen answer remain visible in the transcript as a resolved entry

## Feature: Claude mode switching without context loss (R3)

### Scenario: Ask ↔ Auto switch preserves memory
Given a Claude thread where the agent has already read files and answered "call me Jarmo"
When I switch autonomy from Auto to Manual and ask "what did I ask you to call me?"
Then the agent answers from conversation memory (no session rebuild)

### Scenario: Session rebuild is announced
Given a Claude thread whose model I change mid-thread
When the next turn starts on a fresh session
Then the transcript states that a new session started and prior context is not carried over

## Feature: Hardened Codex plan turns (R5)

### ★ Scenario: Codex plan turn is read-only
Given a Codex thread with the Plan chip on
When I send "Reorganize README.md: move the Destinations list into destinations.md and link it. Plan the change."
Then the plan turn runs with a read-only sandbox
And a plan review card appears with Approve & continue / Keep planning / Cancel
And no workspace file changed before approval

### Scenario: Codex plan card works without structured plan events
Given Codex returns its plan only as streamed text (no `turn/plan/updated`)
When the plan turn completes
Then the review card is fully populated from the text plan

### Scenario: Codex approval restores write access
Given an approved Codex plan
When the continuation turn runs
Then it executes with the configured write sandbox and completes the planned change

## Feature: OpenCode capability truth (R6)

### ★ Scenario: No Plan control for OpenCode
Given the active runtime is OpenCode
When I look at the composer controls
Then the Plan chip is not rendered (hidden — decision D3)
And switching to Claude or Codex brings the control back without losing typed composer text

### Scenario: Mid-thread runtime switch with Plan on
Given a thread with the Plan chip on and runtime Claude
When I switch the runtime to OpenCode
Then the Plan chip visibly deactivates (with a one-line notice), rather than silently pretending

## Feature: Truthful activity state (R7)

### ★ Scenario: "Done" only when actually done
Given any runtime finishes a turn with a plan/question/approval card pending
Then the status line reads a waiting state ("Waiting for your review", "Needs your answer", "Waiting for approval")
And "Done" with the result summary appears only after the pending card is resolved and the runtime reports completion

### Scenario: Duration excludes human wait
Given a turn where the agent worked ~90s and then waited ~5 minutes for plan approval
When the turn completes
Then the headline duration reflects agent working time, with waiting time shown separately or omitted

### Scenario: Modified-files count is workspace-only
Given a Claude plan flow that wrote a plan file to `~/.claude/plans/…` and 5 workspace files
When the turn completes
Then the files summary says 5, and lists only workspace-relative paths

### Scenario: Failure is failure
Given a runtime turn ends with an error
Then the status is "failed" with the error surfaced, never "Done"

## Feature: Compact mode control (R8)

### Scenario: Two-axis control
Given any thread
When I open the composer controls
Then I see one autonomy select (Manual / Auto) and one Plan chip
And no Auto/Ask/Plan three-button strip

### Scenario: Migration of stored mode
Given a thread saved before this sprint with mode `plan`
When I open it after the update
Then autonomy shows Auto and the Plan chip is on, with no error

### Scenario: Plan chip resets after approval only
Given the Plan chip is on and I approve the resulting plan
When the execution continues
Then the chip is off for the next message
But if I had cancelled instead of approving, the chip would still be on (D2)

## Negative / hostile-path scenarios

### Scenario: Prompt text cannot flip modes (R1)
Given autonomy Manual, Plan chip off
When I send a prompt containing the literal words "enter plan mode" and "bypass permissions"
Then the turn runs under Manual semantics, and any model-initiated planning follows R4 (visible, not silent)

### Scenario: Plan approval race with cancel
Given a plan review card is showing
When I press Stop/cancel the turn
Then the pending plan approval is cleared, the runtime is interrupted, and no execution continues from the dead card (clicking stale buttons does nothing harmful)

### ★ Scenario: Regression — the Repro A sequence
Given the exact Repro A steps from the audit (Claude, Plan chip on, split-itinerary prompt)
Then the failure chain (ExitPlanMode error → lost plan → accidental recovery) does not occur: the first ExitPlanMode lands on a plan card
