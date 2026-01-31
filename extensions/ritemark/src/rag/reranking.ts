/**
 * Multi-factor Re-ranking Service
 *
 * Re-ranks search results based on multiple factors:
 * - Base relevance (from Orama search score)
 * - Source quality (PDF > markdown > text)
 * - Recency (newer documents score higher)
 * - Specificity (query term overlap)
 * - Citation frequency (popular sources score higher)
 *
 * Based on Docify RAG investigation findings.
 */

import type { SearchResult } from './vectorStore';
import { isEnabled } from '../features';

/**
 * Weights for each re-ranking factor
 * Total should equal 1.0
 */
export const RERANKING_WEIGHTS = {
	baseRelevance: 0.40,    // Orama search score
	sourceQuality: 0.20,    // Document type quality
	recency: 0.15,          // How recently indexed
	specificity: 0.15,      // Query term overlap
	citationFrequency: 0.10, // How often cited in conversations
} as const;

/**
 * Source type quality scores
 * Higher = more authoritative
 */
export const SOURCE_QUALITY_SCORES: Record<string, number> = {
	// High quality - formal documents
	pdf: 1.0,
	research: 1.0,
	docx: 0.9,
	doc: 0.9,

	// Medium quality - structured content
	markdown: 0.8,
	md: 0.8,
	html: 0.7,

	// Lower quality - code and plain text
	code: 0.6,
	ts: 0.6,
	js: 0.6,
	py: 0.6,
	text: 0.5,
	txt: 0.5,

	// Unknown defaults to medium
	unknown: 0.5,
};

/**
 * Re-ranking factors for a single result
 */
export interface RerankingFactors {
	/** Original search score (0-1) */
	baseRelevance: number;
	/** Source type quality score (0-1) */
	sourceQuality: number;
	/** Recency score (0-1, decays over time) */
	recency: number;
	/** Query term overlap score (0-1) */
	specificity: number;
	/** Citation frequency score (0-1) */
	citationFrequency: number;
}

/**
 * Re-ranked search result with scoring details
 */
export interface RankedResult extends SearchResult {
	/** Original score before re-ranking */
	originalScore: number;
	/** Re-ranked final score */
	finalScore: number;
	/** Individual factor scores (for debugging/UI) */
	factors: RerankingFactors;
}

/**
 * Citation frequency tracker
 * Tracks how often each source is cited in conversations
 */
const citationCounts = new Map<string, number>();

/**
 * Record a citation for a source
 */
export function recordCitation(source: string): void {
	const current = citationCounts.get(source) || 0;
	citationCounts.set(source, current + 1);
}

/**
 * Get citation count for a source
 */
export function getCitationCount(source: string): number {
	return citationCounts.get(source) || 0;
}

/**
 * Calculate source quality score based on document type
 */
function calculateSourceQuality(sourceType: string | undefined): number {
	if (!sourceType) return SOURCE_QUALITY_SCORES.unknown;
	const normalized = sourceType.toLowerCase();
	return SOURCE_QUALITY_SCORES[normalized] ?? SOURCE_QUALITY_SCORES.unknown;
}

/**
 * Calculate recency score with exponential decay
 * Newer documents score higher
 *
 * @param createdAt - ISO timestamp of when indexed
 * @param halfLifeDays - Days until score halves (default: 365)
 */
function calculateRecency(
	createdAt: string | undefined,
	halfLifeDays: number = 365
): number {
	if (!createdAt) return 0.5; // Unknown age gets neutral score

	const indexedDate = new Date(createdAt).getTime();
	const now = Date.now();
	const daysSinceIndexed = (now - indexedDate) / (1000 * 60 * 60 * 24);

	// Exponential decay: score = e^(-λt) where λ = ln(2) / halfLife
	const lambda = Math.log(2) / halfLifeDays;
	return Math.exp(-lambda * daysSinceIndexed);
}

/**
 * Calculate specificity score based on query term overlap
 *
 * @param content - Document chunk content
 * @param query - Original search query
 */
function calculateSpecificity(content: string, query: string): number {
	if (!query || !content) return 0.5;

	// Tokenize query and content
	const queryTerms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 2); // Skip short words

	if (queryTerms.length === 0) return 0.5;

	const contentLower = content.toLowerCase();

	// Count how many query terms appear in content
	let matchCount = 0;
	for (const term of queryTerms) {
		if (contentLower.includes(term)) {
			matchCount++;
		}
	}

	return matchCount / queryTerms.length;
}

/**
 * Calculate citation frequency score
 * Normalized to 0-1 based on max citations across all sources
 */
function calculateCitationFrequency(source: string): number {
	const count = getCitationCount(source);
	if (count === 0) return 0;

	// Find max citations for normalization
	let maxCitations = 1;
	for (const c of citationCounts.values()) {
		if (c > maxCitations) maxCitations = c;
	}

	return count / maxCitations;
}

/**
 * Calculate final re-ranked score from factors
 */
function calculateFinalScore(factors: RerankingFactors): number {
	return (
		RERANKING_WEIGHTS.baseRelevance * factors.baseRelevance +
		RERANKING_WEIGHTS.sourceQuality * factors.sourceQuality +
		RERANKING_WEIGHTS.recency * factors.recency +
		RERANKING_WEIGHTS.specificity * factors.specificity +
		RERANKING_WEIGHTS.citationFrequency * factors.citationFrequency
	);
}

/**
 * Re-rank search results using multi-factor scoring
 *
 * @param results - Original search results from Orama
 * @param query - Original search query
 * @returns Re-ranked results sorted by final score
 */
export function rerank(
	results: SearchResult[],
	query: string
): RankedResult[] {
	// Skip re-ranking if flag is disabled
	if (!isEnabled('rag-v2-enhancements')) {
		return results.map(r => ({
			...r,
			originalScore: r.score,
			finalScore: r.score,
			factors: {
				baseRelevance: r.score,
				sourceQuality: 0.5,
				recency: 0.5,
				specificity: 0.5,
				citationFrequency: 0,
			},
		}));
	}

	const rankedResults: RankedResult[] = results.map(result => {
		// Calculate individual factors
		const factors: RerankingFactors = {
			baseRelevance: result.score,
			sourceQuality: calculateSourceQuality(result.sourceType),
			recency: calculateRecency(result.createdAt),
			specificity: calculateSpecificity(result.content, query),
			citationFrequency: calculateCitationFrequency(result.source),
		};

		// Calculate weighted final score
		const finalScore = calculateFinalScore(factors);

		return {
			...result,
			originalScore: result.score,
			finalScore,
			factors,
		};
	});

	// Sort by final score (descending)
	rankedResults.sort((a, b) => b.finalScore - a.finalScore);

	return rankedResults;
}

/**
 * Reranker class for stateful re-ranking operations
 */
export class Reranker {
	private query: string;

	constructor(query: string) {
		this.query = query;
	}

	/**
	 * Re-rank search results
	 */
	rerank(results: SearchResult[]): RankedResult[] {
		return rerank(results, this.query);
	}

	/**
	 * Get top N results after re-ranking
	 */
	getTopResults(results: SearchResult[], n: number = 5): RankedResult[] {
		const ranked = this.rerank(results);
		return ranked.slice(0, n);
	}
}
