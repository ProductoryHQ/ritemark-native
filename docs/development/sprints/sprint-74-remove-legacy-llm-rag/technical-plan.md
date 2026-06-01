# Sprint 74 Technical Plan

## Architecture Overview

Pure deletion across two components — the extension host and the webview — plus one dependency
drop. No new modules. Shared AI infrastructure (`openai`, `apiKeyManager`, `modelConfig`) is
retained because Flows depend on it (see Phase 0 audit). The work splits into two workstreams that
map to R2 (RAG) and R3 (legacy runtime); they share an integration seam in `UnifiedViewProvider`
(`_handleExecute`), so R3 lands after R2.

## Workstream 1: Remove RAG subsystem (R2)

### Extension Host
- Delete `src/rag/` (6 files: `indexer`, `vectorStore`, `chunker`, `embeddings`, `search`, + index/types).
- `extension.ts`: remove `import { DocumentIndexer }`, the `documentIndexer` module var, its
  init/`onProgress`/`indexAll`/`getStats`/`cancelIndexing`/`dispose` wiring, and any `ritemark.*index*` command registrations.
- `UnifiedViewProvider.ts`: remove `_vectorStore`, `_initVectorStore`, `_sendIndexStatus`, the
  `searchDocuments`/`buildRAGContext`/`VectorStore` imports, and the `rag-results` `postMessage`.
- `package.json`: drop `@orama/orama`.

### Webview Side
- Delete `CitationChips.tsx`.
- `ai-sidebar/types.ts`: remove `RAGCitation` (and `RAGSearchResult` if mirrored).
- `store.ts`: remove `pendingCitations` state and any `rag-results` handler.

### Tests
- `tsc` clean. Grep guard: zero hits for `rag/`, `RAGCitation`, `rag-results`, `@orama/orama`.
- Manual: open a note, confirm no citation chips, no index status.

## Workstream 2: Remove legacy direct-LLM runtime (R3)

### Extension Host
- Delete `src/ai/openAIClient.ts` (defines `executeCommand`).
- `src/ai/index.ts`: remove the `executeCommand` (and any openAIClient-only) re-exports. Keep
  `apiKeyManager`/`modelConfig` exports.
- `UnifiedViewProvider.ts`: remove `_handleExecute` and the `case 'ai-execute'` dispatch.
  **Keep** `case 'ai-cancel'` (shared with Claude Code abort — verify `_activeAbortController`).
- `src/agent/types.ts`: remove `'ritemark-agent'` from the `AgentId` union and its `AGENTS` entry.

### Webview Side
- `store.ts`: remove `sendChatMessage` and the `ai-execute` postMessage.
- `ChatInput.tsx`: simplify dispatch to Claude Code + Codex only (drop the non-Claude/non-Codex
  `sendChatMessage` branches at ~262, 317, 339, 373, 499; keep agent/codex paths).
- `ChatView.tsx`: remove if it has no non-legacy consumer (it wires `sendChatMessage`); otherwise
  strip the legacy branch.
- `AgentSelector.tsx`: remove the `ritemark-agent` / "Legacy Agent" option.
- `ai-sidebar/types.ts`: remove `'ritemark-agent'` from the webview `AgentId`.
- **Compat (data-safety):** keep `chatHistoryStorage.ts` `ritemark-agent → legacy-ritemark`
  read-mapping and `conversationModel.ts` `isLegacyAgent` rendering so old saved conversations
  still open read-only. Do NOT delete the compat shim.

### Tests
- Existing tests: `conversationModel.test.ts`, `chatHistoryStorage.ts` compat — update to assert
  read-only legacy rendering still works; remove tests that create new legacy chats.
- `tsc` clean both sides. Webview bundle rebuilds.
- Manual: agent selector shows only Claude/Codex; Claude + Codex + a Flow all run; old legacy
  conversation opens without error.

## Workstream 3: Docs reconciliation (R5)
- `high-level-architecture.md` §3: drop RAG row.
- `to-be-proposal.md`: mark win #4 done.
- CLAUDE.md: update RAG domain references if any.
- `docs/CHANGELOG.md` + release notes.

## Sequencing & risk
- R2 before R3 (R3 removes the consumer `_handleExecute` that R2's RAG fed into — but R2 only
  removes the RAG *branch*; the `_handleExecute` shell is removed in R3).
- Highest-risk edit: `ChatInput.tsx` dispatch — it is the shared entry for all three runtimes.
  Change carefully; the guard scenarios (R4) exist precisely to catch a Claude/Codex regression.
- Commit per workstream (SDD convention) for a reviewable branch history.
