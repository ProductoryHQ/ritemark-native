# Sprint 128 Technical Plan

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md) · **Scenarios:** [scenarios.md](./scenarios.md) · **Tasks:** [tasks.md](./tasks.md)

**Changes architecture:** yes. Optional members on `AgentRuntime` types, three new host↔webview message types, and a conversation-event origin. The Sprint Architecture Gate requires `docs/development/architecture.md` to be updated before the sprint closes (T8.1). No patch, no binary, no esbuild external, no flag.

All paths are under `extensions/ritemark/` unless noted. Every file:line below was re-read on 2026-10-05 on `main` (`9975c828`); the audit's references held, with the corrections noted.

## Verified code facts

| Fact | Where |
|---|---|
| The session is long-lived: input generator, background consume loop, not closed at `result`. | `src/agent/AgentRunner.ts` `_createMessageStream` 1033–1044, `_startSession` 1048–1113, `_consumeLoop` 1120 |
| The turn emitter and resolver are per-turn and cleared at the first `result`. After that, `processAssistantMessage` and `processSystemMessage` run against `|| (() => {})`. | `_forceResolveTurn` 941–959; calls 1184 and 1198 |
| `result` is accepted when `_consumerTurnId === _turnId`; the counter advances when the SDK pulls the next prompt, not when the CLI starts a turn. A second `result` finds no resolver. | 1206–1257, 1036–1042 |
| Only `tool_progress` and `task_notification` are processed; `task_started`, `task_updated`, `task_progress`, `background_tasks_changed`, `session_state_changed`, and user messages are ignored. `origin` is never read. | 1191–1198, `processSystemMessage` 1650–1678 |
| The card is created with `subagentId: block.id` (`toolu_…`); completion emits `subagentId: message.task_id`; the store matches `sa.id === progress.subagentId`. They can never match. | `AgentRunner.ts` 1569–1583 and 1668–1677; `webview/src/components/ai-sidebar/store.ts` 2756–2795 |
| User messages are built without `origin`. | `buildUserMessage` 62 |
| `interrupt()` calls `Query.interrupt()` and force-resolves; `close()` closes the query (kills background tasks). No `perTaskStopAffordance` anywhere in `src/`. | 835–875, `_startSession` options 1069–1097 |
| **New finding.** `_resetTurnTimeout` runs on every non-`result` message. After the turn resolved, `_turnTimeoutMs` is still set, so a late `task_notification` or follow-up message starts a timer that, after `agentTimeout` minutes (default 15, `UnifiedViewProvider.ts:757`), calls `Query.interrupt()` on an idle session. Without `perTaskStopAffordance`, that kills surviving background tasks. Read from code, not reproduced. | `AgentRunner.ts` 1132–1134, 915–933 |
| The host's callbacks are per-turn closures gated by `isCurrentRuntimeTurn()` (a token replaced on every human prompt). `applyConfig` swaps in the newest closure set on every turn. A runtime-initiated turn therefore has no stable owner today. | `UnifiedViewProvider.ts` 662–674, 978–1055; `ClaudeCodeRuntime.ts` `applyConfig` 128–153 |
| `applyConfig` closes the Claude session on a model or declaration change; error and authentication paths call `_disposeRuntimeSession`. | `ClaudeCodeRuntime.ts` 131–153; `UnifiedViewProvider.ts` 1045–1054 |
| `completeRuntimeTurn` only completes a turn that has a matching `user-message` event (turn id + runtime id). A turn with no user message cannot be completed today. The event union has `user-message`, `assistant-message`, `activity`, `attention`, `boundary`, `dispatch-receipt`; schema version 1. | `src/conversations/ConversationController.ts` 453–546; `src/conversations/types.ts` 55–128 |
| `agent-result` patches the last agent turn with `requireRunning: false`; `agent-progress` patches with `requireRunning: true` (so progress after a result is dropped in the webview too). | `store.ts` 2742–2871, `patchLastAgentTurn` 536–567 |
| `deriveActivityState` ignores subagents; `ActivityStatusLine` shows a running chip only while `last.isRunning`. | `webview/src/components/ai-sidebar/activityState.ts` 32–76; `ActivityStatusLine.tsx` 36–41 |
| `SubagentCard`'s header is a hand-rolled `<button>`. | `SubagentCard.tsx` 34–62 |
| SDK 0.3.289 `sdk.d.ts` declares `perTaskStopAffordance` (1807, 4534), `Query.stopTask` (3219), `Query.backgroundTasks` (3234), `agentProgressSummaries` (2082, 4525), `SDKBackgroundTasksChangedMessage` (3707, replace semantics, `ambient`), `SDKSessionStateChangedMessage` (5861), `origin?: SDKMessageOrigin` on result and user messages (5721, 5807, 6237, 6325), `priority?: 'now'\|'next'\|'later'` on user messages (6236). `QueryHandle` in `src/agent/types.ts` 384 has no `stopTask` yet. | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` |
| An existing test pattern drives `_consumeLoop` over a fake async-iterable `_queryStream`. | `src/agent/AgentRunner.test.ts` 390–444 |
| No turn-completion toast or notification exists today. | `UnifiedViewProvider.ts` (only unrelated `showInformationMessage` uses) |

## Design

Naming: **D1–D7** are Phase 0 decision points (table below); the design sections are **Design A–H**.

### Phase 0 decision points (W0)

The plan fixes a default for each; Phase 0 either confirms or changes it before product code.

| # | Question | Default | If the probe says otherwise |
|---|---|---|---|
| D1 | Does the SDK stream hand the consumer a `user` message with `origin.kind === 'task-notification'` before the follow-up turn's assistant messages? (Audit saw it in the CLI transcript, not on the SDK stream.) | Yes; it is the start-of-turn signal. | If not: the start signal is the first assistant message or `stream_event` while no turn is open, and the origin of the turn is read from the closing `result.origin`. R4 holds; only the card of origin timing changes. Optionally request replay of user messages in the options if that is what exposes it. |
| D2 | Does `session_state_changed` reach this consumer without an extra option or env var? | Yes. | Use `result` + empty live set (S23) and record the reduced guarantee. If an option exists, enable it. |
| D3 | When a human prompt arrives during a runtime-initiated turn, does the CLI fold it in, queue it, or interrupt? | Unknown. Host serialises: the prompt waits until that turn's result or idle (S19). | If the CLI queues it cleanly and returns two `result`s with correct origins, offer immediate send (open question 4). If it folds it, serialisation stays mandatory. `priority: 'next'/'later'` is evaluated as a way to make the CLI queue it. |
| D4 | On the Agent tool_result of a background launch, is it distinguishable from a foreground hand-back? Candidates: tool_use input `run_in_background`, `task_started.is_backgrounded` arriving first, the `tool_use_result` payload, membership in `background_tasks_changed`. | Complete a foreground card on tool_result only when the card is not known to be backgrounded and not in the live set; otherwise wait for evidence (R1, P2). | If the order of `task_started` vs tool_result makes that unsafe, delay foreground completion until the next assistant message or the `result`. |
| D5 | Does a foreground `local_agent` also emit `task_notification`? | Not relied on (R1). | If yes, it simply provides a second completion signal. |
| D6 | Does `perTaskStopAffordance` work with the bundled CLI 2.1.289 through the TS SDK 0.3.289 in streaming-input mode (interrupt spares tasks; `stopTask` emits a `stopped` notification)? | Yes (documented). | Blocker: stop and tell Jarmo; fall back to documenting Stop as "ends background tasks too" (the status quo) and drop R7/R8 stop wording. |
| D7 | Conversation persistence form for the runtime-initiated turn (see Design E). Is an additive optional field tolerated by the current validator and by a downgraded client? | Additive optional `origin` on `UserMessageEventV1`. | If a downgrade would reject the record, use a separate `boundary`-like event only after a schema-version decision with Jarmo; do not ship a record older clients cannot read. |

### Design A — A conversation-scoped live channel (W1, W3)

Today everything the runtime reports rides on the per-turn closures. A runtime-initiated turn and post-`result` task events need an owner that survives turns.

- `RuntimeSessionConfig` gains one optional member, `live?: RuntimeLiveHooks` (`src/runtime/AgentRuntime.ts`):
  - `onBackgroundWork(update: BackgroundWorkUpdate)`: card/task events and the live set (replace semantics).
  - `onRuntimeTurnStart(turn: { origin: 'background-task' })`: a turn opened by the runtime.
  - `onRuntimeTurnProgress(progress: AgentProgress)`, `onRuntimeTurnComplete(result: RuntimeTurnResult)`.
  - `onIdle()`.
- The host builds `live` **once per conversation** in `UnifiedViewProvider` (a small `LiveHooksFor(conversationId)` helper), not per human prompt. It captures only the conversation id and reads the current `bindingGeneration` from the controller at call time. It never captures a turn token, so it is valid between human turns.
- `ClaudeCodeSession.applyConfig` keeps the latest `live`; `AgentSession` holds it as `_live` and replaces it from the same call.
- `RuntimeSession` gains optional `stopBackgroundTask?(taskId: string): Promise<void>` and optional `backgroundTasks?(): readonly BackgroundTaskInfo[]`. Codex and ACP sessions do not define them.

### Design B — Turn ownership in `AgentSession` (W1)

Replace "counter equality" with an explicit owner:

- `_owner: { kind: 'human'; turnId } | { kind: 'runtime'; seq } | null`.
- Human `sendMessage`: if `_owner` is a runtime turn, wait (decision D3) before enqueueing; then set owner `human` and enqueue a user message with `origin: { kind: 'human' }`.
- Stream start signal (D1/Phase 0): `user` message with `origin.kind === 'task-notification'`, or first assistant activity with `_owner === null`. Set owner `runtime`, call `_live.onRuntimeTurnStart`.
- `assistant`, `stream` and `tool_progress` messages are routed to the owner's emitter: the human turn's `_emitProgress` for `human`, `_live.onRuntimeTurnProgress` for `runtime`.
- `result`: read `result.origin?.kind`. `task-notification` (or owner `runtime`) → complete the runtime turn (`onRuntimeTurnComplete`) and set owner `null`; otherwise → the existing human-turn resolution. A `num_turns: 0` result with origin `task-notification` and no turn open produces nothing. The old counter stays as a consistency check (trace on mismatch); it no longer decides.
- Per-turn inactivity timer: starts only when an owner is set, is cleared when `_owner` becomes `null`, and is not restarted by messages that arrive while `_owner === null` (fixes the stray interrupt, R3).

### Design C — Task registry and live set (W1, W2)

`AgentSession` keeps `_tasks: Map<taskId, TaskInfo>` and `_toolUseToTask: Map<toolUseId, taskId>`:

- `task_started` → insert (type, description, `is_backgrounded`, `tool_use_id`, `ambient`); ambient tasks are recorded as ambient and never reported.
- `task_updated` → merge `patch`; `task_progress` → merge usage/last tool/summary; `task_notification` → terminal status.
- `background_tasks_changed` → replace the live set (non-ambient). `Query.backgroundTasks()` is not polled.
- The pure function `reduceTaskMessage(state, message): { state, events }` lives in a new small file `src/agent/backgroundTasks.ts` (state in, UI events out) so that it is unit-testable without a session. Events: `card-start`, `card-update`, `card-done {status}`, `live-set {tasks}`, `sweep`.
- Agent `tool_result` (user message with a `tool_result` block whose `tool_use_id` is a known Agent card): apply the D4 rule.
- `session_state_changed idle` → `sweep` (closes cards with no evidence as "ended") and `onIdle`.

`AgentProgress` gains optional fields: `taskId`, `subagentStatus: 'running' | 'completed' | 'failed' | 'stopped' | 'ended'`, `backgrounded: boolean`, `stoppable: boolean`, `usage`. `subagent_done` now uses `subagentId = tool_use_id ?? task_id`. A new progress type `subagent_update` carries `task_updated` / `task_progress`.

### Design D — Host: turn begin, stream, completion for a runtime-initiated turn (W3, W4)

In `UnifiedViewProvider`:

- `onRuntimeTurnStart` → `ConversationController.beginRuntimeInitiatedTurn({ conversationId, bindingGeneration, runtimeId: 'claude-code', origin: 'background-task' })`, which allocates a turn id and moves the lifecycle to `working`, then posts `agent-turn-started { conversationId, turnId, origin: 'background-task' }` and sets `_activeConversationTurnIds` for that conversation.
- `onRuntimeTurnProgress` → `agent-progress` (same message as today, same conversation id).
- `onRuntimeTurnComplete` → the same body as `onComplete` today: `agent-result`, `_refreshExplorerForAgentWrites`, `completeRuntimeTurn` with `generateTitle: undefined`. Factor that body into one private method used by both, so human and runtime-initiated completion cannot drift.
- A human prompt that arrives while a runtime turn is open: the host never starts a second concurrent turn. It returns to the existing busy/queue path (the webview already queues sends while a conversation is running, `maybeDrainQueue`), and the Claude session applies Design B's wait for the narrow race window before the webview learns of the turn.
- `agent-stop-task` message (webview → host): `findRuntimeSession(...).stopBackgroundTask(taskId)`. Rejection → `agent-progress` with `subagentStatus` unchanged plus a short error line on the card (S26).
- `agent-cancel` unchanged, except the cancel intent is consumed only for the human turn that was current when Stop was pressed (S28).

### Design E — Conversation record for the runtime turn (W4)

`ConversationController.completeRuntimeTurn` needs a turn that has a `user-message`. Default (decision D7): `beginRuntimeInitiatedTurn` appends a `user-message` event whose `text` is the fixed line "A background task finished — Claude is continuing", with an additive optional field `origin: 'background-task'` on `UserMessageEventV1`. Context packs (`buildNormalizedContextPack` and the fallback transcript) skip user-messages that carry an origin, so the line never reaches the model as something the user said, while the assistant answer stays in the pack. The webview, reading history, renders the line as the muted turn header. This reuses `completeRuntimeTurn`, `attentionRuntimeTurn`, projection and history unchanged. Validation (`types.ts` ~616 and the user-message validator) accepts the optional field. Phase 0 (D7) verifies a downgrade reads such a record; if it cannot, fall back to the alternative recorded in the table before writing any code.

### Design F — Webview (W5)

- `store.ts`:
  - `agent-turn-started`: append an `AgentConversationTurn` with `isRunning: true`, `origin: 'background-task'`, `userPrompt: ''`, the given turn id, and `trigger` label.
  - `agent-progress` for subagent types: find the card by id across **all** turns of the routed conversation (newest first) and patch it, with `requireRunning: false`. Non-subagent progress keeps patching the last running turn.
  - `agent-background-tasks`: store the live set per conversation (`backgroundTasks`), replace semantics.
  - persistence: `persistConversation` already runs on `agent-result`; also run it when the live set changes from non-empty to empty, so the final card states are saved. On load, any card with `status: 'running'` in a conversation with no live session is closed as "ended" (S11).
- `types.ts`: `AgentConversationTurn.origin?: 'human' | 'background-task'`; `SubagentProgress` gains `status: 'running' | 'done' | 'error' | 'stopped' | 'ended' | 'stopping'`, `backgrounded`, `taskId`, `stoppable`, `usage?`.
- `activityState.ts`: a new `ConversationActivityState` value `done-background` (computed when the newest turn is finished and the live set is non-empty); presentation: robot icon, accent tone, no spinner, label via the copy table with the count; `waiting-*` states still outrank it; amber unchanged. `isConversationRunning` is untouched, so a conversation with background tasks can still receive new human prompts (no lock).
- `ActivityStatusLine.tsx`: pass the live count; keep the running chip, but drive it from the live set instead of `last.isRunning`.
- `SubagentCard.tsx`: header becomes a shadcn `Button` (variant ghost, full width) so a sibling stop `Button` (icon, size sm) with a `Tooltip` ("Stop this task" / reason when disabled) can sit beside it, not nested. Shows "Running in the background", "Stopping…", the final status text and the one-line progress detail. No new component file.
- `AgentView.tsx`: a turn with `origin: 'background-task'` renders the muted trigger line instead of the user bubble.
- `runtime/capabilities.ts` + webview capability read: `backgroundWork` gates the stop button and the "still running" wording.

### Design G — Copy

| Where | Text |
|---|---|
| Status line, done, tasks left | "Done — 1 task still running in the background" / "Done — 2 tasks still running in the background" |
| Status line, stopped, tasks left | "Stopped — 1 task still running in the background" |
| Status line, human prompt waiting | "Waiting for Claude's background follow-up to finish" |
| Card, running in background | "Running in the background" |
| Card, stopping / stopped / ended / failed | "Stopping…" / "Stopped" / "Ended when the session closed" / "Failed" + the summary line |
| Stop button tooltip | "Stop this task"; disabled: "Stopping this task…" |
| Stop failed | "Couldn't stop this task" |
| Runtime-initiated turn header | "A background task finished — Claude is continuing" |
| Model-switch dialog | "Switching to this model ends 1 running background task. Switch anyway?" / "…ends 2 running background tasks…"; buttons "Switch" and "Keep current model" |
| Forced end line | "1 background task ended with the session." / "2 background tasks ended with the session." |

### Design H — Kill warnings (W6)

- Webview knows the live set. In the model-selection handler, when the target differs from the running session's model and the live set is non-empty, open one shadcn `Dialog` (existing `ui/dialog.tsx` pattern: `DialogContent`, `DialogHeader`, `DialogBody`, `DialogFooter`, `DialogButton`). Cancel leaves the selection unchanged.
- Host: `ClaudeCodeSession.applyConfig` knows `hadLiveSession`; add the count of live tasks to the existing `session_reset` notice ("1 background task ended with the session."). `_disposeRuntimeSession` / `disposeSession` paths on the error branch emit the same line before closing.
- Paths the user chooses (history delete, rail close, new chat) are confirmed by their existing dialogs; this sprint adds the count to the existing text only where such a confirmation exists (T6.5 lists them).

## SDK messages consumed

| Message | Fields used | Result |
|---|---|---|
| `system/task_started` | `task_id`, `tool_use_id?`, `description`, `subagent_type?`, `task_type?`, `is_backgrounded?`, `ambient?` | record, create card if none |
| `system/task_updated` | `task_id`, `patch.status`, `patch.is_backgrounded` | merge, card state |
| `system/task_progress` | `task_id`, `tool_use_id?`, `usage`, `last_tool_name?`, `summary?` | card detail |
| `system/task_notification` | `task_id`, `tool_use_id?`, `status`, `summary`, `usage?`, `ambient?` | card terminal state |
| `system/background_tasks_changed` | `tasks[].{task_id,task_type,description,ambient?}` | replace live set |
| `system/session_state_changed` | `state` | idle sweep + `onIdle` |
| `user` (tool_result block) | `tool_use_id`, `is_error?` | foreground card completion (D4 rule) |
| `user` | `origin.kind` | runtime-turn start (D1) |
| `result` | `origin.kind`, `num_turns` | ownership (D2) |
| `assistant`, `tool_progress` | `parent_tool_use_id` | routed by owner |

Options set: `perTaskStopAffordance: true`; `agentProgressSummaries: true` only if Phase 0 shows summaries are useful and cheap (default off, no extra cost).

## Files to change

| File | Change |
|---|---|
| `src/agent/AgentRunner.ts` | owner state machine, task registry call-out, `origin: human` on user messages, `perTaskStopAffordance`, `stopTask`, timer rework, post-`result` routing, user-message handling |
| `src/agent/backgroundTasks.ts` (new, small) | pure `reduceTaskMessage` + types; the only new source file |
| `src/agent/types.ts` | `QueryHandle.stopTask?`, SDK message fields, `AgentProgress` additions |
| `src/agent/ClaudeCodeRuntime.ts` | hold `live` hooks, `stopBackgroundTask`, `applyConfig` ending-tasks notice |
| `src/runtime/AgentRuntime.ts` | optional `live`, optional `stopBackgroundTask` / `backgroundTasks` |
| `src/runtime/capabilities.ts` | `backgroundWork` |
| `src/views/UnifiedViewProvider.ts` | per-conversation live hooks, shared completion body, `agent-stop-task`, cancel-intent scope |
| `src/conversations/ConversationController.ts`, `src/conversations/types.ts` (+ context-pack builder) | `beginRuntimeInitiatedTurn`, optional `origin`, packs skip it |
| `webview/src/components/ai-sidebar/store.ts`, `types.ts`, `activityState.ts`, `ActivityStatusLine.tsx`, `SubagentCard.tsx`, `AgentView.tsx`, model-switch handler | per Design F and H |
| `src/agent/AgentRunner.test.ts` (+ new `backgroundTasks.test.ts`, `webview/.../activityState.test.ts` extension) | tests, registered in `package.json` `test` scripts |
| `media/webview.js` | rebuilt (bundle freshness invariant) |
| `docs/development/architecture.md` | Sprint Architecture Gate update |

Codex and ACP sources are **not** edited.

## Test strategy

1. **Unit, SDK message streams (no credentials).** Drive `_consumeLoop` with a fake async-iterable `_queryStream`, as `AgentRunner.test.ts` already does, over fixtures in `src/agent/fixtures/background-subagents/`:
   - `foreground-agent.json`, `background-then-notification-turn.json` (the observed 2026-10-05 sequence: foreground agent, background launch, `result`, task notification user message, Write + Edit + final text, second `result`, `idle`), `two-queued-completions.json` (one empty `num_turns: 0` result), `stop-task.json`, `ambient-task.json`, `human-during-runtime-turn.json`, `no-session-state.json`.
   - Fixtures are hand-built from the audit and the SDK types **until** a real recording replaces them (T0.4). Each fixture names its provenance in a header field.
   - Pure tests for `reduceTaskMessage`, the owner machine, and the timer (fake clock for S14).
2. **Unit, host and conversation.** `ConversationController.beginRuntimeInitiatedTurn` and `completeRuntimeTurn` with the origin; context pack skips the line; `UnifiedViewProvider` pieces that are pure (the shared completion body) are tested via the existing patterns.
3. **Unit, webview (pure).** `activityState` for `done-background`, waiting precedence, rail attention; store reducers for `agent-turn-started`, cross-turn card patching, live set replacement, reload closing (`lifecycle.test.ts` pattern).
4. **Typecheck and bundle.** `npx tsc -p extensions/ritemark`, the webview typecheck, `npm test`, rebuild `media/webview.js`, pre-commit validator.
5. **Dev instance with a real background subagent.** Claude's Agent tool with `run_in_background`, run through S1, S2, S3, S8, S9, S15, S24, S27, S29, S33, S34 on a real session, with screenshots at the three side-bar widths. `ritemark.ai.debugTrace` on, so the real sequence is captured and replaces the hand-built fixtures.

## What cannot be proven without credentials

Unit tests prove Ritemark's handling of the message sequences we feed it. They cannot prove that the real Claude Code process produces those sequences. Needing a Claude subscription or API key and a real background subagent:

- D1 (is the notification `user` message on the SDK stream), D2 (`session_state_changed` delivered), D3 (CLI behaviour for a prompt during a follow-up turn), D4 (launch vs hand-back tool_result), D5, D6 (`perTaskStopAffordance` + `stopTask` against the bundled CLI).
- The timing of real runs: multi-minute background tasks, the 15-minute timer interplay, the real order of `task_started` vs the tool result.
- That the model actually continues after a stop, and what it writes.
- Windows behaviour of `stopTask` (a Windows machine, not available here).

These run on Jarmo's machine, or on a dev instance he lets us use; the plan marks every scenario as U or D accordingly, and the sprint closes with the D-items named as run or not run.

## Risks

- **R-A: the SDK stream may not expose what the audit saw in the CLI transcript** (D1, D2). Mitigated by Phase 0 and by designing the start signal and idle with fallbacks (S23).
- **R-B: serialising a human prompt behind a follow-up turn may feel slow.** Mitigated by showing the wait in the status line and by the open question; bounded by the length of the follow-up turn.
- **R-C: a conversation record with a new optional field.** Mitigated by D7 verification; no record older clients cannot read.
- **R-D: stop semantics differ per task type** (shell, monitor, workflow). `stoppable` comes from what the SDK reports; where unknown, no stop button rather than a broken one.
- **R-E: bundle churn.** `media/webview.js` rebuilds clash with other open PRs; rebase and rebuild before merge (the v1.13.0 practice).
