/**
 * Anti-Hallucination Prompt Templates
 *
 * Structured prompts that:
 * - Require citations for all claims
 * - Admit when information is not available
 * - Handle conflicting sources
 * - Use strict formatting for citation verification
 */

import type { AssembledContext } from './contextAssembly';

/**
 * Prompt type for different use cases
 */
export type PromptType = 'qa' | 'summary' | 'compare' | 'explain';

/**
 * Build QA prompt with strict citation requirements
 */
function buildQAPrompt(context: string, query: string): string {
	return `You are RiteMark AI, a document assistant that helps users understand their documents.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use information from the provided context below
2. If information is NOT in the context, say "This information is not available in the indexed documents"
3. ALWAYS cite your sources using [Source N] format
4. NEVER make up or infer information not explicitly stated
5. NEVER cite sources that weren't provided
6. If sources disagree, mention BOTH perspectives with citations

CITATION FORMAT:
- Direct quotes: "quoted text" [Source N]
- Paraphrased info: statement [Source N]
- Synthesized info: statement [Source N, Source M]

RESPONSE STRUCTURE:
1. Answer the question directly first
2. Provide supporting details with citations
3. Note any limitations or gaps in available information

CONTEXT:
${context}

USER QUESTION:
${query}`;
}

/**
 * Build summary prompt
 */
function buildSummaryPrompt(context: string, query: string): string {
	return `You are RiteMark AI, a document assistant. Summarize the following content.

CRITICAL RULES:
1. Base your summary ONLY on the provided context
2. ALWAYS cite key points using [Source N] format
3. If the context is incomplete, acknowledge what's missing
4. Maintain objectivity - don't add opinions or interpretations

SUMMARY STRUCTURE:
1. Key Points (with citations)
2. Main Themes
3. Notable Details (if space permits)

CONTEXT:
${context}

USER REQUEST:
${query}`;
}

/**
 * Build comparison prompt
 */
function buildComparePrompt(context: string, query: string): string {
	return `You are RiteMark AI, a document assistant. Compare the topics in the following content.

CRITICAL RULES:
1. ONLY compare based on information in the context
2. ALWAYS cite each comparison point using [Source N] format
3. If information is missing for one side, explicitly state this
4. Highlight both similarities AND differences

COMPARISON STRUCTURE:
1. Overview of items being compared
2. Key Similarities (with citations)
3. Key Differences (with citations)
4. Summary of comparison

CONTEXT:
${context}

USER REQUEST:
${query}`;
}

/**
 * Build explanation prompt
 */
function buildExplainPrompt(context: string, query: string): string {
	return `You are RiteMark AI, a document assistant. Explain the following concept.

CRITICAL RULES:
1. Base your explanation ONLY on the provided context
2. ALWAYS cite sources when explaining specific details [Source N]
3. If the context doesn't fully explain the concept, say so
4. Break down complex concepts into understandable parts

EXPLANATION STRUCTURE:
1. Simple definition or overview
2. Key components or aspects (with citations)
3. How it works or applies (with citations)
4. Any caveats or limitations noted in sources

CONTEXT:
${context}

USER REQUEST:
${query}`;
}

/**
 * Build a RAG prompt with appropriate template
 *
 * @param type - Type of prompt (qa, summary, compare, explain)
 * @param context - Assembled context string
 * @param query - User's query
 * @returns Formatted prompt for LLM
 */
export function buildPrompt(
	type: PromptType,
	context: string,
	query: string
): string {
	switch (type) {
		case 'summary':
			return buildSummaryPrompt(context, query);
		case 'compare':
			return buildComparePrompt(context, query);
		case 'explain':
			return buildExplainPrompt(context, query);
		case 'qa':
		default:
			return buildQAPrompt(context, query);
	}
}

/**
 * Detect prompt type from query
 */
export function detectPromptType(query: string): PromptType {
	const lower = query.toLowerCase();

	if (
		lower.includes('summarize') ||
		lower.includes('summary') ||
		lower.includes('overview')
	) {
		return 'summary';
	}

	if (
		lower.includes('compare') ||
		lower.includes('difference') ||
		lower.includes('versus') ||
		lower.includes(' vs ')
	) {
		return 'compare';
	}

	if (
		lower.includes('explain') ||
		lower.includes('how does') ||
		lower.includes('what is') ||
		lower.includes('describe')
	) {
		return 'explain';
	}

	return 'qa';
}

/**
 * Build RAG prompt with auto-detected type
 */
export function buildRAGPrompt(
	assembledContext: AssembledContext,
	query: string
): string {
	const type = detectPromptType(query);
	return buildPrompt(type, assembledContext.context, query);
}

/**
 * Prompt builder class for stateful operations
 */
export class PromptBuilder {
	private defaultType: PromptType = 'qa';

	setDefaultType(type: PromptType): void {
		this.defaultType = type;
	}

	build(
		type: PromptType | undefined,
		context: string,
		query: string
	): string {
		return buildPrompt(type || this.defaultType, context, query);
	}

	buildAuto(context: AssembledContext, query: string): string {
		return buildRAGPrompt(context, query);
	}
}
