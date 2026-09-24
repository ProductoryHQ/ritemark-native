import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listModels } from './anthropic.mjs';

function stubFetch(pages) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: new URL(url), headers: init.headers });
    const page = pages[calls.length - 1];
    if (typeof page === 'number') return new Response('{}', { status: page });
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

test('it pages through /v1/models with the key and API version', async () => {
  const { calls, fetchImpl } = stubFetch([
    { data: [{ id: 'claude-a' }], has_more: true, last_id: 'claude-a' },
    { data: [{ id: 'claude-b' }], has_more: false, last_id: 'claude-b' },
  ]);
  const models = await listModels({ apiKey: 'test-key', fetchImpl, baseUrl: 'https://api.example.test' });
  assert.deepEqual(models.map((model) => model.id), ['claude-a', 'claude-b']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, '/v1/models');
  assert.equal(calls[0].url.searchParams.get('after_id'), null);
  assert.equal(calls[1].url.searchParams.get('after_id'), 'claude-a');
  assert.equal(calls[0].headers['x-api-key'], 'test-key');
  assert.equal(calls[0].headers['anthropic-version'], '2023-06-01');
});

test('an HTTP error stops the run without echoing the key', async () => {
  const { fetchImpl } = stubFetch([401]);
  await assert.rejects(listModels({ apiKey: 'test-key', fetchImpl }), (error) => /HTTP 401/.test(error.message) && !error.message.includes('test-key'));
});

test('a missing key or a malformed answer stops the run', async () => {
  await assert.rejects(listModels({ apiKey: '', fetchImpl: stubFetch([]).fetchImpl }), /not set/);
  await assert.rejects(listModels({ apiKey: 'k', fetchImpl: stubFetch([{ models: [] }]).fetchImpl }), /no data array/);
});

test('endless paging is cut off', async () => {
  const pages = Array.from({ length: 25 }, (_, index) => ({ data: [], has_more: true, last_id: `claude-${index}` }));
  await assert.rejects(listModels({ apiKey: 'k', fetchImpl: stubFetch(pages).fetchImpl }), /did not finish/);
});
