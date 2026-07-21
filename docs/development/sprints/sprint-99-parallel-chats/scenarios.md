# Sprint 99 Scenarios — Parallel Agent Chats

These scenarios become the manual QA matrix at Phase 6. `tasks.md` checkboxes refer back to this file — do not duplicate the detail there.

Every scenario is traceable to a requirement id in [`spec.md`](spec.md). The weight of this file is deliberately on **concurrency edge cases** — the class of bug that code review misses because each file looks correct in isolation and only the interleaving is wrong.

Terminology follows `design.md` § 2: **thread** (a live conversation on the rail), **rail** (the right-edge icon strip), **close** (remove from rail, keep in History), **runtime** (Claude / Codex / OpenCode).

Scenarios marked **[RESOLVED GAP]** describe behaviour `design.md` did not determine; they carry the `spec.md` § Resolved Design Gaps number, which records the decision and its reasoning. They are QA-able like any other scenario; Jarmo can override a decision with one sentence.

---

## Feature: Concurrent streaming across runtimes (R1, R2, R3, R4, R5)

### Scenario: Two threads on different runtimes stream simultaneously
Given a Claude thread and a Codex thread are open on the rail
And the Claude thread is streaming a long response
When the user switches to the Codex thread and sends a prompt
Then the Codex thread begins streaming immediately without queuing
And the Claude thread keeps streaming in the background
And both rail icons show a spinner
And neither transcript contains any text belonging to the other thread

### Scenario: Switching between two mid-stream threads loses nothing
Given two threads are both actively streaming
When the user switches from thread A to thread B and back to thread A several times
Then each switch renders the full up-to-date transcript of the thread being shown
And no partial or duplicated tokens appear in either transcript
And no output produced while a thread was in the background is missing after switching back to it

### Scenario: Three threads on three different runtimes stream at once
Given a Claude thread, a Codex thread, and an OpenCode thread are all open
When all three are given prompts in quick succession
Then all three stream concurrently
And each rail icon shows its runtime tint (clay / green / sky) with a spinner
And each transcript contains only its own thread's output

### Scenario: Switching away does not tear down the session
Given a thread is streaming
When the user switches to another thread
Then no `conversation:reset` is posted and no provider session is torn down
And the thread that was switched away from is still streaming when revisited

### Scenario: Two Claude threads run at once (same-runtime concurrency)
Given two threads are both bound to the Claude runtime
When both are prompted so their turns overlap in time
Then both stream independently
And each has its own `AgentSession` in the runtime's session map
And neither thread's tool output or pending questions appear in the other

### Scenario: Two Codex threads run at once (same-runtime concurrency)
Given two threads are both bound to the Codex runtime
When both are prompted so their turns overlap in time
Then the adapter holds a distinct protocol `threadId` per thread
And every inbound event routes by that `threadId`
And neither thread's output is appended to the other's transcript

### Scenario: Two OpenCode threads run at once (same-runtime concurrency)
Given two threads are both bound to the OpenCode/ACP runtime
When both are prompted so their turns overlap in time
Then both stream independently under whichever concurrency model was recorded in `technical-plan.md`
And if per-chat subprocess was chosen, exactly two OpenCode subprocesses exist
And if multi-session-in-subprocess was chosen, one subprocess serves both sessions with isolated state

### Scenario: Mixed same-runtime and cross-runtime load
Given two Claude threads, one Codex thread, and one OpenCode thread are open
When all four are streaming at the same time
Then all four rail icons show a spinner
And each transcript contains only its own output
And the UI remains responsive when switching between them

---

## Feature: Approvals across threads (R7, R8)

### Scenario: Approval arrives in a background thread while another streams
Given thread A is streaming in the foreground
And background thread B raises an approval request
Then thread B's rail icon shows an amber dot
And thread A's rail icon still shows a spinner
And thread A's streaming is not interrupted, paused, or visually disturbed
And no approval card appears in thread A

