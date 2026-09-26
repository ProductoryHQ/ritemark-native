/**
 * v1.12.0 RC fix — laying out pages for a document without Word's page markers.
 * Run: npx tsx webview/src/components/viewers/docx/pagination.test.ts
 */
import assert from 'node:assert/strict';
import {
  borderSpaces,
  insertPageBreaks,
  markBodyBlocks,
  markEmptyParagraphs,
  paragraphStyles,
  planPageBreaks,
  splitBreak,
  type Line,
  type MeasuredBlock,
  type MeasuredPage,
} from './pagination';

const body = (inner: string) => `<w:document><w:body>${inner}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
const p = (text: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (text: string) => `<w:tc><w:tcPr><w:tcW w:w="100"/></w:tcPr>${p(text)}</w:tc>`;
const row = (cells: string, trPr = '') => `<w:tr>${trPr ? `<w:trPr>${trPr}</w:trPr>` : ''}${cells}</w:tr>`;
const table = (rows: string, look = '<w:tblLook w:val="04A0" w:firstRow="1"/>') =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/>${look}</w:tblPr><w:tblGrid><w:gridCol w:w="100"/></w:tblGrid>${rows}</w:tbl>`;
const bookmarks = (xml: string) => [...xml.matchAll(/w:name="(_rm[bc]\d+)"/g)].map((m) => m[1]);
const NO_STYLES = paragraphStyles(null);
const heading1 = paragraphStyles(
  '<w:styles><w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:style></w:styles>',
);

// ── paragraphStyles: flags through w:basedOn, an explicit off wins, the document defaults underneath.
{
  const styles = paragraphStyles(
    '<w:styles>' +
      '<w:docDefaults><w:pPrDefault><w:pPr><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:basedOn w:val="Heading1"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Loose"><w:basedOn w:val="Heading1"/><w:pPr><w:keepNext w:val="0"/><w:widowControl w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="character" w:styleId="Strong"><w:rPr><w:b/></w:rPr></w:style>' +
      '</w:styles>',
  );
  assert.equal(styles.flag('Heading1', 'keepNext'), true);
  assert.equal(styles.flag('Heading2', 'keepNext'), true, 'inherited through w:basedOn');
  assert.equal(styles.flag('Heading2', 'keepLines'), true);
  assert.equal(styles.flag('Loose', 'keepNext'), false, 'an explicit off wins');
  assert.equal(styles.flag(undefined, 'keepNext'), false, 'no style: the default paragraph style');
  assert.equal(styles.flag(undefined, 'widowControl'), true, 'the document defaults');
  assert.equal(styles.flag('Heading2', 'widowControl'), true);
  assert.equal(styles.flag('Loose', 'widowControl'), false);
  assert.equal(styles.flag('Missing', 'keepNext'), false, 'an unknown style: the default paragraph style');
  assert.equal(NO_STYLES.flag('Heading1', 'widowControl'), true, "no styles part: widow control on, Word's default");
  assert.equal(NO_STYLES.flag('Heading1', 'keepNext'), false, 'the keep flags off');
  assert.equal(NO_STYLES.flag(undefined, 'keepLines'), false);
  assert.equal(
    paragraphStyles('<w:docDefaults><w:pPrDefault><w:pPr><w:widowControl w:val="0"/></w:pPr></w:pPrDefault></w:docDefaults>').flag(undefined, 'widowControl'),
    false,
    'only a document that turns it off',
  );
  // A default paragraph style that keeps with next applies to unstyled paragraphs.
  assert.equal(paragraphStyles('<w:style w:type="paragraph" w:default="1" w:styleId="N"><w:pPr><w:keepNext/></w:pPr></w:style>').flag(undefined, 'keepNext'), true);
}

