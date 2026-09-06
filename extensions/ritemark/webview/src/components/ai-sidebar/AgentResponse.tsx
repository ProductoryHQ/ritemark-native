/**
 * AgentResponse — rendered markdown result + files summary + collapsible activity.
 * Shows plan approval buttons when the turn is a plan awaiting review.
 * Uses --chat-font-size CSS variable for dynamic font sizing.
 */

import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { useActiveConversation, useAISidebarStore } from './store';
import { RenderedMarkdown } from './RenderedMarkdown';
import { FilesSummary } from './FilesSummary';
import { ActivityDetails } from './ActivityDetails';
import { chatFontStyle } from './ChatBubbles';
import { extractPlanDisplayText, planTurnNeedsApproval } from './planText';
import { RuntimeNotice } from './RuntimeNotice';
import {
  deriveRuntimeAvailabilities,
  listReadyAlternatives,
  resolveAvailableRuntimeModel,
  RUNTIME_LABELS,
} from './runtimeAvailability';

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
  tone?: 'warning' | 'progress' | 'success' | 'error';
  actionLabel?: string;
  actionIcon?: 'key' | 'sign-in' | 'arrow-counter-clockwise' | 'check';
  statusLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

function RecoveryNotice({
  title,
  message,
  tone = 'warning',
  actionLabel,
  actionIcon,
  statusLabel,
  actionDisabled = false,
  onAction,
}: RecoveryNoticeProps) {
  return (
    <RuntimeNotice
      title={title}
      message={message}
      tone={tone}
      statusLabel={statusLabel}
      primaryAction={actionLabel && actionIcon && onAction ? {
        label: actionLabel,
        icon: actionIcon,
        onAction,
        disabled: actionDisabled,
      } : undefined}
    />
  );
}

export function AgentResponse({ turn }: AgentResponseProps) {
  const { result, activities } = turn;
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const requestNewThread = useAISidebarStore((s) => s.requestNewThread);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const claudeLoginState = useAISidebarStore((s) => s.claudeLoginState);
  const claudeLoginTurnId = useAISidebarStore((s) => s.claudeLoginTurnId);
  const setupError = useAISidebarStore((s) => s.setupError);
  const dismissedAuthRecoveryTurnIds = useAISidebarStore((s) => s.dismissedAuthRecoveryTurnIds);
  const dismissAuthRecovery = useAISidebarStore((s) => s.dismissAuthRecovery);
  const runtimeHydration = useAISidebarStore((s) => s.runtimeHydration);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const opencodeEnabled = useAISidebarStore((s) => s.opencodeEnabled);
  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const selectRuntimeModel = useAISidebarStore((s) => s.selectRuntimeModel);
  const activeConversation = useActiveConversation();
  const [rejectInput, setRejectInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const availabilities = deriveRuntimeAvailabilities({
    runtimeHydration,
    setupStatus,
    codexStatus,
    opencodeEnabled,
    acpProviders,
    byokProviderModels,
  });
  const alternativeCandidate = listReadyAlternatives(availabilities, 'claude-code')[0] ?? null;
  const alternativeModelId = alternativeCandidate
    ? resolveAvailableRuntimeModel(alternativeCandidate, {
        claude: activeConversation.selectedModel,
        codex: activeConversation.codexSelectedModel,
        opencode: activeConversation.opencodeSelectedModel,
      }, {
        claude: models,
        codex: codexModels,
        opencode: byokProviderModels,
        acpProviders,
      }) ?? ''
    : '';
  const readyAlternative = alternativeCandidate && alternativeModelId
    ? alternativeCandidate
    : null;

  if (!result) return null;

  if (result.error && (result.failureKind === 'authentication' || result.failureKind === 'api-key-authentication')) {
    const usesApiKey = result.failureKind === 'api-key-authentication';
    const isActiveLoginTurn = !usesApiKey && claudeLoginTurnId === turn.id;

    if (!usesApiKey && dismissedAuthRecoveryTurnIds.includes(turn.id)) {
      return null;
    }

    if (isActiveLoginTurn && claudeLoginState === 'pending') {
      return (
        <div style={chatFontStyle}>
          <RecoveryNotice
            tone="progress"
            title="Finish signing in in your browser"
            message="Ritemark is waiting for Claude. This card will update automatically when sign-in is complete."
            statusLabel="Waiting for sign-in…"
          />
        </div>
      );
    }

    if (isActiveLoginTurn && claudeLoginState === 'success') {
      return (
        <div style={chatFontStyle}>
          <RecoveryNotice
            tone="success"
            title="You’re signed in to Claude"
            message="You can continue this conversation now. Resend your last message when you’re ready."
            actionLabel="OK"
            actionIcon="check"
            onAction={() => dismissAuthRecovery(turn.id)}
          />
        </div>
      );
    }

    if (isActiveLoginTurn && claudeLoginState === 'error') {
      return (
        <div style={chatFontStyle}>
          <RecoveryNotice
            tone="error"
            title="Claude sign-in didn’t finish"
            message={setupError || 'Ritemark could not confirm the sign-in. Please try again.'}
            actionLabel="Try again"
            actionIcon="arrow-counter-clockwise"
            onAction={() => startLogin(turn.id)}
          />
        </div>
      );
    }

    return (
      <div style={chatFontStyle}>
        <RuntimeNotice
          title={usesApiKey ? 'Claude API key needs attention' : 'Claude needs you to sign in again'}
          message={usesApiKey
            ? 'Claude did not accept the saved key. Update it in AI Settings, then resend your message.'
            : 'Your session expired before Claude could answer. Sign in again or continue with another available agent.'}
          secondaryAction={readyAlternative ? {
              label: usesApiKey ? 'Update key' : 'Sign in',
              icon: usesApiKey ? 'key' as const : 'sign-in' as const,
              onAction: usesApiKey ? openApiKeySettings : () => startLogin(turn.id),
            } : undefined}
          primaryAction={readyAlternative ? {
              label: `Use ${RUNTIME_LABELS[readyAlternative]}`,
              icon: 'chat-circle' as const,
              onAction: () => selectRuntimeModel(readyAlternative, alternativeModelId),
            } : {
                label: usesApiKey ? 'Update API key' : 'Sign in to Claude',
                icon: usesApiKey ? 'key' as const : 'sign-in' as const,
                onAction: usesApiKey ? openApiKeySettings : () => startLogin(turn.id),
              }}
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
