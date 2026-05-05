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
      className="rounded-lg border px-3 py-3 space-y-3 bg-[var(--vscode-input-background)]/80 shadow-[0_1px_2px_rgba(30,27,75,0.04)]"
      style={{ borderColor: 'var(--r-hairline)' }}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--r-ink-muted)]">
        <Icon name="clipboard-text" size={14} className="shrink-0" />
        <span>{title}</span>
      </div>

      {displayText && (
        <div className="max-h-[300px] overflow-y-auto rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/60 px-3 py-2">
          <div className="text-[10px] font-medium text-[var(--r-ink-muted)] uppercase tracking-wide mb-1.5">
            Plan
          </div>
          <div style={{ fontSize: 'var(--chat-font-size, 13px)' }}>
            <RenderedMarkdown content={displayText} />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 rounded-md border border-[var(--r-accent-fainter)] bg-[var(--r-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--r-accent-deep)] hover:bg-[var(--r-accent-fainter)]"
        >
          <Icon name="check" size={12} />
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
          className="flex items-center gap-1.5 rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
        >
          <Icon name="x" size={12} />
          {allowFeedback && showRejectInput ? 'Send feedback' : rejectLabel}
        </button>
      </div>

      {allowFeedback && showRejectInput && (
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
      )}
    </div>
  );
}
