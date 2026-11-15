const fs = require('fs');
const mode = process.argv[2]; const file = process.argv[3] || 'big.xlsx';
const XLSX = require(process.env.SHEETJS_PATH || 'xlsx');
const ExcelJS = require('../02-exceljs-roundtrip/node_modules/exceljs');
const { unzipSync, strFromU8 } = require('../00-tools/node_modules/fflate');
const { parseStyles } = require('../06-render/styles.cjs');
const { parseSst, scanSheet } = require('./scan.cjs');
const NUMFMT = require('../06-render/node_modules/numfmt/dist/index.cjs');
const { applyEdits } = require('../04-surgical/surgical.cjs');
const { rewrite } = require('../04-surgical/zipRewrite.cjs');
const buf = fs.readFileSync(file); const b64 = buf.toString('base64');
global.gc(); const heap0 = process.memoryUsage().heapUsed;
let keep; const t0 = performance.now();
(async () => {
  if (mode === 'sheetjs-today') {
    const wb = XLSX.read(b64, { type: 'base64', cellStyles: true }); const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref']);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e }) });
    keep = { wb, rows: aoa.slice(0, 10000) };
  } else if (mode === 'sheetjs+stylelayer') {
    const wb = XLSX.read(b64, { type: 'base64', cellStyles: true, bookFiles: true }); const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref']);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e }) });
    const files = wb.files; const get = (n) => { const f = files[n] || files['/' + n]; return f.content ? (typeof f.content === 'string' ? f.content : Buffer.from(f.content).toString('utf8')) : ''; };
    const st = parseStyles(get('xl/styles.xml'), get('xl/theme/theme1.xml'));
    const ids = scanSheet(get('xl/worksheets/sheet1.xml'), null, true);
    keep = { wb, rows: aoa.slice(0, 10000), st, ids };
  } else if (mode === 'exceljs-load') {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); keep = wb;
  } else if (mode === 'custom-reader') {
    const z = unzipSync(new Uint8Array(buf));
    const sst = parseSst(strFromU8(z['xl/sharedStrings.xml']));
    const st = parseStyles(strFromU8(z['xl/styles.xml']), strFromU8(z['xl/theme/theme1.xml']));
    const sheet = scanSheet(strFromU8(z['xl/worksheets/sheet1.xml']), sst, false);
    // format the numbers the way the grid shows them (SSF, as bundled in SheetJS)
    const text = new Array(sheet.values.length);
    for (let i = 0; i < sheet.values.length; i++) { const v = sheet.values[i]; const fmt = st.xfs[sheet.styles[i]]; const code = fmt && (st.numFmts[fmt.numFmtId] || ({ 0: 'General', 4: '#,##0.00', 14: 'dd.mm.yyyy' })[fmt.numFmtId] || 'General');
      text[i] = typeof v === 'number' ? NUMFMT.format(code, v) : v; }
    keep = { sheet, text, st };
  } else if (mode === 'save-sheetjs') {
    const wb = XLSX.read(b64, { type: 'base64', cellStyles: true }); const t1 = performance.now();
    wb.Sheets[wb.SheetNames[0]]['C5'] = { t: 's', v: 'edited' };
    keep = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }); console.log('  write only ms', (performance.now() - t1).toFixed(0));
  } else if (mode === 'save-exceljs') {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const t1 = performance.now();
    wb.worksheets[0].getCell('C5').value = 'edited'; keep = await wb.xlsx.writeBuffer(); console.log('  write only ms', (performance.now() - t1).toFixed(0));
  } else if (mode === 'save-surgical') {
    keep = applyEdits(new Uint8Array(buf), [{ sheet: 'Data', ref: 'C5', value: 'edited' }]).bytes;
  } else if (mode === 'save-surgical-rawcopy') {
    const z = unzipSync(new Uint8Array(buf), { filter: (f) => /sheet1\.xml$|sharedStrings|workbook\.xml$|_rels|Content_Types/.test(f.name) });
    const { bytes } = applyEdits(new Uint8Array(buf), [{ sheet: 'Data', ref: 'C5', value: 'edited' }]);
    const out = unzipSync(bytes); const repl = new Map();
    for (const n of Object.keys(z)) if (Buffer.compare(Buffer.from(z[n]), Buffer.from(out[n] || [])) !== 0) repl.set(n, out[n] || null);
    keep = rewrite(new Uint8Array(buf), repl);
  }
  const ms = performance.now() - t0; global.gc();
  const heap = (process.memoryUsage().heapUsed - heap0) / 1048576; const rss = process.resourceUsage().maxRSS / 1024;
  console.log(`${mode.padEnd(24)} ${ms.toFixed(0).padStart(6)} ms   retained heap ${heap.toFixed(0).padStart(5)} MB   peak RSS ${rss.toFixed(0)} MB` + (keep && keep.length ? `   output ${(keep.length / 1048576).toFixed(2)} MB` : ''));
})();
