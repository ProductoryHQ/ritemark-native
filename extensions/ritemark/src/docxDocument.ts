import * as vscode from 'vscode';

/**
 * Custom document for DOCX files
 * Holds the raw binary buffer read from disk — empty when the file is larger
 * than the preview opens (Sprint 124 R5), so it is never read whole.
 */
export class DocxDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    public buffer: Buffer,
    public sizeBytes: number = buffer.length
  ) {}

  dispose(): void {
    // No external resources to clean up
  }
}
