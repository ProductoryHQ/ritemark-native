# Phase 0 Audit — Legacy direct-LLM runtime + RAG reachability & dependency ownership

**Date:** 2026-05-31 · **Sprint:** 74 · **Status:** complete, awaiting decision-gate sign-off
**Method:** static read-only trace (grep/read) on branch `sprint-74-remove-legacy-llm-rag`. No code changed.

## Question this audit answers

Win #4 of the TO BE proposal calls RAG + the ghost OpenAI client "dead, behaviour-neutral to
remove". Before deleting anything, confirm: (a) is the legacy path actually unreachable, and
(b) which npm dependencies / shared modules are owned *only* by this path vs shared with live
features (Flows, Codex, Claude Code)?

## What we observed

### 1. The legacy path is one tangled cluster (not three orphans)

```
AgentSelector "Legacy Agent" (ritemark-agent)
  → store.sendChatMessage → postMessage{type:'ai-execute'}
    → UnifiedViewProvider.onDidReceiveMessage case 'ai-execute'
      → _handleExecute()  (UnifiedViewProvider.ts ~2044)
         ├─ RAG: searchDocuments + buildRAGContext  (src/rag/*)   → @orama/orama
         └─ openAIClient.executeCommand()  (src/ai/openAIClient.ts:241)
```

`executeCommand` is **defined in `openAIClient.ts`** — the deprecated client *is* the legacy chat
engine. RAG only feeds it via `enhancedPrompt`.

### 2. The legacy runtime is STILL USER-SELECTABLE (key finding)

- `webview/.../AgentSelector.tsx:73` renders the label **"Legacy Agent"** for `ritemark-agent`.
- So this is **not** dead-by-unreachable-caller. A user can pick "Legacy Agent" today and the whole
  RAG + openAIClient path runs. Removal is therefore **user-facing**, not purely internal.
- Saved conversations carry `agentId: 'ritemark-agent'`; `chatHistoryStorage.ts:74-75` already maps
  them to a `legacy-ritemark` runtime id and notes the agent "was deprecated in the primary [path]".

### 3. Dependency ownership — what is shared vs legacy-only

| Asset | Used by legacy path | Also used by LIVE features | Verdict |
| --- | --- | --- | --- |
| `@orama/orama` | RAG vector store | **nobody else** | **DROP** |
| `openai` npm SDK | `openAIClient.ts`, `rag/embeddings.ts` | **Flows** `LLMNodeExecutor`, `ImageNodeExecutor`, `FlowEditorProvider` | **KEEP** |
| `ai/apiKeyManager.ts` | legacy + RAG | Flows nodes, `configureApiKey` command, extension.ts | **KEEP** |
| `ai/modelConfig.ts` | legacy | Flows nodes (`DEFAULT_MODELS`, `GEMINI_LLM_MODELS`, …) | **KEEP** |
| `src/rag/*` (6 files) | legacy only | nobody | **DELETE** |
| `ai/openAIClient.ts` | legacy only (`executeCommand`) | only re-exported via `ai/index.ts` | **DELETE** |
| `CitationChips.tsx`, `RAGCitation` | RAG citation UI | nobody | **DELETE** |

**Conclusion:** removing `openAIClient.ts` does **not** let us drop the `openai` SDK — Flows still
call OpenAI/Gemini directly. The only dependency this sprint removes is **`@orama/orama`**.

## Decision

**SHIP** the full removal, with one product decision required before code changes (below).
No technical blockers found. Scope is bounded; live features (Claude Code, Codex, Flows) do not
touch `src/rag/` or `openAIClient.ts`.

## Decision-gate items for Jarmo (must answer before R2/R3 code)

1. **Confirm removing the user-selectable "Legacy Agent" runtime entirely** (it disappears from
   the agent selector; only Claude Code + Codex remain). Default per deprecation: **yes**.
2. **What happens to existing saved "Legacy Agent" conversations?**
   - (a) **Keep read-only** via the existing `legacy-ritemark` compat mapping — old history still
     opens, just can't create new legacy chats. *(Recommended — lowest risk, no data loss.)*
   - (b) Hide them from the history panel.
   - (c) Purge them.

Until these are answered, R2/R3 stay un-started.
