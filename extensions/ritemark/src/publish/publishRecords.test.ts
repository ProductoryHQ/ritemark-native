/**
 * Tests for publishRecords.ts (Sprint 149, R8, S27, S30, S32): records in global storage, never in the project;
 * an unreadable file set aside, not overwritten; when the sheet shows again.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { changedSincePublish, PublishRecordStore, recordFor, RECORDS_FILE, RECORDS_FOLDER, sheetNeeded } from './publishRecords';
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
    assert.deepEqual(model.leftOut, [{ display: '../../secrets/scan.png', reason: 'outside' }, { display: '', reason: 'otherPage', count: 2 }]);
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
