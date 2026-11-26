import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { makeTempDir } from '../testing/tempDir';
import { MAX_CACHE_BYTES, MAX_PDF_BYTES, QuickLookCache, quickLookRoot, sha256, sourceIdentity } from './quickLookCache';

function fixture(cacheLimit?: number) {
  const home = makeTempDir('quick-look-');
  const root = quickLookRoot('ai.productory.ritemark', home);
  const cache = new QuickLookCache(root, cacheLimit);
  function deck(name: string) {
    const file = path.join(home, name + '.rtms');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, name);
    return file;
  }
  const publish = (file: string, pdf = Buffer.from('%PDF'), current = async () => true, window = cache, owner?: string) =>
    window.publish(file, pdf, { slides: 1, sourceSha256: sha256(fs.readFileSync(file)), inputs: sha256('inputs'), owner, appVersion: '2.4.0' }, current);
  const folder = (file: string) => path.join(root, sourceIdentity(file).key);
  return { cache, deck, publish, folder, home, root };
}

test('v1 location, native realpath and NFC key by UTF-8 bytes', async () => {
  const { cache, deck, folder, home, root, publish } = fixture();
  const file = deck('cafe\u0301');
  const alias = path.join(home, 'alias.rtms');
  fs.symlinkSync(file, alias);
  assert.equal(root, path.join(home, 'Library/Caches/ai.productory.ritemark/quicklook/v1'));
  assert.throws(() => quickLookRoot('../elsewhere', home));
  const identity = sourceIdentity(alias);
  assert.equal(identity.source, fs.realpathSync.native(file).normalize('NFC'));
  assert.equal(identity.key, sha256(Buffer.from(identity.source, 'utf8')));
  assert.equal(identity.key, sourceIdentity(file).key);
  assert.equal(await publish(alias), true);
  assert.equal((await cache.read(file))?.source, identity.source);
  const pdf = path.join(folder(file), 'slides.pdf');
  fs.rmSync(pdf);
  fs.symlinkSync(file, pdf);
  assert.equal(await cache.read(file), undefined);
});

