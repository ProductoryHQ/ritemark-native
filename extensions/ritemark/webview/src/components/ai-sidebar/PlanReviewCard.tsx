import { useState } from 'react';
import { Check, ClipboardList, X } from 'lucide-react';
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
      className="rounded border px-3 py-3 space-y-4"
      style={{
        background: 'var(--vscode-input-background)',
        borderColor: 'var(--vscode-panel-border)',
      }}
    >
      <div className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
        <ClipboardList size={13} className="shrink-0" />
        <span>{title}</span>
      </div>

      {displayText && (
        <div className="rounded border px-3 py-2 max-h-[300px] overflow-y-auto border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]">
          <div className="text-[10px] font-medium text-[var(--vscode-descriptionForeground)] uppercase tracking-wide mb-1.5">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          <Check size={12} />
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:opacity-80"
        >
          <X size={12} />
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
          className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] outline-none focus:border-[var(--vscode-focusBorder)]"
        />
      )}
    </div>
  );
}
