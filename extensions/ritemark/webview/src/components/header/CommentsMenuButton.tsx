/**
 * CommentsMenuButton — Sprint 105 (#164): the document-level comments entry.
 *
 * Toolbar button with the unique-comment count badge; opens a compact overview
 * (totals + per-agent groups) whose one action — **Send assigned comments to
 * AI** — dispatches ONE ordered task per included agent through the Sprint 104
 * queue. Dispatch-only: no comment is resolved, deleted, or edited here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { sendToExtension } from '../../bridge'
import {
  collectDocumentComments,
  summarizeComments,
  buildAgentTaskPrompt,
  type CommentSummary,
  type MinimalNode,
} from '../../extensions/comment/commentIndex'
import { ALIAS_TO_AGENT_ID, type CommentAgentAlias } from '../../extensions/comment/commentModel'

const AGENT_LABEL: Record<CommentAgentAlias, string> = {
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
}

export function CommentsMenuButton({ getEditor }: { getEditor: () => TipTapEditor | null }) {
  const [summary, setSummary] = useState<CommentSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [dispatched, setDispatched] = useState(false)
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
        setOpen(false); setConfirming(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!summary || summary.total === 0) return null

  const includedGroups = summary.byAgent.filter((g) => included[g.alias] !== false)
  const includedTaskCount = includedGroups.length
  const includedCommentCount = includedGroups.reduce((n, g) => n + g.comments.length, 0)

  const dispatch = () => {
    const editor = getEditor()
    if (!editor) return
    for (const group of includedGroups) {
      const agentId = ALIAS_TO_AGENT_ID[group.alias]
      const prompt = buildAgentTaskPrompt('the active document', group.comments)
      sendToExtension('comment:send-to-ai', {
        agentId,
        prompt,
        commentIds: group.comments.map((c) => c.commentId).filter((id): id is string => !!id),
      })
    }
    setDispatched(true)
    window.setTimeout(() => {
      setDispatched(false); setConfirming(false); setOpen(false)
    }, 1800)
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="toolbar"
        size="icon-sm"
        data-state={open ? 'active' : undefined}
        aria-pressed={open}
        aria-label={`Comments (${summary.total})`}
        onClick={() => { setOpen((o) => !o); setConfirming(false); recompute() }}
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
                    {confirming && (
                      <input
                        type="checkbox"
                        checked={included[group.alias] !== false}
                        onChange={(e) => setIncluded((m) => ({ ...m, [group.alias]: e.target.checked }))}
                        className="mt-0.5 accent-[var(--r-accent)]"
                        aria-label={`Include ${AGENT_LABEL[group.alias]}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--r-ink-strong)]">
                        {AGENT_LABEL[group.alias]} · {group.comments.length}
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
                {dispatched ? (
                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--r-success)]">
                    <Icon name="check" size={12} />
                    Queued {includedTaskCount === 1 ? '1 task' : `${includedTaskCount} tasks`} — comments stay in the document
                  </div>
                ) : confirming ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[var(--r-ink-muted)]">
                      Starts {includedTaskCount === 1 ? 'one task' : `${includedTaskCount} tasks`} ({includedCommentCount} comment{includedCommentCount === 1 ? '' : 's'}) — one per agent, in document order.
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={dispatch}
                        disabled={includedTaskCount === 0}
                        className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white bg-[var(--r-accent)] hover:bg-[var(--r-accent-deep)] shadow-[0_4px_6px_-1px_rgba(67,56,202,0.25)] disabled:opacity-50"
                      >
                        <Icon name="check" size={12} className="text-white" />
                        Start {includedTaskCount === 1 ? 'task' : `${includedTaskCount} tasks`}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="rounded-md border border-[var(--r-hairline)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)]"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIncluded({}); setConfirming(true) }}
                    className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white bg-[var(--r-accent)] hover:bg-[var(--r-accent-deep)] shadow-[0_4px_6px_-1px_rgba(67,56,202,0.25)]"
                  >
                    <Icon name="paper-plane-right" size={12} className="text-white" />
                    Send assigned comments to AI
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
