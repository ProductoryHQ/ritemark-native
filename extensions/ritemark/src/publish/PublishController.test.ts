/**
 * Sprint 149, PR 4: the publish controller with the real Cloudflare host against the local fake server. Settings ▸
 * Sharing ▸ Web pages, the token box's three outcomes, the flag, the page's states, and S20a/S21: no message to or
 * from the page, no log line and no projection carries the token.
 *
 * Run: npx tsx src/publish/PublishController.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CloudflareAccount, CONNECTION_SECRET_KEY, type SecretsLike } from './cloudflare/account';
import { CloudflareClient, type FetchLike } from './cloudflare/client';
import { CloudflareHost, CONNECT_AGAIN, COULD_NOT_REACH_UNPUBLISH } from './cloudflare/CloudflareHost';
import { SiteLedger } from './cloudflare/siteLedger';
import { FakeCloudflare } from './cloudflare/testing/fakeCloudflare';
import { contentHash } from './cloudflare/assets';
import { NAME_TAKEN, OTHER_ACCOUNT, PublishController, SLOW_UNPUBLISH, TOKEN_BOX, TOKEN_TEMPLATE_URL, TOKEN_WORDS } from './PublishController';
import { decodeSettingsRequest, type WebPagesSettingsProjection } from './settingsProtocol';
import type { PublishAsset } from './host';

const TOKEN = `t${'0123456789abcdef'.repeat(2)}Xy_${Date.now().toString(36)}`;
const WEAK = `w${'fedcba9876543210'.repeat(2)}Zq_${Date.now().toString(36)}`;
const ACCOUNT = 'a'.repeat(32);

const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

class MemorySecrets implements SecretsLike {
  readonly map = new Map<string, string>();
  async get(key: string) { return this.map.get(key); }
  async store(key: string, value: string) { this.map.set(key, value); }
  async delete(key: string) { this.map.delete(key); }
}

const realFetch: FetchLike = (url, init) => fetch(url, init as RequestInit);

function assets(): PublishAsset[] {
  return [
    { urlPath: '/index.html', bytes: Buffer.from('<h1>Harbour</h1>') },
    { urlPath: '/img/a.png', bytes: Buffer.from([1, 2, 3]) },
  ];
}

async function setup(options: { flag?: boolean; pasted?: string[]; goneAfterChecks?: number } = {}) {
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ritemark-publish-'));
  const ledger = new SiteLedger(path.join(dir, 'publish', 'v1'));
  const posted: WebPagesSettingsProjection[] = [];
  const opened: string[] = [];
  const boxes: Array<{ title: string; prompt: string; lines: Array<string | null> }> = [];
  const ready: boolean[] = [];
  const pageEvents: string[] = [];
  const flag = { on: options.flag ?? true };
  const pasted = [...(options.pasted ?? [])];
  const controller = new PublishController({
    host,
    ledger,
    ui: {
      openExternal: async (url) => { opened.push(url); return true; },
      // The host's password box: each paste is checked; a line keeps the box open for the next paste
      askToken: async ({ title, prompt, check }) => {
        const box = { title, prompt, lines: [] as Array<string | null> };
        boxes.push(box);
        while (pasted.length) {
          const line = await check(pasted.shift()!);
          box.lines.push(line);
          if (line === null) return;
        }
      },
    },
    isFeatureEnabled: () => flag.on,
    postSettings: (p) => posted.push(p),
    setReady: (r) => ready.push(r),
    onPageState: (p) => pageEvents.push(p),
    log: (l) => log.push(l),
    now: () => 5_000,
  });
  const cleanup = async () => { await fake.stop(); await fs.rm(dir, { recursive: true, force: true }); };
  return { fake, secrets, account, host, ledger, controller, posted, opened, boxes, ready, pageEvents, flag, log, cleanup, dir, pasted };
}

/** Everything that left the host for the page, and every log line. */
function everythingSaid(t: { posted: unknown[]; log: string[] }): string {
  return JSON.stringify(t.posted) + '\n' + t.log.join('\n');
}

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

