/**
 * Sprint 148 (decision 3): the copies of Word and PDF text, and that a copy goes
 * with its file (Codex's review of #628).
 * Run: npx tsx src/search/worker/textCache.test.ts
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TextCache, type CachedText } from './textCache';

const text = (words: string): CachedText => ({ kind: 'text', passages: [{ text: words, at: { page: 1 } }], truncated: false });

async function main() {
  const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'search-cache-'));
  const dir = path.join(base, 'search', 'v1');
  try {
    let clock = 1000;
    const cache = new TextCache(dir, 10_000, undefined, () => clock++);
    await cache.open();
    assert.equal(await cache.get('/p/a.pdf', 10, 1), null);
    await cache.put('/p/a.pdf', 10, 1, text('alpha'));
    await cache.put('/p/b.docx', 20, 2, { kind: 'name-only', reason: 'protected' });
    assert.deepEqual(await cache.get('/p/a.pdf', 10, 1), text('alpha'), 'size and change time match');
    assert.equal(await cache.get('/p/a.pdf', 11, 1), null, 'another size');
    assert.equal(await cache.get('/p/a.pdf', 10, 9), null, 'another change time');
    assert.deepEqual(await cache.get('/p/b.docx', 20, 2), { kind: 'name-only', reason: 'protected' }, 'a refusal is kept too: no PDF is read again');
    await cache.flush();

    // A restart reads the copies back.
    const restarted = new TextCache(dir, 10_000);
    await restarted.open();
    assert.equal(restarted.entries, 2);
    assert.deepEqual(await restarted.get('/p/a.pdf', 10, 1), text('alpha'));

    // A deleted document's copy goes at once.
    await restarted.delete('/p/a.pdf');
    assert.equal(await restarted.get('/p/a.pdf', 10, 1), null);
    assert.equal((await fsp.readdir(dir)).filter((name) => name !== 'index.json').length, 1);

    // A rename: the old path's copy goes; the new one is written when read again.
    await restarted.put('/p/old.pdf', 5, 5, text('moved'));
    await restarted.delete('/p/old.pdf');
    await restarted.put('/p/new.pdf', 5, 5, text('moved'));
    assert.equal(await restarted.get('/p/old.pdf', 5, 5), null);
    assert.deepEqual(await restarted.get('/p/new.pdf', 5, 5), text('moved'));

    // A folder deleted: every copy inside it.
    await restarted.put(path.join('/p', 'sub', 'x.pdf'), 1, 1, text('x'));
    await restarted.deleteUnder(path.join('/p', 'sub'));
    assert.equal(await restarted.get(path.join('/p', 'sub', 'x.pdf'), 1, 1), null);
    await restarted.flush();

    // The start sweep drops an orphan (deleted while Ritemark was closed), and a copy the index doesn't know.
    await fsp.writeFile(path.join(dir, `${'f'.repeat(40)}.json`), '{}');
    await fsp.writeFile(path.join(dir, 'not-ours.txt'), 'keep');
    const next = new TextCache(dir, 10_000);
    await next.open();
    const dropped = await next.sweep(new Set(['/p/new.pdf']));
    assert.equal(dropped, 1, 'b.docx is gone from the project');
    assert.equal(next.entries, 1);
    const names = await fsp.readdir(dir);
    assert.ok(!names.includes(`${'f'.repeat(40)}.json`), 'an unknown copy goes');
    assert.ok(names.includes('not-ours.txt'), 'a file the cache didn\'t write stays');

    // Past the cap, the oldest copies go.
    const small = new TextCache(path.join(base, 'small'), 200, undefined, () => clock++);
    await small.open();
    await small.put('/p/1.pdf', 1, 1, text('one '.repeat(10)));
    await small.put('/p/2.pdf', 1, 1, text('two '.repeat(10)));
    await small.put('/p/3.pdf', 1, 1, text('three '.repeat(10)));
    assert.ok(small.bytes <= 200);
    assert.equal(await small.get('/p/1.pdf', 1, 1), null, 'the oldest went');
    assert.ok(await small.get('/p/3.pdf', 1, 1));

    // Another readers' version drops every copy.
    await next.flush();
    const newer = new TextCache(dir, 10_000, undefined, Date.now, 999);
    await newer.open();
    assert.equal(newer.entries, 0);
    assert.deepEqual((await fsp.readdir(dir)).sort(), ['not-ours.txt']);

    // Without a project storage folder there is no cache, and nothing fails.
    const none = new TextCache(null, 10_000);
    await none.open();
    await none.put('/p/a.pdf', 1, 1, text('a'));
    assert.equal(await none.get('/p/a.pdf', 1, 1), null);
  } finally {
    await fsp.rm(base, { recursive: true, force: true });
  }
  console.log('textCache.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
