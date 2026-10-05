# Background subagents in Ritemark's Claude sidebar — research

Date: 2026-10-05 · SDK `@anthropic-ai/claude-agent-sdk` 0.3.289 (bundled CLI 2.1.289) · read-only research, no repo edits.

## TL;DR

What happened in Jarmo's session is now clear from the CLI transcript of that session
(the Claude Code session transcript under `~/.claude/projects/`; path withheld):

| Time (UTC) | What the CLI did | What Ritemark showed |
|---|---|---|
| 07:00:32 | user prompt | turn starts |
| 07:00:55 | `Agent` "Find training material" (**foreground**, `toolu_01UPUn…`) | card + spinner |
| 07:01:42 | foreground agent's `tool_result` (the hand-back) arrives | **nothing**: spinner keeps spinning |
| 07:02:09 | `Agent` "Verify desktop app facts" with `run_in_background: true` → "Async agent launched successfully", task id `ac2dcd48a5728a433` | card + spinner |
| 07:02:55 | assistant text "…käib veel taustal…", turn ends → `result` | **"Done in 2m 24s"** (07:00:32→07:02:55) |
| 07:05:30 | CLI injects `<task-notification>` (user msg, `origin.kind: 'task-notification'`) and **starts a new model turn by itself** | **nothing** |
| 07:07:21 – 07:07:43 | that turn **Writes a new Markdown file**, Edits it, and posts the final answer (Estonian; text withheld) → second `result` | **nothing**: dropped |

The file really exists on disk (mtime matches). So the work **did finish and the main agent did come back on its own**, but Ritemark threw away the whole follow-up turn: the answer, the progress, the file-change notice and the spinner updates. Both spinners never stop because of an ID mismatch, and for the foreground card there is no completion handler at all.

## 1. How it works (official sources)

