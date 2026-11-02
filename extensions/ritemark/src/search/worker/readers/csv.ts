/**
 * Sprint 148 (R2): a CSV's rows through `papaparse` (quotes, and line breaks
 * inside quotes, kept). A passage is a row, its cells with the Unit Separator (U+001F) between, which
 * cannot occur in a cell (it is stripped from one first), so a reader of the row finds each cell's
 * boundary however the cell's own text looks (the panel shows the separator as " · "); the
 * first row is kept as the columns, so a matching row can name its cell's column.
 */
import Papa from 'papaparse';
import { PassageSink, type ReadOutcome } from './types';

/** Between a row's cells in a passage; the panel's searchModel splits on the same character. */
export const CELL_SEPARATOR = '\u001F';

export function readCsv(source: string, budget: number): ReadOutcome {
  let rows: string[][];
  try {
    const parsed = Papa.parse<string[]>(source, { skipEmptyLines: 'greedy' });
    rows = parsed.data.filter((row) => Array.isArray(row));
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const sink = new PassageSink(budget);
  rows.forEach((cells, row) => {
    if (sink.full) return;
    const values = cells.map((cell) => String(cell ?? '').replace(/\u001F/g, '').replace(/\s+/g, ' ').trim());
    if (values.some((value) => value.length > 0)) sink.add(values.join(CELL_SEPARATOR), { row });
  });
  const columns = rows.length > 0 ? rows[0].map((cell) => String(cell ?? '').trim()) : undefined;
  return { ok: true, passages: sink.passages, truncated: sink.truncated, ...(columns ? { columns } : {}) };
}
