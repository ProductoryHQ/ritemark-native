/**
 * Sprint 141 R12 (#558) and R13: the Gemini key never travels in a URL, and the
 * model list is read in full. Mocked `fetch` only — no request reaches Google.
 * Run: npx tsx src/ai/geminiRequest.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GEMINI_API_ORIGIN, geminiHeaders, geminiUrl, listGeminiModels } from './geminiRequest';

const KEY = 'test-placeholder-not-a-key';
let failures = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

interface Call { url: string; headers: Record<string, string> }
function mockFetch(pages: Array<{ status?: number; body?: unknown; throws?: Error }>): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    const page = pages[calls.length - 1] ?? { status: 500, body: {} };
    if (page.throws) throw page.throws;
    return new Response(JSON.stringify(page.body ?? {}), { status: page.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

/**
 * The scan (S50): a production source line that names Gemini's host, or builds a
 * query, must not carry `key=`. Returns the offending lines.
 */
export function scanForKeyInUrl(files: Array<{ file: string; source: string }>): string[] {
  const hits: string[] = [];
  for (const { file, source } of files) {
    source.split('\n').forEach((line, index) => {
      const namesGemini = line.includes('generativelanguage.googleapis.com');
      if ((namesGemini && /\bkey=/.test(line)) || /[?&]key=/.test(line)) hits.push(`${file}:${index + 1}`);
    });
  }
  return hits;
}

function productionSources(): Array<{ file: string; source: string }> {
  const root = path.resolve(__dirname, '../..');
  const out: Array<{ file: string; source: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (!/\.(?:tsx?|[cm]?js)$/.test(entry.name) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) continue;
      out.push({ file: path.relative(root, full), source: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'webview', 'src'));
  // Developer scripts too (run-flow-test sent the key in the URL until the QA pass).
  walk(path.join(root, 'scripts'));
  return out;
}

async function main(): Promise<void> {
  await test('S50: no source or script puts a key in a Gemini URL', () => {
    assert.deepEqual(scanForKeyInUrl(productionSources()), []);
  });

  await test('S50: the scan fails on a URL that carries the key (negative)', () => {
    const fixture = 'const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;';
    assert.deepEqual(scanForKeyInUrl([{ file: 'fixture.ts', source: fixture }]), ['fixture.ts:1']);
    assert.deepEqual(scanForKeyInUrl([{ file: 'fixture.ts', source: "fetch(base + '&key=' + k)" }]), ['fixture.ts:1']);
  });

  await test('geminiUrl never takes a key, and geminiHeaders carries it', () => {
    assert.equal(geminiUrl('v1beta', 'models/gemini-3.5-flash-lite:generateContent'), `${GEMINI_API_ORIGIN}/v1beta/models/gemini-3.5-flash-lite:generateContent`);
    assert.equal(geminiUrl('v1', 'models', { pageSize: '1000' }), `${GEMINI_API_ORIGIN}/v1/models?pageSize=1000`);
    assert.throws(() => geminiUrl('v1', 'models', { key: KEY }), /header/);
    assert.throws(() => geminiUrl('v1', 'models', { KEY: KEY }), /header/);
    assert.deepEqual(geminiHeaders(KEY, { 'Content-Type': 'application/json' }), { 'Content-Type': 'application/json', 'x-goog-api-key': KEY });
  });

  await test('S49: models.list sends the header and no key in the URL', async () => {
    const { fetchImpl, calls } = mockFetch([{ body: { models: [{ name: 'models/gemini-4-argon' }] } }]);
    const listing = await listGeminiModels(KEY, { fetchImpl });
    assert.equal(listing.models.length, 1);
    assert.equal(calls[0].headers['x-goog-api-key'], KEY);
    assert.ok(!calls[0].url.includes(KEY), 'the URL never holds the key');
    assert.ok(!/[?&]key=/.test(calls[0].url));
  });

  await test('S52 (R13): every page is read, at the largest page size', async () => {
    const { fetchImpl, calls } = mockFetch([
      { body: { models: [{ name: 'models/a' }, { name: 'models/b' }], nextPageToken: 'p2' } },
      { body: { models: [{ name: 'models/c' }] } },
    ]);
    const listing = await listGeminiModels(KEY, { fetchImpl });
    assert.deepEqual(listing.models.map((m) => m.name), ['models/a', 'models/b', 'models/c']);
    assert.equal(listing.pages, 2);
    assert.ok(calls[0].url.includes('pageSize=1000'));
    assert.ok(calls[1].url.includes('pageToken=p2'));
  });

  await test('S53 (R13): a failed later page keeps what was read (negative)', async () => {
    const { fetchImpl } = mockFetch([
      { body: { models: [{ name: 'models/a' }], nextPageToken: 'p2' } },
      { throws: new TypeError('fetch failed') },
    ]);
    const listing = await listGeminiModels(KEY, { fetchImpl });
    assert.deepEqual(listing.models.map((m) => m.name), ['models/a']);
    assert.equal(listing.pages, 1);
  });

  await test('R13: the page count is bounded', async () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({ body: { models: [{ name: `models/m${i}` }], nextPageToken: `p${i + 1}` } }));
    const { fetchImpl, calls } = mockFetch(pages);
    const listing = await listGeminiModels(KEY, { fetchImpl, maxPages: 5 });
    assert.equal(calls.length, 5);
    assert.equal(listing.models.length, 5);
  });

  await test('S51: a first-page failure is reported with Google\'s message, never the key', async () => {
    const { fetchImpl } = mockFetch([{ status: 400, body: { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } } }]);
    const listing = await listGeminiModels(KEY, { fetchImpl });
    assert.equal(listing.pages, 0);
    assert.equal(listing.failedStatus, 400);
    assert.equal(listing.failedMessage, 'API key not valid. Please pass a valid API key.');
    assert.ok(!JSON.stringify(listing).includes(KEY));
  });

  if (failures > 0) {
    console.error(`\ngeminiRequest: ${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\ngeminiRequest: all tests passed');
}

void main();
