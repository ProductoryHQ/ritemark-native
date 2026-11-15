/**
 * Sprint 158 (#711): one cell edit, as the webview sends it and the host saves it. Pure, shared by both sides.
 */

/** A number, text, or null for a cleared cell. */
export type CellValue = string | number | null;

export interface CellEdit {
  /** The sheet's name, as the workbook lists it. */
  sheet: string;
  /** The cell's A1 address. */
  ref: string;
  value: CellValue;
}

/** Excel's limit for the text in one cell. */
export const MAX_CELL_TEXT = 32_767;

/**
 * What typed text becomes, as the editor has always done: nothing is a cleared cell, text that reads as a finite
 * number is a number, anything else is text. Characters a workbook can't hold (control characters other than tab
 * and line breaks) are dropped, so the saved cell holds exactly this value.
 */
export function cellValueFromText(text: string): CellValue {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  if (clean === '') return null;
  if (clean.trim() !== '') {
    const n = Number(clean);
    if (Number.isFinite(n)) return n;
  }
  return clean;
}

/** One edit per cell, the last one typed, in the order each cell was last edited. */
export function coalesceEdits(edits: readonly CellEdit[]): CellEdit[] {
  const last = new Map<string, CellEdit>();
  for (const edit of edits) {
    const key = `${edit.sheet}\u0000${edit.ref}`;
    last.delete(key);
    last.set(key, edit);
  }
  return [...last.values()];
}

/** Whether a workbook may be edited: an .xlsx, while the `excel-editing` flag is on. A legacy .xls stays read-only
 *  (a save would re-encode it as .xlsx). The host decides, and refuses edits otherwise, whatever the webview sends. */
export function canEditWorkbook(fsPath: string, editingOn: boolean): boolean {
  return editingOn && fsPath.toLowerCase().endsWith('.xlsx');
}

export function isCellEdit(value: unknown): value is CellEdit {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.sheet === 'string' &&
    typeof e.ref === 'string' &&
    (e.value === null || typeof e.value === 'string' || (typeof e.value === 'number' && Number.isFinite(e.value)))
  );
}
