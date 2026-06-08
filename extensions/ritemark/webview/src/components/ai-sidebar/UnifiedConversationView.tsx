/**
 * UnifiedConversationView — merged timeline for mixed-runtime conversations.
 *
 * Merges agentConversation (Claude) and codexConversation (Codex) by timestamp
 * into a single scrollable list. Each turn is rendered by its own runtime's
 * component. Replaces the AgentView / CodexView switcher in AISidebar when
 * either conversation array has turns.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useAISidebarStore } from './store';
import { AgentTurnBlock } from './AgentView';
import { CodexTurn, CompatibilityNotice, getCompatibilityNotice } from './CodexView';
import type { AgentConversationTurn, CodexConversationTurn } from './types';

type MergedTurn =
  | { runtime: 'claude'; turn: AgentConversationTurn }
  | { runtime: 'codex'; turn: CodexConversationTurn };

export function UnifiedConversationView() {
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const codexConversation = useAISidebarStore((s) => s.codexConversation);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const dismissedCodexNoticeKey = useAISidebarStore((s) => s.dismissedCodexNoticeKey);
  const dismissCodexNotice = useAISidebarStore((s) => s.dismissCodexNotice);

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

        {merged.map((item) =>
          item.runtime === 'claude' ? (
            <AgentTurnBlock
              key={item.turn.id}
              turn={item.turn}
              isMixedRuntime={isMixedRuntime}
              answerAgentQuestion={answerAgentQuestion}
              approvePlan={approvePlan}
              rejectPlan={rejectPlan}
              handleToolApproval={handleToolApproval}
            />
          ) : (
            <CodexTurn
              key={item.turn.id}
              turn={item.turn}
              isMixedRuntime={isMixedRuntime}
              onApprove={(requestId) => handleCodexApproval(requestId, true)}
              onReject={(requestId) => handleCodexApproval(requestId, false)}
              onAnswerQuestion={answerCodexQuestion}
              onApprovePlan={approveCodexPlan}
              onDiscardPlan={discardCodexPlan}
            />
          )
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
