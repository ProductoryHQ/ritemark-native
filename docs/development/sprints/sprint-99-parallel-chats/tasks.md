# Sprint 99 Tasks — Parallel Agent Chats

Branch: `sprint-99-parallel-chats` (create before any code edit, after plan AND SDD artifacts are approved)

## Phase 0: SDD Artifacts + Branch
- [ ] Write `spec.md` (R1-R7 draft numbering from sprint-plan.md, full acceptance criteria)
- [ ] Write `scenarios.md` (BDD scenarios per requirement, incl. negative/edge cases)
- [ ] Write `technical-plan.md` (workstreams per requirement, message shape changes, ACP subprocess-vs-multi-session decision)
- [ ] Jarmo approves sprint-plan.md + SDD artifact set
- [ ] `git checkout -b sprint-99-parallel-chats` (off `main`)
- [ ] `git branch --show-current` confirms `sprint-99-parallel-chats`

## Phase 1: Foundation — Interface + Webview Store Reshape (R1, R5)
- [ ] `runtime/AgentRuntime.ts`: add session-handle/`conversationId` parameter to `start`/`prompt`/`cancel`/`getStatus`/`dispose`
- [ ] `UnifiedViewProvider.ts`: replace single `_activeAbortController` (`:158-161`) with a per-conversation map
- [ ] `UnifiedViewProvider.ts`: `conversationId` added to every outbound `agent-progress`/`agent-result`/`codex-*`/`agent-approval-request` message
- [ ] Webview `store.ts`: reshape `agentConversation`/`codexConversation`/`currentConversationId`/`isStreaming` into `Map<conversationId, ConversationState>` + `activeConversationId`
- [ ] `types.ts`: add `conversationId` to turn types (`:191`, `:292`)
- [ ] Send guards `store.ts:422,744,812` made per-conversation (no longer global early-return)
- [ ] `ChatInput.tsx:223-224,273,1257`: `isLoading`/`disabled` become per-conversation
- [ ] Inbound dispatch (`store.ts:~1200-1804`) routes appended turns by `conversationId`, not "tail of the single array"
- [ ] `loadSavedConversation`/`startNewConversation` (`store.ts:1034-1076`, `:1120-1135`) no longer call `resetProviderSessions()` destructively when opening an ADDITIONAL chat (only when explicitly closing/replacing one)
- [ ] Minimal "list of open chats" UI stub added so later phases are demoable through the real UI
- [ ] Unit/manual smoke: store correctly tracks 2+ conversations without cross-contamination (mock runtime is fine at this stage)

## Phase 2: Codex Native Multi-Thread (R2)
- [ ] `CodexRuntime.ts`: remove single `_threadId`/`_turnId` (`:94-95`) collapse; route by protocol-native `threadId`/`turnId`
- [ ] Event routing (`:398-537`) dispatches by `params.threadId` instead of ignoring it
- [ ] `UnifiedApprovalGate.ts` / approval card: Codex approval requests (`codex-<id>` keying, `CodexRuntime.ts:525`) carry `conversationId` attribution
- [ ] Manual QA: two concurrent Codex chats streaming simultaneously, independent cancel

## Phase 3: Claude Code Multi-Session (R3)
- [ ] Audit `agent/AgentRunner.ts` (1235 LOC) for hidden singleton/global state; document findings in `technical-plan.md` or a `research/` note
- [ ] `ClaudeCodeRuntime.ts`: replace single `_session` (`:37`) and `_pendingQuestions` (`:40-53`) with a `Map<conversationId, Session>`
- [ ] `start()` (`:77-97`) creates/reuses session per `conversationId`, not globally
- [ ] Approval attribution wired for Claude (`toolUseId` keying, `ClaudeCodeRuntime.ts:122-139`) carries `conversationId`
- [ ] Manual QA: two concurrent Claude chats streaming simultaneously, independent cancel

## Phase 4: ACP/OpenCode Concurrency (R4)
- [ ] Record decision in `technical-plan.md`: multi-session-in-one-subprocess vs. one-subprocess-per-chat, with rationale
- [ ] `acpManager.ts`: replace single `sessionId` (`:62`) with per-conversation tracking (per decision)
- [ ] `AcpRuntime.ts`: replace single `_manager`/`_ipcServer`/`_pendingApprovals`/`_recentlyPermissionedWrites` (`:50-63`) with per-conversation equivalents
- [ ] `cancel()` (`:146-155`) scoped to the target conversation only, not nulling shared state
- [ ] Approval attribution wired for ACP (`acp-<seq>` keying, `AcpRuntime.ts:246,280`) carries `conversationId`
- [ ] Manual QA: two concurrent OpenCode chats streaming simultaneously, independent cancel

## Phase 5: Cross-Runtime + UI Polish (R6, R7)
- [ ] Multi-chat UI switcher replaces the Phase-1 stub (design via `ux-expert` routing recommendation)
- [ ] Per-chat running/attention indicator (relates to #140)
- [ ] Background-chat approval attribution verified end-to-end through the real UI (not just unit-level)
- [ ] `parallelChats` feature flag added to `features/flags.ts`, ON by default, documented as a code-level kill-switch (no Settings UI toggle)
- [ ] Verify flag OFF correctly falls back to single-conversation behavior without crashing

## Phase 6: QA, Cleanup, Architecture Update
- [ ] Run full QA matrix (sprint-plan.md QA section)
- [ ] Update `docs/development/architecture.md` — Agent Runtime Architecture section (interface change, message contract changes, Sprint Architecture Gate entry)
- [ ] Remove debug code / temp fixtures
- [ ] Recommend `qa-validator` for Phase 4→5 sign-off
- [ ] Recommend `qa-validator` again for prod-build sign-off (Phase 6 gate)
- [ ] Link commits/PR to #95, #97, #140 as "advances, does not close"
