/**
 * AgentResponse — rendered markdown result + files summary + collapsible activity.
 * Shows plan approval buttons when the turn is a plan awaiting review.
 * Uses --chat-font-size CSS variable for dynamic font sizing.
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
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

interface RecoveryNoticeProps {
  title: string;
  message: string;
  actionLabel: string;
  actionIcon: 'key' | 'sign-in' | 'arrow-counter-clockwise';
  actionDisabled?: boolean;
  onAction: () => void;
}

/**
 * Recoverable runtime failures are conversation cards, not form validation.
 * Keep the surface neutral and use amber only for the attention icon so the
 * notice fits the Ritemark card system without visually shouting at the user.
 */
function RecoveryNotice({
  title,
  message,
  actionLabel,
  actionIcon,
  actionDisabled = false,
  onAction,
}: RecoveryNoticeProps) {
  return (
    <div
      role="alert"
      className="overflow-hidden rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface)] shadow-[0_1px_2px_rgba(30,27,75,0.04)]"
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--r-warning-soft)] text-[var(--r-warning)]">
          <Icon name="warning" size={14} tone="inherit" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold leading-5 text-[var(--r-ink-strong)]">{title}</div>
          <div className="mt-0.5 text-[11px] leading-[1.45] text-[var(--r-ink-muted)]">{message}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center border-t border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-3 py-2 pl-[46px]">
        <Button type="button" size="sm" onClick={onAction} disabled={actionDisabled}>
          <Icon name={actionIcon} size={12} tone="inherit" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function AgentResponse({ turn }: AgentResponseProps) {
  const { result, activities } = turn;
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const requestNewThread = useAISidebarStore((s) => s.requestNewThread);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const setupInProgress = useAISidebarStore((s) => s.setupInProgress);
  const [rejectInput, setRejectInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!result) return null;

  if (result.error && (result.failureKind === 'authentication' || result.failureKind === 'api-key-authentication')) {
    const usesApiKey = result.failureKind === 'api-key-authentication';
    return (
      <div style={chatFontStyle}>
        <RecoveryNotice
          title={usesApiKey ? 'Claude API key needs attention' : 'Claude needs you to sign in again'}
          message={usesApiKey
            ? 'Claude did not accept the saved key. Update it in AI Settings, then resend your message.'
            : 'Your session expired before Claude could answer. Sign in, then resend your message.'}
          actionLabel={usesApiKey ? 'Update API key' : setupInProgress ? 'Opening sign-in…' : 'Sign in to Claude'}
          actionIcon={usesApiKey ? 'key' : 'sign-in'}
          actionDisabled={!usesApiKey && setupInProgress}
          onAction={usesApiKey ? openApiKeySettings : startLogin}
        />
        <ActivityDetails activities={activities} metrics={result.metrics} />
      </div>
    );
  }

  // Context overflow — friendly error with recovery actions
  if (result.error && isContextOverflowError(result.error)) {
    return (
      <div style={chatFontStyle}>
        <RecoveryNotice
          title="Conversation exceeded context window limit"
          message="Long conversations accumulate token usage. Starting a new chat gives the agent full context capacity."
          actionLabel="Start new chat"
          actionIcon="arrow-counter-clockwise"
          onAction={() => requestNewThread()}
        />
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

      {/* Sprint 103 design pass: the old "Modified N files · Xs" summary row is
          gone — it triple-duplicated FilesSummary (files), ActivityDetails
          (duration), and the ActivityStatusLine (both). One fact, one place. */}
      <FilesSummary files={result.filesModified} />
      <ActivityDetails activities={activities} metrics={result.metrics} />
    </div>
  );
}
