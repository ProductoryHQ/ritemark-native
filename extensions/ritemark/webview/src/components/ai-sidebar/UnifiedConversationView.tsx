/**
 * UnifiedConversationView — merged timeline for mixed-runtime conversations.
 *
 * Merges agentConversation (Claude) and codexConversation (Codex) by timestamp
 * into a single scrollable list. Each turn is rendered by its own runtime's
 * component. Replaces the AgentView / CodexView switcher in AISidebar when
 * either conversation array has turns.
 */

import { Fragment, useRef, useEffect, useCallback } from 'react';
import { useAISidebarStore, useActiveConversation } from './store';
import { AgentTurnBlock } from './AgentView';
import { CodexTurn, CompatibilityNotice, getCompatibilityNotice } from './CodexView';
import { ActivityStatusLine } from './ActivityStatusLine';
import type { AgentConversationTurn, CodexConversationTurn } from './types';
import type {
  ConversationContinuationNotice,
  ConversationTranscriptBoundary,
} from './conversationState';
import { continuationPresentation } from './continuationPresentation';
import { Icon } from '../ui/Icon';

type MergedTurn =
  | { runtime: 'claude'; turn: AgentConversationTurn }
  | { runtime: 'codex'; turn: CodexConversationTurn };

function ContinuationNotice({
  notice,
  onDismiss,
}: {
  notice: ConversationContinuationNotice;
  onDismiss: () => void;
}) {
  const presentation = continuationPresentation(notice);
  return (
    <div
      role="status"
      className="relative rounded-r-md border border-l-[3px] border-[var(--r-hairline)] border-l-[var(--r-accent)] bg-[var(--r-surface-soft)] px-3 py-2.5 pr-9"
    >
      <div className="text-[13px] font-medium leading-[1.45] text-[var(--r-ink-strong)]">
        {presentation.title}
      </div>
      {presentation.details.map((detail) => (
        <div key={detail} className="mt-1 text-[12px] leading-[1.5] text-[var(--r-ink-muted)]">
          {detail}
        </div>
      ))}
      <button
        type="button"
        aria-label="Dismiss continuation notice"
        onClick={onDismiss}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[var(--r-ink-muted)] hover:bg-[var(--r-surface)] hover:text-[var(--r-ink-strong)] focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)]"
      >
        <Icon name="x" size={14} tone="inherit" />
      </button>
    </div>
  );
}

function TranscriptBoundary({ boundary }: { boundary: ConversationTranscriptBoundary }) {
  return (
    <div className="flex items-start gap-2 px-1 py-1.5 text-[12px] leading-[1.5] text-[var(--r-ink-muted)]">
      <span className="mt-0.5 shrink-0 text-[var(--r-accent)]">
        <Icon name="clock-counter-clockwise" size={14} tone="inherit" />
      </span>
      <span>{boundary.message}</span>
    </div>
  );
}

export function UnifiedConversationView() {
  const activeConversation = useActiveConversation();
  const {
    agentConversation,
    codexConversation,
    continuationNotice,
    transcriptBoundaries,
  } = activeConversation;
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const dismissedCodexNoticeKey = useAISidebarStore((s) => s.dismissedCodexNoticeKey);
  const dismissCodexNotice = useAISidebarStore((s) => s.dismissCodexNotice);
  const dismissContinuationNotice = useAISidebarStore((s) => s.dismissContinuationNotice);

  // Claude actions
  const answerAgentQuestion = useAISidebarStore((s) => s.answerAgentQuestion);
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const handleToolApproval = useAISidebarStore((s) => s.handleAgentToolApproval);

  // Codex actions
  const handleCodexApproval = useAISidebarStore((s) => s.handleCodexApproval);
  const answerCodexQuestion = useAISidebarStore((s) => s.answerCodexQuestion);
  const approveCodexPlan = useAISidebarStore((s) => s.approveCodexPlan);
  const discardCodexPlan = useAISidebarStore((s) => s.discardCodexPlan);

  const isMixedRuntime = agentConversation.length > 0 && codexConversation.length > 0;

  const merged: MergedTurn[] = [
    ...agentConversation.map((turn): MergedTurn => ({ runtime: 'claude', turn })),
    ...codexConversation.map((turn): MergedTurn => ({ runtime: 'codex', turn })),
  ].sort((a, b) => a.turn.timestamp - b.turn.timestamp);

  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const lastMerged = merged[merged.length - 1];
  const lastAgentTurn = lastMerged?.runtime === 'claude' ? lastMerged.turn : undefined;
  const lastCodexTurn = lastMerged?.runtime === 'codex' ? lastMerged.turn : undefined;

  useEffect(() => {
    scrollToBottom();
  }, [
    merged.length,
    lastAgentTurn?.activities.length,
    lastAgentTurn?.pendingQuestion,
    lastAgentTurn?.pendingPlanApproval,
    lastAgentTurn?.result,
    lastCodexTurn?.activities.length,
    lastCodexTurn?.pendingQuestion,
    lastCodexTurn?.result,
    scrollToBottom,
  ]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledRef.current = !atBottom;
  }, []);

  const compatibilityNotice = getCompatibilityNotice(codexStatus);
  const showCompatibilityNotice =
    codexConversation.length > 0 &&
    compatibilityNotice !== null &&
    dismissedCodexNoticeKey !== compatibilityNotice.key;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
      >
        {showCompatibilityNotice && compatibilityNotice && (
          <CompatibilityNotice
            title={compatibilityNotice.title}
            message={compatibilityNotice.message}
            bullets={compatibilityNotice.bullets}
            onDismiss={() => dismissCodexNotice(compatibilityNotice.key)}
          />
        )}

        {merged.map((item, index) => {
          const boundaries = transcriptBoundaries.filter((boundary) => boundary.turnId === item.turn.id);
          const showLiveNotice = continuationNotice
            && (continuationNotice.turnId === item.turn.id
              || (!continuationNotice.turnId && index === merged.length - 1));
          return (
            <Fragment key={`${item.runtime}:${item.turn.id}`}>
              {boundaries.map((boundary) => (
                <TranscriptBoundary key={boundary.id} boundary={boundary} />
              ))}
              {showLiveNotice && (
                <ContinuationNotice
                  notice={continuationNotice}
                  onDismiss={() => dismissContinuationNotice(activeConversation.id)}
                />
              )}
              {item.runtime === 'claude' ? (
                <AgentTurnBlock
                  turn={item.turn}
                  isMixedRuntime={isMixedRuntime}
                  answerAgentQuestion={answerAgentQuestion}
                  approvePlan={approvePlan}
                  rejectPlan={rejectPlan}
                  handleToolApproval={handleToolApproval}
                />
              ) : (
                <CodexTurn
                  turn={item.turn}
                  isMixedRuntime={isMixedRuntime}
                  onApprove={(requestId) => handleCodexApproval(requestId, true)}
                  onReject={(requestId) => handleCodexApproval(requestId, false)}
                  onAnswerQuestion={answerCodexQuestion}
                  onApprovePlan={approveCodexPlan}
                  onDiscardPlan={discardCodexPlan}
                />
              )}
            </Fragment>
          );
        })}

        {transcriptBoundaries
          .filter((boundary) => !merged.some((item) => item.turn.id === boundary.turnId))
          .map((boundary) => <TranscriptBoundary key={boundary.id} boundary={boundary} />)}

        {/* Sprint 103 R7: single truthful status line under the transcript. */}
        {merged.length > 0 && <ActivityStatusLine />}

        <div ref={endRef} />
      </div>
    </div>
  );
}
