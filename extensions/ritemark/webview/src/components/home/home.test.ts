/**
 * Sprint 134 (R4, R7, R13, E3; S13, S16, S22–S24, S38, S39): Home's states and
 * the projects list, rendered to markup. Full, empty, a project whose folder
 * is not found, and no board; names that are markup drawn as text; and the
 * list's search.
 *
 * Run: npx tsx webview/src/components/home/home.test.ts
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'
import type { HomeState, ProjectRow, ProjectsState } from '../../../../src/projects/protocol'

// HomePage.tsx and ProjectsList.tsx import './home.css', which Node cannot load:
// for this run only, a style sheet loads as an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)

// The host's bridge: Home posts through acquireVsCodeApi.
const posted: unknown[] = []
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => posted.push(message), getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { HomeView } = await import('./HomePage')
const { ProjectsListView, filterProjects } = await import('./ProjectsList')
const { quoteWords, QUOTE_LIMIT } = await import('./homeWords')

const now = new Date(2026, 9, 19, 12, 0).getTime()
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

function home(overrides: Partial<HomeState> = {}): HomeState {
  return {
    platform: 'darwin',
    project: { name: 'Leadership programme', mark: 'LP', place: '~/Documents/Leadership programme', line: 'Six weeks for new team leads', coverUrl: null },
    waiting: {
      count: 2,
      items: [
        { id: 'card:aaaaa1', source: 'card', kind: 'needs-you', title: 'Draft the agenda', detail: null, ai: null, since: ago(40), colorSlot: null },
        { id: 'chat:c-1', source: 'chat', kind: 'approval', title: 'Budget check', detail: null, ai: 'ChatGPT', since: ago(5), colorSlot: null },
      ],
    },
    others: [{ name: 'Sales proposal Q4', count: 2 }],
    recent: [
      { id: 'file:0', name: 'About this project', extension: '', folder: null, kind: 'markdown', about: true, changedAt: ago(30) },
      { id: 'file:1', name: 'Session notes', extension: '.md', folder: 'Modules/Week 1', kind: 'markdown', about: false, changedAt: ago(24 * 60) },
    ],
    empty: false,
    boardEnabled: true,
    whatMoved: false,
    switchedFrom: null,
    missing: null,
    notice: null,
    ...overrides,
  }
}

const render = (state: HomeState) => renderToStaticMarkup(createElement(HomeView, { state, coverDefault: 'cover.webp', now }))
const words = (node: { text: string }) => node.text.replace(/\s+/g, ' ').trim()

/** What a person reads on Home, section by section. */
function outline(markup: string) {
  const root = parse(markup)
  return {
    headings: root.querySelectorAll('h1, h2, h3').map(words),
    sections: root.querySelectorAll('section').map((section) => section.getAttribute('aria-label')),
    badge: root.querySelector('.rh-badge')?.text ?? null,
    waiting: root.querySelectorAll('.rh-row').map((row) => row.childNodes.map(words).filter(Boolean)),
    notes: root.querySelectorAll('.rh-sub').map(words),
    tiles: root.querySelectorAll('.rh-tile').map(words),
    files: root.querySelectorAll('.rh-file').map((row) => row.childNodes.map(words).filter(Boolean)),
  }
}

// ── Full (S13) ──

const full = outline(render(home()))
assert.deepEqual(full, {
  headings: ['Leadership programme', 'Waiting for you2', 'Start something in Leadership programme', 'Last changed in Leadership programme'],
  sections: ['Waiting for you', 'Start something in Leadership programme', 'Last changed in Leadership programme'],
  badge: '2',
  waiting: [
    ['Draft the agenda', 'Waits for you', '40 minutes ago'],
    ['ChatGPT waits for your OK in Budget check', '5 minutes ago'],
  ],
  notes: ['In your other projects: 2 in Sales proposal Q4. They are counted on the left.'],
  tiles: ['TextA new document', 'TableCSV data', 'Web pageOpen a site'],
  files: [['About this project', 'today'], ['Session notes.md', 'in Modules/Week 1', 'yesterday']],
})
const fullMarkup = render(home())
assert.match(fullMarkup, /url\(&quot;cover\.webp&quot;\)/, 'Ritemark’s cover when the project has none')
assert.match(fullMarkup, />Six weeks for new team leads</, 'the line')
assert.match(fullMarkup, />~\/Documents\/Leadership programme</, 'the folder line')
assert.ok(!/Codex/.test(fullMarkup), 'ChatGPT, never Codex')
assert.deepEqual(posted, [], 'drawing Home sends nothing')

