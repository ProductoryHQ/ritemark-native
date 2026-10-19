/**
 * The Tasks list in the order work moves (Sprint 134, R17, S48–S49): Ideas
 * folded, To do, Doing, Done folded with Archived inside; a task that waits
 * for the person first in its stage, wherever it is; every task once; Search
 * filters by title and Escape clears it.
 *
 * Run: npx tsx webview/src/components/tasks/taskList.test.ts
 */
import assert from 'node:assert/strict'
import type { BoardCall, BoardCardView, BoardSnapshot, CallKind } from '../../../../src/taskBoard/protocol'
import { DONE_SHOWN, filterGroups, matchesTitle, nextSearch, shownCards, taskGroups, type TaskGroup } from './taskList'

const now = new Date('2026-10-19T12:00:00')
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

function card(id: string, title: string, overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id,
    title,
    doneWhen: null,
    stage: 'todo',
    rank: id,
    description: '',
    files: [],
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
    checkboxes: { done: 0, total: 0 },
    ...overrides,
  }
}

const done = (id: string, title: string, minutesAgo = 60) =>
  card(id, title, { stage: 'done', history: [{ at: ago(minutesAgo), by: 'you', what: 'Marked done' }] })
const call = (cardId: string, kind: CallKind, minutesAgo: number): BoardCall => ({ cardId, kind, since: ago(minutesAgo) })

// S49's board: an idea, two To do, three Doing of which one waits on a decision,
// one failed task in To do, two done and one archived. The waiting ones are
// last in the board's order, so the list has to move them up.
const cards: BoardCardView[] = [
  card('i1', 'A short video for each module', { stage: 'idea' }),
  card('t1', 'Draft Module 6', { nextUp: true }),
  card('t2', 'Book the room for Module 4'),
  card('t3', 'Send the invitation', {
    call: 'failed',
    move: 'you',
    handoff: { state: 'failed', runtimeId: 'claude-code', since: ago(30), canOpen: true, failure: 'the network dropped' },
  }),
  card('d1', 'Sum up the research interviews', { stage: 'doing', handoff: { state: 'running', runtimeId: 'claude-code', since: ago(5), canOpen: true }, move: 'agent', locked: true }),
  card('d2', 'Write the brief', { stage: 'doing' }),
  card('d3', 'Choose the date for Module 5', {
    stage: 'doing',
    call: 'decision',
    move: 'you',
    ask: { by: 'claude-code', at: ago(90), question: 'Which date should Module 5 use?', options: ['26 November', '3 December'] },
  }),
  done('x1', 'Write the invitation', 30),
  done('x2', 'Draft Module 2', 24 * 60),
]
const archived = [card('a1', 'Old module notes', { stage: 'done', archived: ago(3 * 24 * 60) })]
const snapshot: Pick<BoardSnapshot, 'cards' | 'archived' | 'calls'> = {
  cards,
  archived,
  // As the host sorts them: the most urgent kind first (a decision before a failure).
  calls: [call('d3', 'decision', 90), call('t3', 'failed', 30)],
}

const ids = (list: readonly BoardCardView[]) => list.map((item) => item.id)
const byStage = (groups: TaskGroup[]) => Object.fromEntries(groups.map((group) => [group.stage, group]))
const everyId = (groups: TaskGroup[]) => groups.flatMap((group) => [...ids(group.cards), ...ids(group.archived)])

