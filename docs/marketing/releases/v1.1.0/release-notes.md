# RiteMark v1.1.0

**Released:** 2026-01-26  
**Type:** Minor (significant feature addition)  
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg)

## Highlights

RiteMark v1.1.0 introduces **Document Search** - ask questions about your own documents and get answers from your notes, complete with source citations.

## What's New

### Document Search (with RiteMark AI assistant)

Your **Ritemark AI assistant** now understands your workspace. Index your markdown files once, then ask questions like "What did I write about project X?" or "Summarize my notes on Y" - and get answers drawn from your own documents.

**Key features:**

-   Click "Re-index" in the sidebar footer to index all markdown files
    
-   Ask questions in natural language
    
-   Get answers grounded in YOUR documents, not generic AI knowledge
    
-   Source citations show exactly where information came from
    
-   Fast local search - your files never leave your computer
    

**Privacy-first design:**

-   Index stored locally in `.ritemark/rag-index.json`
    
-   No document content sent to cloud storage
    
-   Search is entirely local after indexing
    
-   Only embeddings generation uses OpenAI API
    

## How to Use

1.  Open a workspace containing markdown files
    
2.  Click the RiteMark AI icon in the left sidebar
    
3.  Click "Re-index" in the footer
    
4.  Ask questions about your documents
    

**Example questions:**

-   "What did I write about the Q3 planning meeting?"
    
-   "Summarize my notes on the new product launch"
    
-   "Find all mentions of budget discussions"
    

## Roadmap: What's Coming

This is **Phase 1** of Document Search. Here's what's planned:

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | Markdown files (.md) | **This release** |
| 2 | PDF, Word, PowerPoint | Coming soon |
| 3 | Claude Code integration (MCP) | Planned |

**Phase 2** will add support for PDF, Word (.docx), and PowerPoint (.pptx) files - search across all your documents, not just markdown.

**Phase 3** will enable external AI tools like Claude Code to search your indexed documents via MCP (Model Context Protocol). Developers will be able to use their favorite AI coding assistant with full access to project documentation.

## Current Limitations (Phase 1)

-   **Markdown only:** Currently indexes .md and .markdown files
    
-   **Requires OpenAI API key:** For generating embeddings
    
-   **Manual re-index:** Click "Re-index" after significant file changes
    

## Technical Notes

-   Base: VS Code OSS 1.94.0
    
-   Platform: macOS (Apple Silicon)
    
-   Vector database: Orama (local, zero dependencies)
    
-   Embedding model: OpenAI text-embedding-3-small
    
-   Index location: `.ritemark/rag-index.json`
    

## Upgrade Notes

1.  Download RiteMark.dmg from GitHub Releases
    
2.  Drag to Applications (replace existing)
    
3.  Launch and click "Re-index" to build search index