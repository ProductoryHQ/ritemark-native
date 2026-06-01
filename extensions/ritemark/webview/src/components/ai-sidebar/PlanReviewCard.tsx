/**
 * PlanReviewCard — flat plan-approval card (Sprint 74, R1 / issue #86).
 *
 * Claude's response artifact: lives in the chat feed, never in the composer
 * area. Single-level card — indigo-tinted header, flat markdown body, action
 * footer. No nested inner cards.
 *
 * Design source of truth:
 * docs/development/sprints/sprint-74-ai-sidebar-composer-polish/prototypes/plan-review-card.html (Column B)
 */
import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { RenderedMarkdown } from './RenderedMarkdown';
import { extractPlanDisplayText } from './planText';

interface PlanReviewCardProps {
  title: string;
  planText: string;
  approveLabel: string;
  rejectLabel: string;
  rejectPlaceholder?: string;
  allowFeedback?: boolean;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function PlanReviewCard({
  title,
  planText,
  approveLabel,
  rejectLabel,
  rejectPlaceholder = 'What should be different?',
  allowFeedback = false,
  onApprove,
  onReject,
}: PlanReviewCardProps) {
  const [rejectInput, setRejectInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const displayText = extractPlanDisplayText(planText);

  return (
    <div
      className="rounded-lg border overflow-hidden bg-[var(--vscode-input-background)]/80"
      style={{ borderColor: 'rgba(67,56,202,0.18)' }}
    >
      {/* Header — indigo tinted, pulse dot signals the agent is waiting */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--r-accent)]"
        style={{
          background: 'rgba(224,231,255,0.35)',
          borderBottom: '1px solid rgba(67,56,202,0.10)',
        }}
      >
        <Icon name="clipboard-text" size={12} className="shrink-0" />
        <span className="flex-1">{title}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--r-accent)] animate-pulse shrink-0" />
      </div>

      {/* Body — full plan text, flat (no inner card) */}
      {displayText && (
        <div
          className="px-2.5 py-2 max-h-[300px] overflow-y-auto"
          style={{ fontSize: 'var(--chat-font-size, 13px)' }}
        >
          <RenderedMarkdown content={displayText} />
        </div>
      )}

      {/* Reject feedback input */}
      {allowFeedback && showRejectInput && (
        <div className="px-2.5 pb-2">
          <input
            type="text"
            value={rejectInput}
            onChange={(e) => setRejectInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onReject(rejectInput.trim() || undefined);
              }
            }}
            placeholder={rejectPlaceholder}
            autoFocus
            className="w-full rounded-md border border-[var(--r-hairline)] bg-[var(--vscode-input-background)] px-2.5 py-1.5 text-xs text-[var(--vscode-input-foreground)] outline-none focus:border-[var(--vscode-focusBorder)]"
          />
        </div>
      )}

      {/* Actions — Approve is the primary indigo CTA */}
      <div
        className="flex items-center gap-2 px-2.5 py-2"
        style={{ borderTop: '1px solid rgba(67,56,202,0.08)' }}
      >
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white bg-[var(--r-accent)] hover:bg-[var(--r-accent-deep)] shadow-[0_4px_6px_-1px_rgba(67,56,202,0.25)] active:scale-[0.98] transition-transform"
        >
          <Icon name="check" size={12} className="text-white" />
          {approveLabel}
        </button>
        <button
          onClick={() => {
            if (allowFeedback && showRejectInput) {
              onReject(rejectInput.trim() || undefined);
              return;
            }
            if (allowFeedback) {
              setShowRejectInput(true);
              return;
            }
            onReject();
          }}
          className="flex items-center gap-1.5 rounded-md border border-[var(--r-hairline)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
        >
          <Icon name="x" size={12} />
          {allowFeedback && showRejectInput ? 'Send feedback' : rejectLabel}
        </button>
      </div>
    </div>
  );
}
