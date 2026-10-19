/**
 * Clicks that reach their control (Sprint 130). A card tile and a side-bar row
 * open the card with an invisible full-size button; the text drawn over it is
 * `pointer-events-none` so a click on it falls through to that button. Any
 * control inside such a layer must turn pointer events back on, or a click on
 * it opens the card instead (the board's tick circle did, found on Windows).
 *
 * Renders the board, Your calls, Ideas and the Tasks side bar's list to
 * markup and checks every button, link and field: the nearest
 * `pointer-events-*` class on it or an ancestor must not be
 * `pointer-events-none`.
 *
 * The side bar's waiting rows keep the answers the old Your calls rows had
 * (Sprint 134, R17): one row of each kind is rendered, and each answer's click
 * handler is run to check the message it posts to the host.
 *
 * Run: npx tsx webview/src/components/tasks/boardClicks.test.ts
 */
import assert from 'node:assert/strict'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'

// The host's side: what the webview posts, and the window it listens on for answers.
const posted: Array<Record<string, unknown>> = []
const hostListeners: Array<(event: { data: unknown }) => void> = []
Object.assign(globalThis, {
  window: {
    innerWidth: 1024,
    addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
      if (type === 'message') hostListeners.push(listener)
    },
    removeEventListener: () => {},
    focus: () => {},
  },
  acquireVsCodeApi: () => ({ postMessage: (message: Record<string, unknown>) => posted.push(message), getState: () => undefined, setState: () => {} }),
})

const React = await import('react')
// JSX here compiles to `React.createElement`; while `clicks` is set, it keeps
// every element's click handler with the words on it, so a test can click it.
type Clickable = { label: string; disabled: boolean; onClick: (event: unknown) => unknown }
let clicks: Clickable[] | null = null
function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children)
  return ''
}
const recordingReact = {
  ...React,
  createElement: (type: Parameters<typeof React.createElement>[0], props: Record<string, unknown> | null, ...children: unknown[]) => {
    if (clicks && props && typeof props.onClick === 'function') {
      clicks.push({ label: String(props['aria-label'] ?? textOf(children)).trim(), disabled: Boolean(props.disabled), onClick: props.onClick as Clickable['onClick'] })
    }
    return (React.createElement as (...args: unknown[]) => unknown)(type, props, ...children)
  },
}
;(globalThis as unknown as { React: unknown }).React = recordingReact
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { BoardColumns } = await import('./BoardColumns')
const { CallsView } = await import('./CallsView')
const { IdeasView } = await import('./IdeasView')
const { TasksList } = await import('./TasksList')
const { useBoardUi } = await import('./boardUi')

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
    { id: 'codex', label: 'ChatGPT', usable: true, state: 'ready', message: null, recovery: 'none' },
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
  ['Tasks side bar', createElement(TasksList, { snapshot })],
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

// ── The Tasks side bar: a waiting row of each kind keeps its answers (R17) ──
type Expect = { message: Record<string, unknown> } | { note: 'answer' | 'changes' }
const waitingRows: Array<{ kind: string; card: BoardCardView; answers: Record<string, Expect> }> = [
  {
    kind: 'decision',
    card: card('waitD1', {
      stage: 'doing',
      move: 'you',
      call: 'decision',
      ask: { by: 'claude', at: ago(20), question: 'Which audience?', options: ['Trainers', 'Consultants'] },
    }),
    answers: {
      Trainers: { message: { type: 'board/answer', cardId: 'waitD1', optionIndex: 0 } },
      Consultants: { message: { type: 'board/answer', cardId: 'waitD1', optionIndex: 1 } },
      'Something else…': { note: 'answer' },
    },
  },
  {
    kind: 'review',
    card: card('waitR1', {
      stage: 'doing',
      move: 'you',
      call: 'review',
      result: { by: 'claude', at: ago(30), seconds: 42, summary: 'Wrote it.', files: ['docs/plan.md'], check: [] },
      handoff: { state: 'completed', runtimeId: 'claude-code', since: ago(30), canOpen: true },
    }),
    answers: {
      'Mark done': { message: { type: 'board/mark-done', cardId: 'waitR1' } },
      'Ask for changes…': { note: 'changes' },
    },
  },
  {
    kind: 'failed',
    card: card('waitF1', {
      move: 'you',
      call: 'failed',
      handoff: { state: 'failed', runtimeId: 'claude-code', since: ago(15), canOpen: true, failure: 'the network dropped' },
    }),
    answers: {
      'Retry with Claude': { message: { type: 'board/retry', cardId: 'waitF1', runtimeId: 'claude-code' } },
      'Open conversation': { message: { type: 'board/open-conversation', cardId: 'waitF1' } },
    },
  },
  {
    kind: 'needs-you',
    card: card('waitN1', {
      stage: 'doing',
      move: 'you',
      call: 'needs-you',
      locked: true,
      handoff: { state: 'needs-user', needs: 'approval', runtimeId: 'claude-code', since: ago(5), canOpen: true },
    }),
    answers: {
      'Open conversation': { message: { type: 'board/open-conversation', cardId: 'waitN1' } },
    },
  },
]

for (const { kind, card: waiting, answers } of waitingRows) {
  const one: BoardSnapshot = {
    ...snapshot,
    cards: [waiting],
    calls: [{ cardId: waiting.id, kind: waiting.call!, since: ago(5) }],
    attention: { count: 1, oldestSince: ago(5), blocked: kind === 'needs-you' ? 1 : 0 },
  }
  clicks = []
  const markup = renderToStaticMarkup(createElement(TasksList, { snapshot: one }))
  const rendered = clicks
  clicks = null
  const root = parse(markup)
  assert.ok(root.querySelector('[data-waiting]'), `${kind}: the row is marked as waiting`)
  assert.deepEqual(deadControls(markup), [], `${kind}: every control on the waiting row takes clicks`)
  for (const [label, expect] of Object.entries(answers)) {
    const button = root.querySelectorAll('button').find((control) => control.text.trim() === label)
    assert.ok(button, `${kind}: the row has ${label}`)
    assert.equal(pointerEvents(button!), 'auto', `${kind}: ${label} takes clicks`)
    const handler = rendered.find((item) => item.label === label)
    assert.ok(handler && !handler.disabled, `${kind}: ${label} can be clicked`)
    posted.length = 0
    useBoardUi.setState({ note: null })
    handler!.onClick({ detail: 1, preventDefault: () => {}, stopPropagation: () => {} })
    if ('message' in expect) {
      assert.equal(posted.length, 1, `${kind}: ${label} posts one message`)
      const { requestId, ...message } = posted[0]
      assert.equal(typeof requestId, 'string', `${kind}: ${label} waits for the host's answer`)
      assert.deepEqual(message, expect.message, `${kind}: ${label} posts its message`)
      // The host answers, so nothing is left waiting.
      for (const listener of hostListeners) listener({ data: { type: 'board/result', requestId, answer: { ok: true } } })
    } else {
      assert.equal(posted.length, 0, `${kind}: ${label} opens the reply box first`)
      assert.deepEqual(useBoardUi.getState().note, { cardId: waiting.id, where: 'side', kind: expect.note }, `${kind}: ${label} opens its reply box`)
    }
  }
}
useBoardUi.setState({ note: null })

console.log('tasks/boardClicks: all assertions passed')
