/**
 * Sprint 158 (#711): a shared formula's text, moved to another cell.
 *
 * Excel writes a filled-down formula once, in the range's first cell (the anchor, `<f t="shared" ref=".." si="n">`),
 * and the other cells carry only `<f t="shared" si="n"/>`. When an edit overwrites the anchor, each of those cells
 * gets its own formula: the anchor's text with its relative references moved by the distance between the two cells,
 * as Excel does when it fills. `$`-anchored parts stay. Strings, quoted sheet names, structured references and
 * external-book indexes are copied as they are. A reference that would leave the sheet throws, so the edit is refused
 * rather than written wrong. Pure: no Node imports.
 */
import { MAX_COLUMN, MAX_ROW, columnLetters, columnNumber } from './sheetXml';

export class FormulaShiftError extends Error {}

function shiftColumn(letters: string, anchored: boolean, dc: number): string {
  if (anchored) return letters;
  const n = columnNumber(letters) + dc;
  if (n < 1 || n > MAX_COLUMN) throw new FormulaShiftError('A reference would move off the sheet');
  return columnLetters(n);
}

function shiftRow(digits: string, anchored: boolean, dr: number): string {
  if (anchored) return digits;
  const n = Number(digits) + dr;
  if (n < 1 || n > MAX_ROW) throw new FormulaShiftError('A reference would move off the sheet');
  return String(n);
}

// After a reference: not a word character (a longer name), "(" (a function such as LOG10) or "!" (a sheet name).
const END = '(?![\\w.(!])';
const CELL = new RegExp(`^(\\$?)([A-Z]{1,3})(\\$?)(\\d{1,7})${END}`);
const COLUMNS = new RegExp(`^(\\$?)([A-Z]{1,3}):(\\$?)([A-Z]{1,3})${END}`);
const ROWS = new RegExp(`^(\\$?)(\\d{1,7}):(\\$?)(\\d{1,7})${END}`);
const NAME = /^[A-Za-z_\\][\w.]*/;

/** The end of a bracketed part starting at `i` ("[" … "]"), with nested brackets ("[[#This Row],[Qty]]"). */
function bracketEnd(f: string, i: number): number {
  let depth = 0;
  for (let k = i; k < f.length; k++) {
    if (f[k] === "'" && depth > 0) {
      k++; // an apostrophe escapes the next character in a structured reference
      continue;
    }
    if (f[k] === '[') depth++;
    else if (f[k] === ']' && --depth === 0) return k;
  }
  throw new FormulaShiftError('A bracket is not closed');
}

/** The formula `f` moved down `dr` rows and right `dc` columns. */
export function shiftFormula(f: string, dr: number, dc: number): string {
  let out = '';
  let i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') {
      // a string literal: "" inside it is a quote
      let k = i + 1;
      for (;;) {
        const q = f.indexOf('"', k);
        if (q < 0) throw new FormulaShiftError('A string is not closed');
        if (f[q + 1] === '"') {
          k = q + 2;
          continue;
        }
        k = q;
        break;
      }
      out += f.slice(i, k + 1);
      i = k + 1;
      continue;
    }
    if (ch === "'") {
      // a quoted sheet name: '' inside it is an apostrophe
      let k = i + 1;
      while (k < f.length && !(f[k] === "'" && f[k + 1] !== "'")) k += f[k] === "'" ? 2 : 1;
      if (k >= f.length) throw new FormulaShiftError('A sheet name is not closed');
      out += f.slice(i, k + 1);
      i = k + 1;
      continue;
    }
    if (ch === '[') {
      const k = bracketEnd(f, i);
      out += f.slice(i, k + 1);
      i = k + 1;
      continue;
    }
    const prev = i > 0 ? f[i - 1] : '';
    if (!/[\w.$]/.test(prev)) {
      const rest = f.slice(i, i + 32);
      let m: RegExpExecArray | null;
      if ((m = COLUMNS.exec(rest))) {
        out += `${m[1]}${shiftColumn(m[2], !!m[1], dc)}:${m[3]}${shiftColumn(m[4], !!m[3], dc)}`;
        i += m[0].length;
        continue;
      }
      if ((m = ROWS.exec(rest))) {
        out += `${m[1]}${shiftRow(m[2], !!m[1], dr)}:${m[3]}${shiftRow(m[4], !!m[3], dr)}`;
        i += m[0].length;
        continue;
      }
      if ((m = CELL.exec(rest))) {
        out += `${m[1]}${shiftColumn(m[2], !!m[1], dc)}${m[3]}${shiftRow(m[4], !!m[3], dr)}`;
        i += m[0].length;
        continue;
      }
      const name = NAME.exec(f.slice(i));
      if (name) {
        // a function, a defined name, TRUE or FALSE: copied whole, so its digits never read as a row
        out += name[0];
        i += name[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}
