// Sprint 175 PR 5, S9–S12 and S19, using the two scripts from the actual published HTML.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as vm from 'node:vm';
// @ts-expect-error: domino has no types of its own here
import domino from '@mixmark-io/domino';
import { BUILT_IN_THEME } from '../deckTheme';
import { DECK_VERSION_META, DECK_VERSION_PATH, PAGE_FOLLOWER } from './pageFollower';
import { pageHtml } from './pageHtml';
import { PAGE_SCRIPT } from './pageScript';
import { publicDeck } from './publicDeck';

type Slide = [title: string, text?: string];

function page(v: number, slides: Slide[]) {
  const input = slides.map(([title, text]) => [
    '```slide title', 'title: ' + title, '```', '', text ?? 'Read this.', '',
  ].join('\n')).join('\n');
  const deck = publicDeck(input, { folderName: 'Harbour', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, { fonts: [], slideCss: '' }, { digest: 'a'.repeat(64), pictureUrl: () => null })
    .replace(`name="${DECK_VERSION_META}" content="0"`, `name="${DECK_VERSION_META}" content="${v}"`);
  const doc = domino.createDocument(html) as Document;
  return {
    html,
    info: { v, slides: Array.from(doc.querySelectorAll('#frame > .layer')).map(layer => ({
      key: layer.getAttribute('data-key')!, title: layer.getAttribute('data-slide-title')!,
    })) },
  };
}

type Page = ReturnType<typeof page>;
const original = page(105, [['Briefing'], ['Late trucks', 'Ask in three lines.\n\nKeep your notes.'], ['Closed yard'], ['Coffee']]);

function reader(initial: Page, hash = '#2', storage = new Map<string, string>()) {
  const doc = domino.createDocument(initial.html, true) as Document;
  Object.defineProperty(doc, 'visibilityState', { value: 'visible', writable: true });
  const position = doc.getElementById('pos')!;
  const location = { hash, pathname: '/training/', search: '', protocol: 'https:', origin: 'https://pages.example', reload() { reloads++; } };
  const listeners = new Map<string, () => unknown>();
  const timers = new Map<number, { at: number; run: () => unknown; interval?: number }>();
  let now = 1000, ids = 0, reloads = 0, selected = false;
  let version: unknown = initial.info;
  let latest: string | null = initial.html;
  const requests: string[] = [];
  const addTimer = (run: () => unknown, ms: number, interval?: number) => {
    timers.set(++ids, { at: now + ms, run, interval });
    return ids;
  };
  const win = {
    location,
    history: { replaceState(_state: unknown, _title: string, address: string) { location.hash = address.startsWith('#') ? address : ''; } },
    innerWidth: 390,
    innerHeight: 800,
    addEventListener(type: string, run: () => unknown) { if (type === 'focus') listeners.set(type, run); },
    getSelection: () => ({ isCollapsed: !selected }),
    getComputedStyle: () => ({ overflowX: 'visible' }),
    matchMedia: (query: string) => ({ matches: query.includes('max-width') }),
    scrollTo() {},
    setTimeout: addTimer,
    clearTimeout: (id: number) => timers.delete(id),
  };
  Object.assign(doc.documentElement, { clientWidth: 390 });
  vm.runInNewContext(PAGE_FOLLOWER + '\n' + PAGE_SCRIPT, {
    document: doc, window: win, location, history: win.history, navigator: {},
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    Date: { now: () => now }, setTimeout: addTimer, clearTimeout: win.clearTimeout,
    setInterval: (run: () => unknown, ms: number) => addTimer(run, ms, ms),
    MutationObserver: class { observe() {} },
    async fetch(path: string, request: RequestInit) {
      requests.push(path);
      assert.equal(request.cache, 'no-store');
      assert.equal(request.mode, 'same-origin');
      assert.equal(request.redirect, 'error');
      if (path === DECK_VERSION_PATH) return { ok: true, json: async () => version };
      assert.equal(path, '/training/');
      return { ok: latest !== null, text: async () => latest };
    },
  });
  return {
    doc, position, storage, requests,
    reloads: () => reloads, hash: () => location.hash,
    select(value: boolean) { selected = value; this.event('selectionchange'); },
    event(type: string) { const e = doc.createEvent('Event'); e.initEvent(type, true, false); doc.dispatchEvent(e); },
    async focus(info: unknown = version, html: string | null = latest) { version = info; latest = html; await listeners.get('focus')?.(); },
    async advance(ms: number) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end);
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        if (timer.interval) addTimer(timer.run, timer.interval, timer.interval);
        await timer.run();
      }
      now = end;
    },
  };
}

test('S9 and S12: an older or malformed response is ignored; scroll and selection defer a newer one', async () => {
  const r = reader(original);
  await r.focus({ v: 104, slides: [] });
  await r.focus({ v: 109, slides: [{}] });
  await r.advance(1000);
  assert.equal(r.reloads(), 0);
  const changed = page(106, [['Briefing'], ['Late trucks', 'Ask in five lines.\n\nKeep your notes.'], ['Closed yard'], ['Coffee']]);
  await r.focus(changed.info, original.html);
  await r.advance(1000);
  assert.equal(r.reloads(), 0, 'the HTML edge has not caught up');
  await r.focus(original.info, changed.html);
  await r.advance(800);
  r.event('scroll');
  r.select(true);
  await r.advance(2000);
  assert.equal(r.reloads(), 0);
  r.select(false);
  await r.advance(999);
  assert.equal(r.reloads(), 0);
  await r.advance(1);
  assert.equal(r.reloads(), 1);
  const arrived = reader(changed, r.hash(), r.storage);
  assert.equal(arrived.position.textContent, '2 / 4');
  const updated = arrived.doc.querySelector('#line .who #deck-updated')!;
  assert.equal(updated.textContent, 'Updated just now');
  assert.deepEqual(Array.from(arrived.doc.querySelectorAll('.deck-changed-block'), node => node.textContent), ['Ask in five lines.']);
  await arrived.advance(1999);
  assert.equal(updated.textContent, 'Updated just now');
  assert.ok(arrived.doc.querySelector('.deck-changed-block'));
  await arrived.advance(1);
  assert.equal(updated.textContent, '');
  assert.ok(!arrived.doc.querySelector('.deck-changed-block'));
});

