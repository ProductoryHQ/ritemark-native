import assert from 'node:assert/strict'
import type { BoardCardView, CardHandoffView } from '../../../../src/taskBoard/protocol'
import { duration, finishedLine, historyTime, logDay, modifiedLine, presentCard, shortDay, waited } from './taskCopy'

const now = new Date('2026-10-14T12:00:00') // a Wednesday, local time
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

function card(overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id: 'k3f9x2',
    title: 'Rewrite the launch plan intro',
    doneWhen: null,
    stage: 'todo',
    rank: 'i',
    description: '',
    files: [],
    created: ago(600),
    updated: ago(600),
    result: null,
    ask: null,
    review: null,
    dropped: false,
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

function handoff(state: CardHandoffView['state'], extra: Partial<CardHandoffView> = {}): CardHandoffView {
  return { state, runtimeId: 'claude-code', since: ago(12), canOpen: true, ...extra }
}

const context = { now, titleOf: (id: string) => (id === 'deck01' ? 'Draft the steering committee deck outline' : null) }
const words = (c: BoardCardView) => {
  const p = presentCard(c, context)
  return [p.glyph, p.tone, p.row, p.full]
}

function main(): void {
  // Every state in design.md §10 has its words and glyph.
  assert.deepEqual(words(card()), ['circle', 'faint', '', ''])
  assert.equal(presentCard(card(), context).plain, true)
  assert.deepEqual(words(card({ handoff: handoff('accepting') })), ['circle-notch', 'accent', 'Sending to Claude…', 'Sending to Claude…'])
  assert.deepEqual(words(card({ handoff: handoff('queued', { runtimeId: 'codex' }) })), ['clock', 'muted', 'Queued for Codex', 'Queued for Codex'])
  assert.deepEqual(words(card({ handoff: handoff('running', { runtimeId: 'opencode' }) })), ['circle-notch', 'accent', 'Working · OpenCode', 'Working · OpenCode'])
  assert.equal(presentCard(card({ handoff: handoff('running') }), context).spin, true)
  assert.deepEqual(
    words(card({ handoff: handoff('needs-user', { needs: 'approval' }), call: 'needs-you' })),
    ['shield-check', 'amber', 'Needs you · approval · 12 min', 'Waiting for approval'],
  )
  assert.deepEqual(words(card({ handoff: handoff('needs-user', { needs: 'question' }) }))[2], 'Needs you · question · 12 min')
  assert.deepEqual(words(card({ handoff: handoff('needs-user', { needs: 'plan' }) })).slice(0, 2), ['clipboard-text', 'amber'])
  assert.deepEqual(
    words(card({ ask: { by: 'claude', at: ago(30), question: 'Which audience?', options: ['A', 'B'] }, call: 'decision' })),
    ['question', 'accent', 'Decision for you · 30 min', 'Decision for you'],
  )
  assert.deepEqual(
    words(card({
      stage: 'doing',
      call: 'review',
      handoff: handoff('completed'),
      result: { by: 'claude', at: ago(120), seconds: 252, summary: 'Done.', files: ['a.md'], check: ['one', 'two'] },
    })),
    ['eye', 'accent', 'Ready to review · 2h · 2 to check', 'Ready to review'],
  )
  assert.deepEqual(
    words(card({ handoff: handoff('failed', { failure: 'usage limit reached', since: ago(5) }) })),
    ['x-circle', 'red', 'Failed · usage limit reached · 5 min', 'Failed · usage limit reached'],
  )
  assert.deepEqual(words(card({ handoff: handoff('cancelled') })), ['x', 'faint', 'Stopped', 'Stopped'])
  assert.deepEqual(words(card({ handoff: handoff('interrupted', { since: ago(90) }) })), ['warning', 'muted', 'Interrupted · 1h', 'Interrupted when Ritemark closed'])
  assert.deepEqual(words(card({ handoff: handoff('conversation-gone') }))[2], 'Conversation no longer available')
  assert.deepEqual(
    words(card({ stage: 'done', history: [{ at: '2026-10-13T14:05:00', by: 'you', what: 'Marked done' }] })),
    ['check-circle', 'muted', 'Done · Yesterday', 'Done · Yesterday 14:05'],
  )
  assert.deepEqual(words(card({ stage: 'idea' })), ['lightbulb', 'faint', 'Not reviewed', 'Not reviewed'])
  assert.deepEqual(
    words(card({ stage: 'idea', review: { by: 'claude', at: ago(3), verdict: 'already-on-board', why: 'x', size: 'small', title: 't', description: 'd' } })).slice(0, 3),
    ['copy', 'muted', 'Already on the board'],
  )
  assert.deepEqual(words(card({ stage: 'idea', dropped: true }))[2], 'Dropped')

  // Waiting cards say what they wait for.
  assert.deepEqual(
    words(card({ handoff: handoff('waiting', { waitFor: { kind: 'conflict', cardId: 'deck01' } }) })).slice(2),
    ['Starts after “Draft the steering…”', 'Starts when “Draft the steering committee deck outline” finishes'],
  )
  assert.equal(words(card({ handoff: handoff('waiting', { waitFor: { kind: 'slot' } }) }))[2], 'Starts when Doing has room')
  assert.equal(words(card({ handoff: handoff('waiting', { waitFor: { kind: 'capacity' } }) }))[2], 'Starts when the AI sidebar has room')
  assert.equal(presentCard(card({ handoff: handoff('waiting', { waitFor: { kind: 'slot' } }) }), context).waiting, true)

  // A decision outranks a finished turn; a working agent outranks both.
  const both = card({ ask: { by: 'codex', at: ago(2), question: 'Q', options: ['A', 'B'] }, handoff: handoff('completed') })
  assert.equal(presentCard(both, context).row, 'Decision for you · 2 min')
  assert.equal(presentCard({ ...both, handoff: handoff('running') }, context).row, 'Working · Claude')

  // Times and lengths.
  assert.equal(waited(ago(0.5), now), 'just now')
  assert.equal(waited(ago(59), now), '59 min')
  assert.equal(waited(ago(60 * 26), now), '1d')
  assert.equal(duration(52), '52s')
  assert.equal(duration(252), '4m 12s')
  assert.equal(shortDay(ago(60 * 24 * 3), now), 'Sun')
  assert.equal(logDay(ago(60 * 24 * 3), now), 'Sunday')
  assert.equal(shortDay('2026-09-30T10:00:00', now), '30 Sep')
  assert.equal(historyTime('2026-10-14T10:31:00', now), 'Today 10:31')
  assert.equal(modifiedLine(['docs/plan.md', 'notes.md']), 'Modified 2 files: plan.md, notes.md')
  assert.equal(modifiedLine(['docs/plan.md']), 'Modified 1 file: plan.md')
  assert.equal(
    finishedLine(card({ result: { by: 'codex', at: ago(1), seconds: 61, summary: '', files: [], check: [] } })),
    'Codex finished in 1m 01s',
  )

  console.log('tasks/taskCopy: all assertions passed')
}

main()
