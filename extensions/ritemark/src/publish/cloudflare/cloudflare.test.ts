/**
 * Sprint 149, PR 4: the Cloudflare client, the connection and the host, against a local fake server on 127.0.0.1
 * (`testing/fakeCloudflare.ts`). No real Cloudflare call and no real token: A4's live run (M1–M11) is separate.
 *
 * Run: npx tsx src/publish/cloudflare/cloudflare.test.ts
 */

import assert from 'node:assert/strict';
import { CloudflareAccount, CONNECTION_SECRET_KEY, type SecretsLike } from './account';
import { assetHash, buildManifest, cleanName, contentHash, MAX_FILE_BYTES, NOINDEX_HEADERS, siteAddress, siteNameFor, slug, suggestSubdomain } from './assets';
import { CloudflareClient, CLOUDFLARE_API, type FetchLike } from './client';
import { CloudflareHost, COULD_NOT_REACH_PUBLISH, COULD_NOT_REACH_UNPUBLISH } from './CloudflareHost';
import { redact } from './redact';
import { FakeCloudflare } from './testing/fakeCloudflare';
import { PublishError, type PublishAsset } from '../host';

// Test tokens are made here, at run time, so no token-shaped string sits in the repo
const TOKEN = `t${'0123456789abcdef'.repeat(2)}Xy_${Date.now().toString(36)}`;
const WEAK = `w${'fedcba9876543210'.repeat(2)}Zq_${Date.now().toString(36)}`;
const BLIND = `b${'0011223344556677'.repeat(2)}Qq_${Date.now().toString(36)}`;
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
const noSleep = async () => {};

async function setup(options: { log?: string[] } = {}) {
  const fake = await new FakeCloudflare().start();
  fake.tokens.set(TOKEN, 'ok');
  fake.tokens.set(WEAK, 'no-publish');
  fake.tokens.set(BLIND, 'no-accounts');
  const secrets = new MemorySecrets();
  const log = options.log ?? [];
  const makeClient = (token: () => string) => new CloudflareClient({
    fetch: realFetch, token, apiBase: fake.apiBase, addressBase: fake.base, sleep: noSleep, timeoutMs: 5_000, log: (l) => log.push(l),
  });
  const account = new CloudflareAccount({ secrets, makeClient, now: () => 1_000 });
  let clock = 0;
  const host = new CloudflareHost(account, {
    log: (l) => log.push(l), sleep: async (ms) => { clock += ms; }, now: () => clock, slowAfterMs: 10_000, pollMs: 2_000, unpublishDeadlineMs: 60_000,
  });
  return { fake, secrets, account, host, log };
}

function page(extra: PublishAsset[] = []): PublishAsset[] {
  return [
    { urlPath: '/index.html', bytes: Buffer.from('<h1>Harbour</h1><img src="img/a.png">') },
    { urlPath: '/img/a.png', bytes: Buffer.from([137, 80, 78, 71, 1, 2, 3]) },
    { urlPath: '/style.css', bytes: Buffer.from('body{color:#123}') },
    ...extra,
  ];
}

// ---------------------------------------------------------------- pure parts

test('names: a file name made web-safe, the random part at its end, a neutral workers.dev name', async () => {
  assert.equal(slug('Harbour programme.html'), 'harbour-programme');
  assert.equal(slug('Õppekava 2026!.html'), 'oppekava-2026');
  assert.equal(slug('....html'), 'page');
  assert.match(siteNameFor('Harbour programme.html', () => Buffer.from([0x7f, 0x3a, 0x2c])), /^harbour-programme-7f3a2c$/);
  assert.match(suggestSubdomain(), /^pages-\d{4}$/);
  assert.equal(cleanName('  My Pages!  '), 'my-pages');
  assert.equal(cleanName('---'), null);
  assert.equal(siteAddress('harbour-programme-7f3a2c', 'pages-4821'), 'https://harbour-programme-7f3a2c.pages-4821.workers.dev/');
});