test('Use a token: Cloudflare\'s page and the host\'s own box at once, with the lead\'s words; a good token connects', async () => {
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

// ---------------------------------------------------------------- the flag (S28b)

test('flag off: no token box, no connect, no publish; the list, Open, Unpublish and Disconnect still work', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    const site = await t.controller.publishPage({ pagePath: '/p/Harbour programme.html', pageName: 'Harbour programme.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'harbour-programme-7f3a2c' });
    t.flag.on = false;
    t.pasted.push(TOKEN);
    await t.controller.handleSettingsMessage({ type: 'publish:startTokenEntry' });
    await t.controller.handleSettingsMessage({ type: 'publish:connect' });
    assert.equal(t.boxes.length, 1, 'no second box');
    await assert.rejects(t.controller.publishPage({ pagePath: '/p/x.html', pageName: 'x.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'x-111111' }));
    const projection = await t.controller.settingsProjection();
    assert.equal(projection.enabled, false);
    assert.equal(projection.pages.length, 1, 'the page stays listed');
    await t.controller.handleSettingsMessage({ type: 'publish:open', id: site.name });
    assert.equal(t.opened.at(-1), site.address);
    await t.controller.handleSettingsMessage({ type: 'publish:unpublish', id: site.name });
    assert.equal((await t.controller.settingsProjection()).pages.length, 0, 'Unpublish works with the flag off');
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.secrets.map.size, 0, 'Disconnect works with the flag off');
  } finally { await t.cleanup(); }
});

test('ritemark.publish.ready: only with the flag on and the sheet registered (PR 3)', async () => {
  const t = await setup();
  try {
    t.controller.refreshReady();
    assert.equal(t.ready.at(-1), false, 'no sheet yet: Publish never shows');
    t.controller.setPublishEntryAvailable(true);
    assert.equal(t.ready.at(-1), true);
    t.flag.on = false;
    t.controller.refreshReady();
    assert.equal(t.ready.at(-1), false);
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------- Settings' list and the states (R7, R9)

test('published pages are listed with Open and Unpublish; the record stays out of the project (S30, S32)', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    const site = await t.controller.publishPage({ pagePath: '/p/Harbour programme.html', pageName: 'Harbour programme.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'harbour-programme-7f3a2c' });
    const p = await t.controller.settingsProjection();
    assert.deepEqual(p.pages, [{ id: 'harbour-programme-7f3a2c', name: 'Harbour programme.html', address: site.address, status: 'online', slow: false, message: null }]);
    const stored = await fs.readFile(path.join(t.dir, 'publish', 'v1', 'cloudflare-pages.json'), 'utf8');
    assert.ok(!stored.includes(TOKEN), 'the record holds no token');
    const state = await t.controller.pageState('/p/Harbour programme.html', contentHash(assets()));
    assert.equal(state.kind, 'published');
    assert.equal(state.changed, false);
    const changed = await t.controller.pageState('/p/Harbour programme.html', 'another-hash');
    assert.equal(changed.changed, true, 'Published · changed');
  } finally { await t.cleanup(); }
});

test('the workers.dev name: suggested once while the account has none; taken → the lead\'s line (S28a)', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    t.fake.subdomain = null;
    await t.controller.startTokenEntry();
    const sheet = t.controller.sheetAccount();
    assert.equal(sheet.accountName, 'Mari Tamm');
    assert.match(sheet.suggestion ?? '', /^pages-\d{4}$/);
    assert.deepEqual(await t.controller.chooseSubdomain('pages-1111'), { error: NAME_TAKEN });
    assert.deepEqual(await t.controller.chooseSubdomain('pages-4821'), { name: 'pages-4821' });
    assert.equal(t.controller.sheetAccount().suggestion, null, 'the row does not come back');
  } finally { await t.cleanup(); }
});

test('Unpublish: the row waits, the 10 s line shows, and the page leaves the list only when its address is gone', async () => {
  const t = await setup({ pasted: [TOKEN], goneAfterChecks: 8 });
  try {
    await t.controller.startTokenEntry();
    const site = await t.controller.publishPage({ pagePath: '/p/Harbour programme.html', pageName: 'Harbour programme.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'harbour-programme-7f3a2c' });
    t.posted.length = 0;
    await t.controller.handleSettingsMessage({ type: 'publish:unpublish', id: site.name });
    assert.equal(t.posted[0].pages[0].status, 'unpublishing');
    assert.ok(t.posted.some((p) => p.pages[0]?.slow), 'slow after 10 s');
    assert.equal(t.posted.at(-1)!.pages.length, 0);
    assert.equal(SLOW_UNPUBLISH, 'Cloudflare is still taking the page down.');
    assert.equal((await t.controller.pageState('/p/Harbour programme.html')).kind, 'unpublished', 'the bar shows Publish again');
  } finally { await t.cleanup(); }
});

test('Unpublish that fails keeps the page listed with "…The page is still online."', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    const site = await t.controller.publishPage({ pagePath: '/p/a.html', pageName: 'a.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'a-111111' });
    t.fake.failures.push({ method: 'DELETE', path: /scripts/, status: 500, times: 10 });
    await t.controller.unpublishSite(site.name);
    const row = (await t.controller.settingsProjection()).pages[0];
    assert.equal(row.status, 'online');
    assert.equal(row.message, COULD_NOT_REACH_UNPUBLISH);
  } finally { await t.cleanup(); }
});

test('Disconnect: pages stay published; their tabs and rows say Connect again (S22); another account can\'t unpublish', async () => {
  const t = await setup({ pasted: [TOKEN] });
  try {
    await t.controller.startTokenEntry();
    const site = await t.controller.publishPage({ pagePath: '/p/a.html', pageName: 'a.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'a-111111' });
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    assert.equal(t.secrets.map.has(CONNECTION_SECRET_KEY), false);
    assert.ok(t.fake.scripts.has(site.name), 'still online');
    assert.equal((await t.controller.pageState('/p/a.html')).signedOut, true);
    await t.controller.unpublishSite(site.name);
    assert.equal((await t.controller.settingsProjection()).pages[0].message, CONNECT_AGAIN);
    // Connected to another account: the record's account is not this one
    t.fake.accounts = [{ id: 'b'.repeat(32), name: 'Someone else' }];
    t.pasted.push(TOKEN);
    await t.controller.startTokenEntry();
    await t.controller.unpublishSite(site.name);
    assert.equal((await t.controller.settingsProjection()).pages[0].message, OTHER_ACCOUNT);
  } finally { await t.cleanup(); }
});

test('S21: through every flow above, nothing posted to the page and no log line holds the token or the account ID', async () => {
  const t = await setup({ pasted: [`n${'9'.repeat(39)}`, WEAK, TOKEN] });
  try {
    await t.controller.startTokenEntry();
    t.fake.failures.push({ path: /assets-upload-session$/, status: 500, times: 10 });
    await assert.rejects(t.controller.publishPage({ pagePath: '/p/a.html', pageName: 'a.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'a-111111' }));
    t.fake.failures.length = 0;
    const site = await t.controller.publishPage({ pagePath: '/p/a.html', pageName: 'a.html', request: { assets: assets(), pageUrlPath: '/index.html' }, siteName: 'a-111111' });
    await t.controller.unpublishSite(site.name);
    await t.controller.handleSettingsMessage({ type: 'publish:disconnect' });
    const said = everythingSaid(t);
    for (const secret of [TOKEN, WEAK, ACCOUNT]) assert.ok(!said.includes(secret), 'a secret reached the page or the log');
    assert.ok(t.log.length > 0, 'there were log lines to search');
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
