import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUILT_IN_THEME } from '../decks/deckTheme';
import { buildDeckPage, pageLogoFile, pagePathFor } from '../decks/page/pageFile';
import { DECK_VERSION_META } from '../decks/page/pageFollower';
import { buildManifest, siteAddress } from './cloudflare/assets';
import { testProject } from './cloudflare/testing/pages';
import { deckVersionAssets } from './deckVersion';
import { gatherPage } from './gather';
import { sheetModelOf } from './sheetModel';
import { PublishController, type PublishControllerDeps } from './PublishController';
import { readVerifiedUpload, type VerifiedUpload } from './host';
import { PublishRecordStore, recordFor } from './publishRecords';
import { PNG } from './testing/pictures';

const oldPicture = 'images/old.png';
const newPicture = 'Kickoff files/new.png';
const font = 'fonts/Inter-4.001-latin.woff2';
const logo = pageLogoFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'), 'svg');

for (const { name, pictures, withLogo, sha256 } of [
  { name: 'a', pictures: [newPicture], withLogo: false, sha256: '66468a240a8efb220100a1a3c428d364db05e6d2882daa82534c7b1a6a5622b6' },
  { name: 'b', pictures: [oldPicture], withLogo: true, sha256: '6fd86a74f34b340236fab927a878c9d7adf9ac9d826a113e8df56c23e87a4437' },
  { name: 'c', pictures: [oldPicture, newPicture], withLogo: true, sha256: 'e1e7f5c6c2d626f6c53df94dac46c10d8d06b38b71fb474ad03d4cb9c3ff96b0' },
]) {
  test(`deck ${name} keeps its hosted URLs, bytes and Copy link`, async t => {
    const project = await testProject({});
    t.after(project.cleanup);
    for (const picture of pictures) await project.write(`Training/${picture}`, PNG);
    await project.write(`Training/${font}`, 'fixture font bytes');
    if (withLogo) await project.write(`Training/${logo.address}`, logo.bytes);
    const deckPath = project.page('Training/Kickoff.rtms');
    const text = ['---', 'deck: 2', '---', '', '```slide', '# Kickoff', '```', '', ...pictures.map(picture => `![Picture](<${picture}>)`)].join('\n');
    const theme = withLogo
      ? { ...BUILT_IN_THEME, logo: { file: 'Brand.svg', place: 'top-right' as const, on: 'every-slide' as const } }
      : BUILT_IN_THEME;
    const assets = {
      slideCss: '', fonts: [], themeFonts: [{ family: 'Inter', unicodeRange: 'U+0000-00FF', address: font }],
      logo: withLogo ? logo : null,
    };
    const page = await buildDeckPage({ deckPath, text, theme }, assets);
    const pagePath = pagePathFor(deckPath);
    await project.write('Training/Kickoff.html', page.html);
    const plan = await gatherPage(pagePath, project.dir);
    const movedPath = project.page('Training/Kickoff files/Kickoff.html');
    const local = await buildDeckPage({ deckPath, text, theme, pagePath: movedPath }, assets);
    await project.write('Training/Kickoff files/Kickoff.html', local.html);
    const assetAddresses = [font, ...(withLogo ? [logo.address] : [])];
    for (const asset of assetAddresses) {
      await project.write(`Training/Kickoff files/${asset}`, await fs.readFile(project.page(`Training/${asset}`)));
    }
    for (const picture of pictures) {
      const address = picture === oldPicture ? '../images/old.png' : 'new.png';
      assert.ok(local.html.includes(`src="${address}"`));
      assert.equal(fileURLToPath(new URL(address, pathToFileURL(movedPath))), project.page(`Training/${picture}`));
    }
    assert.ok(local.html.includes(`url(${font})`));
    if (withLogo) assert.ok(local.html.includes(`src="${logo.address}"`));
    const movedPlan = await gatherPage(movedPath, project.dir, { hostedDeck: { besideDeckPath: pagePath, html: page.html, assetAddresses } });
    // Editing the preview after the scan cannot substitute its bytes for the hosted page.
    await fs.writeFile(movedPath, '<p>Someone edited the preview.</p>');
    const upload = await readVerifiedUpload(movedPlan);
    assert.deepEqual(upload, await readVerifiedUpload(plan));
    const stamped = deckVersionAssets(upload, 1000);
    assert.ok(stamped);
    const expected = ['/index.html', ...(withLogo ? [`/${logo.address}`] : []), ...pictures.map(picture => `/${picture}`), `/${font}`];
    assert.deepEqual(Object.keys(buildManifest(stamped).manifest), [...expected, '/version.json']);
    const siteName = 'kickoff-123abc';
    const address = siteAddress(siteName, 'training', upload.pageUrlPath);
    const records = new PublishRecordStore(project.page('storage'));
    await records.put(recordFor(movedPlan, { accountId: 'a'.repeat(32), siteName, address }));
    assert.equal((await records.get(movedPath))?.address, 'https://kickoff-123abc.training.workers.dev/');
    const html = Buffer.from(upload.files[0].bytes).toString('utf8');
    assert.equal(Buffer.from(stamped[0].bytes).toString('utf8'),
      html.replace(`name="${DECK_VERSION_META}" content="0"`, `name="${DECK_VERSION_META}" content="1000"`));
    for (const picture of pictures) assert.ok(html.includes(`src="${picture.replaceAll(' ', '%20')}"`));
    assert.ok(html.includes(`url(${font})`));
    if (withLogo) assert.ok(html.includes(`src="${logo.address}"`));
    assert.equal(createHash('sha256').update(html).digest('hex'), sha256);
  });
}

