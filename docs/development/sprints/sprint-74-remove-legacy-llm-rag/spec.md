# Sprint 74 Spec — Remove legacy direct-LLM chat runtime + RAG

## Purpose

Remove the deprecated "Legacy Agent" (direct OpenAI/Gemini chat) runtime and the unused RAG /
vector-index subsystem it depends on. This is pure subtraction: it deletes a tangled dead-code
cluster (TO BE proposal win #4) while leaving the canonical runtimes — Claude Code, Codex — and
the Flows automation engine fully intact.

## Principles

- **Subtract, don't refactor.** No behaviour change to surviving features; this sprint only deletes.
- **Keep shared assets.** `openai` SDK, `apiKeyManager`, `modelConfig` are shared with Flows — they stay.
- **No data loss for users.** Existing saved conversations must not crash the history panel.
- **Audit before delete.** Phase 0 audit (`research/legacy-llm-reachability-audit.md`) governs scope.

## Requirements

### R1: Reachability & dependency-ownership audit (audit-first)
As the implementer, I want a verified map of what is legacy-only vs shared, so removal cannot
break a live feature.

Acceptance criteria:
- `research/legacy-llm-reachability-audit.md` exists and identifies every legacy-only asset and
  every shared asset with its live consumer.
- The audit's decision-gate items are answered by the sprint owner before any R2/R3 code change.
- Confirmed: the only npm dependency removable in this sprint is `@orama/orama`.

### R2: Remove the RAG / vector-index subsystem
As a maintainer, I want the unused semantic-search subsystem gone, so it stops shipping, signing,
and notarising.

Acceptance criteria:
- `src/rag/` (all 6 files) is deleted.
- `DocumentIndexer` lifecycle is removed from `extension.ts` (instantiation, init, dispose, index commands).
- The `rag-results` webview message and its emitter in `UnifiedViewProvider` are removed.
- Citation UI removed: `CitationChips.tsx`, the `RAGCitation`/`RAGSearchResult` types, and `pendingCitations` state.
- `@orama/orama` removed from `extensions/ritemark/package.json`.
- `tsc` compiles with zero references to `rag/` remaining.

### R3: Remove the deprecated direct-LLM ("ritemark-agent") runtime
As a maintainer, I want the legacy chat engine gone, so there is one fewer way to call a model and
no ghost client to maintain.

Acceptance criteria:
- `src/ai/openAIClient.ts` deleted; the `executeCommand` re-export removed from `src/ai/index.ts`.
- `_handleExecute` and the `case 'ai-execute'` handler removed from `UnifiedViewProvider`.
- `sendChatMessage` store action and the `ai-execute` webview message removed; `ChatView` legacy
  chat surface removed if it has no non-legacy consumer.
- `ritemark-agent` removed from the `AgentId` union and `AGENTS` registry in `src/agent/types.ts`
  **and** the webview mirror (`ai-sidebar/types.ts`); the "Legacy Agent" option removed from `AgentSelector`.
- The agent selector offers only Claude Code and Codex.

### R4: Canonical runtimes and Flows remain intact (guard)
As a user, I want Claude Code, Codex, and Flows to keep working exactly as before.

Acceptance criteria:
- Claude Code chat (`ai-execute-agent`) and Codex chat work end-to-end after removal.
- Flows LLM and Image nodes execute (they keep using `openai`, `apiKeyManager`, `modelConfig`).
- `configureApiKey` still works (Flows need keys).
- Pre-existing saved "Legacy Agent" conversations are handled per the Resolved Question below — no crash.

### R5: Documentation reconciled
As a reader, I want the architecture docs to match the code.

Acceptance criteria:
- RAG row removed from `high-level-architecture.md` §3.
- Win #4 marked done (or scoped-down) in `to-be-proposal.md`.
- CLAUDE.md domain references to RAG updated if present.
- `docs/CHANGELOG.md` + release notes updated.

## Non-Requirements
- Not removing the `openai` SDK, `apiKeyManager`, `modelConfig`, or `configureApiKey` — Flows use them.
- Not touching the Flows engine, Flows nodes, Codex, or Claude Code behaviour.
- Not bundling the extension host (TO BE win #1) — separate sprint.
- Not changing the webview ↔ host protocol typing (win #2) — separate sprint.

## Resolved Questions
- **2026-05-31 (Jarmo, "jätka"):** Remove the user-selectable "Legacy Agent" runtime **entirely**. Only Claude Code + Codex remain.
- **2026-05-31 (Jarmo, "jätka"):** Saved legacy conversations **kept read-only** via the existing `legacy-ritemark` compat mapping. No data loss; cannot create new legacy chats.

## Open Questions
- Does `ChatView.tsx` have any non-legacy use? (Phase 0 follow-up during R3 implementation — if purely legacy, it is removed.)
- Is `ai-cancel` / `_activeAbortController` shared with the agent runtime? (Must keep cancel for Claude Code — verify during R3.)
