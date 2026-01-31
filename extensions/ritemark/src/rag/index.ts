/**
 * RiteMark RAG - Document retrieval and search.
 *
 * v1 Pipeline: Parse → Chunk → Embed → Store → Search
 * v2 Pipeline: Parse → Chunk → Embed → Store → Hybrid Search → Re-rank → Assemble → Verify
 */

// Core pipeline
export { chunkText, chunkSections, TextChunk, ChunkOptions } from './chunker';
export { embedText, embedTexts, getEmbeddingDimensions } from './embeddings';
export { VectorStore, SearchResult, getDefaultDbPath } from './vectorStore';
export { DocumentIndexer, IndexerOptions, IndexProgress } from './indexer';

// Search (v1 and v2)
export {
	searchDocuments,
	searchDocumentsEnhanced,
	buildRAGContext,
	verifyResponse,
	RAGSearchResult,
	RAGSearchOptions,
	EnhancedRAGResult,
} from './search';

// v2 Enhancements
export { rerank, Reranker, RankedResult, RerankingFactors, recordCitation } from './reranking';
export { assembleContext, ContextAssembler, AssembledContext, SourceReference } from './contextAssembly';
export { buildPrompt, buildRAGPrompt, PromptBuilder, PromptType, detectPromptType } from './prompts';
export { verifyCitations, CitationVerifier, VerificationReport, VerificationResult } from './citationVerifier';

// Document Parsers
export { parseDocument, isParseableExtension, getAllParseableExtensions } from './parsers';
