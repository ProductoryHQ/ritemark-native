/**
 * Sprint 163 PR 4: the published page's one script, the reader's seat of Present's player. Its motion has the wall's own
 * numbers and steps (`wallMotion.ts`, `revealSteps.ts`); the whole script compiles, never closes its own tag, builds no
 * file names and sends nothing; and run over a real page (`pageHtml`, in domino's DOM) it opens the slide an address
 * names (`#N`) with its text, steps a slide's items one by one on the reader's press and shows a slide whole on a jump
 * or going back, keeps the ticks per deck, slide and step, marks a finished exercise in Contents, and keeps More's choice.
 * Small details 7: an address names a slide, the address follows it, and the page returns to a reader's last slide with
 * "Start from the beginning" for 5 s.
 *
 * Run: npx tsx src/decks/page/pageScript.test.ts
 */
import { strict as assert } from 'node:assert';
import * as vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
// @ts-expect-error: domino has no types of its own here (the webview declares them)
import domino from '@mixmark-io/domino';
import { scriptBuildsReferences } from '../../publish/references';
import * as editorEdges from '../../../webview/src/extensions/tables/tableEdges';
import { MOTION_MS, REVEAL_MS, REVEAL_RISE, ZOOM_FROM } from '../../../webview/src/components/decks/present/wallMotion';
import { revealOnArrival as hostRevealOnArrival, revealStepOf } from '../present/revealSteps';
import { BUILT_IN_THEME } from '../deckTheme';
import { blockSlideMarkup } from '../blocks/slideRenderer';
import { PAGE_EDGE_RULE, PAGE_MOTION_RULE, PAGE_PLACE_RULE, PAGE_SCRIPT } from './pageScript';
import { pageHtml, type PageAssets } from './pageHtml';
import { deckDigest, publicDeck } from './publicDeck';

