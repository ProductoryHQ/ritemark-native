# Sprint 128 Scenarios

**Spec:** [spec.md](./spec.md) · Each scenario is a unit test over a recorded or hand-built SDK message sequence (U), a dev-instance check with a real background subagent (D), or both. "Msg" names the SDK message in plain terms; shapes are in [technical-plan.md](./technical-plan.md#sdk-messages-consumed).

Legend: **U** = unit test (fake `_queryStream`), **D** = dev instance with Claude credentials, **P** = Phase 0 probe.

## R1 — Cards resolve to the truth

**S1 (U, D) Foreground agent completes on its hand-back.**
Given a human turn where Claude calls the Agent tool in the foreground, and the card is running.
When the Agent tool result arrives in a user message.
Then the card shows finished (from that result), without waiting for any notification.

**S2 (U, D) Background agent: the "launched" result does not finish the card.**
Given Claude calls the Agent tool and the task is a background task (input `run_in_background: true`, or default background).
When the tool result "Async agent launched successfully" arrives.
Then the card stays running and shows "Running in the background".

**S3 (U, D) Background agent completes on its notification, matched by `tool_use_id`.**
Given a running background card with `tool_use_id = toolu_A` and `task_id = ac2d…`.
When a task notification `status: completed, tool_use_id: toolu_A, task_id: ac2d…` arrives (even after the turn's result).
Then the card with id `toolu_A` shows finished with the notification's summary.

**S4 (U) Notification without `tool_use_id` falls back to `task_id`.**
Given a card created from `task_started` with `task_id = X` and no `tool_use_id`.
When a notification with `task_id = X` and no `tool_use_id` arrives.
Then that card finishes.

**S5 (U) Failed and stopped tasks are not shown as done.**
Given running cards.
When notifications arrive with `status: failed` and `status: stopped`.
Then the cards show failed and stopped respectively, with the summary, and neither shows the done check.

**S6 (U) Task update and progress.**
Given a foreground card.
When `task_updated` reports `is_backgrounded: true`, then `task_progress` arrives with tokens, tool-use count and a last tool.
Then the card shows background state and the detail, and the main feed gets no extra row for the progress.

**S7 (U) Ambient tasks are ignored.**
Given `task_started` with `ambient: true` and a `background_tasks_changed` payload that contains an ambient task.
Then no card is created, the live set excludes it, and the status line never counts it.

## R2 — The turn end says what is still running

**S8 (U, D) Observed case: done with a task still running.**
Given the human turn of S2 ends with its `result` and the live set has 1 task.
Then the status line reads "Done — 1 task still running in the background" (not "Done in 2m 24s"), and the card still shows running.

**S9 (U) The count follows the live set.**
Given 2 tasks in the live set after `result`.
When `background_tasks_changed` reports 1, then 0, and the session goes idle.
Then the line reads "…2 tasks…", then "…1 task…", then the normal done state of the newest turn, and the running chip shows the same numbers.

**S10 (U) Not amber, and not "Done" in the rail.**
Given a conversation whose turn ended with tasks running.
Then the conversation rail marks it as active-but-not-blocked (never the amber waiting colour), and `deriveActivityState` does not return `done`.

**S11 (U, D) Reload never shows a stale "still running".**
Given a persisted conversation with a turn that had running cards, and the session no longer exists (sidebar reload with a new extension host, app restart).
Then on load the cards show "Ended when the session closed" (not spinning) and the status line shows plain done or stopped.

## R3 — Events survive past `result`; no stray interrupt

**S12 (U) Task messages after `result` reach the webview.**
Given the turn resolved on its `result`.
When `task_updated`, `task_notification` and `background_tasks_changed` arrive afterwards.
Then each is delivered through the conversation-scoped channel (host posts `agent-progress` / `agent-background-tasks` for that conversation), and none is dropped.

**S13 (U) The card is found in an earlier turn.**
Given turn 1 with a background card, turn 2 (a human turn) is the newest, and the notification for turn 1's card arrives.
Then turn 1's card finishes, and turn 2's activity is unchanged.

**S14 (U) The idle timer never interrupts an idle session.**
Given a human turn resolved on `result` with `timeoutMinutes = 15`, and background messages arrive after it.
When the (fake) clock runs past 15 minutes with nothing else happening.
Then `interrupt()` is never called and no progress is emitted. While a human or a runtime-initiated turn is open, the timer still fires after 15 minutes of silence and interrupts it.

## R4 — A runtime-initiated turn is a real turn

**S15 (U, D) The follow-up turn appears.**
Given the state of S8.
When a user message with origin `task-notification` arrives and the session streams assistant text, a Write of a new Markdown file and an Edit, then a result with origin `task-notification`.
Then the host opens a new turn (`agent-turn-started`, origin `background-task`) before the first streamed activity; the activity feed shows "Writing: file.md" and "Editing: file.md"; `agent-result` carries the final text and the written file in `filesModified`; the explorer is refreshed; the turn is completed in the conversation store; the status line ends at the normal done state.

**S16 (U) Several completions queued together.**
Given two notifications queue, producing one empty result (`num_turns: 0`) and one real result.
Then exactly one runtime-initiated turn is shown (for the real result) and no empty turn is left behind.

**S17 (U) Persistence and context.**
Given the turn of S15 completed.
When the conversation is reloaded or reopened, or a context pack is built for a fallback transcript.
Then the runtime-initiated turn is shown in history with its origin and its answer, and the pack carries the answer text as assistant content but no user line for it.

## R5 — Results belong to the right turn

**S18 (P, U) Human prompt during a hidden follow-up turn — the audit's unverified risk.**
Given a runtime-initiated turn is streaming (notification seen, no result yet).
When the user sends a prompt.
Then Phase 0 probe P3 records whether the CLI folds it into the running turn, queues it, or interrupts. The unit test replays the recorded sequence and asserts that the human turn is resolved only by a result with origin `human`, and the runtime-initiated turn only by a result with origin `task-notification`.

**S19 (U) Default rule: the human prompt waits.**
Given the same state as S18 and the default rule (open question 4).
Then the prompt is not enqueued to the SDK until the runtime-initiated turn's result or idle; the status line says "Waiting for Claude's background follow-up to finish"; after that the prompt runs normally and its result resolves its own turn.

**S20 (U) Result counter alone would have mis-resolved.**
Given a sequence where the result with origin `task-notification` arrives while `_consumerTurnId === _turnId` for a human turn.
Then the old counter logic is not used to resolve; the human turn stays open.

**S21 (U) Interrupt and timeout do not cross.**
Given a human turn interrupted, then a runtime-initiated turn starts, then a late `result` (origin `human`) from the interrupted turn arrives.
Then the late result resolves nothing and the runtime-initiated turn continues; and the reverse order (runtime-initiated interrupted, then human turn) also holds.

## R6 — Idle means all work finished

**S22 (U) Idle sweep.**
Given a card still running with no completion signal, and the live set empty.
When `session_state_changed: idle` arrives.
Then the card shows "Ended" (never the done check), and the status line recomputes.

**S23 (U) No session-state messages from the SDK.**
Given a recorded sequence without `session_state_changed`.
Then the same outcomes follow from `result` plus an empty live set, and S9 still holds.

## R7 — Stop one task

**S24 (U, D) Stop one of two.**
Given two running background cards.
When the user presses the stop button on one.
Then the card shows "Stopping…", the host calls `stopTask` with that card's `task_id`, the `stopped` notification arrives, the card shows stopped, and the other card keeps running.

**S25 (U) Stop does not end the turn or session.**
Given the stop of S24.
Then no `interrupt()` and no `close()` happens, and Claude's follow-up turn after the stop is shown as a runtime-initiated turn.

**S26 (U) A stop that does not take.**
Given `stopTask` rejects, or no notification arrives within the bound.
Then the card shows "Couldn't stop this task" and the button is usable again.

## R8 — Stop of the main turn is honest

**S27 (U, D) Stop with tasks running.**
Given a human turn with a running background card.
When the user presses Stop.
Then the SDK is asked to interrupt with `perTaskStopAffordance` declared, the turn ends as Stopped, the background task keeps running, and the status line reads "Stopped — 1 task still running in the background".

**S28 (U) Cancel intent does not leak.**
Given S27, then a runtime-initiated turn starts.
Then that turn is not marked cancelled.

## R9 — No silent kill of live background work

**S29 (U, D) Model switch asks first.**
Given a running background task and the user picks another model.
Then a dialog says "Switching to this model ends 1 running background task. Switch anyway?"; Cancel keeps the model and the session; Switch ends the session and the conversation shows "1 background task ended with the session."

**S30 (U) Forced disposal says so.**
Given a running background task and the session is disposed by the error path or an authentication failure.
Then the conversation records "1 background task ended with the session." and the cards close as stopped/ended.

**S31 (U) No tasks, no question.**
Given an empty live set.
Then a model switch and a disposal happen exactly as today, with no dialog and no extra line.

## R10 — Interface grows only optionally

**S32 (U) Other runtimes untouched.**
Then the extension typecheck passes with Codex and ACP sources unchanged, their tests are green and unmodified, and `runtime/capabilities.ts` reports `backgroundWork: true` for Claude Code only.

## R11 — Language and surfaces

**S33 (D) Copy and surfaces.**
Walking S8, S15, S24, S27, S29: every string matches the copy table, none contains a protocol name, no new panel/banner/toast appears, and the only new control is the stop button on a card.

**S34 (D) Narrow widths.**
At 300, 250 and 223 px side-bar widths the status line and card (with the stop button) stay single-line (truncated with a tooltip carrying the full text) and nothing overlaps; the stop button has a tooltip in every state, including disabled.

## Edge cases to keep in the matrix

- Two conversations with background tasks at once: events route by conversation id (covered by S12/S13 run for two ids).
- Plan mode / Ask mode inside a runtime-initiated turn: approval cards appear and block that turn only.
- A runtime-initiated turn that raises an error: shown as a failed turn; the session follows the existing error disposal rule (R9 applies).
- Intentionally untested (needs credentials we do not have in CI): long real subagent runs, multi-minute timing, Windows. Named in the technical plan.
