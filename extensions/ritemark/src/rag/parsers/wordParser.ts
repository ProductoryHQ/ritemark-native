/**
 * Word Document Parser
 * Extracts text from .docx files using mammoth
 */

import * as fs from 'fs';
import type { ParseResult } from './index';

// mammoth types
interface MammothResult {
	value: string;
	messages: Array<{ type: string; message: string }>;
}

// Lazy load mammoth
let mammoth: {
	extractRawText: (options: { buffer: Buffer }) => Promise<MammothResult>;
};

/**
 * Initialize mammoth (lazy load)
 */
async function getMammoth() {
	if (!mammoth) {
		const module = await import('mammoth');
		mammoth = module.default || module;
	}
	return mammoth;
}

/**
 * Parse a Word document (.docx) and extract text content
 *
 * @param filePath - Absolute path to .docx file
 * @returns ParseResult with text and metadata
 */
export async function parseWord(filePath: string): Promise<ParseResult> {
	try {
		const mam = await getMammoth();
		const buffer = fs.readFileSync(filePath);

		// Extract raw text (preserves structure better than HTML conversion)
		const result = await mam.extractRawText({ buffer });

		let text = result.value || '';

		// Clean up extracted text
		text = text
			.replace(/\r\n/g, '\n')           // Normalize line endings
			.replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
			.replace(/[ \t]+/g, ' ')          // Collapse horizontal whitespace
			.replace(/\n /g, '\n')            // Remove leading space after newline
			.trim();

		// Log any warnings from mammoth
		const warnings = result.messages.filter(m => m.type === 'warning');
		if (warnings.length > 0) {
			console.warn(`[WordParser] Warnings for ${filePath}:`, warnings.map(w => w.message));
		}

		// Try to extract title from first heading-like line
		const lines = text.split('\n');
		let title: string | undefined;
		if (lines.length > 0 && lines[0].length < 200 && !lines[0].includes('.')) {
			// First line looks like a title (short, no periods)
			title = lines[0].trim();
		}

		return {
			text,
			metadata: {
				type: 'docx',
				title,
				// Word docs don't expose page count via mammoth
				// We could estimate: ~500 words per page
				estimatedPages: Math.ceil(text.split(/\s+/).length / 500) || 1,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		// Handle common Word doc errors
		if (message.includes('Could not find')) {
			throw new Error(`Invalid or corrupted Word document: ${filePath}`);
		}
		if (message.includes('password')) {
			throw new Error(`Word document is password protected: ${filePath}`);
		}

		throw new Error(`Failed to parse Word document: ${message}`);
	}
}
