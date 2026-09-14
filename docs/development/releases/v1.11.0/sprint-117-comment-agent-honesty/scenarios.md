# Sprint 117 Scenarios

BDD examples for [spec.md](./spec.md). ★ scenarios must be automated or live-verified with evidence.

## Feature: One task identity and capture path (R1, R2)

### ★ Scenario: Single comment creates one accepted task
Given an anchored comment assigned to Claude
When I choose Send to AI
Then the host validates and persists one task before reporting Queued
And the editor, destination queue, conversation turn, and later reply use the same task ID

### ★ Scenario: Bulk and single produce the same normalized prompt
Given the same assigned comment can be sent alone or through the Comments menu
When each request is normalized in a fixture
Then runtime, source document, comment ID, instruction, anchored text, marker guard, and prompt wording match
And only bulk grouping/order differs when several comments share an agent

### Scenario: Meaningful second agent mention survives
Given a note says `@claude compare this with @codex guidance`
When it is assigned to Claude
Then only the assignment mention is removed from the instruction
And `@codex guidance` remains meaningful task text

### Scenario: Unsupported alias does not dispatch
Given a comment contains `@other` but no supported assignment
When I inspect or bulk-send comments
Then it stays unassigned
And no task is accepted

### Scenario: Empty or oversized payload is rejected
Given the comment instruction is empty or the normalized task exceeds bounds
When I send it
Then the editor shows the exact rejection
And no task record, queue item, or conversation turn is created

## Feature: Stable source binding (R3)

### ★ Scenario: Standalone note receives a stable ID before dispatch
Given an older standalone `<!-- -->` comment has no ID
When I send it to an agent
Then Ritemark applies one undoable stable-ID document update first
And acceptance includes that ID rather than `commentIds: []`

### ★ Scenario: Tab switch cannot retarget queued work
Given I assign a comment in `A.md`
When I switch to `B.md` before the queue drains
Then the runtime receives `A.md` as its active/source file context
And the task/reply/status remain bound to the comment in `A.md`

### Scenario: Source editor closes while task runs
Given a task from `A.md` is running
When I close `A.md` and later reopen it
Then work continues in the destination conversation
And the reopened comment reconstructs current status from the host task ledger

### Scenario: Two documents reuse the same legacy comment text
Given `A.md` and `B.md` contain identical comments
When only the `A.md` task changes status
Then `B.md` remains neutral
And no global comment-ID/text fallback crosses the document boundary

### Scenario: Source document moves or uses Save As
Given a pending or completed task is bound to a document
When the document is renamed, moved, or saved as another file
Then behavior follows the approved Phase 0 rule with an explicit relink/copy state
And Ritemark never guesses across projects

## Feature: Destination and acceptance honesty (R4, R5)

### ★ Scenario: Destination is visible
Given a comment is assigned to Codex
When the send confirmation appears or the task is accepted
Then it names Codex and the exact existing or new destination conversation
And Open conversation selects that canonical conversation

### Scenario: Runtime is signed out
Given Claude is unavailable because sign-in is required
When I send a Claude-assigned comment
Then no task is reported queued
And the comment offers the same Sign in recovery as Agent Chat

### Scenario: Runtime status is refreshing
Given the runtime's last known status is usable but a refresh is in flight
When I send a task
Then the normalized availability policy makes one deterministic decision
And the comment path does not invent a stricter or looser gate than Composer

### ★ Scenario: Queue is full
Given the chosen destination queue has ten items
When I send another comment task
Then acceptance fails with queue-full guidance
And no task record is reported as queued or left orphaned

### ★ Scenario: Bulk has mixed acceptance results
Given Claude is ready and Codex is unavailable
When I bulk-send groups for both
Then the result says which group was queued and which was rejected
And no blanket “Queued 2 tasks” success is shown

### Scenario: Double click is idempotent
Given one send request is in flight
When the action is activated twice or its response is retried
Then request identity resolves to one task and one queue item
And the UI cannot show duplicate replies