test('the manifest: hashes are stable, over-limit files stop everything before a call (S15)', async () => {
  const { manifest } = buildManifest(page());
  assert.equal(Object.keys(manifest).length, 3);
  assert.equal(manifest['/index.html'].hash, assetHash(page()[0].bytes, '/index.html'));
  assert.equal(contentHash(page()), contentHash([...page()].reverse()), 'the order of the files does not change the hash');
  assert.notEqual(contentHash(page()), contentHash(page([{ urlPath: '/new.png', bytes: Buffer.from([1]) }])));
  assert.throws(() => buildManifest([{ urlPath: '/big.mp4', bytes: new Uint8Array(MAX_FILE_BYTES + 1) }]), (e: unknown) => e instanceof PublishError && e.code === 'too-big');
  assert.throws(() => buildManifest([{ urlPath: '/../x', bytes: new Uint8Array(1) }]), PublishError);
});

test('redact: the token, the account ID, any JWT and any Bearer value', async () => {
  const jwt = 'eyJhbGciOiJub25lIn0.eyJ4IjoxfQ.c2ln';
  const out = redact(`token ${TOKEN} account ${ACCOUNT} jwt ${jwt} header Bearer abc.def`, [TOKEN, ACCOUNT]);
  assert.ok(!out.includes(TOKEN) && !out.includes(ACCOUNT) && !out.includes(jwt) && !out.includes('abc.def'), out);
});

test('the client sends credentials only to api.cloudflare.com or a 127.0.0.1 test server', async () => {
  assert.throws(() => new CloudflareClient({ fetch: realFetch, token: () => TOKEN, apiBase: 'https://evil.example/client/v4' }));
  assert.throws(() => new CloudflareClient({ fetch: realFetch, token: () => TOKEN, apiBase: 'http://localhost:1/client/v4' }));
  assert.throws(() => new CloudflareClient({ fetch: realFetch, token: () => TOKEN, addressBase: 'https://evil.example' }));
  assert.doesNotThrow(() => new CloudflareClient({ fetch: realFetch, token: () => TOKEN, apiBase: CLOUDFLARE_API }));
});

// ---------------------------------------------------------------- the token (R6, S20)

test('a token that works connects: the account and its workers.dev name, stored only in SecretStorage', async () => {
  const { fake, secrets, account } = await setup();
  try {
    assert.equal(await account.connectWithToken(`  Bearer ${TOKEN}  `), 'connected');
    assert.deepEqual(account.snapshot(), { state: 'connected', accountName: 'Mari Tamm', subdomain: 'pages-4821' });
    assert.ok(!JSON.stringify(account.snapshot()).includes(TOKEN), 'the snapshot holds no token');
    const stored = JSON.parse(secrets.map.get(CONNECTION_SECRET_KEY)!);
    assert.equal(stored.kind, 'token');
    assert.equal(stored.token, TOKEN);
    assert.equal(stored.accountId, ACCOUNT);
    assert.deepEqual([...secrets.map.keys()], [CONNECTION_SECRET_KEY], 'one entry, nothing else');
  } finally { await fake.stop(); }
});

test('a refused token, a token that can\'t publish, a token that sees no account: nothing stored', async () => {
  const { fake, secrets, account } = await setup();
  try {
    assert.equal(await account.connectWithToken(`n${'9'.repeat(39)}`), 'refused');
    assert.equal(await account.connectWithToken(WEAK), 'cannot-publish');
    assert.equal(await account.connectWithToken(BLIND), 'cannot-publish');
    assert.equal(await account.connectWithToken('not a token\r\nX-Evil: 1'), 'refused', 'a malformed paste never reaches the network');
    assert.equal(secrets.map.size, 0);
    assert.equal(account.snapshot().state, 'disconnected');
  } finally { await fake.stop(); }
});

test('Cloudflare unreachable: the token check says so, after its retries, and stores nothing', async () => {
  const { fake, secrets, account } = await setup();
  try {
    fake.failures.push({ path: /\/accounts$/, drop: true, times: 10 });
    assert.equal(await account.connectWithToken(TOKEN), 'unreachable');
    assert.equal(fake.requests.filter((r) => r.path.endsWith('/accounts')).length, 4, 'the first try and three retries');
    assert.equal(secrets.map.size, 0);
  } finally { await fake.stop(); }
});

test('an account with no workers.dev name connects with none (M2): the sheet asks once', async () => {
  const { fake, account } = await setup();
  try {
    fake.subdomain = null;
    assert.equal(await account.connectWithToken(TOKEN), 'connected');
    assert.equal(account.snapshot().subdomain, null);
  } finally { await fake.stop(); }
});