test('Git excludes the moved font while allowing the same font beside the deck', async t => {
  const project = await testProject({});
  t.after(project.cleanup);
  execFileSync('git', ['init', '-q'], { cwd: project.dir });
  await project.write('.gitignore', '/Kickoff files/fonts/\n');
  const html = `<style>@font-face { font-family: Inter; src: url(${font}) }</style>`;
  for (const folder of ['', 'Kickoff files/']) {
    await project.write(`${folder}Kickoff.html`, html);
    await project.write(`${folder}${font}`, 'same font bytes');
  }
  const oldPlan = await gatherPage(project.page('Kickoff.html'), project.dir);
  const movedPlan = await gatherPage(project.page('Kickoff files/Kickoff.html'), project.dir);
  assert.deepEqual((await readVerifiedUpload(oldPlan)).files.map(file => file.urlPath), ['/index.html', `/${font}`]);
  assert.deepEqual((await readVerifiedUpload(movedPlan)).files.map(file => file.urlPath), ['/index.html']);
  assert.deepEqual(movedPlan.leftOut, [{ display: `Kickoff files/${font}`, reason: 'gitIgnored' }]);
});

test('the hosted sheet names the ignored moved font and sends the unignored font at its old address', async t => {
  const project = await testProject({});
  t.after(project.cleanup);
  execFileSync('git', ['init', '-q'], { cwd: project.dir });
  const otherFont = 'fonts/Other.woff2';
  await project.write('.gitignore', `/Kickoff files/${font}\n`);
  const html = `<style>@font-face { src: url(${font}) } @font-face { src: url(${otherFont}) }</style>`;
  for (const address of [font, otherFont]) await project.write(`Kickoff files/${address}`, 'font bytes');
  const realPath = project.page('Kickoff files/Kickoff.html');
  await project.write('Kickoff files/Kickoff.html', html);
  const plan = await gatherPage(realPath, project.dir, {
    hostedDeck: { besideDeckPath: project.page('Kickoff.html'), html, assetAddresses: [font, otherFont] },
  });
  assert.deepEqual(sheetModelOf(plan, 'Training').leftOut, [
    { name: 'Inter-4.001-latin.woff2', display: `Kickoff files/${font}`, reason: 'gitIgnored' },
  ]);
  assert.deepEqual((await readVerifiedUpload(plan)).files.map(file => file.urlPath), ['/index.html', `/${otherFont}`]);
});