// ── markBodyBlocks: every top-level paragraph, and each row of a top-level table, gets a marker.
{
  const doc = body(
    p('Title', '<w:pStyle w:val="Heading1"/>') +
      '<w:p/>' +
      '<w:p w:rsidR="00A1"/>' +
      p('kept', '<w:keepNext/>') +
      table(row(cell('h'), '<w:tblHeader/>') + row(cell('a')) + row(cell('b'))) +
      '<w:sdt><w:sdtPr/><w:sdtContent>' + p('in a content control') + '</w:sdtContent></w:sdt>' +
      p('last'),
  );
  const { xml, markers } = markBodyBlocks(doc, heading1);
  assert.deepEqual(bookmarks(xml), ['_rmb0', '_rmb1', '_rmb2', '_rmb3', '_rmb4', '_rmb5', '_rmb6', '_rmb7', '_rmb8']);
  assert.deepEqual(markers.get('_rmb0'), { kind: 'p', keepNext: true, widowControl: true, splitText: null }, 'keep-with-next from the style; kept lines together, so never split');
  assert.deepEqual(markers.get('_rmb1'), { kind: 'p', keepNext: false, widowControl: true, splitText: null }, 'an empty paragraph has nothing to split');
  assert.deepEqual(markers.get('_rmb3'), { kind: 'p', keepNext: true, widowControl: true, splitText: 4 }, 'keep-with-next set on the paragraph');
  assert.deepEqual(markers.get('_rmb4'), { kind: 'row', index: 0, header: true });
  assert.deepEqual(markers.get('_rmb5'), { kind: 'row', index: 1, header: false });
  assert.deepEqual(markers.get('_rmb7'), { kind: 'p', keepNext: false, widowControl: true, splitText: 20 }, 'a paragraph inside a content control is a block');
  // The marker goes after the paragraph properties; empty paragraphs are opened up to hold it.
  assert.ok(xml.includes('<w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:bookmarkStart w:id="1800000000" w:name="_rmb0"/>'), xml);
  assert.ok(xml.includes('<w:p><w:bookmarkStart w:id="1800000001" w:name="_rmb1"/><w:bookmarkEnd w:id="1800000001"/></w:p>'), xml);
  assert.ok(xml.includes('<w:p w:rsidR="00A1"><w:bookmarkStart w:id="1800000002"'), xml);
  // Row markers sit in the first paragraph of the row's first cell.
  assert.ok(xml.includes('<w:tc><w:tcPr><w:tcW w:w="100"/></w:tcPr><w:p><w:bookmarkStart w:id="1800000004" w:name="_rmb4"/>'), xml);
}

// ── Paragraphs that are not top-level blocks get no marker: text boxes, nested tables, later cells.
{
  const textBox = `<w:p><w:r><w:drawing><w:txbxContent>${p('inside a text box')}</w:txbxContent></w:drawing></w:r></w:p>`;
  const nested = table(row(`<w:tc>${table(row(cell('inner')), '')}${p('after inner')}</w:tc>${cell('second cell')}`), '');
  const { xml, markers } = markBodyBlocks(body(textBox + nested), NO_STYLES);
  assert.deepEqual(bookmarks(xml), ['_rmb0', '_rmb1']);
  assert.equal(markers.get('_rmb0')?.kind, 'p');
  assert.equal(markers.get('_rmb1')?.kind, 'row');
  // The row's marker is in its first cell's first direct paragraph, not in the nested table.
  assert.ok(xml.includes('<w:p><w:bookmarkStart w:id="1800000001" w:name="_rmb1"/><w:bookmarkEnd w:id="1800000001"/><w:r><w:t>after inner</w:t>'), xml);
}

// ── A paragraph whose properties record a change (nested w:pPr): the marker goes after the outer properties.
{
  const tracked = '<w:p><w:pPr><w:jc w:val="center"/><w:pPrChange w:id="1"><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrChange></w:pPr><w:r><w:t>x</w:t></w:r></w:p>';
  const { xml } = markBodyBlocks(body(tracked), NO_STYLES);
  assert.ok(xml.includes('</w:pPrChange></w:pPr><w:bookmarkStart'), xml);
}

