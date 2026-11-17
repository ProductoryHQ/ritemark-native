/**
 * Sprint 159 (technical plan §6): the page's scroll rule is the deck view's. `PAGE_SCROLL_RULE` (plain JavaScript in the
 * page) and `scrollRule.ts` (the editor's) are run over generated states and must agree on every answer; and the
 * whole script compiles, never closes its own tag, and builds no file names. Small details 7: an address names a part
 * (`#6`), the address follows the part being read, and the page returns to a reader's last part with "Start from the
 * beginning" for 5 s, also when the browser keeps nothing.
 *
 * Run: npx tsx src/decks/page/pageScript.test.ts
 */
import { strict as assert } from 'node:assert';
import * as vm from 'node:vm';
import { scriptBuildsReferences } from '../../publish/references';
import * as editor from '../../../webview/src/components/decks/scrollRule';
import { PAGE_PLACE_RULE, PAGE_SCRIPT, PAGE_SCROLL_RULE } from './pageScript';

interface Rule {
  partStarts: typeof editor.partStarts;
  currentPart: typeof editor.currentPart;
  wheelStop: typeof editor.wheelStop;
  scrollTopFor: typeof editor.scrollTopFor;
  constants: { READ_LINE: number; TOP_SNAP: number; PART_TOP_GAP: number };
}
const page = new Function(`${PAGE_SCROLL_RULE}\nreturn { partStarts, currentPart, wheelStop, scrollTopFor, constants: { READ_LINE, TOP_SNAP, PART_TOP_GAP } };`)() as Rule;

assert.deepEqual(page.constants, { READ_LINE: editor.READ_LINE, TOP_SNAP: editor.TOP_SNAP, PART_TOP_GAP: editor.PART_TOP_GAP });

