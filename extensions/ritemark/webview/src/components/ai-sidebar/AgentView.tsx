/**
 * AgentView — Claude Code agent conversation thread.
 */

import { useRef, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAISidebarStore } from './store';
import { EmptyState } from './EmptyState';
import { RunningIndicator } from './RunningIndicator';
import { AgentResponse } from './AgentResponse';
import { SubagentCard } from './SubagentCard';
import { UserPromptBubble } from './ChatBubbles';
import type { AgentProgress } from './types';

export function AgentView() {
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const sendAgentMessage = useAISidebarStore((s) => s.sendAgentMessage);
  const contextUsagePercent = useAISidebarStore((s) => s.contextUsagePercent);
  const showContextWarning = useAISidebarStore((s) => s.showContextWarning);
  const startNewConversation = useAISidebarStore((s) => s.startNewConversation);

  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Scroll on new turns or when last turn updates
  const lastTurn = agentConversation[agentConversation.length - 1];
  useEffect(() => {
    scrollToBottom();
  }, [agentConversation.length, lastTurn?.activities.length, lastTurn?.result, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledRef.current = !atBottom;
  }, []);

  if (agentConversation.length === 0) {
    return <EmptyState variant="agent" onPrompt={sendAgentMessage} />;
  }

  // Context usage bar color
  const usageBarColor = contextUsagePercent >= 80
    ? 'var(--vscode-errorForeground)'
    : contextUsagePercent >= 60
      ? 'var(--vscode-editorWarning-foreground)'
      : 'var(--vscode-progressBar-background)';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Context usage bar */}
      {agentConversation.length > 0 && (
        <div className="h-[3px] w-full bg-transparent shrink-0">
          <div
            style={{
              width: `${Math.min(100, contextUsagePercent)}%`,
              backgroundColor: usageBarColor,
              transition: 'width 0.4s ease, background-color 0.4s ease',
            }}
            className="h-full"
          />
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
      >
      {agentConversation.map((turn) => {
        const compactedEvent = turn.activities.find((a: AgentProgress) => a.type === 'compacted');
        return (
          <div key={turn.id} className="space-y-2">
            {/* Compaction banner — shown above the turn where compaction happened */}
            {compactedEvent && (
              <div className="flex items-start gap-2 px-2.5 py-2 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]" style={{ fontSize: 'var(--chat-font-size, 13px)' }}>
                <RefreshCw size={13} className="shrink-0 mt-0.5 text-[var(--vscode-descriptionForeground)]" />
                <span className="text-[var(--vscode-descriptionForeground)]">
                  {compactedEvent.message}
                </span>
              </div>
            )}

            {/* User prompt */}
            <UserPromptBubble attachments={turn.attachments}>
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

            {/* Running indicator */}
            {turn.isRunning && (
              <RunningIndicator activities={turn.activities} subagents={turn.subagents} />
            )}

            {/* Result */}
            {turn.result && <AgentResponse turn={turn} />}
          </div>
        );
      })}

      <div ref={endRef} />
    </div>

      {/* Context warning banner */}
      {showContextWarning && agentConversation.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] text-[11px] text-[var(--vscode-editorWarning-foreground)]">
          <AlertTriangle size={12} className="shrink-0" />
          <span className="flex-1">
            Vestlus hakkab pikaks minema (~{Math.round(contextUsagePercent)}%). Kasuta <code>/compact</code> või{' '}
            <button
              onClick={startNewConversation}
              className="underline hover:opacity-80 inline-flex items-center gap-0.5"
            >
              <RotateCcw size={9} />
              alusta uut vestlust
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
