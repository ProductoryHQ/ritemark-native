/**
 * Sprint 149, PR 4: the publish controller with the real Cloudflare host against the local fake server, PR 3's real
 * gather on real files, and PR 3's record store. Settings ▸ Sharing ▸ Web pages, the token box's three outcomes,
 * frame 2, the sheet's name row and address, the flag, the page's states, and S20a/S21: no message to or from the
 * page, no log line and no projection carries the token.
 *
 * Run: npx tsx src/publish/PublishController.test.ts
 */

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CloudflareAccount, CONNECTION_SECRET_KEY, type SecretsLike } from './cloudflare/account';
import { CloudflareClient, type FetchLike } from './cloudflare/client';
import { CloudflareHost, CONNECT_AGAIN, COULD_NOT_REACH_UNPUBLISH } from './cloudflare/CloudflareHost';
import { FakeCloudflare } from './cloudflare/testing/fakeCloudflare';
import { HARBOUR, testProject, type TestProject } from './cloudflare/testing/pages';
import {
  DISCONNECT_FAILED,
  KEY_NEEDS_SHEET,
  NAME_TAKEN,
  NEW_ADDRESS_WAIT,
  OTHER_ACCOUNT,
  PublishController,
  SLOW_UNPUBLISH,
  TOKEN_BOX,
  TOKEN_TEMPLATE_URL,
  TOKEN_WORDS,
  UNPUBLISHED_LIST_STALE,
  SHEET_HOST_COMMAND,
  SWITCHED_OFF,
  sheetHostAvailable,
  type PublishUi,
} from './PublishController';
import { PublishRecordStore, RECORDS_FILE, RECORDS_FOLDER } from './publishRecords';
import { decodeSettingsRequest, offersSetUp, showsWebPagesCard, type WebPagesSettingsProjection } from './settingsProtocol';
import type { SheetConfirm, SheetConfirmReply, SheetOptions } from './sheetModel';
import type { GatheredPlan, PublishPlan } from './types';
import { PublishError } from './host';

const TOKEN = `t${'0123456789abcdef'.repeat(2)}Xy_${Date.now().toString(36)}`;
const WEAK = `w${'fedcba9876543210'.repeat(2)}Zq_${Date.now().toString(36)}`;
const ACCOUNT = 'a'.repeat(32);
const RANDOM = () => Buffer.from([0x7f, 0x3a, 0x2c]);

const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

class MemorySecrets implements SecretsLike {
  readonly map = new Map<string, string>();
  failDelete = false;
  async get(key: string) { return this.map.get(key); }
  async store(key: string, value: string) { this.map.set(key, value); }
  async delete(key: string) { if (this.failDelete) throw new Error('keychain locked'); this.map.delete(key); }
}

const realFetch: FetchLike = (url, init) => fetch(url, init as RequestInit);

type SheetRequest = Parameters<PublishUi['showSheet']>[0];
type SheetResult = Awaited<ReturnType<PublishUi['showSheet']>>;

/** What a sheet showed, and what the host answered each press of Publish. */
interface SheetSeen { plan: PublishPlan; options: SheetOptions; replies: SheetConfirmReply['kind'][] }

/**
 * The sheet, driven as a person would: frame 2's Set up when there is no plan, then each press in `presses` (the
 * default: the address and name the sheet shows), until the host lets it close. `cancel` presses Cancel instead.
 */
function driveSheet(seen: SheetSeen[], presses: Array<Partial<SheetConfirm> | 'cancel'> = [{}]) {
  return async (req: SheetRequest): Promise<SheetResult> => {
    let plan = req.plan;
    let options = req.options;
    if (!plan) {
      const r = await req.setup!.run();
      if (!r || 'stop' in r) return { kind: 'cancel' };
      plan = r.plan;
      options = r.options;
    }
    const sheet: SheetSeen = { plan, options, replies: [] };
    seen.push(sheet);
    for (const press of presses) {
      if (press === 'cancel') return { kind: 'cancel' };
      const confirm: SheetConfirm = {
        anyway: plan.keyHits.length > 0,
        pagePart: options.address?.editable ? options.address.page : undefined,
        subdomain: options.nameRow?.suggestion,
        ...press,
      };
      const reply = await req.onConfirm(confirm);
      sheet.replies.push(reply.kind);
      if (reply.kind === 'update') { options = reply.options; sheet.options = options; continue; }
      if (reply.kind === 'close') return { kind: plan.keyHits.length > 0 ? 'publishAnyway' : 'publish', pagePart: confirm.pagePart, plan };
      if (reply.kind === 'stop') return { kind: 'cancel' };
    }
    return { kind: 'cancel' };
  };
}

