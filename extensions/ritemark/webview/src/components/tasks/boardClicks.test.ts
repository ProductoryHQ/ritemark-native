/**
 * Clicks that reach their control (Sprint 130). A card tile and a side-bar row
 * open the card with an invisible full-size button; the text drawn over it is
 * `pointer-events-none` so a click on it falls through to that button. Any
 * control inside such a layer must turn pointer events back on, or a click on
 * it opens the card instead (the board's tick circle did, found on Windows).
 *
 * Renders the board, Your calls and Ideas to markup and checks every button,
 * link and field: the nearest `pointer-events-*` class on it or an ancestor
 * must not be `pointer-events-none`.
 */
import assert from 'node:assert/strict'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { BoardColumns } = await import('./BoardColumns')
const { CallsView } = await import('./CallsView')
const { IdeasView } = await import('./IdeasView')

const now = Date.now()
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

function card(id: string, overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id,
    title: `Card ${id}`,
    doneWhen: null,
    stage: 'todo',
    rank: id,
    description: '- [ ] one\n- [x] two\n',
    files: [{ path: 'docs/plan.md', exists: true }],
    created: ago(600),
    updated: ago(600),
    result: null,
    ask: null,
    review: null,
    reviewing: null,
    reviewFailure: null,
    dropped: false,
    archived: null,
    history: [],
    copiedFrom: null,
    handoff: null,
    move: null,
    call: null,
    nextUp: false,
    locked: false,
    checkboxes: { done: 1, total: 2 },
    ...overrides,
  }
}

const cards: BoardCardView[] = [
  card('todo01', { nextUp: true }),
  card('todo02'),
  card('idea01', { stage: 'idea' }),
  card('idea02', {
    stage: 'idea',
    review: { by: 'claude', at: ago(5), verdict: 'ready', why: 'Worth it.', size: 'small', title: 'Do it', description: 'First step.' },
  }),
  card('doing1', {
    stage: 'doing',
    move: 'you',
    call: 'review',
    result: { by: 'claude', at: ago(30), seconds: 42, summary: 'Wrote it.', files: ['docs/plan.md'], check: ['Is the intro right?'] },
    handoff: { state: 'completed', runtimeId: 'claude-code', since: ago(30), canOpen: true },
  }),
  card('doing2', {
    stage: 'doing',
    move: 'you',
    call: 'decision',
    ask: { by: 'claude', at: ago(20), question: 'Which audience?', options: ['Trainers', 'Consultants'] },
  }),
  card('doing3', {
    stage: 'doing',
    move: 'agent',
    locked: true,
    handoff: { state: 'running', runtimeId: 'claude-code', since: ago(2), canOpen: true },
  }),
  card('done01', { stage: 'done', history: [{ at: ago(60), by: 'you', what: 'Marked done' }] }),
]

const snapshot: BoardSnapshot = {
  folder: 'harbor',
  enabled: true,
  cards,
  archived: [],
  unreadable: [],
  calls: [
    { cardId: 'doing2', kind: 'decision', since: ago(20) },
    { cardId: 'doing1', kind: 'review', since: ago(30) },
  ],
  attention: { count: 2, oldestSince: ago(30), blocked: 0 },
  doing: { count: 3, limit: 3 },
  runtimes: [
    { id: 'claude-code', label: 'Claude', usable: true, state: 'ready', message: null, recovery: 'none' },
    { id: 'codex', label: 'Codex', usable: true, state: 'ready', message: null, recovery: 'none' },
    { id: 'opencode', label: 'OpenCode', usable: false, state: 'needs-auth', message: 'Add a key in Settings.', recovery: 'configure' },
  ],
  defaultRuntime: 'claude-code',
}

type Node = ReturnType<typeof parse>

/** The nearest `pointer-events-none` / `pointer-events-auto` on the element or above it. */
function pointerEvents(node: Node): 'none' | 'auto' | null {
  for (let current: Node | null = node; current; current = current.parentNode as Node | null) {
    const classes = (current.getAttribute?.('class') ?? '').split(/\s+/)
    if (classes.includes('pointer-events-auto')) return 'auto'
    if (classes.includes('pointer-events-none')) return 'none'
  }
  return null
}

function deadControls(markup: string): string[] {
  const root = parse(markup)
  return root
    .querySelectorAll('button, a, input, textarea, [role="button"]')
    .filter((control) => pointerEvents(control) === 'none')
    .map((control) => control.getAttribute('aria-label') || control.text.trim() || control.tagName)
}

const surfaces: Array<[string, React.ReactElement]> = [
  ['board', createElement(BoardColumns, { snapshot })],
  ['Your calls', createElement(CallsView, { snapshot })],
  ['Ideas', createElement(IdeasView, { snapshot })],
]

for (const [name, element] of surfaces) {
  const markup = renderToStaticMarkup(element)
  const controls = parse(markup).querySelectorAll('button')
  assert.ok(controls.length > 0, `${name} renders controls`)
  assert.deepEqual(deadControls(markup), [], `${name}: every control is clickable, none falls through to the card underneath`)
}

// The board's To do tiles do carry their tick circle, the control that was dead.
const board = parse(renderToStaticMarkup(createElement(BoardColumns, { snapshot })))
const tick = board.querySelector('[aria-label="Mark Card todo02 done"]')
assert.ok(tick, 'a To do tile has its tick circle')
assert.equal(pointerEvents(tick!), 'auto', 'the tick circle takes clicks')

console.log('tasks/boardClicks: all assertions passed')