/** A small seeded generator, so a failure names a state that can be run again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

// ---- the wall's motion, with the wall's numbers (README items 18 to 20)
interface Motion {
  MOTION: { fade: number; push: number; zoom: number };
  ZOOM_FROM: number;
  REVEAL_MS: number;
  REVEAL_RISE: number;
  rowDelays(n: number, lead: number, push: boolean): number[];
  revealOnArrival(count: number, onward: boolean): number | null;
  revealStep(shown: number | null, count: number, forward: boolean): number | null;
  stillFor(transition: string, reduced: boolean): boolean;
}
const motion = new Function(`${PAGE_MOTION_RULE}\nreturn { MOTION, ZOOM_FROM, REVEAL_MS, REVEAL_RISE, rowDelays, revealOnArrival, revealStep, stillFor };`)() as Motion;
{
  assert.deepEqual(motion.MOTION, { fade: MOTION_MS.fade, push: MOTION_MS.push, zoom: MOTION_MS.zoom }, 'the wall\'s transitions');
  assert.equal(motion.ZOOM_FROM, ZOOM_FROM);
  assert.equal(motion.REVEAL_MS, REVEAL_MS);
  assert.equal(motion.REVEAL_RISE, REVEAL_RISE);
  // Item 20: 70 ms apart up to eight pieces; with more, the gap shrinks (28 ms at least); from the 14th on, with the 14th.
  assert.deepEqual(motion.rowDelays(4, 140, false), [140, 210, 280, 350]);
  assert.deepEqual(motion.rowDelays(8, 0, false), [0, 70, 140, 210, 280, 350, 420, 490]);
  const many = motion.rowDelays(30, 0, false);
  assert.equal(many[1], 28, 'never closer than 28 ms');
  assert.equal(many[13], many[29], 'the 14th and every one after it together');
  assert.ok(many[29] + 480 <= 900, 'a slide settles within about 0.9 s');
  assert.deepEqual(motion.rowDelays(3, 0, true), [0, 30, 60], 'Push: the pieces come on the slide\'s heels, 30 ms apart');
  // Item 18, as the host's own steps (`revealSteps.ts`): going on opens with the first item, any other way whole.
  for (const count of [0, 1, 4]) {
    assert.equal(motion.revealOnArrival(count, true), hostRevealOnArrival(count, 'first')?.shown ?? null);
    assert.equal(motion.revealOnArrival(count, false), hostRevealOnArrival(count, 'whole')?.shown ?? null);
    for (let shown = 1; shown <= count; shown++) {
      for (const forward of [true, false]) assert.equal(motion.revealStep(shown, count, forward), revealStepOf({ shown, count }, forward ? 'next' : 'back')?.shown ?? null, `${shown}/${count} ${forward}`);
    }
  }
  assert.equal(motion.revealStep(null, 4, true), null, 'a slide shown whole moves on');
  // None and reduced motion: everything at once.
  assert.equal(motion.stillFor('none', false), true);
  assert.equal(motion.stillFor('fade', true), true);
  assert.equal(motion.stillFor('push', false), false);
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
  const sandbox = { document: { getElementById: () => null, querySelector: () => null, documentElement: {}, body: null }, window: {} };
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
  assert.equal(place.linkedPart('#99999999', 8), 0, 'any number with no part opens the top');
  assert.equal(place.linkedPart(`#${'9'.repeat(400)}`, 8), 0);
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


// ---- the whole script over a real page (domino's DOM, no layout, reduced motion so nothing animates)
const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: [],
};
const slide = (body: string) => ['```slide', body, '```'].join('\n');
const DECK = [
  '---', 'deck: 2', 'title: AI assistants and agents', 'handout: text', '---', '',
  slide('# AI assistants and agents\n\nA morning'), '', '## Welcome', '', 'Welcome words.', '',
  slide('# Triage the inbox\n\n::: steps\n1. Open the ten emails.\n2. Ask for three groups.\n:::'), '', '## Why triage', '', 'TRIAGETEXT words for the second slide.', '',
  slide('# Your list\n\n::: incremental\n- One\n- Two\n- Three\n:::'), '',
  slide('# Prompts\n\n::: {.panel-tabset}\n## Plan\n\nPLANWORDS\n\n## Write\n\nWRITEWORDS\n:::'), '',
].join('\n');
const deck = publicDeck(DECK, { folderName: 'Fernhollow Bank', deckName: 'training-2026-11-20', theme: BUILT_IN_THEME });
const html = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl: () => null });

interface Run {
  doc: Document;
  kept: Map<string, string>;
  hash(): string;
  key(key: string, target?: Element): void;
  click(element: Element): void;
  on(): number;
  advance(ms: number): void;
}
function runPage(options: { hash?: string; kept?: Record<string, string>; width?: number } = {}): Run {
  const doc = domino.createDocument(html, true) as Document;
  // The page's own script element stays out: the test runs the same text itself.
  doc.querySelector('script')?.remove();
  const kept = new Map(Object.entries(options.kept ?? {}));
  const location = { hash: options.hash ?? '', pathname: '/deck/index.html', search: '', protocol: 'https:', origin: 'https://pages.example' };
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const timers = new Map<number, { at: number; run: () => void }>();
  let now = 0, ids = 0;
  const width = options.width ?? 1440;
  const win: Record<string, unknown> = {
    innerWidth: width,
    innerHeight: 900,
    location,
    history: { replaceState(_state: unknown, _title: string, url: string) { location.hash = url.startsWith('#') ? url : ''; } },
    localStorage: { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => { kept.set(key, value); } },
    // Reduced motion (nothing animates in a DOM without layout), and the width's own one-column rule.
    matchMedia: (query: string) => ({ matches: query.includes('reduced-motion') || (query.includes('max-width: 860px') && width <= 860) }),
    addEventListener(type: string, listener: (event: unknown) => void) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    setTimeout(run: () => void, ms: number) { timers.set(++ids, { at: now + ms, run }); return ids; },
    clearTimeout(id: number) { timers.delete(id); },
    scrollTo() { /* one column */ },
    getComputedStyle: () => ({ overflowX: 'auto', direction: 'ltr' }),
    requestAnimationFrame(run: () => void) { run(); return 0; },
    cancelAnimationFrame() { /* */ },
  };
  vm.runInNewContext(PAGE_SCRIPT, { window: win, document: doc, navigator: {} });
  return {
    doc,
    kept,
    hash: () => location.hash,
    key(key: string, target?: Element) {
      for (const listener of listeners.get('keydown') ?? []) listener({ key, target: target ?? doc.body, preventDefault() { /* */ }, stopPropagation() { /* */ } });
    },
    click(element: Element) {
      const event = doc.createEvent('Event');
      event.initEvent('click', true, true);
      element.dispatchEvent(event);
    },
    on: () => Array.from(doc.querySelectorAll('#frame > .layer')).findIndex(layer => layer.classList.contains('on')),
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
    },
  };
}

