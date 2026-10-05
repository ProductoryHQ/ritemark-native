# Sprint 128 Spec — Background agent turns

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.13.0](../release-plan.md) · **Evidence:** [research/background-subagents-audit.md](./research/background-subagents-audit.md)

## Purpose

When Claude Code delegates to background subagents, the Ritemark sidebar must show the truth: which tasks run, which finished, whether the turn is really over, and what Claude did when it came back on its own. The user can stop one task. Nothing that Claude did is hidden.

## Principles

- **Never hide that work is still running.** A status of "Done" requires that nothing is running.
- **No guessed completion.** A card finishes on an SDK signal, or is closed as "ended" by the idle sweep. It is never finished by assumption.
- **The runtime tells us, we do not poll.** Use the SDK's own task, origin and session-state messages (SDK 0.3.289). No timers that guess.
- **Reuse existing surfaces.** Subagent card, activity status line, activity feed. The only new control is the stop button on an existing card (shadcn `Button` + `Tooltip`).
- **Plain language.** No "task_notification", "origin", "tool_use". The user reads "task", "background", "Claude is continuing".
- **Additive interface.** The shared runtime contract only grows optional members; Codex and OpenCode are untouched.

## Terms

- **Background task** — a subagent (or shell/monitor task) the Claude Code process runs after the turn that started it may have ended.
- **Card** — one `SubagentCard` in the turn that started the task. Keyed by `tool_use_id`; when a task has none, by `task_id`.
- **Live set** — the non-ambient tasks of the latest `background_tasks_changed` payload (replace semantics).
- **Human turn** — a turn that answers a prompt the user sent (`origin.kind === 'human'`).
- **Runtime-initiated turn** — a turn the Claude Code process starts by itself when background work settles (`origin.kind === 'task-notification'`).
- **Idle** — `session_state_changed` with `state: 'idle'`: the SDK's authoritative "turn over, nothing held back, background loop exited" signal.

## Requirements

### R1: Cards resolve to the truth

As a user, I want each subagent card to show running, finished, failed or stopped correctly, so I can tell what happened.

Acceptance criteria:
- A card is created on the Agent tool call (id = `tool_use_id`) and, for a task the SDK reports without a matching card, on `task_started` (id = `tool_use_id` when present, else `task_id`).
- `task_started` records the `task_id` ↔ `tool_use_id` pair, whether the task runs in the background (`is_backgrounded`), its type and description.
- `task_notification` resolves the card by `tool_use_id` with `task_id` as fallback, and carries the status (`completed` / `failed` / `stopped`) to the card. A `failed` or `stopped` task is never shown as done.
- `task_updated` moves a card between running, finished, failed, killed and paused. A foreground task that moves to the background (`patch.is_backgrounded`) is marked as background.
- `task_progress` adds live detail (last tool, token and tool-use counts, summary when present) to the card without adding a new row to the main feed.
- A **foreground** card completes when its Agent `tool_result` arrives. A background card does **not** complete on the "launched" tool result. When the SDK gives no evidence either way, the card stays running (P2) until a notification, an update, the idle sweep (R6) or the live set says otherwise.
- Ambient tasks (`ambient: true`) never get a card and never count.
- A result that finishes a card carries its summary text as today.

### R2: The turn end says what is still running

As a user, I want the end of a turn to tell me when work is still going.

Acceptance criteria:
- When a human turn's `result` arrives and the live set is not empty, the status line reads "Done — N task(s) still running in the background" instead of "Done in …", and it is not styled as a plain completion (the running tasks are visible, see R11).
- While tasks are running the same line is shown after the next idle or notification updates it: count changes follow the live set exactly.
- When the live set becomes empty and the session is idle, the status line shows the normal done state of the newest turn (the runtime-initiated turn when one ran).
- The per-card status and the status-line count never disagree: both derive from the same live set and card states.
- A conversation with running background tasks counts as "has activity" in the conversation rail the way a running turn does, but never as "waiting for you" (amber is only for blocked-on-the-user states).
- Reload or reopen of a conversation never shows a stale "still running": a persisted turn whose session no longer exists is shown with its cards closed as ended (S11).

### R3: Task events and the idle signal survive past `result`; no stray interrupt

As a user, I want to see tasks finish after the turn is over.

Acceptance criteria:
- Task, background-set and session-state messages are delivered to the host through a conversation-scoped channel that does not depend on a turn being open. After a turn's `result`, those messages still reach the webview.
- A message arriving after `result` never restarts the per-turn inactivity timer, and the timer never calls `interrupt()` on an idle session. The inactivity timer runs only while a human turn or a runtime-initiated turn is open.
- Events carry the conversation id and are applied to the card they belong to, even when that card's turn is no longer the newest turn (S13).
- Events for one conversation never reach another.

### R4: A runtime-initiated turn is a real turn

As a user, I want to see what Claude did when it continued on its own.

Acceptance criteria:
- When the Claude Code process starts a turn by itself (first signal: a user message with `origin.kind === 'task-notification'`; if the SDK stream does not expose that message, the first assistant activity while no turn is open, see technical-plan decision D1), the host opens a new turn in the same conversation and tells the webview (`agent-turn-started`, origin `background-task`).
- The turn shows one muted line where a user prompt normally sits: "A background task finished — Claude is continuing" (copy in the open questions). It never shows the raw notification text or any task output file path as a user message.
- Its streamed text, tool activity and plan activity use the existing progress path. Files it writes or edits are reported (`filesModified`), and the explorer is refreshed (`_refreshExplorerForAgentWrites`) exactly as for a human turn.
- Its `result` completes it like any turn: `agent-result`, a conversation-store checkpoint, `maybeDrainQueue`. It does not generate a conversation title (the title belongs to the first human exchange).
- It is persisted in the conversation record as a turn with its origin, so reload and history show it, and it is excluded from "what the user said" in model-context packs and fallback transcripts (it carries no user text) (S17).
- Approval and question cards raised inside it work as in a human turn, honouring the conversation's Ask/Auto mode.
- Several queued completions that produce empty results (`num_turns: 0`) open no empty turn.
- A result with no visible content (no text, no activity) from a runtime-initiated turn leaves no empty turn behind.

