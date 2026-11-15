import * as vscode from 'vscode';
import { applyCellEdits, checkCellEdit, indexWorkbook, type WorkbookIndex } from './excel/applyCellEdits';
import type { CellEdit } from './excel/cellEdit';

/**
 * Custom document for Excel files (.xlsx, .xls).
 *
 * Sprint 158 (#711): it keeps the workbook's bytes as they are on disk (or in a hot-exit backup) and the list of cell
 * edits made since. Saving, Save As and backup write the original bytes with only the edited cells changed
 * (`applyCellEdits`), so everything else in the file stays as it was. Before, the webview sent a whole workbook
 * rewritten by SheetJS, which dropped colours, borders, charts and pictures.
 */
export class ExcelDocument implements vscode.CustomDocument {
  private _buffer: Buffer;
  private _edits: CellEdit[] = [];
  private index: Promise<WorkbookIndex> | null = null;
  /** Edits are checked one at a time, so they are kept in the order they were made. */
  private queue: Promise<unknown> = Promise.resolve();
  /** Raised by a revert or refresh, which drops the pending edits; a save doesn't. */
  private generation = 0;

  constructor(
    readonly uri: vscode.Uri,
    buffer: Buffer
  ) {
    this._buffer = buffer;
  }

  /** The workbook's bytes without the pending edits: what the webview reads and the edits apply to. */
  get buffer(): Buffer {
    return this._buffer;
  }

  /** The cell edits not saved yet, in the order they were made. */
  get edits(): readonly CellEdit[] {
    return this._edits;
  }

  get isDirty(): boolean {
    return this._edits.length > 0;
  }

  private workbookIndex(): Promise<WorkbookIndex> {
    if (!this.index) {
      const index = indexWorkbook(this._buffer);
      // a failed read is tried again next time rather than remembered
      index.catch(() => {
        if (this.index === index) this.index = null;
      });
      this.index = index;
    }
    return this.index;
  }

  /** Add an edit. Throws CellEditRefused (and keeps nothing) when the cell can't be written safely. */
  addEdit(edit: CellEdit): Promise<void> {
    const generation = this.generation;
    const added = this.queue.then(async () => {
      // a revert while the edit waited: it belonged to the content that is gone
      if (this.generation !== generation) return;
      await checkCellEdit(await this.workbookIndex(), edit);
      if (this.generation !== generation) return;
      this._edits.push(edit);
    });
    this.queue = added.catch(() => undefined);
    return added;
  }

  /**
   * The workbook with the pending edits written in (the original bytes when there are none), and how many edits it
   * holds, for `markSaved`.
   */
  async savedBytes(): Promise<{ bytes: Buffer; editCount: number }> {
    await this.queue;
    const edits = this._edits.slice();
    if (!edits.length) return { bytes: this._buffer, editCount: 0 };
    const { bytes } = await applyCellEdits(this._buffer, edits, await this.workbookIndex());
    return { bytes: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), editCount: edits.length };
  }

  /**
   * After a save: the saved bytes are the new original. Edits made while it was being written stay pending; they
   * change single cells, so they apply to the saved bytes as they would have to the old ones.
   */
  markSaved(saved: Buffer, editCount: number): void {
    this._buffer = saved;
    this._edits = this._edits.slice(editCount);
    this.index = null;
  }

  /**
   * Replace document content from disk (a revert or a refresh), dropping the pending edits.
   */
  update(buffer: Buffer): void {
    this.generation++;
    this._buffer = buffer;
    this._edits = [];
    this.index = null;
  }

  dispose(): void {
    // No external resources to clean up
    // Buffer is managed by V8 garbage collector
  }
}