// #2 opens slide 2 whole, with its text in More once More is on (the bug of #26: the text stayed at the page's end).
{
  const run = runPage({ hash: '#2' });
  assert.equal(run.on(), 1, '#2 shows slide 2');
  assert.equal(run.doc.getElementById('pos')!.textContent, '2 / 4');
  const side = run.doc.getElementById('side')!;
  assert.ok(side.hasAttribute('hidden'), 'More starts closed');
  const more = run.doc.getElementById('morebtn')!;
  assert.ok(!more.hasAttribute('hidden'), 'a slide with text offers More');
  run.click(more);
  assert.ok(!side.hasAttribute('hidden'), 'More opens the text beside the slide');
  assert.ok(run.doc.getElementById('t2')!.classList.contains('on'), 'the text shown is slide 2\'s');
  assert.ok(!run.doc.getElementById('t1')!.classList.contains('on'));
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  const placeKey = run.doc.body.getAttribute('data-place')!;
  assert.equal(run.kept.get(`${placeKey}-more`), '1', 'the choice stays on the device');
  // The next reader's visit at #2 opens with More as it was left.
  const again = runPage({ hash: '#2', kept: Object.fromEntries(run.kept) });
  assert.ok(!again.doc.getElementById('side')!.hasAttribute('hidden'), 'More kept open');
  // A slide with no text has no More.
  again.key('ArrowRight');
  assert.equal(again.on(), 2);
  assert.ok(again.doc.getElementById('morebtn')!.hasAttribute('hidden'), 'no text: no More');
  assert.ok(again.doc.getElementById('side')!.hasAttribute('hidden'));
  assert.equal(again.hash(), '#3', 'the address follows the slide');
}

// One by one on the reader's press: going on opens slide 3 with its first item; each press shows the next; back hides
// the last; going back to it from slide 4 shows it whole; a jump shows it whole.
{
  const run = runPage({ hash: '#2' });
  const hidden = () => run.doc.querySelectorAll('#s3 [data-reveal-hidden]').length;
  assert.equal(run.doc.getElementById('s3')!.getAttribute('data-items'), '3');
  run.key('ArrowRight');
  assert.equal(run.on(), 2);
  assert.equal(hidden(), 2, 'the first item only');
  run.key(' ');
  assert.equal(hidden(), 1, 'the space bar shows the next');
  run.click(run.doc.getElementById('next')!);
  assert.equal(hidden(), 0, 'the next button too');
  run.key('ArrowLeft');
  assert.equal(hidden(), 1, 'back hides the last shown');
  run.key('ArrowRight');
  run.key('ArrowRight');
  assert.equal(run.on(), 3, 'after the last item, the next slide');
  run.key('ArrowLeft');
  assert.equal(run.on(), 2);
  assert.equal(hidden(), 0, 'going back shows the slide whole');
  run.key('Home');
  run.click(run.doc.querySelector('#toc [data-go="2"]')!);
  assert.equal(run.on(), 2);
  assert.equal(hidden(), 0, 'Contents shows the slide whole');
  const linked = runPage({ hash: '#3' });
  assert.equal(linked.doc.querySelectorAll('#s3 [data-reveal-hidden]').length, 0, 'a link shows the slide whole');
}

