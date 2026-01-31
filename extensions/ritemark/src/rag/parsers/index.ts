/**
 * Document Parser Router
 * Routes files to the appropriate parser based on extension and feature flags.
 *
 * Two-tier architecture:
 * - Tier 1: JS parsers (pdf-parse, mammoth) - always available, no Python required
 * - Tier 2: Docling parser - optional, requires Python 3.11+, enables OCR/tables/PPT
 */

import * as path from 'path';
import * as fs from 'fs';
import { parsePdf } from './pdfParser';
import { parseWord } from './wordParser';
import {
	parseWithDocling,
	isPythonAvailable,
	requiresDocling,
	DOCLING_EXTENSIONS,
} from './doclingParser';
import { isEnabled } from '../../features';

/**
 * Result from parsing a document
 */
export interface ParseResult {
	/** Extracted text content */
	text: string;
	/** Document metadata */
	metadata: {
		/** Document type (pdf, docx, markdown, etc.) */
		type: string;
		/** Number of pages (if applicable) */
		pages?: number;
		/** Estimated pages for formats without page info */
		estimatedPages?: number;
		/** Document title */
		title?: string;
		/** Document author */
		author?: string;
		/** Subject/description */
		subject?: string;
		/** Creating application */
		creator?: string;
		/** Creation date (ISO string) */
		createdAt?: string;
		/** Last modified date (ISO string) */
		modifiedAt?: string;
	};
}

/**
 * Tier 1: JS parsers (always available, no Python required)
 */
export const JS_PARSEABLE_EXTENSIONS = {
	pdf: 'pdf',
	docx: 'docx',
	md: 'markdown',
	markdown: 'markdown',
} as const;

/**
 * Tier 2: Docling-only extensions (requires rag-docling flag + Python)
 */
export const DOCLING_ONLY_EXTENSIONS = {
	pptx: 'pptx',
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	tiff: 'image',
	bmp: 'image',
} as const;

/**
 * All supported extensions for document parsing
 */
export const PARSEABLE_EXTENSIONS = {
	...JS_PARSEABLE_EXTENSIONS,
	...DOCLING_ONLY_EXTENSIONS,
} as const;

export type ParseableExtension = keyof typeof PARSEABLE_EXTENSIONS;
export type JSParseableExtension = keyof typeof JS_PARSEABLE_EXTENSIONS;

/**
 * Check if a file extension is supported for parsing
 *
 * @param ext - File extension (with or without leading dot)
 * @param checkDocling - If true, also checks Docling-only extensions when flag enabled
 */
export function isParseableExtension(ext: string, checkDocling = true): boolean {
	const normalized = ext.toLowerCase().replace('.', '');

	// Always allow Tier 1 extensions
	if (normalized in JS_PARSEABLE_EXTENSIONS) {
		return true;
	}

	// Check Tier 2 extensions only if Docling flag is enabled
	if (checkDocling && normalized in DOCLING_ONLY_EXTENSIONS) {
		return isEnabled('rag-docling') && isPythonAvailable();
	}

	return false;
}

/**
 * Get the document type for an extension
 */
export function getDocumentType(ext: string): string | undefined {
	const normalized = ext.toLowerCase().replace('.', '') as ParseableExtension;
	return PARSEABLE_EXTENSIONS[normalized];
}

/**
 * Check if Docling should be used for parsing
 */
function shouldUseDocling(ext: string): boolean {
	if (!isEnabled('rag-docling')) {
		return false;
	}

	if (!isPythonAvailable()) {
		return false;
	}

	const normalized = ext.toLowerCase().replace('.', '');

	// Docling-only extensions always use Docling
	if (normalized in DOCLING_ONLY_EXTENSIONS) {
		return true;
	}

	// For PDF/DOCX, Docling offers better OCR/table extraction
	// Use Docling when flag is enabled
	if (normalized === 'pdf' || normalized === 'docx') {
		return true;
	}

	return false;
}

/**
 * Parse a document file and extract text content
 *
 * Uses two-tier parsing:
 * - Tier 1: JS parsers (default, no Python required)
 * - Tier 2: Docling (optional, for OCR/tables/PPT when rag-docling flag enabled)
 *
 * @param filePath - Absolute path to the document
 * @returns ParseResult with text and metadata
 * @throws Error if file type is not supported or parsing fails
 */
export async function parseDocument(filePath: string): Promise<ParseResult> {
	const ext = path.extname(filePath).toLowerCase().replace('.', '');

	// Validate file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}

	// Check if we should use Docling
	if (shouldUseDocling(ext)) {
		try {
			return await parseWithDocling(filePath);
		} catch (err) {
			// For Docling-only extensions, rethrow
			if (ext in DOCLING_ONLY_EXTENSIONS) {
				throw err;
			}
			// For PDF/DOCX, fall back to JS parser
			console.warn(`[Parser] Docling failed, falling back to JS parser:`, err);
		}
	}

	// Route to appropriate JS parser (Tier 1)
	switch (ext) {
		case 'pdf':
			return parsePdf(filePath);

		case 'docx':
			return parseWord(filePath);

		case 'md':
		case 'markdown':
			// Markdown is handled directly - just read the file
			return parseMarkdown(filePath);

		default:
			// Check if this is a Docling-only extension
			if (ext in DOCLING_ONLY_EXTENSIONS) {
				throw new Error(
					`File type .${ext} requires Docling parser.\n` +
						'Enable the "rag-docling" feature flag and ensure Python 3.11+ is installed.'
				);
			}
			throw new Error(`Unsupported file type: .${ext}`);
	}
}

/**
 * Parse a markdown file (simple text read with metadata extraction)
 */
async function parseMarkdown(filePath: string): Promise<ParseResult> {
	const text = fs.readFileSync(filePath, 'utf-8');

	// Extract title from first heading
	let title: string | undefined;
	const titleMatch = text.match(/^#\s+(.+)$/m);
	if (titleMatch) {
		title = titleMatch[1].trim();
	}

	return {
		text,
		metadata: {
			type: 'markdown',
			title,
		},
	};
}

/**
 * Get list of all parseable extensions (for file filtering)
 *
 * @param includeDocling - Include Docling-only extensions if flag enabled
 */
export function getAllParseableExtensions(includeDocling = true): string[] {
	const jsExts = Object.keys(JS_PARSEABLE_EXTENSIONS).map(ext => `.${ext}`);

	if (includeDocling && isEnabled('rag-docling') && isPythonAvailable()) {
		const doclingExts = Object.keys(DOCLING_ONLY_EXTENSIONS).map(ext => `.${ext}`);
		return [...jsExts, ...doclingExts];
	}

	return jsExts;
}
