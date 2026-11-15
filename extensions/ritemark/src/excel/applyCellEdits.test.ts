/**
 * Sprint 158 (#711): the surgical save. Edits go in; every other cell and every other part stays as it was.
 *
 * The fixtures: `rich.xlsx` (openpyxl: fills, fonts, borders, merges, frozen panes, conditional formatting, a
 * drop-down, a comment, an image, a chart, a table, a hidden sheet), `rich-excelish.xlsx` (the same reshaped as Excel
 * writes it: shared strings, cached results, a calculation chain), both made by the study's scripts
 * (research/prototype/01-fixtures), and Sprint 81's workbook saved by Excel for Mac.
 * Run: npx tsx src/excel/applyCellEdits.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { checkOfficePackage } from '../officePreview/officePackageCheck';
import { CellEditRefused, applyCellEdits, indexWorkbook, checkCellEdit, isWellFormedXml } from './applyCellEdits';
import { openPackage, storedPart, readTextPart } from './xlsxPackage';
import { cellValueFromText, coalesceEdits, type CellEdit } from './cellEdit';

const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', name)));
const excelMac = new Uint8Array(
  fs.readFileSync(path.resolve(__dirname, '../../../../docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx')),
);

async function partText(bytes: Uint8Array, name: string): Promise<string | null> {
  return readTextPart(openPackage(bytes), name);
}

async function rezip(bytes: Uint8Array, change: (files: Map<string, string | Uint8Array>) => void, opts: { streamFiles?: boolean } = {}) {
  const zip = await JSZip.loadAsync(bytes);
  const files = new Map<string, string | Uint8Array>();
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    files.set(name, /\.(xml|rels|vml)$/.test(name) ? await zip.files[name].async('string') : await zip.files[name].async('uint8array'));
  }
  change(files);
  const out = new JSZip();
  for (const [name, data] of files) out.file(name, data);
  return new Uint8Array(await out.generateAsync({ type: 'uint8array', compression: 'DEFLATE', streamFiles: opts.streamFiles }));
}

/** Every cell of a sheet as SheetJS reads it: the formula when there is one, otherwise the value. */
function cellsOf(bytes: Uint8Array, sheet: string): Record<string, unknown> {
  const ws = XLSX.read(bytes, { type: 'array', dense: false }).Sheets[sheet];
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(ws)) if (k[0] !== '!') out[k] = ws[k].f ? `f:${ws[k].f}` : ws[k].v;
  return out;
}

/** The parts whose stored bytes differ between two packages, plus the ones only one has. */
function changedParts(a: Uint8Array, b: Uint8Array): string[] {
  const pa = openPackage(a);
  const pb = openPackage(b);
  const names = new Set([...pa.byName.keys(), ...pb.byName.keys()]);
  const out: string[] = [];
  for (const name of names) {
    const x = storedPart(pa, name);
    const y = storedPart(pb, name);
    if (!x || !y || x.length !== y.length || x.some((v, i) => v !== y[i])) out.push(name);
  }
  return out.sort();
}

let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

/** Random edits, then: no cell but the edited ones changed, and no part outside the touched list changed. */
async function fuzz(label: string, bytes: Uint8Array, sheet: string, maxR: number, maxC: number, n: number) {
  const before = cellsOf(bytes, sheet);
  const edits: CellEdit[] = [];
  for (let i = 0; i < n; i++) {
    const ref = XLSX.utils.encode_cell({ r: Math.floor(rnd() * maxR), c: Math.floor(rnd() * maxC) });
    const k = rnd();
    const value = k < 0.4 ? Math.round(rnd() * 1e4) / 10 : k < 0.85 ? `v${i}${k < 0.5 ? ' & <x> _x0041_' : ''}` : null;
    edits.push({ sheet, ref, value });
  }
  const index = await indexWorkbook(bytes);
  const allowed: CellEdit[] = [];
  for (const e of edits) {
    try {
      await checkCellEdit(index, e);
      allowed.push(e);
    } catch (error) {
      assert.ok(error instanceof CellEditRefused, `${label}: ${e.ref} threw ${error}`);
    }
  }
  const { bytes: out, report } = await applyCellEdits(bytes, allowed);
  const last = new Map(coalesceEdits(allowed).map((e) => [e.ref, e.value]));
  const after = cellsOf(out, sheet);
  let mismatches = 0;
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const want = last.has(k) ? (last.get(k) === null ? undefined : last.get(k)) : before[k];
    if (after[k] !== want) {
      if (mismatches++ < 5) console.log(`  ${label} MISMATCH ${k}: ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}, want ${JSON.stringify(want)}`);
    }
  }
  assert.equal(mismatches, 0, `${label}: cells other than the edited ones changed`);
  const changed = changedParts(bytes, out);
  assert.deepEqual(changed, [...report.touched].sort(), `${label}: only the touched parts differ`);
  assert.deepEqual(await checkOfficePackage(out, 'xl/'), { ok: true }, `${label}: the package passes the Office check`);
  console.log(`  ${label}: ${allowed.length} edits (${n - allowed.length} refused), ${Object.keys(before).length} cells compared, ${report.touched.length} parts touched`);
  return out;
}

