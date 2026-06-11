import * as vscode from 'vscode';

/**
 * Custom document for Excel files (.xlsx, .xls)
 * Holds the raw binary buffer; mutable so the editor can apply
 * webview edits (serialized workbook) before save.
 */
export class ExcelDocument implements vscode.CustomDocument {
  private _buffer: Buffer;

  constructor(
    readonly uri: vscode.Uri,
    buffer: Buffer
  ) {
    this._buffer = buffer;
  }

  get buffer(): Buffer {
    return this._buffer;
  }

  /**
   * Replace document content (from a webview edit or a disk revert)
   */
  update(buffer: Buffer): void {
    this._buffer = buffer;
  }

  dispose(): void {
    // No external resources to clean up
    // Buffer is managed by V8 garbage collector
  }
}
