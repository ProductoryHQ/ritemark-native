# Sprint 128 Tasks

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md) · **Plan:** [technical-plan.md](./technical-plan.md)

**Gate:** no task below starts until Jarmo approves the sprint plan and the branch `sprint-128-background-agent-turns` exists (`git branch --show-current` must print it). T0.1 and T0.2 are not code and may follow the approval immediately. Phase 0 (W0) finishes before any W1–W6 product code.

Workstreams: W0 Phase 0 probes · W1 session ownership, registry, timer · W2 task-event reduction to cards · W3 runtime interface + live hooks · W4 host + conversation record · W5 webview · W6 stop and kill warnings · W7 tests, bundle, dev-instance QA · W8 documentation and architecture gate.

## W0 — Phase 0: reproduce, measure, decide (before product code)

- [x] T0.1 Create the GitHub issue under milestone `v1.13.0`, create the branch, update the release-plan "Sprints" row with branch and issue.
- [x] T0.2 Re-verify every file:line used in the technical plan on the branch base (done once on `9975c828` while planning).
- [x] T0.3 Probe script (`research/probes/` in this sprint folder, Node, no product code): run the **bundled** Claude Code SDK/CLI (2.1.289 / 0.3.289) in streaming-input mode with a real background subagent, record the full message stream to JSONL. **Needs Claude credentials (Jarmo's machine or account).** Settles D1, D2, D4, D5, D6. R1, R3, R6, R7.
- [x] T0.4 Probe P3: while the follow-up (task-notification) turn is running, send a human prompt (with `origin: { kind: 'human' }`, and again with `priority: 'next'` and `'later'`); record fold / queue / interrupt and the `result` origins. Settles D3, covers the audit's unverified risk. R5. Attach the recording as evidence for S18.
- [x] T0.5 Probe P6: `perTaskStopAffordance: true`, interrupt with a live background task (does it survive), `stopTask` on it (stopped notification, follow-up turn after). R7, R8. If D6 fails, stop the sprint and tell Jarmo.
- [x] T0.6 *(not needed: the P1 recording from the SDK stream covers the same sequence class and replaced the hand-built fixtures — see research/phase0-findings.md)* Probe P7: record the observed 2026-10-05 sequence class once more with `ritemark.ai.debugTrace` on in a dev instance to prove the dropped follow-up before the fix, and use the recording as the replacement for the hand-built fixtures. R4.
- [x] T0.7 Check D7: does the current conversation validator accept an extra optional `origin` on a user-message event, and does a downgraded client (previous release) still read such a record? If not, propose the alternative to Jarmo before W4. R4.
- [x] T0.8 Write `research/phase0-findings.md` (what was run, what was not, with the decisions D1–D7 filled in). Surface changes to Jarmo.
- [x] T0.9 Reproduce the stray-interrupt timer finding (a message after `result`, then silence past the timeout, with a short `agentTimeout` in a unit test; the dev-instance check is optional). R3.

## W1 — Session ownership, registry, timer (`src/agent/AgentRunner.ts`)

- [x] T1.1 Add `origin: { kind: 'human' }` to every user message built by `buildUserMessage`. R5.
- [x] T1.2 Add the owner state machine (`_owner`), the start signal from Phase 0, owner-based routing of assistant/stream/`tool_progress` messages, and result attribution by `result.origin`. Keep the counter as a consistency trace only. R4, R5.
- [x] T1.3 Implement the human-prompt-during-runtime-turn rule from D3 (default: wait until that turn's result or idle). R5.
- [x] T1.4 Rework the inactivity timer: runs only while `_owner` is set, never restarts for messages with no owner, never interrupts an idle session. R3.
- [x] T1.5 Handle `session_state_changed` (idle sweep, `onIdle`) with the fallback when it is not delivered. R6.
- [x] T1.6 Handle `user` messages: tool_result for known Agent cards (D4 rule) and the `origin` start signal. R1, R4.
- [x] T1.7 Add `perTaskStopAffordance: true` to the query options; add `stopTask` to the session (`QueryHandle.stopTask?` in `src/agent/types.ts`). R7.
- [x] T1.8 Interrupt and timeout path: `interrupt()` no longer force-resolves or cancels a runtime-initiated turn that is not the target; cancel scope is the current owner only. R8.

## W2 — Task events to cards (`src/agent/backgroundTasks.ts`, `AgentRunner.ts`)

- [x] T2.1 New `backgroundTasks.ts`: types, `reduceTaskMessage(state, message)` producing UI events (`card-start`, `card-update`, `card-done`, `live-set`, `sweep`). Pure, no SDK import. R1.
- [x] T2.2 Handle `task_started`, `task_updated`, `task_progress`, `task_notification` (card id = `tool_use_id`, fallback `task_id`; status completed/failed/stopped), and `background_tasks_changed` (replace the live set, skip `ambient`). R1, R2.
- [x] T2.3 Replace `processSystemMessage`'s task branch and the `subagent_start` id (`block.id`) so ids agree; keep `tool_progress` handling. Extend `AgentProgress` (types in `src/agent/types.ts` and webview `types.ts`) with `taskId`, `subagentStatus`, `backgrounded`, `stoppable`, `usage`; add the `subagent_update` type. R1.
- [x] T2.4 Route task events through the conversation-scoped channel (Design A) so they work after `result`. R3.

## W3 — Runtime interface and live hooks

- [x] T3.1 `src/runtime/AgentRuntime.ts`: optional `RuntimeSessionConfig.live`, optional `RuntimeSession.stopBackgroundTask` and `backgroundTasks`; document that Codex and ACP never call or define them. R10.
- [x] T3.2 `src/runtime/capabilities.ts`: `backgroundWork` (Claude Code only). R10.
- [x] T3.3 `src/agent/ClaudeCodeRuntime.ts`: keep the latest `live` hooks across `applyConfig`, implement `stopBackgroundTask`, expose the live count. R3, R7, R10.
- [x] T3.4 Confirm Codex and ACP files are untouched: `git diff --stat` shows none under `src/codex/` or `src/acp/`. R10.

## W4 — Host and conversation record

- [x] T4.1 `ConversationController.beginRuntimeInitiatedTurn` (+ optional `origin` on `UserMessageEventV1` and its validator, per T0.7). R4.
- [x] T4.2 Context packs and the fallback transcript skip origin-carrying user messages; the assistant answer stays. R4 (S17).
- [x] T4.3 `UnifiedViewProvider`: per-conversation `live` hooks (no turn token, current `bindingGeneration` at call time); `agent-turn-started`; `agent-background-tasks`; `onRuntimeTurnProgress` → `agent-progress`. R3, R4.
- [x] T4.4 Factor the body of `onComplete` into one private method used by human and runtime-initiated completion (`agent-result`, `_refreshExplorerForAgentWrites`, `completeRuntimeTurn`, error disposal). No title generation for a runtime-initiated turn. R4.
- [x] T4.5 `agent-stop-task` handler; `agent-cancel` consumes the cancel intent only for the human turn that was current. R7, R8.
- [x] T4.6 Approval and question callbacks raised inside a runtime-initiated turn go through the same gates (checkpoint attention on the new turn). R4.

## W5 — Webview

- [x] T5.1 `types.ts`: `AgentConversationTurn.origin`, `SubagentProgress` fields/status values; message types for the three new messages. R1, R4.
- [x] T5.2 `store.ts`: `agent-turn-started`; cross-turn subagent patching with `requireRunning: false`; `agent-background-tasks` live set per conversation; persist when the live set empties; on load close stale running cards as "ended". R1, R2, R3, R4.
- [x] T5.3 `activityState.ts`: `done-background` state, waiting-state precedence kept, rail attention never amber for background work. Copy from the table. R2.
- [x] T5.4 `ActivityStatusLine.tsx`: counts from the live set; "waiting for the background follow-up" label when a prompt is held. R2, R5.
- [x] T5.5 `SubagentCard.tsx`: header to shadcn `Button`; running-in-background label, stopping/stopped/ended/failed texts, one-line progress detail; stop `Button` + `Tooltip` (every state). R1, R7, R11.
- [x] T5.6 `AgentView.tsx`: render the muted trigger line for `origin: 'background-task'`. R4, R11.
- [x] T5.7 *(300 px checked on a dev instance; 250 and 223 px not run)* Check 300 / 250 / 223 px widths: single-line, no overlap. R11.

## W6 — Stop and kill warnings

- [x] T6.1 Status copy after Stop: "Stopped — N task(s) still running in the background". R8.
- [x] T6.2 Stop-task flow: stopping state, bounded wait, "Couldn't stop this task" with a usable button. R7.
- [x] T6.3 Model-switch confirm dialog (`ui/dialog.tsx`) when the live set is not empty; Cancel keeps model and session. Pending Jarmo's answer to open question 3. R9.
- [x] T6.4 Forced disposal line "N background task(s) ended with the session." through the existing `session_reset` pattern: `applyConfig`, error path, authentication path, runtime exit. R9.
- [x] T6.5 *(delete conversation: its confirmation now names running background work; new chat and rail close do not end a session — no change)* List every user-initiated session end (new chat, history delete, rail close) and add the task count only where a confirmation already exists; report any path that has none. R9.

## W7 — Tests, bundle, dev-instance QA

- [x] T7.1 Fixtures in `src/agent/fixtures/background-subagents/` (hand-built first, replaced by T0.3/T0.6 recordings); each names its provenance.
- [x] T7.2 `src/agent/backgroundTasks.test.ts` and `AgentRunner.test.ts` additions: S1–S9, S12–S16, S18–S28, S30 (fake `_queryStream`, fake clock for S14). Register in `package.json` test scripts.
- [x] T7.3 Conversation tests (`ConversationController.test.ts`): S15 persistence, S17 context pack, origin validation.
- [x] T7.4 Webview pure tests (`activityState`, store reducers, reload close): S8–S11, S13, S17, S22.
- [x] T7.5 Run `npm test`, extension typecheck, webview typecheck; rebuild `media/webview.js`; rebase on `main` and rebuild if other bundles landed; pre-commit validator.
- [x] T7.6 *(dev instance, real Claude: S1, S2, S3, S8, S9, S15, S24, S29, S31 run; S27 main Stop with tasks left and S33/S34 narrow widths not run)* Dev-instance run with a real background subagent through S1, S2, S3, S8, S9, S15, S24, S27, S29, S33, S34; screenshots at three widths; name anything not run. Recommend invoking `qa-validator` for the Phase 4 sign-off.

## W8 — Documentation and architecture gate

- [x] T8.1 Update `docs/development/architecture.md` (AgentRuntime section: optional live hooks, `stopBackgroundTask`, `backgroundWork` capability; conversation event origin; new webview messages; version-history row; `Last updated`). Sprint Architecture Gate.
- [x] T8.2 Update the release plan row and the v1.13.0 release notes entry (plain language: "Claude's background tasks now show their real state, and its automatic follow-up appears in the conversation").
- [x] T8.3 Note the sprint in `docs/development/agent-runtime-compatibility.md` only if Phase 0 found a CLI behaviour future bumps must re-check (D1–D6).
- [x] T8.4 Close the sprint: tick the plan checklist, record which D-items were run and which were not.

## Definition of done

Spec R1–R11 verified by their scenarios (U automatically, D on a dev instance), architecture doc updated, bundle rebuilt, `npm test` and both typechecks green, validator green, Codex/ACP sources untouched, Jarmo's open questions answered and the plan updated to match.
