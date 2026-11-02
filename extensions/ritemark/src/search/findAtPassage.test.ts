/**
 * Sprint 148, PR 4 (R9): the host side of "a document opens at its passage".
 * The message's shape, which results get one, which page gets it, a page that isn't listening yet, a request
 * that waited too long, and a page that fails to take it. Also that the three editors answer as planned and
 * post nothing but the find bar's message.
 *
 * Run: npx tsx src/search/findAtPassage.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { FIND_WAIT_MS, FindRequests, MAX_FIND_TEXT, findOpenMessage, type FindOpenMessage } from './findAtPassage';
import type { SearchResult } from './protocol';

let failures = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(error as Error).stack ?? (error as Error).message}`);
  }
}

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    key: 'document:/p/Annual report.md',
    kind: 'document',
    layer: 'words',
    name: 'Annual report',
    where: null,
    changedAt: null,
    path: '/p/Annual report.md',
    format: 'markdown',
    passage: { text: 'The annual report', marks: [[4, 10]], at: { block: 3 } },
    match: { text: 'annual', occurrence: 2 },
    ...overrides,
  };
}

console.log('findOpenMessage');

test('a Markdown result: the matched word and its occurrence, nothing else', () => {
  assert.deepEqual(findOpenMessage(result()), { type: 'find:open', text: 'annual', occurrence: 2 });
});

test('a Word result: the same shape', () => {
  assert.deepEqual(findOpenMessage(result({ format: 'docx' })), { type: 'find:open', text: 'annual', occurrence: 2 });
});

test('a PDF result carries its page', () => {
  const message = findOpenMessage(result({ format: 'pdf', passage: { text: 'x', marks: [], at: { page: 30 } } }));
  assert.deepEqual(message, { type: 'find:open', text: 'annual', occurrence: 2, page: 30 });
});

test('no message for a CSV, a hit in the name alone, a comment, a chat or a task', () => {
  assert.equal(findOpenMessage(result({ format: 'csv' })), null);
  assert.equal(findOpenMessage(result({ match: null })), null);
  assert.equal(findOpenMessage(result({ kind: 'chat', format: undefined })), null);
  assert.equal(findOpenMessage(result({ kind: 'task', format: undefined })), null);
});

test('untrusted text: empty, control characters or too long gives no message; it is never altered', () => {
  assert.equal(findOpenMessage(result({ match: { text: '   ', occurrence: 0 } })), null);
  assert.equal(findOpenMessage(result({ match: { text: 'a\nb', occurrence: 0 } })), null);
  assert.equal(findOpenMessage(result({ match: { text: 'x'.repeat(MAX_FIND_TEXT + 1), occurrence: 0 } })), null);
  const odd = '<img src=x onerror=alert(1)>.*(';
  assert.equal(findOpenMessage(result({ match: { text: odd, occurrence: 0 } }))?.text, odd);
});

test('a bad occurrence lands on the first match', () => {
  assert.equal(findOpenMessage(result({ match: { text: 'a', occurrence: -1 } }))?.occurrence, 0);
  assert.equal(findOpenMessage(result({ match: { text: 'a', occurrence: 1.5 } }))?.occurrence, 0);
});

console.log('FindRequests');

const MESSAGE: FindOpenMessage = { type: 'find:open', text: 'annual', occurrence: 2 };

function clock(start = 1000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

test('an open, listening page gets it at once; another document’s page does not', () => {
  const requests = new FindRequests();
  const mine: unknown[] = [];
  const other: unknown[] = [];
  requests.ready('file:///p/a.md', {}, (m) => mine.push(m));
  requests.ready('file:///p/b.md', {}, (m) => other.push(m));
  assert.equal(requests.request('file:///p/a.md', MESSAGE), 'posted');
  assert.deepEqual(mine, [MESSAGE]);
  assert.deepEqual(other, []);
  assert.equal(requests.waiting('file:///p/a.md'), null);
});

test('a page not listening yet: the request waits and goes when the page says ready, once', () => {
  const requests = new FindRequests();
  assert.equal(requests.request('file:///p/a.md', MESSAGE), 'waiting');
  const got: unknown[] = [];
  const page = {};
  requests.ready('file:///p/a.md', page, (m) => got.push(m));
  assert.deepEqual(got, [MESSAGE]);
  requests.ready('file:///p/a.md', page, (m) => got.push(m));
  assert.equal(got.length, 1, 'a page that says ready again does not get it twice');
});

test('a page that never says ready leaves the document at its top: a late page gets nothing', () => {
  const time = clock();
  const requests = new FindRequests(time.now);
  requests.request('file:///p/a.md', MESSAGE);
  time.advance(FIND_WAIT_MS + 1);
  const got: unknown[] = [];
  requests.ready('file:///p/a.md', {}, (m) => got.push(m));
  assert.deepEqual(got, []);
});

test('a newer result for the same document replaces the waiting one', () => {
  const requests = new FindRequests();
  requests.request('file:///p/a.md', MESSAGE);
  requests.request('file:///p/a.md', { ...MESSAGE, occurrence: 5 });
  const got: FindOpenMessage[] = [];
  requests.ready('file:///p/a.md', {}, (m) => got.push(m));
  assert.equal(got.length, 1);
  assert.equal(got[0].occurrence, 5);
});

test('a closed page is no longer posted to; the request waits instead', () => {
  const requests = new FindRequests();
  const page = {};
  const got: unknown[] = [];
  requests.ready('file:///p/a.md', page, (m) => got.push(m));
  requests.gone('file:///p/a.md', page);
  assert.equal(requests.request('file:///p/a.md', MESSAGE), 'waiting');
  assert.deepEqual(got, []);
  requests.gone('file:///p/never.md', {});
});

test('a page that throws or rejects never throws to the opener, and the others still get it', () => {
  const requests = new FindRequests();
  const got: unknown[] = [];
  requests.ready('file:///p/a.md', {}, () => { throw new Error('disposed'); });
  requests.ready('file:///p/a.md', {}, () => Promise.reject(new Error('disposed')));
  requests.ready('file:///p/a.md', {}, (m) => got.push(m));
  assert.doesNotThrow(() => requests.request('file:///p/a.md', MESSAGE));
  assert.deepEqual(got, [MESSAGE]);
  requests.request('file:///p/b.md', MESSAGE);
  assert.doesNotThrow(() => requests.ready('file:///p/b.md', {}, () => { throw new Error('disposed'); }));
});

console.log('The editors');

const src = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the Markdown editor answers on document:ready and ready, by its own document’s key, and lets go on close', () => {
  const editor = src('ritemarkEditor.ts');
  const ready = editor.match(/findRequests\.ready\(commentTaskKey, webview, \(find\) => webview\.postMessage\(find\)\)/g) ?? [];
  assert.equal(ready.length, 2);
  assert.match(editor, /const commentTaskKey = document\.uri\.toString\(\);/);
  assert.match(editor, /findRequests\.gone\(commentTaskKey, webview\)/);
  // It posts the find bar's message as it came, and touches nothing else.
  assert.doesNotMatch(editor, /find:open/);
});

test('the PDF and Word previews answer once their viewer is listening (getOpenStatus), and let go on close', () => {
  for (const file of ['pdfEditorProvider.ts', 'officePreview/officePreviewProvider.ts']) {
    const provider = src(file);
    const status = provider.slice(provider.indexOf("case 'getOpenStatus':"));
    assert.match(status.slice(0, 600), /findRequests\.ready\(document\.uri\.toString\(\), webviewPanel,/, file);
    assert.match(provider, /findRequests\.gone\(document\.uri\.toString\(\), webviewPanel\)/, file);
  }
  assert.match(src('officePreview/officePreviewProvider.ts'), /viewType === 'ritemark\.docxViewer'/);
});

test('search asks after the open, by the opened URI', () => {
  const host = src('search/SearchHost.ts');
  const open = host.indexOf("executeCommand('vscode.open', uri");
  const ask = host.indexOf('findRequests.request(uri.toString(), find)');
  assert.ok(open > 0 && ask > open);
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