async function setup(options: { flag?: boolean; entry?: boolean; pasted?: string[]; goneAfterChecks?: number; files?: Record<string, string | Uint8Array> } = {}) {
  const fake = await new FakeCloudflare().start();
  fake.tokens.set(TOKEN, 'ok');
  fake.tokens.set(WEAK, 'no-publish');
  fake.goneAfterChecks = options.goneAfterChecks ?? 0;
  const secrets = new MemorySecrets();
  const log: string[] = [];
  const account = new CloudflareAccount({
    secrets,
    makeClient: (token) => new CloudflareClient({ fetch: realFetch, token, apiBase: fake.apiBase, addressBase: fake.base, sleep: async () => {}, timeoutMs: 5_000, log: (l) => log.push(l) }),
  });
  let clock = 0;
  const host = new CloudflareHost(account, { log: (l) => log.push(l), sleep: async (ms) => { clock += ms; }, now: () => clock, unpublishDeadlineMs: 60_000 });
  const storage = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ritemark-publish-')));
  const records = new PublishRecordStore(storage);
  const project = await testProject(options.files ?? HARBOUR);
  const posted: WebPagesSettingsProjection[] = [];
  const opened: string[] = [];
  const boxes: Array<{ title: string; prompt: string; lines: Array<string | null> }> = [];
  const ready: boolean[] = [];
  const pageEvents: string[] = [];
  const failures: string[] = [];
  /** M6's waiting line: each one shown, and whether it was closed. */
  const waits: Array<{ line: string; closed: boolean }> = [];
  const sheets: SheetSeen[] = [];
  const flag = { on: options.flag ?? true };
  const pasted = [...(options.pasted ?? [])];
  const ui = {
    openExternal: async (url: string) => { opened.push(url); return true; },
    // The host's password box: each paste is checked; a line keeps the box open for the next paste
    askToken: async ({ title, prompt, check }: Parameters<PublishUi['askToken']>[0]) => {
      const box = { title, prompt, lines: [] as Array<string | null> };
      boxes.push(box);
      while (pasted.length) {
        const line = await check(pasted.shift()!);
        box.lines.push(line);
        if (line === null) return;
      }
    },
    showSheet: driveSheet(sheets) as PublishUi['showSheet'],
    showFailure: (line: string) => { failures.push(line); },
    showWaiting: (line: string) => {
      const wait = { line, closed: false };
      waits.push(wait);
      return () => { wait.closed = true; };
    },
  };
  const makeController = () => new PublishController({
    host,
    records,
    ui,
    gather: (pagePath, folder) => (pagePath.startsWith(project.dir) ? project.gather(path.relative(project.dir, pagePath)) : Promise.reject(new Error(`not the test project: ${folder}`))),
    isFeatureEnabled: () => flag.on,
    postSettings: (p) => posted.push(p),
    setReady: (r) => ready.push(r),
    onPageState: (p) => pageEvents.push(p),
    log: (l) => log.push(l),
    now: () => 5_000,
    random: RANDOM,
  });
  const controller = makeController();
  // PR 5's whole-window sheet, as once it lands; `entry: false` is today's build, where Publish can't be reached
  if (options.entry ?? true) controller.setPublishEntryAvailable(true);
  const page = { realPath: project.page(), projectFolder: project.dir };
  const cleanup = async () => { await fake.stop(); await fs.rm(storage, { recursive: true, force: true }); await project.cleanup(); };
  return { makeController, fake, secrets, account, host, records, controller, posted, opened, boxes, ready, pageEvents, failures, waits, sheets, ui, flag, log, cleanup, storage, pasted, project, page };
}

type T = Awaited<ReturnType<typeof setup>>;

/** Everything that left the host for the page, and every log line. */
function everythingSaid(t: { posted: unknown[]; log: string[]; sheets: unknown[]; failures: string[] }): string {
  return JSON.stringify(t.posted) + '\n' + t.log.join('\n') + '\n' + JSON.stringify(t.sheets.map((s) => (s as SheetSeen).options)) + '\n' + t.failures.join('\n');
}

/** Connect, then publish the test page through the sheet. */
async function publishedOnce(t: T) {
  await t.controller.startTokenEntry();
  await t.controller.publishFromBar(t.page);
  const record = await t.records.get(t.page.realPath);
  assert.ok(record, `published: ${t.failures.join(' | ')}`);
  return record!;
}

const uploads = (t: T) => t.fake.requests.filter((r) => r.path.includes('/workers/assets/upload'));

// ---------------------------------------------------------------- the protocol (R9, S20a)

test('the page can send five messages, by their exact fields; none can carry a token', async () => {
  assert.deepEqual(decodeSettingsRequest({ type: 'publish:startTokenEntry' }), { type: 'publish:startTokenEntry' });
  assert.equal(decodeSettingsRequest({ type: 'publish:startTokenEntry', token: TOKEN }), null, 'a value rides on nothing');
  assert.equal(decodeSettingsRequest({ type: 'publish:connect', value: TOKEN }), null);
  assert.equal(decodeSettingsRequest({ type: 'publish:disconnect', key: CONNECTION_SECRET_KEY }), null);
  assert.deepEqual(decodeSettingsRequest({ type: 'publish:unpublish', id: 'harbour-programme-7f3a2c' }), { type: 'publish:unpublish', id: 'harbour-programme-7f3a2c' });
  assert.equal(decodeSettingsRequest({ type: 'publish:open', id: 'https://evil.example/' }), null, 'an address is not an id');
  assert.equal(decodeSettingsRequest({ type: 'publish:setToken', value: TOKEN }), null);
});

// ---------------------------------------------------------------- the token box (R6, S20)

