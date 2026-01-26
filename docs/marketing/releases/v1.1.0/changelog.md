## [1.1.0] - 2026-01-26

### Added
- **Document Search** - Ask questions about your markdown documents and get AI-powered answers with source citations
- "Re-index" button in sidebar footer to index workspace files
- Document count display in footer after indexing
- Local vector search using Orama database
- Privacy-first: index stored locally in `.ritemark/rag-index.json`

### Technical
- Orama vector database (zero native dependencies)
- OpenAI text-embedding-3-small for embeddings
- Base64 embedded images automatically filtered during indexing

### Phase 1 (This Release)
- Markdown files only (.md, .markdown)
- Requires OpenAI API key

### Roadmap
- Phase 2: PDF, Word, PowerPoint support
- Phase 3: Claude Code integration (MCP)
