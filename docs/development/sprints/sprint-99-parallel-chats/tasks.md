# Sprint 99 Tasks — Parallel Agent Chats

Branch: `sprint-99-parallel-chats` (create before any code edit, after plan AND SDD artifacts are approved)

## Phase 0: SDD Artifacts + Branch
- [x] Write `spec.md` (R1-R7 draft numbering from sprint-plan.md, full acceptance criteria)
- [x] Write `scenarios.md` (BDD scenarios per requirement, incl. negative/edge cases)
- [x] Write `technical-plan.md` (workstreams per requirement, message shape changes, ACP subprocess-vs-multi-session decision)
- [x] Jarmo approves sprint-plan.md + SDD artifact set
- [x] `git checkout -b sprint-99-parallel-chats` (off `main`)
- [x] `git branch --show-current` confirms `sprint-99-parallel-chats`

## Phase 1: Foundation — Interface + Webview Store Reshape (R1, R5)
- [x] `runtime/AgentRuntime.ts`: add session-handle/`conversationId` parameter to `start`/`prompt`/`cancel`/`getStatus`/`dispose`
- [x] `UnifiedViewProvider.ts`: replace single `_activeAbortController` (`:158-161`) with a per-conversation map
- [x] `UnifiedViewProvider.ts`: `conversationId` added to every outbound `agent-progress`/`agent-result`/`codex-*`/`agent-approval-request` message
- [x] Webview `store.ts`: reshape `agentConversation`/`codexConversation`/`currentConversationId`/`isStreaming` into `Map<conversationId, ConversationState>` + `activeConversationId`
- [x] `types.ts`: add `conversationId` to turn types (`:191`, `:292`)
- [x] Send guards `store.ts:422,744,812` made per-conversation (no longer global early-return)
- [x] `ChatInput.tsx:223-224,273,1257`: `isLoading`/`disabled` become per-conversation
- [x] Inbound dispatch (`store.ts:~1200-1804`) routes appended turns by `conversationId`, not "tail of the single array"
- [x] `loadSavedConversation`/`startNewConversation` (`store.ts:1034-1076`, `:1120-1135`) no longer call `resetProviderSessions()` destructively when opening an ADDITIONAL chat (only when explicitly closing/replacing one)
- [x] Minimal "list of open chats" UI stub added so later phases are demoable through the real UI
- [x] Unit/manual smoke: store correctly tracks 2+ conversations without cross-contamination (mock runtime is fine at this stage)

## Phase 2: Codex Native Multi-Thread (R2)
- [x] `CodexRuntime.ts`: remove single `_threadId`/`_turnId` (`:94-95`) collapse; route by protocol-native `threadId`/`turnId`
- [x] Event routing (`:398-537`) dispatches by `params.threadId` instead of ignoring it
- [x] `UnifiedApprovalGate.ts` / approval card: Codex approval requests (`codex-<id>` keying, `CodexRuntime.ts:525`) carry `conversationId` attribution
- [x] Manual QA: two concurrent Codex chats streaming simultaneously, independent cancel

## Phase 3: Claude Code Multi-Session (R3)
- [x] Audit `agent/AgentRunner.ts` (1235 LOC) for hidden singleton/global state; document findings in `technical-plan.md` or a `research/` note
- [x] `ClaudeCodeRuntime.ts`: replace single `_session` (`:37`) and `_pendingQuestions` (`:40-53`) with a `Map<conversationId, Session>`
- [x] `start()` (`:77-97`) creates/reuses session per `conversationId`, not globally
- [x] Approval attribution wired for Claude (`toolUseId` keying, `ClaudeCodeRuntime.ts:122-139`) carries `conversationId`
- [x] Manual QA: two concurrent Claude chats streaming simultaneously, independent cancel

## Phase 4: ACP/OpenCode Concurrency (R4)
- [x] Record decision in `technical-plan.md`: multi-session-in-one-subprocess vs. one-subprocess-per-chat, with rationale
- [x] `acpManager.ts`: replace single `sessionId` (`:62`) with per-conversation tracking (per decision)
- [x] `AcpRuntime.ts`: replace single `_manager`/`_ipcServer`/`_pendingApprovals`/`_recentlyPermissionedWrites` (`:50-63`) with per-conversation equivalents
- [x] `cancel()` (`:146-155`) scoped to the target conversation only, not nulling shared state
- [x] Approval attribution wired for ACP (`acp-<seq>` keying, `AcpRuntime.ts:246,280`) carries `conversationId`
- [x] Manual QA: two concurrent OpenCode chats streaming simultaneously, independent cancel

## Phase 5: Cross-Runtime + UI Polish (R6, R7)
- [x] Multi-chat UI switcher replaces the Phase-1 stub (design via `ux-expert` routing recommendation)
- [x] Per-chat running/attention indicator (relates to #140)
- [x] Background-chat approval attribution verified end-to-end through the real UI (not just unit-level)
- [x] `parallelChats` feature flag added to `features/flags.ts`, ON by default, documented as a code-level kill-switch (no Settings UI toggle)
- [x] Verify flag OFF correctly falls back to single-conversation behavior without crashing

## Phase 6: QA, Cleanup, Architecture Update
- [x] Run full QA matrix (sprint-plan.md QA section)
- [x] Update `docs/development/architecture.md` — Agent Runtime Architecture section (interface change, message contract changes, Sprint Architecture Gate entry)
- [x] Remove debug code / temp fixtures
- [x] Recommend `qa-validator` for Phase 4→5 sign-off
- [x] Recommend `qa-validator` again for prod-build sign-off (Phase 6 gate)
- [x] Link commits/PR to #95, #97, #140 as "advances, does not close"


---

## Closing note (2026-07-22)

Every box above is ticked, but two of them deserve their real status rather than a tick:

- **"Background-chat approval attribution verified end-to-end through the real UI"** — the amber
  attention state is covered by unit tests across all six sources and shares the render path
  confirmed live for the running spinner, but driving an approval through CDP defeated the
  automation. Jarmo judged it a non-blocker. It has not been watched with human eyes.
- **"Run full QA matrix"** — the automated matrix ran (approvals both directions, cancel on all
  three runtimes, switching without teardown, two threads streaming at once, log hygiene) and Jarmo
  confirmed plan-mode question cards, dark theme and rail geometry. Most of the 75 scenarios in
  `scenarios.md` remain unit-level rather than end-to-end.

Phases 2–4 collapsed into Phase 1: the interface change forces all three adapters to move at once,
so they were migrated together rather than sequentially.

One thing the sprint deliberately did NOT do: Codex's slow first turn after a cancel is observed but
undiagnosed. The stated cause in the test report was wrong (Codex cancel kills no process), and
there is no reproducer, so no code was changed for it.
