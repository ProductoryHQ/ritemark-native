/**
 * Sprint 148 (R2, A2, A3): the four readers, on fixtures made here with the
 * extension's own `docx` and `pdfkit` (no client material), and the Word
 * corpus's refusal fixtures from Sprint 124.
 * Run: npx tsx src/search/worker/readers.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, Tab, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { documentName, formatOf, readDocument } from './readers';
import { documentXmlPassages } from './readers/docx';
import { readCsv } from './readers/csv';
import { readMarkdown } from './readers/markdown';
import { decodeEntities, decodeText } from './readers/types';

const BUDGET = 2 * 1024 * 1024;
const pause = () => new Promise<void>((resolve) => setImmediate(resolve));
const texts = (outcome: Awaited<ReturnType<typeof readDocument>>) => (outcome.ok ? outcome.passages.map((p) => p.text) : []);

function pdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ info: { Producer: 'fixture', Creator: 'fixture' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    build(doc);
    doc.end();
  });
}

async function main() {
  // ── Names and kinds ─────────────────────────────────────────────────────────
  assert.equal(formatOf('Report.MD'), 'markdown');
  assert.equal(formatOf('notes.markdown'), 'markdown');
  assert.equal(formatOf('a.docx'), 'docx');
  assert.equal(formatOf('a.doc'), null, 'a legacy .doc is not a kind search reads');
  assert.equal(formatOf('.md'), null);
  assert.equal(documentName('Annual report.pdf'), 'Annual report');
  assert.equal(decodeEntities('A &amp; B &lt;C&gt; &#228; &#x161;'), 'A & B <C> ä š');
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69])), 'hi', 'UTF-8 byte-order mark dropped');
  assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0x68, 0x00])), 'h', 'UTF-16');

  // ── Markdown: what a reader sees ────────────────────────────────────────────
  {
    const md = [
      '---',
      'title: secret front matter',
      '---',
      '# Harbour report',
      '',
      'A [link text](https://example.com/hidden-target) and ![alt](images/hidden-path.png) with **bold** and `code`.',
      '',
      '- first item',
      '  - nested item',
      '- second item',
      '',
      '| Route | Days |',
      '| --- | --- |',
      '| Northern | 5 |',
      '',
      '> A quoted line',
      '',
      '<!-- {id:c1} @claude: check the figures -->',
      '',
      'The <mark data-comment="verify with finance">margins</mark> line &amp; more.',
      '',
      '<div class="x">Inside a div</div>',
    ].join('\n');
    const outcome = readMarkdown(md, BUDGET);
    assert.ok(outcome.ok);
    const all = texts(outcome);
    assert.deepEqual(all, [
      'Harbour report',
      'A link text and with bold and code.',
      'first item',
      'nested item',
      'second item',
      'Route · Days',
      'Northern · 5',
      'A quoted line',
      '@claude: check the figures',
      'The margins line & more.',
      'verify with finance',
      'Inside a div',
    ]);
    const joined = all.join(' ');
    for (const hidden of ['secret', 'hidden-target', 'hidden-path', 'class', 'c1']) assert.ok(!joined.includes(hidden), hidden);
    assert.equal(outcome.ok && outcome.passages[0].at.block, 0);
    // A comment's words are marked as a comment's, so R9 doesn't count them in the document's text.
    const comments = outcome.ok ? outcome.passages.filter((p) => p.at.comment).map((p) => p.text) : [];
    assert.deepEqual(comments, ['@claude: check the figures', 'verify with finance']);
    // The budget per document.
    const capped = readMarkdown('word '.repeat(1000), 100);
    assert.ok(capped.ok && capped.truncated && capped.passages[0].text.length <= 100);
  }

  // ── CSV: rows, quotes, line breaks inside quotes ───────────────────────────
  {
    const outcome = readCsv('Name,Contact\n"Harbour Logistics","Mari Tamm"\n"Line ""one""\nand two",x\n\n', BUDGET);
    assert.ok(outcome.ok);
    assert.deepEqual(texts(outcome), ['Name · Contact', 'Harbour Logistics · Mari Tamm', 'Line "one" and two · x']);
    assert.deepEqual(outcome.ok && outcome.columns, ['Name', 'Contact']);
    assert.deepEqual(outcome.ok && outcome.passages.map((p) => p.at.row), [0, 1, 2]);
  }

  // ── Word: document.xml through the preview's zip reader (A3) ────────────────
  {
    const word = new Document({
      creator: 'fixture',
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun('Harbour '), new TextRun({ text: 'report', bold: true }), new TextRun(' for 2027')] }),
            new Paragraph({ children: [new TextRun('Before'), new Tab(), new TextRun('after a tab'), new TextRun({ text: 'next line', break: 1 })] }),
            new Table({
              rows: [
                new TableRow({ children: [new TableCell({ children: [new Paragraph('Route')] }), new TableCell({ children: [new Paragraph('Käsi ja õun')] })] }),
              ],
            }),
            new Paragraph('Müller and José signed.'),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(word));
    const outcome = await readDocument('docx', bytes, BUDGET, pause);
    assert.deepEqual(texts(outcome), ['Harbour report for 2027', 'Before after a tab next line', 'Route', 'Käsi ja õun', 'Müller and José signed.']);

    // Deleted text and field codes are no words; a text box's paragraph is its own passage.
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>kept</w:t></w:r><w:del><w:r><w:delText>gone</w:delText></w:r></w:del>' +
      '<w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:t xml:space="preserve"> &amp; more</w:t></w:r>' +
      '<w:r><w:pict><w:txbxContent><w:p><w:r><w:t>in a box</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p></w:body></w:document>';
    const parsed = documentXmlPassages(xml, BUDGET);
    assert.deepEqual(texts(parsed), ['in a box', 'kept & more']);
    // A text box carries its paragraphs twice, the second time for older readers (mc:Fallback): read once.
    const twice =
      '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent><w:p><w:r><w:t>boxed</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice>' +
      '<mc:Fallback><w:pict><v:textbox><w:txbxContent><w:p><w:r><w:t>boxed</w:t></w:r></w:p></w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r><w:r><w:t>after</w:t></w:r></w:p>';
    assert.deepEqual(texts(documentXmlPassages(twice, BUDGET)), ['boxed', 'after']);

    // The corpus's refusals: found by name.
    const corpus = path.resolve(__dirname, '../../../../../docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/research/corpus/fixtures');
    const read = (name: string) => readDocument('docx', new Uint8Array(fs.readFileSync(path.join(corpus, name))), BUDGET, pause);
    assert.deepEqual(await read('f3-password-protected.docx'), { ok: false, reason: 'protected' });
    assert.deepEqual(await read('f2-truncated.docx'), { ok: false, reason: 'unreadable' });
    assert.deepEqual(await read('f1-not-a-zip.docx'), { ok: false, reason: 'unreadable' });
    assert.equal((await read('f4-decompression-bomb.docx')).ok, false);
    // A legacy .doc renamed .docx: a compound file without an encrypted package.
    const legacy = new Uint8Array(4096);
    legacy.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    assert.deepEqual(await readDocument('docx', legacy, BUDGET, pause), { ok: false, reason: 'unreadable' });
    const saved = await read('03-tables.docx');
    assert.ok(saved.ok && saved.passages.length > 5, 'a real Word file reads');
    assert.ok(texts(saved).some((text) => text.includes('Northern channel')));
  }

  // ── PDF: pdf.js in this thread, the preview's chunks (A2) ───────────────────
  {
    const text = await pdf((doc) => {
      doc.fontSize(18).text('Annual harbour report');
      doc.moveDown(2);
      doc.fontSize(11).text('The harbour office opens at seven. Ships wait in the outer roads until the pilot comes aboard, and the customs house keeps its ledgers in the old warehouse by the quay.');
      doc.moveDown(2);
      doc.text('Käsi, õun, sõber, šokolaad ja žürii.');
      doc.addPage();
      doc.text('Second page: the lighthouse keeper.');
    });
    // pdf.js detaches the bytes it reads: each read gets its own copy.
    const outcome = await readDocument('pdf', text.slice(), BUDGET, pause);
    assert.ok(outcome.ok, 'a PDF with text reads');
    const all = texts(outcome);
    assert.ok(all.includes('Annual harbour report'), 'a heading is its own passage');
    const body = all.find((t) => t.startsWith('The harbour office'))!;
    assert.ok(body.includes('pilot comes aboard, and the customs'), `a line's last word doesn't run into the next line's first: ${body}`);
    assert.ok(all.includes('Käsi, õun, sõber, šokolaad ja žürii.'), 'Estonian letters');
    assert.deepEqual(outcome.ok && [...new Set(outcome.passages.map((p) => p.at.page))], [1, 2], 'passages carry their page');

    const scanned = await pdf((doc) => {
      doc.rect(50, 50, 400, 600).fill('#888888');
    });
    assert.deepEqual(await readDocument('pdf', scanned, BUDGET, pause), { ok: false, reason: 'scanned' });
    assert.deepEqual(await readDocument('pdf', text.slice(0, Math.floor(text.length / 3)), BUDGET, pause), { ok: false, reason: 'unreadable' }, 'damaged');
    assert.deepEqual(await readDocument('pdf', new TextEncoder().encode('not a pdf'), BUDGET, pause), { ok: false, reason: 'unreadable' });

    const long = await pdf((doc) => {
      for (let page = 0; page < 500; page++) {
        if (page) doc.addPage();
        doc.text(`Page ${page + 1}. ${'The harbour office opens at seven. '.repeat(8)}`);
      }
    });
    const started = Date.now();
    const longOutcome = await readDocument('pdf', long.slice(), BUDGET, pause);
    assert.ok(longOutcome.ok && longOutcome.passages.length >= 500, '500 pages');
    console.log(`  500-page PDF read in ${Date.now() - started} ms`);
    const capped = await readDocument('pdf', long, 5000, pause);
    assert.ok(capped.ok && capped.truncated, 'the budget stops a long PDF');

    // A Word-exported PDF from the corpus.
    const corpusPdf = path.resolve(__dirname, '../../../../../docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/research/corpus/word/09-long-document.pdf');
    const exported = await readDocument('pdf', new Uint8Array(fs.readFileSync(corpusPdf)), BUDGET, pause);
    assert.ok(exported.ok && texts(exported).some((t) => t.includes('Every shipment carries a paper copy')));
  }

  console.log('readers.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
