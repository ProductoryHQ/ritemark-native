/**
 * Sprint 158 (#711): a shared formula moved to another cell, as Excel fills it.
 * Run: npx tsx src/excel/sharedFormula.test.ts
 */
import assert from 'node:assert/strict';
import { FormulaShiftError, shiftFormula } from './sharedFormula';

const cases: Array<[string, number, number, string]> = [
  // the prototype's seven
  ['B3*C3', 1, 0, 'B4*C4'],
  ['SUM($B$3:B3)', 2, 0, 'SUM($B$3:B5)'],
  ['"A1"&A1', 1, 1, '"A1"&B2'],
  ["'My Sheet'!A1+LOG10(A2)", 1, 0, "'My Sheet'!A2+LOG10(A3)"],
  ['Orders[Qty]*B2', 1, 0, 'Orders[Qty]*B3'],
  ['SUM(A:A)+SUM(1:1)', 1, 1, 'SUM(B:B)+SUM(2:2)'],
  ['TaxRate*B3', 1, 0, 'TaxRate*B4'],
  // mixed anchors
  ['$A1+A$1+$A$1', 2, 3, '$A3+D$1+$A$1'],
  ['$A:B', 0, 1, '$A:C'],
  ['$1:2', 3, 0, '$1:5'],
  // sideways and back
  ['A10-B10', -2, 0, 'A8-B8'],
  ['C1*2', 0, -2, 'A1*2'],
  // another sheet, unquoted and quoted with an apostrophe in its name
  ['Sheet2!A1+Data!$B$2', 1, 0, 'Sheet2!A2+Data!$B$2'],
  ["'Bob''s sheet'!C3", 0, 1, "'Bob''s sheet'!D3"],
  // a string with an escaped quote and something that looks like a reference
  ['"say ""B2"" now"&B2', 1, 0, '"say ""B2"" now"&B3'],
  // names that look like references, functions with digits, booleans, numbers with exponents
  ['AB12x+ATAN2(A1,B1)+TRUE', 1, 0, 'AB12x+ATAN2(A2,B2)+TRUE'],
  ['1E5*A1+2.5E-3', 1, 0, '1E5*A2+2.5E-3'],
  ['LOG10(10)+A1', 1, 0, 'LOG10(10)+A2'],
  // structured references with nested brackets and an escaped bracket
  ['SUM(Table1[[#This Row],[Q1]:[Q4]])+A1', 1, 0, 'SUM(Table1[[#This Row],[Q1]:[Q4]])+A2'],
  ["Table1[[#Headers],['[Weird']]]&C2", 0, 1, "Table1[[#Headers],['[Weird']]]&D2"],
  // an external workbook index
  ['[1]Sheet1!A1*2', 1, 0, '[1]Sheet1!A2*2'],
  // errors and percent
  ['IFERROR(A1/B1,#N/A)+C1%', 1, 0, 'IFERROR(A2/B2,#N/A)+C2%'],
  // the last column and row are reachable
  ['XFC1048575', 1, 1, 'XFD1048576'],
  // a 3D reference: the sheet range is copied, the cell moves
  ['SUM(Jan:Dec!B2)', 1, 0, 'SUM(Jan:Dec!B3)'],
  // an upper-case 3D sheet range is not a column range
  ['SUM(QA:QB!B2)', 0, 1, 'SUM(QA:QB!C2)'],
];

for (const [formula, dr, dc, want] of cases) {
  assert.equal(shiftFormula(formula, dr, dc), want, `${formula} moved ${dr},${dc}`);
}

// Off the sheet: refused, never written wrong
assert.throws(() => shiftFormula('A1', -1, 0), FormulaShiftError);
assert.throws(() => shiftFormula('A1', 0, -1), FormulaShiftError);
assert.throws(() => shiftFormula('XFD1', 0, 1), FormulaShiftError);
assert.throws(() => shiftFormula('A1048576', 1, 0), FormulaShiftError);
assert.throws(() => shiftFormula('"open', 1, 0), FormulaShiftError);
// …but anchored parts never move, so they never leave
assert.equal(shiftFormula('$A$1', -5, -5), '$A$1');

console.log(`sharedFormula: ${cases.length} cases passed`);
