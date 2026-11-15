/**
 * Sprint 158 PR 1 proof: one edit and a save, the way 2.2 saves (SheetJS rewrites the workbook in the webview) and
 * the way PR 1 saves (only the edited cell changes, in the host). Writes both files next to the original and counts
 * the parts that kept their bytes. The feature-by-feature check is `../prototype/00-pytools/features.py`.
 *
 * Run from extensions/ritemark:
 *   npx tsx ../../docs/development/releases/v2.3.0/sprint-158-excel/research/proof/save-compare.ts <in.xlsx> <sheet> <ref> <value> <out-dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { applyCellEdits } from '../../../../../../../extensions/ritemark/src/excel/applyCellEdits';
import { openPackage, storedPart } from '../../../../../../../extensions/ritemark/src/excel/xlsxPackage';
import { cellValueFromText } from '../../../../../../../extensions/ritemark/src/excel/cellEdit';

// SheetJS from the extension's own node_modules, the version 2.2 bundles (0.20.3)
const XLSX = createRequire(path.resolve(__dirname, '../../../../../../../extensions/ritemark/package.json'))('xlsx') as typeof import('xlsx');

async function main() {
  const [input, sheet, ref, text, outDir] = process.argv.slice(2);
  const original = new Uint8Array(fs.readFileSync(input));
  const value = cellValueFromText(text);
  const base = path.basename(input, '.xlsx');
  fs.mkdirSync(outDir, { recursive: true });

  // 2.2: SpreadsheetViewer read the workbook with cellStyles, wrote the cell, and XLSX.write'd the whole workbook
  const t0 = performance.now();
  const wb = XLSX.read(original, { type: 'array', cellStyles: true });
  const ws = wb.Sheets[sheet];
  ws[ref] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value };
  const before = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
  const t1 = performance.now();
  fs.writeFileSync(path.join(outDir, `${base}--2.2-save.xlsx`), before);

  // PR 1: the host writes only the edited cell
  const { bytes: after, report } = await applyCellEdits(original, [{ sheet, ref, value }]);
  const t2 = performance.now();
  fs.writeFileSync(path.join(outDir, `${base}--pr1-save.xlsx`), after);

  const kept = (bytes: Uint8Array) => {
    const a = openPackage(original);
    const b = openPackage(bytes);
    let same = 0;
    for (const name of a.byName.keys()) {
      const x = storedPart(a, name);
      const y = storedPart(b, name);
      if (x && y && Buffer.compare(Buffer.from(x), Buffer.from(y)) === 0) same++;
    }
    return `${same} of ${a.entries.length} parts byte-identical`;
  };
  console.log(`${base}: ${sheet}!${ref} = ${JSON.stringify(value)}`);
  console.log(`  2.2 save:  ${before.length} bytes, ${kept(before)}, ${(t1 - t0).toFixed(0)} ms`);
  console.log(`  PR 1 save: ${after.length} bytes, ${kept(after)}, changed ${report.touched.join(', ')}, ${(t2 - t1).toFixed(0)} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
