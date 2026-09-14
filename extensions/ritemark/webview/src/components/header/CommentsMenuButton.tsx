/**
 * CommentsMenuButton — Sprint 105 (#164): the document-level comments entry.
 *
 * Toolbar button with the unique-comment count badge; opens a compact overview
 * (totals + per-agent groups) whose one action — **Send assigned comments to
 * AI** — dispatches ONE ordered task per included agent. Dispatch-only: no
 * comment is resolved, deleted, or edited here.
 *
 * Sprint 117 (#292): the dispatch is the typed `comment-task/accept` contract,
 * the prompt is built by the HOST from the frozen task record (so both surfaces
 * send the same thing, audit F01–F06), and the old "Queued N tasks" banner is
 * gone. It was shown the instant the messages were posted — before availability,
 * destination, or queue capacity had been checked (audit F18). Results now
 * arrive per agent group and are rendered exactly as they come.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { sendToExtension } from '../../bridge'
import {
  collectDocumentComments,
  summarizeComments,
  type CommentSummary,
  type IndexedComment,
  type MinimalNode,
} from '../../extensions/comment/commentIndex'
import { assignMissingCommentIds } from '../../extensions/comment/commentIds'
import {
  newCommentTaskRequestId,
  requestCommentTask,
  toRequestComment,
  useCommentTaskDestination,
} from '../../extensions/comment/commentTaskStatus'
import {
  describeGroupResult,
  destinationCaption,
  type GroupSendState,
} from '../comment/commentTaskCopy'
import { ALIAS_LABEL, type CommentAgentAlias } from '../../extensions/comment/commentModel'
import type { CommentTaskError } from '../../../../src/commentTasks/protocol'

type GroupStates = Partial<Record<CommentAgentAlias, GroupSendState>>

export function CommentsMenuButton({ getEditor }: { getEditor: () => TipTapEditor | null }) {
  const [summary, setSummary] = useState<CommentSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [groupStates, setGroupStates] = useState<GroupStates>({})
  const [sending, setSending] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const recompute = useCallback(() => {
    const editor = getEditor()
    if (!editor) { setSummary(null); return }
    const comments = collectDocumentComments(editor.state.doc as unknown as MinimalNode)
    setSummary(summarizeComments(comments))
  }, [getEditor])

  // Recompute on editor transactions (debounced) — covers add/edit/assign/
  // delete/undo/external reload; and once on mount for the initial document.
  useEffect(() => {
    let timer: number | undefined
    let disposed = false
    const attach = () => {
      const editor = getEditor()
      if (!editor) { if (!disposed) window.setTimeout(attach, 300); return }
      recompute()
      const onUpdate = () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(recompute, 250)
      }
      editor.on('update', onUpdate)
    }
    attach()
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [getEditor, recompute])

  // Click-away closes the popover.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        // Send results describe one dispatch; reopening the menu should not
        // replay them. The task's own state lives on the comment from here on.
        setOpen(false); setConfirming(false); setGroupStates({})
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // The destination caption (D5): the conversation open in the AI sidebar. It
  // is a caption, not a choice — there is no picker and no confirmation.
  const destination = useCommentTaskDestination(open && confirming)

  const setGroupState = useCallback((alias: CommentAgentAlias, state: GroupSendState | null) => {
    setGroupStates((current) => {
      const next = { ...current }
      if (state) next[alias] = state
      else delete next[alias]
      return next
    })
  }, [])

  /**
   * Mint ids for every comment about to be sent (one undoable transaction for
   * the whole batch, D3), then re-read the document so the payload carries the
   * ids that are actually in it, in document order.
   */
  const buildGroups = useCallback(
    (aliases: CommentAgentAlias[]): Map<CommentAgentAlias, IndexedComment[]> => {
      const editor = getEditor()
      const groups = new Map<CommentAgentAlias, IndexedComment[]>()
      if (!editor || aliases.length === 0) return groups
      const wanted = new Set<CommentAgentAlias>(aliases)
      const before = collectDocumentComments(editor.state.doc as unknown as MinimalNode)
      const keys = before.filter((c) => c.alias && wanted.has(c.alias)).map((c) => c.key)
      if (!keys.length) return groups
      const minted = new Set(assignMissingCommentIds(editor, keys).values())
      for (const comment of collectDocumentComments(editor.state.doc as unknown as MinimalNode)) {
        if (!comment.commentId || !minted.has(comment.commentId)) continue
        if (!comment.alias || !wanted.has(comment.alias)) continue
        const list = groups.get(comment.alias) ?? []
        list.push(comment)
        groups.set(comment.alias, list)
      }
      return groups
    },
    [getEditor],
  )

  const postGroup = useCallback(
    async (alias: CommentAgentAlias, comments: IndexedComment[], batchId: string | null) => {
      setGroupState(alias, { status: 'pending' })
      const outcome = await requestCommentTask('comment-task/accept', {
        batchId,
        surface: 'menu',
        alias,
        // The host validates against the live document by comment id; the
        // webview has no view of TextDocument.version.
        documentVersion: 0,
        comments: comments.map(toRequestComment),
      })
      if (!outcome.ok) {
        setGroupState(alias, { status: 'rejected', error: outcome.error })
        return
      }
      const data = outcome.data as { destination?: { title?: unknown } }
      const title = typeof data.destination?.title === 'string' ? data.destination.title : null
      setGroupState(alias, { status: 'accepted', count: comments.length, destinationTitle: title })
    },
    [setGroupState],
  )

  const dispatchAliases = useCallback(
    async (aliases: CommentAgentAlias[], batchId: string | null) => {
      if (!aliases.length) return
      setSending(true)
      for (const alias of aliases) setGroupState(alias, { status: 'pending' })
      let groups: Map<CommentAgentAlias, IndexedComment[]>
      try {
        groups = buildGroups(aliases)
      } catch {
        const error: CommentTaskError = {
          code: 'comment-not-found',
          message: 'These comments could not be prepared for sending. Reopen the document and try again.',
          retryable: false,
          recovery: 'none',
        }
        for (const alias of aliases) setGroupState(alias, { status: 'rejected', error })
        setSending(false)
        return
      }
      for (const alias of aliases) {
        if (!groups.has(alias)) {
          setGroupState(alias, {
            status: 'rejected',
            error: {
              code: 'comment-not-found',
              message: 'These comments are no longer in the document.',
              retryable: false,
              recovery: 'none',
            },
          })
        }
      }
      await Promise.all([...groups.entries()].map(([alias, list]) => postGroup(alias, list, batchId)))
      setSending(false)
    },
    [buildGroups, postGroup, setGroupState],
  )

  if (!summary || summary.total === 0) return null

  const includedGroups = summary.byAgent.filter((g) => included[g.alias] !== false)
  const includedTaskCount = includedGroups.length
  const includedCommentCount = includedGroups.reduce((n, g) => n + g.comments.length, 0)
  const resultAliases = summary.byAgent.map((g) => g.alias).filter((alias) => groupStates[alias])
  const hasResults = resultAliases.length > 0
  const settled = hasResults && resultAliases.every((alias) => groupStates[alias]?.status !== 'pending')

  const startDispatch = () => {
    // One batch id groups this send, so the host can report per agent and the
    // menu can render each group's answer as it arrives (D6).
    void dispatchAliases(includedGroups.map((g) => g.alias), newCommentTaskRequestId())
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="toolbar"
        size="icon-sm"
        data-state={open ? 'active' : undefined}
        aria-pressed={open}
        aria-label={`Comments (${summary.total})`}
        onClick={() => { setOpen((o) => !o); setConfirming(false); setGroupStates({}); recompute() }}
        title={`Comments (${summary.total})`}
        className="relative"
      >
        <Icon name="chat-circle" size={14} tone={open ? 'active' : 'muted'} />
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--r-accent)] text-[9px] font-semibold leading-[14px] text-white text-center">
          {summary.total}
        </span>
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-[70] mt-1 w-72 rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface)] p-2.5 shadow-[0_6px_24px_rgba(15,23,42,0.16)]">
          <div className="flex items-baseline gap-2 text-[12px] text-[var(--r-ink-strong)]">
            <span className="font-semibold">Comments</span>
            <span className="text-[var(--r-ink-muted)]">
              {summary.total} total · {summary.assigned} assigned{summary.unassigned > 0 ? ` · ${summary.unassigned} unassigned` : ''}
            </span>
          </div>

          {summary.byAgent.length === 0 ? (
            <p className="mt-2 text-[11px] text-[var(--r-ink-muted)]">
              No comments are assigned to an agent yet. Assign one with <code>@claude</code>, <code>@codex</code>, or <code>@opencode</code> in the comment text.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1">
                {summary.byAgent.map((group) => (
                  <li key={group.alias} className="flex items-start gap-1.5">
                    {confirming && !hasResults && (
                      <input
                        type="checkbox"
                        checked={included[group.alias] !== false}
                        onChange={(e) => setIncluded((m) => ({ ...m, [group.alias]: e.target.checked }))}
                        className="mt-0.5 accent-[var(--r-accent)] cursor-pointer"
                        aria-label={`Include ${ALIAS_LABEL[group.alias]}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--r-ink-strong)]">
                        {ALIAS_LABEL[group.alias]} · {group.comments.length}
                      </div>
                      <div className="truncate text-[11px] text-[var(--r-ink-muted)]">
                        {group.comments.map((c) => c.instruction || c.note).join(' · ')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {summary.unassigned > 0 && (
                <p className="mt-1.5 text-[10px] text-[var(--r-ink-faint)]">
                  Unassigned comments are never sent.
                </p>
              )}

              <div className="mt-2 border-t border-[var(--r-hairline)] pt-2">
                {hasResults ? (
                  <div className="space-y-1.5" role="status">
                    {/* One line per agent group, rendered as each answer
                        arrives. A group that failed never hides behind a
                        group that succeeded (R5). */}
                    {resultAliases.map((alias) => {
                      const line = describeGroupResult(ALIAS_LABEL[alias], groupStates[alias] as GroupSendState)
                      if (!line) return null
                      const tone =
                        line.tone === 'success' ? 'var(--r-success)'
                          : line.tone === 'error' ? 'var(--r-error)'
                            : 'var(--r-ink-muted)'
                      return (
                        <div key={alias} className="flex items-start gap-1.5 text-[12px]" style={{ color: tone }}>
                          <span aria-hidden="true" className="leading-[18px]">{line.glyph}</span>
                          <span className="min-w-0 flex-1">{line.text}</span>
                          {line.action && (
                            <Button
                              size="sm"
                              variant={line.action.kind === 'retry' ? 'default' : 'outline'}
                              onClick={() => {
                                if (line.action?.kind === 'retry') void dispatchAliases([alias], null)
                                else sendToExtension('comment:recover', { recovery: line.action?.recovery, alias })
                              }}
                            >
                              {line.action.label}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                    {settled && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setGroupStates({}); setConfirming(false); setOpen(false) }}
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                ) : confirming ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[var(--r-ink-muted)]">
                      Starts {includedTaskCount === 1 ? 'one task' : `${includedTaskCount} tasks`} ({includedCommentCount} comment{includedCommentCount === 1 ? '' : 's'}) — one per agent, in document order.
                    </div>
                    <div className="truncate text-[11px] font-medium text-[var(--r-ink-body)]">
                      {destinationCaption(destination?.title ?? null)}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        className="flex-1"
                        size="sm"
                        onClick={startDispatch}
                        disabled={includedTaskCount === 0 || sending}
                      >
                        <Icon name="check" size={12} />
                        {sending ? 'Sending…' : `Start ${includedTaskCount === 1 ? 'task' : `${includedTaskCount} tasks`}`}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => { setIncluded({}); setGroupStates({}); setConfirming(true) }}
                  >
                    <Icon name="paper-plane-right" size={12} />
                    Send assigned comments to AI
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
