/**
 * Context Assembly Service
 *
 * Assembles search results into a context string for LLM prompts.
 * Uses a token budget allocation strategy:
 * - Primary (60%): Top-ranked chunks
 * - Supporting (30%): Additional context
 * - Metadata (10%): Document titles, sections
 *
 * Features:
 * - Smart truncation at sentence boundaries
 * - Deduplication of similar content
 * - Token budget management
 */

import type { RankedResult } from './reranking';
import { isEnabled } from '../features';

/**
 * Token budget allocation (percentages)
 */
export const BUDGET_ALLOCATION = {
	primary: 0.60,      // Top-ranked chunks
	supporting: 0.30,   // Additional context
	metadata: 0.10,     // Titles, sections
} as const;

/**
 * Assembled context ready for LLM
 */
export interface AssembledContext {
	/** Formatted context string for prompt */
	context: string;
	/** Number of sources included */
	sourceCount: number;
	/** Source metadata for citation references */
	sources: SourceReference[];
	/** Token usage breakdown */
	tokenUsage: {
		total: number;
		primary: number;
		supporting: number;
		metadata: number;
	};
	/** Any warnings about truncation or deduplication */
	warnings: string[];
}

/**
 * Source reference for citations
 */
export interface SourceReference {
	/** Source index (for [Source N] citations) */
	index: number;
	/** File path or URL */
	source: string;
	/** Page number if available */
	page: number | null;
	/** Section heading if available */
	section: string | null;
	/** Document type */
	sourceType: string;
}

/**
 * Simple token estimation
 * ~4 characters per token (rough approximation)
 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Truncate text at sentence boundary
 */
function truncateAtSentence(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;

	// Find last sentence boundary before limit
	const truncated = text.slice(0, maxChars);
	const lastSentence = truncated.lastIndexOf('. ');
	const lastNewline = truncated.lastIndexOf('\n');

	const boundary = Math.max(lastSentence, lastNewline);

	if (boundary > maxChars * 0.5) {
		return truncated.slice(0, boundary + 1).trim() + '...';
	}

	// No good boundary found, hard truncate
	return truncated.trim() + '...';
}

/**
 * Calculate content similarity (simple Jaccard-like)
 */
function calculateSimilarity(a: string, b: string): number {
	const wordsA = new Set(a.toLowerCase().split(/\s+/).slice(0, 50));
	const wordsB = new Set(b.toLowerCase().split(/\s+/).slice(0, 50));

	let intersection = 0;
	for (const word of wordsA) {
		if (wordsB.has(word)) intersection++;
	}

	const union = wordsA.size + wordsB.size - intersection;
	return union > 0 ? intersection / union : 0;
}

/**
 * Deduplicate results by content similarity
 */
function deduplicateResults(
	results: RankedResult[],
	threshold: number = 0.8
): { results: RankedResult[]; duplicates: number } {
	const unique: RankedResult[] = [];
	let duplicates = 0;

	for (const result of results) {
		const isDuplicate = unique.some(
			existing => calculateSimilarity(existing.content, result.content) > threshold
		);

		if (isDuplicate) {
			duplicates++;
		} else {
			unique.push(result);
		}
	}

	return { results: unique, duplicates };
}

/**
 * Format a chunk for the context string
 */
function formatChunk(result: RankedResult, index: number): string {
	const lines: string[] = [];

	// Source header
	let header = `[Source ${index + 1}]`;
	if (result.section) {
		header += ` ${result.section}`;
	}
	if (result.page) {
		header += ` (Page ${result.page})`;
	}

	lines.push(header);
	lines.push(result.content);
	lines.push(''); // Empty line separator

	return lines.join('\n');
}

/**
 * Assemble context from ranked results
 *
 * @param results - Re-ranked search results
 * @param tokenBudget - Maximum tokens for context (default 2000)
 * @returns Assembled context with metadata
 */
