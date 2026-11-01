/**
 * A dropped card moves at once (Sprint 145, #597; spec R3, S19–S25). The surface that moves a card draws the move
 * before the host answers, keeps it through a snapshot built before the write, and lets it go when the host
 * refuses (the card goes back, with the host's notice) or when a snapshot shows the card where it was put.
 *
 * Run: npx tsx webview/src/components/tasks/boardMoves.test.ts
 */
import assert from 'node:assert/strict'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'

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
const { renderToStaticMarkup } = await import('react-dom/server')
const client = await import('./boardClient')
const { placeCard, confirmsMove, applyPendingMoves, useBoardSnapshot, savingStage, startBoard, SAVING_SIGN_AFTER_MS, CONFIRM_WAIT_MS } = client
const { moveCard, markCardDone, useBoardUi } = await import('./boardUi')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const NOW = '2026-11-01T10:00:00.000Z'

function card(id: string, stage: BoardCardView['stage'], overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id,
    title: `Card ${id}`,
    doneWhen: null,
    stage,
    rank: id,
    description: '',
    files: [],
    created: null,
    updated: null,
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
    checkboxes: { done: 0, total: 0 },
    ...overrides,
  }
}

function board(cards: BoardCardView[], extra: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    folder: 'harbor',
    enabled: true,
    cards,
    archived: [],
    unreadable: [],
    calls: [],
    attention: { count: 0, oldestSince: null, blocked: 0 },
    doing: { count: cards.filter((item) => item.stage === 'doing').length, limit: 3 },
    runtimes: [],
    defaultRuntime: 'claude-code',
    ...extra,
  }
}

const order = (snapshot: BoardSnapshot) => snapshot.cards.map((item) => `${item.stage}:${item.id}`)

// ── The placement (pure) ─────────────────────────────────────────────────────
const base = board([
  card('idea01', 'idea'),
  card('todo01', 'todo'),
  card('todo02', 'todo'),
  card('todo03', 'todo'),
  card('doing1', 'doing', { result: { by: 'claude', at: NOW, summary: 'Wrote it.', files: [], check: [] }, call: 'review', move: 'you' }),
  card('done01', 'done'),
], { calls: [{ cardId: 'doing1', kind: 'review', since: NOW }], attention: { count: 1, oldestSince: NOW, blocked: 0 } })

assert.deepEqual(
  order(placeCard(base, { cardId: 'todo01', stage: 'doing', atEnd: true }, NOW)),
  ['idea:idea01', 'todo:todo02', 'todo:todo03', 'doing:doing1', 'doing:todo01', 'done:done01'],
  'at the end of another column',
)
assert.deepEqual(
  order(placeCard(base, { cardId: 'todo03', stage: 'doing', beforeCardId: 'doing1' }, NOW)),
  ['idea:idea01', 'todo:todo01', 'todo:todo02', 'doing:todo03', 'doing:doing1', 'done:done01'],
  'before a card',
)
assert.deepEqual(
  order(placeCard(base, { cardId: 'todo03', stage: 'todo', beforeCardId: 'todo01' }, NOW)),
  ['idea:idea01', 'todo:todo03', 'todo:todo01', 'todo:todo02', 'doing:doing1', 'done:done01'],
  'within a column (S25: a drop in the same column reorders at once)',
)
assert.deepEqual(
  order(placeCard(base, { cardId: 'done01', stage: 'todo' }, NOW)),
  ['idea:idea01', 'todo:done01', 'todo:todo01', 'todo:todo02', 'todo:todo03', 'doing:doing1'],
  'Reopen: at the top of To do, as the host puts it',
)
assert.deepEqual(
  order(placeCard(board([card('a00001', 'idea'), card('b00001', 'done')]), { cardId: 'a00001', stage: 'doing', atEnd: true }, NOW)),
  ['doing:a00001', 'done:b00001'],
  'into an empty column, in the stage order',
)
assert.equal(placeCard(base, { cardId: 'gone01', stage: 'done' }, NOW), base, 'a card that is gone leaves the snapshot as it is')
assert.deepEqual(
  order(placeCard(base, { cardId: 'todo01', stage: 'doing', beforeCardId: 'gone01' }, NOW)).indexOf('doing:todo01'),
  4,
  'before a card that is no longer there: the end of the column (the host says so and the move goes back)',
)
const done = placeCard(base, { cardId: 'doing1', stage: 'done' }, NOW)
const doneCard = done.cards.find((item) => item.id === 'doing1')!
assert.equal(order(done).indexOf('done:doing1'), 4, 'Mark done: the top of Done')
assert.deepEqual(doneCard.history[doneCard.history.length - 1], { at: NOW, by: 'you', what: 'Marked done' }, 'with the line the Done column reads its time from')
assert.equal(doneCard.call, null, 'a done card waits on nobody')
assert.deepEqual([done.calls.length, done.attention.count, done.doing.count], [0, 0, 0], 'and the counts move with it')
assert.deepEqual(base.cards.find((item) => item.id === 'doing1')!.history, [], 'the host’s snapshot is not changed')

