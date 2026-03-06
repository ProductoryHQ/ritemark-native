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
import type { CodexConversationTurn, AgentProgress } from './types';

export function CodexView() {
  const codexConversation = useAISidebarStore((s) => s.codexConversation);
  const handleCodexApproval = useAISidebarStore((s) => s.handleCodexApproval);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {codexConversation.map((turn) => (
        <CodexTurn
          key={turn.id}
          turn={turn}
          onApprove={(requestId) => handleCodexApproval(requestId, true)}
          onReject={(requestId) => handleCodexApproval(requestId, false)}
        />
      ))}
    </div>
  );
}

function CodexTurn({
  turn,
  onApprove,
  onReject,
}: {
  turn: CodexConversationTurn;
  onApprove: (requestId: string | number) => void;
  onReject: (requestId: string | number) => void;
}) {
  const hasActivities = turn.activities.length > 0;
  const lastActivity = hasActivities ? turn.activities[turn.activities.length - 1] : null;

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

      {/* Streaming text */}
      {turn.streamingText && (
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
          <span>Done</span>
        </div>
      )}
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
