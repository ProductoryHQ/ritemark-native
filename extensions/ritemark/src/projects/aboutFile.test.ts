/**
 * Sprint 134 (R8, S28, S44): About this project, AGENTS.md and the CLAUDE.md pointer.
 * Run: npx tsx src/projects/aboutFile.test.ts
 */

import assert from 'node:assert/strict';
import * as path from 'path';
import {
  addPointerLine,
  createAboutFile,
  hasPointerLine,
  isAboutFile,
  isPointerOnly,
  isRootClaudeFile,
  needsNote,
  readAboutState,
  type AboutFileFs,
} from './aboutFile';

class FakeFs implements AboutFileFs {
  readonly files = new Map<string, Uint8Array>();
  readonly dirs = new Set<string>();
  readonly readOnly = new Set<string>();
  writes: string[] = [];

  constructor(...dirs: string[]) {
    for (const dir of dirs) this.dirs.add(dir);
  }
  put(target: string, text: string | Uint8Array): this {
    this.files.set(target, typeof text === 'string' ? new TextEncoder().encode(text) : text);
    return this;
  }
  text(target: string): string | undefined {
    const bytes = this.files.get(target);
    return bytes && new TextDecoder().decode(bytes);
  }
  private fail(codeName: string): never {
    throw Object.assign(new Error(codeName), { code: codeName });
  }
  async readFile(target: string): Promise<Uint8Array> {
    return this.files.get(target) ?? this.fail('ENOENT');
  }
  async readdir(target: string): Promise<string[]> {
    if (!this.dirs.has(target)) this.fail('ENOENT');
    return [...this.files.keys()].filter((file) => path.dirname(file) === target).map((file) => path.basename(file));
  }
  async writeNew(target: string, data: Uint8Array): Promise<void> {
    if (!this.dirs.has(path.dirname(target))) this.fail('ENOENT');
    if (this.readOnly.has(path.dirname(target))) this.fail('EACCES');
    const taken = [...this.files.keys()].some((file) => file.toLowerCase() === target.toLowerCase());
    if (taken) this.fail('EEXIST');
    this.writes.push(target);
    this.files.set(target, data);
  }
  async replace(target: string, data: Uint8Array): Promise<void> {
    if (this.readOnly.has(path.dirname(target))) this.fail('EACCES');
    this.writes.push(target);
    this.files.set(target, data);
  }
}

const root = '/work/Board report 2026';
const agents = path.join(root, 'AGENTS.md');
const claude = path.join(root, 'CLAUDE.md');

async function main(): Promise<void> {
  // ── The pointer and the line ──
  assert.equal(isPointerOnly('@AGENTS.md\n'), true);
  assert.equal(isPointerOnly('  @AGENTS.md  \r\n\r\n'), true, 'whitespace and CRLF ignored');
  assert.equal(isPointerOnly('﻿@AGENTS.md\n'), true, 'a byte-order mark ignored');
  assert.equal(isPointerOnly('@agents.md'), true, 'case ignored, as the file systems do');
  assert.equal(isPointerOnly('@AGENTS.md\nAlways answer in Estonian.\n'), false, 'one more line is the person’s own file');
  assert.equal(isPointerOnly(''), false);
  assert.equal(hasPointerLine('# Notes\n@AGENTS.md\n'), true);
  assert.equal(hasPointerLine('# Notes\nSee @AGENTS.md for more\n'), false, 'only a line of its own imports it');

  // ── Which files are the root's ──
  assert.equal(isAboutFile(root, agents), true);
  assert.equal(isAboutFile(root, path.join(root, 'agents.md')), true);
  assert.equal(isAboutFile(root, path.join(root, 'docs', 'AGENTS.md')), false, 'a subfolder’s AGENTS.md keeps its name');
  assert.equal(isRootClaudeFile(root, claude), true);
  assert.equal(isRootClaudeFile(root, path.join(root, 'docs', 'CLAUDE.md')), false);

  // ── S28: neither file: Create writes both, headed About this project ──
  {
    const fs = new FakeFs('/work', root);
    assert.deepEqual(await readAboutState(fs, root), { aboutPath: null, claudePath: null, claude: 'none' });
    const result = await createAboutFile(fs, root);
    assert.deepEqual(result, { ok: true, path: agents, created: true, wroteClaude: true });
    assert.equal(fs.text(agents), '# About this project\n\n');
    assert.equal(fs.text(claude), '@AGENTS.md\n');
    const state = await readAboutState(fs, root);
    assert.equal(state.claude, 'pointer');
    assert.equal(needsNote(state), false);
  }

  // ── S28: an AGENTS.md of its own is opened, never written ──
  {
    const fs = new FakeFs('/work', root).put(path.join(root, 'agents.md'), '# Ours\n');
    const result = await createAboutFile(fs, root);
    assert.deepEqual(result, { ok: true, path: path.join(root, 'agents.md'), created: false, wroteClaude: false });
    assert.deepEqual(fs.writes, []);
    assert.equal(fs.text(path.join(root, 'agents.md')), '# Ours\n');
  }

  // ── S44: the person's own CLAUDE.md is left byte for byte; the note shows ──
  {
    const own = '# How we work\r\nAlways answer in Estonian.\r\n';
    const fs = new FakeFs('/work', root).put(claude, own);
    const result = await createAboutFile(fs, root);
    assert.deepEqual(result, { ok: true, path: agents, created: true, wroteClaude: false });
    assert.equal(fs.text(claude), own);
    const state = await readAboutState(fs, root);
    assert.equal(state.claude, 'own');
    assert.equal(needsNote(state), true);
    // Not now writes nothing (it is the page's choice; there is nothing to call).
    // Add the line: first, in the file's own line endings, every other byte kept.
    assert.deepEqual(await addPointerLine(fs, root), { ok: true, changed: true });
    assert.equal(fs.text(claude), `@AGENTS.md\r\n${own}`);
    assert.equal((await readAboutState(fs, root)).claude, 'with-line');
    // Again: nothing more is written.
    const writes = fs.writes.length;
    assert.deepEqual(await addPointerLine(fs, root), { ok: true, changed: false });
    assert.equal(fs.writes.length, writes);
  }

  // ── Add the line keeps a byte-order mark first ──
  {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Notes\n')]);
    const fs = new FakeFs('/work', root).put(claude, bom);
    assert.deepEqual(await addPointerLine(fs, root), { ok: true, changed: true });
    const bytes = fs.files.get(claude)!;
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(new TextDecoder().decode(bytes.subarray(3)), '@AGENTS.md\nNotes\n');
  }

  // ── A CLAUDE.md that went meanwhile; a folder that can't be written ──
  {
    const fs = new FakeFs('/work', root);
    const gone = await addPointerLine(fs, root);
    assert.ok(!gone.ok && gone.reason === 'missing');
    fs.readOnly.add(root);
    const refused = await createAboutFile(fs, root);
    assert.ok(!refused.ok && refused.reason === 'not-writable' && /can’t be written/.test(refused.message));
    fs.put(claude, 'Mine\n');
    const line = await addPointerLine(fs, root);
    assert.ok(!line.ok && line.reason === 'not-writable');
    assert.equal(fs.text(claude), 'Mine\n');
  }

  // ── R13: a folder that has gone is not made again ──
  {
    const fs = new FakeFs('/work');
    const result = await createAboutFile(fs, root);
    assert.ok(!result.ok && result.reason === 'gone');
    assert.equal(fs.files.size, 0);
  }

  console.log('projects/aboutFile: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
