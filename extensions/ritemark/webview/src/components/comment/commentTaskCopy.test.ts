/**
 * Sprint 117 (#292) R7/R9 — the comment-task vocabulary.
 *
 * The point of these tests is that no lifecycle state can reach a user as a
 * colour with no words, and that a rejection is shown as the host wrote it
 * rather than as a shrug.
 */
import assert from 'node:assert/strict'
import {
  COMMENT_TASK_GLYPH,
  COMMENT_TASK_TONE,
  FAILURE_INLINE_LIMIT,
  RECOVERY_LABEL,
  describeGroupResult,
  destinationCaption,
  destinationLine,
  presentCommentTask,
  recoveryAction,
  runtimeLabel,
  type GroupSendState,
} from './commentTaskCopy'
import type { CommentTaskProjectionV1, CommentTaskState } from '../../../../src/commentTasks/types'
import type { CommentTaskError, CommentTaskRecovery } from '../../../../src/commentTasks/protocol'

function projection(over: Partial<CommentTaskProjectionV1> = {}): CommentTaskProjectionV1 {
  return {
    taskId: 't-1',
    commentIds: ['c-1'],
    runtimeId: 'claude-code',
    alias: 'claude',
    state: 'queued',
    since: '2026-09-14T10:00:00.000Z',
    destination: { conversationId: 'conv-1', title: 'Release note review' },
    ...over,
  } as CommentTaskProjectionV1
}

const ALL_STATES: CommentTaskState[] = [
  'accepting',
  'queued',
  'running',
  'needs-user',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]

// Every state produces text and a glyph — nothing is colour-only (R9).
{
  for (const state of ALL_STATES) {
    const p = presentCommentTask(projection({ state }))
    assert.equal(p.state, state)
    assert.ok(p.statusLine.trim().length > 0, `${state} has a status sentence`)
    assert.ok(p.glyph.trim().length > 0, `${state} has a glyph`)
    assert.equal(p.glyph, COMMENT_TASK_GLYPH[state])
    assert.equal(p.tone, COMMENT_TASK_TONE[state])
    assert.equal(p.destinationLine, 'In “Release note review”')
  }
}

// The runtime is named where design.md names it.
{
  assert.equal(presentCommentTask(projection({ state: 'queued' })).statusLine, 'Queued for Claude')
  assert.equal(presentCommentTask(projection({ state: 'running' })).statusLine, 'Claude is working')
  assert.equal(
    presentCommentTask(projection({ state: 'running', alias: 'codex', runtimeId: 'codex' })).statusLine,
    'Codex is working',
  )
  assert.equal(
    presentCommentTask(projection({ state: 'completed', alias: 'opencode', runtimeId: 'opencode', summary: 'Did it.' }))
      .statusLine,
    'OpenCode completed this task',
  )
  assert.equal(runtimeLabel('opencode'), 'OpenCode')
}

// accepting is busy and offers nothing to click — the duplicate-activation guard.
{
  const p = presentCommentTask(projection({ state: 'accepting' }))
  assert.equal(p.statusLine, 'Sending task…')
  assert.equal(p.busy, true)
  assert.deepEqual(p.actions, [])
}

// Live states route to the conversation, never to an in-editor approval.
{
  for (const state of ['queued', 'running', 'needs-user', 'completed'] as CommentTaskState[]) {
    const p = presentCommentTask(projection({ state }))
    assert.deepEqual(
      p.actions.map((a) => a.kind),
      ['open-conversation'],
      `${state} offers Open conversation only`,
    )
    assert.equal(p.busy, false)
  }
}

// needs-user says what is wanted without pretending to be progress.
{
  const p = presentCommentTask(projection({ state: 'needs-user', attentionKind: 'approval' }))
  assert.equal(p.statusLine, 'Needs your input')
  assert.equal(p.tone, 'attention')
  assert.ok(p.detail.includes('approval'))
  assert.equal(
    presentCommentTask(projection({ state: 'needs-user', attentionKind: 'question' })).detail,
    'The agent asked you a question.',
  )
  // Without an attention kind the detail is empty rather than invented.
  assert.equal(presentCommentTask(projection({ state: 'needs-user' })).detail, '')
}

// completed renders the host summary verbatim (no truncation in JS — the
// bubble clamps it visually, so a screen reader still gets the whole line).
{
  const summary = 'Reworked the evidence paragraph and tightened the closing argument.'
  const p = presentCommentTask(projection({ state: 'completed', summary }))
  assert.equal(p.detail, summary)
  assert.equal(p.tone, 'success')
}

// Tool-only success: the host's fallback sentence is shown as-is; an absent
// summary never becomes a fabricated answer.
{
  const fallback = 'The task finished. Open the conversation for details.'
  assert.equal(presentCommentTask(projection({ state: 'completed', summary: fallback })).detail, fallback)
  assert.equal(presentCommentTask(projection({ state: 'completed' })).detail, '')
}

// failed renders the safe message: short inline, long as the detail line.
{
  const short = 'The agent ran out of context.'
  const shortP = presentCommentTask(projection({ state: 'failed', safeMessage: short }))
  assert.equal(shortP.statusLine, `Task failed · ${short}`)
  assert.equal(shortP.detail, '')
  assert.ok(shortP.actions.some((a) => a.kind === 'retry'))

  const long = 'x'.repeat(FAILURE_INLINE_LIMIT + 1)
  const longP = presentCommentTask(projection({ state: 'failed', safeMessage: long }))
  assert.equal(longP.statusLine, 'Task failed')
  assert.equal(longP.detail, long, 'a long safe message is still shown, just below the status')

  assert.equal(presentCommentTask(projection({ state: 'failed' })).statusLine, 'Task failed')
}

