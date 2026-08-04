/**
 * commentTaskStatus — Sprint 105 (#165): editor-side registry of comment-task
 * states pushed from the AI sidebar (`comment:task-status` broadcast).
 *
 * Statuses are FACTS from the sidebar queue/turn lifecycle — never invented
 * here. `cleared` (user removed the queued item) returns markers to neutral.
 */
import { useSyncExternalStore } from 'react'
import { onMessage } from '../../bridge'

export type CommentTaskStatus = 'queued' | 'running' | 'done' | 'failed'

let statuses: Readonly<Record<string, CommentTaskStatus>> = {}
const listeners = new Set<() => void>()
let subscribed = false

function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  onMessage((message: { type?: string } & Record<string, unknown>) => {
    if (message.type !== 'comment:task-status') return
    const ids = Array.isArray(message.commentIds) ? (message.commentIds as string[]) : []
    if (ids.length === 0) return
    const status = message.status as CommentTaskStatus | 'cleared'
    const next = { ...statuses }
    for (const id of ids) {
      if (status === 'cleared') delete next[id]
      else next[id] = status
    }
    statuses = next
    listeners.forEach((l) => l())
  })
}

export function useCommentTaskStatuses(): Readonly<Record<string, CommentTaskStatus>> {
  ensureSubscribed()
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => statuses,
  )
}

export const COMMENT_STATUS_LABEL: Record<CommentTaskStatus, string> = {
  queued: 'Task queued',
  running: 'Agent working…',
  done: 'Task finished',
  failed: 'Task failed',
}
