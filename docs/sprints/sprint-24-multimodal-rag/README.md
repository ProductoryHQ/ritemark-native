# Sprint 24: Multi-Modal RAG + MCP Integration

**Status:** Phase 3 Complete (Implementation)
**Branch:** `claude/ritemark-multimodal-rag-Kq8lp`

---

## Quick Links

- **Research:** [../../analysis/2026-01-22-multimodal-rag-mcp.md](../../analysis/2026-01-22-multimodal-rag-mcp.md)
- **Branch:** `claude/ritemark-multimodal-rag-Kq8lp` (6 commits)

---

## Sprint Overview

**Problem:** AI agents (Claude Code, Codex, Cursor) can't read binary files (PDF, Word, PPTX) in the workspace. `grep` and `Read` tools fail on non-text content. A significant portion of project knowledge is invisible to AI assistants.

**Solution:** Local-first multi-modal RAG system built into RiteMark that:
1. Indexes all documents in the workspace
2. Exposes indexed content via MCP server to AI agents
3. Provides a unified search/chat UI in the left sidebar

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | OpenAI `text-embedding-3-small` | Same API key, no local models, 1536-dim |
| Vector store | `sqlite-vec` | Pure C, SIMD, works with better-sqlite3, single file |
| Document parser | Docling (IBM, MIT) | PDF, DOCX, PPTX, XLSX, images, OCR, tables |
| Python mgmt | `uv` | Auto-venv, isolated deps, single binary |
| Chat LLM | OpenAI `gpt-4o-mini` (existing) | Same client, same API key |
| Sidebar | Unified left sidebar | Replaces old AI assistant (right sidebar) |
| MCP transport | stdio (subprocess) | No network exposure, local-first |

---

## Architecture

```
User drops PDF/Word into workspace
    │ (FileSystemWatcher)
    ▼
Docling (Python, via uv run) → structured JSON
    │
    ▼
Chunker (TypeScript, 512 tokens, 50 overlap)
    │
    ▼
OpenAI text-embedding-3-small → 1536-dim vectors
    │
    ▼
sqlite-vec (local SQLite file, .ritemark/rag.db)
    │
    ├── Unified Sidebar (left) ──→ human search + chat
    │
    └── MCP Server (stdio) ──────→ Claude Code / Codex / Cursor
```

### Two Access Paths

| User | Interface | How |
|------|-----------|-----|
| Human | Left sidebar chat | Smart context: selection → edit, question → RAG |
| AI Agent | MCP tools | `search_documents`, `get_document_content`, `list_supported_files` |

---

## What Was Built

### Phase 1: RAG Pipeline (10 files, ~600 lines)

**Python (`rag-server/`):**
| File | Purpose |
|------|---------|
| `pyproject.toml` | uv project: docling + fastmcp |
| `src/ritemark_rag/parser.py` | Docling document parser (PDF, DOCX, PPTX, images) |
| `src/ritemark_rag/server.py` | FastMCP server with 5 tools |

**TypeScript (`extensions/ritemark/src/rag/`):**
| File | Purpose |
|------|---------|
| `chunker.ts` | Recursive text splitter (512 tokens, 50 overlap) |
| `embeddings.ts` | OpenAI text-embedding-3-small (batched, rate-limited) |
| `vectorStore.ts` | sqlite-vec: insert, search (KNN), remove, stats |
| `indexer.ts` | FileSystemWatcher + parse→chunk→embed→store pipeline |
| `search.ts` | `searchDocuments()` + `buildRAGContext()` for LLM prompts |
| `mcpServer.ts` | Manages Python FastMCP subprocess |
| `index.ts` | Barrel exports |

### Phase 2: Unified Sidebar (1 file, ~450 lines)

| File | Purpose |
|------|---------|
| `src/views/UnifiedViewProvider.ts` | Left sidebar WebviewView (replaces AIViewProvider) |

**Features:**
- Smart context detection (selection → edit mode, question → RAG mode)
- RAG search with citation chips (clickable → open source file)
- Inline [Apply] / [Discard] for text edits (replaces modal dialog)
- Index status footer with re-index button
- Streaming responses
- Same OpenAI API key for everything

### Phase 3: MCP Server + Auto-Indexing + Cleanup

| Change | Detail |
|--------|--------|
| `mcpServer.ts` | Manages Python subprocess, generates `.claude/settings.json` |
| `extension.ts` | Wires up indexer (file watcher, auto-index on startup, commands) |
| `package.json` | `activitybar` (left), new commands, new view ID |
| Deleted | `AIViewProvider.ts`, `AIChatSidebar.tsx` |

**New commands:**
- `RiteMark: Re-index Documents` - manual full re-index with progress
- `RiteMark: Generate MCP Config for Claude Code` - writes MCP config

---

## Files Changed (Summary)

```
New files:
  rag-server/pyproject.toml
  rag-server/src/ritemark_rag/__init__.py
  rag-server/src/ritemark_rag/parser.py
  rag-server/src/ritemark_rag/server.py
  extensions/ritemark/src/rag/chunker.ts
  extensions/ritemark/src/rag/embeddings.ts
  extensions/ritemark/src/rag/index.ts
  extensions/ritemark/src/rag/indexer.ts
  extensions/ritemark/src/rag/mcpServer.ts
  extensions/ritemark/src/rag/search.ts
  extensions/ritemark/src/rag/vectorStore.ts
  extensions/ritemark/src/views/UnifiedViewProvider.ts
  docs/analysis/2026-01-22-multimodal-rag-mcp.md

Modified files:
  extensions/ritemark/package.json
  extensions/ritemark/src/extension.ts
  extensions/ritemark/src/ritemarkEditor.ts

Deleted files:
  extensions/ritemark/src/ai/AIViewProvider.ts
  extensions/ritemark/webview/src/components/ai/AIChatSidebar.tsx
```

---

## Dependencies Added

### Python (rag-server/pyproject.toml)
```
docling>=2.0        # Document parsing
fastmcp>=2.0        # MCP server
```

### Node.js (needed, not yet in package.json)
```
better-sqlite3      # SQLite driver
sqlite-vec          # Vector search extension
```

---

## Phase 4 (Future / Polish)

- [ ] Add `better-sqlite3` + `sqlite-vec` to extension package.json dependencies
- [ ] Batch embedding progress indicator in sidebar
- [ ] Incremental indexing (hash-based skip - logic exists but untested)
- [ ] ColPali visual retrieval for image-heavy documents (GPU optional)
- [ ] Cross-workspace search
- [ ] Export search results to markdown note
- [ ] Error handling for missing `uv` binary
- [ ] First-run UX: prompt to install uv if not found

---

## How to Test

1. Install `uv`: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Place PDF/DOCX files in workspace
3. Run command: `RiteMark: Re-index Documents`
4. Open left sidebar → search/ask questions
5. For Claude Code: run `RiteMark: Generate MCP Config for Claude Code`

---

## Cost Estimates

| Operation | Model | Cost |
|-----------|-------|------|
| Index 100-page PDF | text-embedding-3-small | ~$0.001 |
| Single RAG query | text-embedding-3-small + gpt-4o-mini | ~$0.0005 |
| 1000 queries/day | Both | ~$0.50/day |