// ── Paragraph borders: the spacing Word keeps between the text and each border, from the paragraph or its style.
{
  assert.equal(borderSpaces(undefined), undefined);
  assert.deepEqual(
    borderSpaces('<w:top w:val="single" w:sz="4" w:space="1" w:color="auto"/><w:left w:val="single" w:sz="18" w:space="16" w:color="FF91B6"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'),
    { left: 16, top: 1 },
    'sides set to none draw nothing',
  );
  assert.deepEqual(borderSpaces('<w:start w:val="single" w:sz="4"/><w:end w:val="double" w:sz="4" w:space="4"/>'), { left: 0, right: 4 }, 'start and end are left and right; no w:space is 0');
  assert.equal(borderSpaces('<w:left w:val="nil"/>'), undefined);

  const styles = paragraphStyles(
    '<w:styles>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:widowControl/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="BlockText"><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="16" w:color="FF91B6"/></w:pBdr></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Quote2"><w:basedOn w:val="BlockText"/></w:style>' +
      '</w:styles>',
  );
  assert.equal(styles.borders('Normal'), undefined);
  assert.ok(styles.borders('Quote2')?.includes('w:space="16"'), 'inherited through w:basedOn');
  assert.equal(styles.borders(undefined), undefined, 'the default paragraph style has none');

  const { markers } = markBodyBlocks(
    body(
      p('quote', '<w:pStyle w:val="BlockText"/>') +
        p('boxed', '<w:pBdr><w:top w:val="single" w:space="12"/><w:bottom w:val="single" w:space="12"/></w:pBdr>') +
        p('plain'),
    ),
    styles,
  );
  const borders = (name: string) => {
    const marker = markers.get(name);
    return marker?.kind === 'p' ? marker.borders : undefined;
  };
  assert.deepEqual(borders('_rmb0'), { left: 16 }, 'from the style');
  assert.deepEqual(borders('_rmb1'), { top: 12, bottom: 12 }, "the paragraph's own borders");
  assert.equal(borders('_rmb2'), undefined);
  assert.ok(!('borders' in markers.get('_rmb2')!), 'a paragraph without a border has no borders entry');
}

// ── Empty paragraphs: one line of their paragraph mark, whose size is marked for the renderer.
{
  const styles = paragraphStyles(
    '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="26"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="40"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:basedOn w:val="Heading1"/></w:style>' +
      '</w:styles>',
  );
  assert.equal(styles.markSize('Heading1'), 36, "the style's size, not the complex-script one");
  assert.equal(styles.markSize('Heading2'), 36, 'through w:basedOn');
  assert.equal(styles.markSize(undefined), 26, 'the default paragraph style, then the document default');
  assert.equal(NO_STYLES.markSize(undefined), 20, "Word's 10 pt");

  const names = (xml: string) => [...xml.matchAll(/w:name="(_rme\d+s\d+)"/g)].map((m) => m[1]);
  const doc =
    '<w:p/>' +
    '<w:p w:rsidR="00A1"/>' +
    '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="FF91B6"/></w:pBdr><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:sz w:val="12"/></w:rPr></w:r><w:bookmarkStart w:id="0" w:name="x"/><w:bookmarkEnd w:id="0"/></w:p>' +
    p('text') +
    '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>' +
    '<w:p><w:r><w:tab/></w:r></w:p>' +
    '<w:p><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p>' +
    '<w:p><w:r><w:pict><v:textbox><w:txbxContent><w:p/></w:txbxContent></v:textbox></w:pict></w:r></w:p>' +
    '<w:p><w:pPr><w:rPr><w:b/><w:rPrChange w:id="1"><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr></w:pPr></w:p>';
  const { xml, next } = markEmptyParagraphs(body(doc), styles, 3);
  assert.deepEqual(
    names(xml),
    ['_rme3s26', '_rme4s26', '_rme5s2', '_rme6s36', '_rme7s26', '_rme8s26', '_rme9s26'],
    'self-closing ones, a 1 pt spacer, a heading style, an empty text, a text box paragraph, a recorded change; not text, a tab or a picture',
  );
  assert.equal(next, 10, 'numbering goes on in the next part');
  assert.ok(xml.includes('<w:p><w:bookmarkStart w:id="1400000003" w:name="_rme3s26"/><w:bookmarkEnd w:id="1400000003"/></w:p><w:p w:rsidR="00A1"><w:bookmarkStart'), 'a self-closing paragraph opens up');
  assert.ok(xml.includes('</w:pPr><w:bookmarkStart w:id="1400000005" w:name="_rme5s2"/>'), 'after the properties');
  assert.ok(xml.includes('<w:txbxContent><w:p><w:bookmarkStart w:id="1400000008" w:name="_rme8s26"/>'), 'the text box paragraph, not the one holding it');
  assert.equal(markEmptyParagraphs(body(p('a') + p('b')), styles).xml, body(p('a') + p('b')), 'nothing to mark');

  // Block markers go on around them; the empty paragraph is still no split candidate.
  const blocks = markBodyBlocks(markEmptyParagraphs(body('<w:p/>' + p('after')), styles).xml, styles);
  assert.deepEqual(bookmarks(blocks.xml), ['_rmb0', '_rmb1']);
  assert.deepEqual(blocks.markers.get('_rmb0'), { kind: 'p', keepNext: false, widowControl: true, splitText: null });
}

