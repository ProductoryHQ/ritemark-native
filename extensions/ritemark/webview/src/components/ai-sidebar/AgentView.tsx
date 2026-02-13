/**
 * AgentView — Claude Code agent conversation thread.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useAISidebarStore } from './store';
import { EmptyState } from './EmptyState';
import { RunningIndicator } from './RunningIndicator';
import { AgentResponse } from './AgentResponse';

export function AgentView() {
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const sendAgentMessage = useAISidebarStore((s) => s.sendAgentMessage);

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

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
    >
      {agentConversation.map((turn) => (
        <div key={turn.id} className="space-y-2">
          {/* User prompt */}
          <div className="px-2.5 py-2 rounded bg-[var(--vscode-input-background)] text-xs">
            {turn.attachments && turn.attachments.length > 0 && (
              <div className="flex gap-1.5 mb-1.5 flex-wrap">
                {turn.attachments.map((att) =>
                  att.kind === 'image' && att.thumbnail ? (
                    <img
                      key={att.id}
                      src={att.thumbnail}
                      alt={att.name}
                      className="w-16 h-16 object-cover rounded border border-[var(--vscode-panel-border)]"
                    />
                  ) : (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)]"
                    >
                      {att.name}
                    </span>
                  )
                )}
              </div>
            )}
            {turn.userPrompt}
          </div>

          {/* Running indicator */}
          {turn.isRunning && (
            <RunningIndicator activities={turn.activities} />
          )}

          {/* Result */}
          {turn.result && <AgentResponse turn={turn} />}
        </div>
      ))}

      <div ref={endRef} />
    </div>
  );
}