test('Set up: Cloudflare\'s page and the host\'s own box at once, with the lead\'s words; a good token connects', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.handleSettingsMessage({ type: 'publish:startTokenEntry' });
    assert.deepEqual(t.opened, [TOKEN_TEMPLATE_URL]);
    assert.match(TOKEN_TEMPLATE_URL, /^https:\/\/dash\.cloudflare\.com\/.*permissionGroupKeys=.*workers_scripts.*&name=Ritemark$/);
    assert.equal(t.boxes.length, 1);
    assert.equal(t.boxes[0].title, 'Cloudflare token');
    assert.equal(t.boxes[0].prompt, TOKEN_BOX.prompt);
    assert.deepEqual(t.boxes[0].lines, [null], 'the box closed on the good token');
    const last = t.posted.at(-1)!;
    assert.equal(last.state, 'connected');
    assert.equal(last.accountName, 'Mari Tamm');
    assert.equal(last.subdomain, 'pages-4821');
    assert.equal(last.enteringToken, false);
    assert.ok(t.posted.some((p) => p.enteringToken), 'the card knew the box was open');
    assert.ok(!everythingSaid(t).includes(TOKEN), 'no projection or log line holds the token');
  } finally { await t.cleanup(); }
});

test('a refused token, then one that can\'t publish, keep the box open with the words under it; nothing saved', async () => {
  const t = await setup({ pasted: [`n${'9'.repeat(39)}`, WEAK] });
  try {
    await t.controller.startTokenEntry();
    assert.deepEqual(t.boxes[0].lines, [TOKEN_WORDS.refused, TOKEN_WORDS['cannot-publish']]);
    assert.equal(TOKEN_WORDS.refused, "Cloudflare didn't accept this token. Copy it again from Cloudflare's page.");
    assert.equal(TOKEN_WORDS['cannot-publish'], "This token can't publish pages. Make a new one on the page Ritemark opened.");
    assert.equal(t.secrets.map.size, 0);
    assert.equal(t.posted.at(-1)!.state, 'disconnected');
    assert.ok(!everythingSaid(t).includes(WEAK));
  } finally { await t.cleanup(); }
});

test('with no OAuth client (2.2), Connect is the token path, and the card says OAuth isn\'t there (S23)', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.handleSettingsMessage({ type: 'publish:connect' });
    assert.equal(t.boxes.length, 1);
    assert.equal(t.posted.at(-1)!.oauthAvailable, false);
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- the bar's Publish: frame 2, frame 3 (R5, R7)

test('the first Publish with nothing set up: frame 2\'s Set up is the token path, then the sheet, then the page is online', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.publishFromBar(t.page);
    assert.equal(t.boxes.length, 1, 'Set up opened the host\'s own box');
    assert.deepEqual(t.opened, [TOKEN_TEMPLATE_URL], 'and Cloudflare\'s token page');
    assert.equal(t.sheets.length, 1);
    const shown = t.sheets[0].options;
    assert.deepEqual(shown.destination, { name: 'Your Cloudflare', detail: 'Mari Tamm' });
    assert.deepEqual(shown.address, { page: 'harbour-programme-7f3a2c', suffix: '.pages-4821.workers.dev', editable: true });
    assert.equal(shown.nameRow, undefined, 'the account has a name: no name row');
    const record = await t.records.get(t.page.realPath);
    assert.equal(record?.address, 'https://harbour-programme-7f3a2c.pages-4821.workers.dev/');
    assert.equal(t.failures.length, 0);
    const res = await fetch(`${t.fake.base}/__site/harbour-programme-7f3a2c.pages-4821.workers.dev/`);
    assert.match(await res.text(), /Harbour/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  } finally { await t.cleanup(); }
});

test('the name row: once, while the account has none; "This name is taken. Try another." keeps the sheet open (S28a)', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.subdomain = null;
    await t.controller.startTokenEntry();
    t.ui.showSheet = driveSheet(t.sheets, [{ subdomain: 'pages-1111' }, { subdomain: 'pages-4821' }]) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    assert.match(t.sheets[0].options.nameRow?.suggestion ?? '', /^pages-\d{4}$/);
    assert.deepEqual(t.sheets[0].replies, ['refuse', 'close']);
    assert.equal(t.fake.subdomain, 'pages-4821');
    assert.equal((await t.records.get(t.page.realPath))?.address, 'https://harbour-programme-7f3a2c.pages-4821.workers.dev/');
    assert.deepEqual(await t.controller.chooseSubdomain('pages-1111'), { existing: 'pages-4821' }, 'never renamed afterwards');
    assert.equal(t.fake.subdomain, 'pages-4821');
    assert.equal(NAME_TAKEN, 'This name is taken. Try another.');
  } finally { await t.cleanup(); }
});

test('the name row, when the account got a name meanwhile: kept, the sheet shows the real address again; no PUT', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.subdomain = null;
    await t.controller.startTokenEntry();
    // The name is set elsewhere between the sheet opening and the press
    t.ui.showSheet = (async (req: SheetRequest) => {
      t.fake.subdomain = 'mari-pages';
      return driveSheet(t.sheets, [{}, {}])(req);
    }) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    assert.deepEqual(t.sheets[0].replies, ['update', 'close']);
    assert.equal(t.sheets[0].options.address?.suffix, '.mari-pages.workers.dev');
    assert.equal(t.sheets[0].options.nameRow, undefined);
    assert.ok(!t.fake.requests.some((r) => r.method === 'PUT' && r.path.endsWith('/workers/subdomain')));
    assert.equal((await t.records.get(t.page.realPath))?.address, 'https://harbour-programme-7f3a2c.mari-pages.workers.dev/');
  } finally { await t.cleanup(); }
});

