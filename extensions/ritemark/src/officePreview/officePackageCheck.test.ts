/**
 * Sprint 124 (#284) R5, Sprint 125 (#285) R5 — the host's look at an Office file
 * before previewing it, run against the Word and PowerPoint corpora's own fixtures.
 * Run: npx tsx src/officePreview/officePackageCheck.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import JSZip from 'jszip';
import { OFFICE_PREVIEW_LIMITS, checkOfficePackage, describeProblem, readZipDirectory, verifyDeclaredSizes } from './officePackageCheck';

const releases = path.resolve(__dirname, '../../../../docs/development/releases/v1.12.0');
const wordCorpus = path.join(releases, 'sprint-124-word-preview-fidelity/research/corpus');
const pptCorpus = path.join(releases, 'sprint-125-powerpoint-preview/research/corpus');
const read = (dir: string, name: string) => new Uint8Array(fs.readFileSync(path.join(dir, name)));
const word = (name: string) => read(path.join(wordCorpus, 'fixtures'), name);
const deck = (name: string) => read(path.join(pptCorpus, 'fixtures'), name);

async function main() {
  // Real documents pass: generated and Word-saved Word files, generated and PowerPoint-saved decks.
  for (const name of ['01-headings-styles.docx', '04-images.docx', '10-unsupported-content.docx']) {
    assert.deepEqual(await checkOfficePackage(word(name), 'word/'), { ok: true }, name);
    assert.deepEqual(await checkOfficePackage(read(path.join(wordCorpus, 'word'), name), 'word/'), { ok: true }, `word/${name}`);
  }
  for (const name of fs.readdirSync(path.join(pptCorpus, 'fixtures')).filter((n) => /^\d\d-.*\.pptx$/.test(n))) {
    assert.deepEqual(await checkOfficePackage(deck(name), 'ppt/'), { ok: true }, name);
    assert.deepEqual(await checkOfficePackage(read(path.join(pptCorpus, 'ppt'), name), 'ppt/'), { ok: true }, `ppt/${name}`);
  }
  const entries = readZipDirectory(word('01-headings-styles.docx'))!;
  assert.ok(entries.some((e) => e.name === 'word/document.xml'));
  assert.ok(entries.every((e) => e.uncompressedSize >= 0 && e.compressedSize >= 0 && (e.method === 0 || e.method === 8)));

  // The Word corpus's failure fixtures.
  assert.deepEqual(await checkOfficePackage(word('f1-not-a-zip.docx'), 'word/'), { ok: false, reason: 'not-an-office-file' });
  assert.deepEqual(await checkOfficePackage(word('f2-truncated.docx'), 'word/'), { ok: false, reason: 'damaged' });
  assert.deepEqual(await checkOfficePackage(word('f3-password-protected.docx'), 'word/'), { ok: false, reason: 'password-protected' });
  const bomb = await checkOfficePackage(word('f4-decompression-bomb.docx'), 'word/');
  assert.equal(bomb.ok === false && bomb.reason, 'too-complex');

  // The PowerPoint corpus's failure fixtures.
  assert.deepEqual(await checkOfficePackage(deck('f1-not-a-zip.pptx'), 'ppt/'), { ok: false, reason: 'not-an-office-file' });
  assert.deepEqual(await checkOfficePackage(deck('f2-truncated.pptx'), 'ppt/'), { ok: false, reason: 'damaged' });
  const deckBomb = await checkOfficePackage(deck('f3-decompression-bomb.pptx'), 'ppt/');
  assert.equal(deckBomb.ok === false && deckBomb.reason, 'too-complex');
  assert.deepEqual(await checkOfficePackage(deck('f5-password-protected.pptx'), 'ppt/'), { ok: false, reason: 'password-protected' });

  // Sprint 125 R5: parts that lie about their size. Both declare 4 KiB and inflate to 512 MiB;
  // the declared sizes pass every limit, so only inflating tells. The cap stops the inflate
  // at 4 KiB + 1 byte, which is what keeps these fast.
  for (const [bytes, prefix, part] of [
    [deck('f4-bomb-lying-size.pptx'), 'ppt/', 'ppt/slides/slide1.xml'],
    [deck('f6-docx-bomb-lying-size.docx'), 'word/', 'word/document.xml'],
  ] as const) {
    const lying = readZipDirectory(bytes)!.find((e) => e.name === part)!;
    assert.equal(lying.uncompressedSize, 4096, `${part} declares 4 KiB`);
    const started = Date.now();
    assert.deepEqual(await checkOfficePackage(bytes, prefix), { ok: false, reason: 'damaged' }, part);
    assert.ok(Date.now() - started < 1000, `${part}: refused without inflating 512 MiB (${Date.now() - started} ms)`);
  }

  // A part that declares more than it holds is refused too, and so are encrypted entries and
  // other compression methods, which the webview's JSZip cannot read either.
  const honest = word('01-headings-styles.docx');
  const honestEntries = readZipDirectory(honest)!;
  const document = honestEntries.find((e) => e.name === 'word/document.xml')!;
  assert.equal(await verifyDeclaredSizes(honest, honestEntries), true);
  assert.equal(await verifyDeclaredSizes(honest, [{ ...document, uncompressedSize: document.uncompressedSize + 1 }]), false);
  assert.equal(await verifyDeclaredSizes(honest, [{ ...document, flags: document.flags | 1 }]), false);
  assert.equal(await verifyDeclaredSizes(honest, [{ ...document, method: 12 }]), false);
  assert.equal(await verifyDeclaredSizes(honest, [{ ...document, localHeaderOffset: honest.length - 10 }]), false);

  // Size, legacy .doc, a PowerPoint file named .docx, too many parts.
  const big = await checkOfficePackage(word('01-headings-styles.docx'), 'word/', { ...OFFICE_PREVIEW_LIMITS, maxFileBytes: 1000 });
  assert.equal(big.ok === false && big.reason, 'too-large');
  const legacy = new Uint8Array(4096);
  legacy.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  assert.deepEqual(await checkOfficePackage(legacy, 'word/'), { ok: false, reason: 'legacy-format' });
  assert.deepEqual(await checkOfficePackage(legacy, 'ppt/'), { ok: false, reason: 'legacy-format' });

  const pptx = new JSZip();
  pptx.file('[Content_Types].xml', '<Types/>');
  pptx.file('ppt/presentation.xml', '<p:presentation/>');
  const pptxBytes = await pptx.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  assert.deepEqual(await checkOfficePackage(pptxBytes, 'word/'), { ok: false, reason: 'wrong-kind' });
  assert.deepEqual(await checkOfficePackage(pptxBytes, 'ppt/'), { ok: true });
  assert.deepEqual(await checkOfficePackage(honest, 'ppt/'), { ok: false, reason: 'wrong-kind' });

  const many = new JSZip();
  many.file('[Content_Types].xml', '<Types/>');
  for (let i = 0; i < 20; i++) many.file(`word/part${i}.xml`, '<x/>');
  const manyBytes = await many.generateAsync({ type: 'uint8array' });
  const tooMany = await checkOfficePackage(manyBytes, 'word/', { ...OFFICE_PREVIEW_LIMITS, maxEntries: 10 });
  assert.equal(tooMany.ok === false && tooMany.reason, 'too-complex');

  // A ZIP with a comment after the directory is still read.
  const commented = new Uint8Array([...word('01-headings-styles.docx')]);
  // Patch the comment length and append a comment.
  const view = new DataView(commented.buffer);
  let eocd = -1;
  for (let i = commented.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  const comment = new TextEncoder().encode('made by a test');
  view.setUint16(eocd + 20, comment.length, true);
  const withComment = new Uint8Array(commented.length + comment.length);
  withComment.set(commented);
  withComment.set(comment, commented.length);
  assert.deepEqual(await checkOfficePackage(withComment, 'word/'), { ok: true });

  // Messages name the size and the app.
  const msg = describeProblem({ reason: 'too-large', bytes: 82 * 1024 * 1024 }, 'Word document', 'Pages');
  assert.equal(msg.title, 'This Word document is too large to preview');
  assert.equal(msg.detail, 'It is 82 MB; the preview opens files up to 50 MB. Open it in Pages to read it.');
  assert.ok(describeProblem({ reason: 'password-protected' }, 'Word document', 'Microsoft Word').detail.includes('Microsoft Word'));

  console.log('officePackageCheck.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