test('two windows serialize writes and readers reject an interrupted pair', async () => {
  const { cache, deck, folder, publish, root } = fixture();
  const file = deck('shared');
  const second = new QuickLookCache(root);
  const observed: string[] = [];
  await publish(file);
  const names = folder(file);
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    observed.push(path.basename(to.toString()));
    assert.match(path.basename(from.toString()), /^\.tmp-\d+-[a-f\d-]+$/);
    if (path.basename(to.toString()) === 'entry.json') throw new Error('interrupted');
    rename(from, to);
  };
  try {
    await assert.rejects(publish(file, Buffer.from('%PDF interrupted')), /interrupted/);
  } finally {
    fs.renameSync = rename;
  }
  assert.deepEqual(observed, ['slides.pdf', 'entry.json']);
  assert.deepEqual(fs.readdirSync(names).sort(), ['entry.json', 'slides.pdf']);
  assert.equal(await cache.read(file), undefined);

  let entered!: () => void;
  let release!: () => void;
  const inside = new Promise<void>(resolve => { entered = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const first = publish(file, Buffer.from('%PDF first'), async () => {
    entered();
    await blocked;
    return true;
  });
  await inside;
  let secondEntered = false;
  const next = publish(file, Buffer.from('%PDF second'), async () => { secondEntered = true; return true; }, second);
  try {
    await sleep(50);
    assert.equal(secondEntered, false);
    const lock = path.join(root, '.lock');
    fs.utimesSync(lock, new Date(0), new Date(0)); // an old lock with a live PID still holds
    await sleep(50);
    assert.equal(secondEntered, false);
  } finally {
    release();
  }
  assert.deepEqual(await Promise.all([first, next]), [true, true]);
  assert.equal((await cache.read(file))?.pdfSha256, sha256('%PDF second'));
  const lock = path.join(root, '.lock');
  fs.writeFileSync(lock, '2147483647 exited');
  fs.utimesSync(lock, new Date(0), new Date(0));
  assert.equal(await publish(file), true);
});

test('publication rechecks exact source bytes just before both renames', async () => {
  const { cache, deck, publish, root } = fixture();
  const file = deck('old');
  assert.equal(await publish(file, undefined, async () => {
    fs.writeFileSync(file, 'new'); // same size
    return true;
  }), false);
  assert.equal(await cache.read(file), undefined);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('prunes missing sources first and then the oldest, with bounded PDF and cache sizes', async () => {
  const { cache, deck, folder, publish } = fixture(2500);
  const old = deck('old');
  const newer = deck('newer');
  const gone = deck('gone');
  const next = deck('next');
  const pdf = Buffer.alloc(350);
  for (const [index, file] of [old, newer, gone].entries()) {
    assert.equal(await publish(file, pdf), true);
    const json = path.join(folder(file), 'entry.json');
    const entry = JSON.parse(fs.readFileSync(json, 'utf8'));
    fs.writeFileSync(json, JSON.stringify({ ...entry, drawnAt: new Date(index * 1000).toISOString() }));
  }
  fs.unlinkSync(gone);
  assert.equal(await publish(next, pdf), true);
  assert.ok(await cache.read(old));
  assert.ok(await cache.read(newer));
  assert.ok(await cache.read(next));
  assert.equal(fs.existsSync(path.join(cache.root, sha256(gone.normalize('NFC')))), false);
  const latest = deck('latest');
  assert.equal(await publish(latest, pdf), true);
  assert.equal(await cache.read(old), undefined);
  assert.ok(await cache.read(newer));
  assert.equal(MAX_CACHE_BYTES, 500 * 1024 * 1024);
  assert.equal(MAX_PDF_BYTES, 50 * 1024 * 1024);
  const large = fixture();
  const big = large.deck('big');
  assert.equal(await large.publish(big, Buffer.alloc(MAX_PDF_BYTES + 1)), false);
  assert.equal(fs.existsSync(large.root), false);
});

test('startup purges removed project owners by list key', async () => {
  const { cache, deck, publish } = fixture();
  const removed = deck('project/removed');
  const nested = deck('project/nested/kept');
  const neighbor = deck('project-2/other');
  await publish(removed, undefined, undefined, cache, 'file:///project-alias');
  await publish(nested, undefined, undefined, cache, 'file:///nested-alias');
  await publish(neighbor);
  await cache.purgeUnlisted(async () => new Set(['file:///nested-alias']));
  assert.equal(await cache.read(removed), undefined);
  assert.ok(await cache.read(nested));
  assert.ok(await cache.read(neighbor));
});

test('old malformed locks and locks from a reused PID are reclaimed', async () => {
  const { deck, publish, root } = fixture();
  const window = new QuickLookCache(root, undefined, undefined, async () => 'Thu Jan  1 00:00:00 2026');
  const file = deck('stale lock');
  await publish(file);
  const lock = path.join(root, '.lock');
  for (const record of ['malformed', `${process.pid} 00000000-0000-0000-0000-000000000000 Wed Jan  1 00:00:00 2020`]) {
    fs.writeFileSync(lock, record);
    fs.utimesSync(lock, new Date(0), new Date(0));
    assert.equal(await publish(file, undefined, undefined, window), true);
  }
});

test('publication cleanup leaves a swapped entry symlink and its target untouched', async () => {
  const { deck, folder, home, publish } = fixture();
  const file = deck('swap');
  const entry = folder(file);
  const outside = path.join(home, 'outside');
  fs.mkdirSync(outside);
  assert.equal(await publish(file, undefined, async () => {
    fs.renameSync(entry, entry + '-displaced');
    for (const name of fs.readdirSync(entry + '-displaced')) fs.writeFileSync(path.join(outside, name), 'sentinel');
    fs.symlinkSync(outside, entry);
    return true;
  }), false);
  assert.ok(fs.lstatSync(entry).isSymbolicLink());
  assert.deepEqual(fs.readdirSync(outside).map(name => fs.readFileSync(path.join(outside, name), 'utf8')),
    ['sentinel', 'sentinel']);
});

test('folder removal clears missing descendants and retains replacements and siblings', async () => {
  const { cache, deck, folder, home, publish } = fixture();
  const gone = deck('folder/nested/gone');
  const replaced = deck('folder/replaced');
  const sibling = deck('folder-other/sibling');
  const goneEntry = folder(gone);
  for (const file of [gone, replaced, sibling]) assert.equal(await publish(file), true);
  fs.unlinkSync(gone);
  await cache.removeMissingUnder(path.join(fs.realpathSync.native(home), 'folder'));
  assert.equal(fs.existsSync(goneEntry), false);
  assert.ok(await cache.read(replaced));
  assert.ok(await cache.read(sibling));
});