async function main() {
  const rich = fixture('rich.xlsx');
  const excelish = fixture('rich-excelish.xlsx');

  // ── Typed text → value, and one edit per cell ─────────────────────────────
  assert.equal(cellValueFromText(''), null);
  assert.equal(cellValueFromText('12.5'), 12.5);
  assert.equal(cellValueFromText(' 7 '), 7);
  assert.equal(cellValueFromText('1e3'), 1000);
  assert.equal(cellValueFromText('Infinity'), 'Infinity');
  assert.equal(cellValueFromText('  '), '  ');
  assert.equal(cellValueFromText('a\u0007b'), 'ab');
  assert.equal(cellValueFromText('\u0007'), null);
  assert.deepEqual(
    coalesceEdits([
      { sheet: 'S', ref: 'A1', value: 1 },
      { sheet: 'S', ref: 'B1', value: 2 },
      { sheet: 'S', ref: 'A1', value: 3 },
    ]),
    [
      { sheet: 'S', ref: 'B1', value: 2 },
      { sheet: 'S', ref: 'A1', value: 3 },
    ],
  );

  // ── #711's case: one edit keeps every fill, font, border, chart and picture ─
  {
    const { bytes, report } = await applyCellEdits(excelish, [{ sheet: 'Budget', ref: 'A3', value: 'Rent (edited)' }]);
    // the fixture already asks Excel to recalculate on open, so workbook.xml keeps its bytes too
    assert.deepEqual(report.touched.sort(), ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']);
    assert.equal(report.calcChainDropped, false, 'no formula was overwritten, so the chain stays');
    assert.deepEqual(changedParts(excelish, bytes), report.touched.sort());
    const sheetXml = (await partText(bytes, 'xl/worksheets/sheet1.xml'))!;
    const original = (await partText(excelish, 'xl/worksheets/sheet1.xml'))!;
    const a3 = /<c r="A3"[^>]*>.*?<\/c>/.exec(original)![0];
    const style = /s="(\d+)"/.exec(a3)![1];
    assert.equal(sheetXml, original.replace(a3, `<c r="A3" s="${style}" t="s"><v>50</v></c>`), 'only A3 changed, keeping its style');
    const sst = (await partText(bytes, 'xl/sharedStrings.xml'))!;
    assert.match(sst, /<si><t>Rent \(edited\)<\/t><\/si><\/sst>$/);
    assert.match(sst, /uniqueCount="51"/);
    assert.match((await partText(bytes, 'xl/workbook.xml'))!, /<calcPr[^>]*fullCalcOnLoad="1"/);
    assert.equal(cellsOf(bytes, 'Budget').A3, 'Rent (edited)');
  }

  // ── Overwriting a formula drops the calculation chain, its relationship and content type ─
  {
    const { bytes, report } = await applyCellEdits(excelish, [{ sheet: 'Budget', ref: 'B11', value: 1 }]);
    assert.equal(report.formulasRemoved, 1);
    assert.ok(report.calcChainDropped);
    const pkg = openPackage(bytes);
    assert.ok(!pkg.byName.has('xl/calcChain.xml'));
    assert.doesNotMatch((await partText(bytes, 'xl/_rels/workbook.xml.rels'))!, /calcChain/);
    assert.doesNotMatch((await partText(bytes, '[Content_Types].xml'))!, /calcChain/);
    assert.ok(isWellFormedXml((await partText(bytes, '[Content_Types].xml'))!));
    assert.equal(cellsOf(bytes, 'Budget').B11, 1);
  }

  // ── Excel for Mac's own file: a value edit touches the sheet and the recalculation flag only ─
  {
    const { bytes, report } = await applyCellEdits(excelMac, [{ sheet: 'Sales', ref: 'B3', value: 13 }]);
    assert.deepEqual(report.touched.sort(), ['xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    assert.equal(cellsOf(bytes, 'Sales').B3, 13);
  }

  // ── Inline strings when the workbook has no shared string table; clearing keeps formatting ─
  {
    const { bytes } = await applyCellEdits(rich, [
      { sheet: 'Budget', ref: 'A3', value: '  new & <odd> _x0041_ ' },
      { sheet: 'Budget', ref: 'B4', value: null },
      { sheet: 'Budget', ref: 'H30', value: 'far away' },
    ]);
    const xml = (await partText(bytes, 'xl/worksheets/sheet1.xml'))!;
    assert.match(xml, /<c r="A3"( s="\d+")? t="inlineStr"><is><t xml:space="preserve">  new &amp; &lt;odd&gt; _x005F_x0041_ <\/t><\/is><\/c>/);
    assert.match(xml, /<c r="B4" s="\d+"\/>/, 'a cleared cell keeps its style');
    assert.match(xml, /<dimension ref="A1:H30"\/>/, 'the dimension grew');
    const cells = cellsOf(bytes, 'Budget');
    assert.equal(cells.A3, '  new & <odd> _x0041_ ');
    assert.equal(cells.B4, undefined);
    assert.equal(cells.H30, 'far away');
  }

  // ── A new cell takes its column's style ─────────────────────────────────────
  {
    const styled = await rezip(excelMac, (files) => {
      const xml = files.get('xl/worksheets/sheet1.xml') as string;
      files.set('xl/worksheets/sheet1.xml', xml.replace(/<sheetData/, '<cols><col min="8" max="8" width="12" style="2" customWidth="1"/></cols><sheetData'));
    });
    const { bytes } = await applyCellEdits(styled, [{ sheet: 'Sales', ref: 'H2', value: 5 }]);
    assert.match((await partText(bytes, 'xl/worksheets/sheet1.xml'))!, /<c r="H2" s="2"><v>5<\/v><\/c>/);
  }

  // ── Shared formulas: overwriting the anchor gives each other cell its own formula ─
  const shared = await rezip(excelMac, (files) => {
    const xml = files.get('xl/worksheets/sheet1.xml') as string;
    files.set(
      'xl/worksheets/sheet1.xml',
      xml
        .replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B3*C3</f>')
        .replace('<f>B4*C4</f>', '<f t="shared" si="0"/>')
        .replace('<f>B5*C5</f>', '<f t="shared" si="0"/>')
        .replace('<f>B6*C6</f>', '<f t="shared" si="0"/>'),
    );
  });
  {
    assert.match((await partText(shared, 'xl/worksheets/sheet1.xml'))!, /t="shared" si="0"\/>/, 'the fixture shares its formula');
    const { bytes, report } = await applyCellEdits(shared, [{ sheet: 'Sales', ref: 'D3', value: 1 }]);
    const xml = (await partText(bytes, 'xl/worksheets/sheet1.xml'))!;
    assert.match(xml, /<c r="D3"[^>]*><v>1<\/v><\/c>/);
    for (const r of [4, 5, 6]) assert.match(xml, new RegExp(`<c r="D${r}"[^>]*><f>B${r}\\*C${r}</f>`));
    assert.doesNotMatch(xml, /t="shared"/);
    assert.equal(report.formulasRemoved, 1);
    const cells = cellsOf(bytes, 'Sales');
    assert.equal(cells.D4, 'f:B4*C4');
    // overwriting a dependent only removes its own formula
    const dep = await applyCellEdits(shared, [{ sheet: 'Sales', ref: 'D5', value: 2 }]);
    const depXml = (await partText(dep.bytes, 'xl/worksheets/sheet1.xml'))!;
    assert.match(depXml, /<f t="shared" ref="D3:D6" si="0">B3\*C3<\/f>/);
    assert.equal(cellsOf(dep.bytes, 'Sales').D6, 'f:B6*C6');
  }

  // ── A shared formula that can't be moved to every cell of its range is refused when the anchor is edited ─
  {
    const unmovable = await rezip(excelMac, (files) => {
      const xml = files.get('xl/worksheets/sheet1.xml') as string;
      files.set('xl/worksheets/sheet1.xml', xml.replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B1048574*2</f>').replace('<f>B4*C4</f>', '<f t="shared" si="0"/>'));
    });
    const index = await indexWorkbook(unmovable);
    await assert.rejects(checkCellEdit(index, { sheet: 'Sales', ref: 'D3', value: 1 }), /shared with other cells/);
    await checkCellEdit(index, { sheet: 'Sales', ref: 'D4', value: 1 });
  }

  // ── Refusals: an array formula, a data table, a table's header and totals rows, a chart sheet, long text ─
  {
    const arrays = await rezip(excelMac, (files) => {
      const xml = files.get('xl/worksheets/sheet1.xml') as string;
      files.set('xl/worksheets/sheet1.xml', xml.replace('<f>B3*C3</f>', '<f t="array" ref="D3:D6">B3:B6*C3:C6</f>'));
    });
    const index = await indexWorkbook(arrays);
    await assert.rejects(checkCellEdit(index, { sheet: 'Sales', ref: 'D5', value: 1 }), /array formula \(D3:D6\)/);
    await checkCellEdit(index, { sheet: 'Sales', ref: 'E5', value: 1 });
    await assert.rejects(applyCellEdits(arrays, [{ sheet: 'Sales', ref: 'D4', value: 1 }]), CellEditRefused);

    const richIndex = await indexWorkbook(rich);
    const tableXml = (await partText(rich, 'xl/tables/table1.xml'))!;
    const tableRef = /ref="([A-Z]+\d+):/.exec(tableXml)![1];
    await assert.rejects(checkCellEdit(richIndex, { sheet: 'Data', ref: tableRef, value: 'x' }), /column name in the table/);
    await assert.rejects(checkCellEdit(richIndex, { sheet: 'Nope', ref: 'A1', value: 1 }), /no sheet named Nope/);
    await assert.rejects(checkCellEdit(richIndex, { sheet: 'Budget', ref: 'A0', value: 1 }), /not a cell address/);
    await assert.rejects(checkCellEdit(richIndex, { sheet: 'Budget', ref: 'A1', value: 'x'.repeat(32_768) }), /32,767 characters/);
    await checkCellEdit(richIndex, { sheet: 'Budget', ref: 'A1', value: 'x'.repeat(32_767) });

    const totals = await rezip(rich, (files) => {
      const t = files.get('xl/tables/table1.xml') as string;
      files.set('xl/tables/table1.xml', t.replace('<table ', '<table totalsRowCount="1" '));
    });
    const lastRow = /ref="[A-Z]+\d+:([A-Z]+)(\d+)"/.exec(tableXml)!;
    await assert.rejects(checkCellEdit(await indexWorkbook(totals), { sheet: 'Data', ref: `A${lastRow[2]}`, value: 'x' }), /totals row/);

    const chartSheet = await rezip(excelMac, (files) => {
      const rels = files.get('xl/_rels/workbook.xml.rels') as string;
      files.set('xl/_rels/workbook.xml.rels', rels.replace(/(Id="rId3"[^>]*Type="[^"]*\/)worksheet"|(Type="[^"]*\/)worksheet"([^>]*Id="rId3")/, (m) => m.replace('/worksheet"', '/chartsheet"')));
    });
    const chartIndex = await indexWorkbook(chartSheet);
    const third = [...chartIndex.sheets.values()].find((s) => s.path === null);
    assert.ok(third, 'the fixture has a chart sheet');
    await assert.rejects(checkCellEdit(chartIndex, { sheet: third!.name, ref: 'A1', value: 1 }), /chart sheet/);
  }

  // ── A shared anchor in a sheet whose cells carry no r is guarded at edit time too ─
  {
    const noR = await rezip(excelMac, (files) => {
      const xml = (files.get('xl/worksheets/sheet1.xml') as string)
        .replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B1048574*2</f>')
        .replace('<f>B4*C4</f>', '<f t="shared" si="0"/>')
        .replace(/<c r="[A-Z]+\d+"/g, '<c');
      files.set('xl/worksheets/sheet1.xml', xml);
    });
    await assert.rejects(checkCellEdit(await indexWorkbook(noR), { sheet: 'Sales', ref: 'D3', value: 1 }), /shared with other cells/);
  }

  // ── A package that would unpack to too much is refused before anything is inflated ─
  {
    const bomb = await rezip(excelMac, (files) => files.set('xl/media/zeros.bin', new Uint8Array(21 * 1024 * 1024)));
    await assert.rejects(indexWorkbook(bomb), /too complex/);
  }

  // ── A workbook with no calcPr gets one in schema order ──────────────────────
  {
    const noCalc = await rezip(excelMac, (files) => {
      files.set('xl/workbook.xml', (files.get('xl/workbook.xml') as string).replace(/<calcPr[^>]*\/>/, ''));
    });
    assert.doesNotMatch((await partText(noCalc, 'xl/workbook.xml'))!, /calcPr/);
    const { bytes } = await applyCellEdits(noCalc, [{ sheet: 'Sales', ref: 'B3', value: 2 }]);
    const wb = (await partText(bytes, 'xl/workbook.xml'))!;
    assert.match(wb, /<\/(definedNames|sheets)><calcPr fullCalcOnLoad="1"\/>/);
    assert.ok(isWellFormedXml(wb));
  }

  // ── Data descriptors (streamed ZIPs): copied with their descriptors, and the result reads ─
  {
    const streamed = await rezip(excelMac, () => {}, { streamFiles: true });
    const pkg = openPackage(streamed);
    assert.ok(pkg.entries.some((e) => e.flags & 0x8), 'the fixture has data descriptors');
    const { bytes, report } = await applyCellEdits(streamed, [{ sheet: 'Sales', ref: 'A2', value: 'x' }]);
    assert.deepEqual(changedParts(streamed, bytes), report.touched.sort());
    assert.deepEqual(await checkOfficePackage(bytes, 'xl/'), { ok: true });
    assert.equal(cellsOf(bytes, 'Sales').A2, 'x');
  }

  // ── No edits: the same bytes ────────────────────────────────────────────────
  assert.equal((await applyCellEdits(excelish, [])).bytes, excelish);

  // ── The fuzz test, ported from the study: seeded random edits, read back with SheetJS ─
  console.log('fuzz:');
  await fuzz('rich-excelish (shared strings)', excelish, 'Budget', 25, 9, 200);
  await fuzz('rich (inline strings)', rich, 'Budget', 25, 9, 200);
  await fuzz('Excel for Mac', excelMac, 'Sales', 10, 8, 100);
  await fuzz('shared formulas', shared, 'Sales', 10, 8, 60);
  const prefixed = await rezip(excelMac, (files) => {
    const x = (files.get('xl/worksheets/sheet1.xml') as string)
      .replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
      .replace('</worksheet>', '</x:worksheet>')
      .replace(/<(\/?)(dimension|sheetViews|sheetView|selection|sheetFormatPr|cols|col|sheetData|row|c|v|f|pageMargins|ignoredErrors|ignoredError)([\s/>])/g, '<$1x:$2$3');
    files.set('xl/worksheets/sheet1.xml', x);
  });
  assert.match((await partText(prefixed, 'xl/worksheets/sheet1.xml'))!, /<x:c r=/);
  await fuzz('x:-prefixed sheet', prefixed, 'Sales', 10, 8, 100);
  const noPositions = await rezip(excelMac, (files) => {
    files.set('xl/worksheets/sheet1.xml', (files.get('xl/worksheets/sheet1.xml') as string).replace(/<row r="\d+"/g, '<row').replace(/<c r="[A-Z]+\d+"/g, '<c'));
  });
  await fuzz('rows and cells without r', noPositions, 'Sales', 6, 6, 60);

  // A sheet of 5,000 rows × 20 columns (the 50,000-row run is in the sprint's research)
  {
    const rows: string[] = [];
    for (let r = 1; r <= 5000; r++) {
      let cells = '';
      for (let c = 0; c < 20; c++) {
        const ref = `${XLSX.utils.encode_col(c)}${r}`;
        cells += c % 3 === 0 ? `<c r="${ref}" t="inlineStr"><is><t>r${r}c${c}</t></is></c>` : `<c r="${ref}"><v>${r * 100 + c}</v></c>`;
      }
      rows.push(`<row r="${r}" spans="1:20">${cells}</row>`);
    }
    const big = await rezip(excelMac, (files) => {
      const x = files.get('xl/worksheets/sheet2.xml') as string;
      files.set('xl/worksheets/sheet2.xml', x.replace(/<sheetData[\s\S]*?(<\/sheetData>|<sheetData\/>)/, `<sheetData>${rows.join('')}</sheetData>`).replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:T5000"/>'));
    });
    const second = [...(await indexWorkbook(big)).sheets.values()].find((s) => s.path === 'xl/worksheets/sheet2.xml')!.name;
    await fuzz('5,000 × 20', big, second, 5001, 21, 200);
  }

  console.log('applyCellEdits: all passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
