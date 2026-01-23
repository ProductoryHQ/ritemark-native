/**
 * Semantic search interface for the RAG pipeline.
 * Wraps vector store search with query embedding and result formatting.
 */

import { embedText } from './embeddings';
import { VectorStore, SearchResult } from './vectorStore';

export interface RAGSearchOptions {
	/** Number of results to return (default: 5) */
	topK?: number;
	/** Filter results to specific source file pattern */
	sourceFilter?: string;
	/** Minimum similarity score threshold (0-1, default: 0.3) */
	minScore?: number;
}

export interface RAGSearchResult extends SearchResult {
	/** Formatted citation string */
	citation: string;
}

/**
 * Search indexed documents using natural language query.
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

	// Search vector store
	const results = store.search(embedding, topK, options?.sourceFilter);

	// Filter by minimum score and format
	return results
		.filter(r => r.score >= minScore)
		.map(r => ({
			...r,
			citation: formatCitation(r),
		}));
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
