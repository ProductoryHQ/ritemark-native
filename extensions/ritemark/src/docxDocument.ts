import * as vscode from 'vscode';

/**
 * Custom document for DOCX files
 * Holds the raw binary buffer read from disk
 */
export class DocxDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer
  ) {}

  dispose(): void {
    // No external resources to clean up
  }
}
