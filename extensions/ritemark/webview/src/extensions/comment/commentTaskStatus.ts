/**
 * commentTaskStatus — Sprint 117 (#292): the editor webview's view of the
 * host's comment-task ledger.
 *
 * What this replaces: a module-global `Record<commentId, status>` fed by a
 * status message broadcast to every open editor. It crossed documents, it was
 * empty after a reload, and the sidebar — not the host — decided what it said
 * (audit F13–F16). Now the host sends `comment-task/projection`: a FULL
 * snapshot for ONE document, and this module replaces its state wholesale on
 * every message, so a webview that missed an update cannot hold half a story.
 *
 * It also owns the request/response side of the channel, because correlation by
 * `requestId` belongs next to the listener that resolves it — a surface that
 * minted ids and matched replies itself is how "Sent" got shown before anything
 * was sent (audit F18).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { onMessage, sendToExtension } from '../../bridge'
import type { IndexedComment } from './commentIndex'
import type { CommentTaskProjectionV1 } from '../../../../src/commentTasks/types'
import type {
  CommentTaskDestinationPreview,
  CommentTaskError,
  CommentTaskRequestType,
} from '../../../../src/commentTasks/protocol'

export interface CommentTaskSnapshot {
  documentUri: string | null
  tasks: readonly CommentTaskProjectionV1[]
  /** Every comment of a task points at the SAME projection object — one task
   *  spanning several comments is one record, not a clone per comment (R7). */
  byCommentId: ReadonlyMap<string, CommentTaskProjectionV1>
}

const EMPTY_SNAPSHOT: CommentTaskSnapshot = {
  documentUri: null,
  tasks: [],
  byCommentId: new Map(),
}

let snapshot: CommentTaskSnapshot = EMPTY_SNAPSHOT
let destination: CommentTaskDestinationPreview | null = null

const listeners = new Set<() => void>()
let subscribed = false

function notify(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  ensureSubscribed()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ── Inbound ──────────────────────────────────────────────────────────────────

function isProjection(value: unknown): value is CommentTaskProjectionV1 {
  if (!value || typeof value !== 'object') return false
  const task = value as Partial<CommentTaskProjectionV1>
  return typeof task.taskId === 'string' && typeof task.state === 'string' && Array.isArray(task.commentIds)
}

/** Replace the snapshot with the host's. Exported for tests. */
export function applyCommentTaskProjection(message: { documentUri?: unknown; tasks?: unknown }): void {
  const documentUri = typeof message.documentUri === 'string' ? message.documentUri : null
  const tasks = Array.isArray(message.tasks) ? message.tasks.filter(isProjection) : []
  const byCommentId = new Map<string, CommentTaskProjectionV1>()
  for (const task of tasks) {
    for (const commentId of task.commentIds) {
      if (typeof commentId === 'string' && commentId) byCommentId.set(commentId, task)
    }
  }
  snapshot = { documentUri, tasks, byCommentId }
  notify()
}

/** Test seam: forget everything this module learned. */
export function resetCommentTaskState(): void {
  snapshot = EMPTY_SNAPSHOT
  destination = null
  pending.clear()
  notify()
}

interface PendingRequest {
  resolve: (outcome: CommentTaskOutcome) => void
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingRequest>()

function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  // Pull once, now that we are listening. The host also pushes a projection
  // when the editor reports ready, but that push can arrive before this
  // subscription exists — after a window reload every comment came back blank
  // while the ledger still held its tasks (found live, 2026-09-14). The pull
  // runs after the listener is wired, so it cannot lose the same race.
  queueMicrotask(() => {
    void requestCommentTask('comment-task/refresh')
  })
  onMessage((message: { type?: string } & Record<string, unknown>) => {
    if (message.type === 'comment-task/projection') {
      applyCommentTaskProjection(message as { documentUri?: unknown; tasks?: unknown })
      return
    }
    if (message.type !== 'comment-task/result') return
    const requestId = typeof message.requestId === 'string' ? message.requestId : ''
    const entry = pending.get(requestId)
    if (!entry) return
    pending.delete(requestId)
    clearTimeout(entry.timer)
    if (message.ok === true) {
      const data = (message.data ?? {}) as Record<string, unknown>
      if (message.operation === 'comment-task/destination-preview') {
        destination = {
          conversationId: typeof data.conversationId === 'string' ? data.conversationId : null,
          title: typeof data.title === 'string' ? data.title : null,
        }
        notify()
      }
      entry.resolve({ ok: true, data })
      return
    }
    entry.resolve({ ok: false, error: asError(message.error) })
  })
}

function asError(value: unknown): CommentTaskError {
  const error = (value ?? {}) as Partial<CommentTaskError>
  return {
    code: typeof error.code === 'string' ? error.code : 'invalid-request',
    message:
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'The task could not be sent.',
    retryable: error.retryable === true,
    recovery: typeof error.recovery === 'string' ? error.recovery : 'none',
  } as CommentTaskError
}

// ── Outbound ─────────────────────────────────────────────────────────────────

export type CommentTaskOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: CommentTaskError }