for (const mode of ['success', 'current theme logo', 'shared font', 'foreign font', 'trash failure', 'cancel', 'deploy failure', 'write failure', '2.3 unchanged', '2.3 edited', '2.3 deleted', 'foreign legacy page', 'held font', 'unreadable sibling'] as const) {
  test(`deck migration: ${mode}`, async t => {
    const project = await testProject({});
    t.after(project.cleanup);
    const besideDeckPath = project.page('Training/Kickoff.html');
    const realPath = project.page('Training/Kickoff files/Kickoff.html');
    const accountId = 'a'.repeat(32);
    const siteName = 'kickoff-123abc';
    const address = siteAddress(siteName, 'training', '/index.html');
    const extensionPath = fileURLToPath(new URL('../../', import.meta.url));
    const fontBytes = await fs.readFile(path.join(extensionPath, 'media/fonts/Inter-latin.woff2'));
    const legacyFontBytes = mode === 'foreign font' ? Buffer.from('different font bytes') : fontBytes;
    const makePage = async (heading = 'Kickoff', pagePath?: string) => (await buildDeckPage({
      deckPath: project.page('Training/Kickoff.rtms'), text: ['---', 'deck: 2', '---', '', '```slide', '# ' + heading, '```', '', '![Picture](images/old.png)'].join('\n'),
      pagePath,
      theme: { ...BUILT_IN_THEME, logo: { file: 'Brand.svg', place: 'top-right', on: 'every-slide' } },
    }, { logo, slideCss: '', fonts: [], themeFonts: [{ family: 'Inter', unicodeRange: 'U+0000-00FF', address: font }] }));
    await project.write('Training/images/old.png', PNG);
    const built = await makePage();
    const oldHtml = mode === 'foreign legacy page' ? built.html.replace('name="generator"', 'name="author"') : built.html;
    await project.write('Training/Kickoff.html', oldHtml);
    await project.write('Training/Kickoff.rtms', '---\ndeck: 2\n---\n');
    const local = await makePage('Kickoff', realPath);
    await project.write('Training/Kickoff files/Kickoff.html', local.html);
    await project.write(`Training/${font}`, legacyFontBytes);
    await project.write(`Training/Kickoff files/${font}`, legacyFontBytes);
    await project.write(`Training/${logo.address}`, logo.bytes);
    await project.write(`Training/Kickoff files/${logo.address}`, logo.bytes);
    if (mode === 'shared font') {
      await project.write('Training/Shared.html', (await makePage('Shared')).html
        .replaceAll(logo.address, 'images/old.png').replaceAll(font, './fonts/%49nter-4.001-latin.woff2'));
    }
    if (mode === 'foreign font') await project.write('Training/logos/foreign.svg', '<svg><!-- foreign --></svg>');
    const oldPlan = await gatherPage(besideDeckPath, project.dir);
    const oldUpload = await readVerifiedUpload(oldPlan);
    const records = new PublishRecordStore(project.page('storage'));
    const old = recordFor(oldPlan, { accountId, siteName, address });
    if (!mode.startsWith('2.3')) {
      old.deckVersion = 1000;
      old.deckDigest = built.digest;
    }
    if (mode === 'current theme logo') old.files = old.files.filter(file => file.path !== logo.address);
    await records.put(old);
    const live = { on: true as const, id: 'prior-consent' };
    await records.changeLive(old, live);
    const alternateSite = { ...old, siteName: 'other-123abc', address: siteAddress('other-123abc', 'training', '/index.html'), publishedAt: '2000-01-01T00:00:00.000Z' };
    await records.put(alternateSite);
    const pause = { ...live, pause: { kind: 'page' as const, at: 20, detail: 'Paused' } };
    await records.changeLive(alternateSite, pause);
    if (mode === '2.3 edited') await fs.writeFile(besideDeckPath, (await makePage('Edited after publishing')).html);
    if (mode === '2.3 deleted') await fs.unlink(besideDeckPath);
    if (mode === 'unreadable sibling') await fs.symlink('missing.html', project.page('Training/Unreadable.html'));
    const before = await records.list();
    let deploys = 0;
    let deployed: VerifiedUpload | undefined;
    const removed: string[] = [];
    const trashed: string[] = [];
    const failures: string[] = [];
    const host: PublishControllerDeps['host'] = {
      id: 'cloudflare', accountId: () => accountId,
      snapshot: () => ({ state: 'connected', accountName: 'Training', subdomain: 'training' }),
      refreshSubdomain: async () => 'training', connectWithToken: async () => { throw new Error('unexpected connect'); },
      disconnect: async () => {}, chooseSubdomain: async () => 'training', siteExists: async () => true,
      publish: async (name, upload, options) => {
        assert.equal(name, siteName);
        assert.equal(options.replacing, true);
        assert.equal(options.lastDeckVersion, deploys === 0 ? old.deckVersion : 1000 + deploys);
        deploys++;
        if (mode === 'deploy failure') throw new Error('simulated deploy failure');
        deployed = upload;
        return { name, address: siteAddress(name, 'training', upload.pageUrlPath), deckVersion: 1000 + deploys };
      },
      unpublish: async name => { removed.push(name); },
      waitUntilOnline: async () => 'online',
    };
    const openController = () => {
      const controller = new PublishController({
        legacyFiles: {
          extensionPath,
          held: file => mode === 'held font' && file === project.page(`Training/${font}`),
          trash: async file => {
            assert.equal(await records.get(besideDeckPath), undefined);
            assert.equal((await records.get(realPath))?.address, address);
            if (mode === 'trash failure' && file === project.page(`Training/${font}`)) throw new Error('simulated Trash failure');
            const target = path.relative(project.dir, file);
            await fs.rename(file, project.page(`trash-${trashed.length}`));
            trashed.push(target);
          },
        },
        host, records, gather: gatherPage, isFeatureEnabled: () => true, setReady: () => {}, postSettings: () => {}, log: () => {},
        ui: {
          openExternal: async () => true, askToken: async () => {}, showConnect: () => {},
          showSheet: async ({ plan, onConfirm }) => {
            if (mode === 'cancel') return { kind: 'cancel' };
            assert.equal(mode, 'current theme logo');
            assert.ok(plan);
            assert.equal((await onConfirm({ anyway: false })).kind, 'close');
            return { kind: 'publish', plan };
          },
          showFailure: line => { failures.push(line); }, showWaiting: () => () => {}, showBrief: () => {},
        },
      });
      controller.setPublishEntryAvailable(true);
      return controller;
    };
    const controller = openController();
    const page = { realPath, projectFolder: project.dir, hostedDeck: { besideDeckPath, html: built.html, assetAddresses: [font, logo.address], fit: [] } };
    assert.equal((await controller.recordFor(besideDeckPath))?.address, address);
    assert.equal((await controller.settingsProjection()).pages.find(p => p.id === siteName)?.address, address);
    assert.equal((await controller.legacyDeckRecord(besideDeckPath))?.address, address);
    if (mode === 'cancel') await fs.rm(project.page(`Training/Kickoff files/${font}`));
    if (mode === 'success') {
      const release = controller.holdPage(besideDeckPath);
      assert.ok(release);
      assert.deepEqual(await controller.updateLive({ realPath: besideDeckPath, projectFolder: project.dir }, {
        preference: live, resume: false, active: () => true, digest: built.digest,
        pageSha: createHash('sha256').update(built.html).digest('hex'),
      }), { kind: 'unchanged' });
      release();
      assert.deepEqual(await records.list(), before);
    }
    // Fail the atomic rename before it changes the record file.
    if (mode === 'write failure') {
      const rename = fs.rename;
      t.mock.method(fs.default, 'rename', async (from: string, to: string) => {
        if (to.endsWith('records.json')) throw new Error('simulated record write failure');
        await rename(from, to);
      });
    }
    const outcome = await controller.publishFromBar(page);
    if (mode === 'cancel' || mode === 'deploy failure' || mode === 'write failure') {
      assert.equal(outcome, mode === 'cancel' ? 'cancelled' : mode === 'deploy failure' ? 'failed' : 'published');
      assert.equal(deploys, mode === 'cancel' ? 0 : 1);
      assert.deepEqual(await records.list(), before);
      assert.deepEqual(trashed, []);
      assert.equal(await fs.readFile(besideDeckPath, 'utf8'), oldHtml);
      assert.equal((await controller.recordFor(besideDeckPath))?.address, address);
      if (mode === 'cancel') {
        await controller.unpublishPage(besideDeckPath);
        await controller.unpublishSite(alternateSite.siteName);
        assert.deepEqual(removed, [siteName, alternateSite.siteName]);
      }
      if (mode === 'deploy failure') assert.ok((await controller.pageState(besideDeckPath)).line);
      if (mode === 'write failure') assert.match((await controller.pageState(realPath)).line ?? '', /couldn.t save|couldn.t note|record|remember/i);
      return;
    }
    assert.equal(outcome, 'published');
    assert.deepEqual(deployed?.files, oldUpload.files.map((file, index) =>
      mode === 'foreign legacy page' && index === 0 ? { ...file, bytes: Buffer.from(built.html) } : file));
    assert.equal(await controller.recordFor(besideDeckPath), undefined);
    const after = await records.get(realPath);
    assert.equal(after?.address, address);
    assert.equal(after?.deckVersion, 1001);
    assert.deepEqual(after?.deckFit, []);
    assert.deepEqual(after?.live, live);
    assert.deepEqual((await records.list()).find(r => r.siteName === alternateSite.siteName), { ...alternateSite, pagePath: realPath, deckFolder: true, live: pause });
    assert.deepEqual(await fs.readFile(project.page(`Training/Kickoff files/${font}`)), legacyFontBytes);
    assert.deepEqual(await fs.readFile(project.page(`Training/Kickoff files/${logo.address}`)), logo.bytes);
    assert.equal(await fs.readFile(realPath, 'utf8'), local.html);
    if (mode === '2.3 edited') {
      assert.match(await fs.readFile(besideDeckPath, 'utf8'), /Edited after publishing/);
      assert.deepEqual(trashed, []);
    } else if (mode === 'foreign legacy page' || mode === 'unreadable sibling') {
      assert.equal(await fs.readFile(besideDeckPath, 'utf8'), oldHtml);
      assert.deepEqual(await fs.readFile(project.page(`Training/${font}`)), fontBytes);
      assert.deepEqual(await fs.readFile(project.page(`Training/${logo.address}`)), logo.bytes);
      assert.deepEqual(trashed, []);
    } else {
      await assert.rejects(fs.access(besideDeckPath), { code: 'ENOENT' });
      assert.equal(trashed.includes('Training/Kickoff.html'), mode !== '2.3 deleted');
    }
    if (mode === 'success' || mode === 'current theme logo') {
      for (const folder of ['fonts', 'logos']) {
        assert.ok(trashed.includes(`Training/${folder}`), JSON.stringify(trashed));
        await assert.rejects(fs.access(project.page(`Training/${folder}`)), { code: 'ENOENT' });
      }
      assert.ok(trashed.includes(`Training/${font}`));
      assert.ok(trashed.includes(`Training/${logo.address}`));
    }
    if (mode === 'shared font') {
      const sibling = project.page('Training/Shared.html');
      const html = await fs.readFile(sibling, 'utf8');
      const url = /url\(["']?([^"'()]*%49nter[^"'()]*)/.exec(html)?.[1];
      assert.ok(url);
      assert.deepEqual(await fs.readFile(new URL(url, pathToFileURL(sibling))), fontBytes);
    }
    if (mode === 'foreign font' || mode === 'trash failure' || mode === 'held font') {
      assert.deepEqual(await fs.readFile(project.page(`Training/${font}`)), legacyFontBytes);
      assert.ok(!trashed.includes(`Training/${font}`));
    }
    if (mode === 'foreign font') {
      assert.equal(await fs.readFile(project.page('Training/logos/foreign.svg'), 'utf8'), '<svg><!-- foreign --></svg>');
    }

    const reopened = openController();
    assert.equal((await reopened.recordFor(realPath))?.address, address);
    const release = reopened.holdPage(realPath);
    assert.ok(release);
    const attempt = { preference: live, active: () => true, resume: false };
    assert.deepEqual(await reopened.updateLive(page, {
      ...attempt, digest: built.digest, pageSha: createHash('sha256').update(built.html).digest('hex'),
    }), { kind: 'unchanged' });
    const edited = await makePage('Updated');
    assert.deepEqual(await reopened.updateLive({ ...page, hostedDeck: { ...page.hostedDeck, html: edited.html } }, {
      ...attempt, digest: edited.digest, pageSha: createHash('sha256').update(edited.html).digest('hex'),
    }), { kind: 'updated', pictures: [] });
    release();
    assert.equal(deploys, 2);
    await reopened.unpublishPage(realPath);
    await reopened.unpublishSite(alternateSite.siteName);
    assert.deepEqual(removed, [siteName, alternateSite.siteName]);
    assert.deepEqual(await records.list(), []);
    assert.deepEqual(failures, []);
  });
}