// The ticks: a tap on a step's number checks it, kept per deck, slide and step; Contents shows the exercise finished.
{
  const run = runPage({ hash: '#2' });
  const ticks = Array.from(run.doc.querySelectorAll('#s2 .tick'));
  assert.equal(ticks.length, 2);
  assert.deepEqual(ticks.map(tick => [tick.getAttribute('role'), tick.getAttribute('aria-checked'), tick.getAttribute('aria-label')]), [['checkbox', 'false', 'Step 1 done'], ['checkbox', 'false', 'Step 2 done']]);
  const row = run.doc.querySelector('#toc [data-go="1"]')!;
  run.click(ticks[0]);
  assert.equal(ticks[0].getAttribute('aria-checked'), 'true');
  assert.ok(ticks[0].parentElement!.classList.contains('done'), 'the step\'s words go quiet');
  assert.ok(!row.classList.contains('finished'), 'one of two: not finished');
  run.click(ticks[1]);
  assert.ok(row.classList.contains('finished'), 'Contents shows a check in place of the tag');
  const store = run.doc.body.getAttribute('data-store')!;
  const saved = JSON.parse(run.kept.get(store)!) as Record<string, boolean>;
  const key = run.doc.getElementById('s2')!.getAttribute('data-key');
  assert.deepEqual(Object.keys(saved).sort(), [`slide:${key}:0.1`, `slide:${key}:0.2`], 'per deck (the store), slide and step');
  run.click(ticks[1]);
  assert.equal(ticks[1].getAttribute('aria-checked'), 'false', 'a second tap undoes it');
  assert.ok(!row.classList.contains('finished'));
  // Opened again, the reader's ticks are there.
  const again = runPage({ hash: '#2', kept: Object.fromEntries(run.kept) });
  assert.deepEqual(Array.from(again.doc.querySelectorAll('#s2 .tick')).map(tick => tick.getAttribute('aria-checked')), ['true', 'false']);
}

// Tabs: a click or the keyboard chooses a tab and shows its pane, as on the presenter view.
{
  const run = runPage({ hash: '#4' });
  const block = run.doc.querySelector('#s4 .blk-tabs')!;
  const tabs = Array.from(block.querySelectorAll('.blk-tab'));
  assert.equal(block.querySelector('.blk-tabbar')!.getAttribute('role'), 'tablist');
  assert.deepEqual(tabs.map(tab => [tab.getAttribute('role'), tab.getAttribute('aria-selected'), tab.getAttribute('tabindex')]), [['tab', 'true', '0'], ['tab', 'false', '-1']]);
  run.click(tabs[1]);
  assert.equal(block.getAttribute('data-active'), '1');
  assert.ok(tabs[1].classList.contains('is-active') && !tabs[0].classList.contains('is-active'));
  assert.ok(block.querySelectorAll('.blk-tabpane')[1].classList.contains('is-active'));
  assert.equal(block.querySelectorAll('.blk-tabpane')[0].getAttribute('aria-hidden'), 'true');
  const event = run.doc.createEvent('Event');
  event.initEvent('keydown', true, true);
  (event as unknown as { key: string }).key = 'ArrowLeft';
  tabs[1].dispatchEvent(event);
  assert.equal(block.getAttribute('data-active'), '0', 'the arrow keys move between the tabs');
}

// Small details 7: opened again without a link, the last slide, with "Start from the beginning" for 5 s.
{
  const first = runPage();
  assert.equal(first.on(), 0);
  first.key('ArrowRight');
  const placeKey = first.doc.body.getAttribute('data-place')!;
  assert.equal(first.kept.get(placeKey), '2');
  const back = runPage({ kept: Object.fromEntries(first.kept) });
  assert.equal(back.on(), 1, 'the reader\'s last slide');
  const restart = back.doc.getElementById('restart')!;
  assert.ok(!restart.hasAttribute('hidden'));
  back.advance(5000);
  assert.ok(restart.hasAttribute('hidden'), 'gone after 5 s');
  const restarted = runPage({ kept: Object.fromEntries(first.kept) });
  restarted.click(restarted.doc.getElementById('restart')!);
  assert.equal(restarted.on(), 0, 'it goes to the first slide');
  // A link wins over the kept place, without the notice.
  const linked = runPage({ hash: '#4', kept: Object.fromEntries(first.kept) });
  assert.equal(linked.on(), 3);
  assert.ok(linked.doc.getElementById('restart')!.hasAttribute('hidden'));
}

// One column: the frame is left to the CSS (no size set), and the page still steps.
{
  const run = runPage({ hash: '#2', width: 720 });
  assert.equal(run.doc.getElementById('frame')!.getAttribute('style') ?? '', '', 'no scale in one column');
  run.key('ArrowRight');
  assert.equal(run.on(), 2);
}

