# Sprint 128 — Phase 0 findings

**Run:** 2026-10-05 on darwin-arm64, the bundled Claude Code 2.1.289 through `@anthropic-ai/claude-agent-sdk` 0.3.289 in streaming-input mode, Jarmo's own Claude login, model `sonnet`, a throwaway working directory, `bypassPermissions`. Script: [`probes/background-probe.mjs`](probes/background-probe.mjs); timelines with [`probes/summarize.mjs`](probes/summarize.mjs). Recordings in [`evidence/`](evidence/) (stream deltas, rate-limit events, `init` details, local paths and an unrelated account notice removed).

Each run asked Claude to launch one general-purpose subagent with `run_in_background: true` that runs `sleep 25; echo BG-DONE`, reply "launched", and report "final: …" when it finishes.

| Run | What it did | Recording |
|---|---|---|
| P1 | Observe the whole sequence with the input stream kept open | `evidence/p1.jsonl` |
| P3 | As P1, plus a human prompt (`origin: human`) sent the moment the follow-up turn opens | `evidence/p3.jsonl` |
| P6 | `perTaskStopAffordance: true`; `Query.interrupt()` 4 s after the task started | `evidence/p6.jsonl` |
| P6stop | `perTaskStopAffordance: true`; `Query.stopTask(taskId)` 4 s after the task started | `evidence/p6stop.jsonl` |

## Observed sequence (P1)

1. `system/init` → `assistant` with `tool_use` Agent (`run_in_background: true`).
2. `system/background_tasks_changed` (live set, replace semantics) and `system/task_started` with `task_id`, `tool_use_id`, `is_backgrounded: true`, `task_type: "local_agent"` — **before** the Agent `tool_result`.
3. `user` with the Agent `tool_result` (the launch acknowledgement), the "launched" text, `result` with `origin: { kind: "human" }`.
4. After the `result`, the subagent's own messages keep arriving (`assistant`/`user` with `parent_tool_use_id` = the Agent tool_use id), plus `task_progress` for the agent and `task_started` / `task_notification` for the Bash tasks it runs (`owned_by_subagent: true`, `task_type: "local_bash"`).
5. `task_updated` (`patch.status: "completed"`) and `task_notification` (`status: "completed"`, `tool_use_id`) for the agent, `background_tasks_changed` with an empty set.
6. A fresh `system/init`, then top-level `assistant` "final: BG-DONE", then `result` with `origin: { kind: "task-notification", producer: "session-task" }`.

## Decisions

| # | Question | Finding | Decision |
|---|---|---|---|
| D1 | Is there a `user` message with `origin.kind: "task-notification"` that opens the follow-up turn? | **No.** No such message reaches the SDK consumer. The follow-up turn opens with a fresh `system/init` after a `result`; its `result` carries `origin.kind: "task-notification"`. | Start signal = `system/init` arriving while no turn is open, or the first **top-level** (`parent_tool_use_id` null) assistant message while no turn is open. Messages with a `parent_tool_use_id` never open a turn. The origin is confirmed from the closing `result.origin`. |
| D2 | Is `session_state_changed` delivered? | **No, not by default.** The CLI emits it only when the environment variable `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS` is set (read from the 2.1.289 binary; not in the public docs). | Do not depend on it. "All finished" = the last `result` with an empty live set from `background_tasks_changed` (S23's fallback becomes the rule). Handle `session_state_changed` if it ever arrives. |
| D3 | A human prompt during the follow-up turn: fold, queue or interrupt? | **Queued by the CLI.** The follow-up turn finishes with its own `result` (`task-notification`), then a new `init`, the human answer, and a `result` with `origin: human`. Nothing is mixed. | Results are attributed by `result.origin`. Jarmo approved the default: the host still holds the prompt until the follow-up turn's `result` (simplest, no overlapping turns in the UI); the status line says so. |
| D4 | Background launch vs foreground hand-back on the Agent `tool_result`? | `task_started` with `is_backgrounded: true` for that `tool_use_id` always arrives **before** the launch `tool_result`. | A card whose task is known to be backgrounded ignores its Agent `tool_result`; any other Agent card completes on its `tool_result`. |
| D5 | Do foreground tasks emit `task_notification`? | **Yes** for a foreground Bash (`is_backgrounded: false`, `status: completed`). | Second completion signal; harmless. |
| D6 | Does `perTaskStopAffordance` work through the TS SDK with the bundled CLI? | **Yes.** P6: `interrupt()` left the background task alive; it finished and Claude continued with a follow-up turn. P6stop: `stopTask` stopped the agent and the Bash it owned (`task_notification status: "stopped"` for both), then Claude continued with a follow-up turn on its own. | Not a blocker. R7 and R8 proceed. Note: a stopped task still triggers a follow-up turn. |
| D7 | Does an additive optional `origin` on a `user-message` event break older clients? | `decodeConversationEventV1` (`src/conversations/types.ts` ~372) builds the event from known fields and ignores unknown keys, so a previous release reads the record and drops the field. It would show the header line as a plain user message. | Additive optional field, as planned. |

## Other findings

- **A task can restart under the same id.** In P3 and P6 the subagent first returned an interim result (it had backgrounded its own Bash), got `task_notification completed`, and was later resumed: `task_started` again with the same `task_id` and `tool_use_id`, then a second `completed`. A card must go back to running when its task starts again.
- **Nested tasks.** A subagent's own Bash tasks appear in `task_started` (`owned_by_subagent: true`) and in the live set. Cards are only for `local_agent` tasks; the "still running" count includes every non-ambient task in the live set, since the user's work is still running either way.
- **`background_tasks_changed` entries** carry `task_id`, `task_type` and `description` only.
- **Other messages** seen after a `result`: `task_summary`, `post_turn_summary` (`status_category`, `status_detail`). Not used this sprint.

## Not run

- **T0.6** (the 2026-10-05 sequence again in a dev instance with `ritemark.ai.debugTrace`): not needed. P1 records the same sequence class from the SDK stream directly, and those recordings replace the hand-built fixtures.
- **T0.9** (stray-interrupt timer): covered by a unit test with a short `agentTimeout` during W1.
- Windows behaviour of `stopTask`; multi-minute tasks; the 15-minute timer against a real session.
