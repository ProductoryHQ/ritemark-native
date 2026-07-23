/**
 * AgentResponse — rendered markdown result + files summary + collapsible activity.
 * Shows plan approval buttons when the turn is a plan awaiting review.
 * Uses --chat-font-size CSS variable for dynamic font sizing.
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { useAISidebarStore } from './store';
import { RenderedMarkdown } from './RenderedMarkdown';
import { FilesSummary } from './FilesSummary';
import { ActivityDetails } from './ActivityDetails';
import { chatFontStyle } from './ChatBubbles';
import { extractPlanDisplayText, planTurnNeedsApproval } from './planText';
import type { AgentConversationTurn } from './types';

const OVERFLOW_PATTERNS = [
  'prompt is too long',
  'prompt too long',
  'context window',
  'context_length_exceeded',
  'too many tokens',
  'maximum context length',
  'exceeds the model',
  'token limit',
];

function isContextOverflowError(str: string): boolean {
  const lower = str.toLowerCase();
  return OVERFLOW_PATTERNS.some(p => lower.includes(p));
}

interface AgentResponseProps {
  turn: AgentConversationTurn;
}

export function AgentResponse({ turn }: AgentResponseProps) {
  const { result, activities } = turn;
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const requestNewThread = useAISidebarStore((s) => s.requestNewThread);
  const [rejectInput, setRejectInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!result) return null;

  // Context overflow — friendly error with recovery actions
  if (result.error && isContextOverflowError(result.error)) {
    return (
      <div style={chatFontStyle}>
        <div className="rounded border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] p-3 space-y-2">
          <div className="flex items-start gap-2 text-[var(--vscode-editorWarning-foreground)]">
            <Icon name="warning" size={14} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">Conversation exceeded context window limit</div>
              <div className="text-[11px] opacity-80">
                Long conversations accumulate token usage. Starting a new chat gives the agent full context capacity.
              </div>
            </div>
          </div>
          <div className="flex gap-2 ml-[22px]">
            <button
              onClick={() => requestNewThread()}
              className="flex items-center gap-1.5 rounded-md border border-[var(--r-accent-fainter)] bg-[var(--r-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--r-accent-deep)] hover:bg-[var(--r-accent-fainter)]"
            >
              <Icon name="arrow-counter-clockwise" size={12} />
              Start new chat
            </button>
          </div>
        </div>
        <ActivityDetails activities={activities} metrics={result.metrics} />
      </div>
    );
  }

  // Generic error result
  if (result.error) {
    return (
      <div style={chatFontStyle}>
        <div className="flex items-start gap-2 text-[var(--r-error)]">
          <Icon name="warning-circle" size={14} className="shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
        <ActivityDetails activities={activities} metrics={result.metrics} />
      </div>
    );
  }

  // Sprint 74 R1 (#86): approval UI renders only while the agent is actually
  // blocked waiting on ExitPlanMode (pendingPlanApproval present). The old
  // condition (`!turn.pendingPlanApproval`) showed dead Approve/Reject buttons
  // after the request was already cleared — clicking them silently did nothing.
  const needsApproval = planTurnNeedsApproval(turn);

  // Extract plan content from thinking activities (plan text arrives as 'thinking' type)
  const planText = needsApproval
    ? (turn.planText || activities
        .filter(a => a.type === 'thinking' && a.message)
        .map(a => a.message)
        .join('\n\n'))
    : '';
  const displayPlanText = extractPlanDisplayText(planText);

  // Success result
  return (
    <div style={chatFontStyle}>
      {result.text && (
        <RenderedMarkdown content={result.text} />
      )}

      {/* Plan preview card */}
      {needsApproval && displayPlanText && (
        <div className="mt-2 max-h-[300px] overflow-y-auto rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/60 px-3 py-2">
          <div className="text-[10px] font-medium text-[var(--r-ink-muted)] uppercase tracking-wide mb-1.5">Plan</div>
          <div className="text-[12px]">
            <RenderedMarkdown content={displayPlanText} />
          </div>
        </div>
      )}

      {/* Plan approval buttons */}
      {needsApproval && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => approvePlan(turn.id)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--r-accent-fainter)] bg-[var(--r-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--r-accent-deep)] hover:bg-[var(--r-accent-fainter)]"
            >
              <Icon name="check" size={12} />
              Approve plan
            </button>
            <button
              onClick={() => {
                if (showRejectInput && rejectInput.trim()) {
                  rejectPlan(turn.id, rejectInput.trim());
                } else {
                  setShowRejectInput(true);
                }
              }}
              className="flex items-center gap-1.5 rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--r-ink-body)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
            >
              <Icon name="x" size={12} />
              {showRejectInput ? 'Send feedback' : 'Reject'}
            </button>
          </div>
          {showRejectInput && (
            <input
              type="text"
              value={rejectInput}
              onChange={(e) => setRejectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rejectInput.trim()) {
                  rejectPlan(turn.id, rejectInput.trim());
                }
              }}
              placeholder="What should be different?"
              autoFocus
              className="w-full rounded-md border border-[var(--r-hairline)] bg-[var(--vscode-input-background)] px-2.5 py-1.5 text-xs text-[var(--vscode-input-foreground)] outline-none focus:border-[var(--vscode-focusBorder)]"
            />
          )}
        </div>
      )}

      {/* Approved/rejected label */}
      {turn.isPlan && turn.planHandled && (
        <div className="mt-2 text-[10px] text-[var(--r-ink-muted)] italic">
          {turn.planDecision === 'rejected' ? 'Plan sent back for revision' : 'Plan approved'}
        </div>
      )}

      {/* Summary line: files + duration + cost */}
      <div className="mt-2 text-[10px] text-[var(--r-ink-muted)] flex flex-wrap items-center gap-x-2">
        {result.filesModified.length > 0 && (
          <span>Modified {result.filesModified.length} file{result.filesModified.length !== 1 ? 's' : ''}</span>
        )}
        {result.metrics.durationMs > 0 && (
          <span>{(result.metrics.durationMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      <FilesSummary files={result.filesModified} />
      <ActivityDetails activities={activities} metrics={result.metrics} />
    </div>
  );
}