// ── Empty (R4, S39): the starts and a drop target, no Last changed ──

const empty = outline(render(home({ empty: true, recent: [], waiting: { count: 0, items: [] }, others: [{ name: 'Sales proposal Q4', count: 2 }, { name: 'Board report 2026', count: 1 }] })))
assert.deepEqual(empty.sections, ['Waiting for you', 'Start something in Leadership programme', 'Bring work in'])
assert.deepEqual(empty.headings.slice(1), ['Waiting for you', 'Start something in Leadership programme', 'Or bring work in'], 'no badge with nothing here')
// R4: an empty project says so, above what waits elsewhere.
assert.deepEqual(empty.notes, ['Leadership programme is empty for now. The AI works only inside this folder.', 'Three things, in your other projects. They are counted on the left.'])
assert.deepEqual(empty.tiles, ['TextA new document', 'TableCSV data', 'Web pageOpen a site'])
assert.deepEqual(empty.files, [])
assert.match(render(home({ empty: true, recent: [] })), /Drop files here[\s\S]*the originals stay where they are\.[\s\S]*Choose files…/)
// Not yet looked at (recent: null) and a project with files but none Ritemark opens: no Last changed, no drop target.
assert.deepEqual(outline(render(home({ recent: null }))).sections.slice(2), [])
assert.deepEqual(outline(render(home({ recent: [] }))).sections.slice(2), [])

// ── Not found (R13, S38): the head, muted, and one box ──

const missing = home({ missing: { id: 'project:moved1', name: 'Moved', mark: 'MO', place: '~/Documents/Moved', here: false } })
const missingMarkup = render(missing)
// S43: what Find it… said shows in the box itself.
assert.match(render(home({ notice: 'That folder is already Board report 2026, another project in the list. The list is as it was.', missing: { id: 'project:moved1', name: 'Moved', mark: 'MO', place: '~/Documents/Moved', here: false } })),
  /class="rh-missing-notice" role="status">.*That folder is already Board report 2026/)
// S53: this window's own folder gone: no way back to a Home of its own, and Remove says it closes the folder.
const hereMissing = render(home({ missing: { id: 'here:abc', name: 'Moved', mark: 'MO', place: '~/Documents/Moved', here: true } }))
assert.doesNotMatch(hereMissing, /Back to /)
assert.match(hereMissing, /closes it in this window/)
assert.deepEqual(outline(missingMarkup), {
  headings: ['Moved', 'This project’s folder is not where it was'],
  sections: ['This project\'s folder is not where it was'],
  badge: null,
  waiting: [],
  notes: [],
  tiles: [],
  files: [],
})
const box = parse(missingMarkup).querySelector('.rh-missing')!
assert.equal(words(box.querySelector('.rh-path')!), '~/Documents/Moved')
assert.deepEqual(box.querySelectorAll('button').map(words), ['Find it…', 'Remove from the list'])
assert.match(words(box), /You stay in Leadership programme meanwhile\.$/)
assert.ok(!missingMarkup.includes('rh-cover'), 'no cover, no Change image')

// ── No board (R13, S22): chats still count; no card is listed ──

const chatOnly = home({
  boardEnabled: false,
  waiting: { count: 1, items: [{ id: 'chat:c-2', source: 'chat', kind: 'question', title: 'Venue ideas', detail: null, ai: 'Claude', since: ago(90), colorSlot: null }] },
  others: null,
})
assert.deepEqual(outline(render(chatOnly)).waiting, [['Claude asks you something in Venue ideas', '2 hours ago']])
assert.equal(outline(render(chatOnly)).badge, '1')
assert.doesNotMatch(render(chatOnly), /Waits for you|Your decision|Ready to review|Didn’t finish/)
// No board file and nothing in chats: no count; a count that can't be read is not a zero.
const nothing = outline(render(home({ boardEnabled: false, waiting: { count: 0, items: [] }, others: [] })))
assert.equal(nothing.badge, null)
assert.deepEqual(nothing.notes, ['Nothing waits for you.'])
assert.deepEqual(outline(render(home({ waiting: { count: null, items: [] }, others: null }))).notes, ['Ritemark can’t tell what waits right now.'])
assert.equal(outline(render(home({ waiting: { count: 120, items: [] }, others: [] }))).badge, '99+')

