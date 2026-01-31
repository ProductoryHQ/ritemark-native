/**
 * Semantic search interface for the RAG pipeline.
 *
 * Sprint 27 v2 enhancements (when rag-v2-enhancements flag enabled):
 * - Hybrid search (vector + BM25)
 * - Multi-factor re-ranking
 * - Smart context assembly
 * - Anti-hallucination prompts
 * - Citation verification
 */

import { embedText } from './embeddings';
import { VectorStore, SearchResult } from './vectorStore';
import { rerank, RankedResult } from './reranking';
import { assembleContext, AssembledContext, SourceReference } from './contextAssembly';
import { buildRAGPrompt, PromptType, buildPrompt } from './prompts';
import { verifyCitations, VerificationReport, CitationVerifier } from './citationVerifier';
import { isEnabled } from '../features';

export interface RAGSearchOptions {
	/** Number of results to return (default: 5) */
	topK?: number;
	/** Filter results to specific source file pattern */
	sourceFilter?: string;
	/** Minimum similarity score threshold (0-1, default: 0.3) */
	minScore?: number;
	/** Token budget for context assembly (default: 2000) */
	tokenBudget?: number;
}

export interface RAGSearchResult extends SearchResult {
	/** Formatted citation string */
	citation: string;
}

/**
 * Enhanced search result with v2 pipeline data
 */
export interface EnhancedRAGResult {
	/** Re-ranked search results */
	results: RankedResult[];
	/** Assembled context for LLM */
	context: AssembledContext;
	/** Built prompt for LLM */
	prompt: string;
	/** Source content map for citation verification */
	sourceContents: Map<number, string>;
}

/**
 * Search indexed documents using natural language query.
 * Uses v2 pipeline when rag-v2-enhancements flag is enabled.
 */
export async function searchDocuments(
	store: VectorStore,
	query: string,
	options?: RAGSearchOptions
): Promise<RAGSearchResult[]> {
	const topK = options?.topK ?? 5;
	const minScore = options?.minScore ?? 0.3;

	// Embed the query
	const { embedding } = await embedText(query);

	// Search vector store (hybrid: vector + full-text when flag enabled)
	const results = await store.search(embedding, topK * 2, options?.sourceFilter, query);

	// Apply re-ranking if v2 enhancements enabled
	const rankedResults = rerank(results, query);

	// Filter by minimum score and format
	return rankedResults
		.filter(r => r.finalScore >= minScore || r.score >= minScore)
		.slice(0, topK)
		.map(r => ({
			...r,
			citation: formatCitation(r),
		}));
}

/**
 * Enhanced search with full v2 pipeline.
 * Returns context assembly, prompt, and source data for verification.
 */
export async function searchDocumentsEnhanced(
	store: VectorStore,
	query: string,
	options?: RAGSearchOptions
): Promise<EnhancedRAGResult> {
	const topK = options?.topK ?? 10;
	const tokenBudget = options?.tokenBudget ?? 2000;

	// Embed the query
	const { embedding } = await embedText(query);

	// Search with extra results for re-ranking
	const results = await store.search(embedding, topK * 2, options?.sourceFilter, query);

	// Re-rank results
	const rankedResults = rerank(results, query);

	// Assemble context with token budget
	const context = assembleContext(rankedResults.slice(0, topK), tokenBudget);

	// Build source content map for citation verification
	const sourceContents = new Map<number, string>();
	for (const source of context.sources) {
		const result = rankedResults.find(r => r.source === source.source);
		if (result) {
			sourceContents.set(source.index, result.content);
		}
	}

	// Build prompt
	const prompt = buildRAGPrompt(context, query);

	return {
		results: rankedResults.slice(0, topK),
		context,
		prompt,
		sourceContents,
	};
}

/**
 * Verify citations in an LLM response.
 */
export function verifyResponse(
	response: string,
	sources: SourceReference[],
	sourceContents: Map<number, string>
): VerificationReport {
	return verifyCitations(response, sources, sourceContents);
}

/**
 * Format a search result as a citation string.
 */
function formatCitation(result: SearchResult): string {
	const parts: string[] = [];

	// File name (without full path)
	const fileName = result.source.split('/').pop() || result.source;
	parts.push(fileName);

	// Page number
	if (result.page) {
		parts.push(`p.${result.page}`);
	}

	// Section
	if (result.section) {
		parts.push(`"${result.section}"`);
	}

	return parts.join(', ');
}

/**
 * Build RAG context string for the LLM system prompt.
 * Formats search results as numbered context chunks.
 */
export function buildRAGContext(results: RAGSearchResult[]): string {
	if (results.length === 0) {
		return 'No relevant documents found in the workspace.';
	}

	const contextParts = results.map((r, i) => {
		const header = `[${i + 1}] ${r.citation} (relevance: ${(r.score * 100).toFixed(0)}%)`;
		return `${header}\n${r.content}`;
	});

	return `Found ${results.length} relevant document chunks:\n\n${contextParts.join('\n\n---\n\n')}`;
}