test('the address field: an invalid page part, or one already on the account, keeps the sheet open', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    t.fake.scripts.set('my-api-111111', { assets: new Map(), headers: '', enabled: true, previews: false });
    t.ui.showSheet = driveSheet(t.sheets, [{ pagePart: 'harbour' }, { pagePart: 'my-api-111111' }, { pagePart: 'harbour-2026-7f3a2c' }]) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    assert.deepEqual(t.sheets[0].replies, ['refuse', 'refuse', 'close']);
    assert.equal(t.fake.scripts.get('my-api-111111')?.assets.size, 0, 'the person\'s own Worker is untouched');
    assert.equal((await t.records.get(t.page.realPath))?.siteName, 'harbour-2026-7f3a2c');
  } finally { await t.cleanup(); }
});

test('Update: the same files and no key go straight up at the same address; a new file shows the sheet again', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const first = await publishedOnce(t);
    await t.project.write('style.css', 'body{color:#456}');
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, 1, 'no sheet for an update with the same list');
    const second = (await t.records.get(t.page.realPath))!;
    assert.equal(second.address, first.address, 'the address stays (M8)');
    assert.notEqual(second.contentHash, first.contentHash);
    await t.project.write('Harbour programme.html', '<link rel="stylesheet" href="style.css"><h1>Harbour</h1><img src="img/a.png"><img src="img/b.png">');
    await t.project.write('img/b.png', new Uint8Array([1, 2]));
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, 2, 'S27: a new file shows the sheet');
    assert.equal(t.sheets[1].options.address?.editable, false, 'an update keeps its address');
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- publishPage takes only PR 3's plan (the guard)

test('publishPage: only a plan gatherPage made; a key needs "Publish anyway"; an update without the sheet needs the same list', async () => {
  const t = await setup({ pasted: [TOKEN], files: { ...HARBOUR, 'app.js': `const k = "${['sk', 'ant', 'api03', randomBytes(18).toString('hex')].join('-')}";` } });
  try {
    await t.controller.startTokenEntry();
    const plain = await t.project.gather();
    const events = t.pageEvents.length;
    await assert.rejects(t.controller.publishPage({ plan: { ...plain } as GatheredPlan, consent: 'sheet', pagePart: 'a-7f3a2c' }), PublishError, 'a copy is not a gathered plan');
    assert.equal(t.pageEvents.length, events, 'refused at the door: the page never shows Publishing…');
    await assert.rejects(t.controller.publishPage({ plan: plain, consent: 'unchanged-update' }), PublishError, 'no record: the sheet first');
    await assert.rejects(t.controller.publishPage({ plan: plain, consent: 'sheet', pagePart: 'harbour' }), (e: unknown) => e instanceof PublishError && e.code === 'name-invalid');
    await t.project.write('Harbour programme.html', '<script src="app.js"></script><h1>Harbour</h1>');
    const withKey = await t.project.gather();
    assert.ok(withKey.keyHits.length > 0, 'the fixture holds a key-shaped value');
    await assert.rejects(t.controller.publishPage({ plan: withKey, consent: 'sheet', pagePart: 'a-7f3a2c' }), (e: unknown) => e instanceof PublishError && e.message === KEY_NEEDS_SHEET);
    assert.equal(uploads(t).length, 0, 'nothing was sent');
    assert.equal(t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session')).length, 0);
    await t.controller.publishPage({ plan: withKey, consent: 'sheet-anyway', pagePart: 'a-7f3a2c' });
    assert.ok(t.fake.scripts.has('a-7f3a2c'), 'the second, explicit press publishes');
  } finally { await t.cleanup(); }
});

test('bytes by hash, end to end: a file changed after the sheet stops the upload and says so; nothing reaches Cloudflare', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    t.ui.showSheet = (async (req: SheetRequest) => {
      const result = await driveSheet(t.sheets)(req);
      await t.project.write('img/a.png', new Uint8Array([6, 6, 6])); // changed between the sheet and the upload
      return result;
    }) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    assert.equal(t.failures.length, 1);
    assert.match(t.failures[0], /^a\.png changed after Ritemark checked it\. Nothing was sent\./);
    assert.equal(t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session')).length, 0, 'not even the manifest');
    assert.equal(await t.records.get(t.page.realPath), undefined);
    assert.equal((await t.controller.pageState(t.page.realPath)).line, t.failures[0], 'the bar\'s line');
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- the flag (S28b)

test('flag off: no token box, no connect, no publish; the list, Open, Unpublish and Disconnect still work', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    t.flag.on = false;
    t.pasted.push(TOKEN);
    await t.controller.handleSettingsMessage({ type: 'publish:startTokenEntry' });
    await t.controller.handleSettingsMessage({ type: 'publish:connect' });
    assert.equal(t.boxes.length, 1, 'no second box');
    await assert.rejects(t.controller.publishPage({ plan: await t.project.gather(), consent: 'sheet', pagePart: 'x-111111' }));
    const sheetsBefore = t.sheets.length;
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, sheetsBefore, 'the bar\'s Publish does nothing');
    const projection = await t.controller.settingsProjection();
    assert.equal(projection.enabled, false);
    assert.equal(projection.pages.length, 1, 'the page stays listed');
    await t.controller.handleSettingsMessage({ type: 'publish:open', id: record.siteName });
    assert.equal(t.opened.at(-1), record.address);
    await t.controller.handleSettingsMessage({ type: 'publish:unpublish', id: record.siteName });
    assert.equal((await t.controller.settingsProjection()).pages.length, 0, 'Unpublish works with the flag off');
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.secrets.map.size, 0, 'Disconnect works with the flag off');
  } finally { await t.cleanup(); }
});

