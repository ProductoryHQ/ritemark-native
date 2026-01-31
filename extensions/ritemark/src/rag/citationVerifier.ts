/**
 * Citation Verification Service
 *
 * Verifies that LLM responses correctly cite sources from the context.
 * Detects:
 * - Invalid citations (source not in context)
 * - Weak citations (low text overlap)
 * - Uncited claims (strong statements without citations)
 * - Hallucinated citations (made up sources)
 */

import type { SourceReference } from './contextAssembly';
import { isEnabled } from '../features';
import { recordCitation } from './reranking';

/**
 * Citation pattern: [Source N] or [Source N, Source M]
 */
const CITATION_PATTERN = /\[Source\s*(\d+(?:\s*,\s*\d+)*)\]/gi;

/**
 * Quote pattern: "text" [Source N]
 */
const QUOTE_PATTERN = /"([^"]+)"\s*\[Source\s*(\d+)\]/gi;

/**
 * Indicators of strong claims that should have citations
 */
const CLAIM_INDICATORS = [
	/according to/i,
	/research shows/i,
	/studies indicate/i,
	/\d+%/,
	/the study found/i,
	/evidence suggests/i,
	/data indicates/i,
	/it is proven/i,
	/experts agree/i,
	/statistics show/i,
];

/**
 * Verification thresholds
 */
const THRESHOLDS = {
	/** Minimum overlap to consider citation verified */
	MIN_OVERLAP: 0.3,
	/** Overlap for high confidence verification */
	HIGH_CONFIDENCE: 0.7,
};

/**
 * Verification result for a single citation
 */
export interface VerificationResult {
	/** The citation string (e.g., "[Source 3]") */
	citation: string;
	/** Source indices referenced */
	sourceIndices: number[];
	/** Whether citation is verified */
	verified: boolean;
	/** Confidence score (0-1) */
	confidence: number;
	/** Best matching text from source */
	matchedText: string;
	/** Issues found */
	issues: string[];
	/** Verification status for UI */
	status: 'verified' | 'weak' | 'invalid';
}

/**
 * Uncited claim detection result
 */
export interface UncitedClaim {
	/** The claim text */
	claim: string;
	/** Indicator that triggered detection */
	indicator: string;
	/** Surrounding sentence for context */
	sentence: string;
}

/**
 * Overall verification report
 */
export interface VerificationReport {
	/** All citation verifications */
	citations: VerificationResult[];
	/** Detected uncited claims */
	uncitedClaims: UncitedClaim[];
	/** Overall confidence (average of all citations) */
	overallConfidence: number;
	/** Summary counts */
	summary: {
		total: number;
		verified: number;
		weak: number;
		invalid: number;
	};
}

/**
 * Extract citations from response text
 */
function extractCitations(response: string): Array<{ match: string; indices: number[] }> {
	const citations: Array<{ match: string; indices: number[] }> = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	CITATION_PATTERN.lastIndex = 0;

	while ((match = CITATION_PATTERN.exec(response)) !== null) {
		const indicesStr = match[1];
		const indices = indicesStr.split(',').map(s => parseInt(s.trim(), 10));
		citations.push({ match: match[0], indices });
	}

	return citations;
}

/**
 * Extract quoted text with citations
 */
function extractQuotes(response: string): Array<{ quote: string; index: number }> {
	const quotes: Array<{ quote: string; index: number }> = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	QUOTE_PATTERN.lastIndex = 0;

	while ((match = QUOTE_PATTERN.exec(response)) !== null) {
		quotes.push({
			quote: match[1],
			index: parseInt(match[2], 10),
		});
	}

	return quotes;
}

/**
 * Calculate text overlap score
 */
function calculateOverlap(responseText: string, sourceContent: string): number {
	const responseWords = new Set(
		responseText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
	);
	const sourceWords = new Set(
		sourceContent.toLowerCase().split(/\s+/).filter(w => w.length > 3)
	);

	if (responseWords.size === 0) return 0;

	let overlap = 0;
	for (const word of responseWords) {
		if (sourceWords.has(word)) overlap++;
	}

	return overlap / responseWords.size;
}

/**
 * Find best matching segment in source for a claim
 */
function findBestMatch(
	claim: string,
	sourceContent: string
): { segment: string; score: number } {
	// Split source into sentences
	const sentences = sourceContent.split(/[.!?]+/).filter(s => s.trim());

	let bestSegment = '';
	let bestScore = 0;

	for (const sentence of sentences) {
		const score = calculateOverlap(claim, sentence);
		if (score > bestScore) {
			bestScore = score;
			bestSegment = sentence.trim();
		}
	}

	return { segment: bestSegment, score: bestScore };
}

/**
 * Detect uncited claims in response
 */
function detectUncitedClaims(response: string): UncitedClaim[] {
	const uncited: UncitedClaim[] = [];

	// Split into sentences
	const sentences = response.split(/[.!?]+/).filter(s => s.trim());

	for (const sentence of sentences) {
		// Check if sentence has a citation
		CITATION_PATTERN.lastIndex = 0;
		if (CITATION_PATTERN.test(sentence)) continue;

		// Check for claim indicators
		for (const pattern of CLAIM_INDICATORS) {
			if (pattern.test(sentence)) {
				uncited.push({
					claim: sentence.trim(),
					indicator: pattern.source,
					sentence: sentence.trim(),
				});
				break; // Only report once per sentence
			}
		}
	}

	return uncited;
}