// A result waits for review only in Doing; Next up follows To do's new top (the host's rules, for the moment it takes).
const reviewed = placeCard(base, { cardId: 'doing1', stage: 'todo' }, NOW)
const reviewedCard = reviewed.cards.find((item) => item.id === 'doing1')!
assert.deepEqual([reviewedCard.call, reviewedCard.move, reviewed.calls.length, reviewed.attention.count], [null, null, 0, 0], 'out of Doing, a result no longer waits on you')
assert.deepEqual(reviewed.cards.filter((item) => item.nextUp).map((item) => item.id), ['doing1'], 'and the card on top of To do is Next up')
const nextUp = placeCard({ ...base, cards: base.cards.map((item) => ({ ...item, nextUp: item.id === 'todo01' })) }, { cardId: 'todo01', stage: 'doing', atEnd: true }, NOW)
assert.deepEqual(nextUp.cards.filter((item) => item.nextUp).map((item) => item.id), ['todo02'], 'Next up moves on when its card leaves To do')

assert.equal(confirmsMove(placeCard(base, { cardId: 'todo01', stage: 'doing', atEnd: true }, NOW), { cardId: 'todo01', stage: 'doing', atEnd: true }), true)
assert.equal(confirmsMove(base, { cardId: 'todo01', stage: 'doing', atEnd: true }), false, 'the card still in To do')
assert.equal(confirmsMove(base, { cardId: 'todo03', stage: 'todo', beforeCardId: 'todo01' }), false, 'a reorder the snapshot doesn’t show yet')
assert.equal(confirmsMove(base, { cardId: 'todo01', stage: 'todo' }), true, 'already at the top of To do')
assert.deepEqual(
  order(applyPendingMoves(base, [
    { token: 2, cardId: 'todo02', stage: 'doing', atEnd: true, since: 0, answeredAt: null },
    { token: 1, cardId: 'todo01', stage: 'doing', atEnd: true, since: 0, answeredAt: null },
  ], NOW)),
  ['idea:idea01', 'todo:todo03', 'doing:doing1', 'doing:todo01', 'doing:todo02', 'done:done01'],
  'two pending moves, applied in the order they were made',
)

// ── The surface: what the components read (S19–S24) ────────────────────────
function Probe() {
  const snapshot = useBoardSnapshot()
  return React.createElement('pre', null, snapshot ? order(snapshot).join(' ') : 'none')
}
const shown = () => renderToStaticMarkup(React.createElement(Probe)).replace(/<\/?pre>/g, '')
const host = (data: unknown) => {
  for (const listener of hostListeners) listener({ data })
}
const lastRequest = () => posted[posted.length - 1] as { type: string; requestId: string; cardId?: string }
const answer = (requestId: string, value: unknown) => host({ type: 'board/result', requestId, answer: value })

startBoard('panel')
const s0 = board([card('todo01', 'todo'), card('todo02', 'todo'), card('doing1', 'doing'), card('lock01', 'doing', { locked: true })])
host({ type: 'board/state', snapshot: s0 })
assert.equal(shown(), 'todo:todo01 todo:todo02 doing:doing1 doing:lock01')

