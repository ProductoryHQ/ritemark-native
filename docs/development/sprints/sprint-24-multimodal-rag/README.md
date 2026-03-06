# Sprint 24: Multi-Modal RAG + MCP Integration

**Status:** Phase 4 In Progress (Integration & Testing)
**Branch:** `claude/ritemark-multimodal-rag-Kq8lp` (rebased onto main v1.0.3)

---

## Quick Links

- **Research:** [../../analysis/2026-01-22-multimodal-rag-mcp.md](../../analysis/2026-01-22-multimodal-rag-mcp.md)
- **Branch:** `claude/ritemark-multimodal-rag-Kq8lp` (6 commits)

---

## Sprint Overview

**Problem:** AI agents (Claude Code, Codex, Cursor) can't read binary files (PDF, Word, PPTX) in the workspace. `grep` and `Read` tools fail on non-text content. A significant portion of project knowledge is invisible to AI assistants.

**Solution:** Local-first multi-modal RAG system built into Ritemark that:
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
- `Ritemark: Re-index Documents` - manual full re-index with progress
- `Ritemark: Generate MCP Config for Claude Code` - writes MCP config

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

### Node.js
```
better-sqlite3      # SQLite driver
sqlite-vec          # Vector search extension
```

---

## Phase 4: Integration & Polish (rebased onto main v1.0.3)

### Completed
- [x] Rebase onto main (v1.0.3 with voice dictation + feature flags)
- [x] Add `better-sqlite3` + `sqlite-vec` to extension package.json
- [x] Add `@types/better-sqlite3` to devDependencies
- [x] Update package.json: commands, views, activation events for unified sidebar
- [x] Fix `getKey()` → `getAPIKey()` in embeddings.ts (API changed on main)

### Remaining Tasks
- [ ] Install `uv` and test document parsing (Python MCP server)
- [ ] Test full RAG pipeline: index → embed → search → chat
- [ ] Verify unified sidebar renders correctly in dev mode
- [ ] Test MCP config generation for Claude Code
- [ ] Batch embedding progress indicator in sidebar
- [ ] Incremental indexing (hash-based skip - logic exists but untested)
- [ ] Error handling for missing `uv` binary
- [ ] First-run UX: prompt to install uv if not found
- [ ] ColPali visual retrieval for image-heavy documents (GPU optional)
- [ ] Cross-workspace search
- [ ] Export search results to markdown note

---

## How to Test

1. Install `uv`: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Place PDF/DOCX files in workspace
3. Run command: `Ritemark: Re-index Documents`
4. Open left sidebar → search/ask questions
5. For Claude Code: run `Ritemark: Generate MCP Config for Claude Code`

---

## Cost Estimates

| Operation | Model | Cost |
|-----------|-------|------|
| Index 100-page PDF | text-embedding-3-small | ~$0.001 |
| Single RAG query | text-embedding-3-small + gpt-4o-mini | ~$0.0005 |
| 1000 queries/day | Both | ~$0.50/day |

---

## PIVOT: sqlite-vec → Orama (2026-01-25)

### Blocker

The `vec0 INSERT` fails with "Only integers are allowed for primary key values" error. After extensive debugging (Number(), BigInt(), schema changes), the root cause is **native dependency hell**:

1. **Version mismatch** - sqlite-vec `0.1.0` wrapper vs `0.1.6` darwin binary
2. **Electron ABI** - better-sqlite3 needs to match VS Code's Electron version
3. **Production bug** - [electron-builder #8824](https://github.com/electron-userland/electron-builder/issues/8824) documents `.dylib.dylib` path bug
4. **Alpha status** - npm package neglected (last publish: over a year ago)

**Analysis:** [../../analysis/2026-01-25-vector-store-comparison.md](../../analysis/2026-01-25-vector-store-comparison.md)

### Decision: Orama

| Property | sqlite-vec | Orama |
|----------|-----------|-------|
| Native deps | 3 layers (C bindings) | **Zero** |
| Bundle size | ~5MB + dylib | **<2KB** |
| Search | Vector only | **Hybrid** (vector + full-text) |
| VS Code compat | Buggy | **No issues** |
| Scale | Millions | ~100K (sufficient) |

Orama's hybrid search combines keyword matching with semantic similarity - exactly what workspace RAG needs.

### What Changes

| Phase | Original | After Pivot |
|-------|----------|-------------|
| Phase 1-3 | ✅ Done (parser, embeddings, MCP) | ✅ Keep as-is |
| Phase 4 | sqlite-vec integration | 🔄 **Orama migration** |
| Phase 5-6 | Polish, testing | ✅ Same scope |

### New Phase 4: Orama Migration

**Remove:**
```json
- "better-sqlite3": "^11.0.0"
- "sqlite-vec": "^0.1.0"
- "sqlite-vec-darwin-arm64": "^0.1.6"
- "@types/better-sqlite3": "^7.6.0"
```

**Add:**
```json
+ "@orama/orama": "^3.0.0"
```

**Rewrite:**
- `extensions/ritemark/src/rag/vectorStore.ts` - same API, Orama backend

**API stays the same:**
- `insertChunks(chunks: Chunk[])`
- `search(query: string, embedding: number[], limit?: number)`
- `removeBySource(sourcePath: string)`
- `getStats()`
- `isFileIndexed(sourcePath: string, hash: string)`

### Tasks

- [ ] Remove sqlite-vec dependencies from package.json
- [ ] Add @orama/orama dependency
- [ ] Rewrite vectorStore.ts with Orama backend
- [ ] Implement hybrid search (vector + BM25)
- [ ] JSON file persistence (~/.ritemark/rag-index.json)
- [ ] Test full pipeline: index → embed → search → chat
- [ ] Verify sidebar renders search results correctly
