/**
 * Sprint 124 (#284) R2 — the XML fixes applied before docx-preview renders.
 * Run: npx tsx webview/src/components/viewers/docx/docxXml.test.ts
 */
import assert from 'node:assert/strict';
import {
  NUMPAGES_FIELD_MARK,
  PAGE_FIELD_MARK,
  describeUnsupported,
  documentFont,
  dropFontEmbeds,
  dropRedundantPageMarkers,
  embeddedFont,
  ensureDefaultLineSpacing,
  ensurePageSetup,
  fixTableGrids,
  fontLineHeightRatio,
  hasPageMarkers,
  hasWeightAxis,
  impliedFontWeight,
  knownLineHeightRatio,
  lineHeightRatio,
  normalizeLineSpacing,
  weightFontFaces,
  listFontEmbedIds,
  markPageAnchors,
  markPageFields,
  paperForLocale,
  splitFieldRuns,
  parseRelationships,
  scanUnsupported,
  wantsAutoHyphenation,
} from './docxXml';

const MARKER = '<w:lastRenderedPageBreak/>';
const p = (inner: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`;
const r = (inner: string) => `<w:r><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr>${inner}</w:r>`;
const t = (text: string) => `<w:t xml:space="preserve">${text}</w:t>`;
const pageBreak = '<w:br w:type="page"/>';

// hasPageMarkers
assert.equal(hasPageMarkers(p(r(MARKER + t('x')))), true);
assert.equal(hasPageMarkers(p(r(t('x')))), false);

// dropRedundantPageMarkers — a manual break, then Word's marker at the next page's start
{
  const xml = p(r(t('End of chapter one.') + pageBreak)) + p(r(MARKER + t('Chapter two')), '<w:pStyle w:val="Heading1"/>');
  const out = dropRedundantPageMarkers(xml);
  assert.ok(!out.includes(MARKER), 'marker right after a page break is dropped');
  assert.ok(out.includes(pageBreak) && out.includes('Chapter two'), 'the break and the text stay');
}
{
  // a tab stop in the paragraph's properties is not content
  const xml = p(r(pageBreak)) + p(r(MARKER + t('x')), '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs>');
  assert.ok(!dropRedundantPageMarkers(xml).includes(MARKER));
}
{
  // text between the break and the marker: the marker is a real later page
  const xml = p(r(pageBreak)) + p(r(t('A full page of text'))) + p(r(MARKER + t('next')));
  assert.equal(dropRedundantPageMarkers(xml), xml);
}
{
  // a tab in text is content
  const xml = p(r(pageBreak)) + p(r('<w:tab/>' + MARKER + t('x')));
  assert.equal(dropRedundantPageMarkers(xml), xml);
}
{
  // a drawing is content
  const xml = p(r(pageBreak)) + p(r('<w:drawing><wp:inline/></w:drawing>')) + p(r(MARKER + t('x')));
  assert.equal(dropRedundantPageMarkers(xml), xml);
}
{
  // a line break (not a page break) before the marker is content
  const xml = p(r(pageBreak)) + p(r('<w:br/>' + MARKER + t('x')));
  assert.equal(dropRedundantPageMarkers(xml), xml);
}
{
  // two breaks, each followed by a marker
  const xml = p(r(pageBreak)) + p(r(MARKER + t('a'))) + p(r(pageBreak)) + p(r(MARKER + t('b')));
  assert.equal(dropRedundantPageMarkers(xml).split(MARKER).length - 1, 0);
}

// dropRedundantPageMarkers — page-break-before set on the paragraph
{
  const xml = p(r(MARKER + t('Part two')), '<w:pageBreakBefore/>');
  assert.ok(!dropRedundantPageMarkers(xml).includes(MARKER));
  const on = p(r(MARKER + t('Part two')), '<w:pageBreakBefore w:val="true"/>');
  assert.ok(!dropRedundantPageMarkers(on).includes(MARKER));
  const off = p(r(MARKER + t('Part two')), '<w:pageBreakBefore w:val="0"/>');
  assert.equal(dropRedundantPageMarkers(off), off, 'page-break-before switched off keeps the marker');
  // the marker in a later paragraph belongs to a later page
  const later = p(r(t('Part two')), '<w:pageBreakBefore/>') + p(r(MARKER + t('page after')));
  assert.equal(dropRedundantPageMarkers(later), later);
  // marker after text in the same paragraph is a page turn inside it
  const mid = p(r(t('long paragraph') + MARKER + t('continues')), '<w:pageBreakBefore/>');
  assert.equal(dropRedundantPageMarkers(mid), mid);
}

// markPageFields — complex field with Word's cached result
{
  const xml = p(
    r(t('Page ')) +
      r('<w:fldChar w:fldCharType="begin"/>') +
      r('<w:instrText xml:space="preserve"> PAGE \\* MERGEFORMAT </w:instrText>') +
      r('<w:fldChar w:fldCharType="separate"/>') +
      r(t('2')) +
      r('<w:fldChar w:fldCharType="end"/>') +
      r(t(' of ')) +
      r('<w:fldChar w:fldCharType="begin"/>') +
      r('<w:instrText>NUMPAGES</w:instrText>') +
      r('<w:fldChar w:fldCharType="separate"/>') +
      r(t('3')) +
      r('<w:fldChar w:fldCharType="end"/>'),
  );
  const out = markPageFields(xml);
  assert.ok(out.includes(`>${PAGE_FIELD_MARK}</w:t>`), 'PAGE result replaced');
  assert.ok(out.includes(`>${NUMPAGES_FIELD_MARK}</w:t>`), 'NUMPAGES result replaced');
  assert.ok(!/>2<\/w:t>|>3<\/w:t>/.test(out), 'cached numbers gone');
  assert.ok(out.includes('Page ') && out.includes(' of '), 'surrounding text kept');
  assert.ok(out.includes('w:ascii="Calibri"'), 'the result run keeps its formatting');
}
{
  // a multi-run cached result: first text gets the mark, the others go empty
  const xml = p(r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText>PAGE</w:instrText>') + r('<w:fldChar w:fldCharType="separate"/>') + r(t('1')) + r(t('2')) + r('<w:fldChar w:fldCharType="end"/>'));
  const out = markPageFields(xml);
  assert.equal(out.split(PAGE_FIELD_MARK).length - 1, 1);
  assert.ok(out.includes('<w:t xml:space="preserve"></w:t>'));
}
{
  // as the `docx` package writes it: separate, but no cached result
  const xml = p(
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>',
  );
  const out = markPageFields(xml);
  assert.ok(out.includes(`<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${PAGE_FIELD_MARK}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`), out);
}
{
  // no separate at all
  const xml = p('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>NUMPAGES</w:instrText></w:r><w:r><w:rPr><w:b/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>');
  const out = markPageFields(xml);
  assert.ok(out.includes(`<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${NUMPAGES_FIELD_MARK}</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`), out);
}
{
  // an instruction split over several runs
  const xml = p('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PA</w:instrText></w:r><w:r><w:instrText>GE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + r(t('9')) + '<w:r><w:fldChar w:fldCharType="end"/></w:r>');
  assert.ok(markPageFields(xml).includes(PAGE_FIELD_MARK));
}
{
  // other fields and nested fields are left alone
  const date = p(r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText>DATE</w:instrText>') + r('<w:fldChar w:fldCharType="separate"/>') + r(t('23.09.2026')) + r('<w:fldChar w:fldCharType="end"/>'));
  assert.equal(markPageFields(date), date);
  const nested = p(
    r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText>IF </w:instrText>') +
      r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText>PAGE</w:instrText>') + r('<w:fldChar w:fldCharType="separate"/>') + r(t('1')) + r('<w:fldChar w:fldCharType="end"/>') +
      r('<w:instrText> = 1 "first" "other"</w:instrText>') + r('<w:fldChar w:fldCharType="separate"/>') + r(t('first')) + r('<w:fldChar w:fldCharType="end"/>'),
  );
  assert.equal(markPageFields(nested), nested, 'a PAGE inside an IF is not rewritten');
  const pageref = p(r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText>PAGEREF _Toc1 \\h</w:instrText>') + r('<w:fldChar w:fldCharType="separate"/>') + r(t('4')) + r('<w:fldChar w:fldCharType="end"/>'));
  assert.equal(markPageFields(pageref), pageref, 'PAGEREF is not PAGE');
}
{
  // simple fields, with and without content
  const withContent = p(`<w:fldSimple w:instr=" PAGE ">${r(t('7'))}</w:fldSimple>`);
  const out = markPageFields(withContent);
  assert.ok(out.includes(PAGE_FIELD_MARK) && !out.includes('>7<'));
  const selfClosing = p('<w:fldSimple w:instr="NUMPAGES"/>');
  assert.equal(markPageFields(selfClosing), p(`<w:fldSimple w:instr="NUMPAGES"><w:r><w:t>${NUMPAGES_FIELD_MARK}</w:t></w:r></w:fldSimple>`));
  const other = p('<w:fldSimple w:instr="AUTHOR"/>');
  assert.equal(markPageFields(other), other);
}

// font embeds
{
  const rels = '<?xml version="1.0"?><Relationships xmlns="…"><Relationship Id="rId1" Type="…/font" Target="fonts/font1.odttf"/><Relationship Id="rId2" Type="…/font" Target="fonts/font9.odttf"/></Relationships>';
  const map = parseRelationships(rels);
  assert.equal(map.get('rId1'), 'fonts/font1.odttf');
  assert.equal(map.get('rId2'), 'fonts/font9.odttf');
  const table = '<w:font w:name="Sofia Sans Light"><w:embedRegular r:id="rId1" w:fontKey="{A}"/><w:embedBold r:id="rId2" w:fontKey="{B}"/></w:font>';
  assert.deepEqual(listFontEmbedIds(table), ['rId1', 'rId2']);
  const dropped = dropFontEmbeds(table, new Set(['rId2']));
  assert.ok(dropped.includes('rId1') && !dropped.includes('rId2') && !dropped.includes('embedBold'));
  assert.equal(dropFontEmbeds(table, new Set()), table);
}

// unsupported content
{
  const chart = '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId5"/></a:graphicData>';
  const u = scanUnsupported([p(r(t('x'))), chart, '<m:oMathPara><m:oMath/></m:oMathPara>']);
  assert.deepEqual(u, { charts: true, smartArt: false, embeddedObjects: false, equations: true });
  assert.equal(describeUnsupported(u), "This document has charts and equations that the preview can’t show exactly.");
  assert.equal(describeUnsupported({ charts: false, smartArt: true, embeddedObjects: true, equations: true }), "This document has SmartArt diagrams, embedded objects and equations that the preview can’t show exactly.");
  assert.equal(describeUnsupported(scanUnsupported([p(r(t('plain')))])), null);
}

// automatic hyphenation follows the document's settings
assert.equal(wantsAutoHyphenation(null), false);
assert.equal(wantsAutoHyphenation('<w:settings><w:zoom w:percent="100"/></w:settings>'), false);
assert.equal(wantsAutoHyphenation('<w:settings><w:autoHyphenation/></w:settings>'), true);
assert.equal(wantsAutoHyphenation('<w:settings><w:autoHyphenation w:val="true"/></w:settings>'), true);
assert.equal(wantsAutoHyphenation('<w:settings><w:autoHyphenation w:val="0"/></w:settings>'), false);

// v1.12.0 RC fix: a document without page setup gets Word's default paper and margins.
assert.equal(paperForLocale('en-US'), 'Letter');
assert.equal(paperForLocale('en_CA'), 'Letter');
assert.equal(paperForLocale('et-EE'), 'A4');
assert.equal(paperForLocale('en'), 'A4');
assert.equal(paperForLocale(undefined), 'A4');
{
  const bodyOnly = '<w:document><w:body><w:p/></w:body></w:document>';
  const out = ensurePageSetup(bodyOnly, 'A4');
  assert.ok(out.includes('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440"'), out);
  assert.ok(out.endsWith('</w:sectPr></w:body></w:document>'));
  assert.ok(ensurePageSetup(bodyOnly, 'Letter').includes('<w:pgSz w:w="12240" w:h="15840"/>'));
}
{
  // A section with headers but no size or margins: both are added, its references kept.
  const partial = '<w:body><w:p/><w:sectPr w:rsidR="1"><w:headerReference w:type="default" r:id="rId1"/></w:sectPr></w:body>';
  const out = ensurePageSetup(partial, 'A4');
  assert.ok(out.includes('<w:sectPr w:rsidR="1"><w:pgSz'), out);
  assert.ok(out.includes('<w:pgMar ') && out.includes('<w:headerReference'), out);
  // A self-closing section, too.
  assert.ok(ensurePageSetup('<w:body><w:sectPr/></w:body>', 'A4').includes('<w:sectPr><w:pgSz'));
}
{
  // A complete section is untouched, and so is every section of a document that has them.
  const full = '<w:body><w:p><w:pPr><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720"/></w:sectPr></w:pPr></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440"/></w:sectPr></w:body>';
  assert.equal(ensurePageSetup(full, 'Letter'), full);
}

// v1.12.0 RC fix: pictures set against the page are marked for the viewer to place.
{
  const anchor = (attrs: string, h: string, v: string, wrap = '<wp:wrapNone/>') =>
    `<w:r><w:drawing><wp:anchor ${attrs}><wp:simplePos x="0" y="0"/>${h}${v}<wp:extent cx="100" cy="100"/>${wrap}</wp:anchor></w:drawing></w:r>`;
  const pageH = '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>';
  const pageV = '<wp:positionV relativeFrom="page"><wp:posOffset>-9525</wp:posOffset></wp:positionV>';
  const rightMargin = '<wp:positionH relativeFrom="rightMargin"><wp:align>right</wp:align></wp:positionH>';
  const paraV = '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>';
  const colH = '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>';
  const xml = p(
    anchor('behindDoc="1" simplePos="0"', pageH, pageV) +
      anchor('behindDoc="0" simplePos="0"', rightMargin, paraV) +
      anchor('behindDoc="0" simplePos="0"', colH, paraV) + // set against its paragraph and column: placed too (a real cover is laid out this way)
      anchor('behindDoc="0" simplePos="0"', pageH, pageV, '<wp:wrapSquare wrapText="bothSides"/>'), // text wraps it: left alone
  );
  const out = markPageAnchors(xml, 5);
  assert.deepEqual(
    out.anchors.map((a) => a.name),
    ['_rma5', '_rma6', '_rma7'],
  );
  assert.deepEqual(out.anchors[0], {
    name: '_rma5',
    h: { relativeFrom: 'page', offsetEmu: 0 },
    v: { relativeFrom: 'page', offsetEmu: -9525 },
    behindDoc: true,
  });
  assert.deepEqual(out.anchors[1].h, { relativeFrom: 'rightMargin', align: 'right' });
  assert.equal(out.anchors[1].behindDoc, false);
  // The bookmark sits just before the picture's run.
  assert.ok(out.xml.includes('<w:bookmarkStart w:id="1900000005" w:name="_rma5"/><w:bookmarkEnd w:id="1900000005"/><w:r><w:drawing><wp:anchor behindDoc="1"'), out.xml);
  assert.equal(out.xml.split('<w:bookmarkStart').length - 1, 3);
  // Nothing to mark: unchanged.
  assert.equal(markPageAnchors(p(r(t('x'))), 0).xml, p(r(t('x'))));
}

// v1.12.0 RC fix: field code in the same run as text (the docx npm library's footer) gets runs of its own,
// so docx-preview shows the text, and the page number is marked.
{
  const footer =
    '<w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Page </w:t><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve">PAGE</w:instrText>' +
    '<w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/><w:t xml:space="preserve"> of </w:t><w:fldChar w:fldCharType="begin"/>' +
    '<w:instrText xml:space="preserve">NUMPAGES</w:instrText><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p>';
  const split = splitFieldRuns(footer);
  const runs = split.match(/<w:r>[\s\S]*?<\/w:r>/g)!;
  assert.equal(runs.length, 10, split);
  assert.ok(runs.every((run) => run.startsWith('<w:r><w:rPr><w:sz w:val="18"/></w:rPr>')), 'every piece keeps the run properties');
  assert.equal(runs[0], '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r>');
  const marked = markPageFields(split);
  assert.ok(marked.includes(PAGE_FIELD_MARK) && marked.includes(NUMPAGES_FIELD_MARK), marked);
  assert.ok(marked.indexOf('Page ') < marked.indexOf(PAGE_FIELD_MARK) && marked.indexOf(PAGE_FIELD_MARK) < marked.indexOf(' of '), 'the number sits between "Page" and "of"');
  // A form field's begin character with content stays one piece.
  const form = '<w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:name w:val="Check1"/></w:ffData></w:fldChar><w:t>x</w:t></w:r>';
  assert.equal(splitFieldRuns(form).match(/<w:r>/g)!.length, 2);
  // Runs that are already one field part each, and text without fields, are untouched.
  const clean = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:t>x</w:t></w:r>';
  assert.equal(splitFieldRuns(clean), clean);
  assert.equal(splitFieldRuns(p(r(t('plain')))), p(r(t('plain'))));
}

// ── Line spacing in the document font's line heights (v1.12.0 RC fix).
{
  assert.equal(knownLineHeightRatio('Calibri'), 1.2207);
  assert.equal(knownLineHeightRatio(' calibri '), 1.2207, 'names match without case or padding');
  assert.equal(knownLineHeightRatio('Sofia Sans Light'), null);
  assert.equal(lineHeightRatio('Calibri', 1.5), 1.2207, 'a known font wins over its embedded copy');
  assert.equal(lineHeightRatio('Sofia Sans Light', 1.2), 1.2, 'else the embedded font');
  assert.equal(lineHeightRatio('Sofia Sans Light'), 1.17, 'else a typical line height');
  assert.equal(lineHeightRatio(null), 1.17);

  const styles = (defaults: string, normal = '') =>
    `<w:styles><w:docDefaults><w:rPrDefault><w:rPr>${defaults}</w:rPr></w:rPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr>${normal}</w:rPr></w:style></w:styles>`;
  const theme = '<a:theme><a:fontScheme><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme></a:theme>';
  assert.equal(documentFont(styles('<w:rFonts w:ascii="Sofia Sans Light" w:hAnsi="Sofia Sans Light"/>'), null), 'Sofia Sans Light');
  assert.equal(documentFont(styles('<w:rFonts w:ascii="Arial"/>', '<w:rFonts w:ascii="Georgia"/>'), null), 'Georgia', 'the default paragraph style first');
  assert.equal(documentFont(styles('<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/>'), theme), 'Aptos', 'a theme font through the theme');
  assert.equal(documentFont(styles('<w:rFonts w:asciiTheme="majorHAnsi"/>'), theme), 'Aptos Display');
  assert.equal(documentFont(styles(''), null), 'Times New Roman', "Word's fallback");
  assert.equal(documentFont(null, null), 'Times New Roman');

  // Auto spacing is scaled; a spacing without w:lineRule is auto (docx-preview read it as exact points).
  assert.equal(normalizeLineSpacing('<w:spacing w:after="240" w:line="276" w:lineRule="auto"/>', 1.2), '<w:spacing w:after="240" w:line="331" w:lineRule="auto"/>');
  assert.equal(normalizeLineSpacing('<w:spacing w:line="240"/>', 1.2207), '<w:spacing w:line="293" w:lineRule="auto"/>');
  for (const kept of ['<w:spacing w:line="300" w:lineRule="exact"/>', '<w:spacing w:line="300" w:lineRule="atLeast"/>', '<w:spacing w:after="120"/>']) {
    assert.equal(normalizeLineSpacing(kept, 1.2), kept, kept);
  }

  // A document that sets no line spacing gets Word's single spacing in its defaults, scaled.
  const single = '<w:spacing w:line="288" w:lineRule="auto"/>';
  assert.equal(
    ensureDefaultLineSpacing('<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>', 1.2),
    '<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>',
  );
  const set = '<w:styles><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
  assert.equal(ensureDefaultLineSpacing(set, 1.2), set, 'spacing the document sets is left alone');
  assert.equal(
    ensureDefaultLineSpacing('<w:styles><w:docDefaults><w:pPrDefault><w:pPr/></w:pPrDefault></w:docDefaults></w:styles>', 1.2),
    `<w:styles><w:docDefaults><w:pPrDefault><w:pPr>${single}</w:pPr></w:pPrDefault></w:docDefaults></w:styles>`,
  );
  assert.equal(
    ensureDefaultLineSpacing('<w:styles><w:docDefaults><w:rPrDefault/></w:docDefaults></w:styles>', 1.2),
    `<w:styles><w:docDefaults><w:rPrDefault/><w:pPrDefault><w:pPr>${single}</w:pPr></w:pPrDefault></w:docDefaults></w:styles>`,
  );
  assert.equal(
    ensureDefaultLineSpacing('<w:styles w:ignorable="w14"><w:style/></w:styles>', 1.2),
    `<w:styles w:ignorable="w14"><w:docDefaults><w:pPrDefault><w:pPr>${single}</w:pPr></w:pPrDefault></w:docDefaults><w:style/></w:styles>`,
  );
}

// ── A font the document embeds: its line height from its own metrics, obfuscated as Word stores it.
{
  // A minimal TrueType file: header, a directory of two tables, `head` (units per em) and `hhea` (vertical metrics).
  const font = (unitsPerEm: number, ascender: number, descender: number, lineGap: number) => {
    const bytes = new Uint8Array(12 + 2 * 16 + 54 + 36);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x00010000);
    view.setUint16(4, 2);
    const tables: [string, number, number][] = [['head', 44, 54], ['hhea', 98, 36]];
    tables.forEach(([tag, offset, length], k) => {
      for (let i = 0; i < 4; i++) bytes[12 + 16 * k + i] = tag.charCodeAt(i);
      view.setUint32(12 + 16 * k + 8, offset);
      view.setUint32(12 + 16 * k + 12, length);
    });
    view.setUint16(44 + 18, unitsPerEm);
    view.setInt16(98 + 4, ascender);
    view.setInt16(98 + 6, descender);
    view.setInt16(98 + 8, lineGap);
    return bytes;
  };
  // Word's obfuscation (ECMA-376 Part 2, font embedding): the key's 16 bytes, last first, XORed over the first 32 bytes.
  const obfuscate = (bytes: Uint8Array, guid: string) => {
    const hex = guid.replace(/[{}-]/g, '');
    const key = Array.from({ length: 16 }, (_, i) => parseInt(hex.substr(i * 2, 2), 16)).reverse();
    const out = bytes.slice();
    for (let i = 0; i < 32; i++) out[i] ^= key[i % 16];
    return out;
  };
  const guid = '{14F231E2-1439-0542-8B56-1A7D4473AFF4}';
  const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
  close(fontLineHeightRatio(font(1000, 900, -300, 0), null), 1.2);
  close(fontLineHeightRatio(obfuscate(font(1000, 900, -300, 0), guid), guid), 1.2);
  close(fontLineHeightRatio(obfuscate(font(2048, 1854, -434, 67), guid), guid), 2355 / 2048);
  assert.equal(fontLineHeightRatio(obfuscate(font(1000, 900, -300, 0), guid), null), null, 'still obfuscated: not a font');
  assert.equal(fontLineHeightRatio(font(1000, 900, -300, 0), 'not-a-key'), null);
  assert.equal(fontLineHeightRatio(new Uint8Array(0), null), null, 'an empty embedded face');
  assert.equal(fontLineHeightRatio(font(0, 900, -300, 0), null), null, 'no units per em');
  assert.equal(fontLineHeightRatio(font(1000, 9000, -300, 0), null), null, 'metrics no text font has');

  const table =
    '<w:fonts><w:font w:name="Symbol"><w:embedRegular r:id="rId1" w:fontKey="{88840AD8-5225-C542-9BC1-B5AD10EC7524}"/></w:font>' +
    `<w:font w:name="Sofia Sans Light"><w:embedBold r:id="rId6" w:fontKey="{63E403E0-03C7-3540-834C-2094D35E98D8}"/><w:embedRegular r:id="rId5" w:fontKey="${guid}"/></w:font>` +
    '<w:font w:name="Space Grotesk"><w:embedBold r:id="rId9" w:fontKey="{3EA7CD1B-C1A5-764C-AF09-16399733984D}"/></w:font>' +
    '<w:font w:name="Arial"/></w:fonts>';
  assert.deepEqual(embeddedFont(table, 'sofia sans light'), { id: 'rId5', key: guid }, 'the regular face first');
  assert.deepEqual(embeddedFont(table, 'Space Grotesk'), { id: 'rId9', key: '{3EA7CD1B-C1A5-764C-AF09-16399733984D}' }, 'else any face');
  assert.equal(embeddedFont(table, 'Arial'), null, 'not embedded');
  assert.equal(embeddedFont(table, 'Calibri'), null, 'not in the table');
}

// ── Table grids: a real grid is drawn as it is; a placeholder grid lets the columns size to their content.
{
  const tbl = (pr: string, cols: number[]) =>
    `<w:tbl><w:tblPr>${pr}</w:tblPr><w:tblGrid>${cols.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr/></w:tbl>`;
  assert.equal(fixTableGrids(tbl('<w:tblW w:w="0" w:type="auto"/>', [3000, 6000])), tbl('<w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>', [3000, 6000]));
  assert.equal(fixTableGrids(tbl('<w:tblLayout w:type="autofit"/>', [3000, 6000])), tbl('<w:tblLayout w:type="autofit"/>', [3000, 6000]), 'a layout the table sets is kept');
  assert.equal(
    fixTableGrids(tbl('', [100, 100, 100])),
    '<w:tbl><w:tblPr></w:tblPr><w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid><w:tr/></w:tbl>',
    'the docx library writes 100 twips per column and leaves the rest to autofit',
  );
  assert.equal(fixTableGrids('<w:p/>'), '<w:p/>');
}

// ── Embedded fonts: a family named for a weight is drawn at that weight (a variable font holds them all).
{
  assert.equal(impliedFontWeight('Sofia Sans Light'), 300);
  assert.equal(impliedFontWeight('Segoe UI Semibold'), 600);
  assert.equal(impliedFontWeight('Montserrat ExtraLight'), 200);
  assert.equal(impliedFontWeight('Inter Extra Bold'), 800);
  assert.equal(impliedFontWeight('Arial Black'), 900);
  assert.equal(impliedFontWeight('Roboto Thin'), 100);
  assert.equal(impliedFontWeight('Calibri'), undefined);
  assert.equal(impliedFontWeight('Lightfoot'), undefined, 'a name, not a weight');
  assert.equal(impliedFontWeight('Sofia Sans'), undefined);

  const css =
    "/* docxjs Sofia Sans Light font */\n@font-face {\r\n font-family: 'Sofia Sans Light';\r\n src: url(blob:x/1);\r\n}\r\n" +
    "@font-face {\r\n font-family: 'Sofia Sans Light';\r\n src: url(blob:x/2);\r\n font-style: italic;\r\n}\r\n" +
    "@font-face {\r\n font-family: 'Inter Light';\r\n src: url(blob:x/3);\r\n}\r\n" +
    "@font-face {\r\n font-family: 'Inter Light';\r\n src: url(blob:x/4);\r\n font-weight: bold;\r\n}\r\n" +
    "@font-face {\r\n font-family: 'Calibri Light';\r\n src: url(blob:x/5);\r\n}\r\n" +
    '@font-face { font-family: Calibri; src: url(blob:x/6); }';
  const out = weightFontFaces(css, new Set(['sofia sans light', 'inter light']));
  assert.ok(out.includes("font-family: 'Sofia Sans Light';\r\n src: url(blob:x/1); font-weight: 300; } @font-face {\r\n font-family: 'Sofia Sans Light';\r\n src: url(blob:x/1); font-weight: 700; }"), out);
  assert.ok(out.includes("src: url(blob:x/2);\r\n font-style: italic; font-weight: 300; } @font-face {\r\n font-family: 'Sofia Sans Light';\r\n src: url(blob:x/2);\r\n font-style: italic; font-weight: 700; }"), 'the italic face, and a bold italic from it');
  assert.ok(out.includes("src: url(blob:x/3); font-weight: 300; }\r\n"), 'a family with a bold face of its own');
  assert.ok(!out.includes('blob:x/3); font-weight: 700'), '… gets no bold copy');
  assert.ok(out.includes('src: url(blob:x/4);\r\n font-weight: bold;\r\n}'), 'and keeps its bold face');
  assert.ok(out.includes("font-family: 'Calibri Light';\r\n src: url(blob:x/5);\r\n}"), 'a font with fixed weights is left alone: the browser still emboldens it');
  assert.ok(out.endsWith('@font-face { font-family: Calibri; src: url(blob:x/6); }'));
  assert.equal(weightFontFaces(css, new Set()), css);
  assert.equal(weightFontFaces('p { color: red }', new Set(['x light'])), 'p { color: red }');

  // A variable font: an fvar table with a weight axis.
  const variable = (axis: string) => {
    const bytes = new Uint8Array(12 + 16 + 16 + 20);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x00010000);
    view.setUint16(4, 1);
    for (let i = 0; i < 4; i++) bytes[12 + i] = 'fvar'.charCodeAt(i);
    view.setUint32(12 + 8, 28);
    view.setUint32(12 + 12, 36);
    view.setUint16(28 + 4, 16); // axes array offset
    view.setUint16(28 + 8, 1); // axis count
    view.setUint16(28 + 10, 20); // axis size
    for (let i = 0; i < 4; i++) bytes[44 + i] = axis.charCodeAt(i);
    return bytes;
  };
  assert.equal(hasWeightAxis(variable('wght'), null), true);
  assert.equal(hasWeightAxis(variable('wdth'), null), false, 'a width axis only');
  assert.equal(hasWeightAxis(new Uint8Array(100), null), false);
}

console.log('docxXml.test.ts: all passed');