test('a nested published address survives when the picture above the deck is removed', async t => {
  const project = await testProject({});
  t.after(project.cleanup);
  const besideDeckPath = project.page('Training/Kickoff.html');
  const realPath = project.page('Training/Kickoff files/Kickoff.html');
  await project.write('shared.png', PNG);
  await project.write('Training/Kickoff.html', '<img src="../shared.png">');
  const before = await gatherPage(besideDeckPath, project.dir);
  assert.equal(before.files[0].relPath, 'Training/Kickoff.html');
  const html = '<p>Kickoff</p>';
  await project.write('Training/Kickoff files/Kickoff.html', html);
  const after = await gatherPage(realPath, project.dir, {
    hostedDeck: { besideDeckPath, html, assetAddresses: [] },
    publishedPagePath: before.files[0].relPath,
  });
  assert.equal((await readVerifiedUpload(after)).pageUrlPath, '/Training/index.html');
});

test('an unexpected hosted layout asks the user to try Publish again', async t => {
  const project = await testProject({});
  t.after(project.cleanup);
  await assert.rejects(gatherPage(project.page('Unexpected.html'), project.dir, {
    hostedDeck: { besideDeckPath: project.page('Kickoff.html'), html: '', assetAddresses: [] },
  }), { message: "Ritemark couldn't check where this deck's page and its files are, so nothing was sent. Try Publish again." });
});