// ── insertPageBreaks: paragraphs get w:pageBreakBefore; tables break before the table or split between rows.
{
  const doc = body(
    p('one') +
      p('two', '<w:jc w:val="center"/>') +
      '<w:p><w:pPr/><w:r><w:t>three</w:t></w:r></w:p>' +
      table(
        row(cell('h1'), '<w:tblHeader/>') +
          row(cell('r1')) +
          row(`<w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr>${p('m1')}</w:tc>`) +
          row(`<w:tc><w:tcPr><w:vMerge/></w:tcPr>${p('m2')}</w:tc>`),
      ) +
      table(row(cell('x1')) + row(cell('x2'))),
  );
  const { xml } = markBodyBlocks(doc, NO_STYLES);
  // _rmb0 one, _rmb1 two, _rmb2 three, _rmb3..6 rows of table 1, _rmb7..8 rows of table 2
  const out = insertPageBreaks(xml, new Set(['_rmb0', '_rmb1', '_rmb2', '_rmb6', '_rmb7', '_rmb8']));
  assert.ok(out.includes('<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:bookmarkStart w:id="1800000000"'), 'a paragraph without properties gets them');
  assert.ok(out.includes('<w:pPr><w:pageBreakBefore/><w:jc w:val="center"/></w:pPr>'), 'existing properties keep their contents');
  assert.ok(out.includes('<w:pPr><w:pageBreakBefore/></w:pPr><w:bookmarkStart w:id="1800000002"'), 'a self-closing <w:pPr/> is opened');
  // Table 1 splits before its 4th row: header row repeated, merge restarted, first-row look kept.
  const split = out.indexOf('</w:tbl><w:p><w:pPr><w:pageBreakBefore/>');
  assert.ok(split > 0, out);
  const continuation = out.slice(split);
  assert.ok(continuation.startsWith('</w:tbl><w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:bookmarkStart w:id="1700000000" w:name="_rmc0"/>'), continuation.slice(0, 300));
  assert.ok(continuation.includes('<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr><w:tblGrid>'));
  assert.ok(/<w:tblHeader\/><\/w:trPr><w:tc><w:tcPr><w:tcW w:w="100"\/><\/w:tcPr><w:p><w:r><w:t>h1</.test(continuation), 'the header row repeats, without its marker');
  assert.ok(continuation.includes('<w:vMerge w:val="restart"/></w:tcPr><w:p><w:bookmarkStart w:id="1800000006"'), 'the continuing merge restarts');
  // Table 2: a break before its first row starts the page before the whole table (a carrier paragraph)...
  assert.ok(out.includes('<w:bookmarkStart w:id="1700000001" w:name="_rmc1"/><w:bookmarkEnd w:id="1700000001"/></w:p><w:tbl>'), out);
  // ...and before its second row splits it; with no header rows, the continuation drops the first-row look.
  assert.ok(out.includes('<w:tblLook w:val="0480" w:firstRow="0"/>'), out);
  // Every marker is still there once (the repeated header row carries none), so a later round can add more breaks.
  const names = bookmarks(out).filter((n) => n.startsWith('_rmb'));
  assert.deepEqual(names, ['_rmb0', '_rmb1', '_rmb2', '_rmb3', '_rmb4', '_rmb5', '_rmb6', '_rmb7', '_rmb8']);
  // No breaks: unchanged.
  assert.equal(insertPageBreaks(xml, new Set()), xml);
  assert.equal(insertPageBreaks(xml, new Set(['_rmb99'])), xml);
}

