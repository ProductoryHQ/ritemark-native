import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { makeTempDir } from '../testing/tempDir';
import { PublishController } from './PublishController';
import { gatherPage } from './gather';
import { GitCheckError } from './gitIgnore';
import { PNG } from './testing/pictures';
import { PublishError, readVerifiedUpload, type PublishHost, type VerifiedUpload } from './host';
import { PublishRecordStore, recordFor } from './publishRecords';
import { MAX_FILES, MAX_FILE_BYTES } from './types';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const syntheticKey = ['sk', 'ant', 'A1'.repeat(14)].join('-');
const png = PNG;
// A tEXt chunk with dummy local metadata. The cleaner removes the complete chunk.
const metadata = Buffer.from('0000000b744558744e6f7465004c6f63616c2100000000', 'hex');
const withMetadata = Buffer.concat([png.subarray(0, 33), metadata, png.subarray(33)]);

async function main() {
  const root = await fs.realpath(makeTempDir('ritemark-live-update-'));
  const folder = path.join(root, 'deck');
  await fs.mkdir(folder);
  const page = { realPath: path.join(folder, 'deck.html'), projectFolder: root };
  const records = new PublishRecordStore(path.join(root, 'storage'));
  const site = { accountId: 'account', siteName: 'deck-test', address: 'https://deck.test.workers.dev/' };
  const sent: VerifiedUpload[] = [];
  let connected = true;
  let offline = false;
  let signingOut = false;
  let gitFails = false;
  let virtualFiles = false;
  let beforeVerification: (() => Promise<void>) | undefined;
  const surprise = () => { throw new Error('Live must be quiet'); };
  const host = {
    accountId: () => connected ? site.accountId : null,
    snapshot: () => ({ state: connected ? 'connected' : 'disconnected', accountName: null, subdomain: null }),
    publish: async (_name: string, upload: VerifiedUpload) => {
      if (signingOut) throw new PublishError('refused', 'Connect again.');
      if (offline) throw new PublishError('unreachable', 'Connection unavailable.');
      sent.push(upload);
      return { name: site.siteName, address: site.address };
    },
    unpublish: async () => {},
    refreshSubdomain: async () => 'test',
    disconnect: async () => { connected = false; },
  } as unknown as PublishHost & { accountId(): string | null };
  const virtual = (file: string) => /^file-\d+\.woff2$/.test(path.basename(file));
  const gather = () => gatherPage(page.realPath, root, {
    ...(gitFails && { gitIgnored: async () => { throw new GitCheckError(); } }),
    ...(virtualFiles && {
      gitIgnored: async () => ({ ignored: new Set<string>(), unchecked: new Set<string>() }),
      realpath: (file: string) => virtual(file) ? Promise.resolve(file) : fs.realpath(file),
      stat: (file: string) => virtual(file) ? Promise.resolve({ isFile: () => true, size: 1 }) : fs.stat(file),
      readFile: (file: string) => virtual(file) ? Promise.resolve(Buffer.from([0])) : fs.readFile(file),
    }),
  });
  const makeController = () => {
    const controller = new PublishController({
      host, records, gather, isFeatureEnabled: () => true, setReady: () => {}, postSettings: () => {},
      ui: { openExternal: surprise, askToken: surprise, showSheet: surprise, showFailure: surprise, showWaiting: surprise, showBrief: surprise, showConnect: surprise },
      readUpload: async plan => {
        await beforeVerification?.();
        return readVerifiedUpload(plan);
      },
      log: () => {},
    });
    controller.setPublishEntryAvailable(true);
    return controller;
  };
  const initial = '<main>Before</main>';
  await fs.writeFile(page.realPath, initial);
  await records.put(recordFor(await gather(), site));
  let controller = makeController();
  assert.equal((await controller.recordFor(page.realPath))?.live, undefined);
  assert.equal(sent.length, 0, 'controller startup never deploys');
  await assert.rejects(controller.publishPage({ plan: await gather(), consent: 'live-update' }));
  assert.equal(await controller.setLive(page.realPath, true), true);

  const update = async (html: string, resume = false, digest = sha(html)) => {
    await fs.writeFile(page.realPath, html);
    const preference = (await controller.recordFor(page.realPath))?.live;
    assert.ok(preference);
    const release = controller.holdPage(page.realPath);
    assert.ok(release);
    try {
      return await controller.updateLive(page, { preference, resume, active: () => true, digest, pageSha: sha(html) });
    } finally {
      release();
    }
  };

  assert.equal((await update(initial)).kind, 'unchanged');
  const secret = '<main>' + syntheticKey + '</main>';
  const key = await update(secret);
  assert.equal(key.kind === 'paused' && key.pause.kind, 'key');
  assert.equal(await controller.hasLiveKey(page, secret), true);
  assert.equal(await controller.hasLiveKey(page, '<main>Edited safely</main>'), false);
  assert.equal((await update(secret, true)).kind, 'paused', 'Go on refuses a key still in the deck');
  assert.equal(sent.length, 0);
  const storage = JSON.stringify(await records.list());
  assert.equal(storage.includes(syntheticKey), false);
  controller = makeController();
  assert.equal(sent.length, 0, 'restarting with persisted consent and a pause still sends nothing');
  assert.equal((await update('<main>Edited safely</main>')).kind, 'stopped', 'a clean save cannot end the pause');
  assert.equal((await update('<main>Edited safely</main>', true)).kind, 'updated');

  const inside = path.join(folder, 'picture.png');
  const parent = path.join(root, 'parent.png');
  await fs.writeFile(parent, png);
  await fs.symlink(parent, inside, 'file');
  const img = '<img src="picture.png">';
  const outside = await update(img);
  assert.equal(outside.kind === 'paused' && outside.pause.kind, 'outside');
  assert.equal(sent.length, 1);
  await fs.unlink(inside);
  await fs.writeFile(inside, withMetadata);
  const fixed = await update(img, true);
  assert.deepEqual(fixed, { kind: 'updated', pictures: ['picture.png'] });
  assert.deepEqual(Buffer.from(sent.at(-1)!.files.find(file => file.urlPath === '/picture.png')!.bytes), png);
  assert.deepEqual(await fs.readFile(inside), withMetadata, 'the local picture is untouched');

  const escaped = await update('<img src="../../outside.png">');
  assert.equal(escaped.kind === 'paused' && escaped.pause.kind, 'outside');
  assert.equal((await update('<img src="../../outside.png">', true)).kind, 'paused', 'Go on never sends outside the project');
  assert.equal((await update(img, true)).kind, 'unchanged');

  await fs.truncate(inside, MAX_FILE_BYTES + 1);
  const over = await update(img);
  assert.equal(over.kind === 'paused' && over.pause.kind, 'limits');
  assert.equal((await update(img, true)).kind, 'paused', 'Go on still respects the host limit');
  await fs.writeFile(inside, png);
  assert.equal((await update(img, true)).kind, 'unchanged');

  virtualFiles = true;
  const many = Array.from({ length: MAX_FILES }, (_, i) => `<object data="file-${i}.woff2"></object>`).join('');
  const fileCount = await update(many);
  assert.equal(fileCount.kind === 'paused' && fileCount.pause.kind, 'limits');
  virtualFiles = false;
  assert.equal((await update(img, true)).kind, 'unchanged');

  await fs.writeFile(inside, 'unsupported image');
  const picture = await update(img);
  assert.equal(picture.kind === 'paused' && picture.pause.kind, 'picture');
  await fs.writeFile(inside, png);
  assert.equal((await update(img, true)).kind, 'unchanged');

  const sibling = '<img src="../parent.png">';
  const siblingPause = await update(sibling);
  assert.equal(siblingPause.kind === 'paused' && siblingPause.pause.kind, 'outside');
  await fs.writeFile(path.join(root, 'second.png'), png);
  const secondSibling = '<img src="../second.png">';
  assert.equal((await update(secondSibling, true)).kind, 'paused', 'Go on does not accept a different outside file');
  assert.equal((await update(secondSibling, true)).kind, 'updated', 'Go on can accept the named file inside the project');

  gitFails = true;
  const unchecked = await update(img);
  assert.equal(unchecked.kind === 'paused' && unchecked.pause.kind, 'unchecked');
  gitFails = false;
  assert.equal((await update(img, true)).kind, 'updated');

  offline = true;
  assert.equal((await update('<main>Saved offline</main>')).kind, 'offline');
  offline = false;
  assert.equal((await update('<main>Saved offline</main>')).kind, 'updated');

  signingOut = true;
  const refused = await update('<main>Saved signed out</main>');
  assert.equal(refused.kind === 'paused' && refused.pause.kind, 'connection');
  signingOut = false;
  assert.equal((await update('<main>Saved signed out</main>')).kind, 'stopped');
  assert.equal((await update('<main>Saved signed out</main>', true)).kind, 'updated');
  const publicDigest = sha('Same public deck');
  const markedHtml = '<meta name="generator" content="Ritemark"><meta name="ritemark-deck" content="' + publicDigest + '">';
  assert.equal((await update(markedHtml + '<main>Public deck</main>', false, publicDigest)).kind, 'updated');
  const beforeMinutes = sent.length;
  assert.equal((await update(markedHtml + '<main>Public deck</main><!-- fit differs -->', false, publicDigest)).kind, 'unchanged');
  assert.equal(sent.length, beforeMinutes);
  let enteredVerify!: () => void;
  let releaseVerify!: () => void;
  const verificationStarted = new Promise<void>(resolve => { enteredVerify = resolve; });
  const resumeVerify = new Promise<void>(resolve => { releaseVerify = resolve; });
  beforeVerification = async () => { enteredVerify(); await resumeVerify; };
  const beforeOff = sent.length;
  const turningOff = update('<main>Switch turned off during verification</main>');
  await verificationStarted;
  assert.equal(await controller.setLive(page.realPath, false), true);
  releaseVerify();
  assert.equal((await turningOff).kind, 'stopped');
  assert.equal(sent.length, beforeOff);
  beforeVerification = undefined;
  assert.equal(await controller.setLive(page.realPath, true), true);

  await controller.disconnect();
  assert.equal((await controller.recordFor(page.realPath))?.live?.pause?.kind, 'connection');
  connected = true;
  await controller.unpublishPage(page.realPath);
  assert.equal(await controller.recordFor(page.realPath), undefined);
  await records.put(recordFor(await gather(), site));
  assert.equal((await controller.recordFor(page.realPath))?.live, undefined);
  console.log('liveUpdate: all passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
