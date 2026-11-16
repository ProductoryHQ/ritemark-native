/**
 * Sprint 159 (technical plan §6): the page's scroll rule is the deck view's. `PAGE_SCROLL_RULE` (plain JavaScript in the
 * page) and `scrollRule.ts` (the editor's) are run over generated states and must agree on every answer; and the
 * whole script compiles, never closes its own tag, and builds no file names.
 *
 * Run: npx tsx src/decks/page/pageScript.test.ts
 */
import { strict as assert } from 'node:assert';
import * as vm from 'node:vm';
import { scriptBuildsReferences } from '../../publish/references';
import * as editor from '../../../webview/src/components/decks/scrollRule';
import { PAGE_SCRIPT, PAGE_SCROLL_RULE } from './pageScript';

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

console.log('pageScript: passed');