/** A small seeded generator, so a failure names a state that can be run again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const next = random(159);
const int = (low: number, high: number) => low + Math.floor(next() * (high - low + 1));
let states = 0;
for (let round = 0; round < 400; round++) {
  // Parts from a title alone (40 px) to a long handout (1400 px), a window from a phone's to a desktop's.
  const count = int(0, 14);
  const partTops: number[] = [];
  let top = int(0, 120);
  for (let index = 0; index < count; index++) {
    partTops.push(top);
    top += int(40, 1400);
  }
  const clientHeight = int(300, 1100);
  const scrollHeight = Math.max(clientHeight, top + int(40, clientHeight));
  for (let probe = 0; probe < 25; probe++) {
    const scrollTop = int(0, Math.max(0, scrollHeight - clientHeight));
    const writing = next() < 0.1 ? int(-1, count + 1) : null;
    const state = { partTops, scrollTop, clientHeight, scrollHeight, writing };
    const label = `seed 159, round ${round}, probe ${probe}: ${JSON.stringify(state)}`;
    assert.deepEqual(page.partStarts(partTops, clientHeight), editor.partStarts(partTops, clientHeight), label);
    assert.equal(page.currentPart(state), editor.currentPart(state), label);
    const shown = editor.currentPart({ ...state, writing: null }) ?? 0;
    const delta = int(-900, 900);
    assert.equal(page.wheelStop({ ...state, writing: null }, delta, shown), editor.wheelStop({ ...state, writing: null }, delta, shown), `${label}, wheel ${delta}`);
    assert.equal(page.scrollTopFor(partTops[0] ?? scrollTop), editor.scrollTopFor(partTops[0] ?? scrollTop), label);
    states++;
  }
}
assert.ok(states === 10_000);

// The rule's own promises, through the page's copy: scrolling down never skips a part and never goes back.
{
  const state = { partTops: [10, 400, 900, 980, 1500], clientHeight: 600, scrollHeight: 3000, writing: null };
  let last = 0;
  for (let scrollTop = 0; scrollTop <= 2400; scrollTop++) {
    const part = page.currentPart({ ...state, scrollTop })!;
    assert.ok(part === last || part === last + 1, `at ${scrollTop}: ${last} → ${part}`);
    last = part;
  }
  assert.equal(last, 4);
}

// The whole script compiles, stays in its own scope, never closes its own <script>, and builds no file names, so 2.2's
// gather sees every file the page uses.
assert.doesNotThrow(() => new vm.Script(PAGE_SCRIPT, { filename: 'page.js' }));
assert.match(PAGE_SCRIPT, /^\(function \(\) \{\n {2}'use strict';/);
assert.ok(PAGE_SCRIPT.trimEnd().endsWith('})();'));
assert.ok(!/<\/script/i.test(PAGE_SCRIPT));
assert.equal(scriptBuildsReferences(PAGE_SCRIPT), false);
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.src\b|\.href\b|setAttribute\(\s*['"](?:src|href)/.test(PAGE_SCRIPT), 'it writes no HTML and sets no address');
assert.ok(!/[^\x00-\x7f]/.test(PAGE_SCRIPT), 'plain ASCII, so the page reads the same whatever its encoding');

// Run in a page with none of its parts, it stops quietly.
{
  const sandbox = { document: { getElementById: () => null, querySelector: () => null, documentElement: {} }, window: {} };
  assert.doesNotThrow(() => vm.runInNewContext(PAGE_SCRIPT, sandbox));
}

// ---- Small details 7: the part an address names, the address a part has, and the part kept in this browser
interface Place {
  linkedPart(hash: string, count: number): number | null;
  addressFor(index: number): string;
  storageOf(win: unknown): Storage | null;
  readPlace(storage: unknown, key: string, count: number): number | null;
  keepPlace(storage: unknown, key: string, index: number): void;
  PLACE_NOTICE_MS: number;
}
const place = new Function(`${PAGE_PLACE_RULE}\nreturn { linkedPart, addressFor, storageOf, readPlace, keepPlace, PLACE_NOTICE_MS };`)() as Place;
{
  assert.equal(place.PLACE_NOTICE_MS, 5000);
  // #6 is part 6 (index 5); 2.2's #s6 still is; a number with no part opens the top; other addresses name no part.
  assert.equal(place.linkedPart('#6', 8), 5);
  assert.equal(place.linkedPart('#s6', 8), 5);
  assert.equal(place.linkedPart('#1', 8), 0);
  assert.equal(place.linkedPart('#8', 8), 7);
  assert.equal(place.linkedPart('#9', 8), 0, 'a part that does not exist opens the top');
  assert.equal(place.linkedPart('#0', 8), 0);
  assert.equal(place.linkedPart('#99999999', 8), null, 'a number too long to be a part is no part');
  for (const none of ['', '#', '#six', '#6a', '#-1', '#borderless', '6']) assert.equal(place.linkedPart(none, 8), null, none);
  assert.equal(place.linkedPart('#3', 0), null, 'a page with no parts has no part to open');
  assert.equal(place.addressFor(0), '', 'the top part is the page\'s own address');
  assert.equal(place.addressFor(5), '#6');
  for (let index = 1; index < 8; index++) assert.equal(place.linkedPart(place.addressFor(index), 8), index, 'every address opens its own part');

  const kept = new Map<string, string>();
  const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => { kept.set(key, value); } };
  assert.equal(place.readPlace(storage, 'k', 8), null, 'nothing kept');
  place.keepPlace(storage, 'k', 3);
  assert.equal(kept.get('k'), '4', 'only the part\'s number is kept');
  assert.equal(place.readPlace(storage, 'k', 8), 3);
  assert.equal(place.readPlace(storage, 'k', 3), null, 'a kept part the page no longer has is no place');
  for (const junk of ['1', '0', '-2', 'four', '4.5', '', ' 4']) { kept.set('k', junk); assert.equal(place.readPlace(storage, 'k', 8), null, junk); }
  const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.equal(place.readPlace(throwing, 'k', 8), null, 'storage that throws keeps nothing');
  assert.doesNotThrow(() => place.keepPlace(throwing, 'k', 3));
  assert.equal(place.readPlace(null, 'k', 8), null);
  assert.doesNotThrow(() => place.keepPlace(null, 'k', 3));
  const blocked = Object.defineProperty({}, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.equal(place.storageOf(blocked), null, 'a browser that refuses storage at all');
  assert.equal(place.storageOf({ localStorage: storage }), storage);
}

// ---- the whole script, run in a small stand-in page: where it opens, the address, the notice
type Listener = (event: Record<string, unknown>) => void;
class Node {
  hidden = false;
  disabled = false;
  textContent = '';
  style: Record<string, unknown> = { setProperty() { /* the slide's scale */ } };
  listeners = new Map<string, Listener[]>();
  classes = new Set<string>();
  classList = {
    toggle: (name: string, on?: boolean) => { const add = on ?? !this.classes.has(name); if (add) this.classes.add(name); else this.classes.delete(name); return add; },
    add: (name: string) => { this.classes.add(name); },
    remove: (name: string) => { this.classes.delete(name); },
    contains: (name: string) => this.classes.has(name),
  };
  constructor(private attrs: Record<string, string> = {}, private rect: () => { top: number; bottom: number } = () => ({ top: 0, bottom: 0 }), private found: Record<string, Node[]> = {}) {}
  getAttribute(name: string) { return name in this.attrs ? this.attrs[name] : null; }
  hasAttribute(name: string) { return name in this.attrs; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type: string, extra: Record<string, unknown> = {}) { for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this, preventDefault() { /* */ }, stopPropagation() { /* */ }, ...extra }); }
  querySelectorAll(selector: string) { return this.found[selector] ?? []; }
  querySelector(selector: string) { return (this.found[selector] ?? [])[0] ?? null; }
  getBoundingClientRect() { return this.rect(); }
  get clientWidth() { return 600; }
  focus() { /* */ }
}

