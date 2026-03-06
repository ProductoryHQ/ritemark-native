/**
 * ChatBubbles — shared UI primitives for user prompts and AI responses.
 * Used by both AgentView (Claude Code) and CodexView (Codex) for consistent styling.
 */

import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { RenderedMarkdown } from './RenderedMarkdown';
import type { FileAttachment } from './types';

/** Common font size style using CSS variable with fallback */
export const chatFontStyle = { fontSize: 'var(--chat-font-size, 13px)' };

/** Show only the filename from a full path */
function displayFileName(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || path;
}

// ── User Prompt ──

interface UserPromptBubbleProps {
  children: ReactNode;
  attachments?: FileAttachment[];
  /** Active file path that was included as context */
  activeFilePath?: string;
}

export function UserPromptBubble({ children, attachments, activeFilePath }: UserPromptBubbleProps) {
  return (
    <div
      className="px-2.5 py-2 rounded bg-[var(--vscode-input-background)]"
      style={chatFontStyle}
    >
      {/* Active file context indicator */}
      {activeFilePath && (
        <div className="flex items-center gap-1 mb-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
          <FileText size={10} className="shrink-0" />
          <span className="truncate" title={activeFilePath}>
            Context: {displayFileName(activeFilePath)}
          </span>
        </div>
      )}
      {attachments && attachments.length > 0 && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {attachments.map((att) =>
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
      {children}
    </div>
  );
}

// ── AI Response ──

interface AIResponseBubbleProps {
  content: string;
  className?: string;
}

export function AIResponseBubble({ content, className }: AIResponseBubbleProps) {
  if (!content) return null;
  return (
    <div style={chatFontStyle}>
      <RenderedMarkdown content={content} className={className} />
    </div>
  );
}