/** How long the webview waits before it stops claiming a request is in flight.
 *  The host's own waits are bounded well below this (1 s document sync + 5 s
 *  sidebar handshake), so reaching it means the host never answered at all. */
export const COMMENT_TASK_REQUEST_TIMEOUT_MS = 15_000

/** The exact-field comment shape `comment-task/accept` expects (protocol.ts).
 *  Both Send surfaces build their payload here, so a comment means the same
 *  thing whichever one sent it (R2). */
export function toRequestComment(comment: IndexedComment): {
  commentId: string
  kind: 'mark' | 'node'
  note: string
  instruction: string
  anchoredText?: string
} {
  return {
    commentId: comment.commentId as string,
    kind: comment.kind,
    note: comment.note,
    instruction: comment.instruction,
    ...(comment.anchoredText ? { anchoredText: comment.anchoredText } : {}),
  }
}

export function newCommentTaskRequestId(): string {
  const api = globalThis.crypto
  if (api && typeof api.randomUUID === 'function') return api.randomUUID()
  return `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Post one request and resolve with the host's answer. Never throws: a caller
 * renders `error.message` verbatim, so every path ends in something the user
 * can read.
 */
export function requestCommentTask(
  type: CommentTaskRequestType,
  payload: Record<string, unknown> = {},
  options: { requestId?: string; timeoutMs?: number } = {},
): Promise<CommentTaskOutcome> {
  ensureSubscribed()
  const requestId = options.requestId ?? newCommentTaskRequestId()
  return new Promise<CommentTaskOutcome>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      resolve({
        ok: false,
        // A webview-local timeout, not a host verdict: say so plainly and offer
        // the only honest next step.
        error: {
          code: 'sidebar-unreachable',
          message: 'Ritemark did not answer. Try again.',
          retryable: true,
          recovery: 'retry',
        },
      })
    }, options.timeoutMs ?? COMMENT_TASK_REQUEST_TIMEOUT_MS)
    pending.set(requestId, { resolve, timer })
    sendToExtension(type, { requestId, ...payload })
  })
}

/** Ask the host which conversation a task would go to (D5). Read-only. */
export async function refreshCommentTaskDestination(): Promise<void> {
  const outcome = await requestCommentTask('comment-task/destination-preview')
  if (outcome.ok) return
  // A failed preview must not block sending: the caption simply falls back to
  // "New conversation" rather than asserting a destination that may be wrong.
  destination = null
  notify()
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useCommentTaskSnapshot(): CommentTaskSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}

/** The task covering one comment, or null. */
export function useCommentTaskProjection(
  commentId: string | null | undefined,
): CommentTaskProjectionV1 | null {
  return useSyncExternalStore(subscribe, () =>
    commentId ? snapshot.byCommentId.get(commentId) ?? null : null,
  )
}

/**
 * The destination caption's source. Refreshes while `active` — a Send surface
 * is open — so the caption names the conversation that is open right now, and
 * stays quiet otherwise.
 */
export function useCommentTaskDestination(active: boolean): CommentTaskDestinationPreview | null {
  const value = useSyncExternalStore(subscribe, () => destination)
  useEffect(() => {
    if (!active) return
    void refreshCommentTaskDestination()
  }, [active])
  return value
}
