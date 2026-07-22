/**
 * LegacyConversationView — read-only display for saved legacy "Ritemark Agent"
 * conversations loaded from history.
 *
 * Sprint 74 removed the legacy LLM/RAG runtime entirely. Existing saved
 * conversations (agentId: 'ritemark-agent') must still be readable but no new
 * legacy turns can be started. This component renders the chatMessages list
 * read-only with a notice explaining the runtime is no longer available.
 *
 * No send path — ChatInput is still shown by AISidebar but will use the
 * currently selected runtime (claude-code or codex), not this legacy one.
 */

import { useRef, useEffect } from 'react';
import { useActiveConversation } from './store';
import { ChatMessage } from './ChatMessage';
import { Icon } from '../ui/Icon';

export function LegacyConversationView() {
  const { legacyConversation } = useActiveConversation();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  if (!legacyConversation) return null;

  const { messages } = legacyConversation.providerTurn;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Read-only notice */}
      <div className="mx-3 mt-3 mb-1 flex items-start gap-2 px-2.5 py-2 rounded text-[11px] text-[var(--r-ink-muted)] bg-[var(--vscode-input-background)] border border-[var(--r-hairline)]">
        <Icon name="clock-counter-clockwise" size={12} className="shrink-0 mt-0.5 opacity-70" />
        <span>
          This conversation was created with a legacy runtime that has been removed.
          It is shown read-only. To continue, start a new conversation.
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
