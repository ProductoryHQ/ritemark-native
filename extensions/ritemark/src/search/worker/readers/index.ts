/**
 * Sprint 148 (R2): one entry for the four readers.
 */
import type { DocumentFormat } from '../../protocol';
import { readCsv } from './csv';
import { readDocx } from './docx';
import { readMarkdown } from './markdown';
import { readPdf } from './pdf';
import { decodeText, type ReadOutcome } from './types';
import { isDeckPath, splitFileName } from '../../../decks/deckFileName';

export { READER_VERSION, type Passage, type ReadOutcome } from './types';

/** `pause` lets the worker answer a query between a long PDF's pages; `path` names a deck (#936: its slides read as words). */
export async function readDocument(format: DocumentFormat, bytes: Uint8Array, budget: number, pause: () => Promise<void>, path = ''): Promise<ReadOutcome> {
  switch (format) {
    case 'markdown':
      return readMarkdown(decodeText(bytes), budget, { deck: isDeckPath(path) });
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
  // Sprint 172: a deck is Markdown inside, so its words are found
  '.rtms': 'markdown',
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

/** A document's name as the tree shows it: the file name without its extension (an old deck's is the whole `.deck.md`, a `.rtms` deck's its last dot). */
export function documentName(fileName: string): string {
  return splitFileName(fileName).name;
}
