/**
 * ThreadRail — Sprint 99 (R6 / R8 / R9 / R11, E6).
 *
 * A 38px vertical strip on the RIGHT edge of the AI sidebar, spanning the
 * MESSAGES AREA ONLY — the composer runs full width below it. Top to bottom:
 * "+" pinned at the top, one icon per open thread, flexible space, History
 * pinned at the bottom.
 *
 * Everything this file does NOT have is as load-bearing as what it does: no
 * dividers, no left emphasis bar, no thread names, no counts, no per-runtime
 * glyph shapes, and no wide/named-list variant at any sidebar width. Active =
 * an indigo-soft pill on the icon and nothing else (design.md §3–§4, decluttered
 * by Jarmo's 2026-07-21 decision).
 *
 * Pixel reference: `prototypes/parallel-threads.html` panel A/B.
 * All decision logic lives in `threadStatus.ts` — this file only draws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { useAISidebarStore } from './store';
import {
  canCloseThread,
  deriveThreadStatus,
  deriveThreadTitle,
  runtimeOfConversation,
  threadTooltip,
} from './threadStatus';
import type { OpenThreadSummary } from './store';

// ── Status badge ─────────────────────────────────────────────────────────

/**
 * The ONE status slot per icon (design.md §5), inside the button at the
 * bottom-right so adjacent icons' badges can never collide.
 *
 * The badge is a pure function of the thread's status, and the status function
 * already applies "amber overrides spinner" — this component never re-decides
 * priority, it just draws whatever single signal it was handed.
 */
function StatusBadge({ status, isActive }: { status: OpenThreadSummary['status']; isActive: boolean }) {
  // The badge sits on a ring of the icon's own background so it reads as a
  // separate mark rather than smudging into the glyph underneath.
  const ringColor = isActive ? 'var(--r-rail-active)' : 'var(--r-surface-muted)';

  if (status === 'attention') {
    return (
      <span
        aria-hidden
        className="absolute right-[1px] bottom-[1px] w-[8px] h-[8px] rounded-full animate-pulse"
        style={{ background: 'var(--r-warning)', boxShadow: `0 0 0 1.5px ${ringColor}` }}
      />
    );
  }
  if (status === 'running') {
    return (
      <span
        aria-hidden
        className="absolute right-0 bottom-0 w-[12px] h-[12px] rounded-full flex items-center justify-center"
        style={{ background: ringColor, boxShadow: `0 0 0 1.5px ${ringColor}`, color: 'var(--r-accent)' }}
      >
        <Icon name="circle-notch" size={12} tone="inherit" className="animate-spin" />
      </span>
    );
  }
  // Idle shows no badge at all — hover reveals the close × in this slot instead.
  return null;
}

// ── Thread icon ──────────────────────────────────────────────────────────

interface ThreadIconProps {
  thread: OpenThreadSummary;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
}

