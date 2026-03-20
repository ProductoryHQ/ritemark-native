/**
 * CodexView — Codex agent conversation panel.
 *
 * Renders streaming responses from the Codex app-server,
 * shows tool use activities (collapsed by default), and handles
 * approval dialogs for shell commands and file changes.
 */

import { useRef, useEffect, useState } from 'react';
import { useAISidebarStore } from './store';
import { Terminal, FileCode, Loader2, Check, X, AlertTriangle, ChevronRight, Wrench } from 'lucide-react';
import { UserPromptBubble, AIResponseBubble } from './ChatBubbles';
import { RunningIndicator } from './RunningIndicator';
import { AgentQuestion } from './AgentQuestion';
import { PlanReviewCard } from './PlanReviewCard';
import { RenderedMarkdown } from './RenderedMarkdown';
import { extractPlanDisplayText } from './planText';
import type { CodexConversationTurn, AgentProgress, CodexSidebarStatus } from './types';

export function CodexView() {
  const codexConversation = useAISidebarStore((s) => s.codexConversation);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const dismissedCodexNoticeKey = useAISidebarStore((s) => s.dismissedCodexNoticeKey);
  const dismissCodexNotice = useAISidebarStore((s) => s.dismissCodexNotice);
  const handleCodexApproval = useAISidebarStore((s) => s.handleCodexApproval);
  const answerCodexQuestion = useAISidebarStore((s) => s.answerCodexQuestion);
  const approveCodexPlan = useAISidebarStore((s) => s.approveCodexPlan);
  const discardCodexPlan = useAISidebarStore((s) => s.discardCodexPlan);
  const scrollRef = useRef<HTMLDivElement>(null);
  const compatibilityNotice = getCompatibilityNotice(codexStatus);
  const showCompatibilityNotice = compatibilityNotice && dismissedCodexNoticeKey !== compatibilityNotice.key;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [codexConversation]);

  if (codexConversation.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          {showCompatibilityNotice && (
            <div className="mb-4 text-left">
              <CompatibilityNotice
                title={compatibilityNotice.title}
                message={compatibilityNotice.message}
                bullets={compatibilityNotice.bullets}
                onDismiss={() => dismissCodexNotice(compatibilityNotice.key)}
              />
            </div>
          )}
          <Terminal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium opacity-70">Codex Agent</p>
          <p className="text-xs opacity-50 mt-1">
            OpenAI coding agent with ChatGPT authentication.
            Type a message to start.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      {showCompatibilityNotice && (
        <CompatibilityNotice
          title={compatibilityNotice.title}
          message={compatibilityNotice.message}
          bullets={compatibilityNotice.bullets}
          onDismiss={() => dismissCodexNotice(compatibilityNotice.key)}
        />
      )}
      {codexConversation.map((turn) => (
        <CodexTurn
          key={turn.id}
          turn={turn}
          onApprove={(requestId) => handleCodexApproval(requestId, true)}
          onReject={(requestId) => handleCodexApproval(requestId, false)}
          onAnswerQuestion={answerCodexQuestion}
          onApprovePlan={approveCodexPlan}
          onDiscardPlan={discardCodexPlan}
        />
      ))}
    </div>
  );
}

function getCompatibilityNotice(status: CodexSidebarStatus): {
  key: string;
  title: string;
  message: string;
  bullets: string[];
} | null {
  const compatibility = status.compatibility;
  if (status.state !== 'ready' || !compatibility || compatibility.state === 'compatible') {
    return null;
  }

  const capabilities = compatibility.capabilities;
  const bullets = [
    `Approvals: ${capabilities.approvals ? 'available' : 'not detected'}`,
    `Ask questions: ${capabilities.requestUserInput ? 'available' : 'not detected'}`,
    `Plan updates: ${capabilities.planUpdates ? 'available' : 'not detected'}`,
    ...compatibility.limitations,
  ];

  return {
    key: [
      status.version ?? 'unknown',
      compatibility.state,
      capabilities.approvals ? 'approvals' : 'no-approvals',
      capabilities.requestUserInput ? 'question' : 'no-question',
      capabilities.planUpdates ? 'plan' : 'no-plan',
    ].join(':'),
    title: compatibility.state === 'untested'
      ? 'Codex version not yet audited'
      : 'Codex session is running with limits',
    message: compatibility.summary,
    bullets,
  };
}

