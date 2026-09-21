import assert from 'node:assert/strict';
import * as path from 'path';
import type { ConversationStoreFileSystem } from '../conversations/ConversationStore';
import { GoogleDocsBindingStore } from './GoogleDocsBindingStore';
import type { GoogleDocsBindingV1 } from './types';

function memoryFs(initial: Record<string, string> = {}): ConversationStoreFileSystem & { files: Map<string, string>; failWrites: boolean } {
  const files = new Map(Object.entries(initial));
  const fs = {
    files,
    failWrites: false,
    async mkdir() {},
    async readDir(dir: string) { return [...files.keys()].filter((f) => path.dirname(f) === dir).map((f) => path.basename(f)); },
    async readFile(file: string) {
      const value = files.get(file);
      if (value === undefined) { const e = new Error('ENOENT') as NodeJS.ErrnoException; e.code = 'ENOENT'; throw e; }
      return value;
    },
    async writeFile(file: string, contents: string) {
      if (fs.failWrites) throw new Error('disk full');
      files.set(file, contents);
    },
    async rename(from: string, to: string) {
      const value = files.get(from);
      if (value === undefined) throw new Error('ENOENT');
      files.set(to, value);
      files.delete(from);
    },
    async remove(file: string) { files.delete(file); },
    async statSize(file: string) { return (files.get(file) ?? '').length; },
  };
  return fs;
}

const binding = (uri: string, fileId: string): GoogleDocsBindingV1 => ({
  schemaVersion: 1,
  documentUri: uri,
  accountId: 'acct-1',
  accountEmail: 'jarmo@productory.eu',
  fileId,
  title: 'Course outline',
  templateFileId: null,
  createdAt: '2026-09-21T10:00:00.000Z',
  lastSyncedAt: '2026-09-21T10:00:00.000Z',
  lastRevisionId: 'rev-1',
  lastSourceHash: 'hash-1',
  overwriteAcknowledged: false,
});

const BASE = '/store/google-docs/v1';
let seq = 0;
const ids = () => `id${++seq}`;

async function main(): Promise<void> {
  // ── put / get / remove, written atomically ──────────────────────────────────
  {
    const fs = memoryFs();
    const store = new GoogleDocsBindingStore(BASE, fs, ids);
    assert.equal(await store.get('file:///a.md'), null);
    await store.put(binding('file:///a.md', 'doc-a'));
    assert.equal((await store.get('file:///a.md'))?.fileId, 'doc-a');
    assert.ok(fs.files.has(`${BASE}/bindings.json`));
    assert.ok(fs.files.has(`${BASE}/bindings.last-good.json`), 'a last-good copy trails every write');
    assert.ok(![...fs.files.keys()].some((f) => f.includes('.tmp-')), 'no temporary files are left behind');

    const reopened = new GoogleDocsBindingStore(BASE, fs, ids);
    assert.equal((await reopened.get('file:///a.md'))?.fileId, 'doc-a', 'links survive a restart');

    assert.equal(await store.remove('file:///a.md'), true);
    assert.equal(await store.get('file:///a.md'), null);
    assert.equal(await store.remove('file:///a.md'), false);
  }

  // ── rename follows; a collision moves nothing ───────────────────────────────
  {
    const store = new GoogleDocsBindingStore(BASE, memoryFs(), ids);
    await store.put(binding('file:///old.md', 'doc-1'));
    assert.equal(await store.rename('file:///old.md', 'file:///new.md'), 'moved');
    assert.equal(await store.get('file:///old.md'), null);
    const moved = await store.get('file:///new.md');
    assert.equal(moved?.fileId, 'doc-1');
    assert.equal(moved?.documentUri, 'file:///new.md', 'the record is re-keyed, not just copied');

    await store.put(binding('file:///other.md', 'doc-2'));
    assert.equal(await store.rename('file:///new.md', 'file:///other.md'), 'collision');
    assert.equal((await store.get('file:///new.md'))?.fileId, 'doc-1', 'neither link is touched on a collision');
    assert.equal((await store.get('file:///other.md'))?.fileId, 'doc-2');
    assert.equal(await store.rename('file:///nobody.md', 'file:///x.md'), 'none');
  }

  // ── an unreadable file falls back to the last good copy ───────────────────
  {
    const good = JSON.stringify({ schemaVersion: 1, bindings: { 'file:///a.md': binding('file:///a.md', 'doc-a') } });
    const fs = memoryFs({ [`${BASE}/bindings.json`]: '{ not json', [`${BASE}/bindings.last-good.json`]: good });
    const store = new GoogleDocsBindingStore(BASE, fs, ids);
    assert.equal((await store.get('file:///a.md'))?.fileId, 'doc-a');
    assert.equal(store.degraded, false, 'a recovered store is not degraded');
    assert.ok([...fs.files.keys()].some((f) => f.includes('bindings.json.corrupt-')), 'the unreadable file is set aside, not deleted');
  }
  {
    const fs = memoryFs({ [`${BASE}/bindings.json`]: '{ not json' });
    const store = new GoogleDocsBindingStore(BASE, fs, ids);
    assert.equal(await store.get('file:///a.md'), null, 'with nothing readable, no target is guessed');
    assert.equal(store.degraded, true);
  }
  {
    // A record whose key and URI disagree, or that lacks a file id, is dropped on read.
    const bad = JSON.stringify({ schemaVersion: 1, bindings: {
      'file:///a.md': binding('file:///b.md', 'doc-b'),
      'file:///c.md': { ...binding('file:///c.md', ''), fileId: '' },
      'file:///d.md': binding('file:///d.md', 'doc-d'),
    } });
    const store = new GoogleDocsBindingStore(BASE, memoryFs({ [`${BASE}/bindings.json`]: bad }), ids);
    assert.equal(await store.get('file:///a.md'), null);
    assert.equal(await store.get('file:///c.md'), null);
    assert.equal((await store.get('file:///d.md'))?.fileId, 'doc-d');
  }

  // ── a failed write surfaces and leaves the stored state as it was ─────────
  {
    const fs = memoryFs();
    const store = new GoogleDocsBindingStore(BASE, fs, ids);
    await store.put(binding('file:///a.md', 'doc-a'));
    fs.failWrites = true;
    await assert.rejects(store.put(binding('file:///b.md', 'doc-b')), /disk full/);
    fs.failWrites = false;
    const reopened = new GoogleDocsBindingStore(BASE, fs, ids);
    assert.equal(await reopened.get('file:///b.md'), null, 'a link that was not written is not reported as saved');
    assert.equal((await reopened.get('file:///a.md'))?.fileId, 'doc-a');
  }

  // ── concurrent mutations are serialized ─────────────────────────────────────
  {
    const store = new GoogleDocsBindingStore(BASE, memoryFs(), ids);
    await Promise.all(Array.from({ length: 10 }, (_, i) => store.put(binding(`file:///n${i}.md`, `doc-${i}`))));
    for (let i = 0; i < 10; i++) assert.equal((await store.get(`file:///n${i}.md`))?.fileId, `doc-${i}`);
  }

  console.log('googleDocs/GoogleDocsBindingStore: all assertions passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