export function assembleContext(
	results: RankedResult[],
	tokenBudget: number = 2000
): AssembledContext {
	const warnings: string[] = [];

	// Skip assembly enhancements if flag is disabled
	if (!isEnabled('rag-v2-enhancements')) {
		return assembleBasicContext(results, tokenBudget);
	}

	// Deduplicate results
	const { results: uniqueResults, duplicates } = deduplicateResults(results);
	if (duplicates > 0) {
		warnings.push(`Removed ${duplicates} duplicate chunks`);
	}

	// Calculate character budgets (4 chars per token)
	const charBudget = tokenBudget * 4;
	const primaryBudget = charBudget * BUDGET_ALLOCATION.primary;
	const supportingBudget = charBudget * BUDGET_ALLOCATION.supporting;
	const metadataBudget = charBudget * BUDGET_ALLOCATION.metadata;

	// Split results into primary (top 30% or score > 0.7) and supporting
	const primaryCount = Math.max(1, Math.ceil(uniqueResults.length * 0.3));
	const primaryResults = uniqueResults.slice(0, primaryCount);
	const supportingResults = uniqueResults.slice(primaryCount);

	// Build context sections
	const contextParts: string[] = [];
	const sources: SourceReference[] = [];
	let primaryChars = 0;
	let supportingChars = 0;
	let metadataChars = 0;

	// Add primary chunks
	for (const result of primaryResults) {
		const formatted = formatChunk(result, sources.length);

		if (primaryChars + formatted.length > primaryBudget) {
			// Truncate if over budget
			const remaining = primaryBudget - primaryChars;
			if (remaining > 100) {
				const truncated = truncateAtSentence(formatted, remaining);
				contextParts.push(truncated);
				primaryChars += truncated.length;
				warnings.push(`Truncated primary chunk from ${result.source}`);
			}
			break;
		}

		contextParts.push(formatted);
		primaryChars += formatted.length;

		sources.push({
			index: sources.length + 1,
			source: result.source,
			page: result.page,
			section: result.section,
			sourceType: result.sourceType || 'unknown',
		});
	}

	// Add supporting chunks
	for (const result of supportingResults) {
		const formatted = formatChunk(result, sources.length);

		if (supportingChars + formatted.length > supportingBudget) {
			break;
		}

		contextParts.push(formatted);
		supportingChars += formatted.length;

		sources.push({
			index: sources.length + 1,
			source: result.source,
			page: result.page,
			section: result.section,
			sourceType: result.sourceType || 'unknown',
		});
	}

	// Build metadata section
	const metadataLines: string[] = ['---', 'Sources:'];
	for (const source of sources) {
		let line = `${source.index}. ${source.source}`;
		if (source.page) line += ` (p${source.page})`;
		if (metadataChars + line.length <= metadataBudget) {
			metadataLines.push(line);
			metadataChars += line.length;
		}
	}

	const context = [...contextParts, metadataLines.join('\n')].join('\n');

	return {
		context,
		sourceCount: sources.length,
		sources,
		tokenUsage: {
			total: estimateTokens(context),
			primary: estimateTokens(contextParts.slice(0, primaryResults.length).join('\n')),
			supporting: estimateTokens(contextParts.slice(primaryResults.length).join('\n')),
			metadata: estimateTokens(metadataLines.join('\n')),
		},
		warnings,
	};
}

/**
 * Basic context assembly (Sprint 24 fallback)
 */
function assembleBasicContext(
	results: RankedResult[],
	tokenBudget: number
): AssembledContext {
	const charBudget = tokenBudget * 4;
	const contextParts: string[] = [];
	const sources: SourceReference[] = [];
	let totalChars = 0;

	for (const result of results) {
		const formatted = formatChunk(result, sources.length);

		if (totalChars + formatted.length > charBudget) {
			break;
		}

		contextParts.push(formatted);
		totalChars += formatted.length;

		sources.push({
			index: sources.length + 1,
			source: result.source,
			page: result.page,
			section: result.section,
			sourceType: result.sourceType || 'unknown',
		});
	}

	const context = contextParts.join('\n');

	return {
		context,
		sourceCount: sources.length,
		sources,
		tokenUsage: {
			total: estimateTokens(context),
			primary: estimateTokens(context),
			supporting: 0,
			metadata: 0,
		},
		warnings: [],
	};
}

/**
 * Context assembler class for stateful operations
 */
export class ContextAssembler {
	private tokenBudget: number;

	constructor(tokenBudget: number = 2000) {
		this.tokenBudget = tokenBudget;
	}

	/**
	 * Assemble context from results
	 */
	assemble(results: RankedResult[]): AssembledContext {
		return assembleContext(results, this.tokenBudget);
	}

	/**
	 * Set token budget
	 */
	setBudget(budget: number): void {
		this.tokenBudget = budget;
	}
}
