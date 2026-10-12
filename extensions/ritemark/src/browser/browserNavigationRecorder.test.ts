/**
 * Tests for the Browser Recent recorder (Sprint 131, #195).
 *
 * Pure module, no `vscode` stub. A fake clock drives the 1 s settle (R1 revised)
 * and the 10 s title window (R5). Scenario ids refer to
 * docs/development/releases/v1.14.0/sprint-131-browser-recent/scenarios.md.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BrowserNavigationRecorder,
  DID_NAVIGATE_COMMAND,
  HistorySink,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  RecorderClock,
  SETTLE_MS,
  TITLE_SETTLE_MS,
  cleanTitle,
  historyKey,
  normalizeHistoryUrl,
  parseNavigationEvent,
  sameDocument,
} from './browserNavigationRecorder';

type Write = ['record', string, string | undefined] | ['setTitle', string, string];

class FakeClock implements RecorderClock {
  time = 1_000_000;
  private timers: { at: number; callback: () => void; cancelled: boolean }[] = [];

  now(): number {
    return this.time;
  }

  schedule(callback: () => void, ms: number): () => void {
    const timer = { at: this.time + ms, callback, cancelled: false };
    this.timers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  }

  advance(ms: number): void {
    this.time += ms;
    const due = this.timers.filter((t) => !t.cancelled && t.at <= this.time);
    this.timers = this.timers.filter((t) => !due.includes(t));
    for (const t of due) t.callback();
  }
}

function setup(): { recorder: BrowserNavigationRecorder; clock: FakeClock; writes: Write[] } {
  const writes: Write[] = [];
  const sink: HistorySink = {
    record: async (url, title) => {
      writes.push(['record', url, title]);
    },
    setTitle: async (url, title) => {
      writes.push(['setTitle', url, title]);
    },
  };
  const clock = new FakeClock();
  return { recorder: new BrowserNavigationRecorder(sink, clock), clock, writes };
}

function nav(url: string, title = '', extra: Partial<Record<'pageId' | 'failed' | 'ephemeral', unknown>> = {}) {
  return { kind: 'navigate', pageId: 'p1', url, title, failed: false, ephemeral: false, ...extra };
}

function titleEvent(url: string, title: string, pageId = 'p1') {
  return { kind: 'title', pageId, url, title, failed: false, ephemeral: false };
}

const T = 'http://localhost:8765/titled.html';

// --- Pure helpers -----------------------------------------------------------

// R8 / S28: malformed input is ignored.
assert.equal(parseNavigationEvent(undefined), undefined);
assert.equal(parseNavigationEvent('x'), undefined);
assert.equal(parseNavigationEvent({ ...nav(T), kind: 'open' }), undefined);
assert.equal(parseNavigationEvent({ ...nav(T), url: undefined }), undefined);
assert.equal(parseNavigationEvent({ ...nav(T), title: 42 }), undefined);
assert.equal(parseNavigationEvent({ ...nav(T), pageId: '' }), undefined);
assert.equal(parseNavigationEvent({ ...nav(T), failed: 'no' }), undefined);
assert.deepEqual(parseNavigationEvent(nav(T, 'x')), nav(T, 'x'));

// R3 / S12, S17, S18: schemes and length; R4: normalization.
assert.equal(normalizeHistoryUrl('about:blank'), undefined);
assert.equal(normalizeHistoryUrl('data:text/html,hi'), undefined);
assert.equal(normalizeHistoryUrl('blob:https://a.example/1'), undefined);
assert.equal(normalizeHistoryUrl('chrome-error://chromewebdata/'), undefined);
assert.equal(normalizeHistoryUrl('vscode-file://vscode-app/x.html'), undefined);
assert.equal(normalizeHistoryUrl('not a url'), undefined);
assert.equal(normalizeHistoryUrl('https://a.example/' + 'x'.repeat(MAX_URL_LENGTH)), undefined);
assert.equal(normalizeHistoryUrl('https://Ritemark.app'), 'https://ritemark.app/');
assert.equal(normalizeHistoryUrl('http://example.com:80/a'), 'http://example.com/a');
assert.equal(normalizeHistoryUrl('https://user:secret@example.com/p'), 'https://example.com/p');
assert.equal(normalizeHistoryUrl('file:///tmp/report.html'), 'file:///tmp/report.html');
// R7 / S26: loopback is an ordinary web page.
assert.equal(normalizeHistoryUrl('http://localhost:5173/about'), 'http://localhost:5173/about');
assert.equal(normalizeHistoryUrl('http://127.0.0.1:8765/'), 'http://127.0.0.1:8765/');

assert.equal(sameDocument('https://a.example/p#x', 'https://a.example/p'), true);
assert.equal(sameDocument('https://a.example/p#x', 'https://a.example/p#y'), true);
assert.equal(sameDocument('https://a.example/p', 'https://a.example/q'), false);

// R4 revised / S19, S31: one key per page, whatever the case, slash or #fragment.
assert.equal(historyKey('https://Ritemark.app'), historyKey('https://ritemark.app/'));
assert.equal(historyKey('http://localhost:8765/titled.html#section'), historyKey('http://localhost:8765/titled.html'));
assert.notEqual(historyKey('https://a.example/p'), historyKey('https://a.example/q'));
assert.equal(historyKey('not a url#x'), 'not a url');

// R5 / S23 + Phase 0 P2: Chromium's fallback titles are not titles.
assert.equal(cleanTitle('', T), undefined);
assert.equal(cleanTitle('   ', T), undefined);
assert.equal(cleanTitle(T, T), undefined);
assert.equal(cleanTitle('localhost:8765/titled.html', T), undefined);
assert.equal(cleanTitle('example.com', 'https://example.com/'), undefined);
assert.equal(cleanTitle('example.com/', 'https://example.com/'), undefined);
assert.equal(cleanTitle('report.html', 'file:///tmp/ws/report.html'), undefined);
assert.equal(cleanTitle('/tmp/ws/report.html', 'file:///tmp/ws/report.html'), undefined);
assert.equal(cleanTitle('my report.html', 'file:///tmp/ws/my%20report.html'), undefined);
assert.equal(cleanTitle('  Q3\n report ', 'file:///tmp/ws/report.html'), 'Q3 report');
const long = cleanTitle('x'.repeat(MAX_TITLE_LENGTH + 50), T);
assert.equal(long?.length, MAX_TITLE_LENGTH);
assert.ok(long?.endsWith('…'));

// --- Recorder ---------------------------------------------------------------

// R1 / S1: a typed address settles after 1 s with the title that arrived meanwhile.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T, 'localhost:8765/titled.html'));
  recorder.handle(titleEvent(T, 'Titled Fixture'));
  assert.deepEqual(writes, []);
  clock.advance(SETTLE_MS - 1);
  assert.deepEqual(writes, []);
  clock.advance(1);
  assert.deepEqual(writes, [['record', T, 'Titled Fixture']]);
}

// R1 revised / S30: a client-side redirect records only where the tab settled.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav('http://localhost:8765/redirect.html'));
  recorder.handle(titleEvent('http://localhost:8765/redirect.html', 'Redirecting'));
  clock.advance(12);
  recorder.handle(nav('http://localhost:8765/page2.html'));
  recorder.handle(titleEvent('http://localhost:8765/page2.html', 'Second Page'));
  clock.advance(SETTLE_MS);
  assert.deepEqual(writes, [['record', 'http://localhost:8765/page2.html', 'Second Page']]);
}

// R1 / S2, S4: a same-tab link and Back each record (after settling).
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T, 'Titled Fixture'));
  clock.advance(SETTLE_MS);
  recorder.handle(nav('http://localhost:8765/page2.html', 'Second Page'));
  clock.advance(SETTLE_MS);
  recorder.handle(nav(T, 'Titled Fixture'));
  clock.advance(SETTLE_MS);
  assert.deepEqual(writes.map((w) => w[1]), [T, 'http://localhost:8765/page2.html', T]);
}

// R1 / S3: pushState is a new entry; the stale title is corrected by the title event (P5).
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav('http://localhost:8765/spa.html', 'SPA Home'));
  clock.advance(SETTLE_MS);
  recorder.handle(nav('http://localhost:8765/spa/route-a', 'SPA Home'));
  recorder.handle(titleEvent('http://localhost:8765/spa/route-a', 'SPA Route A'));
  clock.advance(SETTLE_MS);
  assert.deepEqual(writes, [
    ['record', 'http://localhost:8765/spa.html', 'SPA Home'],
    ['record', 'http://localhost:8765/spa/route-a', 'SPA Route A'],
  ]);
}

// R3 / S13, S16, S12: failed loads, private tabs and blank pages record nothing.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav('https://no-such-host-ritemark.invalid/', '', { failed: true }));
  recorder.handle(nav('https://example.com/', 'Example', { ephemeral: true }));
  recorder.handle(titleEvent('https://example.com/', 'Example'));
  recorder.handle(nav('about:blank'));
  clock.advance(SETTLE_MS * 5);
  assert.deepEqual(writes, []);
}

// R3 / S14, S15, S10: #anchor, reload and tab switches are not new visits.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T, 'Titled Fixture'));
  clock.advance(SETTLE_MS);
  recorder.handle(nav(T + '#section', 'Titled Fixture'));
  recorder.handle(nav(T + '#section', 'Titled Fixture')); // reload
  recorder.handle(nav(T, 'Titled Fixture')); // tab shown again
  clock.advance(SETTLE_MS * 5);
  assert.deepEqual(writes, [['record', T, 'Titled Fixture']]);
}

// R2 / S10: a background tab is recorded when first shown; other tabs are independent.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T, 'Titled Fixture'));
  clock.advance(SETTLE_MS);
  recorder.handle(nav('http://localhost:8765/untitled.html', 'localhost:8765/untitled.html', { pageId: 'p2' }));
  clock.advance(SETTLE_MS);
  recorder.handle(nav(T, 'Titled Fixture')); // back to tab p1
  recorder.handle(nav('http://localhost:8765/untitled.html', '', { pageId: 'p2' })); // and to p2
  clock.advance(SETTLE_MS * 5);
  assert.deepEqual(writes, [
    ['record', T, 'Titled Fixture'],
    ['record', 'http://localhost:8765/untitled.html', undefined],
  ]);
}

// R5 / S21, S22: a title after settling is written in place; changes after 10 s are ignored.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav('http://localhost:8765/ticking.html'));
  recorder.handle(titleEvent('http://localhost:8765/ticking.html', 'Tick 0'));
  clock.advance(SETTLE_MS);
  recorder.handle(titleEvent('http://localhost:8765/ticking.html', 'Tick 1'));
  recorder.handle(titleEvent('http://localhost:8765/ticking.html', 'Tick 1'));
  clock.advance(TITLE_SETTLE_MS);
  recorder.handle(titleEvent('http://localhost:8765/ticking.html', 'Tick 11'));
  assert.deepEqual(writes, [
    ['record', 'http://localhost:8765/ticking.html', 'Tick 0'],
    ['setTitle', 'http://localhost:8765/ticking.html', 'Tick 1'],
  ]);
}

// R5: a title for a page the tab already left is ignored.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T));
  clock.advance(SETTLE_MS);
  recorder.handle(nav('http://localhost:8765/page2.html'));
  recorder.handle(titleEvent(T, 'Late title'));
  clock.advance(SETTLE_MS);
  assert.deepEqual(writes, [
    ['record', T, undefined],
    ['record', 'http://localhost:8765/page2.html', undefined],
  ]);
}

// R1 revised: dispose records every navigation still waiting.
{
  const { recorder, clock, writes } = setup();
  recorder.handle(nav(T, 'Titled Fixture'));
  recorder.dispose();
  clock.advance(SETTLE_MS * 5);
  assert.deepEqual(writes, [['record', T, 'Titled Fixture']]);
}

// R8: a sink failure does not throw out of the recorder.
{
  const clock = new FakeClock();
  const recorder = new BrowserNavigationRecorder(
    { record: () => Promise.reject(new Error('disk')), setTitle: () => Promise.reject(new Error('disk')) },
    clock
  );
  recorder.handle(nav(T));
  clock.advance(SETTLE_MS);
  recorder.handle(titleEvent(T, 'Title'));
}

// R8: the command name matches patch 009 (the workbench side of the bridge).
{
  const patch = fs.readFileSync(
    path.resolve(__dirname, '../../../../patches/vscode/009-ritemark-browser-context-bridge.patch'),
    'utf8'
  );
  assert.ok(
    patch.includes(`RITEMARK_BROWSER_DID_NAVIGATE_COMMAND = '${DID_NAVIGATE_COMMAND}'`),
    `patch 009 must define RITEMARK_BROWSER_DID_NAVIGATE_COMMAND = '${DID_NAVIGATE_COMMAND}'`
  );
}

console.log('All browser navigation recorder tests passed.');
