import * as vscode from 'vscode';

/**
 * Custom document for Excel files (.xlsx, .xls)
 * Holds the raw binary buffer read from disk
 */
export class ExcelDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer
  ) {}

  dispose(): void {
    // No external resources to clean up
    // Buffer is managed by V8 garbage collector
  }
}