test('disconnect deletes the entry; the snapshot says disconnected', async () => {
  const { fake, secrets, account } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    await account.disconnect();
    assert.equal(secrets.map.has(CONNECTION_SECRET_KEY), false);
    assert.equal(account.snapshot().state, 'disconnected');
    assert.throws(() => account.token(), PublishError);
  } finally { await fake.stop(); }
});

test('a stored entry of another kind or a broken one reads as not connected', async () => {
  const { fake, secrets, account } = await setup();
  try {
    secrets.map.set(CONNECTION_SECRET_KEY, JSON.stringify({ v: 1, kind: 'oauth', accessToken: 'x' }));
    await account.reload();
    assert.equal(account.snapshot().state, 'disconnected');
  } finally { await fake.stop(); }
});

// ---------------------------------------------------------------- the workers.dev name (R5, S28a)

test('the taken name: "This name is taken. Try another." and nothing changes; a free one is kept', async () => {
  const { fake, account, host } = await setup();
  try {
    fake.subdomain = null;
    await account.connectWithToken(TOKEN);
    await assert.rejects(host.chooseSubdomain('pages-1111'), (e: unknown) => e instanceof PublishError && e.code === 'name-taken' && e.message === 'This name is taken. Try another.');
    assert.equal(account.snapshot().subdomain, null);
    await assert.rejects(host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' }), PublishError, 'Publish waits for the name');
    assert.equal(await host.chooseSubdomain('Pages 4821'), 'pages-4821');
    assert.equal(account.snapshot().subdomain, 'pages-4821');
  } finally { await fake.stop(); }
});

// ---------------------------------------------------------------- publish, update, unpublish (R7)

test('publish: the upload goes with the upload JWT, the deploy carries noindex, the address answers with noindex (S24)', async () => {
  const { fake, account, host } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    const site = await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    assert.equal(site.address, 'https://harbour-programme-7f3a2c.pages-4821.workers.dev/');
    const script = fake.scripts.get('harbour-programme-7f3a2c')!;
    assert.equal(script.headers, NOINDEX_HEADERS);
    assert.equal(script.enabled, true);
    assert.equal(script.previews, false, 'previews off (M5)');
    const uploads = fake.requests.filter((r) => r.path.includes('/workers/assets/upload'));
    assert.equal(uploads.length, 2, 'three files in buckets of two');
    for (const u of uploads) assert.ok(u.authorization && !u.authorization.includes(TOKEN), 'the upload never carries the token');
    const put = fake.requests.find((r) => r.method === 'PUT' && r.path.endsWith('/scripts/harbour-programme-7f3a2c'))!;
    assert.equal(put.query.excludeScript, 'true', 'metadata only (M4)');
    const res = await fetch(`${fake.base}/__site/harbour-programme-7f3a2c.pages-4821.workers.dev/`);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.match(await res.text(), /Harbour/);
    const missing = await fetch(`${fake.base}/__site/harbour-programme-7f3a2c.pages-4821.workers.dev/nothing.png`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex', 'noindex on a 404 too (M7)');
  } finally { await fake.stop(); }
});

test('Wrangler\'s single-file upload mode works too', async () => {
  const { fake, account, host } = await setup();
  try {
    fake.singleUploads = true;
    await account.connectWithToken(TOKEN);
    await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    assert.equal(fake.requests.filter((r) => /\/workers\/assets\/upload\/[0-9a-f]{32}$/.test(r.path)).length, 3);
  } finally { await fake.stop(); }
});

test('update keeps the address and sends only what changed; a file no longer used is gone (S26, M8)', async () => {
  const { fake, account, host } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    const before = fake.requests.length;
    const changed = [{ urlPath: '/index.html', bytes: Buffer.from('<h1>Harbour, updated</h1>') }, page()[2]];
    const site = await host.publish('harbour-programme-7f3a2c', { assets: changed, pageUrlPath: '/index.html' });
    assert.equal(site.address, 'https://harbour-programme-7f3a2c.pages-4821.workers.dev/');
    const uploads = fake.requests.slice(before).filter((r) => r.path.includes('/workers/assets/upload'));
    assert.equal(uploads.length, 1, 'only the changed page goes up');
    assert.equal((await fetch(`${fake.base}/__site/harbour-programme-7f3a2c.pages-4821.workers.dev/img/a.png`)).status, 404, 'the picture is gone');
  } finally { await fake.stop(); }
});

