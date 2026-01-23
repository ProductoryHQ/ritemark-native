/**
 * RiteMark RAG - Multi-modal document retrieval and search.
 *
 * Pipeline: Parse (Docling) → Chunk → Embed (OpenAI) → Store (sqlite-vec) → Search
 */

export { chunkText, chunkSections, TextChunk, ChunkOptions } from './chunker';
export { embedText, embedTexts, getEmbeddingDimensions } from './embeddings';
export { VectorStore, SearchResult, getDefaultDbPath } from './vectorStore';
export { DocumentIndexer, IndexerOptions, IndexProgress } from './indexer';
export { searchDocuments, buildRAGContext, RAGSearchResult, RAGSearchOptions } from './search';
export { MCPServerManager, MCPServerOptions } from './mcpServer';