function CodexTurn({
  turn,
  onApprove,
  onReject,
  onAnswerQuestion,
  onApprovePlan,
  onDiscardPlan,
}: {
  turn: CodexConversationTurn;
  onApprove: (requestId: string | number) => void;
  onReject: (requestId: string | number) => void;
  onAnswerQuestion: (turnId: string, question: NonNullable<CodexConversationTurn['pendingQuestion']>, answers: Record<string, string>) => void;
  onApprovePlan: (turnId: string) => void;
  onDiscardPlan: (turnId: string) => void;
}) {
  const hasActivities = turn.activities.length > 0;
  const lastActivity = hasActivities ? turn.activities[turn.activities.length - 1] : null;
  const rawPlanText = turn.planText || ((turn.result && !turn.result.error) ? turn.streamingText : '');
  const displayPlanText = extractPlanDisplayText(rawPlanText);
  const showPlanCard = Boolean((turn.planSteps && turn.planSteps.length > 0) || displayPlanText);
  const needsPlanReview = Boolean(showPlanCard && turn.result && !turn.result.error && turn.requiresPlanReview && !turn.planHandled);
  const shouldHideStreamingBubble = Boolean(displayPlanText)
    && turn.streamingText.trim().length > 0
    && rawPlanText.trim() === turn.streamingText.trim();

  return (
    <div className="space-y-2">
      {/* User message */}
      <UserPromptBubble attachments={turn.attachments} activeFilePath={turn.activeFilePath}>
        {turn.userPrompt}
      </UserPromptBubble>

      {/* Collapsible activities */}
      {hasActivities && (
        <ActivitySection
          activities={turn.activities}
          isRunning={turn.isRunning}
          lastActivity={lastActivity}
        />
      )}

      {/* Approval dialog */}
      {turn.approval && (
        <ApprovalCard
          approval={turn.approval}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {turn.pendingQuestion && (
        <AgentQuestion
          turnId={turn.id}
          question={{
            toolUseId: String(turn.pendingQuestion.requestId),
            questions: turn.pendingQuestion.questions,
          }}
          providerLabel="Codex"
          onAnswer={(turnId, _question, answers) => onAnswerQuestion(turnId, turn.pendingQuestion!, answers)}
        />
      )}

      {showPlanCard && !needsPlanReview && (
        <PlanCard explanation={turn.planExplanation} planSteps={turn.planSteps} planText={displayPlanText} />
      )}

      {needsPlanReview && (
        <PlanReviewCard
          title="Codex is waiting for plan review"
          planText={rawPlanText}
          approveLabel="Approve & continue"
          rejectLabel="Discard"
          onApprove={() => onApprovePlan(turn.id)}
          onReject={() => onDiscardPlan(turn.id)}
        />
      )}

      {/* Streaming text */}
      {turn.streamingText && !shouldHideStreamingBubble && (
        <AIResponseBubble content={turn.streamingText} />
      )}

      {/* Running indicator (only if no activities or approval to show) */}
      {turn.isRunning && !hasActivities && !turn.approval && !turn.streamingText && (
        <RunningIndicator activities={turn.activities} />
      )}

      {/* Error */}
      {turn.result?.error && (
        <div className="flex items-start gap-2 text-xs text-[var(--vscode-testing-iconFailed)] pl-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{turn.result.error}</span>
        </div>
      )}

      {/* Success */}
      {turn.result && !turn.result.error && turn.result.status === 'completed' && (
        <div className="flex items-center gap-2 text-xs text-[var(--vscode-testing-iconPassed)] pl-2">
          <Check size={12} />
          <span>
            {needsPlanReview
              ? 'Waiting for plan review'
              : turn.planHandled
              ? turn.planDecision === 'approved'
                ? 'Plan approved; continuation started below'
                : 'Plan discarded'
              : 'Done'}
          </span>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  explanation,
  planSteps,
  planText,
}: {
  explanation?: string;
  planSteps?: NonNullable<CodexConversationTurn['planSteps']>;
  planText?: string;
}) {
  return (
    <div className="mx-1 p-3 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)]">
      <div className="text-[11px] opacity-70 mb-2 font-medium">Codex plan</div>
      {explanation && (
        <p className="text-[12px] opacity-85 mb-2 whitespace-pre-wrap">{explanation}</p>
      )}
      {planSteps && planSteps.length > 0 ? (
        <div className="space-y-1.5">
          {planSteps.map((step, index) => (
            <div key={`${step.step}-${index}`} className="flex items-start gap-2 text-[12px]">
              <span className="mt-[2px] shrink-0 opacity-60">
                {step.status === 'completed' ? '✓' : step.status === 'inProgress' ? '•' : '○'}
              </span>
              <div>
                <div>{step.step}</div>
                <div className="text-[10px] opacity-55">
                  {step.status === 'inProgress' ? 'In progress' : step.status === 'completed' ? 'Completed' : 'Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : planText ? (
        <div className="text-[12px]">
          <RenderedMarkdown content={planText} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Collapsible activity section.
 * When collapsed: shows action count + last activity as one-liner.
 * When expanded: shows all individual activity lines.
 */
function ActivitySection({
  activities,
  isRunning,
  lastActivity,
}: {
  activities: AgentProgress[];
  isRunning: boolean;
  lastActivity: AgentProgress | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const count = activities.length;
  const latestMessage = lastActivity?.message || '';

  return (
    <div className="pl-1">
      {/* Summary row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left group hover:opacity-80 transition-opacity"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 opacity-40 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        {isRunning ? (
          <Loader2 size={11} className="shrink-0 animate-spin opacity-50" />
        ) : (
          <Wrench size={11} className="shrink-0 opacity-40" />
        )}
        <span className="text-[11px] opacity-50 truncate">
          {isRunning
            ? `${latestMessage}${count > 1 ? ` (${count} actions)` : ''}`
            : `${count} action${count !== 1 ? 's' : ''} completed`
          }
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-1 ml-5 space-y-0.5 border-l border-[var(--vscode-panel-border)] pl-2">
          {activities.map((activity, i) => (
            <ActivityLine key={i} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityLine({ activity }: { activity: AgentProgress }) {
  const icon = activity.tool === 'shell' ? (
    <Terminal size={10} className="shrink-0" />
  ) : activity.tool === 'apply_patch' ? (
    <FileCode size={10} className="shrink-0" />
  ) : (
    <Wrench size={10} className="shrink-0" />
  );

  return (
    <div className="flex items-center gap-1.5 text-[10px] opacity-45">
      {icon}
      <span className="truncate">{activity.message}</span>
    </div>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: NonNullable<CodexConversationTurn['approval']>;
  onApprove: (requestId: string | number) => void;
  onReject: (requestId: string | number) => void;
}) {
  const isCommand = approval.approvalType === 'command';

  return (
    <div className="mx-1 p-3 rounded-lg border-2 border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-editor-background)]">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className="text-[var(--vscode-inputValidation-warningBorder)]" />
        <span className="text-xs font-semibold">
          {isCommand ? 'Shell Command Approval' : 'File Change Approval'}
        </span>
      </div>

      {/* Command preview */}
      {isCommand && approval.command && (
        <div className="mb-2">
          <code className="block text-[11px] p-2 rounded bg-[var(--vscode-input-background)] font-mono whitespace-pre-wrap break-all">
            {approval.command}
          </code>
          {approval.workingDir && (
            <div className="text-[10px] opacity-50 mt-1">
              in {approval.workingDir}
            </div>
          )}
        </div>
      )}

      {/* File changes preview */}
      {!isCommand && approval.fileChanges && (
        <div className="mb-2">
          {Object.entries(approval.fileChanges).map(([path, change]) => (
            <div key={path} className="mb-1">
              <div className="text-[11px] font-medium">{path}</div>
              {change && typeof change === 'object' && 'type' in change && (
                <div className="text-[10px] opacity-60">{(change as { type: string }).type}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(approval.requestId)}
          className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          <Check size={12} /> Approve
        </button>
        <button
          onClick={() => onReject(approval.requestId)}
          className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        >
          <X size={12} /> Reject
        </button>
      </div>
    </div>
  );
}

function CompatibilityNotice({
  title,
  message,
  bullets,
  onDismiss,
}: {
  title: string;
  message: string;
  bullets: string[];
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-editorWarning-background)]/20 p-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--vscode-inputValidation-warningBorder)]" />
          <div className="min-w-0">
            <div className="text-xs font-semibold">{title}</div>
            <p className="mt-1 text-xs leading-5 opacity-80">{message}</p>
            <div className="mt-2 space-y-1">
              {bullets.map((bullet) => (
                <div key={bullet} className="text-[11px] leading-4 opacity-75">
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-1 opacity-60 hover:opacity-100"
          aria-label="Dismiss Codex compatibility notice"
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