// ── Which paragraphs may be split across pages, and the text length a split counts in.
{
  const run = (inner: string, rPr = '<w:rPr><w:b/></w:rPr>') => `<w:r>${rPr}${inner}</w:r>`;
  const cases: [string, number | null][] = [
    [`<w:p>${run('<w:t>Hello</w:t><w:tab/><w:t xml:space="preserve"> w&amp;rld</w:t>')}</w:p>`, 12], // 5 + tab + 6 (entity decoded)
    [`<w:p><w:hyperlink r:id="rId1">${run('<w:t>link</w:t>')}</w:hyperlink>${run('<w:t>!</w:t><w:br/>')}</w:p>`, 5],
    [`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run('<w:t>item</w:t>')}</w:p>`, null],
    [`<w:p><w:pPr><w:keepLines/></w:pPr>${run('<w:t>kept</w:t>')}</w:p>`, null],
    [`<w:p>${run('<w:fldChar w:fldCharType="begin"/>')}${run('<w:t>field</w:t>')}</w:p>`, null],
    [`<w:p>${run('<w:drawing/>')}${run('<w:t>picture</w:t>')}</w:p>`, null],
    [`<w:p>${run('<w:t>note</w:t>')}${run('<w:footnoteReference w:id="1"/>')}</w:p>`, null],
    [`<w:p>${run('<w:t>a</w:t><w:br w:type="page"/><w:t>b</w:t>')}</w:p>`, null],
    [`<w:p><w:del w:id="1">${run('<w:delText>gone</w:delText>')}</w:del>${run('<w:t>x</w:t>')}</w:p>`, null],
    [`<w:p><w:pPr><w:sectPr/></w:pPr>${run('<w:t>section end</w:t>')}</w:p>`, null],
  ];
  for (const [paragraph, expected] of cases) {
    const { markers } = markBodyBlocks(body(paragraph), NO_STYLES);
    const marker = markers.get('_rmb0');
    assert.equal(marker?.kind === 'p' ? marker.splitText : 'no marker', expected, paragraph);
  }
}

