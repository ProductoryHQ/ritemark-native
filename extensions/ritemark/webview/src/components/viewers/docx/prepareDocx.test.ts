/**
 * Sprint 124 (#284) R2 — prepareDocx on small packages built in the test.
 * Run: npx tsx webview/src/components/viewers/docx/prepareDocx.test.ts
 */
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PAGE_FIELD_MARK } from './docxXml';
import { prepareDocx } from './prepareDocx';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const body = (inner: string) => `<?xml version="1.0"?><w:document ${W}><w:body>${inner}</w:body></w:document>`;

async function pkg(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('_rels/.rels', '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

async function read(data: Uint8Array, path: string): Promise<string> {
  return (await JSZip.loadAsync(data)).file(path)!.async('string');
}

// A Word-saved document with its page setup and nothing to fix: Word's pages are honoured, and
// the only change is the block marker the viewer uses where those pages fall short.
{
  const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
  const doc = body(`<w:p><w:r><w:lastRenderedPageBreak/><w:t>Plain</w:t></w:r></w:p>${sect}`);
  const out = await prepareDocx(await pkg({ 'word/document.xml': doc }));
  assert.equal(out.honourPageMarkers, true);
  assert.deepEqual([...out.markers.keys()], ['_rmb0']);
  const newDoc = await read(out.data, 'word/document.xml');
  assert.equal(newDoc.replace(/<w:bookmarkStart w:id="\d+" w:name="_rmb0"\/><w:bookmarkEnd w:id="\d+"\/>/, ''), doc);
  assert.deepEqual(out.unsupported, { charts: false, smartArt: false, embeddedObjects: false, equations: false });
}

// v1.12.0 RC fix — a generated document (no page markers, no page setup, symbol bullets,
// a cover picture set against the page): page setup added, blocks marked for layout,
// bullets and symbols in Unicode, the picture marked.
{
  const cover =
    '<w:r><w:drawing><wp:anchor behindDoc="1" simplePos="0"><wp:simplePos x="0" y="0"/>' +
    '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    '<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:wrapNone/></wp:anchor></w:drawing></w:r>';
  const header = `<w:hdr ${W}><w:p>${cover}</w:p></w:hdr>`;
  const numbering = `<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:lvlText w:val=""/><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum></w:numbering>`;
  const doc = body(
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>' +
      '<w:p><w:r><w:sym w:font="Wingdings" w:char="F0FC"/><w:t>done</w:t></w:r></w:p>',
  );
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:keepNext/></w:pPr></w:style></w:styles>`;
  const bytes = await pkg({ 'word/document.xml': doc, 'word/header1.xml': header, 'word/numbering.xml': numbering, 'word/styles.xml': styles });
  const out = await prepareDocx(bytes, { paper: 'Letter' });
  assert.notEqual(out.data, bytes);
  assert.equal(out.honourPageMarkers, false);
  const newDoc = await read(out.data, 'word/document.xml');
  assert.ok(newDoc.includes('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'), 'Letter for a US reader');
  assert.ok(newDoc.includes('<w:t xml:space="preserve">✓</w:t>'), 'the Wingdings check mark is a real check mark');
  assert.deepEqual([...out.markers.keys()], ['_rmb0', '_rmb1']);
  assert.deepEqual(out.markers.get('_rmb0'), { kind: 'p', keepNext: true, widowControl: true, splitText: 5 });
  assert.ok((await read(out.data, 'word/numbering.xml')).includes('<w:lvlText w:val="•"/>'));
  assert.deepEqual([...out.anchors.keys()], ['_rma0']);
  assert.ok((await read(out.data, 'word/header1.xml')).includes('w:name="_rma0"'));
  // The second pass: the same package with a page started before the second paragraph.
  const broken = await out.withPageBreaks(new Set(['_rmb1']));
  const brokenDoc = await read(broken, 'word/document.xml');
  assert.ok(brokenDoc.includes('<w:pPr><w:pageBreakBefore/></w:pPr><w:bookmarkStart w:id="1800000001" w:name="_rmb1"/>'), brokenDoc);
  assert.ok((await read(broken, 'word/numbering.xml')).includes('•'), 'other parts carry over');
  // Breaks are always applied to the marked document, never on top of earlier breaks.
  const again = await read(await out.withPageBreaks(new Set(['_rmb1'])), 'word/document.xml');
  assert.equal(again, brokenDoc);
}

// A Word-saved document: markers honoured, the redundant one dropped, footer numbers marked,
// an empty embedded font face dropped, a chart announced.
{
  const doc = body(
    '<w:p><w:r><w:t>One</w:t><w:br w:type="page"/></w:r></w:p>' +
      '<w:p><w:r><w:lastRenderedPageBreak/><w:t>Two</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>long</w:t><w:lastRenderedPageBreak/><w:t>Three</w:t></w:r></w:p>' +
      '<w:p><w:r><w:drawing><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></w:drawing></w:r></w:p>',
  );
  const footer = `<w:ftr ${W}><w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const fontTable = `<w:fonts ${W}><w:font w:name="Sofia Sans Light"><w:embedRegular r:id="rId1"/><w:embedBold r:id="rId2"/></w:font></w:fonts>`;
  const fontRels = '<Relationships><Relationship Id="rId1" Target="fonts/font1.odttf"/><Relationship Id="rId2" Target="fonts/font2.odttf"/></Relationships>';
  const bytes = await pkg({
    'word/document.xml': doc,
    'word/footer1.xml': footer,
    'word/fontTable.xml': fontTable,
    'word/_rels/fontTable.xml.rels': fontRels,
    'word/fonts/font1.odttf': new Uint8Array([1, 2, 3, 4]),
    'word/fonts/font2.odttf': new Uint8Array(0),
  });
  const out = await prepareDocx(bytes);
  assert.equal(out.honourPageMarkers, true);
  assert.equal(out.unsupported.charts, true);
  const newDoc = await read(out.data, 'word/document.xml');
  assert.equal(newDoc.split('<w:lastRenderedPageBreak/>').length - 1, 1, 'only the marker after the manual break is dropped');
  assert.ok((await read(out.data, 'word/footer1.xml')).includes(PAGE_FIELD_MARK));
  const newTable = await read(out.data, 'word/fontTable.xml');
  assert.ok(newTable.includes('rId1') && !newTable.includes('rId2'), 'the 0-byte bold face is dropped');
  const fontStillThere = (await JSZip.loadAsync(out.data)).file('word/fonts/font1.odttf');
  assert.ok(fontStillThere, 'other parts are carried over');
}

// A generated document (no markers) keeps its markers setting off, but its fields are still marked.
{
  const doc = body('<w:p><w:r><w:t>x</w:t></w:r></w:p><w:p><w:fldSimple w:instr="NUMPAGES"/></w:p>');
  const out = await prepareDocx(await pkg({ 'word/document.xml': doc }));
  assert.equal(out.honourPageMarkers, false);
  assert.ok((await read(out.data, 'word/document.xml')).includes('NUMPAGES'));
}

// A package with no Word document in it.
await assert.rejects(prepareDocx(await pkg({ 'ppt/presentation.xml': '<p/>' })), /no Word document/);

console.log('prepareDocx.test.ts: all passed');
