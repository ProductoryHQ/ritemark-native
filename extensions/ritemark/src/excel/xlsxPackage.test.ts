/**
 * Sprint 158 (#711): the package writer copies unchanged parts byte for byte; the shared string table only grows.
 * Run: npx tsx src/excel/xlsxPackage.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { checkOfficePackage } from '../officePreview/officePackageCheck';
import { PackageError, crc32, encodeText, openPackage, readTextPart, rewritePackage, storedPart } from './xlsxPackage';
import { SharedStrings } from './sharedStrings';
import { makeTempDir } from '../testing/tempDir';

const excelMac = new Uint8Array(
  fs.readFileSync(path.resolve(__dirname, '../../../../docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx')),
);

async function main() {
  // CRC-32 of "123456789" is CBF43926
  assert.equal(crc32(encodeText('123456789')), 0xcbf43926);

  // Nothing replaced: Excel's file comes back byte for byte
  const pkg = openPackage(excelMac);
  const same = await rewritePackage(pkg, new Map());
  assert.equal(Buffer.compare(Buffer.from(same), Buffer.from(excelMac)), 0, 'an unchanged package is the same bytes');

  // One part replaced, one removed: the others keep their stored bytes; the result is a valid package
  const sheet = (await readTextPart(pkg, 'xl/worksheets/sheet1.xml'))!;
  const out = await rewritePackage(
    pkg,
    new Map<string, Uint8Array | null>([
      ['xl/worksheets/sheet1.xml', encodeText(sheet.replace('</sheetData>', '<row r="99"><c r="A99"><v>1</v></c></row></sheetData>'))],
      ['xl/calcChain.xml', null],
    ]),
  );
  const outPkg = openPackage(out);
  assert.ok(!outPkg.byName.has('xl/calcChain.xml'));
  assert.deepEqual(outPkg.entries.map((e) => e.name), pkg.entries.map((e) => e.name).filter((n) => n !== 'xl/calcChain.xml'), 'order kept');
  for (const e of pkg.entries) {
    if (e.name === 'xl/worksheets/sheet1.xml' || e.name === 'xl/calcChain.xml') continue;
    assert.equal(Buffer.compare(Buffer.from(storedPart(pkg, e.name)!), Buffer.from(storedPart(outPkg, e.name)!)), 0, e.name);
  }
  assert.match((await readTextPart(outPkg, 'xl/worksheets/sheet1.xml'))!, /<c r="A99"><v>1<\/v><\/c>/);
  assert.deepEqual(await checkOfficePackage(out, 'xl/'), { ok: true });
  const zip = await JSZip.loadAsync(out);
  assert.match(await zip.file('xl/worksheets/sheet1.xml')!.async('string'), /A99/, 'another ZIP reader reads it');
  // and the system's unzip finds no errors
  const tmp = path.join(makeTempDir('xlsx-'), 'out.xlsx');
  fs.writeFileSync(tmp, out);
  assert.match(execFileSync('unzip', ['-t', tmp]).toString(), /No errors detected/);

  // A part that isn't there can't be replaced; a non-UTF-8 part is refused rather than rewritten
  await assert.rejects(rewritePackage(pkg, new Map([['xl/nope.xml', null]])), PackageError);
  const utf16 = new JSZip();
  utf16.file('[Content_Types].xml', '<Types/>');
  utf16.file('xl/a.xml', '<?xml version="1.0" encoding="UTF-16"?><a/>');
  const u16 = openPackage(new Uint8Array(await utf16.generateAsync({ type: 'uint8array' })));
  await assert.rejects(readTextPart(u16, 'xl/a.xml'), /not UTF-8/);

  // Shared strings: appended at the end, counts raised, items read back with rich runs and escapes
  const sst = new SharedStrings('<sst xmlns="m" count="3" uniqueCount="2"><si><t>a</t></si><si><r><t>b</t></r><r><t xml:space="preserve"> c_x0041_</t></r></si></sst>');
  assert.equal(sst.count, 2);
  assert.equal(sst.textAt(1), 'b cA');
  assert.equal(sst.append(' new\n'), 2);
  assert.equal(sst.textAt(2), ' new\n');
  assert.equal(sst.textAt(3), undefined);
  assert.equal(
    sst.serialize(),
    '<sst xmlns="m" count="4" uniqueCount="3"><si><t>a</t></si><si><r><t>b</t></r><r><t xml:space="preserve"> c_x0041_</t></r></si><si><t xml:space="preserve"> new\n</t></si></sst>',
  );
  const empty = new SharedStrings('<x:sst xmlns:x="m" count="0" uniqueCount="0"/>');
  empty.append('only');
  assert.equal(empty.serialize(), '<x:sst xmlns:x="m" count="1" uniqueCount="1"><x:si><x:t>only</x:t></x:si></x:sst>');
  const untouched = '<sst xmlns="m"><si><t>a</t></si></sst>';
  assert.equal(new SharedStrings(untouched).serialize(), untouched);

  console.log('xlsxPackage: all passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
