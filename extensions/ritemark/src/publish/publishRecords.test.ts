/**
 * Tests for publishRecords.ts (Sprint 149, R8, S27, S30, S32): records in global storage, never in the project;
 * an unreadable file set aside, not overwritten; when the sheet shows again.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { changedSincePublish, type PublishRecord, PublishRecordStore, recordFor, RECORDS_FILE, RECORDS_FOLDER, sheetNeeded } from './publishRecords';
import { isSheetWebviewMessage } from './sheetProtocol';
import { sheetModelOf } from './sheetModel';
import type { PublishPlan } from './types';

function plan(files: [string, string][], extra: Partial<PublishPlan> = {}): PublishPlan {
  return {
    pagePath: '/p/Harbour programme.html',
    projectFolder: '/p',
    root: '/p',
    files: files.map(([relPath, sha256], i) => ({
      relPath, projectPath: relPath, realPath: `/p/${relPath}`, kind: i === 0 ? 'page' : 'picture', size: 1, sha256,
    })),
    leftOut: [],
    scriptBuilt: false,
    tooBig: [],
    tooMany: false,
    keyHits: [],
    contentHash: files.map((f) => f.join(':')).join('|'),
    ...extra,
  };
}

const site = { accountId: 'acc', siteName: 'harbour-programme-7f3a2c', address: 'https://harbour-programme-7f3a2c.pages-4821.workers.dev' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Codex's review of #668, finding 3: two project windows are two extension hosts, each with its own store over the one
 * `records.json` in global storage. Their writes must not drop each other's records (the last rename used to win).
 */
