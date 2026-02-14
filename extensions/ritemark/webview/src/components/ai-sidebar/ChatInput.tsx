/**
 * ChatInput — shared textarea + Send/Stop buttons for both agent modes.
 * Supports file attachments (images, PDFs, text files) when Claude Code agent is selected.
 * Supports @ agent mentions with autocomplete, slash commands, and drag-and-drop file paths.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, X, Paperclip, FileText, FileImage, File, Bot } from 'lucide-react';
import { useAISidebarStore } from './store';
import { AgentMentionPopup } from './AgentMentionPopup';
import { SlashCommandPopup } from './SlashCommandPopup';
import { type AgentDefinition, parseMentions, findAgent } from './agentRegistry';
import { type SlashCommand, parseCommand } from './slashCommands';
import type { FileAttachment, AttachmentKind } from './types';

let attachmentIdCounter = 0;
let pathChipIdCounter = 0;

/** File extensions we accept, grouped by kind */
const IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp';
const PDF_EXTENSIONS = '.pdf';
const TEXT_EXTENSIONS = '.md,.txt,.csv,.json,.xml,.yaml,.yml,.toml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sh,.sql,.log';

const ALL_ACCEPTED = [IMAGE_EXTENSIONS, PDF_EXTENSIONS, TEXT_EXTENSIONS].join(',');

/** Max text file size (500KB — larger files should be read by the agent from disk) */
const MAX_TEXT_SIZE = 512 * 1024;

/** Dropped file path chip */
interface PathChip {
  id: string;
  path: string;
  isFolder: boolean;
}

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

/** Extract file path from VS Code URI or plain path */
function extractPath(uri: string): string {
  // VS Code file URIs: file:///Users/foo/bar.md
  if (uri.startsWith('file://')) {
    try {
      const url = new URL(uri);
      return decodeURIComponent(url.pathname);
    } catch {
      return uri.replace('file://', '');
    }
  }
  return uri;
}

/** Get relative path from workspace if possible */
function getDisplayPath(fullPath: string): string {
  // Try to make path relative to common prefixes
  // This is a simple heuristic — works for most cases
  const parts = fullPath.split('/');
  const projectIdx = parts.findIndex((p) =>
    ['src', 'lib', 'components', 'extensions', 'webview', 'docs'].includes(p)
  );
  if (projectIdx > 0) {
    return parts.slice(projectIdx).join('/');
  }
  // Fall back to just filename + parent
  if (parts.length > 2) {
    return parts.slice(-2).join('/');
  }
  return fullPath;
}