// ── insertPageBreaks: a paragraph split across pages, before characters of its text.
{
  const paragraph =
    '<w:p w:rsidR="00B2"><w:pPr><w:pStyle w:val="Body"/><w:spacing w:before="240" w:after="120"/><w:ind w:left="720" w:firstLine="360"/><w:jc w:val="both"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>' +
    '<w:r><w:rPr><w:i/></w:rPr><w:t>Alpha beta </w:t></w:r>' +
    '<w:hyperlink r:id="rId7"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>gamma delta</w:t></w:r></w:hyperlink>' +
    '<w:r><w:t xml:space="preserve"> epsilon</w:t><w:tab/><w:t>zeta</w:t></w:r></w:p>';
  const { xml } = markBodyBlocks(body(paragraph), NO_STYLES);
  // Text: "Alpha beta " (0–10) "gamma delta" (11–21) " epsilon" (22–29) tab (30) "zeta" (31–34).
  // Split inside the italic run (before "beta"), inside the link (before "delta"), and before the tab.
  const out = insertPageBreaks(xml, new Set([splitBreak('_rmb0', 6), splitBreak('_rmb0', 17), splitBreak('_rmb0', 30)]));
  const parts = out.match(/<w:p\b[\s\S]*?<\/w:p>/g)!;
  assert.equal(parts.length, 4, out);
  const text = (part: string) => [...part.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => m[1] ?? '\t').join('');
  assert.deepEqual(parts.map(text), ['Alpha ', 'beta gamma ', 'delta epsilon', '\tzeta']);
  // The first part keeps the paragraph's own start tag and properties, and ends with a split marker.
  assert.ok(parts[0].startsWith('<w:p w:rsidR="00B2"><w:pPr><w:pStyle w:val="Body"/><w:spacing w:before="240"'), parts[0]);
  assert.ok(parts[0].includes('w:name="_rms0"'), 'the first part is marked, for its justified last line');
  assert.ok(parts[0].includes('w:name="_rmb0"'), 'the block marker stays with the first part');
  // Continuations: a new page, no space before, no first-line indent; other properties kept.
  for (const part of parts.slice(1)) {
    assert.ok(part.startsWith('<w:p><w:pPr><w:pageBreakBefore/><w:pStyle w:val="Body"/>'), part);
    assert.ok(part.includes('<w:spacing w:after="120" w:before="0"/>'), part);
    assert.ok(part.includes('<w:ind w:left="720" w:firstLine="0"/>'), part);
    assert.ok(part.includes('<w:jc w:val="both"/>') && part.includes('<w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>'), part);
  }
  // Runs keep their properties on both sides of a cut; a cut hyperlink continues.
  assert.ok(parts[1].startsWith('<w:p><w:pPr>') && parts[1].includes('<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">beta </w:t></w:r><w:hyperlink r:id="rId7">'), parts[1]);
  assert.ok(parts[1].endsWith('<w:t xml:space="preserve">gamma </w:t></w:r></w:hyperlink><w:bookmarkStart w:id="1600000001" w:name="_rms1"/><w:bookmarkEnd w:id="1600000001"/></w:p>'), parts[1]);
  assert.ok(parts[2].includes('</w:pPr><w:bookmarkStart w:id="1500000001" w:name="_rmp1_rmb0"/><w:bookmarkEnd w:id="1500000001"/><w:hyperlink r:id="rId7"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">delta</w:t></w:r></w:hyperlink>'), parts[2]);
  // Each later part names the block it continues, after its properties.
  assert.deepEqual(parts.map((part) => /w:name="(_rmp\d+_rmb\d+)"/.exec(part)?.[1]), [undefined, '_rmp0_rmb0', '_rmp1_rmb0', '_rmp2_rmb0']);
  assert.ok(parts[3].includes('<w:r><w:tab/><w:t xml:space="preserve">zeta</w:t></w:r></w:p>'), parts[3]);
  assert.ok(!parts[3].includes('_rms'), 'the last part carries no split marker');
}
// A split together with a break before the paragraph; a hanging indent and a recorded change drop from the continuation.
{
  const paragraph = '<w:p><w:pPr><w:ind w:left="720" w:hanging="720"/><w:pPrChange w:id="3"><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrChange></w:pPr><w:r><w:t>one two three</w:t></w:r></w:p>';
  const { xml } = markBodyBlocks(body(paragraph), NO_STYLES);
  const out = insertPageBreaks(xml, new Set(['_rmb0', splitBreak('_rmb0', 4)]));
  const parts = out.match(/<w:p\b[\s\S]*?<\/w:p>/g)!;
  assert.equal(parts.length, 2);
  assert.ok(parts[0].startsWith('<w:p><w:pPr><w:pageBreakBefore/><w:ind w:left="720" w:hanging="720"/>'), parts[0]);
  assert.ok(parts[1].includes('<w:ind w:left="720" w:firstLine="0"/>') && !parts[1].includes('pPrChange'), parts[1]);
  assert.ok(parts[1].includes('<w:spacing w:before="0"/>'), 'spacing is added when the paragraph had none');
}
// Offsets outside the text, or malformed, change nothing but the break before.
{
  const { xml } = markBodyBlocks(body(p('short')), NO_STYLES);
  assert.equal(insertPageBreaks(xml, new Set([splitBreak('_rmb0', 99)])).match(/<w:p\b/g)!.length, 1);
  assert.equal(insertPageBreaks(xml, new Set(['_rmb0@x', '_rmb0@0'])), xml);
}

