import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLatestRelease } from './githubClient';
import { feedUrlForChannel } from './updateFeed';

test('update channels use the native release repository', () => {
  assert.equal(feedUrlForChannel('stable'),
    'https://github.com/ProductoryHQ/ritemark-native/releases/latest/download/update-feed.json');
  assert.equal(feedUrlForChannel('canary'),
    'https://github.com/ProductoryHQ/ritemark-native/releases/download/canary/update-feed.json');
});

test('latest release lookup uses the native release repository', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: string) => Response.json({ tag_name: 'v2.4.0' }));
  assert.equal((await fetchLatestRelease())?.tag_name, 'v2.4.0');
  assert.equal(fetch.mock.calls.length, 1);
  assert.equal(fetch.mock.calls[0].arguments[0],
    'https://api.github.com/repos/ProductoryHQ/ritemark-native/releases/latest');
});
