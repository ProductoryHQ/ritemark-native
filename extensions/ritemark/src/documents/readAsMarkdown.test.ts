/** Sprint 173 S1–S3, S8–S14, S16. Run: npx tsx src/documents/readAsMarkdown.test.ts */
import assert from 'node:assert/strict';
import { mkdir, readFile, symlink, truncate, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import PDFDocument from 'pdfkit';
import { DEFAULT_SEARCH_LIMITS } from '../search/protocol';
import { SearchWorkerClient, type WorkerLike } from '../search/searchWorkerClient';
import { makeTempDir } from '../testing/tempDir';
import { readAsMarkdown } from './readAsMarkdown';
import { readProjectDocument } from './readProjectDocument';
import { WORD_EQUATION_MARKDOWN, wordEquationFixture } from './wordEquationFixture.test-helper';

const pause = async () => undefined;

function pdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ info: { Producer: 'fixture', Creator: 'fixture' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

const pageText = (page: number) => `Page ${page} contains the synthetic observations from the operations review.`;

async function main() {
  const equationRead = await readAsMarkdown(await wordEquationFixture(), 'Equations.docx', 'word', {}, pause);
  assert.equal(equationRead.text, `Equations.docx · Word · 4 blocks · whole text · 2 equations approximate\n\n${WORD_EQUATION_MARKDOWN}`);
  const base = makeTempDir('rm-document-read-');
  const project = path.join(base, 'project');
  await mkdir(project);
  const read = (file: string, from?: number, to?: number) => readProjectDocument({ path: file, from, to }, [project], pause);
  const row = (...texts: string[]) => new TableRow({
    children: texts.map((text) => new TableCell({ children: [new Paragraph(text)] })),
  });
  const word = await Packer.toBuffer(new Document({
    creator: 'fixture',
    lastModifiedBy: 'fixture',
    numbering: { config: [{ reference: 'ordered', levels: [{
      level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START,
    }] }] },
    sections: [{ children: [
      new Paragraph({ text: 'Operations', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: 'Listen first', bullet: { level: 0 } }),
      new Paragraph({ text: 'Ask a question', bullet: { level: 1 } }),
      new Paragraph({ text: 'Write a note', numbering: { reference: 'ordered', level: 0 } }),
      new Paragraph({ text: 'Agree on a next step', numbering: { reference: 'ordered', level: 0 } }),
      new Table({ rows: [row('Route', 'Days'), row('North | East', '5')] }),
    ] }],
  }));
  const name = 'Interview – head of operations.docx';
  await writeFile(path.join(project, name), word);
  const report = await read(name);
  assert.equal(report.text, [
    `${name} · Word · 6 blocks · whole text`, '# Operations',
    '- Listen first\n    - Ask a question\n1. Write a note\n2. Agree on a next step',
    '| Route | Days |\n| --- | --- |\n| North \\| East | 5 |',
  ].join('\n\n'));
  const wordCut = await readAsMarkdown(word, name, 'word', {}, pause, 16);
  assert.match(wordCut.text, /cut after block 1 of 6\n[\s\S]*Text was cut after block 1 of 6\.$/);
  assert.equal((await read(name, 1)).isError, true);
  assert.deepEqual(await readFile(path.join(project, name)), word, 'reading does not change the file');

  const pages = await pdf((doc) => {
    for (let page = 1; page <= 12; page++) {
      if (page > 1) doc.addPage();
      doc.text(pageText(page));
      if (page === 4) doc.text('One line\ncontinues here');

    }
  });
  await writeFile(path.join(project, 'Report.pdf'), pages);
  const whole = await read('Report.pdf');
  assert.match(whole.text, /^Report\.pdf · PDF · 12 pages · whole text/);
  assert.deepEqual([...whole.text.matchAll(/^## Page (\d+)$/gm)].map((m) => Number(m[1])), Array.from({ length: 12 }, (_, i) => i + 1));
  const selection = await read('Report.pdf', 3, 4);
  assert.match(selection.text, /^Report\.pdf · PDF · 12 pages · pages 3–4/);
  assert.deepEqual([...selection.text.matchAll(/^## Page (\d+)$/gm)].map((m) => m[1]), ['3', '4']);
  assert.match(selection.text, new RegExp(pageText(3)));
  assert.equal((await read('Report.pdf', 13)).isError, true);

  const cut = await readAsMarkdown(pages.slice(), 'Report.pdf', 'pdf', {}, pause, 110);
  assert.match(cut.text, /12 pages · cut after page 1 of 12\n[\s\S]*Text was cut after page 1 of 12\.$/);
  const mixed = await pdf((doc) => { doc.addPage().text(pageText(2)); });
  const blankPage = await readAsMarkdown(mixed, 'Mixed.pdf', 'pdf', { from: 1, to: 1 }, pause);
  assert.match(blankPage.text, /## Page 1\n\nNo extractable text on this page/);

  const protectedWord = Buffer.concat([
    Buffer.from('d0cf11e0a1b11ae1', 'hex'),
    Buffer.from('EncryptedPackage', 'utf16le'),
  ]);
  await writeFile(path.join(project, 'Protected.docx'), protectedWord);
  const locked = await read('Protected.docx');
  assert.match(locked.text, /it has a password\. Open it in Word, or save a copy without the password/i);
  assert.ok(!locked.isError);
  await writeFile(path.join(project, 'Damaged.docx'), word.subarray(0, 120));
  assert.match((await read('Damaged.docx')).text, /damaged/i);
  await writeFile(path.join(project, 'Old.doc'), Buffer.alloc(0));
  assert.match((await read('Old.doc')).text, /older Word format/i);
  await writeFile(path.join(project, 'Large.pdf'), Buffer.from('%PDF-1.4'));
  await truncate(path.join(project, 'Large.pdf'), DEFAULT_SEARCH_LIMITS.pdfBytes + 1);
  assert.match((await read('Large.pdf')).text, /too big.*50 MB/i);
  await writeFile(path.join(project, 'Scan.pdf'), await pdf((doc) => { doc.rect(10, 10, 50, 50).fill(); }));
  assert.match((await read('Scan.pdf')).text, /a scan with no text \(1 page\)/);

  await writeFile(path.join(project, 'Evicted.docx'), Buffer.alloc(0));
  await truncate(path.join(project, 'Evicted.docx'), 8192);
  if (process.platform !== 'win32') {
    assert.match((await readProjectDocument({ path: 'Evicted.docx' }, [project], pause, 'darwin')).text, /kept online only/i);
  }
  const cloudFolder = path.join(project, 'OneDrive - Fixture');
  await mkdir(cloudFolder);
  await writeFile(path.join(cloudFolder, 'Online.docx'), Buffer.alloc(0));
  assert.match((await readProjectDocument({ path: 'OneDrive - Fixture/Online.docx' }, [project], pause, 'win32')).text, /kept online only/i);

  await writeFile(path.join(base, 'Outside.docx'), word);
  await symlink(base, path.join(project, 'Outside link'), 'junction');
  for (const file of ['../Outside.docx', path.join(base, 'Outside.docx'), 'Outside link/Outside.docx']) {
    const refusal = await read(file);
    assert.equal(refusal.isError, true);
    assert.match(refusal.text, /inside the project folder/);
    assert.doesNotMatch(refusal.text, /Operations/);
  }
  await writeFile(path.join(project, 'README.md'), '# Fixture');
  assert.match((await read('README.md')).text, /Markdown files in the Ritemark editor/);
  assert.match((await read('.')).text, /Choose a Word \(\.docx\), PDF, or PowerPoint \(\.pptx\) file/);
  // Exercise the actual bundled worker's read handler before any init message.
  const bundled = await build({
    entryPoints: [path.join(__dirname, '../search/worker/searchWorker.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    write: false,
  });
  const workerPath = path.join(base, 'searchWorker.cjs');
  await writeFile(workerPath, bundled.outputFiles[0].contents);
  const client = new SearchWorkerClient(() => new Worker(workerPath, {
    execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 512 },
  }) as unknown as WorkerLike, null);
  const timeout = setTimeout(() => client.dispose(), 15_000);
  try {
    assert.deepEqual(await client.read({ path: name }, [project]), report);
    const request = { path: 'Report.pdf', from: 3, to: 4 };
    assert.deepEqual(await client.read(request, [project]), selection);
    // S24/S25/S27: passage lookups use the read handler without a search index.
    const lookup = async (path: string, text: string, page?: number) =>
      (await client.read({ path, passage: { text, page } }, [project]))?.location;
    assert.deepEqual(await lookup(name, 'LISTEN   first', 4), { text: 'Listen first', occurrence: 0 });
    assert.deepEqual(await lookup(name, 'North | East'), { text: 'North | East', occurrence: 0 });
    assert.deepEqual(await lookup('Report.pdf', pageText(4), 4), { text: pageText(4), occurrence: 0, page: 4 });
    assert.match((await lookup('Report.pdf', 'One line continues here', 4) as { text: string }).text, /^One line ?continues here$/);
    assert.deepEqual(await lookup('Report.pdf', pageText(5), 4), { page: 4 });
    assert.equal(await lookup('Report.pdf', 'made-up quotation', 4), undefined);
    assert.deepEqual(await lookup('README.md', 'fixture'), { text: 'Fixture', occurrence: 0 });
    assert.equal((await client.read({ path: '../outside.docx', passage: { text: 'Operations' } }, [project]))?.isError, true);
    await writeFile(path.join(project, 'Report.pdf'), Buffer.from('damaged'));
    assert.match((await client.read(request, [project]))?.text ?? '', /damaged/);
  } finally {
    clearTimeout(timeout);
    client.dispose();
  }

  console.log('documents/readAsMarkdown: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