// ── planPageBreaks: pure layout decisions.
const page = (blocks: MeasuredBlock[], over: Partial<MeasuredPage> = {}): MeasuredPage => ({
  contentTop: 100,
  contentBottom: 1000,
  nextContentTop: 100,
  nextContentBottom: 1000,
  blocks,
  ...over,
});
const para = (marker: string, top: number, height: number, keepNext = false, marginTop = 0): MeasuredBlock => ({
  marker,
  top,
  bottom: top + height,
  marginTop,
  keepNext,
});

// Ten 200 px paragraphs on a 900 px body: four per page, so breaks before the 5th and 9th.
{
  const blocks = Array.from({ length: 10 }, (_, i) => para(`b${i}`, 100 + i * 200, 200));
  assert.deepEqual(planPageBreaks([page(blocks)]), ['b4', 'b8']);
}
// Everything fits: no breaks.
assert.deepEqual(planPageBreaks([page([para('a', 100, 300), para('b', 400, 300)])]), []);
// A heading kept with its paragraph moves to the next page with it.
{
  const blocks = [para('a', 100, 700), para('h', 800, 100, true), para('b', 900, 300)];
  assert.deepEqual(planPageBreaks([page(blocks)]), ['h']);
}
// A chain of keep-with-next paragraphs moves together, but never past the page's first block.
{
  const blocks = [para('h1', 100, 300, true), para('h2', 400, 300, true), para('b', 700, 400)];
  assert.deepEqual(planPageBreaks([page(blocks)]), ['h2'], 'the first block of a page stays');
}
// A block taller than a page overflows on its own page; the next one starts a page.
{
  const blocks = [para('a', 100, 200), para('huge', 300, 1500), para('b', 1800, 100)];
  assert.deepEqual(planPageBreaks([page(blocks)]), ['huge', 'b']);
}
// The space above a paragraph moves with it: after a break, blocks are measured from the page top plus their margin.
{
  const blocks = [para('a', 100, 800), para('b', 920, 850, false, 20), para('c', 1770, 100)];
  // 'b' starts page 2 at 100 + 20 = 120 and ends at 970; 'c' (1770 → 1870) then lands at 970 → 1070: a third page.
  assert.deepEqual(planPageBreaks([page(blocks)]), ['b', 'c']);
}
// A table taller than the page breaks between rows and repeats its header on each page.
{
  const rows = [
    { marker: 'r0', top: 150, bottom: 200, header: true },
    ...Array.from({ length: 30 }, (_, i) => ({ marker: `r${i + 1}`, top: 200 + i * 60, bottom: 260 + i * 60, header: false })),
  ];
  const tbl: MeasuredBlock = { marker: 'r0', top: 150, bottom: 2000, marginTop: 0, keepNext: false, rows, headerHeight: 50 };
  const planned = planPageBreaks([page([para('intro', 100, 50), tbl, para('after', 2000, 100)])]);
  // Page 1: rows end at 200 + 60k ≤ 1000 → rows 1..13 fit (row 13 ends at 980), row 14 breaks.
  // Page 2 starts with the header (50 px) at 100: row 14 at 150; 14 rows fit (ends at 990), row 28 breaks.
  assert.deepEqual(planned, ['r14', 'r28']);
}
// A table whose first body row doesn't fit after other text moves whole to the next page.
{
  const rows = [
    { marker: 't0', top: 950, bottom: 980, header: true },
    { marker: 't1', top: 980, bottom: 1100, header: false },
  ];
  const tbl: MeasuredBlock = { marker: 't0', top: 950, bottom: 1100, marginTop: 10, keepNext: false, rows, headerHeight: 30 };
  assert.deepEqual(planPageBreaks([page([para('a', 100, 850), tbl])]), ['t0']);
}
// A table at the top of a page with a row taller than a page: the tall row overflows, the next row starts a page.
{
  const rows = [
    { marker: 'u0', top: 100, bottom: 1300, header: false },
    { marker: 'u1', top: 1300, bottom: 1400, header: false },
  ];
  const tbl: MeasuredBlock = { marker: 'u0', top: 100, bottom: 1400, marginTop: 0, keepNext: false, rows, headerHeight: 0 };
  assert.deepEqual(planPageBreaks([page([tbl])]), ['u1']);
}
// A continuation page that differs from the first (a taller first-page header): its own geometry.
{
  const blocks = Array.from({ length: 6 }, (_, i) => para(`c${i}`, 300 + i * 300, 300));
  // First page body 300..1000 → c0, c1 fit (ends 900), c2 (→1200) breaks; later pages 100..1000: three per page.
  assert.deepEqual(planPageBreaks([page(blocks, { contentTop: 300 })]), ['c2', 'c5']);
}
// Pages are independent.
{
  const one = page([para('a', 100, 600), para('b', 700, 600)]);
  const two = page([para('x', 100, 600), para('y', 700, 600)]);
  assert.deepEqual(planPageBreaks([one, two]), ['b', 'y']);
}