interface PageRun {
  shown(): number;
  scrollY(): number;
  hash(): string;
  addresses: string[];
  restart: Node;
  kept: Map<string, string>;
  advance(ms: number): void;
  window: Node & Record<string, unknown>;
}

/**
 * Six parts of 400 px under a 59 px bar (part 3 has no text when `slideOnly`: its place only, 0 px high, as #780's
 * slide-only parts are), run with the address's hash and what this browser keeps.
 */
function runPage(options: { hash?: string; kept?: Record<string, string>; storage?: 'ok' | 'throws' | 'refused'; replaceThrows?: boolean; slideOnly?: boolean }): PageRun {
  const BAR = 59;
  const tops: number[] = [];
  let top = 28;
  for (let index = 0; index < 6; index++) {
    tops.push(top);
    top += options.slideOnly && index === 2 ? 0 : 400;
  }
  const end = top;
  let scrollY = 0;
  const location = { hash: options.hash ?? '', pathname: '/deck/index.html', search: '' };
  const addresses: string[] = [];
  const kept = new Map(Object.entries(options.kept ?? {}));
  const timers = new Map<number, { at: number; run: () => void }>();
  let now = 0, ids = 0;
  const parts = tops.map((partTop, index) => new Node({ 'data-i': String(index) }, () => ({ top: partTop - scrollY + BAR, bottom: partTop - scrollY + BAR })));
  const layers = tops.map((_, index) => new Node({ 'data-title': `Slide ${index + 1}` }));
  const text = new Node({ 'data-store': 'ritemark-ticks-abc', 'data-place': 'ritemark-place-abc' }, () => ({ top: BAR - scrollY, bottom: end + 900 - scrollY + BAR }), { '.part[data-i]': parts, 'input[data-tick]': [] });
  const box = new Node({}, undefined, { '.layer': layers });
  const header = new Node({}, () => ({ top: 0, bottom: BAR }));
  const stage = new Node({}, () => ({ top: BAR, bottom: 400 }));
  const restart = new Node();
  restart.hidden = true;
  const byId: Record<string, Node> = { slidebox: box, text, restart, pos: new Node(), bar: new Node(), stitle: new Node(), prev: new Node(), next: new Node() };
  const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => { kept.set(key, value); } };
  const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
  const win = new Node() as Node & Record<string, unknown>;
  Object.defineProperty(win, 'scrollY', { get: () => scrollY });
  Object.assign(win, {
    innerHeight: 900,
    innerWidth: 1440,
    location,
    history: {
      state: null,
      replaceState(_state: unknown, _title: string, url: string) {
        if (options.replaceThrows) throw new Error('SecurityError');
        addresses.push(url);
        location.hash = url.startsWith('#') ? url : '';
      },
    },
    scrollTo(to: number | { top: number }) { scrollY = Math.max(0, typeof to === 'number' ? to : to.top); },
    // A frame at once; it answers 0 because it has already run (the script then waits for no frame).
    requestAnimationFrame(run: () => void) { run(); return 0; },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ paddingBottom: '0px' }),
    setTimeout(run: () => void, ms: number) { timers.set(++ids, { at: now + ms, run }); return ids; },
    clearTimeout(id: number) { timers.delete(id); },
  });
  if (options.storage === 'refused') Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  else win.localStorage = options.storage === 'throws' ? throwing : storage;
  const document = new Node() as Node & Record<string, unknown>;
  Object.assign(document, {
    documentElement: { get scrollHeight() { return end + 900 + BAR; } },
    getElementById: (id: string) => byId[id] ?? null,
    querySelector: (selector: string) => (selector === '.top' ? header : selector === '.stage' ? stage : null),
  });
  vm.runInNewContext(PAGE_SCRIPT, { window: win, document, navigator: {} });
  return {
    shown: () => layers.findIndex(layer => layer.classes.has('on')),
    scrollY: () => scrollY,
    hash: () => location.hash,
    addresses,
    restart,
    kept,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
    },
    window: win,
  };
}

// A first visit: the top, no notice, the address as it was.
{
  const page = runPage({});
  assert.equal(page.shown(), 0);
  assert.equal(page.scrollY(), 0);
  assert.equal(page.restart.hidden, true);
  assert.deepEqual(page.addresses, [], 'the top part keeps the page\'s own address');
  // The address follows the part being read, in place, and the part is kept.
  page.window.scrollTo(28 + 3 * 400 - 6);
  page.window.fire('scroll');
  assert.equal(page.shown(), 3);
  assert.equal(page.hash(), '#4');
  assert.equal(page.kept.get('ritemark-place-abc'), '4');
  page.window.scrollTo(0);
  page.window.fire('scroll');
  assert.equal(page.shown(), 0);
  assert.equal(page.hash(), '', 'back at the top, the address is the page\'s own again');
  assert.deepEqual(page.addresses, ['#4', '/deck/index.html']);
  assert.equal(page.kept.get('ritemark-place-abc'), '1');
}