### R5: Results belong to the right turn

As a user, I want a reply never attached to the wrong prompt.

Acceptance criteria:
- Every user prompt Ritemark sends carries `origin: { kind: 'human' }`.
- A `result` is attributed by its `origin` first (`human` → the oldest unresolved human turn; `task-notification` → the open runtime-initiated turn), not by the counter alone. The counter remains only as a consistency check.
- A human prompt sent while a runtime-initiated turn is open is handled by one documented rule chosen from Phase 0 evidence (probe P3): by default it waits (host-side) until the runtime-initiated turn's result or idle before it is enqueued to the SDK, and the status line says so. If the probe shows the CLI never folds, the user may choose immediate send (open question 4).
- Under either rule, no human turn is resolved by a runtime-initiated turn's result, and no runtime-initiated turn's text is shown as the answer to a human prompt.
- Interrupt or timeout of a human turn does not mis-resolve a following runtime-initiated turn, and vice versa.

### R6: Idle means all work finished

Acceptance criteria:
- `session_state_changed: 'idle'` is consumed as the "all work finished" signal: running turns end, the idle sweep closes any card left running with no completion signal as "ended" (never "done"), and the status line recomputes from the live set.
- `running` and `requires_action` do not by themselves change the status line (waiting states keep their existing sources: approval, question and plan cards).
- If Phase 0 shows the SDK does not emit `session_state_changed` to this consumer, the same guarantees are met from `result` + an empty live set, with the difference documented in the technical plan.

### R7: Stop one task

As a user, I want to stop one background task without ending everything.

Acceptance criteria:
- The session declares `perTaskStopAffordance: true`.
- Each card whose task is running and stoppable shows a stop button (shadcn `Button` icon variant, tooltip "Stop this task") that sends `agent-stop-task` to the host, which calls `Query.stopTask(task_id)`.
- The button is disabled with a tooltip stating the reason while the stop is in flight, and the card shows "Stopping…" until the `task_notification` with `status: 'stopped'` arrives.
- A task that does not stop within a bounded time shows a plain failure ("Couldn't stop this task") and the button is usable again. No silent stuck state.
- Stopping a task never ends the session, the turn or other tasks. Claude's follow-up turn after a stop is handled as any runtime-initiated turn.
- Cards of tasks the SDK reports as not stoppable (or finished) have no stop button.

### R8: Stop of the main turn is honest

Acceptance criteria:
- With `perTaskStopAffordance`, the Stop button aborts only the current turn. After Stop, the status line reads "Stopped" plus, when the live set is not empty, "— N task(s) still running in the background".
- Stop during a runtime-initiated turn stops that turn the same way and its text states the same.
- The cancel-intent bookkeeping (`_noteCancelIntent`, `_consumeCancelIntent`) still marks the right turn cancelled, and never marks a later runtime-initiated turn cancelled.

### R9: No silent kill of live background work

Acceptance criteria:
- When the user chooses a different model (or any change that makes `applyConfig` recreate the Claude session) while the live set is not empty, the sidebar asks first: "Switching to this model ends N running background task(s). Switch anyway?" (shadcn `Dialog`; copy in open question 3). Cancel keeps the current model and session.
- Starting a new conversation, closing a conversation or disposing a session through a path the user chose (history delete, rail close) while tasks run names the effect in the existing confirmation when there is one; no new dialog is added for paths that have none.
- Forced disposal (error path, authentication failure, runtime exit, extension shutdown) ends the tasks, and the conversation records one plain line: "N background task(s) ended with the session." (the existing `session_reset` notice pattern).
- No path ends background tasks without either a prior choice or this line.

### R10: The shared runtime interface grows only optionally

Acceptance criteria:
- `RuntimeSessionConfig` gains optional conversation-scoped hooks; `RuntimeSession` gains an optional `stopBackgroundTask`. Both are optional; Codex and OpenCode implement nothing and are never called through them.
- `runtime/capabilities.ts` gains a `backgroundWork` capability (true for Claude Code only) that the webview uses for the stop button and the status wording. No runtime-id checks in the webview.
- Codex and ACP tests, files and behaviour are unchanged; `tsc` passes with them untouched.

### R11: Plain language, existing surfaces

Acceptance criteria:
- Every string is plain: no protocol names. Copy table in [technical-plan.md](./technical-plan.md#copy).
- No new panel, banner, toast or row type. New states live in the status line, the card and the activity feed.
- Every new button is a shadcn `Button` with a shadcn `Tooltip` (no native `title`, no hand-rolled `<button>`). The card header, which today is a hand-rolled `<button>`, becomes a shadcn `Button` because a stop button cannot be nested inside another button.
- Layout holds at the narrow side-bar widths the v1.13.0 composer work targets (300 px default, down to 223 px); buttons are single-line.
- Motion/colour follow `ritemark-design`: amber stays reserved for "blocked on you".

## Non-goals

- A task manager UI, a task list panel, or output viewing of a task's output file.
- Codex/OpenCode background-work support.
- Changing how Flows run agents.
- Disabling background subagents (option C).

## Resolved Questions

- *Which turn shows the answer to the observed case?* The runtime-initiated turn (R4), not the first turn.
- *Do foreground agents emit `task_notification`?* Unverified by the audit; R1 never depends on it (tool_result completes foreground cards).