function main(): void {
  const groups = taskGroups(snapshot, now)
  const stage = byStage(groups)

  // The order work moves, with the drawing's names; Ideas and Done fold.
  assert.deepEqual(groups.map((group) => group.label), ['Ideas', 'To do', 'Doing', 'Done'])
  assert.deepEqual(groups.map((group) => group.folds), [true, false, false, true])

  // Ideas, folded: nothing waits there, so no row shows until it opens.
  assert.deepEqual(ids(shownCards(stage.idea, false).cards), [])
  assert.deepEqual(ids(shownCards(stage.idea, true).cards), ['i1'])

  // To do: the failed task first and marked.
  assert.deepEqual(ids(stage.todo.cards), ['t3', 't1', 't2'])
  assert.deepEqual([...stage.todo.waiting], ['t3'])

  // Doing: the decision first and marked.
  assert.deepEqual(ids(stage.doing.cards), ['d3', 'd1', 'd2'])
  assert.deepEqual([...stage.doing.waiting], ['d3'])

  // Done, folded, with the archived task inside it.
  assert.deepEqual(ids(shownCards(stage.done, false).cards), [])
  assert.deepEqual(ids(stage.done.cards), ['x1', 'x2'])
  assert.deepEqual(ids(stage.done.archived), ['a1'])
  assert.deepEqual(ids(stage.idea.archived), [])

  // Every task from the snapshot appears exactly once.
  const listed = everyId(groups)
  assert.equal(new Set(listed).size, listed.length, 'no task listed twice')
  assert.deepEqual([...listed].sort(), [...ids(cards), ...ids(archived)].sort())

  // The count is unchanged: every call is marked once, and nothing else is.
  const marked = groups.flatMap((group) => [...group.waiting])
  assert.deepEqual([...marked].sort(), snapshot.calls.map((item) => item.cardId).sort())

  // No call is hidden by the order: a folded stage still shows what waits in it.
  {
    const waitingIdea = card('i2', 'Review the module plan', { stage: 'idea', call: 'needs-you', move: 'you' })
    const lateDone = card('x3', 'An old task an agent reopened', { stage: 'done', call: 'needs-you', updated: ago(90 * 24 * 60) })
    const more = taskGroups(
      {
        cards: [...cards, waitingIdea, lateDone],
        archived,
        calls: [call('i2', 'needs-you', 3), call('x3', 'needs-you', 2), ...snapshot.calls],
      },
      now,
    )
    const s = byStage(more)
    assert.deepEqual(ids(shownCards(s.idea, false).cards), ['i2'])
    assert.deepEqual(ids(s.idea.cards), ['i2', 'i1'])
    assert.deepEqual(ids(shownCards(s.done, false).cards), ['x3'], 'a waiting task older than four weeks still shows')
  }

  // As before 2.0: a dropped idea and a task finished over four weeks ago stay off the list (the board has them).
  {
    const quiet = taskGroups(
      { cards: [...cards, card('i9', 'Dropped idea', { stage: 'idea', dropped: true }), done('x9', 'Long ago', 60 * 24 * 60)], archived, calls: snapshot.calls },
      now,
    )
    assert.ok(!everyId(quiet).includes('i9'))
    assert.ok(!everyId(quiet).includes('x9'))
  }

  // Done shows its five latest when open, never cutting off a task that waits; a search shows them all.
  {
    const many = Array.from({ length: 8 }, (_, index) => done(`m${index}`, `Finished ${index}`, 60 + index))
    const s = byStage(taskGroups({ cards: many, archived: [], calls: [] }, now))
    assert.equal(shownCards(s.done, true).cards.length, DONE_SHOWN)
    assert.equal(shownCards(s.done, true).more, 8 - DONE_SHOWN)
    assert.equal(shownCards(s.done, true, true).cards.length, 8)
  }

  // Search filters by title, in any case, as the person types.
  assert.ok(matchesTitle('Choose the date for Module 5', 'MODULE'))
  assert.ok(matchesTitle('Choose the date for Module 5', 'module date'))
  assert.ok(!matchesTitle('Write the brief', 'module'))
  {
    const found = filterGroups(groups, 'MoDuLe')
    const s = byStage(found)
    assert.deepEqual(found.map((group) => group.stage), ['idea', 'todo', 'doing', 'done'])
    assert.deepEqual(ids(s.idea.cards), ['i1'])
    assert.deepEqual(ids(s.todo.cards), ['t1', 't2'])
    assert.deepEqual(ids(s.doing.cards), ['d3'])
    assert.deepEqual([...s.doing.waiting], ['d3'], 'a match that waits stays marked')
    assert.deepEqual([...s.todo.waiting], [], 'the failed task did not match')
    assert.deepEqual(ids(s.done.cards), ['x2'])
    assert.deepEqual(ids(s.done.archived), ['a1'], 'Search finds archived tasks too')
  }
  {
    const found = filterGroups(groups, 'invitation')
    assert.deepEqual(found.map((group) => group.stage), ['todo', 'done'], 'stages with no match go')
    assert.deepEqual(filterGroups(groups, 'nothing like this'), [])
  }

  // Search shows the field; typing filters; Escape clears it and hides it, and the whole list is back.
  {
    let state = nextSearch({ open: false, query: '' }, { type: 'show' })
    assert.deepEqual(state, { open: true, query: '' })
    state = nextSearch(state, { type: 'type', query: 'module' })
    assert.equal(everyId(filterGroups(groups, state.query)).length, 6)
    assert.deepEqual(nextSearch(state, { type: 'blur' }), state, 'a search in force stays when the field loses the keyboard')
    state = nextSearch(state, { type: 'escape' })
    assert.deepEqual(state, { open: false, query: '' })
    assert.deepEqual(filterGroups(groups, state.query), groups)
    assert.deepEqual(nextSearch({ open: true, query: '  ' }, { type: 'blur' }), { open: false, query: '' }, 'an empty field goes when left')
  }

  console.log('taskList.test.ts: ok')
}

main()