/**
 * Get context around a citation for verification
 */
function getCitationContext(response: string, citation: string): string {
	const index = response.indexOf(citation);
	if (index === -1) return '';

	// Get surrounding text (up to 200 chars before)
	const start = Math.max(0, index - 200);
	const contextBefore = response.slice(start, index);

	// Find the start of the sentence
	const sentenceStart = contextBefore.lastIndexOf('. ');
	const effectiveStart = sentenceStart > -1 ? start + sentenceStart + 2 : start;

	return response.slice(effectiveStart, index + citation.length).trim();
}

/**
 * Verify a single citation
 */
function verifyCitation(
	citationMatch: string,
	indices: number[],
	sources: SourceReference[],
	sourceContents: Map<number, string>,
	response: string
): VerificationResult {
	const issues: string[] = [];
	let verified = true;
	let bestScore = 0;
	let bestMatch = '';

	// Get context around citation
	const context = getCitationContext(response, citationMatch);

	for (const index of indices) {
		const source = sources.find(s => s.index === index);

		if (!source) {
			issues.push(`Source ${index} not found in context`);
			verified = false;
			continue;
		}

		const content = sourceContents.get(index);
		if (!content) {
			issues.push(`No content for Source ${index}`);
			continue;
		}

		// Find best match
		const { segment, score } = findBestMatch(context, content);

		if (score > bestScore) {
			bestScore = score;
			bestMatch = segment;
		}

		// Record citation for frequency tracking
		recordCitation(source.source);
	}

	if (bestScore < THRESHOLDS.MIN_OVERLAP) {
		issues.push('Weak text overlap with source');
		verified = false;
	}

	let status: 'verified' | 'weak' | 'invalid';
	if (!verified || indices.length === 0) {
		status = 'invalid';
	} else if (bestScore >= THRESHOLDS.HIGH_CONFIDENCE) {
		status = 'verified';
	} else {
		status = 'weak';
	}

	return {
		citation: citationMatch,
		sourceIndices: indices,
		verified: verified && bestScore >= THRESHOLDS.MIN_OVERLAP,
		confidence: bestScore,
		matchedText: bestMatch.slice(0, 100),
		issues,
		status,
	};
}

/**
 * Verify all citations in an LLM response
 *
 * @param response - LLM response text
 * @param sources - Source references from context
 * @param sourceContents - Map of source index to content
 * @returns Verification report
 */
export function verifyCitations(
	response: string,
	sources: SourceReference[],
	sourceContents: Map<number, string>
): VerificationReport {
	// Skip verification if flag is disabled
	if (!isEnabled('rag-v2-enhancements')) {
		return {
			citations: [],
			uncitedClaims: [],
			overallConfidence: 1,
			summary: { total: 0, verified: 0, weak: 0, invalid: 0 },
		};
	}

	// Extract and verify citations
	const citationMatches = extractCitations(response);
	const verifications: VerificationResult[] = [];

	for (const { match, indices } of citationMatches) {
		const result = verifyCitation(match, indices, sources, sourceContents, response);
		verifications.push(result);
	}

	// Detect uncited claims
	const uncitedClaims = detectUncitedClaims(response);

	// Calculate summary
	const summary = {
		total: verifications.length,
		verified: verifications.filter(v => v.status === 'verified').length,
		weak: verifications.filter(v => v.status === 'weak').length,
		invalid: verifications.filter(v => v.status === 'invalid').length,
	};

	// Calculate overall confidence
	const overallConfidence =
		verifications.length > 0
			? verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length
			: 1;

	return {
		citations: verifications,
		uncitedClaims,
		overallConfidence,
		summary,
	};
}

/**
 * Citation verifier class
 */
export class CitationVerifier {
	private sources: SourceReference[];
	private sourceContents: Map<number, string>;

	constructor(sources: SourceReference[], sourceContents: Map<number, string>) {
		this.sources = sources;
		this.sourceContents = sourceContents;
	}

	/**
	 * Verify citations in response
	 */
	verify(response: string): VerificationReport {
		return verifyCitations(response, this.sources, this.sourceContents);
	}

	/**
	 * Get verification status badge for a citation
	 */
	static getBadgeClass(status: 'verified' | 'weak' | 'invalid'): string {
		switch (status) {
			case 'verified':
				return 'citation-verified';
			case 'weak':
				return 'citation-weak';
			case 'invalid':
				return 'citation-invalid';
		}
	}

	/**
	 * Get badge emoji for a citation status
	 */
	static getBadgeEmoji(status: 'verified' | 'weak' | 'invalid'): string {
		switch (status) {
			case 'verified':
				return '\u2713'; // checkmark
			case 'weak':
				return '\u26A0'; // warning
			case 'invalid':
				return '\u2717'; // x mark
		}
	}
}