// ── Names that are markup, drawn as text (R4, S16) ──

const evil = '<script>alert("x")</script> & \'quoted\''
const evilState = home({
  project: { name: `<img src=x onerror=alert(1)> ${evil}`, mark: '<b>', place: `~/Documents/${evil}`, line: `Line ${evil}`, coverUrl: 'https://file+.vscode-resource/x");background:url("evil' },
  waiting: {
    count: 2,
    items: [
      { id: 'card:aaaaa1', source: 'card', kind: 'decision', title: '<b>Bold</b>', detail: null, ai: null, since: ago(1), colorSlot: null },
      { id: 'chat:c-1', source: 'chat', kind: 'question', title: evil, detail: `Is ${evil} right?`, ai: 'OpenCode', since: ago(1), colorSlot: null },
    ],
  },
  others: [{ name: evil, count: 1 }],
  recent: [{ id: 'file:0', name: evil, extension: '.md"><script>', folder: `<i>${evil}</i>`, kind: 'markdown', about: false, changedAt: ago(1) }],
  notice: `Ritemark couldn’t copy ${evil} into this project.`,
  switchedFrom: { name: evil },
})
const projectsWithMarkup: ProjectsState = {
  platform: 'darwin',
  projects: [{ id: 'project:evil01', name: evil, mark: '<b>', count: 1, open: false, missing: true, place: `~/${evil}` }],
}
for (const [label, markup] of [
  ['Home', render(evilState)],
  ['Home, not found', render(home({ project: evilState.project, missing: { id: 'project:evil01', name: evil, mark: '<b>', place: `~/${evil}`, here: false } }))],
  ['the projects list', renderToStaticMarkup(createElement(ProjectsListView, { state: projectsWithMarkup }))],
] as const) {
  assert.doesNotMatch(markup, /<script|<img|<b>&lt;|<b>Bold|<i[ >]/, `${label}: no name becomes a tag`)
  assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#x27;quoted&#x27;/, `${label}: the name, escaped`)
}
const evilMarkup = render(evilState)
assert.match(evilMarkup, /&lt;b&gt;Bold&lt;\/b&gt;/, 'a card title as text')
assert.match(evilMarkup, /OpenCode asks: Is &lt;script&gt;/, 'a question’s detail as text')
assert.match(evilMarkup, /\.md&quot;&gt;&lt;script&gt;/, 'a file’s extension as text')
assert.match(evilMarkup, /url\(&quot;https:\/\/file\+\.vscode-resource\/x%22\);background:url\(%22evil&quot;\)/, 'a cover address stays inside its url("…")')

// ── The projects list (R7, R13, S23, S38) ──

const rows: ProjectRow[] = [
  { id: 'project:lead01', name: 'Leadership programme', mark: 'LP', count: 0, open: true, missing: false, place: '~/Documents/Leadership programme' },
  { id: 'project:sale01', name: 'Sales proposal Q4', mark: 'SP', count: 2, open: false, missing: false, place: '~/Documents/Sales proposal Q4' },
  { id: 'project:resr01', name: 'Research: hybrid work', mark: 'RH', count: 120, open: false, missing: false, place: '~/Documents/Research' },
  { id: 'project:boar01', name: 'Board report 2026', mark: 'BR', count: null, open: false, missing: false, place: '~/Documents/Board report 2026' },
  { id: 'project:move01', name: 'Moved', mark: 'MO', count: 3, open: false, missing: true, place: '~/Documents/Moved' },
]
const list = parse(renderToStaticMarkup(createElement(ProjectsListView, { state: { platform: 'darwin', projects: rows } })))
assert.deepEqual(list.querySelectorAll('.rp-row[aria-label]').map((row) => [row.getAttribute('aria-label'), row.getAttribute('aria-current') ?? null, row.childNodes.map(words).filter(Boolean)]), [
  ['Leadership programme, open', 'true', ['LP', 'Leadership programme']],
  ['Sales proposal Q4, 2 wait', null, ['SP', 'Sales proposal Q4', '2']],
  ['Research: hybrid work, 120 wait', null, ['RH', 'Research: hybrid work', '99+']],
  ['Board report 2026', null, ['BR', 'Board report 2026']],
  ['Moved, not found. It was at ~/Documents/Moved', null, ['MO', 'Moved', 'Not found']],
], 'the open one current; muted counts; unknown shows none; Not found keeps its place and drops its count')
assert.equal(list.querySelector('.rp-row.missing')?.getAttribute('aria-label'), 'Moved, not found. It was at ~/Documents/Moved')
assert.equal(list.querySelector('input[type=search]')?.getAttribute('placeholder'), 'Search all projects')
assert.match(words(list.querySelector('.rp-add')!), /^Add a project…$/)

