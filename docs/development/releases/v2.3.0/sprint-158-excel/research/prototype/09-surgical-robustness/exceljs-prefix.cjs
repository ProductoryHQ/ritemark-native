// Does ExcelJS read a sheet whose main namespace uses the x: prefix (as the Open XML SDK writes)?
const fs = require('fs'); const ExcelJS = require('../02-exceljs-roundtrip/node_modules/exceljs');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('../00-tools/node_modules/fflate');
const z = unzipSync(new Uint8Array(fs.readFileSync('../01-fixtures/excel-authored.xlsx')));
let x = strFromU8(z['xl/worksheets/sheet1.xml']);
x = x.replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace('</worksheet>', '</x:worksheet>')
  .replace(/<(\/?)(dimension|sheetViews|sheetView|selection|sheetFormatPr|sheetData|row|c|v|f|pageMargins|ignoredErrors|ignoredError)([\s/>])/g, '<$1x:$2$3');
z['xl/worksheets/sheet1.xml'] = strToU8(x);
(async () => { const wb = new ExcelJS.Workbook(); try { await wb.xlsx.load(Buffer.from(zipSync(z))); const ws = wb.getWorksheet('Sales'); console.log('loaded; A3 =', JSON.stringify(ws.getCell('A3').value), 'rowCount', ws.rowCount); } catch (e) { console.log('FAILED', e.message); } })();
