/**
 * A card the board can't read can be tried again or removed (Sprint 145, #596; spec R2, S10–S16; experience 41).
 * Renders the rows to markup, as the board draws them and as the Tasks side bar does, and runs their buttons.
 *
 * Run: npx tsx webview/src/components/tasks/unreadableCards.test.ts
 */
import assert from 'node:assert/strict'
import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'

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
type Clickable = { label: string; disabled: boolean; onClick: (event: unknown) => unknown }
let clicks: Clickable[] = []
function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children)
  return ''
}
;(globalThis as unknown as { React: unknown }).React = {
  ...React,
  createElement: (type: Parameters<typeof React.createElement>[0], props: Record<string, unknown> | null, ...children: unknown[]) => {
    if (props && typeof props.onClick === 'function') {
      clicks.push({ label: String(props['aria-label'] ?? textOf(children)).trim(), disabled: Boolean(props.disabled), onClick: props.onClick as Clickable['onClick'] })
    }
    return (React.createElement as (...args: unknown[]) => unknown)(type, props, ...children)
  },
}
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { UnreadableCards } = await import('./UnreadableCards')
const { useBoardUi } = await import('./boardUi')
// zustand hands React its initial state as the server snapshot: each render copies the live state into it.
const syncStore = () => Object.assign(useBoardUi.getInitialState(), useBoardUi.getState())
const { unreadableFileWords } = await import('./taskCopy')

const CLOUD = 'Ritemark couldn’t open this file in time. If this folder syncs from the cloud, the file may still be downloading.'
const snapshot: BoardSnapshot = {
  folder: 'harbor',
  enabled: true,
  cards: [],
  archived: [],
  unreadable: [
    { fileName: 'book-the-venue.md', message: CLOUD, reason: 'read' },
    { fileName: 'catering.md', message: CLOUD, reason: 'read' },
    { fileName: 'speakers.md', message: CLOUD, reason: 'read' },
    { fileName: 'draft-module-7.md', message: 'The lines at the top of this file, where the board keeps the card’s title and column, have a mistake.', reason: 'format' },
    { fileName: 'from-the-future.md', message: 'A newer Ritemark made this card. Update Ritemark to see it.', reason: 'newer' },
  ],
  calls: [],
  attention: { count: 0, oldestSince: null, blocked: 0 },
  doing: { count: 0, limit: 3 },
  runtimes: [],
  defaultRuntime: 'claude-code',
}

function render(variant: 'board' | 'list', input: BoardSnapshot = snapshot) {
  syncStore()
  clicks = []
  const root = parse(renderToStaticMarkup(createElement(UnreadableCards, { snapshot: input, variant })))
  const rendered = clicks
  const rows = root.querySelectorAll('.group').map((row) => ({
    text: row.text,
    buttons: row.querySelectorAll('button').map((button) => button.text.trim()).filter(Boolean),
  }))
  return { root, rows, clicks: rendered }
}

for (const variant of ['board', 'list'] as const) {
  const { root, rows } = render(variant)
  // S10: the heading counts the files; each row says what happened once, in plain words.
  assert.match(root.text, /Couldn’t read· 5/, `${variant}: the heading and its count`)
  for (const row of rows.slice(0, 3)) {
    assert.equal(row.text.split('Couldn’t').length - 1 + row.text.split('couldn’t').length - 1, 1, `${variant}: “couldn’t” once per row`)
    assert.doesNotMatch(row.text, /ETIMEDOUT|EACCES|Error/, `${variant}: no error code`)
    assert.deepEqual(row.buttons, ['Try again', 'Remove'], `${variant}: a file that wouldn't open: Try again and Remove`)
  }
  // S15: a card with a mistake keeps Open to fix it, gets Remove, no Try again.
  assert.deepEqual(rows[3].buttons, ['Open to fix it', 'Remove'], `${variant}: a broken card`)
  // A newer card: nothing in it is wrong, so no Open to fix it.
  assert.deepEqual(rows[4].buttons, ['Remove'], `${variant}: a card from a newer Ritemark`)
}