### Scenario: Switching to the amber thread shows its card
Given background thread B shows an amber dot
When the user clicks thread B's rail icon
Then the approval card renders inside thread B's transcript, at the point the agent asked
And the composer footer switches to thread B's runtime and model

### Scenario: Approving in thread A does not resolve thread B's approval
Given thread A and thread B each have a pending approval request
When the user approves the request in thread A
Then thread A proceeds and its badge returns to spinner
And thread B's approval is still pending and its icon is still amber
And thread B's requested action has not been executed

### Scenario: Two pending approvals on the SAME runtime do not cross-resolve
Given two Codex threads each have a pending approval
When the user denies the request in the first thread
Then only the first thread's action is denied
And the second thread's request remains pending and independently actionable

### Scenario: Resolving a background approval does not steal focus
Given thread A is active and streaming
And thread B has a pending approval
When the user switches to thread B, approves, and switches back to thread A
Then thread A's transcript, scroll position, composer draft, and streaming state are exactly as left
And thread B resumes its turn

### Scenario: Multiple pending approvals in one thread show a single amber dot
Given a thread raises three approval requests before any is answered
Then its rail icon shows exactly one amber dot with no count
And all three requests are individually visible and actionable inside the thread
And the icon stays amber until the last one is resolved

### Scenario: An agent question (not a file approval) also drives amber
Given a Claude thread raises an `AskUserQuestion` or a plan review
Then that thread's rail icon shows amber, not a spinner
And answering the question returns the icon to spinner while the turn continues

---

## Feature: Status language (R8)

### Scenario: Spinner to amber and back within one turn
Given a thread is streaming and its icon shows a spinner
When the turn hits an action requiring approval
Then the icon changes from spinner to amber dot
When the user approves
Then the icon changes back to spinner as the turn resumes
And when the turn completes the badge disappears entirely

### Scenario: Amber overrides spinner
Given a thread's turn is technically mid-flight (tokens still arriving) and it also has an unresolved approval
Then the icon shows the amber dot ONLY
And no spinner is rendered alongside it

### Scenario: Idle thread shows no badge and offers close on hover
Given a thread has no turn in flight and nothing pending
Then its rail icon shows no status badge
When the user hovers it
Then a close (×) appears in place of the badge

### Scenario: The active thread is badged too
Given the user is looking at thread A while it streams
Then thread A's own rail icon shows a spinner (badges are not suppressed for the active thread)
And when thread A hits an approval, thread A's icon shows amber even though its card is already on screen

### Scenario: Adjacent badges do not collide
Given three consecutive threads on the rail show spinner, amber, and no badge respectively
Then each badge sits in its own icon's single bottom-right slot
And no badge visually overlaps a neighbouring icon

### Scenario: Turn ending clears the badge without a stale spinner
Given a thread finishes its turn while the user is looking at a different thread
Then that thread's spinner disappears on completion
And it does not remain spinning until the user visits it

---

## Feature: Cancel and stop (R1, R14)

### Scenario: Cancelling one of two running threads leaves the other running
Given thread A and thread B are both streaming
When the user activates Stop in thread A
Then thread A stops and its badge clears
And thread B continues streaming uninterrupted, with its spinner intact
And thread B's agent session is not torn down

### Scenario: Stop applies only to the active thread
Given the composer shows Stop because the active thread is running
When Stop is pressed
Then only the active thread's turn is interrupted
And no other running thread receives a cancel

### Scenario: Cancelling an OpenCode thread does not kill a sibling OpenCode thread
Given two OpenCode threads are both streaming
When the user stops one of them
Then only that thread's session/turn ends
And the other OpenCode thread keeps streaming (the `cancel()`-nulls-the-manager behaviour must not survive)

### Scenario: Cancelling a thread that has a pending approval
Given a thread is amber with an unresolved approval
When the user stops that thread
Then the pending request is discarded (not executed) and the badge clears
And no other thread's pending approvals are affected

---

## Feature: Thread creation and empty-thread hygiene (R10, R11)

