/**
 * PDF Parser
 * Extracts text from PDF files using pdf-parse (Mozilla pdf.js wrapper)
 */

import * as fs from 'fs';
import type { ParseResult } from './index';

// pdf-parse doesn't have TypeScript types, so we import dynamically
let pdfParse: (buffer: Buffer) => Promise<{
	numpages: number;
	numrender: number;
	info: {
		Title?: string;
		Author?: string;
		Subject?: string;
		Creator?: string;
		Producer?: string;
		CreationDate?: string;
		ModDate?: string;
	};
	metadata: unknown;
	text: string;
}>;

/**
 * Initialize pdf-parse (lazy load to avoid startup cost)
 */
async function getPdfParse() {
	if (!pdfParse) {
		// Dynamic import to handle CommonJS module
		const module = await import('pdf-parse');
		pdfParse = module.default || module;
	}
	return pdfParse;
}

/**
 * Parse a PDF file and extract text content
 *
 * @param filePath - Absolute path to PDF file
 * @returns ParseResult with text and metadata
 */
export async function parsePdf(filePath: string): Promise<ParseResult> {
	try {
		const parse = await getPdfParse();
		const buffer = fs.readFileSync(filePath);
		const data = await parse(buffer);

		// Clean up extracted text
		let text = data.text || '';

		// Remove excessive whitespace but preserve paragraph breaks
		text = text
			.replace(/\r\n/g, '\n')           // Normalize line endings
			.replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
			.replace(/[ \t]+/g, ' ')          // Collapse horizontal whitespace
			.replace(/\n /g, '\n')            // Remove leading space after newline
			.trim();

		// Extract metadata
		const info = data.info || {};

		return {
			text,
			metadata: {
				type: 'pdf',
				pages: data.numpages || 0,
				title: info.Title || undefined,
				author: info.Author || undefined,
				subject: info.Subject || undefined,
				creator: info.Creator || undefined,
				createdAt: info.CreationDate ? parseDate(info.CreationDate) : undefined,
				modifiedAt: info.ModDate ? parseDate(info.ModDate) : undefined,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		// Handle common PDF errors with user-friendly messages
		if (message.includes('password')) {
			throw new Error(`PDF is password protected: ${filePath}`);
		}
		if (message.includes('Invalid PDF')) {
			throw new Error(`Invalid or corrupted PDF file: ${filePath}`);
		}

		throw new Error(`Failed to parse PDF: ${message}`);
	}
}

/**
 * Parse PDF date string (format: D:YYYYMMDDHHmmSS)
 */
function parseDate(pdfDate: string): string | undefined {
	if (!pdfDate) return undefined;

	// PDF dates look like: D:20210101120000+00'00'
	const match = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
	if (!match) return undefined;

	const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
	return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}