**Background is the default now.** From the Agent SDK subagents doc (https://code.claude.com/docs/en/agent-sdk/subagents): "Subagents run in the background by default. An Agent tool call that omits the `run_in_background` input launches a background subagent, and Claude sets `run_in_background: false` when it needs the result before continuing." `AgentDefinition.background: true` forces background. Fork mode is off in the SDK, so Claude picks foreground or background for each call (https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background). `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` forces every subagent into the foreground.

**How completion is delivered.** From the sub-agents doc: "A background subagent's results reach Claude as a completion notification in a later turn. Claude waits for that notification before reporting the subagent's results". The main agent does **not** watch or poll the subagent. Its turn ends, and the CLI re-invokes it with a synthetic turn when the task settles.

**On the SDK stream** (TS reference, https://code.claude.com/docs/en/agent-sdk/typescript, and `sdk.d.ts`):
- `SDKTaskStartedMessage` (`type:'system', subtype:'task_started'`): fields `task_id`, `tool_use_id?`, `description`, `subagent_type?`, `task_type?` (`local_agent` | `local_bash` | `remote_agent` …), `is_backgrounded?`, `spawn_depth?`, `ambient?` (sdk.d.ts ~6048).
- `SDKTaskProgressMessage` (`task_progress`): `task_id`, `tool_use_id?`, `usage{total_tokens,tool_uses,duration_ms}`, `last_tool_name?`, `summary?` (the summary needs the option `agentProgressSummaries: true`).
- `SDKTaskUpdatedMessage` (`task_updated`): `patch.status` 'pending'|'running'|'completed'|'failed'|'killed'|'paused', `patch.is_backgrounded` (a foreground task moved to the background).
- `SDKTaskNotificationMessage` (`task_notification`): `task_id`, **`tool_use_id?`**, `status: 'completed'|'failed'|'stopped'`, `reason?: 'worker_restart'`, `output_file`, `summary`, `usage?`, `ambient?` (sdk.d.ts 5993). Docs: "Notification when a background task completes, fails, or is stopped".
- `SDKBackgroundTasksChangedMessage` (`background_tasks_changed`): `tasks[]` is "the full set of live background tasks". Replace semantics: "consumers that only need 'is background work running' should replace their set with each payload rather than pairing edges". Reset on process (re)start. Needs CLI ≥ 2.1.203.
- `SDKSessionStateChangedMessage` (`session_state_changed`, `state: 'idle'|'running'|'requires_action'`): "'idle' fires after heldBackResult flushes and the bg-agent do-while exits — authoritative turn-over signal" (sdk.d.ts 5859).
- `SDKResultMessage.origin` / `SDKUserMessage.origin`: `SDKMessageOrigin`, with `kind: 'task-notification'`. Docs: "When the SDK injects a synthetic follow-up turn, such as for a finished background task, the resulting `SDKResultMessage` carries `origin: { kind: "task-notification" }`… Check `kind` to distinguish results that answer your prompt from injected follow-ups". Also: "When several background-task completions are queued together… All but the last… produce empty results with `num_turns: 0`".

**Does `result` arrive before background tasks finish?** Yes, in streaming-input mode (which Ritemark uses). The turn ends, `result` is emitted, and later the CLI starts a new turn on its own: user message (task-notification) → assistant messages → a second `result`. This is confirmed by the transcript above. The automatic continuation needs the process and input stream to stay open. Single-shot (`claude -p` / string prompt) is different: "If Claude starts a background subagent or workflow, `claude -p` instead stays open until that work completes" (https://code.claude.com/docs/en/headless#background-tasks-at-exit). sdk.d.ts calls this a "held result".

**Controls:**
- `Query.stopTask(taskId)`: "Stop a running task. A task_notification with status 'stopped' will be emitted."
- `Query.backgroundTasks(toolUseId?)`: the Ctrl+B equivalent.
- Option `perTaskStopAffordance?: boolean` (sdk.d.ts 1789–1807). Without it, an interrupt **kills background tasks** (fail-closed). With it, Stop only aborts the turn, and the host must offer a stop control for each task.
- Option `agentProgressSummaries`.
- Hooks `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`. `SubagentStop`/`Stop` inputs carry `background_tasks?: BackgroundTaskSummary[]` ("Lets hooks distinguish 'session is done' from 'session is paused waiting for background work to wake it'").
- Read-only `get_task_output` control (shell/Monitor tasks only).
- Not verified: whether a **foreground** local_agent also emits `task_notification` on completion. The docs scope it to background tasks. The foreground result reliably arrives as the Agent `tool_result`.

## 2. What Ritemark does today

All paths are under `extensions/ritemark/`.

- **Session model is fine.** `AgentSession` keeps the query open with a long-lived input generator (`src/agent/AgentRunner.ts:1032-1043`, `_startSession` 1099). The query is **not** closed at `result`, so background tasks survive and the CLI does auto-continue. Nothing is orphaned by Ritemark at turn end.
- **The turn is "Done" at the first `result`.** `_consumeLoop` (1120) handles `result` at 1199–1257: `emitProgress('done', …)` and `_forceResolveTurn`. `ClaudeCodeRuntime.prompt` (`src/agent/ClaudeCodeRuntime.ts` ~228) then calls `onComplete`, and the host posts `agent-result` and checkpoints `completeRuntimeTurn` (`src/views/UnifiedViewProvider.ts` ~1004-1040). The webview's `deriveActivityState` (`webview/src/components/ai-sidebar/activityState.ts:31-76`) shows "Done in …". Its own header says "Done is only reported when the runtime reported turn completion", and running subagents are not considered.
- **Everything after `result` is dropped.** `_forceResolveTurn` sets `this._emitProgress = null` and `_turnResolve = null` (941–946). Later messages go through `this._emitProgress || (() => {})` (1198 and the assistant path ~1180), so they are no-ops. The second `result` passes the `_consumerTurnId === this._turnId` check (1208), because no new input was yielded, but `_forceResolveTurn` does nothing without a resolver. The host also gates every callback on `isCurrentRuntimeTurn()` (UnifiedViewProvider.ts:674, 979, 1005). Result: the follow-up answer is lost, files it writes are never reported (no `_refreshExplorerForAgentWrites`), and nothing is persisted in the Ritemark conversation.
- **Only some task messages are handled.** The handled set is `tool_progress` and `task_notification` (1191, `processSystemMessage` 1648-1678). `task_started`, `task_progress`, `task_updated`, `background_tasks_changed` and `session_state_changed` are ignored. Every `origin` is ignored. User messages (tool_results) are not processed at all.
- **Spinners never resolve (ID mismatch).** The card is created on the `Agent` tool_use with `subagentId: block.id`, i.e. `toolu_…` (1569-1582). The completion emits `subagent_done` with `subagentId: message.task_id` (1668-1677), an agent id like `ac2dcd48a5728a433`. The webview matches `sa.id === progress.subagentId` (`webview/src/components/ai-sidebar/store.ts:2784-2795`), so it never matches. It should key on `message.tool_use_id`, which the notification carries.
- **The foreground card has no completion signal.** The foreground agent's result is the `Agent` tool_result (a user message), which Ritemark doesn't read. Its spinner stays even though it finished at 07:01:42.
- **No stop control for a single subagent.** `perTaskStopAffordance` is not declared, so the sidebar Stop (`interrupt()` 835) kills background agents too (fail-closed, which is acceptable). `applyConfig` on a model change (`ClaudeCodeRuntime.ts` ~138) and error-path disposal (UnifiedViewProvider.ts:1053) `close()` the session, which silently kills any running background agents.
- **Misattribution risk (unverified, not reproduced).** `_consumerTurnId` advances when the SDK pulls the next prompt from the generator, not when the CLI starts it. Suppose the user sends a prompt while a task-notification turn is running. The CLI may fold it into that turn or queue it, and the docs say queued user messages can be folded in. The background turn's messages and `result` would then be attributed to, and resolve, the user's new turn, possibly with the wrong text. User messages are also sent without `origin: { kind: 'human' }` (`buildUserMessage`, 62), which the docs recommend.
- Flows (`runAgent`, 344, string prompt = closed input) is out of scope here. Per the headless doc, the CLI stays open until background subagents finish there, so the risk is smaller. Not verified in Ritemark.

## 3. Gaps

1. The turn shows **Done** while a background agent is still running. Nothing says "1 task still running in the background; Claude will continue when it finishes".
2. **Spinners never resolve**: wrong ID for background agents, and no handling at all for foreground ones.
3. **The automatic follow-up turn is dropped entirely**: final answer, activity, files written, persistence, title. In the observed case, the new Markdown file was written without the user being told.
4. A user prompt sent during that hidden follow-up turn could be mis-resolved (unverified).
5. No stop control for each background task. Model switch or error disposal silently kills running agents.

## 4. Fix options (smallest first). All are extension-tier: SDK 0.3.289 / CLI 2.1.289 already ship every needed message, no shell rebuild.

**A. Honest status, no new turn (smallest).**
- In `processSystemMessage`, key `subagent_done` on `message.tool_use_id`, with `task_id` as fallback. Handle `task_started` (record `task_id↔tool_use_id`, `is_backgrounded`), `task_updated` and `task_progress`, and mark a foreground card done when the `Agent` tool_result arrives.
- Track `background_tasks_changed` as the live set, skipping `ambient`.
- Keep the progress emitter alive after `result` for task events only, or route them through a session-level emitter instead of the per-turn one.
- When `result` arrives with a non-empty background set, show "Done — 1 task still running in the background" with a running chip on the card, instead of a plain Done and an orphan spinner.
- Fixes gaps 1 and 2. The follow-up answer is still lost.

**B. Surface the runtime-initiated turn (the real fix; builds on A).**
- In `_consumeLoop`, treat a `user` message with `origin.kind === 'task-notification'`, or any assistant activity while no turn is open, as the start of a **runtime-initiated turn**.
- Add a host callback (e.g. `onUnpromptedTurn`) so `UnifiedViewProvider` opens a new agent turn in the conversation ("Background task finished — Claude continued"), then streams progress, `agent-result`, explorer refresh and `completeRuntimeTurn` for it. This needs a conversation-controller turn kind with no user prompt.
- Resolve turns by `result.origin.kind` (human vs task-notification) instead of the counter alone. Send user prompts with `origin: { kind: 'human' }`.
- Use `session_state_changed: 'idle'` as the authoritative "all work finished" signal.
- Add `perTaskStopAffordance: true` with a stop button on each card wired to `stopTask(task_id)`. Guard `applyConfig`/dispose against a live background set, or warn first.
- Fixes gaps 1–5. Larger: touches AgentRunner, the runtime interface, UnifiedViewProvider, the conversation controller and the store.

**C. Stopgap: no background subagents.** Pass `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` in the session `env`. Note that the TS SDK *replaces* the env, so spread `process.env`, as `claudeRuntimeOptions` already does at AgentRunner.ts:204-212. Every subagent then runs in the foreground: the turn stays open until they finish, and "Done" is true. This also disables background Bash/Monitor and loses the "keep chatting while it works" behavior. Combine with A's ID fix so the foreground spinners resolve. Smallest code change, but it is a product trade-off, so Jarmo should decide.

## Unverified items
- Whether foreground local_agent tasks emit `task_notification`.
- The exact CLI behavior when a human prompt arrives during a task-notification turn (fold vs queue). The misattribution in gap 4 is inferred from code, not reproduced.
- No Ritemark trace was available (`ritemark.ai.debugTrace` off). The timeline comes from the CLI's own session transcript.