### Scenario: Creating a thread while another runs
Given thread A is streaming
When the user presses "+" on the rail
Then a new empty thread is created, becomes active, and appears on the rail
And thread A keeps streaming with no teardown, reset, or reload
And thread A's icon still shows a spinner

### Scenario: Pressing "+" twice does not stack blank threads
Given an empty thread already exists on the rail
When the user presses "+" again
Then no second empty thread is created
And the existing empty thread is refocused

### Scenario: Switching away from an empty thread auto-discards it
Given the user creates an empty thread and types nothing
When the user switches to a different thread
Then the empty thread disappears from the rail
And nothing is written to History for it

### Scenario: An empty thread with a prompt sent is no longer empty
Given the user creates an empty thread and sends a prompt in it
When the user switches to another thread
Then the thread stays on the rail (it is no longer empty) and continues its turn

### Scenario: New thread does not inherit anything from the previous one
Given thread A has a long conversation and a composer draft
When the user creates a new thread with "+"
Then the new thread's transcript is empty and its composer draft is empty
And thread A's transcript and draft are untouched

---

## Feature: Closing threads and the soft cap (R11, R12)

### Scenario: Closing an idle thread keeps the conversation in History
Given an idle thread with a completed conversation
When the user hovers its icon and clicks ×
Then the thread is removed from the rail and its live agent session is torn down
And the conversation is still listed in History with its full message content

### Scenario: A closed conversation can be reopened onto the rail
Given a conversation was closed and appears in History
When the user opens it from History
Then it returns to the rail as an open thread with its full transcript
And it becomes the active thread
And no other thread is reset, cancelled, or destroyed

### Scenario: A running thread offers no close affordance
Given a thread is streaming
When the user hovers its rail icon
Then no × is shown (the spinner slot is occupied and closing is not offered)
And there is no keyboard or context-menu path to close it while running

### Scenario: An approval-waiting thread offers no close affordance
Given a thread shows an amber dot
When the user hovers its rail icon
Then no × is shown
And the thread can only be closed after the pending item is resolved or the turn is stopped

### Scenario: Hitting the 5-thread soft cap
Given 5 threads are open on the rail
When the user presses "+"
Then no 6th thread is created silently
And the user is prompted to close an idle thread first

### Scenario: Closing an idle thread at the cap frees a slot
Given 5 threads are open and at least one is idle
When the user closes the idle thread and presses "+"
Then a new empty thread is created normally

### Scenario: Rail scrolls on overflow
Given enough threads are open that their icons exceed the visible rail height
Then the rail scrolls
And "+" stays pinned at the top and History stays pinned at the bottom, outside the scrolling region

### Scenario: [RESOLVED GAP — spec.md §2] Soft cap reached with no idle thread
Given 5 threads are open and ALL of them are running or approval-waiting
When the user presses "+"
Then the expected behaviour is undetermined (refuse with explanation vs allow an explicit 6th)

### Scenario: [RESOLVED GAP — spec.md §3] Reopening from History at the cap
Given 5 threads are already open
When the user opens a closed conversation from History
Then whether the cap prompt applies to reopen (as it does to "+") is undetermined

### Scenario: [RESOLVED GAP — spec.md §4] Closing a thread that has a queued prompt
Given a thread has no turn in flight but has a prompt sitting in its composer queue
When the user hovers its rail icon
Then whether a × is offered — and whether closing warns about discarding the queued prompt — is undetermined

---

## Feature: Rail anatomy and layout (R6, R9)

### Scenario: The rail does not extend over the composer
Given the AI sidebar is open with several threads
When the layout is inspected at any sidebar width
Then the rail spans the messages area only
And the composer runs full width below both the messages area and the rail

### Scenario: "+" is at the top and History at the bottom, title bar carries neither
Given the AI sidebar is open
Then "+" is pinned at the top of the rail and History is pinned at the bottom, just above the composer boundary
And the sidebar title bar contains no new-thread button and no History button

