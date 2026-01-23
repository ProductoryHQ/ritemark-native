/**
 * Text chunker for RAG pipeline.
 * Splits document text into overlapping chunks suitable for embedding.
 */

export interface TextChunk {
	content: string;
	metadata: {
		source: string;
		page?: number | null;
		section?: string | null;
		chunkIndex: number;
		startChar: number;
		endChar: number;
	};
}

export interface ChunkOptions {
	/** Maximum tokens per chunk (approximated as chars / 4) */
	maxTokens?: number;
	/** Overlap in tokens between chunks */
	overlapTokens?: number;
	/** Separators to split on, in order of preference */
	separators?: string[];
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
	maxTokens: 512,
	overlapTokens: 50,
	separators: ['\n\n', '\n', '. ', ' '],
};

/**
 * Approximate token count (rough: 1 token ~ 4 chars for English text).
 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Split text recursively using separators, respecting max chunk size.
 */
function splitRecursive(
	text: string,
	separators: string[],
	maxChars: number
): string[] {
	if (text.length <= maxChars) {
		return [text];
	}

	const separator = separators[0];
	const remainingSeparators = separators.slice(1);

	if (!separator) {
		// No more separators - hard split at maxChars
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += maxChars) {
			chunks.push(text.slice(i, i + maxChars));
		}
		return chunks;
	}

	const parts = text.split(separator);
	const chunks: string[] = [];
	let current = '';

	for (const part of parts) {
		const candidate = current ? current + separator + part : part;

		if (candidate.length <= maxChars) {
			current = candidate;
		} else {
			if (current) {
				chunks.push(current);
			}
			// If single part exceeds max, split it with next separator
			if (part.length > maxChars && remainingSeparators.length > 0) {
				const subChunks = splitRecursive(part, remainingSeparators, maxChars);
				chunks.push(...subChunks.slice(0, -1));
				current = subChunks[subChunks.length - 1] || '';
			} else {
				current = part;
			}
		}
	}

	if (current) {
		chunks.push(current);
	}

	return chunks;
}

/**
 * Chunk document text into overlapping pieces for embedding.
 */
export function chunkText(
	text: string,
	source: string,
	options?: ChunkOptions
): TextChunk[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const maxChars = opts.maxTokens * 4; // Approximate chars per token
	const overlapChars = opts.overlapTokens * 4;

	const rawChunks = splitRecursive(text, opts.separators, maxChars);

	const chunks: TextChunk[] = [];
	let charOffset = 0;

	for (let i = 0; i < rawChunks.length; i++) {
		const content = rawChunks[i].trim();
		if (!content) {
			continue;
		}

		const startChar = text.indexOf(content, charOffset);
		const endChar = startChar + content.length;

		chunks.push({
			content,
			metadata: {
				source,
				page: null,
				section: null,
				chunkIndex: chunks.length,
				startChar: startChar >= 0 ? startChar : charOffset,
				endChar: startChar >= 0 ? endChar : charOffset + content.length,
			},
		});

		charOffset = startChar >= 0 ? startChar + content.length - overlapChars : charOffset + content.length;
	}

	return chunks;
}

/**
 * Chunk parsed document sections, preserving page/section metadata.
 */
export function chunkSections(
	sections: Array<{ content: string; page?: number | null; title?: string | null }>,
	source: string,
	options?: ChunkOptions
): TextChunk[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const allChunks: TextChunk[] = [];

	let currentSection: string | null = null;

	for (const section of sections) {
		if (section.title) {
			currentSection = section.title;
		}

		if (!section.content) {
			continue;
		}

		const sectionChunks = chunkText(section.content, source, opts);

		for (const chunk of sectionChunks) {
			chunk.metadata.page = section.page ?? null;
			chunk.metadata.section = currentSection;
			chunk.metadata.chunkIndex = allChunks.length;
			allChunks.push(chunk);
		}
	}

	return allChunks;
}