test('S10 and S19: a shared number opens that position; an update follows the key with only a new count', async () => {
  const inserted = page(106, [['New slide'], ['Briefing'], ['Late trucks', 'Ask in three lines.\n\nKeep your notes.'], ['Closed yard'], ['Coffee']]);
  const r = reader(original);
  await r.advance(10000);
  assert.deepEqual(r.requests, [DECK_VERSION_PATH], 'one poll after ten seconds');
  await r.focus(inserted.info, inserted.html);
  await r.advance(1000);
  const arrived = reader(inserted, r.hash(), r.storage);
  assert.equal(arrived.position.textContent, '3 / 5');
  assert.equal(arrived.hash(), '#3');
  assert.equal(arrived.doc.getElementById('deck-updated')!.textContent, '');
  assert.ok(!arrived.doc.querySelector('.deck-changed-block'));
  const linked = reader(page(108, [['One'], ['Two'], ['Three'], ['Four'], ['Five'], ['Six']]), '#6');
  assert.equal(linked.position.textContent, '6 / 6');
  assert.equal(linked.hash(), '#6');
});

test('S11: keep the removed slide and offer the next surviving slide, or the last slide', async () => {
  const next = page(106, [['New slide'], ['Briefing'], ['Coffee']]);
  const r = reader(original);
  await r.focus(next.info, next.html);
  await r.advance(1000);
  assert.equal(r.reloads(), 0);
  assert.equal(r.position.textContent, '– / 3');
  assert.match(r.doc.querySelector('.deck-removed-slide')!.textContent!, /Late trucks/);
  const go = r.doc.getElementById('deck-onward')!;
  assert.equal(go.textContent, 'Go on to Coffee');
  go.click();
  assert.equal(r.reloads(), 1);
  assert.equal(reader(next, r.hash(), r.storage).position.textContent, '3 / 3');

  const last = reader(original, '#4');
  const noCoffee = page(107, [['Briefing'], ['Late trucks'], ['Closed yard']]);
  await last.focus(noCoffee.info, noCoffee.html);
  await last.advance(1000);
  assert.equal(last.doc.getElementById('deck-onward')!.textContent, 'Go on to Closed yard');
});

test('the removed slide note stays after the update message expires', async () => {
  const changed = page(106, [['Briefing'], ['Late trucks', 'Ask in five lines.'], ['Coffee']]);
  const next = page(107, [['Briefing'], ['Coffee']]);
  const first = reader(original);
  await first.focus(changed.info, changed.html);
  await first.advance(1000);
  assert.equal(first.reloads(), 1);
  const r = reader(changed, first.hash(), first.storage);
  const updated = r.doc.getElementById('deck-updated')!;
  const removed = r.doc.getElementById('deck-removed')!;
  assert.equal(updated.textContent, 'Updated just now');
  await r.focus(next.info, next.html);
  await r.advance(1000);
  assert.equal(removed.hidden, false);
  await r.advance(1000);
  assert.equal(updated.textContent, '');
  await r.advance(10000);
  assert.equal(removed.hidden, false);
  assert.equal(r.position.textContent, '– / 2');
  r.doc.getElementById('deck-onward')!.click();
  assert.equal(r.reloads(), 1);
});

test('a failed text comparison shows the update without a fill', async () => {
  const next = page(106, [['Briefing'], ['Late trucks', 'Ask in five lines.']]);
  const r = reader(original);
  await r.focus(next.info, null);
  await r.advance(1000);
  assert.equal(r.reloads(), 1);
  const arrived = reader(next, r.hash(), r.storage);
  assert.equal(arrived.doc.getElementById('deck-updated')!.textContent, 'Updated just now');
  assert.ok(!arrived.doc.querySelector('.deck-changed-block'));
});

test('a stale HTML reload keeps the handoff until the published version catches up', async () => {
  const next = page(106, [['Late trucks'], ['Briefing'], ['Coffee']]);
  const r = reader(original);
  await r.focus(next.info, next.html);
  await r.advance(1000);
  assert.equal(r.reloads(), 1);
  const stale = reader(original, r.hash(), r.storage);
  assert.equal(stale.position.textContent, '2 / 4');
  assert.equal(stale.doc.getElementById('deck-updated')!.textContent, '');
  await new Promise(setImmediate);
  await stale.focus(next.info, next.html);
  await stale.advance(1000);
  assert.equal(stale.reloads(), 1);
  const arrived = reader(next, stale.hash(), stale.storage);
  assert.equal(arrived.position.textContent, '1 / 3');
  assert.equal(arrived.hash(), '');
});

test('the locally built page remains a player without making version requests', async () => {
  const local = reader(page(0, [['Briefing'], ['Coffee']]));
  await local.focus();
  await local.advance(20000);
  assert.deepEqual(local.requests, []);
  assert.equal(local.position.textContent, '2 / 2');
});
