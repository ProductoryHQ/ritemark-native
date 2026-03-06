# Multi-Modal RAG + MCP Integration for Ritemark

**Date:** 2026-01-22
**Status:** Research / Feature Design
**Problem:** AI agents (Claude Code, Codex) cannot read binary files (PDF, Word, PPTX, images) in the workspace. `grep` and `Read` tools fail on binary content.

---

## 1. Problem Statement

When a Ritemark workspace contains non-text files:
- **PDFs** - Claude Code returns "Error: This tool cannot read binary files" ([Issue #1510](https://github.com/anthropics/claude-code/issues/1510))
- **Word (.docx)** - Binary XML archive, grep finds nothing useful
- **PowerPoint (.pptx)** - Same as Word
- **Images with text** - Completely invisible to text-based tools
- **Scanned documents** - No text layer at all

This means a significant portion of project knowledge is **invisible** to AI assistants, even though it sits right there in the project folder.

### What Anthropic's Team Says

Per GitHub Issue #1510, Claude Code's `Read` tool explicitly rejects binary files. The API and web interface support PDF (up to 32MB, 100 pages via vision), but the CLI tools do not. There is no built-in solution for indexing workspace binary files.

---

## 2. Proposed Solution: Ritemark RAG

A **local-first** multi-modal RAG system built into Ritemark that:

1. **Indexes** all documents in the workspace (PDF, Word, PPTX, images, etc.)
2. **Exposes** indexed content via **MCP server** to Claude Code, Codex, Cursor, etc.
3. **Provides** a **search/chat UI** in the left sidebar for human users

### Two Access Paths

| User | Interface | Protocol |
|------|-----------|----------|
| AI Agent (Claude Code, Codex, Cursor) | MCP Server | Tools + Resources |
| Human | Sidebar WebviewView | React UI |

---

## 3. Architecture

```
ritemark-native/
├── extensions/ritemark/
│   ├── src/
│   │   ├── ai/                      # EXISTING (keep + extend)
│   │   │   ├── openAIClient.ts      # Add embedding calls here
│   │   │   ├── apiKeyManager.ts     # Same key for chat + embeddings
│   │   │   └── connectivity.ts      # Same connectivity checks
│   │   ├── rag/                     # NEW
│   │   │   ├── indexer.ts           # File watcher + indexing orchestrator
│   │   │   ├── embeddings.ts        # OpenAI text-embedding-3-small calls
│   │   │   ├── vectorStore.ts       # sqlite-vec interface
│   │   │   ├── search.ts            # Semantic search + reranking
│   │   │   └── mcpServer.ts         # MCP server (stdio transport)
│   │   └── views/
│   │       └── UnifiedViewProvider.ts  # REPLACES AIViewProvider.ts
│   └── webview/
│       └── unified/                 # REPLACES ai/ folder
│           ├── UnifiedChat.tsx       # Single chat component
│           ├── MessageBubble.tsx     # Chat message with citations
│           ├── SelectionCard.tsx     # Shows selected text context
│           ├── ActionButtons.tsx     # [Apply] [Discard] for edits
│           └── IndexStatus.tsx       # Footer: doc count, re-index
└── rag-server/                      # Python - ONLY for doc parsing
    ├── server.py                    # FastMCP entry point + MCP tools
    ├── parser.py                    # Docling document parser
    └── requirements.txt             # docling, fastmcp (NO embeddings)
```

### Component Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Document Parser | **Docling** (IBM, MIT license) | Handles PDF, DOCX, PPTX, XLSX, HTML, images. Table extraction, OCR, layout analysis. 15k+ GitHub stars. |
| Embeddings | **OpenAI text-embedding-3-small** | 1536-dim, $0.02/1M tokens. Same API key. No local model download needed. |
| Vector Store | **sqlite-vec** (SQLite extension) | Pure C, SIMD-accelerated, works with better-sqlite3, no Python, single file DB. |
| Chat LLM | **OpenAI gpt-4o-mini** (existing) | Already integrated, streaming works, tools defined. |
| MCP Server | **FastMCP** (Python) | Official MCP SDK. Same process as Docling parser. |
| Visual Retrieval | **ColPali** (V2, optional) | For image-heavy docs: embeds page screenshots directly. No OCR needed. |
| Sidebar UI | **WebviewView** (React) | Unified chat, replaces current AI assistant. Left sidebar. |

---

## 4. Document Processing Pipeline

```
File Change Detected (FileSystemWatcher)
    │
    ▼
┌─────────────────────┐
│  Document Parser     │  Docling (Python subprocess): PDF, DOCX, PPTX
│  (Docling)           │  Output: structured text + metadata (JSON)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Chunking            │  TypeScript (extension side)
│  (512 tokens,        │  Simple recursive text splitter
│   50 overlap)        │  Preserves section headers as metadata
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Embedding           │  OpenAI text-embedding-3-small (HTTP API)
│  (OpenAI API)        │  1536-dimensional vectors, batched
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Vector Store        │  sqlite-vec (persistent, local SQLite file)
│  (Local)             │  Collection per workspace
└─────────────────────┘
```

### Simplified Dependency Chain

```
Python (only for parsing):          TypeScript (extension, everything else):
┌────────────────────┐              ┌─────────────────────────────┐
│ docling             │──JSON──→    │ chunking (simple splitter)   │
│ fastmcp (MCP tools) │              │ embeddings (OpenAI HTTP)     │
└────────────────────┘              │ vector store (sqlite-vec)      │
                                    │ chat (OpenAI streaming)      │
                                    │ sidebar UI (React)           │
                                    └─────────────────────────────┘
```

This means: Python is ONLY a document parser. All intelligence (embeddings, search, chat) stays in TypeScript.

### Supported File Types

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | Docling (layout + OCR) | Tables, figures, multi-column |
| DOCX | Docling (python-docx) | Formatting, headers, tables |
| PPTX | Docling | Slides as sections |
| XLSX | Docling (pandas) | Sheets as tables |
| Images (PNG, JPEG) | Docling (OCR) or ColPali | Text extraction or visual embedding |
| HTML | Docling | Strip tags, preserve structure |
| Markdown | Direct text | Already text, just chunk + embed |
| Plain text | Direct text | Simple chunking |

---

## 5. MCP Server Design

The MCP server exposes workspace knowledge to any MCP-compatible AI agent.

### Transport

**stdio** - launched as a subprocess by the extension, communicates via stdin/stdout. No network exposure. Local-first.

### Tools (What AI Can Do)

```python
from fastmcp import FastMCP

mcp = FastMCP("ritemark-rag")

@mcp.tool()
def search_documents(query: str, top_k: int = 5, file_types: list[str] = None) -> list[dict]:
    """Semantic search across all indexed documents in the workspace.
    Returns relevant chunks with source file, page/section, and relevance score."""
    results = vector_store.similarity_search(query, k=top_k, filter=file_types)
    return [{"content": r.content, "source": r.metadata["source"],
             "page": r.metadata.get("page"), "score": r.score} for r in results]

@mcp.tool()
def get_document_summary(file_path: str) -> dict:
    """Get a structured summary of a document (PDF, Word, etc.).
    Includes title, sections, tables, and key content."""
    doc = document_store.get(file_path)
    return {"title": doc.title, "sections": doc.sections,
            "tables": doc.table_count, "pages": doc.page_count}

@mcp.tool()
def list_indexed_documents() -> list[dict]:
    """List all indexed documents with their types, sizes, and index status."""
    return [{"path": d.path, "type": d.type, "pages": d.pages,
             "chunks": d.chunk_count, "last_indexed": d.indexed_at}
            for d in document_store.list_all()]

@mcp.tool()
def get_document_content(file_path: str, page: int = None) -> str:
    """Get the full extracted text content of a document or a specific page."""
    return document_store.get_text(file_path, page=page)
```

### Resources (What AI Should Know)

```python
@mcp.resource("rag://workspace/stats")
def workspace_stats() -> str:
    """Workspace document statistics: file counts, index status, last update."""
    stats = document_store.get_stats()
    return f"Indexed: {stats.total_docs} documents, {stats.total_chunks} chunks. "
           f"Types: {stats.type_counts}. Last update: {stats.last_update}"

@mcp.resource("rag://workspace/documents/{path}")
def document_resource(path: str) -> str:
    """Full extracted content of a specific document."""
    return document_store.get_text(path)
```

### MCP Client Configuration (for Claude Code)

Users would add to their `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ritemark-rag": {
      "command": "python",
      "args": ["-m", "ritemark_rag.server"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

Or Ritemark could auto-generate this config when RAG is enabled.

---

## 6. Unified Sidebar UI Design

### Key Decision: Merge AI Assistant + RAG into One Chat

The existing AI assistant (right sidebar, `auxiliarybar`) becomes redundant as Claude Code handles code/text editing better. Instead of two separate chat panels, we merge everything into **one unified chat** in the **left sidebar**.

| Before (current) | After (unified) |
|-------------------|-----------------|
| Right sidebar: AI assistant (rephrase, edit) | **Removed** |
| Left sidebar: (empty) | **Unified chat** (RAG + editing) |
| Two API keys to think about | One OpenAI key does all |

### Location

Left sidebar (Primary Sidebar), own Activity Bar icon. Replaces current AI assistant entirely.

### Unified Chat Wireframe

```
┌──────────────────────────┐
│ ✦ Ritemark AI            │  ← Activity Bar tab (left)
├──────────────────────────┤
│                          │
│ 💬 Mis on Q4 raporti     │
│    peamine järeldus?     │
│                          │
│ 🤖 Raporti (report.pdf  │
│    lk 3-4) põhjal on    │
│    peamine järeldus...   │
│    ──────────────────    │
│    📎 report.pdf p.3     │  ← Citation (clickable)
│                          │
│ ─────────────────────── │
│                          │
│ 💬 Tee see lõik lühemaks │  ← Text editing (selection)
│    ┌──────────────────┐  │
│    │ "Selected text..." │  │  ← Shows selected text
│    └──────────────────┘  │
│                          │
│ 🤖 [Preview]             │
│    "Shorter version..."  │
│    [Apply] [Discard]     │  ← Inline actions
│                          │
│ ─────────────────────── │
│                          │
│ ┌──────────────────────┐ │
│ │ Ask anything...       │ │  ← Input (always at bottom)
│ └──────────────────────┘ │
│                          │
├──────────────────────────┤
│ 📚 12 docs | 847 chunks │  ← Index status footer
│ ⟳ Re-index              │
└──────────────────────────┘
```

### Smart Context Detection

The chat is context-aware - it detects what the user needs based on input + state:

| Context | Behavior | Example |
|---------|----------|---------|
| No selection, question | RAG search → answer with citations | "What did the contract say about deadlines?" |
| Text selected, instruction | Edit text (rephrase/shorten/etc.) | "Make this more formal" |
| No selection, instruction | Search + apply to document | "Find all mentions of budget" |
| File reference | Get content from indexed file | "Summarize report.pdf" |

### System Prompt Strategy

```
You are Ritemark AI, a document assistant.

CAPABILITIES:
1. Answer questions using indexed workspace documents (RAG)
2. Edit selected text (rephrase, shorten, expand, translate)
3. Search across all workspace documents (PDF, Word, etc.)

CONTEXT PROVIDED:
- Selected text (if any): {selection}
- Current document: {activeFile}
- Retrieved chunks: {ragResults}

RULES:
- Always cite sources with [filename, page/section]
- For text edits, show the result and wait for [Apply] confirmation
- For questions, search indexed documents first
```

### UI Components (Simplified)

1. **Chat messages** - Conversation history with markdown rendering
2. **Selection indicator** - Shows currently selected text (when applicable)
3. **Citation chips** - Clickable source references (open file at location)
4. **Action buttons** - [Apply] / [Discard] for text edit suggestions
5. **Index status footer** - Document count, chunk count, re-index button

### What Gets Removed

The current AI assistant (`AIViewProvider.ts`, right sidebar) gets **replaced** entirely:
- `ritemark.aiView` → replaced by `ritemark.ragView` (left sidebar)
- Widget modal preview → inline in chat with [Apply] button
- Separate connectivity status → merged into footer
- Right sidebar panel → removed

### Migration Path

1. Keep existing `openAIClient.ts`, `apiKeyManager.ts`, `connectivity.ts` (backend logic)
2. Replace `AIViewProvider.ts` with new `UnifiedViewProvider.ts` (left sidebar)
3. Replace `AIChatSidebar.tsx` with new unified React component
4. Add RAG context injection before API calls
5. Remove right sidebar registration from `package.json`

### Backend: Unified OpenAI Integration

Everything runs on the **same OpenAI API key** the user already has configured:

| Function | Model | Cost |
|----------|-------|------|
| Chat / RAG answers | `gpt-4o-mini` | ~$0.15/1M input tokens |
| Text editing (rephrase etc.) | `gpt-4o-mini` | Same |
| Document embeddings | `text-embedding-3-small` | ~$0.02/1M tokens |

**Architecture:**
```
User Query (Unified Sidebar)
    ↓
Context detection: RAG query? Text edit? Search?
    ↓
[If RAG] → sqlite-vec semantic search → Top-K chunks
    ↓
System prompt + context + query → openAIClient.ts (gpt-4o-mini)
    ↓
Streaming response with [citations] or [Apply/Discard]
```

**Cost per RAG query:** ~$0.0003 (5 chunks, ~2K tokens context)
**Cost to embed 100-page PDF:** ~$0.001 (50K tokens)

**No Python needed for embeddings.** OpenAI `text-embedding-3-small` via HTTP eliminates ONNX/sentence-transformers dependency entirely. Python only needed for Docling (document parsing).

---

## 7. Implementation Strategy

### Phase 1: Document Parser + Embeddings + Vector Store

- Set up `rag-server/` Python project with `pyproject.toml` (Docling + FastMCP)
- Implement Docling parser: file path → structured JSON (text + metadata)
- Extension spawns parser via `uv run` (auto-installs deps on first run)
- Implement text chunker in TypeScript (`src/rag/chunker.ts`)
- Add OpenAI embedding calls (`src/rag/embeddings.ts`)
- Set up **sqlite-vec** vector store (`src/rag/vectorStore.ts`) via better-sqlite3
- End-to-end test: drop a PDF → parse → chunk → embed → store → search

### Phase 2: Unified Sidebar (Replace AI Assistant)

- Create `UnifiedViewProvider.ts` (left sidebar, replaces `AIViewProvider.ts`)
- Build `UnifiedChat.tsx` React component (merge search + chat + edit)
- Implement smart context detection (selection → edit mode, question → RAG mode)
- Wire up existing `openAIClient.ts` with RAG context injection
- Add citation chips (clickable → open source document)
- Add [Apply] / [Discard] for text edit suggestions (replace widget modal)
- Remove old right sidebar AI panel from `package.json`
- Add index status footer
- **Cleanup:** Delete `AIViewProvider.ts` and `AIChatSidebar.tsx` (replaced by UnifiedViewProvider)

### Phase 3: MCP Server + Auto-Indexing

- Add FastMCP server to Python process (same as Docling)
- Expose `search_documents`, `get_document_content`, `list_indexed_documents`
- Add FileSystemWatcher for auto-indexing on file changes
- Auto-generate `.claude/settings.json` MCP config (optional)
- Test with Claude Code: "What does the contract say about..."

### Phase 4: Polish + Advanced

- Incremental indexing (hash-based, only changed files)
- ColPali visual retrieval for image-heavy documents (optional, GPU)
- Batch embedding with progress indicator
- Cross-workspace search
- Export search results to markdown note

---

## 8. Dependencies

### Python (rag-server/) - MINIMAL

```
fastmcp>=2.0          # MCP server
docling>=2.0          # Document parsing (PDF, DOCX, PPTX, images)
```

No embedding models, no ONNX, no sentence-transformers. Python only parses documents.

### Node.js (extension)

```
# Already in extension dependencies:
openai@^4.73.0        # Chat + embeddings (text-embedding-3-small)
vscode (webview API)

# New:
better-sqlite3        # SQLite driver (native, fast)
sqlite-vec            # Vector search extension for SQLite
```

### System Requirements

- Python 3.11+ (for Docling document parser)
- OpenAI API key (same one already configured for AI assistant)
- ~200MB disk for Docling models (first run download, no embedding models needed)
- ~50MB RAM per 1000 document chunks in vector store
- Network connection for OpenAI API (embeddings + chat)

---

## 9. Existing Solutions Comparison

| Solution | Multi-modal | MCP | Local-first | UI | Integrated |
|----------|-------------|-----|-------------|-----|-----------|
| `rag-mcp` (PyPI) | Yes (Docling) | Yes | Yes | No | No |
| Cursor built-in | Text only | No | Yes | Yes | Yes |
| Continue.dev | Text + some | Yes | Partial | Yes | VS Code |
| **Ritemark RAG** | Yes (Docling+ColPali) | Yes | Yes | Yes | Native |

### Key Differentiator

Ritemark RAG would be unique in combining:
1. **Native integration** (not a separate tool to install)
2. **Multi-modal** (PDF tables, images, Word formatting)
3. **MCP exposure** (works with ANY MCP client)
4. **Own UI** (search + chat in sidebar)
5. **Local-first** (no cloud dependency for indexing)

---

## 10. Open Questions

### Resolved

1. ~~**Chat LLM**~~ → Reuse existing OpenAI gpt-4o-mini (same API key, same client)
2. ~~**Embeddings**~~ → OpenAI `text-embedding-3-small` (same API key, no local models)
3. ~~**Sidebar placement**~~ → Unified left sidebar, replaces current right-side AI assistant
4. ~~**Embedding model size**~~ → Not applicable, using OpenAI API
5. ~~**Vector store**~~ → **sqlite-vec** (pure C SQLite extension, works with better-sqlite3 in Node.js, no Python needed, local file, SIMD-accelerated)
6. ~~**Python dependency management**~~ → **uv** (single Rust binary, auto-creates venv, installs deps on first `uv run`, isolated from system Python)
7. ~~**Offline fallback**~~ → Cache parsed text + embeddings in SQLite. Queue un-embedded files, embed when online.

### All Questions Resolved - Ready for Implementation

---

## 11. Key References

### Multi-Modal RAG
- [VDocRAG: RAG over Visually-Rich Documents (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Tanaka_VDocRAG_Retrieval-Augmented_Generation_over_Visually-Rich_Documents_CVPR_2025_paper.pdf)
- [ColPali: Efficient Document Retrieval with Vision Language Models (ICLR 2025)](https://arxiv.org/abs/2407.01449)
- [MHier-RAG: Multi-Modal RAG for Visual-Rich Documents](https://arxiv.org/pdf/2508.00579)

### MCP + RAG
- [Integrating Agentic RAG with MCP Servers (Omar Santos)](https://becomingahacker.org/integrating-agentic-rag-with-mcp-servers-technical-implementation-guide-1aba8fd4e442)
- [Building RAG Applications Using MCP (The New Stack)](https://thenewstack.io/how-to-build-rag-applications-using-model-context-protocol/)
- [RAG MCP Server Tutorial (Medium)](https://medium.com/data-science-in-your-pocket/rag-mcp-server-tutorial-89badff90c00)
- [Building a Local RAG System with MCP for VS Code (DEV)](https://dev.to/lord_magus/building-a-local-rag-system-with-mcp-for-vs-code-ai-agents-a-technical-deep-dive-29ac)

### Tools & Frameworks
- [Docling - Document Parser (IBM, MIT)](https://github.com/docling-project/docling)
- [FastMCP - Python MCP SDK](https://github.com/jlowin/fastmcp)
- [rag-mcp PyPI package](https://pypi.org/project/rag-mcp/)
- [ChromaDB](https://www.trychroma.com/)
- [all-MiniLM-L6-v2 on HuggingFace](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [ColPali on GitHub](https://github.com/illuin-tech/colpali)
- [FastEmbed (Qdrant)](https://github.com/qdrant/fastembed)

### VS Code Integration
- [VS Code Webview Views API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Chat Participant API](https://code.visualstudio.com/api/extension-guides/ai/chat)
- [Sidebar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/sidebars)

### Claude Code Limitations
- [Claude Code PDF Bug (Issue #1510)](https://github.com/anthropics/claude-code/issues/1510)
- [Anthropic PDF Processing API](https://towardsdatascience.com/introducing-the-new-anthropic-pdf-processing-api-0010657f595f/)
