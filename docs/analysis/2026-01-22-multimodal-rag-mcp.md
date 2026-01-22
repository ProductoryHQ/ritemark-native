# Multi-Modal RAG + MCP Integration for RiteMark

**Date:** 2026-01-22
**Status:** Research / Feature Design
**Problem:** AI agents (Claude Code, Codex) cannot read binary files (PDF, Word, PPTX, images) in the workspace. `grep` and `Read` tools fail on binary content.

---

## 1. Problem Statement

When a RiteMark workspace contains non-text files:
- **PDFs** - Claude Code returns "Error: This tool cannot read binary files" ([Issue #1510](https://github.com/anthropics/claude-code/issues/1510))
- **Word (.docx)** - Binary XML archive, grep finds nothing useful
- **PowerPoint (.pptx)** - Same as Word
- **Images with text** - Completely invisible to text-based tools
- **Scanned documents** - No text layer at all

This means a significant portion of project knowledge is **invisible** to AI assistants, even though it sits right there in the project folder.

### What Anthropic's Team Says

Per GitHub Issue #1510, Claude Code's `Read` tool explicitly rejects binary files. The API and web interface support PDF (up to 32MB, 100 pages via vision), but the CLI tools do not. There is no built-in solution for indexing workspace binary files.

---

## 2. Proposed Solution: RiteMark RAG

A **local-first** multi-modal RAG system built into RiteMark that:

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
│   │   ├── rag/
│   │   │   ├── indexer.ts          # File watcher + indexing orchestrator
│   │   │   ├── docProcessor.ts     # Calls Docling/parser for each file type
│   │   │   ├── embeddings.ts       # Local embedding generation (ONNX)
│   │   │   ├── vectorStore.ts      # ChromaDB/SQLite-vec interface
│   │   │   ├── search.ts           # Semantic search + reranking
│   │   │   └── mcpServer.ts        # FastMCP server (stdio transport)
│   │   └── views/
│   │       └── ragSidebar.ts       # WebviewViewProvider for sidebar
│   └── webview/
│       └── rag/                    # React sidebar UI
│           ├── SearchView.tsx
│           ├── ChatView.tsx
│           └── DocumentList.tsx
└── rag-server/                     # Python MCP server (separate process)
    ├── server.py                   # FastMCP entry point
    ├── indexer.py                  # Document processing pipeline
    ├── embeddings.py               # Embedding model management
    └── requirements.txt
```

### Component Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Document Parser | **Docling** (IBM, MIT license) | Handles PDF, DOCX, PPTX, XLSX, HTML, images. Table extraction, OCR, layout analysis. 15k+ GitHub stars. |
| Embedding Model | **all-MiniLM-L6-v2** (ONNX) | 22M params, 384-dim vectors, runs on CPU. 256 token limit per chunk. |
| Vector Store | **ChromaDB** (local) or **sqlite-vec** | Local-first, no cloud dependency. ChromaDB is proven with RAG. sqlite-vec is lighter. |
| MCP Server | **FastMCP** (Python) | Official MCP SDK integration. Simple decorator-based API. |
| Visual Retrieval | **ColPali** (optional, advanced) | For image-heavy docs: embeds page screenshots directly. No OCR needed. ICLR 2025. |
| Sidebar UI | **WebviewView** (React) | Consistent with existing RiteMark webview approach. |

---

## 4. Document Processing Pipeline

```
File Change Detected (FileSystemWatcher)
    │
    ▼
┌─────────────────────┐
│  Document Parser     │  Docling: PDF, DOCX, PPTX, images
│  (Docling)           │  Output: structured text + metadata
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Chunking            │  LangChain RecursiveCharacterTextSplitter
│  (512 tokens,        │  Overlap: 50 tokens
│   50 overlap)        │  Preserves section headers as metadata
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Embedding           │  all-MiniLM-L6-v2 (ONNX Runtime)
│  (Local, CPU)        │  384-dimensional vectors
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Vector Store        │  ChromaDB (persistent, local)
│  (ChromaDB)          │  Collection per workspace
└─────────────────────┘
```

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

Or RiteMark could auto-generate this config when RAG is enabled.

---

## 6. Sidebar UI Design

### Location

Left sidebar, own Activity Bar icon (book/search icon). Uses VS Code's `WebviewViewProvider` API.

### Views

```
┌──────────────────────────┐
│ 🔍 RiteMark RAG          │  ← Activity Bar tab
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Search documents...  │ │  ← Search input
│ └──────────────────────┘ │
│                          │
│ Results:                 │
│ ┌──────────────────────┐ │
│ │ 📄 report.pdf p.3    │ │  ← Click to preview
│ │ "...revenue grew by  │ │
│ │  23% in Q4..."       │ │
│ ├──────────────────────┤ │
│ │ 📝 notes.docx §2    │ │
│ │ "...meeting decided  │ │
│ │  to postpone..."     │ │
│ └──────────────────────┘ │
│                          │
│ ─── Chat ─────────────── │
│ ┌──────────────────────┐ │
│ │ Ask about your docs  │ │  ← Chat input
│ └──────────────────────┘ │
│                          │
│ 💬 What does the Q4     │
│    report say about     │
│    revenue targets?     │
│                          │
│ 🤖 Based on report.pdf │
│    (p.3-4), revenue     │
│    targets were...      │
│                          │
├──────────────────────────┤
│ Indexed: 12 docs, 847   │  ← Status bar
│ chunks | Last: 2min ago │
└──────────────────────────┘
```

### UI Components

1. **Search Tab** - Semantic search with file type filters, preview snippets
2. **Chat Tab** - RAG-powered Q&A about workspace documents
3. **Documents Tab** - List of indexed files, index status, re-index button
4. **Status** - Index progress, chunk count, last update time

### Chat Backend: Existing OpenAI Integration (REUSE)

RiteMark already has a **production-ready AI assistant** on OpenAI API (gpt-4o-mini). The RAG chat should reuse this infrastructure:

| Existing Component | File | Reuse for RAG |
|-------------------|------|---------------|
| OpenAI streaming client | `src/ai/openAIClient.ts` | Send RAG-augmented prompts |
| API key management | `src/ai/apiKeyManager.ts` | Same key, no new config |
| Connectivity monitor | `src/ai/connectivity.ts` | Same health checks |
| Chat UI patterns | `webview/src/components/ai/AIChatSidebar.tsx` | Similar React component |
| WebviewViewProvider | `src/ai/AIViewProvider.ts` | Pattern for left sidebar |

**Architecture:**
```
User Query (RAG Sidebar)
    ↓
ChromaDB semantic search → Top-K chunks
    ↓
System prompt + chunks + query → openAIClient.ts (gpt-4o-mini)
    ↓
Streaming response with [source citations]
```

**Cost:** gpt-4o-mini at ~$0.15/1M input tokens. A typical RAG query with 5 chunks (~2K tokens context) costs ~$0.0003 per query.

**No new LLM dependencies needed.** Same API key, same client, same streaming pattern.

---

## 7. Implementation Strategy

### Phase 1: Core RAG Pipeline (Python backend)

- Set up Python project with FastMCP + Docling + ChromaDB
- Implement document processing pipeline (PDF, DOCX first)
- Implement embedding with all-MiniLM-L6-v2 (ONNX)
- Implement semantic search
- Expose as MCP server (stdio transport)
- Test with Claude Code manually

### Phase 2: VS Code Integration

- FileSystemWatcher for auto-indexing on file changes
- Extension spawns Python MCP server as subprocess
- WebviewViewProvider for sidebar
- Search UI (React component)
- Document list view

### Phase 3: Chat UI (Reuse Existing OpenAI Client)

- Add chat interface to RAG sidebar (pattern from AIChatSidebar.tsx)
- Create RAG-specific system prompt with retrieved chunks as context
- Reuse `openAIClient.ts` streaming logic for gpt-4o-mini
- Reuse `apiKeyManager.ts` - same API key as existing AI assistant
- Citation links (click to open source document at specific page/section)

### Phase 4: Advanced Features

- ColPali visual retrieval for image-heavy documents
- Incremental indexing (only changed files)
- Cross-workspace search
- Export search results to markdown
- Auto-generated MCP config for Claude Code

---

## 8. Dependencies

### Python (rag-server/)

```
fastmcp>=2.0
docling>=2.0
chromadb>=0.5
sentence-transformers>=3.0
onnxruntime>=1.17
langchain-text-splitters>=0.2
```

### Node.js (extension)

```
# Already in extension dependencies:
vscode (webview API)

# New:
# (Python server managed as subprocess, no Node RAG deps needed)
```

### System Requirements

- Python 3.11+ (for Docling)
- ~500MB disk for embedding model + Docling models (first run download)
- ~50MB RAM per 1000 document chunks in ChromaDB

---

## 9. Existing Solutions Comparison

| Solution | Multi-modal | MCP | Local-first | UI | Integrated |
|----------|-------------|-----|-------------|-----|-----------|
| `rag-mcp` (PyPI) | Yes (Docling) | Yes | Yes | No | No |
| Cursor built-in | Text only | No | Yes | Yes | Yes |
| Continue.dev | Text + some | Yes | Partial | Yes | VS Code |
| **RiteMark RAG** | Yes (Docling+ColPali) | Yes | Yes | Yes | Native |

### Key Differentiator

RiteMark RAG would be unique in combining:
1. **Native integration** (not a separate tool to install)
2. **Multi-modal** (PDF tables, images, Word formatting)
3. **MCP exposure** (works with ANY MCP client)
4. **Own UI** (search + chat in sidebar)
5. **Local-first** (no cloud dependency for indexing)

---

## 10. Open Questions

1. **Embedding model size vs quality** - all-MiniLM (22M, fast) vs BGE-small (33M, better) vs nomic-embed (137M, best)?
2. **Python dependency management** - Bundle Python? Use system Python? Use `uv` for isolated env?
3. **First-run experience** - Models download on first use (~500MB). Show progress? Pre-bundle?
4. **Chunk size strategy** - 512 tokens works for search. But for chat context, bigger chunks (1024) might be better.
5. **Image handling** - OCR everything, or use ColPali for visual retrieval? ColPali needs GPU.
6. ~~**Chat LLM**~~ - **RESOLVED:** Reuse existing OpenAI gpt-4o-mini integration (same API key, same client).
7. **Auto-start MCP** - Should RiteMark auto-register as MCP server in Claude Code config?
8. **Sidebar placement** - Existing AI assistant is in right sidebar (auxiliarybar). RAG in left sidebar (primary)? Or same panel with tabs?
9. **Embedding via OpenAI?** - Instead of local all-MiniLM, use `text-embedding-3-small` via same API key? Simpler (no ONNX/Python for embeddings) but needs network.

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
