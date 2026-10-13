/**
 * QueuePanel — Sprint 104 (#162): the visible bounded prompt queue.
 *
 * Replaces the one-slot "Queued" notch. Renders the ACTIVE thread's queue only
 * (a background thread's items never appear here — they drain in the store).
 * Design: Sprint 103 card language — chrome tone, ink ladder, amber = blocked
 * on you, red only for real failures.
 */
import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { useAISidebarStore, useActiveConversation } from './store';
import { queueFor, isQueuePaused, QUEUE_CAP } from './promptQueue';
import { deriveActivityState } from './activityState';

export function QueuePanel({
  stackedUnderSelection,
  queueFullNotice,
}: {
  stackedUnderSelection: boolean;
  queueFullNotice: boolean;
}) {
  const conversation = useActiveConversation();
  const promptQueues = useAISidebarStore((s) => s.promptQueues);
  const removeQueued = useAISidebarStore((s) => s.removeQueued);
  const editQueued = useAISidebarStore((s) => s.editQueued);
  const moveQueued = useAISidebarStore((s) => s.moveQueued);
  const retryQueued = useAISidebarStore((s) => s.retryQueued);
  const resumeQueue = useAISidebarStore((s) => s.resumeQueue);

  const items = queueFor(promptQueues, conversation.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  if (items.length === 0 && !queueFullNotice) return null;

  const activityState = deriveActivityState(conversation);
  const paused = isQueuePaused(activityState, items.length);

  return (
    <div
      className={`mx-2.5 -mb-px px-2.5 py-1.5 border-[var(--r-hairline)] bg-[color:color-mix(in_srgb,var(--r-surface-muted)_60%,transparent)] ${
        stackedUnderSelection
          ? 'border-l border-r border-t'
          : 'rounded-t-lg border border-b-0'
      }`}
      role="status"
      aria-label="Queued prompts"
    >
      <div className="flex items-center gap-1.5">
        <Icon name="clock" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
        <span className="flex-1 text-[11px] font-medium text-[var(--r-ink-muted)]">
          Queued · {items.length}/{QUEUE_CAP}
        </span>
        {queueFullNotice && (
          <span className="text-[11px] text-[var(--r-warning)]">Queue full ({QUEUE_CAP})</span>
        )}
      </div>

      {/* Paused after a failed/stopped turn — explicit resume (spec R3) */}
      {paused && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--r-warning)]">
          <Icon name="warning" size={12} className="shrink-0" />
          <span className="flex-1">
            Paused — the last turn {activityState === 'failed' ? 'failed' : 'was stopped'}
          </span>
          <button
            onClick={() => resumeQueue(conversation.id)}
            className="shrink-0 rounded border border-[var(--r-hairline)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
          >
            Resume
          </button>
        </div>
      )}

      <ul className="mt-1 space-y-0.5">
        {items.map((item, index) => (
          <li key={item.id} className="group flex items-start gap-1.5">
            <span className="mt-0.5 w-3 shrink-0 text-right text-[10px] tabular-nums text-[var(--r-ink-faint)]">
              {index + 1}
            </span>
            <Icon
              name={item.source === 'card' ? 'kanban' : item.source === 'comment' ? 'note-pencil' : 'chat-circle'}
              size={12}
              className="mt-0.5 shrink-0 text-[var(--r-ink-faint)]"
            />
            {editingId === item.id ? (
              <input
                type="text"
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editText.trim()) {
                    // Composer items re-carry context inside `prompt`; an edit
                    // replaces the user text in BOTH so what runs is what reads.
                    editQueued(conversation.id, item.id, editText.trim(), editText.trim());
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-[var(--r-hairline)] bg-[var(--vscode-input-background)] px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--r-accent)]"
              />
            ) : (
              <span
                className={`min-w-0 flex-1 truncate text-[11px] leading-snug ${item.status === 'failed' ? 'text-[var(--r-error)]' : 'text-[var(--r-ink-body)]'}`}
                title={item.status === 'failed' && item.error ? item.error : item.displayText}
              >
                {item.status === 'failed' ? `Failed — ${item.error ?? 'could not send'}: ` : ''}
                {item.displayText}
              </span>
            )}
            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {item.status === 'failed' ? (
                <Tooltip label="Retry">
                  <button
                    aria-label="Retry"
                    onClick={() => retryQueued(conversation.id, item.id)}
                    className="rounded p-0.5 text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
                  >
                    <Icon name="arrow-counter-clockwise" size={12} />
                  </button>
                </Tooltip>
              ) : (
                <>
                  {/* Sprint 130 (G5): a comment's or a card's item carries the
                      prompt the host built; editing it would replace that with
                      the display text, so task items can only be removed. */}
                  {item.taskId ? null : (
                  <Tooltip label="Edit">
                    <button
                      aria-label="Edit"
                      onClick={() => { setEditingId(item.id); setEditText(item.displayText); }}
                      className="rounded p-0.5 text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
                    >
                      <Icon name="pencil-simple" size={12} />
                    </button>
                  </Tooltip>
                  )}
                  <Tooltip label="Move up">
                    <button
                      aria-label="Move up"
                      onClick={() => moveQueued(conversation.id, item.id, -1)}
                      disabled={index === 0}
                      className="rounded p-0.5 text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)] disabled:opacity-30"
                    >
                      <Icon name="caret-up" size={12} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Move down">
                    <button
                      aria-label="Move down"
                      onClick={() => moveQueued(conversation.id, item.id, 1)}
                      disabled={index === items.length - 1}
                      className="rounded p-0.5 text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)] disabled:opacity-30"
                    >
                      <Icon name="caret-down" size={12} />
                    </button>
                  </Tooltip>
                </>
              )}
              <Tooltip label="Remove">
                <button
                  aria-label="Remove"
                  onClick={() => removeQueued(conversation.id, item.id)}
                  className="rounded p-0.5 text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-error)]"
                >
                  <Icon name="x" size={12} />
                </button>
              </Tooltip>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