test('ritemark.publish.ready: only with the flag on and the whole-window sheet host there (PR 5)', async () => {
  const t = await setup({ entry: false });
  try {
    t.controller.refreshReady();
    assert.equal(t.ready.at(-1), false, 'no sheet host yet: Publish never shows');
    t.controller.setPublishEntryAvailable(true);
    assert.equal(t.ready.at(-1), true);
    t.flag.on = false;
    t.controller.refreshReady();
    assert.equal(t.ready.at(-1), false);
  } finally { await t.cleanup(); }
});

test('the sheet host check: only PR 5\'s _ritemark.webviewSheet.open makes Publish reachable; internal commands asked for', async () => {
  // the name the shell really registers (PR 5's webviewSheet.ts), not a guess
  const sheetSource = await fs.readFile(path.join(__dirname, '..', 'webviewSheet', 'webviewSheet.ts'), 'utf8');
  assert.equal(SHEET_HOST_COMMAND, /WEBVIEW_SHEET_OPEN_COMMAND = '([^']+)'/.exec(sheetSource)?.[1]);
  assert.equal(SHEET_HOST_COMMAND, '_ritemark.webviewSheet.open');
  const asked: boolean[] = [];
  const commands = (list: string[]) => async (filterInternal: boolean) => { asked.push(filterInternal); return filterInternal ? list.filter((c) => !c.startsWith('_')) : list; };
  assert.equal(await sheetHostAvailable(commands(['ritemark.page.publish', '_ritemark.feedbackSheet'])), false, 'today: no sheet host');
  assert.equal(await sheetHostAvailable(commands(['_ritemark.webviewSheet'])), false, 'not a near name');
  assert.equal(await sheetHostAvailable(commands(['_ritemark.webviewSheet.open', '_ritemark.webviewSheet.close'])), true, 'with PR 5\'s sheet');
  assert.ok(asked.every((a) => a === false), 'asked with the internal commands in');
  assert.equal(await sheetHostAvailable(async () => { throw new Error('no'); }), false);
});

// ---------------------------------------------------------------- one record store, one content hash (R7, R8, R9)

test('one record store: PR 3\'s publish/v1/records.json, its content hash; "Published · changed" from PR 3\'s hash', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    const p = await t.controller.settingsProjection();
    assert.deepEqual(p.pages, [{ id: 'harbour-programme-7f3a2c', name: 'Harbour programme.html', address: record.address, status: 'online', slow: false, message: null }]);
    const stored = await fs.readFile(path.join(t.storage, RECORDS_FOLDER, RECORDS_FILE), 'utf8');
    assert.ok(!stored.includes(TOKEN), 'the record holds no token');
    assert.deepEqual(await fs.readdir(path.join(t.storage, RECORDS_FOLDER)), [RECORDS_FILE], 'one store, nothing beside it');
    const plan = await t.project.gather();
    assert.equal(record.contentHash, plan.contentHash, 'the record keeps PR 3\'s contentHash');
    assert.equal((await t.controller.pageState(t.page.realPath, plan.contentHash)).changed, false);
    await t.project.write('style.css', 'body{color:#789}');
    const now = await t.project.gather();
    const state = await t.controller.pageState(t.page.realPath, now.contentHash);
    assert.equal(state.kind, 'published');
    assert.equal(state.changed, true, 'Published · changed');
  } finally { await t.cleanup(); }
});

test('Unpublish: the row waits, the 10 s line shows, and the page leaves the list only when its address is gone', async () => {
  const t = await setup({ pasted: [TOKEN], goneAfterChecks: 8 });
  try {
    const record = await publishedOnce(t);
    t.posted.length = 0;
    await t.controller.handleSettingsMessage({ type: 'publish:unpublish', id: record.siteName });
    assert.equal(t.posted[0].pages[0].status, 'unpublishing');
    assert.ok(t.posted.some((p) => p.pages[0]?.slow), 'slow after 10 s');
    assert.equal(t.posted.at(-1)!.pages.length, 0);
    assert.equal(SLOW_UNPUBLISH, 'Cloudflare is still taking the page down.');
    assert.equal((await t.controller.pageState(t.page.realPath)).kind, 'unpublished', 'the bar shows Publish again');
  } finally { await t.cleanup(); }
});

test('Unpublish that fails keeps the page listed with "…The page is still online."', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    t.fake.failures.push({ method: 'DELETE', path: /scripts/, status: 500, times: 10 });
    await t.controller.unpublishSite(record.siteName);
    const row = (await t.controller.settingsProjection()).pages[0];
    assert.equal(row.status, 'online');
    assert.equal(row.message, COULD_NOT_REACH_UNPUBLISH);
  } finally { await t.cleanup(); }
});

