/**
 * Sprint 148 (R2): one entry for the four readers.
 */
import type { DocumentFormat } from '../../protocol';
import { readCsv } from './csv';
import { readDocx } from './docx';
import { readMarkdown } from './markdown';
import { readPdf } from './pdf';
import { decodeText, type ReadOutcome } from './types';

export { READER_VERSION, type Passage, type ReadOutcome } from './types';

/** `pause` lets the worker answer a query between a long PDF's pages. */
export async function readDocument(format: DocumentFormat, bytes: Uint8Array, budget: number, pause: () => Promise<void>): Promise<ReadOutcome> {
  switch (format) {
    case 'markdown':
      return readMarkdown(decodeText(bytes), budget);
    case 'csv':
      return readCsv(decodeText(bytes), budget);
    case 'docx':
      return readDocx(bytes, budget);
    case 'pdf':
      return readPdf(bytes, budget, pause);
  }
}

const EXTENSIONS: Record<string, DocumentFormat> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.csv': 'csv',
  '.docx': 'docx',
  '.pdf': 'pdf',
};

/** A document's format by its file name, or null when search doesn't cover its kind. */
export function formatOf(fileName: string): DocumentFormat | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  return EXTENSIONS[fileName.slice(dot).toLowerCase()] ?? null;
}

/** A document's name as the tree shows it: the file name without its extension. */
export function documentName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
