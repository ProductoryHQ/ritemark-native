/**
 * Sprint 148, PR 2 (R5, R6, R8; the Experience lead's questions 1, 2, 4, 5, 6):
 * the results view rendered to markup. Groups and counts, 5 rows then Show all,
 * a kind whole, the states in the count line, nothing found, past the limits,
 * not available, each kind's row, the chosen row with Enter, the marks, and an
 * older answer never drawn over a newer one. Also the AI sheet's turn reveal.
 *
 * Run: npx tsx webview/src/components/search/search.test.ts
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'
import type { IndexStatus, SearchGroup, SearchKind, SearchOptions, SearchResult } from '../../../../src/search/protocol'
import type { ResultsMessage, SearchViewState } from './searchModel'

// SearchPanel.tsx imports './search.css', which Node cannot load: for this run only, a style sheet is an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)

const posted: unknown[] = []
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => posted.push(message), getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { SearchPanelView } = await import('./SearchPanel')
const model = await import('./searchModel')
const { takeTurnReveal, requestTurnReveal } = await import('../ai-sidebar/turnReveal')

let failures = 0
function test(name: string, run: () => void): void {
  try {
    run()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures++
    console.error(`  ✗ ${name}\n    ${(error as Error).stack ?? (error as Error).message}`)
  }
}

const NOW = new Date(2026, 10, 2, 12, 0).getTime()
const ALL: SearchOptions = { matchCase: false, wholeWords: false, kinds: ['document', 'chat', 'task'] }

function doc(n: number, extra: Partial<SearchResult> = {}): SearchResult {
  return {
    key: `document:/p/Brief ${n}.md`, kind: 'document', layer: 'words', name: `Brief ${n}`, where: n % 2 ? 'Meetings' : null,
    changedAt: null, path: `/p/${n % 2 ? 'Meetings/' : ''}Brief ${n}.md`, format: 'markdown',
    passage: { text: 'Do the managers want a short report after each module?', marks: [[29, 35]], at: { block: 2 } }, match: null, ...extra,
  }
}
const chat: SearchResult = {
  key: 'chat:c1', kind: 'chat', layer: 'words', name: 'Harbour fees', where: null, changedAt: new Date(2026, 9, 27, 9).toISOString(), colorSlot: 5,
  passage: { text: 'They are 120 euros a report.', marks: [[21, 27]], at: { eventId: 'r1', speaker: 'claude-code', turnId: 't1' } }, match: null,
}
const task: SearchResult = {
  key: 'task:k1', kind: 'task', layer: 'words', name: 'Send the report', where: 'Waiting for you', changedAt: null, passage: null, match: null,
}

function groupOf(kind: SearchKind, rows: SearchResult[], total = rows.length): SearchGroup {
  return { kind, total, results: rows }
}

function state(groups: SearchGroup[], extra: Partial<ResultsMessage> = {}, rest: Partial<SearchViewState> = {}): SearchViewState {
  return {
    setup: { projectName: 'Leadership programme', roots: ['/p'], options: ALL },
    status: { state: 'ready', documents: { done: 900, total: 900 }, limited: false, tooLarge: 0, failed: 0, chats: 1, tasks: 1 },
    options: ALL,
    answer: { type: 'search/results', queryId: 3, layer: 'words', tooShort: false, groups, reading: null, limited: false, tooLarge: 0, tookMs: 2, expanded: null, ...extra },
    ...rest,
  }
}

function render(s: SearchViewState, moreOpen = false) {
  return parse(renderToStaticMarkup(createElement(SearchPanelView, { state: s, now: NOW, initialMoreOpen: moreOpen, onOptions: () => undefined })))
}
const text = (node: { text: string } | null | undefined) => (node?.text ?? '').replace(/\s+/g, ' ').trim()

console.log('Search results view')

test('groups in order, each with its heading and count; 5 rows, then Show all (question 5)', () => {
  const docs = Array.from({ length: 5 }, (_, i) => doc(i))
  const page = render(state([groupOf('document', docs, 23), groupOf('chat', [chat]), groupOf('task', [task])]))
  assert.deepEqual(page.querySelectorAll('.rs-heading').map(text), ['Documents23', 'Chats1', 'Tasks1'])
  assert.equal(page.querySelectorAll('section')[0].querySelectorAll('.rs-row').length, 5)
  assert.equal(text(page.querySelector('.rs-show')), 'Show all 23 documents')
  assert.equal(text(page.querySelector('.rs-count-words')), '25 results with these words')
  assert.equal(text(page.querySelector('.rs-more')), 'More')
})

test('a kind opened whole ends with Show fewer; the only kind with results shows all, with no Show row', () => {
  const docs = Array.from({ length: 23 }, (_, i) => doc(i))
  const opened = render(state([groupOf('document', docs, 23), groupOf('chat', [chat])], { expanded: { kind: 'document', auto: false } }))
  assert.equal(opened.querySelectorAll('section')[0].querySelectorAll('.rs-row').length, 23)
  assert.equal(text(opened.querySelector('.rs-show')), 'Show fewer')
  const only = render(state([groupOf('document', docs, 23)], { expanded: { kind: 'document', auto: true } }))
  assert.equal(only.querySelectorAll('.rs-row').length, 23)
  assert.equal(only.querySelector('.rs-show'), null)
})

test('still reading: the count line says how far, in place (question 2)', () => {
  const reading: IndexStatus = { state: 'reading', documents: { done: 120, total: 900 }, limited: false, tooLarge: 0, failed: 0, chats: 0, tasks: 0 }
  const page = render(state([groupOf('document', [doc(1), doc(2), doc(3)])], { reading: { done: 100, total: 900 } }, { status: reading }))
  assert.equal(text(page.querySelector('.rs-count-words')), '3 results so far · 120 of 900 documents read', 'the status is fresher than the answer')
  assert.equal(page.querySelector('[aria-busy]'), null)
})

test('More: Match capital letters, Whole words only, and the kinds with their counts; no Replace (frame 5, decision 2)', () => {
  const page = render(state([groupOf('document', [doc(1), doc(2)]), groupOf('chat', [chat]), groupOf('task', [task])], {}, { options: { ...ALL, kinds: ['document'] } }), true)
  assert.equal(text(page.querySelector('.rs-more')), 'Less')
  assert.deepEqual(page.querySelectorAll('.rs-opt').map(text), ['Match capital letters', 'Whole words only', 'Documents2', 'Chats1', 'Tasks1'])
  assert.equal(page.querySelectorAll('input[type=checkbox]').filter((box) => box.hasAttribute('checked')).length, 1)
  assert.equal(text(page.querySelector('.rs-count-words')), '2 results in documents', 'one kind on')
  assert.ok(!page.text.includes('Replace'))
  assert.deepEqual(page.querySelectorAll('.rs-heading').map(text), ['Documents2'], 'kinds turned off are not drawn')
})

test('each kind\'s row: icon, name, the detail at the right, the words around the match (question 4)', () => {
  const page = render(state([groupOf('document', [doc(1)]), groupOf('chat', [chat]), groupOf('task', [task])]))
  const [d, c, t] = page.querySelectorAll('.rs-row')
  assert.equal(text(d.querySelector('.rs-name')), 'Brief 1')
  assert.equal(text(d.querySelector('.rs-detail')), 'Meetings')
  assert.equal(text(d.querySelector('mark')), 'report')
  assert.equal(text(c.querySelector('.rs-detail')), 'Tue', 'a chat\'s age')
  assert.equal(text(c.querySelector('.rs-snippet')), 'Claude: They are 120 euros a report.')
  assert.ok(c.querySelector('.rs-icon span')?.getAttribute('style')?.includes('--r-conversation-5'), 'the chat\'s own colour')
  assert.equal(text(t.querySelector('.rs-detail')), 'Waiting for you')
  assert.equal(t.querySelector('.rs-snippet'), null, 'a hit in the name alone shows no words')
  assert.equal(d.getAttribute('aria-label'), 'Document, Brief 1, Meetings, Do the managers want a short report after each module?')
})

test('the top row is chosen and shows Enter; no other row does (question 6)', () => {
  const page = render(state([groupOf('document', [doc(1), doc(2)]), groupOf('chat', [chat])]))
  const rows = page.querySelectorAll('.rs-row')
  assert.ok(rows[0].hasAttribute('data-chosen'))
  assert.equal(text(rows[0].querySelector('.rs-key')), 'Enter')
  assert.equal(rows.filter((row) => row.hasAttribute('data-chosen')).length, 1)
  assert.equal(page.querySelectorAll('.rs-key').length, 1)
})

test('a CSV row: its first cell in ink, then the matching cell with its column\'s name (question 4)', () => {
  const csv = doc(9, {
    name: 'Contacts', format: 'csv', columns: ['Company', 'Contact', 'Phone'],
    passage: { text: 'Harbour Logistics · Mari Tamm · +372 555 0101', marks: [[25, 29]], at: { row: 4 } },
  })
  const page = render(state([groupOf('document', [csv])]))
  assert.equal(text(page.querySelector('.rs-snippet')), 'Harbour Logistics · Contact: Mari Tamm')
  assert.equal(text(page.querySelector('.rs-snippet .rs-ink')), 'Harbour Logistics')
  assert.equal(text(page.querySelector('.rs-snippet mark')), 'Tamm')
  // The match in the first cell: the next filled cell follows it
  const first = model.csvSnippet({ ...csv, passage: { text: 'Harbour Logistics ·  · Mari Tamm', marks: [[0, 7]], at: { row: 2 } } })
  assert.equal(first?.column, 'Phone')
  assert.equal(first?.cell?.text, 'Mari Tamm')
  // The header row, or a row cut at its start, shows as it is
  assert.equal(model.csvSnippet({ ...csv, passage: { ...csv.passage!, at: { row: 0 } } }), null)
  assert.equal(model.csvSnippet({ ...csv, passage: { ...csv.passage!, text: '…istics · Mari Tamm' } }), null)
})

test('a title heading that only repeats the name shows no words under it', () => {
  const titled = doc(4, { name: 'Report template', passage: { text: 'Report template', marks: [[0, 6]], at: { block: 0 } } })
  const page = render(state([groupOf('document', [titled])]))
  assert.equal(page.querySelector('.rs-snippet'), null)
  assert.equal(page.querySelector('.rs-row')?.getAttribute('aria-label'), 'Document, Report template')
})

test('a file too big to read, found by its name, says so in place of its words (question 2)', () => {
  const big = doc(3, { passage: null, nameOnly: 'too-large', size: 82 * 1024 * 1024, format: 'pdf' })
  const page = render(state([groupOf('document', [big])]))
  assert.equal(text(page.querySelector('.rs-snippet')), 'Searched by its name only: too big to read inside (82 MB).')
})

test('past the documents limit: a muted line under the count (question 2)', () => {
  const over: IndexStatus = { state: 'ready', documents: { done: 21_641, total: 21_641 }, limited: true, tooLarge: 0, failed: 0, chats: 0, tasks: 0 }
  const page = render(state([groupOf('document', [doc(1)])], { limited: true }, { status: over }))
  assert.equal(text(page.querySelector('.rs-limited')), 'Leadership programme has more than 20,000 documents. The 20,000 newest are searched inside, the rest by their names.')
})

test('nothing found: the project\'s line and the word-start hint; still reading; an option that narrows; big files (question 1)', () => {
  const none = render(state([]))
  assert.deepEqual(none.querySelectorAll('.rs-nothing p').map(text), [
    'Nothing in Leadership programme has these words.',
    'Words are found from their start, so a shorter start finds more forms: “hinna” finds “hinnakiri” and “hinnapakkumine”.',
  ])
  assert.equal(none.querySelector('.rs-count'), null, 'no count line')
  const reading: IndexStatus = { state: 'reading', documents: { done: 120, total: 900 }, limited: false, tooLarge: 0, failed: 0, chats: 0, tasks: 0 }
  assert.deepEqual(render(state([], {}, { status: reading })).querySelectorAll('.rs-nothing p').map(text), ['Nothing yet. Still reading 120 of 900 documents.'])
  const whole = render(state([], {}, { options: { ...ALL, wholeWords: true } }))
  assert.equal(text(whole.querySelectorAll('.rs-nothing p')[1]), 'Whole words only is on.Turn off', 'the words, then the button beside them')
  assert.equal(text(whole.querySelector('.rs-turn-off')), 'Turn off')
  assert.equal(whole.querySelectorAll('.rs-nothing p').length, 2, 'the narrowing line replaces the hint')
  assert.equal(model.narrowingOf({ ...ALL, kinds: ['document'] })?.words, 'Chats and Tasks are off.')
  assert.equal(model.narrowingOf({ ...ALL, kinds: ['document'] })?.button, 'Turn on')
  assert.equal(model.narrowingOf({ matchCase: true, wholeWords: true, kinds: ['document', 'chat'] })?.words, 'Match capital letters and Whole words only are on, and Tasks are off.')
  const big: IndexStatus = { state: 'ready', documents: { done: 9, total: 9 }, limited: false, tooLarge: 2, failed: 0, chats: 0, tasks: 0 }
  assert.equal(text(render(state([], {}, { status: big })).querySelectorAll('.rs-nothing p')[2]), '2 files too big to read were searched by their names only.')
  // A kind with results turned off counts as nothing found
  assert.equal(text(render(state([groupOf('chat', [chat])], {}, { options: { ...ALL, kinds: ['document'] } })).querySelector('.rs-nothing-first')), 'Nothing in Leadership programme has these words.')
})

test('fewer than two characters: nothing shows, and no line says nothing was found (R5)', () => {
  const page = render(state([], { tooShort: true }))
  assert.equal(text(page.querySelector('main')), '')
})

test('not available: one line, and where VS Code\'s search still is (R4)', () => {
  const down: IndexStatus = { state: 'unavailable', documents: { done: 0, total: 0 }, limited: false, tooLarge: 0, failed: 0, chats: 0, tasks: 0 }
  const page = render(state([groupOf('document', [doc(1)])], {}, { status: down }))
  assert.deepEqual(page.querySelectorAll('.rs-nothing p').map(text), ['Search isn’t available in this project.', 'VS Code’s search is still in More.'])
})

test('words a person can\'t mistake for markup are drawn as text', () => {
  const sneaky = doc(5, { name: '<img src=x onerror=alert(1)>', passage: { text: '<b>report</b>', marks: [[3, 9]], at: {} } })
  const html = renderToStaticMarkup(createElement(SearchPanelView, { state: state([groupOf('document', [sneaky])]), now: NOW, onOptions: () => undefined }))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;b&gt;<mark>report</mark>&lt;/b&gt;'))
})

test('an older query\'s answer is never drawn over a newer one (R5, R10)', () => {
  const newer = state([groupOf('document', [doc(1)])], { queryId: 9 })
  const older: ResultsMessage = { ...newer.answer!, queryId: 4, groups: [] }
  assert.equal(model.reduceSearchView(newer, older), newer)
  const newest: ResultsMessage = { ...newer.answer!, queryId: 10 }
  assert.equal(model.reduceSearchView(newer, newest).answer?.queryId, 10)
})

test('ages: Today, a weekday within a week, then the date', () => {
  assert.equal(model.ageWords(new Date(2026, 10, 2, 8).toISOString(), NOW), 'Today')
  assert.equal(model.ageWords(new Date(2026, 9, 27).toISOString(), NOW), 'Tue')
  assert.equal(model.ageWords(new Date(2026, 9, 3).toISOString(), NOW), '3 Oct')
  assert.equal(model.ageWords(new Date(2025, 9, 3).toISOString(), NOW), '3 Oct 2025')
  assert.equal(model.ageWords(null, NOW), null)
})

test('a row\'s tooltip says what a click opens', () => {
  assert.equal(model.rowTip(doc(1), ['/p']), 'Open Meetings/Brief 1.md')
  assert.equal(model.rowTip(chat, ['/p']), 'Open this chat at this message')
  assert.equal(model.rowTip(task, ['/p']), 'Open this task')
  assert.equal(model.relativePlace('C:\\Work\\Harbour\\Notes\\a.md', ['C:\\Work\\Harbour']), 'Notes/a.md')
})

test('the AI sheet shows a chat\'s turn once, only in that chat, and a later select replaces it (A5)', () => {
  requestTurnReveal('c1', 't2')
  assert.equal(takeTurnReveal('c2', ['t2']), null, 'another chat')
  assert.equal(takeTurnReveal('c1', ['t1']), null, 'not drawn yet')
  assert.equal(takeTurnReveal('c1', ['t1', 't2']), 't2')
  assert.equal(takeTurnReveal('c1', ['t1', 't2']), null, 'once')
  requestTurnReveal('c1', 't2')
  requestTurnReveal('c1', null)
  assert.equal(takeTurnReveal('c1', ['t2']), null, 'a select without a turn clears it')
})

if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nAll passed')