### Scenario: Active thread shows an indigo pill and nothing else
Given three threads are open and the second is active
Then the second icon has an indigo-soft pill background
And no left emphasis bar, divider, or other active-state chrome is rendered anywhere on the rail

### Scenario: All threads share the robot glyph, tinted by runtime
Given a Claude thread, a Codex thread, and an OpenCode thread are open
Then all three icons are the same Phosphor `robot` glyph
And they are tinted `#D97757`, `#10A37F`, and `#0EA5E9` respectively
And the same colours appear in each thread's conversation meta row above agent replies

### Scenario: Hover tooltip states title and status
Given a thread titled "Translate memo" is waiting on an approval
When the user hovers its rail icon
Then the tooltip reads the thread title plus its status (e.g. "Translate memo — needs approval")

### Scenario: No named-list variant at any width
Given the sidebar is dragged from its narrowest to its widest usable width
Then the icon rail remains the only thread switcher at every width
And no named list or wide variant appears

### Scenario: Dark mode keeps identical structure and status language
Given the app is in dark mode (Deep Space)
Then the rail anatomy, badge slots, spinner-vs-amber language, and runtime colours are unchanged
And only the surrounding surface and ink colours differ

---

## Feature: Per-thread composer and queue (R14)

### Scenario: A queued prompt in thread A does not fire in thread B
Given thread A is running and the user presses Enter to queue a follow-up prompt in thread A
When the user switches to idle thread B
Then thread B's composer is empty and shows Send, not the queued prompt
And when thread A's turn completes, the queued prompt fires in thread A only

### Scenario: Composer state swaps with the active thread
Given thread A has a half-typed draft and thread B has a queued prompt
When the user switches from A to B and back to A
Then each thread shows its own draft and its own queue notch, with nothing lost or swapped

### Scenario: Sending to a different idle thread starts immediately
Given thread A is running
When the user switches to idle thread B and sends a prompt
Then thread B starts immediately
And nothing is added to any queue

### Scenario: Send guards are per-thread, not global
Given thread A is running
When the user switches to idle thread B
Then thread B's composer is enabled and shows Send
And the fact that thread A is running does not disable input anywhere else

### Scenario: Stop/Send button reflects the active thread
Given thread A is running and thread B is idle
When the user switches between them
Then the composer button reads Stop while A is active and Send while B is active
And the footer shows each thread's own runtime and model

### Scenario: Queuing within one busy thread still works (regression guard)
Given a thread is running
When the user presses Enter twice with two follow-up prompts
Then both are queued for that thread and fire in order after the current turn
And the pre-Sprint-99 within-thread queue behaviour is otherwise unchanged

---

## Feature: Persistence and restart (R13)

### Scenario: Relaunch with three open threads restores the rail
Given three threads are open in a workspace and the app is quit and relaunched
When the AI sidebar opens
Then all three threads are back on the rail in creation order, with their titles and runtime tints
And each transcript restores immediately without starting any agent process

### Scenario: Sessions re-attach lazily on next prompt
Given threads are restored after relaunch
Then no agent session is started at launch
When the user sends a prompt in one restored thread
Then only that thread's session is established

### Scenario: A mid-flight turn at shutdown shows as interrupted
Given a thread was streaming when the app was quit
When the app relaunches and that thread is opened
Then the turn is marked interrupted in the transcript
And it does not silently resume
And the thread's rail icon shows no spinner

### Scenario: A pending approval at shutdown does not restore as a live card
Given a thread had an unresolved approval when the app was quit
When the app relaunches
Then no stale, un-actionable approval card is presented
And the turn shows as interrupted instead
And the thread's icon is not amber

### Scenario: Open-thread set is per workspace
Given workspace X has three open threads and workspace Y has one
When the user opens each workspace in turn
Then each shows its own open-thread set on the rail, with no leakage between them

### Scenario: Pre-Sprint-99 conversations still load
Given conversations saved by an earlier version exist in localStorage
When the app is updated and opened
Then those conversations appear in History intact and can be reopened onto the rail

