/**
 * AgentResponse — rendered markdown result + files summary + collapsible activity.
 * Shows plan approval buttons when the turn is a plan awaiting review.
 */

import { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { useAISidebarStore } from './store';
import { RenderedMarkdown } from './RenderedMarkdown';
import { FilesSummary } from './FilesSummary';
import { ActivityDetails } from './ActivityDetails';
import type { AgentConversationTurn } from './types';

interface AgentResponseProps {
  turn: AgentConversationTurn;
}

export function AgentResponse({ turn }: AgentResponseProps) {
  const { result, activities } = turn;
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const [rejectInput, setRejectInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!result) return null;

  // Error result
  if (result.error) {
    return (
      <div>
        <div className="flex items-start gap-2 text-xs text-[var(--vscode-errorForeground)]">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
        <ActivityDetails activities={activities} metrics={result.metrics} />
      </div>
    );
  }

  const needsApproval = turn.isPlan && !turn.planHandled;

  // Success result
  return (
    <div>
      {result.text && (
        <RenderedMarkdown content={result.text} />
      )}

      {/* Plan approval buttons */}
      {needsApproval && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => approvePlan(turn.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              <Check size={12} />
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:opacity-80"
            >
              <X size={12} />
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
              className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] outline-none focus:border-[var(--vscode-focusBorder)]"
            />
          )}
        </div>
      )}

      {/* Approved/rejected label */}
      {turn.isPlan && turn.planHandled && (
        <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)] italic">
          Plan approved
        </div>
      )}

      {/* Summary line: files + duration + cost */}
      <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)] flex flex-wrap items-center gap-x-2">
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
