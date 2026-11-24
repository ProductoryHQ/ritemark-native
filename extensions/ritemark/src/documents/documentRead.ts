export interface DocumentReadRequest {
  path: string;
  from?: number;
  to?: number;
}

export type DocumentKind = 'word' | 'pdf' | 'powerpoint';

export interface DocumentReadResult {
  text: string;
  isError?: boolean;
  kind?: DocumentKind;
}
