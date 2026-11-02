/**
 * Sprint 148, PR 2 (R5–R8, E3): the results view's host side, with fakes.
 * The Search row's decisions, the view's messages decoded, 5 rows then one kind
 * whole, a newer query winning, the open, the keys, the refresh while reading,
 * and M2's samples.
 *
 * Run: npx tsx src/search/searchPanel.test.ts
 */
import assert from 'node:assert/strict';
import { decodeSearchViewMessage, type IndexStatus, type SearchAnswer, type SearchGroup, type SearchHostToViewMessage, type SearchKind, type SearchOptions, type SearchResult } from './protocol';
import { PER_KIND, REFRESH_MS, SearchPanelController, searchRowAction, searchRowNeedsShell } from './searchPanel';

let failures = 0;
async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(error as Error).stack ?? (error as Error).message}`);
  }
}

function result(kind: SearchKind, n: number): SearchResult {
  return { key: `${kind}:${n}`, kind, layer: 'words', name: `${kind} ${n}`, where: null, changedAt: null, passage: null, match: null, ...(kind === 'document' ? { path: `/p/${n}.md` } : {}) };
}

function group(kind: SearchKind, total: number, shown = Math.min(total, PER_KIND)): SearchGroup {
  return { kind, total, results: Array.from({ length: shown }, (_, i) => result(kind, i)) };
}

function answer(groups: SearchGroup[], extra: Partial<SearchAnswer> = {}): SearchAnswer {
  return { queryId: 1, layer: 'words', tooShort: false, groups, reading: null, limited: false, tooLarge: 0, tookMs: 1, ...extra };
}

interface Call { text: string; options: SearchOptions; perKind: number; expand?: SearchKind }

function harness(respond: (call: Call) => SearchAnswer | null | Promise<SearchAnswer | null>) {
  const calls: Call[] = [];
  const posted: SearchHostToViewMessage[] = [];
  const opened: SearchResult[] = [];
  const events: string[] = [];
  let now = 0;
  const timers: { run: () => void; at: number }[] = [];
  const panel = new SearchPanelController({
    query: async (text, options, perKind, expand) => {
      const call = { text, options, perKind, ...(expand ? { expand } : {}) };
      calls.push(call);
      return respond(call);
    },
    post: (message) => posted.push(message),
    setup: () => ({ projectName: 'Leadership programme', roots: ['/p'] }),
    open: async (r) => { opened.push(r); },
    focusResults: async () => { events.push('focus-results'); },
    focusBox: async () => { events.push('focus-box'); },
    now: () => now,
    clock: () => 1000 + now,
    setTimer: (run, ms) => { const timer = { run, at: now + ms }; timers.push(timer); return timer; },
    clearTimer: (handle) => { timers.splice(timers.indexOf(handle as never), 1); },
  });
  const results = () => posted.filter((m): m is Extract<SearchHostToViewMessage, { type: 'search/results' }> => m.type === 'search/results');
  return {
    panel, calls, posted, opened, events, results,
    advance(ms: number) {
      now += ms;
      for (const timer of [...timers].filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const READING: IndexStatus = { state: 'reading', documents: { done: 120, total: 900 }, limited: false, tooLarge: 0, failed: 0, chats: 2, tasks: 1 };

async function main() {
  console.log('Search results view, host side');

  await test('the Search row: words, keys, nothing, a key binding, and the kill switch (E3)', () => {
    const on = { enabled: true, shellHasBox: true };
    assert.deepEqual(searchRowAction({ text: 'report' }, on), { kind: 'query', text: 'report' });
    assert.deepEqual(searchRowAction({ text: '' }, on), { kind: 'query', text: '' }, 'an empty box clears');
    assert.deepEqual(searchRowAction({ key: 'down' }, on), { kind: 'focus-first' });
    assert.deepEqual(searchRowAction({ key: 'enter' }, on), { kind: 'open-top' });
    assert.deepEqual(searchRowAction(undefined, on), { kind: 'focus-box' }, 'a click or ⌘⇧F on a shell with the box focuses it');
    assert.deepEqual(searchRowAction({ via: 'key' }, on), { kind: 'focus-box' });
    // A shell without the box (2.1 with a newer extension): VS Code's search, as today
    const oldShell = { enabled: true, shellHasBox: false };
    assert.deepEqual(searchRowAction(undefined, oldShell), { kind: 'vscode-search', command: 'workbench.view.search' });
    assert.deepEqual(searchRowAction({ via: 'key' }, oldShell), { kind: 'vscode-search', command: 'workbench.action.findInFiles' }, '⌘⇧F seeds from the selection as before');
    // The kill switch off: VS Code's search, whatever the argument
    const off = { enabled: false, shellHasBox: true };
    for (const arg of [undefined, { text: 'report' }, { key: 'down' }, { key: 'enter' }]) {
      assert.deepEqual(searchRowAction(arg, off), { kind: 'vscode-search', command: 'workbench.view.search' });
    }
    assert.equal((searchRowAction({ text: 'x'.repeat(5000) }, on) as { text: string }).text.length, 1000, 'the words are capped');
  });

  await test('the view\'s messages are decoded; anything else is dropped', () => {
    assert.deepEqual(decodeSearchViewMessage({ type: 'search/open', key: 'chat:abc' }), { type: 'search/open', key: 'chat:abc' });
    assert.deepEqual(decodeSearchViewMessage({ type: 'search/options', matchCase: true, wholeWords: false, kinds: ['task', 'bogus', 'document'] }), { type: 'search/options', matchCase: true, wholeWords: false, kinds: ['document', 'task'] });
    assert.deepEqual(decodeSearchViewMessage({ type: 'search/more', kind: 'chat' }), { type: 'search/more', kind: 'chat' });
    assert.deepEqual(decodeSearchViewMessage({ type: 'search/painted', queryId: 7 }), { type: 'search/painted', queryId: 7 });
    assert.deepEqual(decodeSearchViewMessage({ type: 'search/fewer', extra: 1 }), { type: 'search/fewer' });
    for (const bad of [null, 'x', {}, { type: 'search/open' }, { type: 'search/open', key: '' }, { type: 'search/more', kind: 'file' }, { type: 'search/options', matchCase: 'yes', wholeWords: false, kinds: [] }, { type: 'search/painted', queryId: 1.5 }, { type: 'nope' }]) {
      assert.equal(decodeSearchViewMessage(bad), null, JSON.stringify(bad));
    }
  });

  await test('5 rows per kind; every kind asked for, so More can count them; ids increase', async () => {
    const h = harness(() => answer([group('document', 23), group('chat', 8), group('task', 2)]));
    await h.panel.setText('report');
    assert.deepEqual(h.calls[0], { text: 'report', options: { matchCase: false, wholeWords: false, kinds: ['document', 'chat', 'task'] }, perKind: PER_KIND });
    const [first] = h.results();
    assert.equal(first.expanded, null);
    assert.equal(first.queryId, 1);
    await h.panel.setText('reports');
    assert.equal(h.results()[1].queryId, 2);
  });

  await test('one kind only: all of it at once; Show all opens a kind; Show fewer closes it (question 5)', async () => {
    const h = harness((call) => call.expand === 'document' ? answer([group('document', 23, 23)]) : answer([group('document', 23)]));
    await h.panel.setText('brief');
    assert.equal(h.calls.length, 2, 'asked again for the whole kind');
    assert.equal(h.calls[1].expand, 'document');
    // Its first rows are drawn at once, then the whole kind follows
    assert.deepEqual(h.results().map((m) => m.groups[0].results.length), [5, 23]);
    assert.deepEqual(h.results()[0].expanded, { kind: 'document', auto: true });
    assert.deepEqual(h.results()[1].expanded, { kind: 'document', auto: true });

    const h2 = harness((call) => answer([group('document', 23, call.expand === 'document' ? 23 : 5), group('chat', 3)]));
    await h2.panel.setText('brief');
    assert.equal(h2.calls.length, 1);
    await h2.panel.onViewMessage({ type: 'search/more', kind: 'document' });
    assert.equal(h2.calls[1].expand, 'document');
    assert.deepEqual(h2.results()[1].expanded, { kind: 'document', auto: false });
    await h2.panel.onViewMessage({ type: 'search/fewer' });
    assert.equal(h2.calls[2].expand, undefined);
    assert.equal(h2.results()[2].expanded, null);
    // A kind turned off in More leaves one kind: that one whole
    await h2.panel.onViewMessage({ type: 'search/options', matchCase: false, wholeWords: false, kinds: ['document'] });
    assert.deepEqual(h2.results().at(-1)!.expanded, { kind: 'document', auto: true });
  });

  await test('an older query\'s answer is never posted over a newer one\'s (R5)', async () => {
    let releaseFirst: (a: SearchAnswer) => void = () => undefined;
    let n = 0;
    const h = harness(() => {
      n++;
      if (n === 1) return new Promise<SearchAnswer>((resolve) => { releaseFirst = resolve; });
      return answer([group('document', 1)]);
    });
    const first = h.panel.setText('rep');
    await h.panel.setText('report');
    releaseFirst(answer([group('document', 9)]));
    await first;
    assert.equal(h.results().length, 1, 'only the newer words');
    assert.equal(h.results()[0].groups[0].total, 1);
  });

  await test('the options change the query; matchCase and wholeWords reach the worker', async () => {
    const h = harness(() => answer([group('document', 2), group('chat', 1)]));
    await h.panel.setText('Brief');
    await h.panel.onViewMessage({ type: 'search/options', matchCase: true, wholeWords: true, kinds: ['document', 'chat', 'task'] });
    assert.deepEqual(h.calls.at(-1)!.options, { matchCase: true, wholeWords: true, kinds: ['document', 'chat', 'task'] });
    const count = h.calls.length;
    await h.panel.onViewMessage({ type: 'search/options', matchCase: true, wholeWords: true, kinds: ['document', 'chat', 'task'] });
    assert.equal(h.calls.length, count, 'the same options ask nothing again');
  });

  await test('Enter opens the top visible row; ↓ moves into the results; a click opens its row; ↑ goes back to the box (R8)', async () => {
    const h = harness(() => answer([group('document', 2), group('chat', 1)]));
    await h.panel.setText('brief');
    await h.panel.key('enter');
    assert.equal(h.opened[0].key, 'document:0');
    await h.panel.onViewMessage({ type: 'search/options', matchCase: false, wholeWords: false, kinds: ['chat'] });
    await h.panel.key('enter');
    assert.equal(h.opened[1].key, 'chat:0', 'a kind turned off is not the top');
    await h.panel.onViewMessage({ type: 'search/open', key: 'document:1' });
    assert.equal(h.opened[2].key, 'document:1');
    await h.panel.onViewMessage({ type: 'search/open', key: 'document:99' });
    assert.equal(h.opened.length, 3, 'a key it didn\'t show opens nothing');
    await h.panel.key('down');
    assert.deepEqual(h.events, ['focus-results']);
    assert.equal(h.posted.at(-1)!.type, 'search/focus-first');
    await h.panel.onViewMessage({ type: 'search/back-to-box' });
    assert.deepEqual(h.events, ['focus-results', 'focus-box']);
  });

  await test('while the index reads, the shown words run again, at most every REFRESH_MS (R6)', async () => {
    const h = harness(() => answer([group('document', 1)], { reading: { done: 120, total: 900 } }));
    h.panel.onStatus(READING);
    assert.equal(h.calls.length, 0, 'no words shown: nothing to run');
    await h.panel.setText('brief');
    h.panel.onStatus(READING);
    await flush();
    assert.equal(h.calls.length, 2);
    h.panel.onStatus(READING);
    h.panel.onStatus(READING);
    await flush();
    assert.equal(h.calls.length, 2, 'held back');
    h.advance(REFRESH_MS);
    await flush();
    assert.equal(h.calls.length, 3, 'once more after the wait');
    assert.ok(h.posted.some((m) => m.type === 'search/status'));
  });

  await test('the view (re)loading gets the setup, the status and the shown answer again', async () => {
    const h = harness(() => answer([group('document', 1)]));
    await h.panel.setText('brief');
    h.panel.onStatus({ ...READING, state: 'ready' });
    await flush();
    h.posted.length = 0;
    await h.panel.onViewMessage({ type: 'search/ready' });
    assert.deepEqual(h.posted.map((m) => m.type), ['search/setup', 'search/status', 'search/results']);
    const setup = h.posted[0] as Extract<SearchHostToViewMessage, { type: 'search/setup' }>;
    assert.equal(setup.setup.projectName, 'Leadership programme');
  });

  await test('M2 and M5: from the words\' arrival to the view\'s paint; refreshes are not keys', async () => {
    const h = harness(() => answer([group('document', 1)]));
    await h.panel.setText('br');
    h.advance(12);
    await h.panel.onViewMessage({ type: 'search/painted', queryId: 1 });
    await h.panel.setText('bri');
    h.advance(30);
    await h.panel.onViewMessage({ type: 'search/painted', queryId: 2 });
    h.panel.onStatus({ ...READING, state: 'ready' });
    await flush();
    await h.panel.onViewMessage({ type: 'search/painted', queryId: 3 });
    const stats = h.panel.stats();
    assert.equal(stats.keyToPaint!.n, 2);
    assert.equal(stats.keyToPaint!.max, 30);
    assert.equal(stats.firstPaintMs, 12);
    assert.deepEqual(stats.lastPaint, { at: 1042, total: 1 });
  });

  // ── The review of #636 ──

  await test('Enter right after a key opens the top row of that key\'s answer, not the one before', async () => {
    let release: (a: SearchAnswer) => void = () => undefined;
    const h = harness((call) => {
      if (call.text === 'report') return new Promise<SearchAnswer>((resolve) => { release = resolve; });
      return answer([group('document', 1)]);
    });
    await h.panel.setText('repor');
    const typing = h.panel.setText('report');
    const enter = h.panel.key('enter');
    await flush();
    assert.equal(h.opened.length, 0, 'waits for the new words\' answer');
    release(answer([{ kind: 'chat', total: 1, results: [result('chat', 7)] }]));
    await typing;
    await enter;
    assert.deepEqual(h.opened.map((r) => r.key), ['chat:7']);
  });

  await test('a refresh of a kind shown whole asks for it whole: the list never shrinks to 5 and back', async () => {
    const h = harness((call) => answer([group('document', 23, call.expand === 'document' ? 23 : 5)], { reading: { done: 1, total: 9 } }));
    await h.panel.setText('brief');
    const before = h.results().length;
    h.panel.onStatus(READING);
    await flush();
    const refreshed = h.results().slice(before);
    assert.deepEqual(refreshed.map((m) => m.groups[0].results.length), [23], 'one answer, whole');
    assert.equal(h.calls.at(-1)!.expand, 'document');
  });

  await test('the words and keys never wait on the shell\'s answer; nothing and ⌘⇧F do', () => {
    assert.equal(searchRowNeedsShell({ text: 'r' }), false);
    assert.equal(searchRowNeedsShell({ text: '' }), false);
    assert.equal(searchRowNeedsShell({ key: 'down' }), false);
    assert.equal(searchRowNeedsShell({ key: 'enter' }), false);
    assert.equal(searchRowNeedsShell(undefined), true);
    assert.equal(searchRowNeedsShell({ via: 'key' }), true);
  });

  await test('the kill switch turned off clears the view, and Enter opens nothing', async () => {
    const h = harness(() => answer([group('document', 2)]));
    await h.panel.setText('brief');
    h.panel.clear();
    const last = h.results().at(-1)!;
    assert.equal(last.tooShort, true);
    assert.deepEqual(last.groups, []);
    await h.panel.key('enter');
    await h.panel.onViewMessage({ type: 'search/open', key: 'document:0' });
    assert.equal(h.opened.length, 0);
    h.panel.onStatus(READING);
    await flush();
    assert.equal(h.calls.length, 1, 'nothing runs again');
  });

  await test('the project\'s folders changing sends the view its name and folders again', () => {
    const h = harness(() => null);
    h.panel.refreshSetup();
    assert.equal(h.posted.at(-1)!.type, 'search/setup');
  });

  await test('↓ while the view loads: its first rows take the keyboard once it is ready', async () => {
    const h = harness(() => answer([group('document', 1)]));
    await h.panel.setText('brief');
    await h.panel.key('down');
    h.posted.length = 0;
    await h.panel.onViewMessage({ type: 'search/ready' });
    assert.equal(h.posted.at(-1)!.type, 'search/focus-first');
    h.posted.length = 0;
    await h.panel.onViewMessage({ type: 'search/ready' });
    assert.ok(!h.posted.some((m) => m.type === 'search/focus-first'), 'once');
  });

  if (failures) {
    console.error(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nAll passed');
}

void main();
