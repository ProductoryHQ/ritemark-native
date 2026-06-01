# Sprint 74 Tasks

> Status source of truth — tick `[x]` ONLY when the code change is on this branch.
> R2/R3 tasks are BLOCKED until the Phase 0 decision gate is signed off by the sprint owner.

## Phase 0: Audit-first (R1) — DONE pending sign-off
- [x] Write `research/legacy-llm-reachability-audit.md` (reachability + dependency ownership)
- [x] Confirm `@orama/orama` is the only removable dependency
- [x] **GATE:** sprint owner (Jarmo) signed off 2026-05-31 — full runtime removal + keep legacy history read-only

## Phase 1: Remove RAG subsystem (R2) — DONE
- [x] Delete `src/rag/` (6 files)
- [x] Remove `DocumentIndexer` lifecycle + index commands from `extension.ts`
- [x] Remove `_vectorStore` / `_initVectorStore` / `_sendIndexStatus` + RAG imports from `UnifiedViewProvider.ts`
- [x] Remove `rag-results` postMessage emitter
- [x] Delete `CitationChips.tsx` + `IndexFooter.tsx`; remove `RAGCitation` / `IndexStatus` / `IndexProgress` types; remove `pendingCitations` state
- [x] Drop `@orama/orama` from `package.json`
- [x] `tsc` clean (0 new errors); grep guard zero hits for `rag/`, `RAGCitation`, `rag-results`, `@orama/orama`

## Phase 2: Remove legacy direct-LLM runtime (R3) — DONE
- [x] Delete `src/ai/openAIClient.ts`; remove `executeCommand` re-export from `src/ai/index.ts` (relocated `EditorSelection` type into `ai/index.ts`)
- [x] Remove `_handleExecute` + `case 'ai-execute'` from `UnifiedViewProvider.ts` (kept `ai-cancel` for Claude/Codex abort)
- [x] Remove `sendChatMessage` + `ai-execute` message from `store.ts`
- [x] Simplify `ChatInput.tsx` dispatch to Claude Code + Codex only
- [x] Delete `ChatView.tsx` (legacy-only surface — no Claude/Codex consumer)
- [x] Remove "Legacy Agent" option from `AgentSelector.tsx`
- [x] Remove `'ritemark-agent'` from `agent/types.ts` AgentId + AGENTS, and webview `ai-sidebar/types.ts`
- [x] **Kept** the `legacy-ritemark` read-compat shim (chatHistoryStorage + conversationModel + store coercion)
- [x] `tsc` clean both sides (0 new errors); webview bundle rebuilt

## Phase 3: Guard verification (R4)
- [x] Automated tests green: `lifecycle`, `conversationReset`, `conversationModel`, `runtimeSwitching`, `codexModelSelect`, `ClaudeCodeNodeExecutor`
- [x] Old `ritemark-agent` conversation opens read-only (conversationModel.test passes) — scenarios.md
- [ ] **Manual (Jarmo):** Claude Code chat end-to-end (+ `ai-cancel` aborts) in running app
- [ ] **Manual (Jarmo):** Codex chat end-to-end
- [ ] **Manual (Jarmo):** Flows LLM + Image nodes execute; `configureApiKey` works

## Phase 4: Documentation (R5) — DONE
- [x] Remove RAG row from `high-level-architecture.md` §3
- [x] Mark win #4 done in `to-be-proposal.md`
- [x] CLAUDE.md — no RAG references present (nothing to change)
- [x] `docs/CHANGELOG.md` Removed entry added

## Follow-ups discovered (out of this sprint's scope — left intact)
- Legacy AI **tool-widget subsystem** (`execute-widget` / `ai-widget` / `_executeToolInEditor` / `ritemark.executeAITool`) is now only reachable via the deleted `_handleExecute` → dead but untouched. Separate cleanup.
- `NoApiKey` component is now unreachable from the AI sidebar render tree (the legacy `!isAgentMode && !hasApiKey` gate can no longer be true). File left in place. Separate cleanup.

## Phase 5: QA and Closeout
- [ ] Run focused automated tests (`npm test` subset for ai-sidebar / flows)
- [ ] `qa-validator` agent review (build / patches / tsc / debug-code gate)
- [ ] Pre-commit hook green
- [ ] Update `docs/CHANGELOG.md` + release notes
- [ ] Update linked GitHub issue(s)
- [ ] Commit per workstream; open PR