### Scenario: Destination conversation is deleted before dispatch
Given a task is accepted for a destination conversation
When that conversation is deleted before the turn starts
Then the task becomes failed/actionable or requires explicit retargeting under the approved rule
And it never falls back to whichever conversation is visible

## Feature: Task-scoped lifecycle (R6, R8)

### ★ Scenario: Two tasks share one conversation
Given two comment tasks are running sequentially in the same conversation
When the first turn completes
Then only the first task becomes completed
And the second stays queued or running according to its own turn ID

### ★ Scenario: Approval or question needs the user
Given a background comment task requests approval or asks a question
When the runtime event arrives
Then the source comment says Needs you and offers Open conversation
And no completed reply appears until the exact turn reaches terminal success

### ★ Scenario: Cancel is not completion
Given a Claude, Codex, or OpenCode task is cancelled or interrupted
When its terminal event arrives
Then the source comment says Cancelled or Interrupted
And it never shows Task finished

### Scenario: Reload preserves status
Given a comment task is queued, running, needs-user, or completed
When the editor and AI sidebar webviews reload
Then status and destination reconstruct from host records
And no module-global webview registry is required

### Scenario: Stale callback after retry is ignored
Given a failed task is retried with a new generation
When a late result from the previous attempt arrives
Then it remains historical and cannot overwrite current status/reply

### Scenario: Parallel documents and runtimes stay isolated
Given tasks from two documents run in Claude, Codex, and OpenCode conversations
When their events interleave
Then each event updates only its own task/document/comments
And all conversation IDs remain canonical

## Feature: Completion reply (R7)

### ★ Scenario: Successful result replies to the source comment
Given a task completes with assistant text
When I open the source comment
Then it shows one concise completion summary, runtime identity, timestamp, and Open conversation
And the user's original note and anchored text are unchanged

### Scenario: Tool-only success has honest fallback
Given the agent modifies files but returns no useful assistant text
When the task completes successfully
Then the reply says the work finished and points to the conversation
And Ritemark does not invent a textual conclusion

### Scenario: Multi-comment task projects the same completion once per source
Given one ordered task contains three comments
When it completes
Then each source comment shows the same task-scoped result link
And reopening the document does not duplicate the reply

### Scenario: Failure has retry and diagnostics
Given the exact task fails
When I open its source comment
Then it shows actionable failure copy plus Retry/Open conversation as applicable
And prior successful tasks in the same conversation remain completed

### Scenario: Export stays comment-free
Given a comment displays task status and a completion projection
When I export PDF, Word, or Google Docs input HTML
Then neither the original comment nor task metadata/reply appears in exported content

## Feature: Rollout and closeout (R9)

### ★ Scenario: Flag-off is coherent
Given `comment-callouts` is disabled
When an old document with comments is opened
Then comments/task UI and comment-task host actions are inert under the existing feature contract
And no hidden task mutation or new relay remains active

### ★ Scenario: Accessibility matrix passes
Given narrow and normal sidebar/editor widths, keyboard-only use, 200% zoom, high contrast, and reduced motion
When I inspect confirmation, queued, running, needs-user, failed, and completed states
Then status is readable, non-color-only, focusable, and does not cover the document text

### ★ Scenario: Sprint closes without regressions
Given all requirement-linked tests, manual scenarios, docs, and repository QA pass
When Sprint 117 closes
Then #156 is satisfied, the 23 findings are resolved or explicitly deferred, and the parent tracker records evidence

## Negative and Hostile Paths

### Scenario: Forged webview task status is rejected
Given a webview sends a task/status mutation it does not own
When the host validates it
Then the message is rejected and logged without changing a record

### Scenario: Wrong-project document URI is rejected
Given a task request claims a document outside its validated project scope
When it reaches the host
Then acceptance fails safely and no document/conversation fallback occurs

### Scenario: Source comment is deleted during work
Given the task remains valid but a source comment is deleted
When a lifecycle event arrives
Then no text is reinserted and no deleted comment resurrects
And the destination conversation retains the task result under the approved retention rule