// cancelled and interrupted are distinct from completion and offer recovery.
{
  const cancelled = presentCommentTask(projection({ state: 'cancelled' }))
  assert.equal(cancelled.statusLine, 'Task cancelled')
  assert.ok(cancelled.actions.some((a) => a.kind === 'retry'))

  assert.equal(
    presentCommentTask(projection({ state: 'interrupted', interruptReason: 'restart' })).statusLine,
    'Task interrupted when Ritemark closed',
  )
  assert.equal(
    presentCommentTask(projection({ state: 'interrupted', interruptReason: 'runtime-exited' })).statusLine,
    'Task interrupted when the agent stopped',
  )

  // A deleted conversation cannot be opened — no dead-end button.
  const gone = presentCommentTask(projection({ state: 'interrupted', interruptReason: 'conversation-deleted' }))
  assert.equal(gone.statusLine, 'Conversation no longer available')
  assert.deepEqual(gone.actions.map((a) => a.kind), ['retry'])
}

// A destination with no title degrades to nothing rather than to `In “”`.
{
  assert.equal(destinationLine(null), '')
  assert.equal(destinationLine('   '), '')
  assert.equal(
    presentCommentTask(projection({ destination: { conversationId: 'c', title: '' } })).destinationLine,
    '',
  )
}

// The Send caption names the open conversation, or says it will be a new one.
{
  assert.equal(destinationCaption('Release note review'), '→ Release note review')
  assert.equal(destinationCaption(null), '→ New conversation')

  // A comment assigned to one agent, sent into a conversation another agent is
  // running, is allowed — it is the runtime switch the Composer already offers.
  // The caption says so before the click rather than leaving it to be noticed.
  assert.equal(
    destinationCaption('Release note review', { alias: 'codex', conversationRuntimeId: 'claude-code' }),
    '→ Release note review · Codex takes over',
  )
  assert.equal(
    destinationCaption('Release note review', { alias: 'claude', conversationRuntimeId: 'claude-code' }),
    '→ Release note review',
    'the same agent is not announced as a takeover',
  )
  assert.equal(
    destinationCaption('Release note review', { alias: 'codex', conversationRuntimeId: null }),
    '→ Release note review',
    'a conversation that has not run a turn has no agent to take over from',
  )
  assert.equal(
    destinationCaption(null, { alias: 'codex', conversationRuntimeId: 'claude-code' }),
    '→ New conversation',
    'a new conversation is never a takeover',
  )
  assert.equal(destinationCaption(''), '→ New conversation')
}

// Recovery: every code maps, and the two "nothing to click" codes stay silent.
{
  const codes: CommentTaskRecovery[] = ['none', 'retry', 'sign-in', 'configure', 'install', 'save-document']
  for (const code of codes) {
    assert.ok(code in RECOVERY_LABEL, `${code} has a decided label`)
  }
  assert.equal(RECOVERY_LABEL.none, null)
  assert.equal(RECOVERY_LABEL['save-document'], null)
  assert.equal(RECOVERY_LABEL['sign-in'], 'Sign in')
  assert.equal(RECOVERY_LABEL.retry, 'Try again')
  assert.equal(RECOVERY_LABEL.configure, 'Open settings')
  assert.equal(RECOVERY_LABEL.install, 'Open settings')

  const signIn: CommentTaskError = {
    code: 'runtime-unavailable',
    message: 'Sign in to Codex to run this task.',
    retryable: true,
    recovery: 'sign-in',
  }
  assert.deepEqual(recoveryAction(signIn), { kind: 'recovery', recovery: 'sign-in', label: 'Sign in' })
  assert.equal(
    recoveryAction({ code: 'document-not-file', message: 'Save the document first.', retryable: false, recovery: 'save-document' }),
    null,
  )
  assert.deepEqual(
    recoveryAction({ code: 'queue-full', message: 'The queue is full.', retryable: true, recovery: 'retry' }),
    { kind: 'retry', recovery: 'retry', label: 'Try again' },
  )
}

// Bulk results are per group: one failure never hides behind another's success.
{
  assert.equal(describeGroupResult('Claude', { status: 'idle' }), null)
  assert.equal(describeGroupResult('Claude', { status: 'pending' })?.text, 'Claude · Sending…')

  const ok: GroupSendState = { status: 'accepted', count: 2, destinationTitle: 'Release note review' }
  const okLine = describeGroupResult('Claude', ok)
  assert.equal(okLine?.text, 'Claude · 2 queued → Release note review')
  assert.equal(okLine?.tone, 'success')
  assert.equal(okLine?.action, null)

  const rejected: GroupSendState = {
    status: 'rejected',
    error: { code: 'runtime-unavailable', message: 'Sign in required', retryable: true, recovery: 'sign-in' },
  }
  const badLine = describeGroupResult('Codex', rejected)
  assert.equal(badLine?.text, 'Codex · Sign in required', 'the host message is rendered verbatim')
  assert.equal(badLine?.tone, 'error')
  assert.equal(badLine?.action?.label, 'Sign in')

  // Mixed batch: the two lines stay independent, exactly as design.md draws it.
  assert.notEqual(okLine?.text, badLine?.text)
  assert.equal(
    describeGroupResult('Claude', { status: 'accepted', count: 1, destinationTitle: null })?.text,
    'Claude · 1 queued',
  )
}

console.log('commentTaskCopy: all assertions passed')
