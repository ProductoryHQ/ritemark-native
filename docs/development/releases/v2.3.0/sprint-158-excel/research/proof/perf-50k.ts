/**
 * Sprint 158 PR 1: the surgical save on a 50,000 × 20 sheet (about 40 MB of sheet XML), with the read-back check.
 * Run from extensions/ritemark:
 *   npx tsx ../../docs/development/releases/v2.3.0/sprint-158-excel/research/proof/perf-50k.ts
 */
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { applyCellEdits, indexWorkbook, checkCellEdit } from '../../../../../../../extensions/ritemark/src/excel/applyCellEdits';

const req = createRequire(path.resolve(__dirname, '../../../../../../../extensions/ritemark/package.json'));
const JSZip = req('jszip') as typeof import('jszip');

const col = (c: number) => String.fromCharCode(65 + c);

async function main() {
  const rows: string[] = [];
  const strings: string[] = [];
  for (let r = 1; r <= 50_000; r++) {
    let cells = '';
    for (let c = 0; c < 20; c++) {
      const ref = `${col(c)}${r}`;
      if (c % 4 === 0) {
        strings.push(`Item ${r}-${c}`);
        cells += `<c r="${ref}" s="1" t="s"><v>${strings.length - 1}</v></c>`;
      } else if (c === 19) {
        cells += `<c r="${ref}"><f>SUM(B${r}:S${r})</f><v>${r}</v></c>`;
      } else {
        cells += `<c r="${ref}"><v>${(r * 31 + c) % 9973}</v></c>`;
      }
    }
    rows.push(`<row r="${r}" spans="1:20">${cells}</row>`);
  }
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:T50000"/><sheetData>${rows.join('')}</sheetData></worksheet>`;
  zip.file('xl/worksheets/sheet1.xml', sheetXml);
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`);
  const bytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  console.log(`file ${(bytes.length / 1e6).toFixed(2)} MB, sheet XML ${(sheetXml.length / 1e6).toFixed(1)} MB`)
  // with a path, the workbook is also written there, to open in a dev instance
  if (process.argv[2]) {
    req('node:fs').writeFileSync(process.argv[2], bytes)
    console.log('wrote', process.argv[2])
    if (process.argv[3] === '--write-only') return
  };

  const t0 = performance.now();
  const index = await indexWorkbook(bytes);
  await checkCellEdit(index, { sheet: 'Data', ref: 'B25000', value: 1 });
  const t1 = performance.now();
  console.log(`first edit's check (reads the sheet once): ${(t1 - t0).toFixed(0)} ms`);
  await checkCellEdit(index, { sheet: 'Data', ref: 'C25000', value: 1 });
  console.log(`a later edit's check: ${(performance.now() - t1).toFixed(1)} ms`);

  for (const n of [1, 20]) {
    const edits = Array.from({ length: n }, (_, i) => ({ sheet: 'Data', ref: `${col(1 + (i % 18))}${1 + i * 2400}`, value: i % 2 ? `edited ${i}` : i }));
    edits.push({ sheet: 'Data', ref: 'T49999', value: 5 }); // overwrite a formula too
    const rss0 = process.memoryUsage().rss;
    const s = performance.now();
    const { bytes: out, report } = await applyCellEdits(bytes, edits, index);
    console.log(`save with ${edits.length} edits (read back included): ${(performance.now() - s).toFixed(0)} ms, ${(out.length / 1e6).toFixed(2)} MB, touched ${report.touched.join(', ')}, RSS +${((process.memoryUsage().rss - rss0) / 1e6).toFixed(0)} MB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
