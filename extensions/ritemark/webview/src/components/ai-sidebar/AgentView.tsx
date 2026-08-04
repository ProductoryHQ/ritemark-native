/**
 * AgentView — Claude Code agent conversation thread.
 */

import { useRef, useEffect, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import { useAISidebarStore, useActiveConversation } from './store';
import { EmptyState } from './EmptyState';
import { RunningIndicator } from './RunningIndicator';
import { AgentResponse } from './AgentResponse';
import { AgentQuestion } from './AgentQuestion';
import { AgentPlanApproval } from './AgentPlanApproval';
import { ApprovalCard } from './CodexView';
import { SubagentCard } from './SubagentCard';
import { UserPromptBubble } from './ChatBubbles';
import type { AgentConversationTurn, AgentProgress } from './types';

// ── Per-turn block ─────────────────────────────────────────────────────────────

export function AgentTurnBlock({
  turn,
  isMixedRuntime,
  answerAgentQuestion,
  approvePlan,
  rejectPlan,
  handleToolApproval,
}: {
  turn: AgentConversationTurn;
  isMixedRuntime: boolean;
  answerAgentQuestion: (turnId: string, question: NonNullable<AgentConversationTurn['pendingQuestion']>, answers: Record<string, string>) => void;
  approvePlan: (turnId: string) => void;
  rejectPlan: (turnId: string) => void;
  handleToolApproval: (requestId: string, approved: boolean) => void;
}) {
  const compactedEvent = turn.activities.find((a: AgentProgress) => a.type === 'compacted');
  // Sprint 103 R4: model-initiated planning is a first-class labeled event.
  const autonomousPlanEvent = turn.activities.find((a: AgentProgress) => a.type === 'plan_autonomous');
  // Sprint 103 R3: a genuine session rebuild is announced, never silent.
  const sessionResetEvent = turn.activities.find((a: AgentProgress) => a.type === 'session_reset');

  return (
    <div className="space-y-2">
      {/* Session reset divider (R3) */}
      {sessionResetEvent && (
        <div className="flex items-center gap-2 select-none text-[11px] text-[var(--r-ink-faint)]">
          <span className="h-px flex-1 bg-[var(--r-hairline)]" />
          <span>{sessionResetEvent.message}</span>
          <span className="h-px flex-1 bg-[var(--r-hairline)]" />
        </div>
      )}

      {/* Compaction banner — shown above the turn where compaction happened */}
      {compactedEvent && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded border border-[var(--r-hairline)] bg-[var(--vscode-editorWidget-background)]" style={{ fontSize: 'var(--chat-font-size, 13px)' }}>
          <Icon name="arrows-clockwise" size={14} className="shrink-0 mt-0.5 text-[var(--r-ink-muted)]" />
          <span className="text-[var(--r-ink-muted)]">
            {compactedEvent.message}
          </span>
        </div>
      )}

      {/* Runtime provenance — only in mixed-runtime conversations */}
      {isMixedRuntime && (
        <div className="flex items-center gap-1 text-[10px] text-[var(--r-ink-faint)] select-none">
          <Icon name="robot" size={12} />
          <span>Claude{turn.result?.metrics?.model ? ` · ${turn.result.metrics.model}` : ''}</span>
        </div>
      )}

      {/* User prompt */}
      <UserPromptBubble attachments={turn.attachments} activeFilePath={turn.activeFilePath}>
        {turn.userPrompt}
      </UserPromptBubble>

      {/* Subagents (rendered during running and after) */}
      {turn.subagents && turn.subagents.length > 0 && (
        <div className="space-y-1">
          {turn.subagents.map((subagent) => (
            <SubagentCard key={subagent.id} subagent={subagent} />
          ))}
        </div>
      )}

      {/* Pending question */}
      {turn.pendingQuestion && (
        <AgentQuestion turnId={turn.id} question={turn.pendingQuestion} onAnswer={answerAgentQuestion} />
      )}

      {/* Autonomous-plan attribution chip (R4) — precedes the plan card */}
      {autonomousPlanEvent && (turn.pendingPlanApproval || turn.isPlan) && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--r-ink-muted)] select-none">
          <Icon name="clipboard-text" size={12} />
          <span>Claude chose to plan first</span>
        </div>
      )}

      {turn.pendingPlanApproval && (
        <AgentPlanApproval
          turnId={turn.id}
          planText={turn.planText || ''}
          provenance={autonomousPlanEvent ? 'Claude chose to plan first' : 'Requested by you · Plan'}
          enforcementNote="No files changed yet."
          onApprove={approvePlan}
          onReject={rejectPlan}
        />
      )}

      {/* Ask-mode file-write / shell-command approval (unified gate) */}
      {turn.approval && (
        <ApprovalCard
          approval={turn.approval}
          onApprove={(id) => handleToolApproval(String(id), true)}
          onReject={(id) => handleToolApproval(String(id), false)}
          agentLabel="Claude"
        />
      )}

      {turn.isRunning && !turn.pendingQuestion && !turn.pendingPlanApproval && !turn.approval && (
        <RunningIndicator activities={turn.activities} subagents={turn.subagents} />
      )}

      {/* Result */}
      {turn.result && <AgentResponse turn={turn} />}
    </div>
  );
}

// ── View (empty state + scroll container) ──────────────────────────────────────

export function AgentView() {
  const { agentConversation, codexConversation } = useActiveConversation();
  const isMixedRuntime = codexConversation.length > 0;
  const sendAgentMessage = useAISidebarStore((s) => s.sendAgentMessage);
  const answerAgentQuestion = useAISidebarStore((s) => s.answerAgentQuestion);
  const approvePlan = useAISidebarStore((s) => s.approvePlan);
  const rejectPlan = useAISidebarStore((s) => s.rejectPlan);
  const handleToolApproval = useAISidebarStore((s) => s.handleAgentToolApproval);

  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const lastTurn = agentConversation[agentConversation.length - 1];
  useEffect(() => {
    scrollToBottom();
  }, [agentConversation.length, lastTurn?.activities.length, lastTurn?.pendingQuestion, lastTurn?.pendingPlanApproval, lastTurn?.result, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledRef.current = !atBottom;
  }, []);

  if (agentConversation.length === 0) {
    return <EmptyState variant="agent" onPrompt={sendAgentMessage} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
      >
        {agentConversation.map((turn) => (
          <AgentTurnBlock
            key={turn.id}
            turn={turn}
            isMixedRuntime={isMixedRuntime}
            answerAgentQuestion={answerAgentQuestion}
            approvePlan={approvePlan}
            rejectPlan={rejectPlan}
            handleToolApproval={handleToolApproval}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
