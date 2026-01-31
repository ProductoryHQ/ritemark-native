/**
 * Docling Parser Bridge
 *
 * Calls the Python-based Docling parser for advanced document processing.
 * Requires Python 3.11+ and Docling package installed.
 *
 * Features (not available in JS parsers):
 * - OCR for scanned PDFs
 * - Table extraction
 * - PowerPoint support
 * - Image text extraction
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn, execSync } from 'child_process';
import type { ParseResult } from './index';

/** Path to the rag-server Python package */
const RAG_SERVER_PATH = path.join(__dirname, '../../../../rag-server');

interface DoclingResult {
	text: string;
	metadata: {
		type: string;
		pages?: number;
		title?: string;
		author?: string;
	};
	pages?: Array<{ page: number; text: string }>;
	error?: string;
	details?: string;
}

/**
 * Check if Python 3.11+ is available
 */
export function isPythonAvailable(): boolean {
	try {
		const version = execSync('python3 --version 2>&1', { encoding: 'utf-8' });
		const match = version.match(/Python (\d+)\.(\d+)/);
		if (match) {
			const major = parseInt(match[1], 10);
			const minor = parseInt(match[2], 10);
			return major >= 3 && minor >= 11;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check if Docling is installed
 */
export async function isDoclingInstalled(): Promise<boolean> {
	try {
		execSync('python3 -c "import docling" 2>&1', { encoding: 'utf-8' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get instructions for installing Docling
 */
export function getDoclingInstallInstructions(): string {
	return `To enable advanced document parsing (OCR, tables, PowerPoint):

1. Ensure Python 3.11+ is installed:
   python3 --version

2. Install Docling:
   pip install docling

3. Enable the feature flag:
   Settings > Ritemark > Experimental > Enable Docling

Note: First run will download ML models (~200MB).`;
}

/**
 * Parse a document using Docling (Python bridge)
 *
 * @param filePath - Absolute path to the document
 * @returns ParseResult with text and metadata
 * @throws Error if parsing fails or Python/Docling not available
 */
export async function parseWithDocling(filePath: string): Promise<ParseResult> {
	// Validate file exists
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}

	// Check Python availability
	if (!isPythonAvailable()) {
		throw new Error(
			'Python 3.11+ is required for Docling parser.\n\n' +
				getDoclingInstallInstructions()
		);
	}

	// Run the Python parser
	const parserPath = path.join(RAG_SERVER_PATH, 'src', 'rag_server', 'parser.py');

	return new Promise((resolve, reject) => {
		let stdout = '';
		let stderr = '';

		const proc = spawn('python3', [parserPath, filePath], {
			cwd: RAG_SERVER_PATH,
			env: {
				...process.env,
				PYTHONPATH: path.join(RAG_SERVER_PATH, 'src'),
			},
		});

		proc.stdout.on('data', (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on('error', (err) => {
			reject(new Error(`Failed to spawn Python process: ${err.message}`));
		});

		proc.on('close', (code) => {
			if (code !== 0) {
				// Try to parse error from stdout (our parser outputs JSON errors)
				try {
					const result = JSON.parse(stdout) as DoclingResult;
					if (result.error) {
						reject(new Error(result.error + (result.details ? `\n${result.details}` : '')));
						return;
					}
				} catch {
					// Not JSON, use stderr
				}
				reject(new Error(`Docling parser failed (exit ${code}): ${stderr || stdout}`));
				return;
			}

			// Parse JSON output
			try {
				const result = JSON.parse(stdout) as DoclingResult;

				if (result.error) {
					reject(new Error(result.error));
					return;
				}

				resolve({
					text: result.text,
					metadata: {
						type: result.metadata.type,
						pages: result.metadata.pages,
						title: result.metadata.title,
						author: result.metadata.author,
					},
				});
			} catch (err) {
				reject(new Error(`Failed to parse Docling output: ${err}`));
			}
		});
	});
}

/**
 * Extensions supported by Docling (beyond JS parsers)
 */
export const DOCLING_EXTENSIONS = ['.pptx', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];

/**
 * Check if an extension requires Docling
 */
export function requiresDocling(ext: string): boolean {
	const normalized = ext.toLowerCase();
	return DOCLING_EXTENSIONS.includes(normalized);
}
