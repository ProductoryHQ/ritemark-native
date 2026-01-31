/**
 * Document Parser Router
 * Routes files to the appropriate parser based on extension
 */

import * as path from 'path';
import * as fs from 'fs';
import { parsePdf } from './pdfParser';
import { parseWord } from './wordParser';

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
 * Supported file extensions for document parsing
 */
export const PARSEABLE_EXTENSIONS = {
	// Tier 1: JS parsers (always available)
	pdf: 'pdf',
	docx: 'docx',
	// Markdown handled directly by indexer
	md: 'markdown',
	markdown: 'markdown',
	// Tier 2: Docling-only (when rag-docling flag enabled)
	// pptx: 'pptx',
	// png: 'image',
	// jpg: 'image',
	// jpeg: 'image',
} as const;

export type ParseableExtension = keyof typeof PARSEABLE_EXTENSIONS;

/**
 * Check if a file extension is supported for parsing
 */
export function isParseableExtension(ext: string): ext is ParseableExtension {
	const normalized = ext.toLowerCase().replace('.', '');
	return normalized in PARSEABLE_EXTENSIONS;
}

/**
 * Get the document type for an extension
 */
export function getDocumentType(ext: string): string | undefined {
	const normalized = ext.toLowerCase().replace('.', '') as ParseableExtension;
	return PARSEABLE_EXTENSIONS[normalized];
}

/**
 * Parse a document file and extract text content
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

	// Route to appropriate parser
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
 */
export function getAllParseableExtensions(): string[] {
	return Object.keys(PARSEABLE_EXTENSIONS).map(ext => `.${ext}`);
}
