import type { SourcePassage } from '../../webview/src/utils/sourcePassage';

export interface DocumentReadRequest {
  path: string;
  from?: number;
  to?: number;
  /** Internal worker lookup. The reading tool exposes path, from and to. */
  passage?: SourcePassage;
}

export type DocumentKind = 'word' | 'pdf' | 'powerpoint';

export interface DocumentReadResult {
  text: string;
  isError?: boolean;
  kind?: DocumentKind;
  location?: SourceLocation;
}

export type SourceLocation = { text: string; occurrence: number; page?: number; displayText?: string } | { page: number };
