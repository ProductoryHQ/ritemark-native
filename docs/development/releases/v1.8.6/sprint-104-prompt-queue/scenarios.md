# Sprint 104 Scenarios

★ = automated/live-validated in the dev matrix.

## Feature: Bounded visible queue (R1)

### ★ Scenario: Busy composer send queues visibly
Given a Claude turn is running in this thread
When I type a follow-up and press Enter
Then the prompt appears in the "Queued · 1/10" panel and the composer clears

### Scenario: Queue full
Given 10 items are queued in this thread
When I press Enter on an 11th
Then a "Queue full (10)" notice shows and my composer text is preserved

## Feature: One enqueue path (R2)

### ★ Scenario: Comment send on a busy runtime is never dropped
Given a Codex comment task is assigned while Codex is busy in its thread
When the editor sends `comment:submit`
Then the item lands in that Codex thread's queue (never the active thread)
And runs when the turn finishes

### Scenario: Comment with no matching thread
Given no open thread is bound to OpenCode
When an @opencode comment is sent
Then a new OpenCode thread is created in the background and the item queued there
And the visible thread does not change

## Feature: Readiness-gated drain (R3)

### ★ Scenario: Plan review blocks draining
Given a queued follow-up and the running turn ends in a plan review card
Then the item stays queued ("Waiting for your review" state) until the plan is approved/rejected — then it sends

### ★ Scenario: Background thread drains without being visible
Given thread A is visible and thread B has a queued item with B's turn finishing
Then B's item auto-sends even though B is not on screen

### Scenario: Failure pauses the queue
Given a queued item and the running turn fails
Then the queue shows "Paused — last turn failed" with Resume; nothing auto-sends until Resume

### Scenario: Captured policy survives UI changes
Given an item queued while the thread was Manual/Codex
When I switch the composer to Claude/Auto before it sends
Then the item still runs on Codex with Manual policy (captured at enqueue)

## Feature: Management UI (R4)

### Scenario: Edit / remove / reorder before send
Given three queued items
Then I can edit item 2's text in place, move item 3 up, and remove item 1 — order and content update, nothing sends early

### Scenario: Retry a failed dispatch
Given an item marked failed with its error shown
When I press Retry
Then it re-enters the queue head and dispatches when ready

## Negative

### Scenario: Closing a thread with queued items
Given a thread has queued items
Then the rail close affordance is withheld (existing Sprint 99 rule, now backed by the real queue)

### ★ Scenario: No duplicates on rapid submits
Given 5 rapid Enter presses while running
Then exactly 5 items are queued and exactly 5 turns eventually run, in order
