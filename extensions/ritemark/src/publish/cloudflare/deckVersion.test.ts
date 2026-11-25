// Sprint 175 PR 5: exercise the verified upload and Cloudflare deploy with an in-memory HTTP transport.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'node-html-parser';
import { BUILT_IN_THEME } from '../../decks/deckTheme';
import { DECK_VERSION_META, DECK_VERSION_PATH } from '../../decks/page/pageFollower';
import { buildDeckPage } from '../../decks/page/pageFile';
import { readVerifiedUpload } from '../host';
import { CloudflareAccount } from './account';
import { NOINDEX_HEADERS } from './assets';
import { CloudflareHost } from './CloudflareHost';
import { CloudflareClient, type FetchLike } from './client';
import { testProject } from './testing/pages';

test('deck deploys carry a forward-only stamp, ordered public slide keys and titles, and no-store', async () => {
  let manifest: Record<string, { hash: string }>;
  let headers: string | undefined;
  const blobs = new Map<string, string>();
  const fetch: FetchLike = async (url, init) => {
    const path = new URL(url).pathname;
    let result: object = {};
    if (path.endsWith('/accounts')) result = [{ id: 'a'.repeat(32), name: 'Test account' }];
    else if (path.endsWith('/workers/scripts')) result = [];
    else if (path.endsWith('/workers/subdomain')) result = { subdomain: 'pages-4821' };
    else if (path.endsWith('/assets-upload-session')) {
      ({ manifest } = JSON.parse(String(init?.body)));
      result = { jwt: 'test-upload', buckets: [Object.values(manifest).map(entry => entry.hash)] };
    } else if (path.endsWith('/assets/upload')) {
      for (const [hash, file] of init?.body as FormData) {
        assert.ok(file instanceof Blob);
        blobs.set(hash, Buffer.from(await file.text(), 'base64').toString('utf8'));
      }
      result = { jwt: 'test-completion' };
    } else if (init?.method === 'PUT') {
      const metadata = JSON.parse(String((init.body as FormData).get('metadata')));
      headers = metadata.assets.config._headers;
    } else assert.match(path, /\/subdomain$/);
    return Response.json({ success: true, result });
  };
  const memory = new Map<string, string>();
  const account = new CloudflareAccount({
    secrets: {
      get: async key => memory.get(key),
      store: async (key, value) => { memory.set(key, value); },
      delete: async key => { memory.delete(key); },
    },
    makeClient: token => new CloudflareClient({ token, fetch, retries: 0 }),
  });
  assert.equal(await account.connectWithToken('t' + '0'.repeat(40)), 'connected');
  const project = await testProject({});
  try {
    const text = '```slide title\ntitle: Freight & Coffee\nsubtitle: Training subtitle\n```\n\nHandout text\n\n'
      + '```slide title\ntitle: Freight & Coffee\n```\n\n'
      + '```slide title\ntitle: Skipped slide\nskip: true\n```\n';
    const page = await buildDeckPage({ deckPath: project.page('training/deck.rtms'), text, theme: BUILT_IN_THEME }, { fonts: [], slideCss: '' });
    await project.write('training/deck.html', page.html);
    const plan = await project.gather('training/deck.html');
    assert.equal(plan.scriptBuilt, false, 'the pinned checker does not add an unknown-files warning');
    const upload = await readVerifiedUpload(plan);
    const expectedSlides = parse(page.html).querySelectorAll('#frame > .layer').map(layer => ({
      key: layer.getAttribute('data-key'),
      title: 'Freight & Coffee',
    }));
    assert.equal(expectedSlides.length, 2);
    assert.notEqual(expectedSlides[0].key, expectedSlides[1].key);

    let previous = 0;
    for (let update = 0; update < 20; update++) {
      // A fresh host after a backwards clock adjustment uses the previous publish record's version.
      const host = new CloudflareHost(account, { now: () => 1000 - update });
      const site = await host.publish('training-123abc', upload, { replacing: update > 0, lastDeckVersion: previous });
      const v = 1000 + update;
      assert.equal(site.deckVersion, v);
      const version = blobs.get(manifest![DECK_VERSION_PATH].hash)!;
      assert.deepEqual(JSON.parse(version), { v, slides: expectedSlides });
      assert.doesNotMatch(version, /Training subtitle|Handout text|Skipped slide/);
      const deployed = blobs.get(manifest![upload.pageUrlPath].hash)!;
      assert.ok(deployed.includes(`name="${DECK_VERSION_META}" content="${v}"`));
      assert.ok(deployed.includes('Handout text'), 'the HTML still contains the reader’s text');
      assert.equal(headers, `${NOINDEX_HEADERS}\n/version.json\n  Cache-Control: no-store\n`);
      previous = v;
    }
  } finally { await project.cleanup(); }
});