// The wall never shows ticks: the same slide drawn for the wall (no `ticks`) has none, and its canvas is a picture.
{
  const steps = { kind: '', data: { markdown: '# Triage\n\n::: steps\n1. Open.\n2. Ask.\n:::' } };
  const wall = blockSlideMarkup(steps.data, { theme: BUILT_IN_THEME, borderless: false });
  assert.ok(!wall.includes('class="tick"') && !wall.includes('role="checkbox"'), 'no ticks on the wall');
  assert.ok(/<div class="deck-sl[^"]*"[^>]*aria-hidden="true"/.test(wall), 'a picture of the slide on the wall');
  const page = blockSlideMarkup(steps.data, { theme: BUILT_IN_THEME, borderless: false, ticks: true, readable: true });
  assert.equal((page.match(/class="tick"/g) ?? []).length, 2);
  assert.ok(!/<div class="deck-sl[^"]*"[^>]*aria-hidden/.test(page), 'the page\'s slide is read');
}

// ---- A wide table's soft edges (the Experience lead on #781): the page's copy of the editor's rule gives the same
// answers, and it watches a table frame.
{
  const pageEdges = new Function(`${PAGE_EDGE_RULE}\nreturn { tableEdges, EDGE_SLACK, watchTableEdges };`)() as { tableEdges: typeof editorEdges.tableEdges; EDGE_SLACK: number; watchTableEdges: (frame: unknown, content: unknown, win: unknown) => () => void };
  assert.equal(pageEdges.EDGE_SLACK, editorEdges.EDGE_SLACK);
  const edgeNext = random(781);
  for (let probe = 0; probe < 2000; probe++) {
    const clientWidth = Math.round(edgeNext() * 900) + 100;
    const scrollWidth = clientWidth + Math.round((edgeNext() - 0.3) * 600) + (edgeNext() < 0.2 ? edgeNext() : 0);
    const room = Math.max(0, scrollWidth - clientWidth);
    const rtl = edgeNext() < 0.2;
    const scrollLeft = (edgeNext() < 0.15 ? 0 : edgeNext() < 0.15 ? room : edgeNext() * room) * (rtl ? -1 : 1);
    assert.deepEqual(pageEdges.tableEdges(scrollLeft, scrollWidth, clientWidth, rtl), editorEdges.tableEdges(scrollLeft, scrollWidth, clientWidth, rtl), `edges ${scrollLeft}/${scrollWidth}/${clientWidth}/${rtl}`);
  }
  const classes = new Set<string>();
  let onScroll: (() => void) | null = null;
  const frame = {
    isConnected: true, scrollLeft: 0, scrollWidth: 820, clientWidth: 720, offsetHeight: 100, clientHeight: 100,
    firstElementChild: {},
    classList: { toggle(name: string, on: boolean) { if (on) classes.add(name); else classes.delete(name); } },
    style: { setProperty() { /* */ }, removeProperty() { /* */ } },
    addEventListener(type: string, listener: () => void, options: { passive?: boolean }) { if (type === 'scroll') { assert.equal(options.passive, true); onScroll = listener; } },
  };
  pageEdges.watchTableEdges(frame, frame.firstElementChild, { getComputedStyle: () => ({ overflowX: 'auto', direction: 'ltr' }), requestAnimationFrame(run: () => void) { run(); return 0; }, cancelAnimationFrame() { /* */ } });
  assert.deepEqual([...classes], ['is-scrollable-right'], 'at the start of a wide table, its right side fades');
  frame.scrollLeft = 50;
  onScroll!();
  assert.deepEqual([...classes].sort(), ['is-scrollable-left', 'is-scrollable-right'], 'in the middle, both sides');
  frame.scrollLeft = 100;
  onScroll!();
  assert.deepEqual([...classes], ['is-scrollable-left'], 'at the end, the left side only');
}

// Nothing leaves the page: the script still loads nothing and builds no address beyond its own fragment.
assert.ok(!/\bfetch\b|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.(?!clipboard)/.test(PAGE_SCRIPT), 'nothing is sent anywhere');

console.log('pageScript: passed');
