/**
 * Sprint 134 (R1, S1–S4): a project's own details in `.ritemark/project.json`.
 * Run: npx tsx src/projects/projectFile.test.ts
 */

import assert from 'node:assert/strict';
import * as path from 'path';
import {
  cleanProjectLine,
  COVER_SIZE_LIMIT,
  PROJECT_LINE_LIMIT,
  projectInitials,
  readProject,
  setProjectCover,
  setProjectLine,
  type ProjectFileFs,
} from './projectFile';

/** An in-memory file system: folders, files, folders that refuse writes. */
class FakeFs implements ProjectFileFs {
  readonly files = new Map<string, Uint8Array>();
  readonly dirs = new Set<string>();
  readonly readOnly = new Set<string>();
  writes = 0;

  dir(target: string): this {
    this.dirs.add(target);
    return this;
  }

  file(target: string, text: string | Uint8Array): this {
    this.files.set(target, typeof text === 'string' ? new TextEncoder().encode(text) : text);
    return this;
  }

  text(target: string): string | undefined {
    const bytes = this.files.get(target);
    return bytes ? new TextDecoder().decode(bytes) : undefined;
  }

  private fail(codeName: string): never {
    throw Object.assign(new Error(codeName), { code: codeName });
  }

  private writable(target: string): void {
    if (!this.dirs.has(path.dirname(target))) this.fail('ENOENT');
    for (const dir of this.readOnly) if (target.startsWith(dir + path.sep) || target === dir) this.fail('EACCES');
  }

  async readFile(target: string): Promise<Uint8Array> {
    const bytes = this.files.get(target);
    if (!bytes) this.fail(this.dirs.has(target) ? 'EISDIR' : 'ENOENT');
    return bytes;
  }

  async writeFile(target: string, data: Uint8Array): Promise<void> {
    this.writable(target);
    this.writes += 1;
    this.files.set(target, data);
  }

  async rename(from: string, to: string): Promise<void> {
    this.writable(to);
    const bytes = this.files.get(from);
    if (!bytes) this.fail('ENOENT');
    this.files.delete(from);
    this.files.set(to, bytes);
  }

  async mkdir(target: string): Promise<void> {
    if (this.dirs.has(target)) this.fail('EEXIST');
    this.writable(target);
    this.dirs.add(target);
  }

  async readdir(target: string): Promise<string[]> {
    if (!this.dirs.has(target)) this.fail('ENOENT');
    return [...this.files.keys(), ...this.dirs].filter((entry) => path.dirname(entry) === target).map((entry) => path.basename(entry));
  }

  async unlink(target: string): Promise<void> {
    this.writable(target);
    if (!this.files.delete(target)) this.fail('ENOENT');
  }

  async stat(target: string): Promise<{ size: number; isDirectory: boolean }> {
    if (this.dirs.has(target)) return { size: 0, isDirectory: true };
    const bytes = this.files.get(target);
    if (!bytes) this.fail('ENOENT');
    return { size: bytes.byteLength, isDirectory: false };
  }
}

const folder = '/work/Leadership programme';
const projectJson = path.join(folder, '.ritemark', 'project.json');
const ids = (() => {
  let n = 0;
  return () => `t${(n += 1)}`;
})();

