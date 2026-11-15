// Differential test: random edits through the surgical writer; SheetJS reads before/after and
// every cell must match except the edited ones. Also: x:-prefixed XML, rows/cells without r, no sharedStrings.
const fs = require('fs');
const XLSX = require(process.env.SHEETJS_PATH || 'xlsx');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('../00-tools/node_modules/fflate');
const { applyEdits } = require('../04-surgical/surgical.cjs');
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function cellsOf(bytes, sheet) { const ws = XLSX.read(bytes, { dense: false }).Sheets[sheet]; const o = {}; for (const k of Object.keys(ws)) if (k[0] !== '!') o[k] = ws[k].f ? 'f:' + ws[k].f : ws[k].v; return o; }
function check(name, bytes, sheet, maxR, maxC, n) {
  const before = cellsOf(bytes, sheet); const edits = [];
  for (let i = 0; i < n; i++) { const ref = XLSX.utils.encode_cell({ r: Math.floor(rnd() * maxR), c: Math.floor(rnd() * maxC) });
    const k = rnd(); edits.push({ sheet, ref, value: k < 0.4 ? Math.round(rnd() * 1e4) / 10 : k < 0.85 ? 'v' + i + (k < 0.5 ? ' & <x>' : '') : null }); }
  const last = {}; for (const e of edits) last[e.ref] = e.value;
  const { bytes: out, report } = applyEdits(new Uint8Array(bytes), edits);
  const after = cellsOf(out, sheet); let bad = 0;
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const want = k in last ? (last[k] === null || last[k] === '' ? undefined : last[k]) : before[k];
    if (after[k] !== want) { if (bad++ < 5) console.log('  MISMATCH', k, JSON.stringify(before[k]), '->', JSON.stringify(after[k]), 'want', JSON.stringify(want)); }
  }
  console.log(`${name}: ${n} edits, ${Object.keys(before).length} cells compared, mismatches ${bad}, touched ${report.touched.length} parts, refused ${report.refused.length}`);
}
const rich = fs.readFileSync('../01-fixtures/rich-excelish.xlsx');
check('rich-excelish (sst)', rich, 'Budget', 25, 9, 200);
check('rich openpyxl (inline strings, no sst)', fs.readFileSync('../01-fixtures/rich.xlsx'), 'Budget', 25, 9, 200);
check('excel-authored', fs.readFileSync('../01-fixtures/excel-authored.xlsx'), 'Sales', 10, 8, 100);
// x:-prefixed main namespace (as the Open XML SDK writes) and rows/cells without r
const z = unzipSync(new Uint8Array(fs.readFileSync('../01-fixtures/excel-authored.xlsx')));
let x = strFromU8(z['xl/worksheets/sheet1.xml']);
x = x.replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace('</worksheet>', '</x:worksheet>')
  .replace(/<(\/?)(dimension|sheetViews|sheetView|selection|sheetFormatPr|sheetData|row|c|v|f|pageMargins|ignoredErrors|ignoredError)([\s/>])/g, '<$1x:$2$3');
z['xl/worksheets/sheet1.xml'] = strToU8(x); const prefixed = zipSync(z);
check('x:-prefixed sheet', prefixed, 'Sales', 10, 8, 100);
let y = strFromU8(unzipSync(new Uint8Array(fs.readFileSync('../01-fixtures/excel-authored.xlsx')))['xl/worksheets/sheet1.xml']);
y = y.replace(/<row r="\d+"/g, '<row').replace(/<c r="[A-Z]+\d+"/g, '<c');
const z2 = unzipSync(new Uint8Array(fs.readFileSync('../01-fixtures/excel-authored.xlsx'))); z2['xl/worksheets/sheet1.xml'] = strToU8(y);
check('rows/cells without r', zipSync(z2), 'Sales', 6, 6, 60);
const big = fs.readFileSync('../08-perf/big.xlsx');
check('big 50k x 20', big, 'Data', 50001, 20, 300);