test('Unpublish that went through, with the list not updated: the truth, never "still online"; Try again clears it', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    const remove = t.records.remove.bind(t.records);
    t.records.remove = async () => { throw new Error('disk full'); };
    await t.controller.unpublishSite(record.siteName);
    assert.equal(t.fake.scripts.has(record.siteName), false, 'down on Cloudflare');
    const row = (await t.controller.settingsProjection()).pages[0];
    assert.equal(row.message, UNPUBLISHED_LIST_STALE);
    assert.equal(row.status, 'unpublished', 'never listed as online');
    assert.notEqual(row.message, COULD_NOT_REACH_UNPUBLISH);
    assert.equal((await t.controller.pageState(t.page.realPath)).kind, 'unpublished', 'the bar doesn\'t say published');
    // Round 3: after a restart (a new controller over the same records), still not online, nowhere
    const restarted = t.makeController();
    restarted.setPublishEntryAvailable(true);
    const after = (await restarted.settingsProjection()).pages[0];
    assert.deepEqual([after.status, after.message], ['unpublished', UNPUBLISHED_LIST_STALE], 'Settings after a restart');
    assert.equal((await restarted.pageState(t.page.realPath)).kind, 'unpublished', 'the bar after a restart');
    assert.equal(await restarted.recordFor(t.page.realPath), undefined, 'no Copy link or Open the page for it');
    assert.equal(await restarted.needsCurrentHash(t.page.realPath), false);
    const opened = t.opened.length;
    await restarted.openSite(record.siteName);
    assert.equal(t.opened.length, opened, 'Open does nothing for a page that is down');
    t.records.remove = remove;
    await restarted.unpublishSite(record.siteName);
    assert.equal((await restarted.settingsProjection()).pages.length, 0, 'Try again: an already-deleted page counts as deleted');
  } finally { await t.cleanup(); }
});

test('Disconnect: pages stay published; their tabs and rows say Connect again (S22); another account can\'t unpublish', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.secrets.map.has(CONNECTION_SECRET_KEY), false);
    assert.ok(t.fake.scripts.has(record.siteName), 'still online');
    assert.equal((await t.controller.pageState(t.page.realPath)).signedOut, true);
    await t.controller.unpublishSite(record.siteName);
    assert.equal((await t.controller.settingsProjection()).pages[0].message, CONNECT_AGAIN);
    // Connected to another account: the record's account is not this one
    t.fake.accounts = [{ id: 'b'.repeat(32), name: 'Someone else' }];
    t.pasted.push(TOKEN);
    await t.controller.startTokenEntry();
    await t.controller.unpublishSite(record.siteName);
    assert.equal((await t.controller.settingsProjection()).pages[0].message, OTHER_ACCOUNT);
  } finally { await t.cleanup(); }
});

test('Disconnect whose keychain delete fails: no throw, Settings drawn again with the line, still connected', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    t.secrets.failDelete = true;
    t.posted.length = 0;
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.posted.length, 1, 'Settings was drawn again');
    assert.equal(t.posted[0].message, DISCONNECT_FAILED);
    assert.equal(t.posted[0].state, 'connected', 'the truth: still connected');
    t.secrets.failDelete = false;
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.posted.at(-1)!.message, null);
    assert.equal(t.posted.at(-1)!.state, 'disconnected');
  } finally { await t.cleanup(); }
});