async function main(): Promise<void> {
  // ── Initials, as patch 018's head draws them ──
  assert.equal(projectInitials('Leadership programme'), 'LP');
  assert.equal(projectInitials('Sales proposal Q4'), 'SP');
  assert.equal(projectInitials('board-report_2026'), 'BR');
  assert.equal(projectInitials('Ärm öö'), 'ÄÖ');
  assert.equal(projectInitials('   '), '·');
  assert.equal(projectInitials('Empty'), 'EM', 'one word: its first two letters, as the welcome draws them');
  assert.equal(projectInitials('2026 plans'), '2P');

  // ── The line: one line, cut at a word ──
  assert.equal(cleanProjectLine('  A  sample\nproject  '), 'A sample project');
  const long = cleanProjectLine('word '.repeat(80));
  assert.ok([...long].length <= PROJECT_LINE_LIMIT && !long.endsWith(' ') && long.endsWith('word'));

  // ── S1: defaults, nothing written ──
  {
    const fs = new FakeFs().dir('/work').dir(folder);
    const details = await readProject(fs, folder);
    assert.deepEqual(details, { name: 'Leadership programme', mark: 'LP', line: '', cover: null, unreadable: false });
    assert.equal(fs.writes, 0);
    assert.equal(fs.dirs.has(path.join(folder, '.ritemark')), false, 'reading makes no folder');
  }

  // ── S2: the line and the cover, kept in the folder ──
  {
    const fs = new FakeFs().dir('/work').dir(folder).dir('/pictures').file('/pictures/Harbour.JPEG', 'jpeg-bytes');
    const line = await setProjectLine(fs, folder, 'A sample project to try things on.', { randomId: ids });
    assert.ok(line.ok);
    assert.equal(line.details.line, 'A sample project to try things on.');
    const cover = await setProjectCover(fs, folder, '/pictures/Harbour.JPEG', { randomId: ids });
    assert.ok(cover.ok);
    assert.equal(cover.details.cover, 'cover.jpg');
    assert.equal(fs.text(path.join(folder, '.ritemark', 'cover.jpg')), 'jpeg-bytes');
    assert.equal(fs.text('/pictures/Harbour.JPEG'), 'jpeg-bytes', 'the original stays');
    assert.deepEqual(JSON.parse(fs.text(projectJson)!), { ritemark: 'project/1', line: 'A sample project to try things on.', cover: 'cover.jpg' });
    assert.ok(![...fs.files.keys()].some((name) => name.includes('.tmp-')), 'no temporary file is left');
    // A PNG later replaces the JPEG, and the JPEG goes.
    fs.file('/pictures/Other.png', 'png-bytes');
    const again = await setProjectCover(fs, folder, '/pictures/Other.png', { randomId: ids });
    assert.ok(again.ok && again.details.cover === 'cover.png');
    assert.equal(fs.files.has(path.join(folder, '.ritemark', 'cover.jpg')), false);
    // The same line again writes nothing.
    const writes = fs.writes;
    assert.ok((await setProjectLine(fs, folder, '  A sample project to try things on. ')).ok);
    assert.equal(fs.writes, writes);
    // An empty line removes it.
    const cleared = await setProjectLine(fs, folder, '   ', { randomId: ids });
    assert.ok(cleared.ok && cleared.details.line === '');
    assert.equal('line' in JSON.parse(fs.text(projectJson)!), false);
  }

  // ── Unknown keys are kept; the proof of concept's `about` is read as the line once ──
  {
    const fs = new FakeFs().dir('/work').dir(folder).dir(path.join(folder, '.ritemark'))
      .file(projectJson, JSON.stringify({ about: 'From the PoC', cover: '.ritemark/cover.jpg', name: 'Kept', theme: { accent: 'teal' } }));
    const details = await readProject(fs, folder);
    assert.equal(details.line, 'From the PoC');
    assert.equal(details.cover, 'cover.jpg');
    assert.equal(details.name, 'Leadership programme', 'the name is the folder’s in this sprint');
    assert.ok((await setProjectLine(fs, folder, 'New line', { randomId: ids })).ok);
    assert.deepEqual(JSON.parse(fs.text(projectJson)!), { ritemark: 'project/1', cover: '.ritemark/cover.jpg', name: 'Kept', theme: { accent: 'teal' }, line: 'New line' });
  }

  // ── A cover that points out of `.ritemark/` is not used ──
  for (const cover of ['../../secret.jpg', '/etc/passwd', 'sub/cover.jpg', 'cover.exe', '..']) {
    const fs = new FakeFs().dir('/work').dir(folder).dir(path.join(folder, '.ritemark')).file(projectJson, JSON.stringify({ ritemark: 'project/1', cover }));
    assert.equal((await readProject(fs, folder)).cover, null, cover);
  }

  // ── S3: a file that can't be read is never written over ──
  for (const text of ['{ not json', '[1, 2]', JSON.stringify({ ritemark: 'project/2', line: 'From a newer Ritemark' }), new Uint8Array([0xff, 0xfe, 0x00])]) {
    const fs = new FakeFs().dir('/work').dir(folder).dir(path.join(folder, '.ritemark')).file(projectJson, text as string);
    const before = fs.files.get(projectJson);
    const details = await readProject(fs, folder);
    assert.equal(details.unreadable, true);
    assert.equal(details.line, '');
    const result = await setProjectLine(fs, folder, 'Mine');
    assert.ok(!result.ok && result.reason === 'unreadable' && /left the file as it is/.test(result.message));
    fs.file('/pictures/a.png', 'png').dir('/pictures');
    const cover = await setProjectCover(fs, folder, '/pictures/a.png');
    assert.ok(!cover.ok && cover.reason === 'unreadable');
    assert.equal(fs.files.get(projectJson), before, 'the file is as it was');
    assert.equal(fs.files.has(path.join(folder, '.ritemark', 'cover.png')), false);
  }

  // ── S4: a folder that can't be written ──
  {
    const fs = new FakeFs().dir('/work').dir(folder);
    fs.readOnly.add(folder);
    const result = await setProjectLine(fs, folder, 'Mine');
    assert.ok(!result.ok && result.reason === 'not-writable' && /can’t be written/.test(result.message));
    assert.deepEqual(await readProject(fs, folder), { name: 'Leadership programme', mark: 'LP', line: '', cover: null, unreadable: false });
  }

  // ── R13: a folder that has gone stays gone ──
  {
    const fs = new FakeFs().dir('/work');
    const result = await setProjectLine(fs, folder, 'Mine');
    assert.ok(!result.ok && result.reason === 'gone');
    assert.equal(fs.dirs.has(folder), false, 'the folder is not made again');
    assert.equal(fs.dirs.has(path.join(folder, '.ritemark')), false);
  }

  // ── Pictures: kinds and size ──
  {
    const fs = new FakeFs().dir('/work').dir(folder).dir('/pictures').file('/pictures/notes.txt', 'x');
    const notImage = await setProjectCover(fs, folder, '/pictures/notes.txt');
    assert.ok(!notImage.ok && notImage.reason === 'not-an-image');
    fs.file('/pictures/huge.png', new Uint8Array(COVER_SIZE_LIMIT + 1));
    const huge = await setProjectCover(fs, folder, '/pictures/huge.png');
    assert.ok(!huge.ok && huge.reason === 'too-large');
    assert.equal(fs.dirs.has(path.join(folder, '.ritemark')), false, 'nothing written for a refused picture');
  }

  console.log('projectFile.test.ts: all passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