// Opened again without a link: the last part read, with "Start from the beginning" for 5 s.
{
  const page = runPage({ kept: { 'ritemark-place-abc': '4' } });
  assert.equal(page.shown(), 3);
  assert.equal(page.scrollY(), 28 + 3 * 400 - 6);
  assert.equal(page.hash(), '#4');
  assert.equal(page.restart.hidden, false, 'the notice shows');
  page.advance(4999);
  assert.equal(page.restart.hidden, false);
  page.advance(1);
  assert.equal(page.restart.hidden, true, 'and goes after 5 s');
}
// It waits while the pointer is on it, and goes when the pointer leaves.
{
  const page = runPage({ kept: { 'ritemark-place-abc': '4' } });
  page.restart.fire('mouseenter');
  page.advance(6000);
  assert.equal(page.restart.hidden, false, 'held under the pointer');
  page.restart.fire('mouseleave');
  assert.equal(page.restart.hidden, true);
}
// A click on it goes to the top, and the top is kept.
{
  const page = runPage({ kept: { 'ritemark-place-abc': '5' } });
  assert.equal(page.shown(), 4);
  page.restart.fire('click');
  assert.equal(page.restart.hidden, true);
  assert.equal(page.shown(), 0);
  assert.equal(page.scrollY(), 0);
  assert.equal(page.hash(), '');
  assert.equal(page.kept.get('ritemark-place-abc'), '1');
}
// A link opens its part, over the kept place and without the notice; 2.2's #s3 too.
{
  const page = runPage({ hash: '#2', kept: { 'ritemark-place-abc': '5' } });
  assert.equal(page.shown(), 1);
  assert.equal(page.scrollY(), 28 + 400 - 6);
  assert.equal(page.restart.hidden, true, 'a link is no return: no notice');
  assert.equal(page.kept.get('ritemark-place-abc'), '2');
  assert.equal(runPage({ hash: '#s3' }).shown(), 2);
}
// A part that doesn't exist opens the top, and the address is the page's own again.
{
  const page = runPage({ hash: '#9', kept: { 'ritemark-place-abc': '5' } });
  assert.equal(page.shown(), 0);
  assert.equal(page.scrollY(), 0);
  assert.equal(page.restart.hidden, true);
  assert.equal(page.hash(), '');
}
// A slide-only part has no text: its link opens its slide, at its place in the deck order.
{
  const page = runPage({ hash: '#3', slideOnly: true });
  assert.equal(page.shown(), 2, 'slide 3 in the band');
  assert.equal(page.scrollY(), 28 + 2 * 400 - 6, 'at its place, between parts 2 and 4');
  assert.equal(page.hash(), '#3');
}
// A part's address typed while the page is open goes to it.
{
  const page = runPage({});
  (page.window.location as { hash: string }).hash = '#5';
  page.window.fire('hashchange');
  assert.equal(page.shown(), 4);
  (page.window.location as { hash: string }).hash = '#42';
  page.window.fire('hashchange');
  assert.equal(page.shown(), 0);
  assert.equal(page.scrollY(), 0, 'a part that does not exist opens the page\'s top');
  assert.equal(page.hash(), '');
}
// A browser that keeps nothing (a private window, blocked site data): the page opens at the top and works.
for (const storage of ['throws', 'refused'] as const) {
  const page = runPage({ storage });
  assert.equal(page.shown(), 0, storage);
  assert.equal(page.restart.hidden, true, storage);
  page.window.scrollTo(28 + 2 * 400 - 6);
  assert.doesNotThrow(() => page.window.fire('scroll'), storage);
  assert.equal(page.shown(), 2, storage);
  assert.equal(page.hash(), '#3', storage);
  assert.equal(runPage({ storage, hash: '#4' }).shown(), 3, `${storage}: a link still opens its part`);
}
// An address that can't change (replaceState refused) leaves the page working.
{
  const page = runPage({ replaceThrows: true, kept: { 'ritemark-place-abc': '3' } });
  assert.equal(page.shown(), 2);
  assert.equal(page.restart.hidden, false);
}
// A kept place the page no longer has, or the top, is no return.
for (const value of ['1', '7', 'junk']) {
  const page = runPage({ kept: { 'ritemark-place-abc': value } });
  assert.equal(page.shown(), 0, value);
  assert.equal(page.restart.hidden, true, value);
}
// Nothing leaves the page: the script still loads nothing and builds no address beyond its own fragment.
assert.ok(!/\bfetch\b|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.(?!clipboard)/.test(PAGE_SCRIPT), 'nothing is sent anywhere');

console.log('pageScript: passed');
