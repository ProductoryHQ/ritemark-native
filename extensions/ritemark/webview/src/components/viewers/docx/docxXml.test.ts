/**
 * Sprint 124 (#284) R2 — the XML fixes applied before docx-preview renders.
 * Run: npx tsx webview/src/components/viewers/docx/docxXml.test.ts
 */
import assert from 'node:assert/strict';
import {
  NUMPAGES_FIELD_MARK,
  PAGE_FIELD_MARK,
  describeUnsupported,
  dropFontEmbeds,
  dropRedundantPageMarkers,
  hasPageMarkers,
  listFontEmbedIds,
  markPageFields,
  parseRelationships,
  scanUnsupported,
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
  assert.equal(describeUnsupported(u), "This document has charts and equations that the preview can't show exactly.");
  assert.equal(describeUnsupported({ charts: false, smartArt: true, embeddedObjects: true, equations: true }), "This document has SmartArt diagrams, embedded objects and equations that the preview can't show exactly.");
  assert.equal(describeUnsupported(scanUnsupported([p(r(t('plain')))])), null);
}

console.log('docxXml.test.ts: all passed');