test('S21: through every flow above, nothing posted to the page or the sheet and no log line holds the token or the account ID', async () => {
  const t = await setup({ pasted: [`n${'9'.repeat(39)}`, WEAK, TOKEN] });
  try {
    t.fake.subdomain = null;
    t.ui.showSheet = driveSheet(t.sheets, [{ subdomain: 'pages-1111' }, {}]) as PublishUi['showSheet'];
    t.fake.failures.push({ path: /assets-upload-session$/, status: 500, times: 10 });
    await t.controller.publishFromBar(t.page);
    assert.equal(t.failures.length, 1, 'the failure line');
    t.fake.failures.length = 0;
    t.ui.showSheet = driveSheet(t.sheets) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    const record = (await t.records.get(t.page.realPath))!;
    await t.controller.unpublishSite(record.siteName);
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    const said = everythingSaid(t);
    for (const secret of [TOKEN, WEAK, ACCOUNT]) assert.ok(!said.includes(secret), 'a secret reached the page, the sheet or the log');
    assert.ok(t.log.length > 0, 'there were log lines to search');
    for (const r of t.fake.requests) {
      if (r.authorization?.includes(TOKEN)) assert.ok(r.path.startsWith('/client/v4/') && !r.path.includes('/assets/upload'), `${r.path} carried the token`);
    }
    assert.ok(!t.fake.allTraffic().includes(TOKEN), 'no URL, query or body carries the token');
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- round 3: nothing reaches the sheet or the upload before PR 5

test('before the whole-window sheet (PR 5): ritemark.page.publish by a direct call, publishPage, the name and Set up all do nothing', async () => {
  const t = await setup({ entry: false, pasted: [TOKEN, TOKEN] });
  try {
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, 0, 'no sheet');
    assert.equal(t.boxes.length, 0, 'no token box');
    assert.deepEqual(t.opened, [], 'no Cloudflare page');
    assert.equal(t.failures.length, 0, 'no failure line either: it simply isn\'t there');
    await t.controller.handleSettingsMessage({ type: 'publish:startTokenEntry' });
    await t.controller.handleSettingsMessage({ type: 'publish:connect' });
    assert.equal(t.boxes.length, 0, 'Settings\' Set up does nothing');
    assert.equal(t.fake.requests.length, 0, 'nothing reached Cloudflare');
    // Connected some other way (another window, before this build): still no upload, no name
    assert.equal(await t.host.connectWithToken(TOKEN), 'connected');
    const plan = await t.project.gather();
    await assert.rejects(t.controller.publishPage({ plan, consent: 'sheet', pagePart: 'harbour-programme-7f3a2c' }), (e: unknown) => e instanceof PublishError && e.message === SWITCHED_OFF);
    assert.deepEqual(await t.controller.chooseSubdomain('pages-1111'), { error: SWITCHED_OFF });
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, 0, 'connected, and still no sheet');
    assert.equal(uploads(t).length, 0, 'nothing uploaded');
    assert.equal(t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session') || r.method === 'PUT').length, 0, 'no deploy, no name');
    assert.equal(await t.records.get(t.page.realPath), undefined);
    // Once PR 5's sheet is there, the same call publishes
    const drawn = t.posted.length;
    t.controller.setPublishEntryAvailable(true);
    for (let i = 0; i < 100 && t.posted.length === drawn; i++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(t.posted.at(-1)?.entryAvailable, true, 'Settings is drawn again, now offering Set up');
    await t.controller.publishFromBar(t.page);
    assert.equal(t.sheets.length, 1);
    assert.ok(await t.records.get(t.page.realPath), t.failures.join(' | '));
  } finally { await t.cleanup(); }
});

test('Settings ▸ Web pages before PR 5: no Set up, and no card for someone with nothing to take down', async () => {
  const t = await setup({ entry: false, pasted: [TOKEN] });
  try {
    const before = await t.controller.settingsProjection();
    assert.equal(before.enabled, true);
    assert.equal(before.entryAvailable, false);
    assert.equal(offersSetUp(before), false, 'Set up isn\'t offered');
    assert.equal(showsWebPagesCard(before), false, 'the card is hidden: nothing to set up, forget or take down');
    // Someone connected already (another window) keeps Disconnect; someone with a page keeps Unpublish
    assert.equal(showsWebPagesCard({ ...before, state: 'connected' }), true);
    assert.equal(showsWebPagesCard({ ...before, pages: [{ id: 'a-7f3a2c', name: 'a.html', address: 'https://a-7f3a2c.x.workers.dev/', status: 'online', slow: false, message: null }] }), true);
    t.controller.setPublishEntryAvailable(true);
    const after = await t.controller.settingsProjection();
    assert.equal(offersSetUp(after), true);
    assert.equal(showsWebPagesCard(after), true);
    t.flag.on = false;
    assert.equal(offersSetUp(await t.controller.settingsProjection()), false, 'and never with the flag off');
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- round 3: the two guards, each on its own

test('publishPage: "unchanged-update" with a record but a changed file list is refused before anything is sent', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    const record = await publishedOnce(t);
    await t.project.write('Harbour programme.html', '<link rel="stylesheet" href="style.css"><h1>Harbour</h1><img src="img/a.png"><img src="img/b.png">');
    await t.project.write('img/b.png', new Uint8Array([1, 2]));
    const plan = await t.project.gather();
    assert.equal(plan.keyHits.length, 0, 'nothing key-shaped: only the list guard stands');
    assert.ok(plan.files.length > record.files.length, 'a new file goes');
    const sent = uploads(t).length;
    const sessions = t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session')).length;
    await assert.rejects(t.controller.publishPage({ plan, consent: 'unchanged-update' }), (e: unknown) => e instanceof PublishError && /What goes changed/.test(e.message));
    assert.equal(uploads(t).length, sent, 'nothing uploaded');
    assert.equal(t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session')).length, sessions, 'no upload session');
    assert.equal((await t.records.get(t.page.realPath))?.contentHash, record.contentHash, 'the record is the first publish\'s');
  } finally { await t.cleanup(); }
});

test('the sheet answering for another plan than the one prepared publishes nothing', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    t.ui.showSheet = (async (req: SheetRequest) => {
      const result = await driveSheet(t.sheets)(req);
      // A different plan object (a copy of it) comes back with the press
      return result.kind === 'cancel' ? result : { ...result, plan: { ...result.plan } };
    }) as PublishUi['showSheet'];
    await t.controller.publishFromBar(t.page);
    assert.deepEqual(t.sheets[0].replies, ['close'], 'the press itself was accepted');
    assert.equal(await t.records.get(t.page.realPath), undefined, 'not published');
    assert.equal(t.fake.requests.filter((r) => r.path.endsWith('/assets-upload-session')).length, 0, 'nothing sent');
    assert.equal(t.fake.scripts.size, 0);
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- a new address's first answer (A4, M6)

/** Holds the host's wait for a new address until `release`, counting the waits; the real wait runs after. */
function holdWait(t: T) {
  const original = t.host.waitUntilOnline.bind(t.host);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const held = { calls: 0, release, started: Promise.resolve() };
  let started!: () => void;
  // A publish that never waits fails here, rather than hanging the run
  held.started = Promise.race([
    new Promise<void>((resolve) => { started = resolve; }),
    new Promise<void>((_, reject) => { setTimeout(() => reject(new Error('the publish never waited for its new address')), 5_000).unref(); }),
  ]);
  t.host.waitUntilOnline = async (address, options) => {
    held.calls++;
    started();
    await gate;
    return original(address, options);
  };
  return held;
}

test('a first publish on a name registered in the sheet: "Publishing…" holds with the new-address line until the page answers (M6)', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.subdomain = null; // a new account: the sheet registers its workers.dev name
    t.fake.answerAfterChecks = 6; // and its first page stays silent for a while, as M6 measured (121 s)
    const held = holdWait(t);
    await t.controller.startTokenEntry();
    const going = t.controller.publishFromBar(t.page);
    await held.started;
    assert.deepEqual(t.waits.map((w) => w.line), [NEW_ADDRESS_WAIT], 'the line at once: the name is new');
    assert.equal(NEW_ADDRESS_WAIT, 'Your address is new. It can take a couple of minutes before the page opens.');
    const during = await t.controller.pageState(t.page.realPath);
    assert.equal(during.kind, 'publishing', 'never Published before the page opens');
    assert.equal(during.line, NEW_ADDRESS_WAIT);
    assert.match(during.address ?? '', /^https:\/\/[a-z0-9-]+\.pages-\d{4}\.workers\.dev\//, 'the record is written: the upload went through');
    assert.equal(t.waits[0].closed, false);
    held.release();
    await going;
    assert.equal(t.waits[0].closed, true, 'the line closes by itself when the page answers');
    assert.equal(t.waits.length, 1, 'once');
    const after = await t.controller.pageState(t.page.realPath);
    assert.equal(after.kind, 'published');
    assert.equal(after.line, null);
    assert.deepEqual(t.failures, [], 'a slow new address is never a failure');
    assert.ok(t.log.some((l) => / the new address answers$/.test(l)));
  } finally { await t.cleanup(); }
});

test('a first publish on a name the account had: no line while the page answers at once; the line after 10 s when it doesn\'t', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await publishedOnce(t);
    assert.deepEqual(t.waits, [], 'answered at once: nothing to say');
    await t.controller.unpublishSite((await t.records.get(t.page.realPath))!.siteName);
    t.fake.answerAfterChecks = 8; // 16 s of silence
    await t.controller.publishFromBar(t.page);
    assert.deepEqual(t.waits.map((w) => [w.line, w.closed]), [[NEW_ADDRESS_WAIT, true]], 'shown after 10 s, closed when it answered');
    assert.equal((await t.controller.pageState(t.page.realPath)).kind, 'published');
    assert.deepEqual(t.failures, []);
  } finally { await t.cleanup(); }
});

test('the wait\'s cap: Published all the same, the line closed, no failure; an update never waits', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.answerAfterChecks = 1_000_000;
    const record = await publishedOnce(t);
    assert.deepEqual(t.waits.map((w) => w.closed), [true]);
    const state = await t.controller.pageState(t.page.realPath);
    assert.equal(state.kind, 'published', 'the upload went through: Published, never a failure');
    assert.deepEqual(t.failures, []);
    assert.ok(t.log.some((l) => /did not answer before the wait ended/.test(l)));
    // Update the page, with the same files: straight up, and no wait for an address that already answers (M8)
    const held = holdWait(t);
    held.release();
    await t.controller.publishFromBar(t.page);
    assert.equal(held.calls, 0, 'an update never waits');
    assert.equal((await t.records.get(t.page.realPath))?.siteName, record.siteName);
  } finally { await t.cleanup(); }
});

test('Unpublish from Settings during the wait ends it: the page is down, the line closed, the bar shows Publish', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.subdomain = null;
    t.fake.answerAfterChecks = 1_000_000;
    const held = holdWait(t);
    await t.controller.startTokenEntry();
    const going = t.controller.publishFromBar(t.page);
    await held.started;
    const record = (await t.records.get(t.page.realPath))!;
    t.fake.answerAfterChecks = 0;
    await t.controller.unpublishSite(record.siteName);
    const before = t.fake.requests.length;
    held.release();
    await going;
    assert.ok(t.fake.requests.length - before <= 1, 'the wait stopped at once, not at its cap');
    assert.equal(t.waits[0].closed, true);
    assert.equal((await t.controller.pageState(t.page.realPath)).kind, 'unpublished');
    assert.ok(t.log.some((l) => /the wait for the new address was stopped/.test(l)));
  } finally { await t.cleanup(); }
});

test('the bar\'s state needs the gather only for a page shown as published', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    assert.equal(await t.controller.needsCurrentHash(t.page.realPath), false, 'never published');
    const record = await publishedOnce(t);
    assert.equal(await t.controller.needsCurrentHash(t.page.realPath), true, 'published: "· changed" needs it');
    await t.controller.unpublishSite(record.siteName);
    assert.equal(await t.controller.needsCurrentHash(t.page.realPath), false, 'unpublished');
  } finally { await t.cleanup(); }
});

void (async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${name}\n  ${String((error as Error)?.stack ?? error).split('\n').slice(0, 4).join('\n  ')}`);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} passed`);
  if (failed) process.exitCode = 1;
})();
