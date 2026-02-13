/**
 * ChatView — Ritemark Agent conversation (streaming chat with RAG).
 */

import { useRef, useEffect, useCallback } from 'react';
import { useAISidebarStore } from './store';
import { EmptyState } from './EmptyState';
import { ChatMessage, StreamingMessage, ThinkingIndicator } from './ChatMessage';

export function ChatView() {
  const chatMessages = useAISidebarStore((s) => s.chatMessages);
  const streamingContent = useAISidebarStore((s) => s.streamingContent);
  const isStreaming = useAISidebarStore((s) => s.isStreaming);
  const sendChatMessage = useAISidebarStore((s) => s.sendChatMessage);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll logic: scroll to bottom unless user has scrolled up
  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingContent, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // User scrolled up if not at the bottom (with 50px threshold)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledRef.current = !atBottom;
  }, []);

  // Reset user scroll when new user message is sent
  useEffect(() => {
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
      userScrolledRef.current = false;
    }
  }, [chatMessages]);

  const isEmpty = chatMessages.length === 0 && !streamingContent && !isStreaming;

  if (isEmpty) {
    return <EmptyState variant="chat" onPrompt={sendChatMessage} />;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
    >
      {chatMessages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {streamingContent ? (
        <StreamingMessage content={streamingContent} />
      ) : isStreaming ? (
        <ThinkingIndicator />
      ) : null}

      <div ref={messagesEndRef} />
    </div>
  );
}