// ── Paragraphs split between lines.
const linesOf = (top: number, count: number, height = 20, charsPerLine = 50): Line[] =>
  Array.from({ length: count }, (_, i) => ({ offset: i * charsPerLine, top: top + i * height, bottom: top + (i + 1) * height }));
const long = (marker: string, top: number, count: number, widowControl = true, keepNext = false): MeasuredBlock => ({
  marker,
  top,
  bottom: top + count * 20,
  marginTop: 0,
  keepNext,
  widowControl,
  lines: () => linesOf(top, count),
});
// A 30-line paragraph starting at 700: 15 lines fit (700 + 15 × 20 = 1000), the rest go to the next page.
assert.deepEqual(planPageBreaks([page([para('a', 100, 600), long('b', 700, 30)])]), [splitBreak('b', 750)]);
// Widow control: 14 lines fit of 15 — at least two lines go over, so the split moves up one line.
assert.deepEqual(planPageBreaks([page([para('a', 100, 600), long('b', 720, 15)])]), [splitBreak('b', 650)]);
// Orphan control: one line would fit — fewer than two, so the paragraph moves whole.
assert.deepEqual(planPageBreaks([page([para('a', 100, 880), long('b', 980, 10)])]), ['b']);
// Without widow control a single line may stay behind, and a single line may go over.
assert.deepEqual(planPageBreaks([page([para('a', 100, 880), long('b', 980, 10, false)])]), [splitBreak('b', 50)]);
assert.deepEqual(planPageBreaks([page([para('a', 100, 600), long('b', 720, 15, false)])]), [splitBreak('b', 700)]);
// A paragraph longer than a page is split more than once.
assert.deepEqual(planPageBreaks([page([long('c', 100, 100)])]), [splitBreak('c', 45 * 50), splitBreak('c', 90 * 50)]);
// A heading kept with the next paragraph stays when that paragraph can start on this page...
assert.deepEqual(planPageBreaks([page([para('a', 100, 600), para('h', 700, 60, true), long('b', 760, 30)])]), [splitBreak('b', 600)]);
// ...and moves with it when the paragraph must move whole.
assert.deepEqual(planPageBreaks([page([para('a', 100, 820), para('h', 920, 60, true), long('b', 980, 10)])]), ['h']);
// A paragraph whose lines can't be measured moves whole, as before.
assert.deepEqual(planPageBreaks([page([para('a', 100, 600), { ...long('b', 700, 30), lines: () => null }])]), ['b']);

console.log('pagination.test.ts: all passed');
