/**
 * ChatMessage — renders a single message (user/assistant/error/streaming).
 */

import { AlertCircle } from 'lucide-react';
import { RenderedMarkdown } from './RenderedMarkdown';
import { CitationChips } from './CitationChips';
import { WidgetPreview } from './WidgetPreview';
import type { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="px-2.5 py-2 rounded bg-[var(--vscode-input-background)] text-xs">
        {message.content}
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className="flex items-start gap-2 text-xs text-[var(--vscode-errorForeground)]">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>{message.content}</span>
      </div>
    );
  }

  // assistant
  return (
    <div className="text-xs">
      <RenderedMarkdown content={message.content} />
      {message.citations && <CitationChips citations={message.citations} />}
      {message.widget && (
        <WidgetPreview widget={message.widget} messageId={message.id} />
      )}
    </div>
  );
}

/**
 * StreamingMessage — shows partial markdown with a blinking cursor.
 */
export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="text-xs">
      <RenderedMarkdown content={content} />
      <span className="inline-block w-0.5 h-3.5 bg-[var(--vscode-foreground)] ml-0.5 animate-pulse" />
    </div>
  );
}

/**
 * ThinkingIndicator — shown while waiting for the first streaming chunk.
 */
export function ThinkingIndicator() {
  return (
    <div className="text-xs text-[var(--vscode-descriptionForeground)] animate-pulse">
      Searching & thinking...
    </div>
  );
}
