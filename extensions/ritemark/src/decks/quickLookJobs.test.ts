import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { makeTempDir } from '../testing/tempDir';
import { DeckPdfSaver, type PdfDeps } from './deckPdf';
import { BUILT_IN_THEME } from './deckTheme';
import { PRIVATE_BLOCK_DECK } from './page/testing/privateDeck';
import { QuickLookCache, quickLookRoot, sha256, sourceIdentity } from './quickLookCache';
import { cacheSavedSlides, canStartQuickLook, prepareSavedSlides, QuickLookJobs } from './quickLookJobs';

function gate() {
  let open!: () => void;
  const promise = new Promise<void>(resolve => { open = resolve; });
  return { open, promise };
}

function fixture() {
  const folder = makeTempDir('quick-look-draw-');
  const file = path.join(folder, 'Deck.rtms');
  const picture = path.join(folder, 'local.png');
  const theme = path.join(folder, 'Theme.theme.md');
  const text = PRIVATE_BLOCK_DECK.replace('images/pilot.png', 'local.png');
  fs.writeFileSync(file, text);
  fs.writeFileSync(theme, 'theme one');
  fs.writeFileSync(picture, 'picture');
  let logo = Buffer.from('first logo');
  const load = async (deckPath: string, text: string) => ({
    deckPath, text, theme: BUILT_IN_THEME, themeBytes: fs.readFileSync(theme), themeFiles: [theme], fonts: [], steps: [2, 1, 3, 2, 1, 3],
    logo: { address: 'logos/logo.svg', bytes: logo },
  });
  const pages: string[] = [];
  const temps: string[] = [];
  const print = {
    assets: async () => ({ slideCss: '', fonts: [] }),
    tempRoot: folder,
    print: async (htmlPath: string) => {
      const directory = path.dirname(htmlPath);
      temps.push(directory);
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
      const pdf = path.join(directory, 'page.pdf');
      pages.push(fs.readFileSync(htmlPath, 'utf8'));
      fs.writeFileSync(pdf, '%PDF stand-in');
      return pdf;
    },
  };
  const cache = new QuickLookCache(quickLookRoot('ai.productory.ritemark', folder));
  const job = { file, realPath: sourceIdentity(file).realPath, load, print, cache, appVersion: '2.4.0', extensionVersion: '2.4.1',
    active: () => true, allowed: async () => true, dependencies: () => {} };
  return { file, picture, theme, print, job, pages, temps, cache, changeLogo: () => { logo = Buffer.from('other logo'); } };
}

test('platform gate skips capability probing on Windows and with Decks off', async () => {
  const noProbe = async () => assert.fail('should skip probing');
  assert.equal(await canStartQuickLook('win32', true, true, noProbe, noProbe), false);
  assert.equal(await canStartQuickLook('darwin', true, false, noProbe, noProbe), false);
  assert.equal(await canStartQuickLook('darwin', false, true, noProbe, noProbe), false);
  assert.equal(await canStartQuickLook('darwin', true, true, async () => false, async () => true), false);
  assert.equal(await canStartQuickLook('darwin', true, true, noProbe, async () => false), false);
  assert.equal(await canStartQuickLook('darwin', true, true, async () => true, async () => true), true);
});

test('a running job stays superseded even if its replacement was cancelled', { timeout: 5000 }, async () => {
  const started = gate();
  const release = gate();
  const finished = gate();
  const published: string[] = [];
  const jobs = new QuickLookJobs<string>(async (value, current) => {
    if (value === 'old') {
      started.open();
      await release.promise;
    }
    if (current()) published.push(value);
    if (value === 'new') finished.open();
  }, 0);
  try {
    jobs.queue('deck', 'old');
    await started.promise;
    jobs.queue('deck', 'replace then cancel');
    jobs.cancel(value => value === 'replace then cancel');
    release.open();
    jobs.queue('other deck', 'new');
    await finished.promise;
    assert.deepEqual(published, ['new']);
  } finally {
    release.open();
    jobs.dispose();
  }
});

