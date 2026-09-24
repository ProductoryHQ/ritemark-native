/**
 * Sprint 124 (#284) R5 — the host's look at an Office file before previewing it,
 * run against the Word corpus's own failure fixtures.
 * Run: npx tsx src/officePreview/officePackageCheck.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import JSZip from 'jszip';
import { OFFICE_PREVIEW_LIMITS, checkOfficePackage, describeProblem, readZipDirectory } from './officePackageCheck';

const corpus = path.resolve(__dirname, '../../../../docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/research/corpus/fixtures');
const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(corpus, name)));

async function main() {
  // Real documents pass.
  for (const name of ['01-headings-styles.docx', '04-images.docx', '10-unsupported-content.docx']) {
    assert.deepEqual(checkOfficePackage(fixture(name), 'word/'), { ok: true }, name);
  }
  const entries = readZipDirectory(fixture('01-headings-styles.docx'))!;
  assert.ok(entries.some((e) => e.name === 'word/document.xml'));
  assert.ok(entries.every((e) => e.uncompressedSize >= 0 && e.compressedSize >= 0));

  // The corpus failure fixtures.
  assert.equal(checkOfficePackage(fixture('f1-not-a-zip.docx'), 'word/').ok, false);
  assert.deepEqual(checkOfficePackage(fixture('f1-not-a-zip.docx'), 'word/'), { ok: false, reason: 'not-an-office-file' });
  assert.deepEqual(checkOfficePackage(fixture('f2-truncated.docx'), 'word/'), { ok: false, reason: 'damaged' });
  assert.deepEqual(checkOfficePackage(fixture('f3-password-protected.docx'), 'word/'), { ok: false, reason: 'password-protected' });
  const bomb = checkOfficePackage(fixture('f4-decompression-bomb.docx'), 'word/');
  assert.equal(bomb.ok, false);
  assert.equal(bomb.ok === false && bomb.reason, 'too-complex');

  // Size, legacy .doc, a PowerPoint file named .docx, too many parts.
  const big = checkOfficePackage(fixture('01-headings-styles.docx'), 'word/', { ...OFFICE_PREVIEW_LIMITS, maxFileBytes: 1000 });
  assert.equal(big.ok === false && big.reason, 'too-large');
  const legacy = new Uint8Array(4096);
  legacy.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  assert.deepEqual(checkOfficePackage(legacy, 'word/'), { ok: false, reason: 'legacy-format' });

  const pptx = new JSZip();
  pptx.file('[Content_Types].xml', '<Types/>');
  pptx.file('ppt/presentation.xml', '<p:presentation/>');
  const pptxBytes = await pptx.generateAsync({ type: 'uint8array' });
  assert.deepEqual(checkOfficePackage(pptxBytes, 'word/'), { ok: false, reason: 'wrong-kind' });
  assert.deepEqual(checkOfficePackage(pptxBytes, 'ppt/'), { ok: true }, 'the same check serves PowerPoint (Sprint 125)');

  const many = new JSZip();
  many.file('[Content_Types].xml', '<Types/>');
  for (let i = 0; i < 20; i++) many.file(`word/part${i}.xml`, '<x/>');
  const manyBytes = await many.generateAsync({ type: 'uint8array' });
  const tooMany = checkOfficePackage(manyBytes, 'word/', { ...OFFICE_PREVIEW_LIMITS, maxEntries: 10 });
  assert.equal(tooMany.ok === false && tooMany.reason, 'too-complex');

  // A ZIP with a comment after the directory is still read.
  const commented = new Uint8Array([...fixture('01-headings-styles.docx')]);
  // Patch the comment length and append a comment.
  const view = new DataView(commented.buffer);
  let eocd = -1;
  for (let i = commented.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  const comment = new TextEncoder().encode('made by a test');
  view.setUint16(eocd + 20, comment.length, true);
  const withComment = new Uint8Array(commented.length + comment.length);
  withComment.set(commented);
  withComment.set(comment, commented.length);
  assert.deepEqual(checkOfficePackage(withComment, 'word/'), { ok: true });

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
