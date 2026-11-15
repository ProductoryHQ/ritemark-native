// 50,000 rows x 20 columns, Excel-shaped: shared strings, styles, number formats, cached formula results
const ExcelJS = require('../02-exceljs-roundtrip/node_modules/exceljs');
(async () => {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: 'big.xlsx', useSharedStrings: true, useStyles: true });
  const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = Array.from({ length: 20 }, (_, i) => ({ header: 'Col ' + (i + 1), key: 'c' + i, width: 10 + (i % 5) * 3 }));
  ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { theme: 4, tint: 0.4 } };
  ws.getRow(1).commit();
  const cities = ['Tallinn', 'Tartu', 'Pärnu', 'Narva', 'Viljandi', 'Rakvere', 'Kuressaare', 'Haapsalu'];
  for (let r = 2; r <= 50001; r++) {
    const vals = {};
    for (let c = 0; c < 20; c++) {
      if (c < 8) vals['c' + c] = Math.round(Math.random() * 1e6) / 100;
      else if (c < 12) vals['c' + c] = cities[(r + c) % cities.length];
      else if (c < 14) vals['c' + c] = 'Item ' + r + '-' + c;
      else if (c < 17) vals['c' + c] = new Date(2020, 0, 1 + ((r * (c + 1)) % 2000));
      else vals['c' + c] = { formula: `A${r}*B${r}`, result: 1 };
    }
    const row = ws.addRow(vals);
    row.getCell(1).numFmt = '#,##0.00'; row.getCell(15).numFmt = 'dd.mm.yyyy';
    if (r % 2) row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    row.getCell(3).border = { bottom: { style: 'thin' } };
    row.commit();
  }
  ws.commit(); await wb.commit();
  console.log('done');
})();
