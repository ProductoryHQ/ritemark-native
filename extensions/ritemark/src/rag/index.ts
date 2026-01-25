/**
 * RiteMark RAG - Markdown document retrieval and search.
 *
 * Pipeline: Parse (markdown) → Chunk → Embed (OpenAI) → Store (Orama) → Search
 */

export { chunkText, chunkSections, TextChunk, ChunkOptions } from './chunker';
export { embedText, embedTexts, getEmbeddingDimensions } from './embeddings';
export { VectorStore, SearchResult, getDefaultDbPath } from './vectorStore';
export { DocumentIndexer, IndexerOptions, IndexProgress } from './indexer';
export { searchDocuments, buildRAGContext, RAGSearchResult, RAGSearchOptions } from './search';
