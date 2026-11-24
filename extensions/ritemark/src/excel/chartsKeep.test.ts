/** Sprint 174 R22. Run with npm run test:excel. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { applyCellEdits, indexWorkbook } from './applyCellEdits';
import { chartsKeepFixtures } from './chartsKeepFixtures.test';
import { attr, locateCell, parseCellRef, rootPrefix } from './sheetXml';
import { openPackage, readPart, rewritePackage, storedPart, type XlsxPackage } from './xlsxPackage';

const workbookPath = 'xl/workbook.xml';

async function xmlPart(pkg: XlsxPackage, name: string) {
  const bytes = await readPart(pkg, name);
  assert.ok(bytes, name);
  // Keep a UTF-8 BOM in the comparison if the original part has one.
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

function sheetElements(xml: string, name: string): string[] {
  const prefix = rootPrefix(xml, 'worksheet');
  const tag = prefix + name;
  return xml.match(new RegExp(`<${tag}(?=[\\s/>])[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, 'g')) ?? [];
}

async function assertKeepsWorkbook(before: XlsxPackage, after: XlsxPackage, sheetPath: string, ref: string) {
  const paths = [...before.byName.keys()].sort();
  assert.deepEqual([...after.byName.keys()].sort(), paths, 'package part names');
  // Include chart, drawing (including VML), their .rels, and worksheet/chartsheet .rels.
  const featureParts = paths.filter((name) => /^xl\/(?:charts|drawings)\//.test(name)
    || /^xl\/(?:worksheets|chartsheets)\/_rels\//.test(name));
  const first = new Set([...featureParts, 'xl/styles.xml', 'xl/theme/theme1.xml'].filter((name) => before.byName.has(name)));
  for (const name of [...first, ...paths.filter((name) => !first.has(name))]) {
    if (name === sheetPath || name === workbookPath) continue;
    const original = storedPart(before, name);
    const saved = storedPart(after, name);
    assert.ok(original && saved, name);
    assert.ok(Buffer.from(original).equals(saved), `${name}: stored bytes changed`);
  }

  const originalWorkbook = await xmlPart(before, workbookPath);
  const savedWorkbook = await xmlPart(after, workbookPath);
  const calcTag = /<(?:[\w.-]+:)?calcPr(?=[\s/>])[^>]*>/;
  const savedCalc = savedWorkbook.match(calcTag)?.[0] ?? '';
  assert.match(attr(savedCalc, 'fullCalcOnLoad') ?? '', /^(?:1|true)$/, `${workbookPath}: recalc on load`);
  const withoutCalcFlag = (xml: string) => xml.replace(calcTag, (tag) => {
    if (/^<[^\s>]+\s+fullCalcOnLoad=["'][^"']*["']\s*\/>$/.test(tag)) return '';
    return tag.replace(/\s+fullCalcOnLoad=(?:"[^"]*"|'[^']*')/, '');
  });
  assert.equal(withoutCalcFlag(savedWorkbook), withoutCalcFlag(originalWorkbook), workbookPath);

  const originalSheet = await xmlPart(before, sheetPath);
  const savedSheet = await xmlPart(after, sheetPath);
  for (const name of ['conditionalFormatting', 'drawing', 'legacyDrawing', 'extLst']) {
    assert.deepEqual(sheetElements(savedSheet, name), sheetElements(originalSheet, name), `${sheetPath}: ${name}`);
  }
  const withoutCell = (xml: string) => {
    const cell = locateCell(xml, parseCellRef(ref)!, rootPrefix(xml, 'worksheet'));
    assert.equal(cell.kind, 'replace', `${sheetPath}: expected existing cell ${ref}`);
    return xml.slice(0, cell.start) + xml.slice(cell.end);
  };
  assert.equal(withoutCell(savedSheet), withoutCell(originalSheet), `${sheetPath}: bytes outside ${ref}`);
}

async function main() {
  for (const { file, sheet, ref } of chartsKeepFixtures) {
    const original = new Uint8Array(readFileSync(file));
    const index = await indexWorkbook(original);
    const sheetPath = index.sheets.get(sheet)?.path;
    assert.ok(sheetPath, `${basename(file)}: ${sheet}`);
    const { bytes, report } = await applyCellEdits(original, [{ sheet, ref, value: 4321 }], index);
    assert.ok(report.touched.includes(sheetPath), `${basename(file)}: edited ${sheet}!${ref}`);
    const saved = openPackage(bytes);
    await assertKeepsWorkbook(index.pkg, saved, sheetPath, ref);
    console.log(`  ${basename(file)}: package and worksheet bytes preserved`);

    // Corrupt independent copies of the saved rich workbook, one XML payload byte at a time.
    if (basename(file) !== 'rich-excelish.xlsx') continue;
    for (const [part, marker, message] of [
      ['xl/charts/chart1.xml', 'val="150"', 'xl/charts/chart1.xml'],
      [sheetPath, 'priority="1"', `${sheetPath}: conditionalFormatting`],
      ['xl/styles.xml', 'val="11"', 'xl/styles.xml'],
    ]) {
      const payload = await readPart(saved, part);
      assert.ok(payload, part);
      const changed = Buffer.from(payload);
      const offset = changed.indexOf(marker);
      assert.ok(offset >= 0, `${part}: missing mutation marker ${marker}`);
      changed[offset + marker.length - 2] = '9'.charCodeAt(0);
      const copy = openPackage(await rewritePackage(saved, new Map([[part, changed]])));
      await assert.rejects(assertKeepsWorkbook(index.pkg, copy, sheetPath, ref), (error: unknown) =>
        error instanceof assert.AssertionError && error.message.includes(message));
      console.log(`  guard detects one changed byte in ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