// The board draws quiet cards with the dashed file mark; no amber warning.
const boardMarkup = renderToStaticMarkup(createElement(UnreadableCards, { snapshot, variant: 'board' }))
assert.doesNotMatch(boardMarkup, /tone-amber/, 'no amber')
assert.match(boardMarkup, /rounded-lg bg-surface/, 'each row a quiet card on the board')

// Try again reads the file again; Remove asks first (S13), it doesn't post anything yet.
{
  const { clicks: handlers } = render('board')
  posted.length = 0
  handlers.find((item) => item.label === 'Try again')!.onClick({})
  assert.deepEqual({ ...posted[0], requestId: undefined }, { type: 'board/retry-file', fileName: 'book-the-venue.md', requestId: undefined }, 'Try again asks the host to read it again')
  // S12: while it reads, that row's button says Trying… and both its buttons wait; the other rows don't.
  const trying = render('board').rows
  assert.deepEqual(trying[0].buttons, ['Trying…', 'Remove'])
  assert.ok(render('board').clicks.filter((item) => item.disabled).length === 2, 'Trying… and Remove wait')
  assert.deepEqual(trying[1].buttons, ['Try again', 'Remove'], 'the other rows are untouched')
  assert.equal(trying[0].text.includes(CLOUD), true, 'the sentence stays as it was')
  for (const listener of hostListeners) listener({ data: { type: 'board/result', requestId: posted[0].requestId, answer: { ok: true } } })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(render('board').rows[0].buttons, ['Try again', 'Remove'], 'the answer gives the buttons back')

  posted.length = 0
  render('board').clicks.filter((item) => item.label === 'Remove')[0].onClick({})
  assert.equal(posted.length, 0, 'Remove posts nothing before the question')
  assert.equal(useBoardUi.getState().confirmRemoveFile, 'book-the-venue.md', 'it opens the board’s question for that file')
  useBoardUi.getState().askRemoveFile(null)
}

// S13: the question's words name the file and the system trash.
assert.deepEqual(
  (({ question, questionBody, removeTip }) => ({ question, questionBody, removeTip }))(unreadableFileWords('book-the-venue.md', false)),
  {
    question: 'Remove book-the-venue.md?',
    questionBody: 'It goes to the Trash, and the board stops listing it. You can put it back from the Trash.',
    removeTip: 'Move book-the-venue.md to the Trash',
  },
)
assert.equal(unreadableFileWords('a.md', true).questionBody, 'It goes to the Recycle Bin, and the board stops listing it. You can put it back from the Recycle Bin.')

// S16: the trash refused: the row stays and says why, in place of its own sentence.
{
  const { removeFile } = await import('./boardUi')
  posted.length = 0
  const removing = removeFile('draft-module-7.md')
  assert.deepEqual(render('board').rows[3].buttons, ['Open to fix it', 'Remove'])
  assert.equal(render('board').clicks.filter((item) => item.disabled).length >= 2, true, 'its buttons wait while the trash works')
  for (const listener of hostListeners) {
    listener({ data: { type: 'board/result', requestId: posted[0].requestId, answer: { ok: false, code: 'write-failed', message: 'Ritemark couldn’t move it to the Trash, so it is still in the folder.' } } })
  }
  await removing
  const row = render('board').rows[3]
  assert.match(row.text, /Ritemark couldn’t move it to the Trash, so it is still in the folder\./)
  assert.doesNotMatch(row.text, /have a mistake/, 'said once: the refusal takes the sentence’s place')
  assert.deepEqual(row.buttons, ['Open to fix it', 'Remove'], 'Open to fix it stays beside Remove')
}

// A row from a build that sends no reason keeps today's behaviour: open it to fix it.
assert.deepEqual(render('list', { ...snapshot, unreadable: [{ fileName: 'old.md', message: 'Something.' }] }).rows[0].buttons, ['Open to fix it', 'Remove'])

console.log('tasks/unreadableCards: all assertions passed')
process.exit(0)
