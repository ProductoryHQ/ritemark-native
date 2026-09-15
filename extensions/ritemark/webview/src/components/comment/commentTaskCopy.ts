/**
 * commentTaskCopy — Sprint 117 (#292): the ONE place a comment-task state
 * becomes words a user reads.
 *
 * Before this sprint the editor invented its own optimism: the rail flashed
 * "Sent" the moment it posted a message and the Comments menu announced
 * "Queued N tasks" before the host had seen the request (audit F18). Nothing
 * here reports anything the host did not say. Every function is pure over a
 * host projection or a host error, so the vocabulary is unit-testable and the
 * components only place the strings.
 *
 * Design contract: docs/development/releases/v1.11.0/
 *   sprint-117-comment-agent-honesty/design.md ## State Vocabulary
 */

import { ALIAS_LABEL, ALIAS_TO_AGENT_ID } from '../../extensions/comment/commentModel'
import type { CommentTaskProjectionV1, CommentTaskState } from '../../../../src/commentTasks/types'
import type { CommentTaskError, CommentTaskRecovery } from '../../../../src/commentTasks/protocol'

/**
 * Tone drives colour ONLY. Every state also carries a glyph and a sentence, so
 * a user who cannot see the colour still reads the same fact (R9).
 */
export type CommentTaskTone = 'idle' | 'progress' | 'attention' | 'success' | 'error'

export type CommentTaskActionKind = 'open-conversation' | 'retry'

export interface CommentTaskAction {
  kind: CommentTaskActionKind
  label: string
}

export interface CommentTaskPresentation {
  state: CommentTaskState
  tone: CommentTaskTone
  /** Text glyph, never an icon-only colour cue. */
  glyph: string
  /** The one status sentence — design.md's State Vocabulary column. */
  statusLine: string
  /** Completion summary / attention detail. Rendered below the status line and
   *  visually clamped to two lines; the full text stays in the DOM for screen
   *  readers. Empty string when the state has nothing to add. */
  detail: string
  /** `In “<conversation>”`, or '' when the host sent no title. */
  destinationLine: string
  actions: CommentTaskAction[]
  /** True while the task cannot be acted on yet (duplicate activation guard). */
  busy: boolean
}

export const COMMENT_TASK_GLYPH: Record<CommentTaskState, string> = {
  accepting: '◌',
  queued: '○',
  running: '●',
  'needs-user': '!',
  completed: '✓',
  failed: '×',
  cancelled: '–',
  interrupted: '!',
}

export const COMMENT_TASK_TONE: Record<CommentTaskState, CommentTaskTone> = {
  accepting: 'idle',
  queued: 'idle',
  running: 'progress',
  'needs-user': 'attention',
  completed: 'success',
  failed: 'error',
  cancelled: 'idle',
  interrupted: 'attention',
}

/** A failure reason shorter than this reads well inline ("Task failed · …");
 *  anything longer becomes the detail line so the status stays scannable. */
export const FAILURE_INLINE_LIMIT = 72

const ATTENTION_DETAIL: Record<NonNullable<CommentTaskProjectionV1['attentionKind']>, string> = {
  approval: 'The agent is waiting for your approval.',
  question: 'The agent asked you a question.',
  'plan-review': 'A plan is waiting for your review.',
}

const INTERRUPT_LINE: Record<NonNullable<CommentTaskProjectionV1['interruptReason']>, string> = {
  restart: 'Task interrupted when Ritemark closed',
  'sidebar-unreachable': 'Task interrupted before it reached the agent',
  'conversation-deleted': 'Conversation no longer available',
  'runtime-exited': 'Task interrupted when the agent stopped',
}

const OPEN_CONVERSATION: CommentTaskAction = { kind: 'open-conversation', label: 'Open conversation' }
const RETRY: CommentTaskAction = { kind: 'retry', label: 'Retry' }

/** Runtime display name — one vocabulary with the collector and the picker. */
export function runtimeLabel(alias: CommentTaskProjectionV1['alias']): string {
  return ALIAS_LABEL[alias] ?? alias
}

export function destinationLine(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim()
  return trimmed ? `In “${trimmed}”` : ''
}

/** The caption above a Send control: the conversation the task will go to
 *  (D5 — the open one, never a picker). A null conversation is a fresh one. */
export function destinationCaption(
  title: string | null | undefined,
  options: { alias?: CommentTaskProjectionV1['alias']; conversationRuntimeId?: string | null } = {},
): string {
  const trimmed = (title ?? '').trim()
  const base = trimmed ? `→ ${trimmed}` : '→ New conversation'

  // A comment assigned to one agent, sent into a conversation another agent is
  // running, is allowed — it is the same runtime switch the Composer offers,
  // and the transcript records a boundary. But the user should read it before
  // it happens, not discover it afterwards. Jarmo asked what this case does,
  // 2026-09-14, which is the proof it was not visible enough.
  const { alias, conversationRuntimeId } = options
  if (!alias || !conversationRuntimeId || !trimmed) return base
  const assigned = ALIAS_TO_AGENT_ID[alias]
  if (assigned === conversationRuntimeId) return base
  return `${base} · ${runtimeLabel(alias)} takes over`
}