// S19: the card is in its new place before the host answers.
const moving = moveCard('todo01', 'doing', { atEnd: true })
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'in the new column in the same render as the drop')
const move1 = lastRequest()
assert.deepEqual({ type: move1.type, cardId: move1.cardId }, { type: 'board/move', cardId: 'todo01' }, 'and the host is asked')
// S23: a snapshot built before the move was written doesn't put it back.
host({ type: 'board/state', snapshot: s0 })
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'no flicker back to To do')
answer(move1.requestId, { ok: true, cardId: 'todo01' })
await moving
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'the yes alone keeps it where it is')
const s1 = board([card('todo02', 'todo'), card('doing1', 'doing'), card('lock01', 'doing', { locked: true }), card('todo01', 'doing')])
host({ type: 'board/state', snapshot: s1 })
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01')
assert.equal(savingStage('todo01'), null, 'the snapshot that shows it ends the move')

// S20–S22: a refusal puts the card back, with the host's words.
const refused = moveCard('todo02', 'done')
assert.equal(shown(), 'doing:doing1 doing:lock01 doing:todo01 done:todo02')
answer(lastRequest().requestId, { ok: false, code: 'write-failed', message: 'Couldn’t save todo02.md: EPERM' })
await refused
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'back where it was')
assert.equal(useBoardUi.getState().notice, 'Couldn’t save todo02.md: EPERM', 'with the host’s notice')
useBoardUi.getState().showNotice(null)

// A card an agent is working on: the host refuses a move out of its stage, so it isn't drawn moving and back.
const busy = moveCard('lock01', 'todo')
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'a locked card stays put')
answer(lastRequest().requestId, { ok: false, code: 'busy', message: 'The agent is still working on this card. Stop it first, or wait until it finishes.' })
await busy
assert.match(useBoardUi.getState().notice ?? '', /still working/, 'and the notice says why')
useBoardUi.getState().showNotice(null)

// S24: Mark done goes through the same path: top of Done at once, the host's message unchanged.
const marking = markCardDone('doing1')
assert.equal(shown(), 'todo:todo02 doing:lock01 doing:todo01 done:doing1')
assert.deepEqual({ type: lastRequest().type, cardId: lastRequest().cardId }, { type: 'board/mark-done', cardId: 'doing1' })

// Two moves of one card: the first one's yes doesn't end the second.
const again = moveCard('doing1', 'todo')
assert.equal(shown(), 'todo:doing1 todo:todo02 doing:lock01 doing:todo01', 'the second move is drawn over the first')
const markRequest = posted[posted.length - 2] as { requestId: string }
answer(markRequest.requestId, { ok: true, cardId: 'doing1' })
await marking
assert.equal(shown(), 'todo:doing1 todo:todo02 doing:lock01 doing:todo01', 'the first one’s answer leaves the second in place')

// S25: the quiet sign only once a move has waited a second.
assert.equal(savingStage('doing1'), null, 'no sign for a fast move')
await sleep(SAVING_SIGN_AFTER_MS + 50)
assert.equal(savingStage('doing1'), 'todo', 'a move pending for a second carries the sign')
answer(lastRequest().requestId, { ok: true, cardId: 'doing1' })
await again
assert.equal(savingStage('doing1'), 'todo', 'a yes without a snapshot keeps the sign until one shows it')

// The cap: a yes the snapshots never show (another surface moved it on) gives way to the host's snapshot.
await sleep(CONFIRM_WAIT_MS + 50)
assert.equal(savingStage('doing1'), null, 'after the wait the move lets go')
assert.equal(shown(), 'todo:todo02 doing:doing1 doing:lock01 doing:todo01', 'and the host’s last snapshot is shown')

// A request that gets no answer resolves as a refusal after 30 s (boardClient.request): not waited for here.
console.log('tasks/boardMoves: all assertions passed')
process.exit(0)
