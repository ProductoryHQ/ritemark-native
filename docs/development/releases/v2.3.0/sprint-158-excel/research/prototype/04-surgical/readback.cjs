// Read surgical outputs back with ExcelJS and SheetJS (two independent parsers)
const ExcelJS = require('../02-exceljs-roundtrip/node_modules/exceljs');
const XLSX = require(process.env.SHEETJS_PATH || 'xlsx');
const fs = require('fs');
(async () => {
  for (const [file, sheet, refs] of [['rich-many.xlsx', 'Budget', ['A3', 'B4', 'C5', 'G20', 'E3', 'C4']], ['ea-shared-master.xlsx', 'Sales', ['D3', 'D4', 'D6']], ['ea-formula.xlsx', 'Sales', ['D3', 'D4']]]) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(fs.readFileSync(file));
    const ws = wb.getWorksheet(sheet);
    const sj = XLSX.read(fs.readFileSync(file), { cellStyles: true }).Sheets[sheet];
    console.log('==', file, 'dimension(ExcelJS)', ws.dimensions && ws.dimensions.model, 'ref(SheetJS)', sj['!ref']);
    for (const r of refs) { const c = ws.getCell(r); console.log(r, 'exceljs:', JSON.stringify(c.value), 'styleBorderTop:', c.border && c.border.top && c.border.top.style, '| sheetjs:', JSON.stringify(sj[r] && { t: sj[r].t, v: sj[r].v, f: sj[r].f })); }
  }
})();