test('the hosted refusal names both files at a shared address', { skip: process.platform === 'win32' }, async t => {
  const project = await testProject({});
  t.after(project.cleanup);
  await project.write('images/photo.png', PNG);
  // On POSIX a literal backslash in a filename is valid, but Publish turns it into a URL separator.
  await project.write('images\\photo.png', PNG);
  await assert.rejects(gatherPage(project.page('Kickoff files/Kickoff.html'), project.dir, {
    hostedDeck: {
      besideDeckPath: project.page('Kickoff.html'),
      html: '<img src="images/photo.png"><img src="images%5Cphoto.png">',
      assetAddresses: [],
    },
  }), { message: '“photo.png” and “images\\photo.png” would go to the same address on the page, so nothing was sent. Rename one of them and publish again.' });
});

for (const mode of ['manual', 'live', 'legacy live'] as const) {
  test(`an upward Slide library picture keeps the Copy link after a ${mode} update`, async t => {
    const project = await testProject({
      'Training/inside.png': PNG,
      'Sales/map.png': PNG,
    });
    t.after(project.cleanup);
    const deckPath = project.page('Training/Kickoff.rtms');
    const besideDeckPath = project.page('Training/Kickoff.html');
    const legacy = mode === 'legacy live';
    const realPath = legacy ? besideDeckPath : project.page('Training/Kickoff files/Kickoff.html');
    const makePage = async (upward: boolean) => {
      const text = ['---', 'deck: 2', '---', '', '```slide', '# Kickoff', '```', '', '![Inside](inside.png)',
        ...(upward ? ['![Map](../Sales/map.png)'] : [])].join('\n');
      const input = { deckPath, text, theme: BUILT_IN_THEME };
      const assets = { slideCss: '', fonts: [] };
      const built = await buildDeckPage(input, assets);
      const local = await buildDeckPage({ ...input, pagePath: realPath }, assets);
      await project.write(path.relative(project.dir, realPath), local.html);
      return { realPath, projectFolder: project.dir, hostedDeck: { besideDeckPath, html: built.html, assetAddresses: [] }, digest: built.digest };
    };
    const records = new PublishRecordStore(project.page('storage'));
    const deploys: VerifiedUpload[] = [];
    const accountId = 'a'.repeat(32);
    const siteName = 'kickoff-123abc';
    const host: PublishControllerDeps['host'] = {
      snapshot: () => ({ state: 'connected', accountName: 'Training', subdomain: 'training' }),
      accountId: () => accountId,
      refreshSubdomain: async () => 'training', connectWithToken: async () => { throw new Error('unexpected connect'); },
      disconnect: async () => {}, chooseSubdomain: async () => 'training', siteExists: async () => true,
      publish: async (name, upload, { replacing }) => {
        assert.equal(name, siteName);
        assert.equal(replacing, deploys.length > 0);
        deploys.push(upload);
        return { name, address: siteAddress(name, 'training', upload.pageUrlPath) };
      },
      unpublish: async () => {}, waitUntilOnline: async () => 'online',
    };
    let sheets = 0;
    const controller = new PublishController({
      host, records, gather: gatherPage, isFeatureEnabled: () => true, setReady: () => {}, postSettings: () => {}, log: () => {},
      ui: {
        openExternal: async () => true, askToken: async () => {}, showConnect: () => {},
        showSheet: async ({ plan, onConfirm }) => {
          sheets++;
          assert.ok(plan);
          assert.ok(sheetModelOf(plan, 'Training').files.some(
            row => row.name === 'map.png' && row.folder === 'Sales' && row.kind === 'picture'));
          assert.equal(deploys.length, 1);
          assert.equal((await onConfirm({ anyway: false })).kind, 'close');
          return { kind: 'publish', plan };
        },
        showFailure: line => assert.fail(line), showWaiting: () => () => {}, showBrief: () => {},
      },
    });
    controller.setPublishEntryAvailable(true);
    const initial = await makePage(false);
    await controller.publishPage({
      plan: await gatherPage(realPath, project.dir, { hostedDeck: legacy ? undefined : initial.hostedDeck }),
      consent: 'sheet', pagePart: siteName,
    });
    const before = (await controller.recordFor(realPath))?.address;
    assert.equal(before, 'https://kickoff-123abc.training.workers.dev/');

    const updated = await makePage(true);
    assert.ok(updated.hostedDeck.html.includes('src="../Sales/map.png"'));
    if (mode === 'manual') {
      assert.equal(await controller.publishFromBar(updated), 'published');
      assert.equal(sheets, 1);
    } else {
      assert.equal(await controller.setLive(realPath, true), true);
      const preference = (await controller.recordFor(realPath))?.live;
      assert.ok(preference);
      const release = controller.holdPage(realPath);
      assert.ok(release);
      t.after(release);
      const attempt = {
        preference, active: () => true, digest: updated.digest, legacyDeck: legacy,
        pageSha: createHash('sha256').update(updated.hostedDeck.html).digest('hex'),
      };
      const page = legacy ? { ...updated, hostedDeck: undefined } : updated;
      const paused = await controller.updateLive(page, { ...attempt, resume: false });
      assert.equal(paused.kind, 'paused');
      assert.deepEqual(paused.pause.outsideFiles, ['Sales/map.png']);
      assert.equal(deploys.length, 1);
      assert.deepEqual(await controller.updateLive(page, { ...attempt, resume: true }), { kind: 'updated', pictures: ['map.png'] });
      if (legacy) {
        const plan = await gatherPage(realPath, project.dir, { legacyDeckLive: true, publishedPagePath: 'Kickoff.html' });
        await fs.appendFile(realPath, '<p>Edited after gather</p>');
        await assert.rejects(readVerifiedUpload(plan), /Kickoff\.html changed/);
      }
    }
    assert.equal((await controller.recordFor(realPath))?.address, before);
    const neutral = `/pictures/${createHash('sha256').update(PNG).digest('hex').slice(0, 12)}.png`;
    assert.equal(deploys.length, 2);
    const [initialUpload, updatedUpload] = deploys;
    assert.equal(updatedUpload.pageUrlPath, initialUpload.pageUrlPath);
    assert.deepEqual(Object.keys(buildManifest(updatedUpload.files).manifest), ['/index.html', '/inside.png', neutral]);
    assert.match(Buffer.from(updatedUpload.files[0].bytes).toString('utf8'), new RegExp(`src="${neutral}"`));
  });
}