### Scenario: [RESOLVED GAP — spec.md §5] Retry affordance on an interrupted turn
Given a thread's turn is marked interrupted after relaunch
Then whether the transcript offers a retry/resume action or is purely informational is undetermined

### Scenario: [RESOLVED GAP — spec.md §8] Restored thread whose runtime will not start
Given a persisted thread's runtime binary is missing or fails to start after relaunch
Then whether the thread stays on the rail as a read-only transcript or drops to History is undetermined

---

## Feature: History as archive (R12)

### Scenario: History lists open and closed conversations, open ones badged
Given two threads are open and four other conversations exist
When the user opens History from the rail bottom
Then all six are listed
And the two open ones carry an "open" badge

### Scenario: Clicking an open conversation just switches to it
Given a conversation is currently open on the rail
When the user clicks it in History
Then the sidebar switches to that thread
And no session is restarted and no transcript is reloaded destructively

### Scenario: History no longer destroys the current conversation
Given a thread is streaming
When the user opens a different conversation from History
Then the streaming thread keeps streaming on the rail
And the old load-one-destroy-current behaviour does not occur

---

## Feature: Message routing correctness (R5, R7)

### Scenario: Every agent message carries a conversationId
Given any agent turn on any runtime
When webview↔host traffic is inspected
Then every `agent-execute`, `agent-cancel`, `agent-approve`, `agent-progress`, `agent-result`, `codex-*`, and `agent-approval-request` message carries a `conversationId`

### Scenario: A message with an unknown conversationId is dropped, not misrouted
Given the webview receives a message whose `conversationId` matches no open conversation
Then the message is discarded with a logged warning
And it is NOT appended to the active conversation's transcript

### Scenario: Per-conversation abort controllers
Given two threads are running
When one is cancelled
Then only that conversation's `AbortController` is aborted
And the other conversation's controller is untouched

---

## Feature: Feature-flag kill-switch (R15)

### Scenario: Flag is ON by default
Given a fresh install
Then `parallelChats` is enabled on all platforms
And the thread rail and parallel behaviour are available without any configuration

### Scenario: Flag off falls back to single-conversation behaviour
Given `parallelChats` is disabled in code
When the AI sidebar is opened
Then the sidebar behaves as a single-conversation sidebar without crashing
And stored conversations are not corrupted or deleted

### Scenario: [RESOLVED GAP — spec.md §6] Flag flipped off with several threads persisted
Given a user has four persisted open threads and the flag is disabled in a follow-up release
Then which conversation becomes "the" single conversation, and whether the others remain reachable via History, is undetermined

---

## Feature: Non-goals hold (Non-Requirements)

### Scenario: No cross-thread context
Given thread A discussed a specific file and thread B is on the same runtime
When the user asks thread B about what thread A discussed
Then thread B has no knowledge of thread A's conversation (issue #97 is not resolved by this sprint)

### Scenario: One thread still runs one turn at a time
Given a thread is mid-turn
When the user sends another prompt in that same thread
Then it queues for that thread rather than starting a second concurrent turn in it

### Scenario: Flows do not appear on the rail
Given a Ritemark Flow is running
Then no thread icon appears on the rail for it
And flow behaviour is unchanged by this sprint

### Scenario: No global activity centre
Given several background threads are running and one is amber
Then the only aggregate signal is the rail's per-thread badges
And no notification centre, activity panel, or global background-work overview exists (issue #140 is not resolved by this sprint)

### Scenario: No queue management actions
Given a thread has two queued prompts
Then the user cannot edit, reorder, promote, or remove them (issue #95 is not resolved by this sprint)

---

*Derived from the Jarmo-approved [`design.md`](design.md) (2026-07-21). Scenarios marked [RESOLVED GAP] cover behaviour design.md did not determine; the decision and reasoning for each are in `spec.md` § Resolved Design Gaps.*
