/**
 * Sprint 127 R5: conditional feed requests. No network — `fetch` is stubbed.
 * Run: npx tsx src/ai/modelCatalog/remoteSource.test.ts
 */

import * as assert from 'assert';
import type * as vscode from 'vscode';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { fetchRemoteCatalog, getCachedCatalog, REMOTE_URL } from './remoteSource';

let failures = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

class MemoryMemento {
  private readonly values = new Map<string, unknown>();
  keys(): readonly string[] { return [...this.values.keys()]; }
  get<T>(key: string, fallback?: T): T | undefined {
    return this.values.has(key) ? this.values.get(key) as T : fallback;
  }
  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
    return Promise.resolve();
  }
}

interface Call { url: string; ifNoneMatch: string | null }

function stubFetch(calls: Call[], reply: () => { status: number; body?: string; etag?: string }): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(url), ifNoneMatch: headers.get('If-None-Match') });
    const { status, body, etag } = reply();
    return new Response(status === 304 ? null : body ?? '', {
      status,
      headers: etag ? { etag } : {},
    });
  }) as typeof fetch;
}

const FEED_V1 = JSON.stringify({ ...BUNDLED_CATALOG, updatedAt: '2026-09-24T00:00:00Z' });
const FEED_V2 = JSON.stringify({ ...BUNDLED_CATALOG, updatedAt: '2026-09-24T01:00:00Z' });

async function main(): Promise<void> {
  const storage = new MemoryMemento() as unknown as vscode.Memento;
  const calls: Call[] = [];
  let reply: { status: number; body?: string; etag?: string } = { status: 200, body: FEED_V1, etag: '"v1"' };
  const fetchImpl = stubFetch(calls, () => reply);

  await test('first fetch stores the catalog and its ETag', async () => {
    const result = await fetchRemoteCatalog(storage, fetchImpl);
    assert.ok(result);
    assert.strictEqual(result!.changed, true);
    assert.strictEqual(calls[0].url, REMOTE_URL);
    assert.strictEqual(calls[0].ifNoneMatch, null, 'nothing cached yet');
    assert.strictEqual(getCachedCatalog(storage)?.updatedAt, '2026-09-24T00:00:00Z');
  });

  await test('S25: an unchanged feed is a 304 that serves the cache', async () => {
    reply = { status: 304 };
    const result = await fetchRemoteCatalog(storage, fetchImpl);
    assert.strictEqual(calls[1].ifNoneMatch, '"v1"');
    assert.ok(result);
    assert.strictEqual(result!.changed, false);
    assert.strictEqual(result!.catalog.updatedAt, '2026-09-24T00:00:00Z');
  });

  await test('the same body without a 304 is not a change', async () => {
    reply = { status: 200, body: FEED_V1, etag: '"v1-again"' };
    const result = await fetchRemoteCatalog(storage, fetchImpl);
    assert.strictEqual(result!.changed, false);
  });

  await test('a new document is a change and replaces the ETag', async () => {
    reply = { status: 200, body: FEED_V2, etag: '"v2"' };
    const result = await fetchRemoteCatalog(storage, fetchImpl);
    assert.strictEqual(result!.changed, true);
    reply = { status: 304 };
    await fetchRemoteCatalog(storage, fetchImpl);
    assert.strictEqual(calls[calls.length - 1].ifNoneMatch, '"v2"');
  });

  await test('S30: an invalid document is rejected and the cache kept', async () => {
    reply = { status: 200, body: JSON.stringify({ schemaVersion: 1, updatedAt: '2026-09-25T00:00:00Z', providers: { anthropic: { models: [{ id: 'not a model; rm -rf /', label: 'x', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: {} } } }) };
    const result = await fetchRemoteCatalog(storage, fetchImpl);
    assert.strictEqual(result, null);
    assert.strictEqual(getCachedCatalog(storage)?.updatedAt, '2026-09-24T01:00:00Z');
  });

  await test('S26: offline returns null and keeps the cache', async () => {
    const offline = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    assert.strictEqual(await fetchRemoteCatalog(storage, offline), null);
    assert.strictEqual(getCachedCatalog(storage)?.updatedAt, '2026-09-24T01:00:00Z');
  });

  if (failures > 0) {
    console.error(`\nremoteSource: ${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nremoteSource: all tests passed');
}

void main();