async function crossHostWrites(record: PublishRecord): Promise<void> {
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-records-hosts-'));
  const folder = path.join(shared, RECORDS_FOLDER);
  try {
    const a = new PublishRecordStore(shared, 'darwin');
    const b = new PublishRecordStore(shared, 'darwin');
    const page = (i: number) => ({ ...record, pagePath: `/p/w${i}.html`, siteName: `page-w${i}-7f3a2c` });

    // Two stores writing at once, on the same file: every page's record stays
    await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? a : b).put(page(i))));
    assert.equal((await a.list()).length, 24, 'two hosts publishing at once: no record lost');
    assert.equal((await b.list()).length, 24);
    await Promise.all([
      ...Array.from({ length: 8 }, (_, i) => (i % 2 ? b : a).remove(page(i).pagePath)),
      ...Array.from({ length: 8 }, (_, i) => (i % 2 ? a : b).put(page(100 + i))),
      a.markUnpublished(page(20).pagePath),
    ]);
    const after = await b.list();
    assert.equal(after.length, 24, 'removes, puts and a mark at once, from both hosts');
    assert.equal(after.find((r) => r.pagePath === page(20).pagePath)?.unpublished, true, 'the mark stayed');
    assert.deepEqual(fs.readdirSync(folder).sort(), [RECORDS_FILE], 'no lock or temporary file left');

    // The same page published from both windows at once: both Workers keep their records, the newest is the page's
    const one = { ...record, pagePath: '/p/same.html', siteName: 'same-111111', publishedAt: '2026-11-06T06:00:00.000Z' };
    const two = { ...record, pagePath: '/p/same.html', siteName: 'same-222222', publishedAt: '2026-11-06T06:00:01.000Z' };
    await Promise.all([a.put(one), b.put(two)]);
    assert.deepEqual((await a.list()).filter((r) => r.pagePath === one.pagePath).map((r) => r.siteName).sort(), ['same-111111', 'same-222222'],
      'an online Worker\'s record is never dropped by another site\'s put for the same page');
    assert.equal((await b.get(one.pagePath))?.siteName, 'same-222222', 'the bar shows the newest');
    assert.equal(await a.remove(one.pagePath, 'same-222222'), true, 'Unpublish removes that site\'s record only');
    assert.equal((await b.get(one.pagePath))?.siteName, 'same-111111', 'the other site\'s record is still there to unpublish');
    // An update (the same site) replaces; a record already marked unpublished goes when the page is published again
    await b.put({ ...one, contentHash: 'updated' });
    assert.deepEqual((await a.list()).filter((r) => r.pagePath === one.pagePath).map((r) => r.contentHash), ['updated']);
    await a.markUnpublished(one.pagePath, 'same-111111');
    await b.put({ ...two, siteName: 'same-333333' });
    assert.deepEqual((await a.list()).filter((r) => r.pagePath === one.pagePath).map((r) => r.siteName), ['same-333333']);

    // A lock left by a host that died is taken over once stale; a live host's lock is waited for, never stolen
    const lock = path.join(folder, `${RECORDS_FILE}.lock`);
    fs.writeFileSync(lock, 'dead host');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    await a.put(page(200));
    assert.ok(await b.get(page(200).pagePath), 'a stale lock doesn\'t block publishing');
    assert.equal(fs.existsSync(lock), false, 'and is gone');
    fs.writeFileSync(lock, 'live host');
    let done = false;
    const waiting = b.put(page(201)).then(() => { done = true; });
    await sleep(150);
    assert.equal(done, false, 'a fresh lock is waited for');
    assert.equal(fs.readFileSync(lock, 'utf8'), 'live host', 'and not taken');
    fs.unlinkSync(lock);
    await waiting;
    assert.ok(await a.get(page(201).pagePath));

    // Two real processes, each its own store, publishing at once
    const script = path.join(shared, 'writer.ts');
    fs.writeFileSync(script, [
      `import { PublishRecordStore } from ${JSON.stringify(path.join(__dirname, 'publishRecords'))};`,
      'const [storage, tag] = process.argv.slice(2);',
      'const store = new PublishRecordStore(storage, "darwin");',
      `const base = ${JSON.stringify(record)};`,
      'void Promise.all(Array.from({ length: 15 }, (_, i) => store.put({ ...base, pagePath: `/p/${tag}${i}.html`, siteName: `${tag}-${i}` })));',
    ].join('\n'));
    const tsx = require.resolve('tsx/cli');
    const run = (tag: string) => new Promise<number>((resolve) => {
      execFile(process.execPath, [tsx, script, shared, tag], (error) => resolve(error ? 1 : 0));
    });
    assert.deepEqual(await Promise.all([run('x'), run('y')]), [0, 0]);
    const both = await a.list();
    for (const tag of ['x', 'y']) {
      assert.equal(both.filter((r) => r.siteName.startsWith(`${tag}-`)).length, 15, `two processes at once: all of ${tag}'s records`);
    }
    console.log('publishRecords.test: two hosts on one file passed');
  } finally {
    fs.rmSync(shared, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-records-'));
  try {
    const store = new PublishRecordStore(storage, 'darwin');
    assert.deepEqual(await store.list(), []);

    const first = plan([['Harbour programme.html', 'a'], ['img/a.png', 'b']]);
    const record = recordFor(first, site, new Date('2026-11-05T20:00:00Z'));
    await store.put(record);
    assert.ok(fs.existsSync(path.join(storage, RECORDS_FOLDER, RECORDS_FILE)), 'R8: in global storage, publish/v1/');
    assert.deepEqual(await store.get(first.pagePath), record);
    assert.equal(await store.get('/p/renamed.html'), undefined, 'S30: a renamed file has no record, so it shows Publish');
    assert.equal((await store.list()).length, 1, 'S30: the old page stays listed for Unpublish');
    assert.ok(!JSON.stringify(record).toLowerCase().includes('token'), 'no token field');

    // Parallel puts don't lose each other
    await Promise.all(['x', 'y', 'z'].map((n) => store.put({ ...record, pagePath: `/p/${n}.html` })));
    assert.equal((await store.list()).length, 4);
    assert.equal(await store.remove('/p/x.html'), true);
    assert.equal(await store.remove('/p/x.html'), false);
    assert.equal((await store.list()).length, 3);

    await crossHostWrites(record);

    // Windows keys ignore case
    const win = new PublishRecordStore(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-records-win-')), 'win32');
    await win.put({ ...record, pagePath: 'C:\\Proj\\Page.html' });
    assert.ok(await win.get('c:\\proj\\page.html'));

    // An unreadable file is set aside, never overwritten
    const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-records-broken-'));
    fs.mkdirSync(path.join(broken, RECORDS_FOLDER), { recursive: true });
    fs.writeFileSync(path.join(broken, RECORDS_FOLDER, RECORDS_FILE), '{ not json');
    const brokenStore = new PublishRecordStore(broken, 'darwin');
    assert.deepEqual(await brokenStore.list(), []);
    const kept = fs.readdirSync(path.join(broken, RECORDS_FOLDER)).filter((f) => f.includes('unreadable'));
    assert.equal(kept.length, 1, 'the unreadable file is kept beside');

    // When the sheet shows again (R5, S27) and "changed" (R7)
    assert.equal(sheetNeeded(undefined, first), true, 'the first publish always shows it');
    assert.equal(sheetNeeded(record, first), false, 'the same files: Update goes straight up');
    const edited = plan([['Harbour programme.html', 'a2'], ['img/a.png', 'b']]);
    assert.equal(sheetNeeded(record, edited), false, 'changed bytes, same files: no sheet');
    assert.equal(changedSincePublish(record, edited), true, '"Published · changed"');
    assert.equal(changedSincePublish(record, first), false);
    assert.equal(sheetNeeded(record, plan([['Harbour programme.html', 'a'], ['img/a.png', 'b'], ['img/new.png', 'c']])), true, 'S27: a new picture shows the sheet');
    assert.equal(sheetNeeded(record, plan([['Harbour programme.html', 'a']])), true, 'a file no longer used shows it');
    assert.equal(sheetNeeded(record, { ...first, keyHits: [{ projectPath: 'x.js', realPath: '/p/x.js', line: 1, rule: 'jwt' }] }), true, 'R4: a key-shaped hit always shows it');

    // The sheet's model: names and folders, the page first, other pages folded, no paths beyond the project
    const model = sheetModelOf({
      ...plan([['Harbour programme.html', 'a'], ['Pictures/harbour.jpg', 'b']]),
      leftOut: [
        { display: '../../secrets/scan.png', reason: 'outside' },
        { display: 'slides/a.html', reason: 'otherPage' },
        { display: 'slides/b.html', reason: 'otherPage' },
      ],
      keyHits: [{ projectPath: 'js/script.js', realPath: '/p/js/script.js', line: 12, rule: 'anthropic' }],
    }, 'Leadership programme');
    assert.deepEqual(model.files, [
      { name: 'Harbour programme.html', folder: 'Leadership programme', kind: 'page' },
      { name: 'harbour.jpg', folder: 'Pictures', kind: 'picture' },
    ]);
    assert.equal(model.title, 'Harbour programme');
    assert.deepEqual(model.leftOut, [
      { name: 'scan.png', display: '../../secrets/scan.png', reason: 'outside' },
      { name: '', display: '', reason: 'otherPage', count: 2 },
    ], "each row starts with the file's name; the reference as written is for its tooltip (the lead's change 2)");
    const one = sheetModelOf({ ...plan([['a.html', 'a']]), leftOut: [{ display: 'slides/b.html', reason: 'otherPage' }, { display: 'C:\\Users\\me\\x.png', reason: 'outside' }] }, 'p');
    assert.deepEqual(one.leftOut.map((l) => [l.name, l.display]), [['x.png', 'C:\\Users\\me\\x.png'], ['b.html', 'slides/b.html']]);
    assert.deepEqual(model.keyHits, [{ index: 0, fileName: 'script.js', line: 12 }]);
    assert.ok(!JSON.stringify(model).includes('/p/'), 'no real path reaches the sheet');

    // The sheet's answers are checked
    assert.equal(isSheetWebviewMessage({ type: 'publish:openHit', index: 0 }), true);
    assert.equal(isSheetWebviewMessage({ type: 'publish:openHit', index: '/etc/passwd' }), false);
    assert.equal(isSheetWebviewMessage({ type: 'publish:openHit', index: -1 }), false);
    assert.equal(isSheetWebviewMessage({ type: 'publish:confirm' }), false);
    assert.equal(isSheetWebviewMessage({ type: 'publish:confirm', anyway: true }), true);
    assert.equal(isSheetWebviewMessage({ type: 'setApiKey', key: 'x' }), false);
    console.log('publishRecords.test: passed');
  } finally {
    fs.rmSync(storage, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