function ThreadIcon({ thread, onSelect, onClose, registerRef }: ThreadIconProps) {
  const closable = canCloseThread(thread.status, thread.hasQueuedPrompt);
  const tooltip = threadTooltip(thread.title, thread.status, thread.hasQueuedPrompt);

  return (
    <button
      ref={(el) => registerRef(thread.id, el)}
      type="button"
      onClick={() => onSelect(thread.id)}
      title={tooltip}
      aria-label={tooltip}
      aria-current={thread.isActive ? 'true' : undefined}
      data-thread-id={thread.id}
      data-thread-status={thread.status}
      className={`group relative w-[28px] h-[28px] shrink-0 flex items-center justify-center rounded-[8px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--r-surface-muted)] ${
        thread.isActive
          ? 'bg-[var(--r-rail-active)]'
          : 'hover:bg-[var(--r-surface-soft)]'
      }`}
    >
      {/* R9: one shared Phosphor `robot` for every thread, tinted by runtime.
          Recognition comes from colour; consistency from the shared glyph. */}
      <span className="flex" style={{ color: 'var(--r-accent)' }}>
        <Icon name="robot" size={14} tone="inherit" />
      </span>

      <StatusBadge status={thread.status} isActive={thread.isActive} />

      {/* R11: only an IDLE thread offers a close. A running thread — or one
          holding a queued prompt (Resolved Gap 4) — has no × at all, so
          in-flight or already-written work cannot be discarded by accident. */}
      {closable && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Close ${thread.title}`}
          title="Close thread (stays in History)"
          onClick={(e) => { e.stopPropagation(); onClose(thread.id); }}
          className="hidden group-hover:flex absolute -top-[4px] -right-[1px] w-[14px] h-[14px] rounded-full items-center justify-center z-[5] cursor-pointer bg-[var(--r-surface)] border border-[var(--r-hairline-strong)] text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)]"
        >
          <Icon name="x" size={12} tone="inherit" className="scale-[0.7]" />
        </span>
      )}
    </button>
  );
}

// ── Rail-owned action button ("+" / History) ─────────────────────────────

function RailButton({ icon, label, onClick }: { icon: 'plus' | 'clock-counter-clockwise'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative w-[28px] h-[28px] shrink-0 flex items-center justify-center rounded-[8px] text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--r-surface-muted)]"
    >
      <Icon name={icon} size={16} tone="inherit" />
    </button>
  );
}

// ── Rail ─────────────────────────────────────────────────────────────────

export function ThreadRail() {
  // Subscribe to the raw slices and derive here. Selecting `listOpenThreads()`
  // directly would hand useSyncExternalStore a fresh array on every call and
  // trip its "snapshot is not cached" loop.
  const conversations = useAISidebarStore((s) => s.conversations);
  const activeConversationId = useAISidebarStore((s) => s.activeConversationId);
  const composerQueues = useAISidebarStore((s) => s.composerQueues);
  const threads = useMemo<OpenThreadSummary[]>(
    () => Object.values(conversations)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => ({
        id: c.id,
        title: deriveThreadTitle(c),
        runtime: runtimeOfConversation(c),
        status: deriveThreadStatus(c),
        hasQueuedPrompt: !!composerQueues[c.id]?.trim(),
        isActive: c.id === activeConversationId,
      })),
    [conversations, activeConversationId, composerQueues],
  );
  const switchConversation = useAISidebarStore((s) => s.switchConversation);
  const closeConversation = useAISidebarStore((s) => s.closeConversation);
  const requestNewThread = useAISidebarStore((s) => s.requestNewThread);
  const toggleHistoryPanel = useAISidebarStore((s) => s.toggleHistoryPanel);

  const scrollRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef(new Map<string, HTMLButtonElement>());
  // Resolved Gap 7: when the rail overflows, an amber thread scrolled out of
  // view still has to be findable — a chevron appears at that rail edge. With
  // the cap at 5 and 30px icons this never fires in practice; it is a guard for
  // the "opened anyway" case, not an activity centre.
  const [offscreenAttention, setOffscreenAttention] = useState({ above: false, below: false });

  const registerRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) iconRefs.current.set(id, el);
    else iconRefs.current.delete(id);
  }, []);

  const recomputeOffscreen = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const view = scroller.getBoundingClientRect();
    let above = false;
    let below = false;
    for (const thread of threads) {
      if (thread.status !== 'attention') continue;
      const el = iconRefs.current.get(thread.id);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      if (box.bottom < view.top + 1) above = true;
      else if (box.top > view.bottom - 1) below = true;
    }
    setOffscreenAttention((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
  }, [threads]);

  useEffect(() => {
    recomputeOffscreen();
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.addEventListener('scroll', recomputeOffscreen);
    window.addEventListener('resize', recomputeOffscreen);
    return () => {
      scroller.removeEventListener('scroll', recomputeOffscreen);
      window.removeEventListener('resize', recomputeOffscreen);
    };
  }, [recomputeOffscreen]);

  return (
    <div
      // 38px, right edge, messages area only — the composer is a sibling BELOW
      // this row and spans the full sidebar width. Do not move the rail into a
      // wrapper that also contains ChatInput.
      className="relative w-[38px] shrink-0 flex flex-col items-center py-[6px] border-l border-[var(--r-hairline)] bg-[var(--r-surface-muted)]"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Agent threads"
    >
      <div className="mb-[6px]">
        <RailButton icon="plus" label="New thread" onClick={requestNewThread} />
      </div>

      {offscreenAttention.above && (
        <span aria-hidden className="absolute top-[36px] left-1/2 -translate-x-1/2 z-10" style={{ color: 'var(--r-warning)' }}>
          <Icon name="caret-up" size={12} tone="inherit" />
        </span>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 w-full flex flex-col items-center gap-[3px] overflow-y-auto"
      >
        {threads.map((thread) => (
          <ThreadIcon
            key={thread.id}
            thread={thread}
            onSelect={switchConversation}
            onClose={closeConversation}
            registerRef={registerRef}
          />
        ))}
      </div>

      {offscreenAttention.below && (
        <span aria-hidden className="absolute bottom-[36px] left-1/2 -translate-x-1/2 z-10" style={{ color: 'var(--r-warning)' }}>
          <Icon name="caret-down" size={12} tone="inherit" />
        </span>
      )}

      <div className="mt-[6px]">
        <RailButton icon="clock-counter-clockwise" label="History" onClick={toggleHistoryPanel} />
      </div>
    </div>
  );
}