test('upward assets check Git and project scope, share identical bytes and widen around occupied addresses', async t => {
  const hash = createHash('sha256').update(PNG).digest('hex');
  const reserved = `pictures/${hash.slice(0, 12)}.png`;
  const neutral = `/pictures/${hash.slice(0, 13)}.png`;
  const project = await testProject({
    'Sales/map.PNG': PNG,
    'Other/copy.png': PNG,
    'Sales/ignore.png': PNG,
    'Sales/Typeface.WOFF2': 'font bytes',
    [`Training/${reserved}`]: PNG,
    '.gitignore': '/Sales/ignore.png\n',
  });
  t.after(project.cleanup);
  execFileSync('git', ['init', '-q'], { cwd: project.dir });
  const realPath = project.page('Training/Kickoff files/Kickoff.html');
  const besideDeckPath = project.page('Training/Kickoff.html');
  const fontAddress = `/pictures/${createHash('sha256').update('font bytes').digest('hex').slice(0, 12)}.woff2`;
  const query = 'api_key=' + 'Ab9'.repeat(8);
  const html = [
    '<style>/* url(../Sales/map.PNG) */ @font-face{font-family:"Test";src:url(../Sales/Typeface.WOFF2)}</style>',
    '<div style="background-image:url(&quot;../Sales/map.PNG&quot;)"></div>',
    '<img src="../Sales/map.PNG" srcset="../Other/copy.png 2x">',
    '<img src="../Sales/map.PNG"><img src="../Sales/ignore.png"><img src="../../outside.png">',
    '<p>../Sales/map.PNG</p>',
    `<img src="${reserved}">`,
    `<img src="../Sales/map.PNG?${query}">`,
  ].join('\n');
  const plan = await gatherPage(realPath, project.dir, { hostedDeck: { besideDeckPath, html, assetAddresses: [] } });
  const sheet = sheetModelOf(plan, 'Training');
  assert.deepEqual(sheet.leftOut.map(({ display, reason }) => [display, reason]), [
    ['../../outside.png', 'outside'], ['Sales/ignore.png', 'gitIgnored'],
  ]);
  assert.ok(sheet.files.some(row => row.name === 'copy.png' && row.folder === 'Other'));
  const upload = await readVerifiedUpload(plan);
  assert.deepEqual(upload.files.map(file => file.urlPath), ['/index.html', neutral, `/${reserved}`, fontAddress]);
  const rewritten = Buffer.from(upload.files[0].bytes).toString('utf8');
  assert.ok(rewritten.includes(`background-image:url(&quot;${neutral}&quot;)`));
  assert.ok(rewritten.includes(`src="${neutral}" srcset="${neutral} 2x"`));
  assert.ok(rewritten.includes(`src:url(${fontAddress})`));
  assert.ok(rewritten.includes('/* url(../Sales/map.PNG) */'));
  assert.ok(rewritten.includes('<p>../Sales/map.PNG</p>'));
  const keyLine = rewritten.split('\n').at(-1)!;
  assert.equal(keyLine, `<img src="${neutral}?${query}">`);
  assert.deepEqual(plan.keyHits.map(hit => ({
    rule: hit.rule, key: rewritten.split('\n')[hit.line - 1].slice(hit.column, hit.endColumn),
  })), [{ rule: 'query-key', key: query.split('=')[1] }]);
  await project.write('Other/copy.png', 'changed after the sheet');
  await assert.rejects(readVerifiedUpload(plan), /copy\.png changed/);
});

test('a neutral address keeps only a known file type, so no part of a file name goes up', async t => {
  // High review round 2 (nit): "board.ACMEX" went up as "/pictures/<hash>.acmex".
  const project = await testProject({ 'Sales/board.ACMEX': PNG, 'Sales/map.JPEG': PNG });
  t.after(project.cleanup);
  const realPath = project.page('Training/Kickoff files/Kickoff.html');
  const besideDeckPath = project.page('Training/Kickoff.html');
  const html = '<img src="../Sales/board.ACMEX"><img src="../Sales/map.JPEG">';
  const plan = await gatherPage(realPath, project.dir, { hostedDeck: { besideDeckPath, html, assetAddresses: [] } });
  const upload = await readVerifiedUpload(plan);
  const addresses = upload.files.map(file => file.urlPath);
  assert.ok(addresses.every(address => !/acmex|board|map|sales/i.test(address)), addresses.join(' '));
  const hash = createHash('sha256').update(PNG).digest('hex').slice(0, 12);
  assert.ok(addresses.includes(`/pictures/${hash}.bin`) || addresses.includes(`/pictures/${hash}.jpeg`), addresses.join(' '));
});
