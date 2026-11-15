const fs = require('fs');
const { applyEdits, shiftFormula } = require('./surgical.cjs');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const F = '../01-fixtures/';
function run(name, input, edits) {
  const t = process.hrtime.bigint();
  const { bytes, report } = applyEdits(new Uint8Array(input), edits);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  fs.writeFileSync(name, bytes);
  console.log(name, JSON.stringify(report), ms.toFixed(1) + 'ms');
}
const rich = fs.readFileSync(F + 'rich-excelish.xlsx');
run('rich-one.xlsx', rich, [{ sheet: 'Budget', ref: 'A3', value: 'Rent (edited)' }]);
run('rich-many.xlsx', rich, [
  { sheet: 'Budget', ref: 'A3', value: 'Rent (edited)' },
  { sheet: 'Budget', ref: 'B4', value: 500 },
  { sheet: 'Budget', ref: 'C5', value: 7 },
  { sheet: 'Budget', ref: 'G20', value: '  new & <odd> _x0041_ ' },
  { sheet: 'Budget', ref: 'E3', value: null },
  { sheet: 'Data', ref: 'B2', value: 99 },
]);
const ea = fs.readFileSync(F + 'excel-authored.xlsx');
run('ea-formula.xlsx', ea, [{ sheet: 'Sales', ref: 'D3', value: 1 }]);
run('ea-value.xlsx', ea, [{ sheet: 'Sales', ref: 'B3', value: 13 }]);
// shared-formula variant of the Excel file, as Excel writes a fill-down
const files = unzipSync(new Uint8Array(ea));
let s1 = strFromU8(files['xl/worksheets/sheet1.xml']);
s1 = s1.replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B3*C3</f>')
  .replace('<f>B4*C4</f>', '<f t="shared" si="0"/>').replace('<f>B5*C5</f>', '<f t="shared" si="0"/>').replace('<f>B6*C6</f>', '<f t="shared" si="0"/>');
files['xl/worksheets/sheet1.xml'] = strToU8(s1);
const shared = zipSync(files);
fs.writeFileSync('ea-shared-before.xlsx', shared);
run('ea-shared-master.xlsx', shared, [{ sheet: 'Sales', ref: 'D3', value: 1 }]);
console.log(strFromU8(unzipSync(fs.readFileSync('ea-shared-master.xlsx'))['xl/worksheets/sheet1.xml']).match(/<c r="D\d"[^]*?<\/c>/g).join('\n'));
// array formula refusal
let s2 = s1.replace('<f t="shared" ref="D3:D6" si="0">B3*C3</f>', '<f t="array" ref="D3:D6">B3:B6*C3:C6</f>').replace(/<f t="shared" si="0"\/>/g, '');
files['xl/worksheets/sheet1.xml'] = strToU8(s2);
run('ea-array.xlsx', zipSync(files), [{ sheet: 'Sales', ref: 'D5', value: 1 }]);
// formula shifter unit checks
const cases = [['B3*C3', 1, 0, 'B4*C4'], ['SUM($B$3:B3)', 2, 0, 'SUM($B$3:B5)'], ['"A1"&A1', 1, 1, '"A1"&B2'], ["'My Sheet'!A1+LOG10(A2)", 1, 0, "'My Sheet'!A2+LOG10(A3)"], ['Orders[Qty]*B2', 1, 0, 'Orders[Qty]*B3'], ['SUM(A:A)+SUM(1:1)', 1, 1, 'SUM(B:B)+SUM(2:2)'], ['TaxRate*B3', 1, 0, 'TaxRate*B4']];
for (const [f, dr, dc, want] of cases) { const got = shiftFormula(f, dr, dc); console.log(got === want ? 'PASS' : 'FAIL', f, '->', got); }
