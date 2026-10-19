/**
 * Sprint 134 (R2, R13, S5–S7, S38, S43): the project list.
 * Run: npx tsx src/projects/ProjectList.test.ts
 */

import assert from 'node:assert/strict';
import * as path from 'path';
import { ProjectList, type ProjectListFs } from './ProjectList';

class FakeFs implements ProjectListFs {
  readonly files = new Map<string, string>();
  writes = 0;
  async readFile(target: string): Promise<string> {
    const text = this.files.get(target);
    if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return text;
  }
  async writeFile(target: string, data: string): Promise<void> {
    this.writes += 1;
    this.files.set(target, data);
  }
  async rename(from: string, to: string): Promise<void> {
    const text = this.files.get(from);
    if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    this.files.delete(from);
    this.files.set(to, text);
  }
  async mkdir(): Promise<void> {}
}

const file = ProjectList.fileFor('/gs');
const LP = 'file:///Users/a/Documents/Leadership%20programme';
const SP = 'file:///Users/a/Documents/Sales%20proposal%20Q4';
const BR = 'file:///Users/a/Documents/Board%20report%202026';

function clock(): { now: () => Date; tick: (minutes: number) => void } {
  let at = Date.parse('2026-10-19T09:00:00.000Z');
  return { now: () => new Date(at), tick: (minutes) => { at += minutes * 60_000; } };
}

async function main(): Promise<void> {
  assert.equal(file, path.join('/gs', 'projects', 'v1', 'list.json'));

  // ── S6: opened, first; opening again moves it first, no duplicate ──
  {
    const fs = new FakeFs();
    const time = clock();
    const list = new ProjectList(file, fs, { now: time.now, randomId: () => 'x' });
    let changes = 0;
    list.onDidChange(() => { changes += 1; });
    await list.opened(LP);
    time.tick(1);
    await list.opened(SP);
    assert.deepEqual((await list.entries()).map((entry) => entry.folderUri), [SP, LP]);
    time.tick(1);
    await list.opened(`${LP}/`);
    assert.deepEqual((await list.entries()).map((entry) => entry.folderUri), [LP, SP], 'a trailing slash is the same project');
    assert.equal(changes, 3);
    // The open one first, whatever the order.
    assert.deepEqual((await list.entries(SP)).map((entry) => entry.folderUri), [SP, LP]);
    assert.ok(![...fs.files.keys()].some((name) => name.includes('.tmp-')));
  }

  // ── S5: the first fill adds new projects and leaves listed ones alone ──
  {
    const fs = new FakeFs();
    const time = clock();
    const list = new ProjectList(file, fs, { now: time.now });
    await list.opened(LP);
    const before = (await list.entries())[0];
    await list.addFound([
      { folderUri: LP, lastOpenedAt: '2020-01-01T00:00:00.000Z', foundBy: 'recent' },
      { folderUri: SP, lastOpenedAt: '2026-10-18T09:00:00.000Z', foundBy: 'chats' },
      { folderUri: BR, lastOpenedAt: '2026-10-17T09:00:00.000Z', foundBy: 'recent' },
    ]);
    const entries = await list.entries();
    assert.deepEqual(entries.map((entry) => [entry.folderUri, entry.foundBy]), [[LP, 'opened'], [SP, 'chats'], [BR, 'recent']]);
    assert.deepEqual(entries[0], before);
    const writes = fs.writes;
    await list.addFound([{ folderUri: SP, lastOpenedAt: '2026-10-18T09:00:00.000Z', foundBy: 'recent' }]);
    assert.equal(fs.writes, writes, 'nothing new: nothing written');
  }

  // ── S7: removing touches nothing else; opening adds it back ──
  {
    const fs = new FakeFs();
    const list = new ProjectList(file, fs);
    await list.opened(LP);
    await list.opened(BR);
    await list.remove(BR);
    assert.deepEqual((await list.entries()).map((entry) => entry.folderUri), [LP]);
    await list.opened(BR);
    assert.equal((await list.entries()).length, 2);
  }

  // ── S38, R13: a folder not found stays, marked; found again, unmarked; unknown, kept as it was ──
  {
    const fs = new FakeFs();
    const time = clock();
    const list = new ProjectList(file, fs, { now: time.now });
    await list.opened(LP);
    await list.opened(SP);
    await list.opened(BR);
    await list.markFound(async (uri) => (uri === SP ? false : uri === BR ? undefined : true));
    let entries = await list.entries();
    assert.equal(entries.length, 3, 'never dropped');
    assert.equal(entries.find((entry) => entry.folderUri === SP)?.missingSince, '2026-10-19T09:00:00.000Z');
    assert.equal(entries.find((entry) => entry.folderUri === BR)?.missingSince, undefined);
    time.tick(5);
    await list.markFound(async (uri) => (uri === SP ? false : uri === BR ? false : true));
    entries = await list.entries();
    assert.equal(entries.find((entry) => entry.folderUri === SP)?.missingSince, '2026-10-19T09:00:00.000Z', 'first missed stays');
    assert.ok(entries.find((entry) => entry.folderUri === BR)?.missingSince);
    await list.markFound(async () => undefined);
    assert.ok((await list.entries()).find((entry) => entry.folderUri === BR)?.missingSince, 'an unknown answer keeps it');
    // S38: Find it… moves it, and it is found.
    const moved = 'file:///Users/a/Documents/Sales%20proposal%20Q4%20(renamed)';
    assert.deepEqual(await list.relocate(SP, moved), { ok: true });
    entries = await list.entries();
    assert.equal(entries[0].folderUri, moved);
    assert.equal(entries[0].missingSince, undefined);
    // S43: another project's folder is refused, and the list is as it was.
    const snapshot = JSON.stringify(await list.entries());
    assert.deepEqual(await list.relocate(moved, LP), { ok: false, reason: 'taken' });
    assert.equal(JSON.stringify(await list.entries()), snapshot);
    assert.deepEqual(await list.relocate('file:///nowhere', LP), { ok: false, reason: 'not-listed' });
  }

  // ── Another window's change is not written over ──
  {
    const fs = new FakeFs();
    const mine = new ProjectList(file, fs);
    const theirs = new ProjectList(file, fs);
    await mine.opened(LP);
    await theirs.opened(SP);
    await mine.opened(BR);
    assert.equal((await theirs.entries()).length, 3);
  }

  // ── A file this build can't read is kept aside, never lost ──
  {
    const fs = new FakeFs();
    fs.files.set(file, JSON.stringify({ schemaVersion: 2, entries: [{ folderUri: LP, extra: true }] }));
    const list = new ProjectList(file, fs, { now: () => new Date(1_000) });
    assert.deepEqual(await list.entries(), []);
    await list.opened(SP);
    assert.ok(fs.files.get(`${file}.unreadable-1000`)?.includes('"schemaVersion":2'));
    assert.deepEqual((await list.entries()).map((entry) => entry.folderUri), [SP]);
    // Bad entries are skipped; good ones kept.
    fs.files.set(file, JSON.stringify({ schemaVersion: 1, entries: [{ folderUri: 'not a uri', addedAt: 'a', lastOpenedAt: 'b' }, { folderUri: LP, addedAt: 'a', lastOpenedAt: 'b', foundBy: 'weird' }] }));
    assert.deepEqual((await list.entries()).map((entry) => [entry.folderUri, entry.foundBy]), [[LP, 'opened']]);
  }

  console.log('projects/ProjectList: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
