/**
 * Sprint 158 (#711): finding, replacing and inserting cells in a sheet's XML, as text.
 * Run: npx tsx src/excel/sheetXml.test.ts
 */
import assert from 'node:assert/strict';
import {
  attr,
  cellRef,
  columnLetters,
  columnNumber,
  decodeCellText,
  escapeCellText,
  growDimension,
  hasImplicitPositions,
  locateCell,
  parseCellRef,
  readCellContent,
  rootPrefix,
  setAttr,
  textOfStringItem,
  writeCell,
  writeImplicitPositions,
} from './sheetXml';

const sheet = (data: string, p = '', extra = '') =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${p}worksheet xmlns${p ? ':' + p.slice(0, -1) : ''}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><${p}dimension ref="A1:C3"/>${extra}${data}</${p}worksheet>`;

function put(xml: string, ref: string, cellXml: string, p = ''): string {
  const at = parseCellRef(ref)!;
  return writeCell(xml, at, locateCell(xml, at, p), cellXml, p);
}

// Addresses
assert.equal(columnNumber('A'), 1);
assert.equal(columnNumber('Z'), 26);
assert.equal(columnNumber('AA'), 27);
assert.equal(columnNumber('XFD'), 16_384);
assert.equal(columnLetters(16_384), 'XFD');
assert.equal(columnLetters(703), 'AAA');
assert.deepEqual(parseCellRef('B12'), { r: 12, c: 2 });
assert.equal(parseCellRef('XFE1'), null, 'past the last column');
assert.equal(parseCellRef('A1048577'), null, 'past the last row');
assert.equal(parseCellRef('A0'), null);
assert.equal(parseCellRef('a1'), null, 'addresses are upper case');
assert.equal(parseCellRef('A1:B2'), null);
assert.equal(cellRef({ r: 3, c: 28 }), 'AB3');

// Attributes
assert.equal(attr('<c r="A1" s="3" t="s">', 's'), '3');
assert.equal(attr('<c r="A1" xs="3">', 's'), undefined, 'not a longer name ending in s');
assert.equal(attr("<c r='A1'>", 'r'), 'A1', 'single quotes');
assert.equal(setAttr('<row r="2" spans="1:3">', 'spans', '1:5'), '<row r="2" spans="1:5">');
assert.equal(setAttr('<calcPr calcId="191029"/>', 'fullCalcOnLoad', '1'), '<calcPr calcId="191029" fullCalcOnLoad="1"/>');

// Text escaping: XML characters, _xHHHH_ written so Excel reads it literally, characters XML can't hold dropped
assert.equal(escapeCellText('a & <b> "c"'), 'a &amp; &lt;b&gt; "c"');
assert.equal(escapeCellText('_x0041_'), '_x005F_x0041_');
assert.equal(escapeCellText('tab\tline\nbell\u0007'), 'tab\tline\nbell');
assert.equal(decodeCellText(escapeCellText('_x0041_ & <x>')), '_x0041_ & <x>', 'round trip');
assert.equal(decodeCellText('_x0041_&#x42;&#67;'), 'ABC');
assert.equal(textOfStringItem('<r><t>Mixed </t></r><r><rPr><b/></rPr><t>bold</t></r><rPh sb="0" eb="1"><t>ふり</t></rPh>', ''), 'Mixed bold');

// Prefixes: the root's, whatever it is
assert.equal(rootPrefix(sheet(''), 'worksheet'), '');
assert.equal(rootPrefix(sheet('', 'x:'), 'worksheet'), 'x:');

// Replace a cell, keeping every other byte
{
  const xml = sheet('<sheetData><row r="1" spans="1:3"><c r="A1" s="2" t="s"><v>0</v></c><c r="B1"><v>5</v></c></row></sheetData>');
  const out = put(xml, 'B1', '<c r="B1"><v>6</v></c>');
  assert.equal(out, xml.replace('<c r="B1"><v>5</v></c>', '<c r="B1"><v>6</v></c>'));
  const loc = locateCell(xml, parseCellRef('A1')!, '');
  assert.equal(loc.kind, 'replace');
  if (loc.kind === 'replace') assert.deepEqual(readCellContent(loc.openTag, loc.body, ''), { type: 's', style: '2', value: '0' });
}

// Insert: before a later cell, at a row's end, a new row between rows, after the last row
{
  const xml = sheet('<sheetData><row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row><row r="3"><c r="A3"><v>9</v></c></row></sheetData>');
  assert.match(put(xml, 'B1', '<c r="B1"><v>2</v></c>'), /<c r="A1"><v>1<\/v><\/c><c r="B1"><v>2<\/v><\/c><c r="C1">/);
  assert.match(put(xml, 'D1', '<c r="D1"><v>4</v></c>'), /<c r="C1"><v>3<\/v><\/c><c r="D1"><v>4<\/v><\/c><\/row>/);
  assert.match(put(xml, 'B2', '<c r="B2"><v>2</v></c>'), /<\/row><row r="2"><c r="B2"><v>2<\/v><\/c><\/row><row r="3">/);
  assert.match(put(xml, 'A9', '<c r="A9"><v>2</v></c>'), /<row r="3"><c r="A3"><v>9<\/v><\/c><\/row><row r="9"><c r="A9"><v>2<\/v><\/c><\/row><\/sheetData>/);
  assert.equal(put(xml, 'B2', ''), xml, 'clearing a cell that is not there changes nothing');
}

// A self-closing row (formatting only), a self-closing sheetData
{
  const xml = sheet('<sheetData><row r="2" ht="30" customHeight="1"/></sheetData>');
  assert.match(put(xml, 'B2', '<c r="B2"><v>1</v></c>'), /<row r="2" ht="30" customHeight="1"><c r="B2"><v>1<\/v><\/c><\/row>/);
  const empty = sheet('<sheetData/>');
  assert.match(put(empty, 'C3', '<c r="C3"><v>1</v></c>'), /<sheetData><row r="3"><c r="C3"><v>1<\/v><\/c><\/row><\/sheetData>/);
}

// spans grows to take in a new cell; a list of spans is dropped (it is only a hint)
{
  const xml = sheet('<sheetData><row r="1" spans="2:3"><c r="B1"><v>1</v></c></row></sheetData>');
  assert.match(put(xml, 'E1', '<c r="E1"><v>1</v></c>'), /<row r="1" spans="2:5">/);
  const two = sheet('<sheetData><row r="1" spans="1:2 4:5"><c r="B1"><v>1</v></c></row></sheetData>');
  assert.match(put(two, 'C1', '<c r="C1"><v>1</v></c>'), /<row r="1"><c r="B1">/);
}

// Prefixed elements, as the Open XML SDK writes them; other namespaces' <c:...> are never taken for cells
{
  const xml = sheet('<x:sheetData><x:row r="1"><x:c r="A1"><x:v>1</x:v></x:c></x:row></x:sheetData>', 'x:');
  const out = put(xml, 'B1', '<x:c r="B1"><x:v>2</x:v></x:c>', 'x:');
  assert.match(out, /<x:c r="A1"><x:v>1<\/x:v><\/x:c><x:c r="B1"><x:v>2<\/x:v><\/x:c><\/x:row>/);
  const mixed = sheet('<sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData>', '', '<c:chart xmlns:c="urn:x"/>');
  assert.match(put(mixed, 'B1', '<c r="B1"><v>2</v></c>'), /<c r="A1"><v>1<\/v><\/c><c r="B1">/);
}

// Rows and cells without r: positions are written out first, so an insert can't shift neighbours
{
  const xml = sheet('<sheetData><row><c><v>1</v></c><c><v>2</v></c></row><row><c><v>3</v></c></row></sheetData>');
  assert.ok(hasImplicitPositions(xml, ''));
  const explicit = writeImplicitPositions(xml, '');
  assert.match(explicit, /<row r="1"><c r="A1"><v>1<\/v><\/c><c r="B1"><v>2<\/v><\/c><\/row><row r="2"><c r="A2"><v>3<\/v><\/c><\/row>/);
  assert.ok(!hasImplicitPositions(explicit, ''));
  const full = sheet('<sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData>');
  assert.equal(writeImplicitPositions(full, ''), full, 'nothing to do: the same string');
  // a row with r after rows without
  const partly = sheet('<sheetData><row><c r="B1"><v>1</v></c><c><v>2</v></c></row><row r="5"><c><v>3</v></c></row></sheetData>');
  assert.match(writeImplicitPositions(partly, ''), /<c r="B1"><v>1<\/v><\/c><c r="C1"><v>2<\/v><\/c><\/row><row r="5"><c r="A5">/);
}

// The dimension grows; it doesn't shrink and isn't touched when the cell is inside
{
  const xml = sheet('<sheetData/>');
  assert.match(growDimension(xml, { r: 10, c: 5 }, ''), /<dimension ref="A1:E10"\/>/);
  assert.equal(growDimension(xml, { r: 2, c: 2 }, ''), xml);
  const single = xml.replace('A1:C3', 'B2');
  assert.match(growDimension(single, { r: 1, c: 1 }, ''), /<dimension ref="A1:B2"\/>/);
}

// A formula cell's content, a shared formula's dependent, an inline string
{
  const read = (cell: string) => {
    const xml = sheet(`<sheetData><row r="1">${cell}</row></sheetData>`);
    const loc = locateCell(xml, { r: 1, c: 1 }, '');
    assert.equal(loc.kind, 'replace');
    return loc.kind === 'replace' ? readCellContent(loc.openTag, loc.body, '') : null;
  };
  assert.deepEqual(read('<c r="A1"><f>SUM(B1:B3)&amp;"x"</f><v>6</v></c>'), { type: undefined, style: undefined, value: '6', formula: 'SUM(B1:B3)&"x"', formulaAttrs: '' });
  assert.equal(read('<c r="A1"><f t="shared" si="0"/><v>6</v></c>')!.formula, '');
  assert.equal(read('<c r="A1" t="inlineStr"><is><t xml:space="preserve"> a &amp; b </t></is></c>')!.inlineText, ' a & b ');
  assert.deepEqual(read('<c r="A1" s="4"/>'), { type: undefined, style: '4' });
}

console.log('sheetXml: all passed');
