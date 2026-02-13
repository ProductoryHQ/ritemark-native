/**
 * ChatInput — shared textarea + Send/Stop buttons for both agent modes.
 * Supports file attachments (images, PDFs, text files) when Claude Code agent is selected.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, X, Paperclip, FileText, FileImage } from 'lucide-react';
import { useAISidebarStore } from './store';
import type { FileAttachment, AttachmentKind } from './types';

let attachmentIdCounter = 0;

/** File extensions we accept, grouped by kind */
const IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp';
const PDF_EXTENSIONS = '.pdf';
const TEXT_EXTENSIONS = '.md,.txt,.csv,.json,.xml,.yaml,.yml,.toml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sh,.sql,.log';

const ALL_ACCEPTED = [IMAGE_EXTENSIONS, PDF_EXTENSIONS, TEXT_EXTENSIONS].join(',');

/** Max text file size (500KB — larger files should be read by the agent from disk) */
const MAX_TEXT_SIZE = 512 * 1024;

function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  // Treat anything text-ish as text
  if (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/xml' ||
    file.type === 'application/yaml' ||
    file.name.match(/\.(md|txt|csv|json|xml|yaml|yml|toml|html|css|js|ts|tsx|jsx|py|sh|sql|log)$/i)
  ) {
    return 'text';
  }
  return null;
}

function readFileAsBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mediaType = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function ChatInput() {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);
  const isStreaming = useAISidebarStore((s) => s.isStreaming);
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const sendChatMessage = useAISidebarStore((s) => s.sendChatMessage);
  const sendAgentMessage = useAISidebarStore((s) => s.sendAgentMessage);
  const cancelRequest = useAISidebarStore((s) => s.cancelRequest);

  const isClaudeCode = selectedAgent === 'claude-code';
  const lastTurn = agentConversation[agentConversation.length - 1];
  const agentRunning = lastTurn?.isRunning ?? false;
  const isLoading = isClaudeCode ? agentRunning : isStreaming;

  const placeholder = isClaudeCode
    ? 'Ask Claude Code to do something...'
    : 'Ask anything...';

  const handleSend = useCallback(() => {
    const prompt = value.trim();
    if (!prompt || isLoading) return;

    if (isClaudeCode) {
      sendAgentMessage(prompt, attachments.length > 0 ? attachments : undefined);
    } else {
      sendChatMessage(prompt);
    }
    setValue('');
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachments, isLoading, isClaudeCode, sendAgentMessage, sendChatMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /** Process a File object into a FileAttachment */
  const processFile = useCallback(async (file: File): Promise<FileAttachment | null> => {
    const kind = classifyFile(file);
    if (!kind) return null;

    const id = `att-${++attachmentIdCounter}`;

    if (kind === 'text') {
      if (file.size > MAX_TEXT_SIZE) {
        console.warn(`File ${file.name} too large (${file.size} bytes), skipping`);
        return null;
      }
      const text = await readFileAsText(file);
      return { id, kind, name: file.name, data: text, mediaType: file.type || 'text/plain' };
    }

    // Image or PDF — read as base64
    const { data, mediaType } = await readFileAsBase64(file);

    if (kind === 'image') {
      const thumbnail = `data:${mediaType};base64,${data}`;
      return { id, kind, name: file.name, data, mediaType, thumbnail };
    }

    // PDF
    return { id, kind, name: file.name, data, mediaType };
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!isClaudeCode) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const att = await processFile(file);
          if (att) setAttachments((prev) => [...prev, att]);
        } catch (err) {
          console.error('Failed to read pasted image:', err);
        }
        break;
      }
    }
  }, [isClaudeCode, processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of files) {
      try {
        const att = await processFile(file);
        if (att) setAttachments((prev) => [...prev, att]);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
    e.target.value = '';
  }, [processFile]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [value]);

  const attachmentCount = attachments.length;
  const imageCount = attachments.filter((a) => a.kind === 'image').length;
  const fileCount = attachmentCount - imageCount;

  let sendTitle = 'Send';
  if (attachmentCount > 0) {
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} image(s)`);
    if (fileCount > 0) parts.push(`${fileCount} file(s)`);
    sendTitle = `Send with ${parts.join(' and ')}`;
  }

  return (
    <div className="px-3 py-2.5 border-t border-[var(--vscode-panel-border)]">
      {/* Attachment thumbnail strip */}
      {attachments.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group rounded overflow-hidden border border-[var(--vscode-panel-border)] bg-[var(--vscode-input-background)]"
            >
              {att.kind === 'image' && att.thumbnail ? (
                <div className="w-14 h-14">
                  <img
                    src={att.thumbnail}
                    alt={att.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1.5 max-w-[160px]">
                  {att.kind === 'pdf' ? (
                    <FileText size={14} className="shrink-0 text-[var(--vscode-descriptionForeground)]" />
                  ) : (
                    <FileImage size={14} className="shrink-0 text-[var(--vscode-descriptionForeground)]" />
                  )}
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)] truncate">
                    {att.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center bg-black/60 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Attach button — Claude Code only */}
        {isClaudeCode && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALL_ACCEPTED}
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center justify-center w-8 h-8 rounded text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] hover:bg-[var(--vscode-input-background)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Attach files"
            >
              <Paperclip size={14} />
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={isLoading || !isOnline}
          rows={1}
          className="flex-1 resize-none rounded px-2.5 py-1.5 text-xs leading-relaxed bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] outline-none focus:border-[var(--vscode-focusBorder)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isLoading ? (
          <button
            onClick={cancelRequest}
            className="flex items-center justify-center w-8 h-8 rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:opacity-80 shrink-0"
            title="Stop"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || !isOnline}
            className="flex items-center justify-center w-8 h-8 rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title={sendTitle}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