test('retries: a 429 and a 500 are tried again; a dropped upload is tried again', async () => {
  const { fake, account, host } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    fake.failures.push({ path: /assets-upload-session$/, status: 429, times: 1 });
    fake.failures.push({ method: 'PUT', path: /\/scripts\/[a-z0-9-]+$/, status: 503, times: 2 });
    fake.failures.push({ path: /\/workers\/assets\/upload$/, drop: true, times: 1 });
    await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    assert.ok(fake.scripts.has('harbour-programme-7f3a2c'));
  } finally { await fake.stop(); }
});

test('a publish that keeps failing reads "…The page is still on this computer." and names no secret (S29)', async () => {
  const log: string[] = [];
  const { fake, account, host } = await setup({ log });
  try {
    await account.connectWithToken(TOKEN);
    fake.failures.push({ path: /assets-upload-session$/, status: 500, times: 10 });
    await assert.rejects(host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' }),
      (e: unknown) => e instanceof PublishError && e.message === COULD_NOT_REACH_PUBLISH);
    fake.failures.length = 0;
    // A refusal whose text echoes the Authorization header: the log must not hold the token
    fake.tokens.set(TOKEN, 'no-publish');
    await assert.rejects(host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' }), PublishError);
    const all = log.join('\n');
    assert.ok(all.includes('Authentication error'), 'Cloudflare\'s own text reached the log');
    assert.ok(!all.includes(TOKEN), 'but never the token');
    assert.ok(!all.includes(ACCOUNT), 'nor the account ID');
  } finally { await fake.stop(); }
});

test('unpublish resolves only once the address stops answering; the 10 s line comes on the way (S28, M9)', async () => {
  const { fake, account, host } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    const site = await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    fake.goneAfterChecks = 7; // still cached for 7 checks, 2 s apart
    let slow = 0;
    await host.unpublish(site.name, site.address, { onSlow: () => { slow++; } });
    assert.equal(slow, 1, '"Cloudflare is still taking the page down." once');
    assert.equal(fake.scripts.has(site.name), false);
    const checks = fake.requests.filter((r) => r.path.startsWith('/__site/'));
    assert.equal(checks.length, 8);
    for (const c of checks) assert.equal(c.authorization, null, 'the address check carries no credentials');
  } finally { await fake.stop(); }
});

test('unpublish that never sees the page go says "…The page is still online."; a failed delete too', async () => {
  const { fake, account, host } = await setup();
  try {
    await account.connectWithToken(TOKEN);
    const site = await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    fake.goneAfterChecks = 1_000;
    await assert.rejects(host.unpublish(site.name, site.address), (e: unknown) => e instanceof PublishError && e.code === 'still-online' && e.message === COULD_NOT_REACH_UNPUBLISH);
    const second = await host.publish('appendix-111111', { assets: page(), pageUrlPath: '/index.html' });
    fake.failures.push({ method: 'DELETE', path: /\/scripts\//, status: 500, times: 10 });
    await assert.rejects(host.unpublish(second.name, second.address), (e: unknown) => e instanceof PublishError && e.message === COULD_NOT_REACH_UNPUBLISH);
    assert.ok(fake.scripts.has(second.name), 'the page is still there, as the line says');
  } finally { await fake.stop(); }
});

test('S21: across a connect, a publish, an update, a failure and an unpublish, the token is only ever in the API\'s Authorization header', async () => {
  const log: string[] = [];
  const { fake, account, host } = await setup({ log });
  try {
    await account.connectWithToken(TOKEN);
    const site = await host.publish('harbour-programme-7f3a2c', { assets: page(), pageUrlPath: '/index.html' });
    fake.failures.push({ path: /assets-upload-session$/, status: 500, times: 1 });
    await host.publish(site.name, { assets: page(), pageUrlPath: '/index.html' });
    await host.unpublish(site.name, site.address);
    assert.ok(!fake.allTraffic().includes(TOKEN), 'no URL, query or body carries the token');
    for (const r of fake.requests) {
      if (r.authorization?.includes(TOKEN)) assert.ok(r.path.startsWith('/client/v4/') && !r.path.includes('/assets/upload'), `${r.path} carried the token`);
    }
    assert.ok(!log.join('\n').includes(TOKEN));
  } finally { await fake.stop(); }
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