test('fingerprint includes theme, local picture metadata and logo bytes', async () => {
  const { file, picture, theme, job, changeLogo } = fixture();
  const fingerprint = async () => (await prepareSavedSlides(file, fs.readFileSync(file), job.appVersion, job.load, job.print))!;
  const original = await fingerprint();
  assert.ok(original.dependencies.includes(picture));
  fs.writeFileSync(theme, 'theme two');
  const changedTheme = await fingerprint();
  assert.notEqual(changedTheme.inputs, original.inputs);
  fs.appendFileSync(picture, ' changed');
  const changedPicture = await fingerprint();
  assert.notEqual(changedPicture.inputs, changedTheme.inputs);
  const date = new Date('2020-01-01');
  fs.utimesSync(picture, date, date);
  const changedTime = await fingerprint();
  assert.notEqual(changedTime.inputs, changedPicture.inputs);
  changeLogo();
  const changedLogo = await fingerprint();
  assert.notEqual(changedLogo.inputs, changedTime.inputs);
  const upgraded = await prepareSavedSlides(file, fs.readFileSync(file), job.appVersion, job.load, job.print, '2.5.0');
  assert.notEqual(upgraded?.inputs, changedLogo.inputs);
});

test('saved drawing and Save slides as PDF send the same page to the print command', async () => {
  const { file, cache, print, job, pages, temps } = fixture();
  await cacheSavedSlides(job);
  assert.ok(await cache.read(file));
  await cacheSavedSlides(job);
  assert.equal(pages.length, 1, 'fresh entries do not print again');
  const target = file + '.pdf';
  const pdfDeps: PdfDeps = { ...print, hasPrint: async () => true, askTarget: async () => target, reveal: async () => {} };
  const saver = new DeckPdfSaver({ pageInput: () => job.load(file, fs.readFileSync(file, 'utf8')) }, pdfDeps, () => true);
  await saver.save({ uri: { fsPath: file } } as Parameters<typeof saver.save>[0], 'slides', '', 'card', [2, 1, 3, 2, 1, 3], () => {});
  assert.equal(pages.length, 2);
  assert.equal(pages[0], pages[1]);
  assert.match(pages[0], /--fit:\s*0\.84/);
  assert.equal(fs.readFileSync(target, 'utf8'), '%PDF stand-in');
  assert.ok(temps.every(temp => !fs.existsSync(temp)));
});

test('a project removed during print cannot publish its pending drawing', async () => {
  const { file, cache, print, job } = fixture();
  let allowed = true;
  await cacheSavedSlides({ ...job, allowed: async () => allowed, print: {
    ...print, print: async html => {
      const pdf = await print.print(html);
      allowed = false;
      return pdf;
    },
  } });
  assert.equal(await cache.read(file), undefined);
});

test('an unmeasured deck fits the print layout again before printing', async () => {
  const { job, pages } = fixture();
  await cacheSavedSlides({ ...job, load: async (file, text) => ({
    ...await job.load(file, text), steps: [], measureFit: true,
  }) });
  const script = [...pages[0].matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)![1];
  assert.ok(pages[0].includes("'sha256-" + Buffer.from(sha256(script), 'hex').toString('base64') + "'"));
  let fit = 1;
  let textHeight = 108;
  let beforePrint!: () => void;
  const flow = {
    style: { setProperty: (_name: string, value: string) => { fit = Number(value); } },
    children: [{ offsetTop: 0, offsetLeft: 0, offsetWidth: 100, get offsetHeight() { return fit * textHeight; } }],
    clientWidth: 200,
    clientHeight: 100,
    scrollHeight: 100,
    offsetWidth: 200,
    getBoundingClientRect: () => ({ width: 200 }),
    querySelectorAll: () => [],
  };
  runInNewContext(script, {
    document: { querySelectorAll: () => [flow] },
    window: { addEventListener: (_event: string, listener: () => void) => { beforePrint = listener; } },
    getComputedStyle: () => ({ display: 'block', position: 'static' }),
  });
  assert.equal(fit, 0.92);
  textHeight = 120;
  beforePrint();
  assert.equal(fit, 0.84);
});