export function ChatInput() {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pathChips, setPathChips] = useState<PathChip[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [showCommandPopup, setShowCommandPopup] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandPosition, setCommandPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const selection = useAISidebarStore((s) => s.selection);

  const placeholder = isClaudeCode
    ? 'Ask Claude Code... (type @ to mention an agent, / for commands)'
    : 'Ask anything... (type / for commands)';

  // Build final message with path chips prepended
  const buildFinalPrompt = useCallback((): string => {
    let prompt = value.trim();

    // Prepend file paths if any
    if (pathChips.length > 0) {
      const pathLines = pathChips.map(
        (p) => `[${p.isFolder ? 'Folder' : 'File'}: ${p.path}]`
      );
      prompt = pathLines.join('\n') + '\n\n' + prompt;
    }

    return prompt;
  }, [value, pathChips]);

  const handleSend = useCallback(() => {
    const prompt = buildFinalPrompt();
    if (!prompt || isLoading) return;

    if (isClaudeCode) {
      sendAgentMessage(prompt, attachments.length > 0 ? attachments : undefined);
    } else {
      sendChatMessage(prompt);
    }
    setValue('');
    setAttachments([]);
    setPathChips([]);
    setShowMentionPopup(false);
    setShowCommandPopup(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [buildFinalPrompt, attachments, isLoading, isClaudeCode, sendAgentMessage, sendChatMessage]);

  // Execute a slash command
  const executeCommand = useCallback(
    (command: SlashCommand, args: string) => {
      const context = {
        selection: selection?.text || '',
        // documentContent would come from extension — for now just use selection
      };

      const prompt = command.buildPrompt(args, context);
      if (!prompt || isLoading) return;

      // Send through normal chat flow
      if (isClaudeCode) {
        sendAgentMessage(prompt);
      } else {
        sendChatMessage(prompt);
      }

      setValue('');
      setShowCommandPopup(false);
    },
    [selection, isLoading, isClaudeCode, sendAgentMessage, sendChatMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle Enter/Tab if popup is open (popup handles it)
      if (
        (showMentionPopup || showCommandPopup) &&
        ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)
      ) {
        return; // Let the popup handle these
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        // Check if this is a complete slash command
        const parsed = parseCommand(value);
        if (parsed) {
          executeCommand(parsed.command, parsed.args);
          return;
        }

        handleSend();
      }

      if (e.key === 'Escape') {
        setShowMentionPopup(false);
        setShowCommandPopup(false);
      }
    },
    [handleSend, showMentionPopup, showCommandPopup, value, executeCommand]
  );

  // Handle text changes, @ mention detection, and / command detection
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setValue(newValue);

    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Detect / command trigger (only at start of input or after newline)
    if (newValue.startsWith('/')) {
      const match = newValue.match(/^\/(\S*)$/);
      if (match) {
        // Still typing the command name
        setCommandQuery(match[1] || '');
        setShowCommandPopup(true);
        setShowMentionPopup(false);
        setCommandPosition({ top: -280, left: 0 });
        return;
      }
    }

    // Close command popup if we're past the command trigger
    setShowCommandPopup(false);

    // Detect @ mention trigger
    // Look backwards from cursor for @
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      // Check if there's a space or start before the @
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || atIndex === 0) {
        // Extract the query after @
        const query = textBeforeCursor.slice(atIndex + 1);
        // Only show popup if query doesn't contain spaces (still typing agent name)
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setShowMentionPopup(true);

          // Position the popup above the cursor
          if (textareaRef.current && containerRef.current) {
            setMentionPosition({
              top: -200, // Position above (will be adjusted by popup height)
              left: 0,
            });
          }
          return;
        }
      }
    }

    // Close popup if we're not in a valid @ context
    setShowMentionPopup(false);
  }, []);

  // Handle agent selection from mention popup
  const handleAgentSelect = useCallback(
    (agent: AgentDefinition) => {
      if (mentionStartIndex === null) return;

      const before = value.slice(0, mentionStartIndex);
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);

      // Insert @agent-id
      const newValue = `${before}@${agent.id} ${after}`;
      setValue(newValue);
      setShowMentionPopup(false);
      setMentionStartIndex(null);

      // Focus and set cursor after the inserted text
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = mentionStartIndex + agent.id.length + 2; // @ + id + space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, mentionStartIndex]
  );

  // Handle mention popup close
  const handleMentionClose = useCallback(() => {
    setShowMentionPopup(false);
  }, []);

  // Handle slash command selection from popup
  const handleCommandSelect = useCallback(
    (command: SlashCommand) => {
      // Insert the command name and a space
      const newValue = `/${command.id} `;
      setValue(newValue);
      setShowCommandPopup(false);

      // Focus and set cursor at the end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newValue.length, newValue.length);
        }
      }, 0);
    },
    []
  );

  // Handle command popup close
  const handleCommandClose = useCallback(() => {
    setShowCommandPopup(false);
  }, []);

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

  const removePathChip = useCallback((id: string) => {
    setPathChips((prev) => prev.filter((p) => p.id !== id));
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

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isClaudeCode) return;
    setIsDragOver(true);
  }, [isClaudeCode]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!isClaudeCode) return;

    // Check for VS Code file URIs in the drop data
    // VS Code sends file:// URIs in text/uri-list
    const uriList = e.dataTransfer.getData('text/uri-list');
    const plainText = e.dataTransfer.getData('text/plain');

    // Try to extract paths from URI list first
    const paths: string[] = [];

    if (uriList) {
      const lines = uriList.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      for (const line of lines) {
        const path = extractPath(line.trim());
        if (path) paths.push(path);
      }
    } else if (plainText) {
      // Fall back to plain text (might be a path)
      const trimmed = plainText.trim();
      if (trimmed.startsWith('/') || trimmed.startsWith('file://')) {
        paths.push(extractPath(trimmed));
      }
    }

    // Also check for dropped files (actual file objects)
    if (e.dataTransfer.files.length > 0 && paths.length === 0) {
      // These are actual files dropped — process as attachments instead
      for (const file of e.dataTransfer.files) {
        try {
          const att = await processFile(file);
          if (att) setAttachments((prev) => [...prev, att]);
        } catch (err) {
          console.error('Failed to read dropped file:', err);
        }
      }
      return;
    }

    // Add paths as chips
    for (const path of paths) {
      // Simple heuristic: if it has an extension, it's a file; otherwise folder
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
      const chip: PathChip = {
        id: `path-${++pathChipIdCounter}`,
        path,
        isFolder: !hasExtension,
      };
      setPathChips((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.path === path)) return prev;
        return [...prev, chip];
      });
    }
  }, [isClaudeCode, processFile]);

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
  if (attachmentCount > 0 || pathChips.length > 0) {
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} image(s)`);
    if (fileCount > 0) parts.push(`${fileCount} file(s)`);
    if (pathChips.length > 0) parts.push(`${pathChips.length} path(s)`);
    sendTitle = `Send with ${parts.join(' and ')}`;
  }

  // Parse @mentions in value for visual highlighting
  const mentions = parseMentions(value);

  return (
    <div
      ref={containerRef}
      className={`relative px-3 py-2.5 border-t border-[var(--vscode-panel-border)] ${
        isDragOver ? 'bg-[var(--vscode-list-hoverBackground)]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--vscode-editor-background)]/90 border-2 border-dashed border-[var(--vscode-focusBorder)] rounded pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-[var(--vscode-foreground)]">
            <File size={18} />
            Drop files or folders here
          </div>
        </div>
      )}

      {/* @ Mention Popup */}
      {showMentionPopup && (
        <AgentMentionPopup
          query={mentionQuery}
          onSelect={handleAgentSelect}
          onClose={handleMentionClose}
          position={mentionPosition}
        />
      )}

      {/* Slash Command Popup */}
      {showCommandPopup && (
        <SlashCommandPopup
          query={commandQuery}
          onSelect={handleCommandSelect}
          onClose={handleCommandClose}
          position={commandPosition}
        />
      )}

      {/* Path chips strip */}
      {pathChips.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {pathChips.map((chip) => (
            <div
              key={chip.id}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
            >
              <File size={10} className="shrink-0" />
              <span className="truncate max-w-[120px]" title={chip.path}>
                {getDisplayPath(chip.path)}
              </span>
              <button
                onClick={() => removePathChip(chip.id)}
                className="shrink-0 hover:text-[var(--vscode-errorForeground)]"
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

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

      {/* Mentioned agents badge strip (visual indicator of @mentions in message) */}
      {mentions.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {mentions.map((m) => {
            const agent = findAgent(m.agentId);
            if (!agent) return null;
            return (
              <div
                key={m.start}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--vscode-symbolIcon-classForeground)]/10 text-[var(--vscode-symbolIcon-classForeground)]"
              >
                <Bot size={10} />
                {agent.name}
              </div>
            );
          })}
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
          onChange={handleChange}
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
