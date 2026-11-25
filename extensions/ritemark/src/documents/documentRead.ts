import type { SourcePassage } from '../../webview/src/utils/sourcePassage';

export interface DocumentReadRequest {
  path: string;
  from?: number;
  to?: number;
  /** Internal worker lookup. The reading tool exposes path, from and to. */
  passage?: SourcePassage;
}

export type DocumentKind = 'word' | 'pdf' | 'powerpoint';

export const documentReadWarnings = {
  password: 'it has a password',
  scan: 'a scan with no text',
  damaged: 'the file may be damaged',
  size: 'the file is too large',
  online: 'the file is kept online only',
  legacy: 'it is an older format',
  empty: 'there is no readable text',
  outside: 'choose a document inside the project',
  unavailable: 'the file is unavailable',
  worker: 'Ritemark could not finish reading it',
} as const;

export type DocumentReadReason = keyof typeof documentReadWarnings;

export interface DocumentReadResult {
  reason?: DocumentReadReason;
  text: string;
  isError?: boolean;
  kind?: DocumentKind;
  location?: SourceLocation;
}

export type SourceLocation = { text: string; occurrence: number; page?: number; displayText?: string } | { page: number };