/**
 * Map one host projection to the comment bubble's words. Exhaustive over
 * `CommentTaskState`: a new state cannot be added without deciding its copy.
 */
export function presentCommentTask(projection: CommentTaskProjectionV1): CommentTaskPresentation {
  const who = runtimeLabel(projection.alias)
  const base = {
    state: projection.state,
    tone: COMMENT_TASK_TONE[projection.state],
    glyph: COMMENT_TASK_GLYPH[projection.state],
    destinationLine: destinationLine(projection.destination?.title),
    busy: false,
  }

  switch (projection.state) {
    case 'accepting':
      return { ...base, statusLine: 'Sending task…', detail: '', actions: [], busy: true }
    case 'queued':
      return { ...base, statusLine: `Queued for ${who}`, detail: '', actions: [OPEN_CONVERSATION] }
    case 'running':
      return { ...base, statusLine: `${who} is working`, detail: '', actions: [OPEN_CONVERSATION] }
    case 'needs-user':
      return {
        ...base,
        statusLine: 'Needs your input',
        detail: projection.attentionKind ? ATTENTION_DETAIL[projection.attentionKind] : '',
        actions: [OPEN_CONVERSATION],
      }
    case 'completed':
      return {
        ...base,
        statusLine: `${who} completed this task`,
        // Tool-only success already arrives as the host's truthful fallback
        // sentence; an empty summary is never dressed up as an answer here.
        detail: (projection.summary ?? '').trim(),
        actions: [OPEN_CONVERSATION],
      }
    case 'failed': {
      const reason = (projection.safeMessage ?? '').trim()
      const inline = reason && reason.length <= FAILURE_INLINE_LIMIT
      return {
        ...base,
        statusLine: inline ? `Task failed · ${reason}` : 'Task failed',
        detail: inline ? '' : reason,
        actions: [RETRY, OPEN_CONVERSATION],
      }
    }
    case 'cancelled':
      return { ...base, statusLine: 'Task cancelled', detail: '', actions: [RETRY, OPEN_CONVERSATION] }
    case 'interrupted': {
      const reason = projection.interruptReason ?? 'restart'
      return {
        ...base,
        statusLine: INTERRUPT_LINE[reason],
        detail: '',
        // A deleted conversation has nothing to open; offering it would be a
        // dead end (design.md ## File and Lifecycle States).
        actions: reason === 'conversation-deleted' ? [RETRY] : [RETRY, OPEN_CONVERSATION],
      }
    }
  }
}

// ── Rejections ───────────────────────────────────────────────────────────────

/** What the host's `recovery` becomes on screen. `null` = message only. */
export const RECOVERY_LABEL: Record<CommentTaskRecovery, string | null> = {
  none: null,
  retry: 'Try again',
  'sign-in': 'Sign in',
  configure: 'Open settings',
  install: 'Open settings',
  'save-document': null,
}

export interface CommentTaskRecoveryAction {
  /** `retry` re-sends the same request; `recovery` asks the host to open the
   *  sign-in / settings surface for that runtime. */
  kind: 'retry' | 'recovery'
  recovery: CommentTaskRecovery
  label: string
}

export function recoveryAction(error: CommentTaskError): CommentTaskRecoveryAction | null {
  const label = RECOVERY_LABEL[error.recovery]
  if (!label) return null
  return { kind: error.recovery === 'retry' ? 'retry' : 'recovery', recovery: error.recovery, label }
}

// ── Bulk send, per agent group ───────────────────────────────────────────────

export type GroupSendState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'accepted'; count: number; destinationTitle: string | null }
  | { status: 'rejected'; error: CommentTaskError }

export interface GroupResultLine {
  glyph: string
  tone: CommentTaskTone
  text: string
  action: CommentTaskRecoveryAction | null
}

/**
 * One line per agent group. The menu renders these as they arrive, which is
 * why there is no "all queued" shape here at all: a blanket success could not
 * be expressed even by mistake (audit F18, R5).
 */
export function describeGroupResult(label: string, state: GroupSendState): GroupResultLine | null {
  switch (state.status) {
    case 'idle':
      return null
    case 'pending':
      return { glyph: '◌', tone: 'progress', text: `${label} · Sending…`, action: null }
    case 'accepted': {
      const title = (state.destinationTitle ?? '').trim()
      const queued = `${label} · ${state.count} queued`
      return { glyph: '✓', tone: 'success', text: title ? `${queued} → ${title}` : queued, action: null }
    }
    case 'rejected':
      // error.message is the host's sentence, rendered verbatim (R5).
      return { glyph: '!', tone: 'error', text: `${label} · ${state.error.message}`, action: recoveryAction(state.error) }
  }
}