// ── Searching (S24): by name, every word, any case ──

const names = (query: string) => filterProjects(rows, query).map((row) => row.name)
assert.deepEqual(names('sal'), ['Sales proposal Q4'])
assert.deepEqual(names('SAL'), ['Sales proposal Q4'])
assert.deepEqual(names('q4 sales'), ['Sales proposal Q4'], 'every word, in any order')
assert.deepEqual(names('pro'), ['Leadership programme', 'Sales proposal Q4'], 'inside a word too, in the list’s order')
assert.deepEqual(names('WORK research:'), ['Research: hybrid work'])
assert.deepEqual(names('documents'), [], 'by name only, not by place')
assert.deepEqual(names('zzz'), [])
assert.deepEqual(names('  '), rows.map((row) => row.name), 'a cleared field shows all')
assert.notEqual(filterProjects(rows, ''), rows, 'a copy, never the list itself')

// An unread reply (the Experience lead, 19 October): one sentence, the chat's own coloured bubble as its icon.
const replied = render(home({ waiting: { count: 1, items: [{ id: 'chat:c-9', source: 'chat', kind: 'reply', title: 'Plan Module 5', detail: null, ai: 'Claude', since: ago(3), colorSlot: 4 }] }, others: [] }))
assert.match(replied, /class="rh-ic rh-ic-bubble"><span class="inline-flex shrink-0 [^"]*" style="color:[^"]+">/)
assert.match(replied, />Claude replied in Plan Module 5</)

// A chat titled by its first message is quoted, "to" not "in", the quote cut inside its marks (the Experience lead, 19 October)
const quoted = render(home({ waiting: { count: 1, items: [{ id: 'chat:c-10', source: 'chat', kind: 'reply', title: 'In one sentence, what is a module plan?', detail: null, ai: 'Claude', since: ago(2), colorSlot: 1, quoted: true }] }, others: [] }))
assert.match(quoted, /<span class="rh-text rh-quoted"><span class="rh-lead">Claude replied to “<\/span><span class="rh-quote">In one sentence, what is a module plan\?<\/span><span class="rh-lead">”<\/span><\/span>/)
assert.doesNotMatch(quoted, /replied in/)
// A long first message is cut at a word, the ellipsis inside the marks; a short one is whole
assert.equal(quoteWords('Read the three briefs in Research and tell me which parts of the module plan we should rewrite'), 'Read the three briefs in Research and tell me which…')
assert.equal(quoteWords('In one sentence, what is a module plan?'), 'In one sentence, what is a module plan?')
assert.equal(quoteWords('Plan the kickoff, the venue, the agenda, the invitations, the budget and more'), 'Plan the kickoff, the venue, the agenda, the…')
assert.ok(quoteWords('x'.repeat(200)).length <= QUOTE_LIMIT)
// The same rule for a question without its words: the quote, cut inside its marks
const asked = render(home({ waiting: { count: 1, items: [{ id: 'chat:c-11', source: 'chat', kind: 'question', title: 'Can you draft the venue email?', detail: null, ai: 'ChatGPT', since: ago(2), colorSlot: null, quoted: true }] }, others: [] }))
assert.match(asked, /ChatGPT asks you something in “<\/span><span class="rh-quote">Can you draft the venue email\?<\/span>/)

assert.deepEqual(posted, [], 'drawing sends nothing to the host')
console.log('home: all assertions passed')
