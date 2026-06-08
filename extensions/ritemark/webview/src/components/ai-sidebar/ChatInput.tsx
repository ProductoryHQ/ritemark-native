/**
 * ChatInput — shared textarea + Send/Stop buttons for both agent modes.
 * Supports file attachments (images, PDFs, text files) when Claude Code agent is selected.
 * Supports @ agent mentions with autocomplete, slash commands, and drag-and-drop file paths.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Icon } from '../ui/Icon';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '../ui/select';
import { useAISidebarStore } from './store';
import { SelectedContextTab } from './SelectedContextTab';
import { shouldQueueInsteadOfSend, shouldAutoSendQueuedPrompt } from './composerQueue';
import { AgentMentionPopup, type AgentMentionPopupHandle } from './AgentMentionPopup';
import { SlashCommandPopup, type SlashCommandPopupHandle } from './SlashCommandPopup';
import { type AgentDefinition, parseMentions, findAgent } from './agentRegistry';
import { type SlashCommand, type CommandAction, parseCommand, mergeCommands } from './slashCommands';
import type { AgentId, FileAttachment, AttachmentKind } from './types';

let attachmentIdCounter = 0;
let pathChipIdCounter = 0;

/** File extensions we accept, grouped by kind */
const IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp';
const PDF_EXTENSIONS = '.pdf';
const TEXT_EXTENSIONS = '.md,.txt,.csv,.json,.xml,.yaml,.yml,.toml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sh,.sql,.log';

const ALL_ACCEPTED = [IMAGE_EXTENSIONS, PDF_EXTENSIONS, TEXT_EXTENSIONS].join(',');

/** Max text file size (500KB — larger files should be read by the agent from disk) */
const MAX_TEXT_SIZE = 512 * 1024;

/**
 * Split a Claude SDK model description into two parts so the dropdown can
 * mirror Claude Desktop's layout: large version line on top, short purpose
 * tagline underneath.
 *
 * Input examples from the SDK's `supportedModels()`:
 *   "Opus 4.8 with 1M context · Most capable"
 *   "Sonnet 4.6 · Best for everyday tasks"
 *   "Haiku 4.5 · Fastest for quick answers"
 *
 * For Codex (no " · " separator) the whole string is the tagline and the
 * version line stays empty — Codex labels already carry the version.
 */
function parseModelDescription(description: string | undefined): {
  versionLine: string | null;
  tagline: string;
} {
  if (!description) return { versionLine: null, tagline: '' };
  const sep = description.indexOf(' · ');
  if (sep < 0) return { versionLine: null, tagline: description.trim() };
  return {
    versionLine: description.slice(0, sep).trim(),
    tagline: description.slice(sep + 3).trim(),
  };
}

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
  // Sprint 74 R2 (#82): prompt parked while the agent runs; auto-sends on completion
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pathChips, setPathChips] = useState<PathChip[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hideActiveFile, setHideActiveFile] = useState(false);
  const [hideBrowserContext, setHideBrowserContext] = useState(false);
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
  const mentionPopupRef = useRef<AgentMentionPopupHandle>(null);
  const commandPopupRef = useRef<SlashCommandPopupHandle>(null);

  const pendingRuntime = useAISidebarStore((s) => s.pendingRuntime);
  const isStreaming = useAISidebarStore((s) => s.isStreaming);
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);
  const selectedModel = useAISidebarStore((s) => s.selectedModel);
  const codexSelectedModel = useAISidebarStore((s) => s.codexSelectedModel);
  const agents = useAISidebarStore((s) => s.agents);
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
  const selectAgent = useAISidebarStore((s) => s.selectAgent);
  const selectModel = useAISidebarStore((s) => s.selectModel);
  const selectCodexModel = useAISidebarStore((s) => s.selectCodexModel);
  const setPendingRuntime = useAISidebarStore((s) => s.setPendingRuntime);
  const sendAgentMessage = useAISidebarStore((s) => s.sendAgentMessage);
  const cancelRequest = useAISidebarStore((s) => s.cancelRequest);
  const discoveredAgents = useAISidebarStore((s) => s.discoveredAgents);
  const discoveredCommands = useAISidebarStore((s) => s.discoveredCommands);
  const requestPinAgent = useAISidebarStore((s) => s.requestPinAgent);
  const pinnedAgent = useAISidebarStore((s) => s.pinnedAgent);
  const pinnedAgentContent = useAISidebarStore((s) => s.pinnedAgentContent);
  const pinnedAgentDismissal = useAISidebarStore((s) => s.pinnedAgentDismissal);
  const setPinnedAgent = useAISidebarStore((s) => s.setPinnedAgent);
  const clearPinnedAgentContent = useAISidebarStore((s) => s.clearPinnedAgentContent);
  const clearPinnedAgentDismissal = useAISidebarStore((s) => s.clearPinnedAgentDismissal);
  const activeFilePath = useAISidebarStore((s) => s.activeFilePath);
  const currentBrowserContext = useAISidebarStore((s) => s.currentBrowserContext);
  // Selection state — needed to stack the queue notch under SelectedContextTab
  // without a visible seam (Sprint 74 R2 notch-stack rule).
  const selection = useAISidebarStore((s) => s.selection);

  // Merge built-in + discovered commands
  const allCommands = useMemo(() => mergeCommands(discoveredCommands), [discoveredCommands]);

  const sendCodexMessage = useAISidebarStore((s) => s.sendCodexMessage);
  const sendOpenCodeMessage = useAISidebarStore((s) => s.sendOpenCodeMessage);
  const codexConversation = useAISidebarStore((s) => s.codexConversation);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const opencodeEnabled = useAISidebarStore((s) => s.opencodeEnabled);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const opencodeSelectedModel = useAISidebarStore((s) => s.opencodeSelectedModel);
  const selectOpenCodeModel = useAISidebarStore((s) => s.selectOpenCodeModel);
  const openAgentSettings = useAISidebarStore((s) => s.openAgentSettings);

  // Route by pendingRuntime so switching provider mid-session takes effect immediately
  const isClaudeCode = pendingRuntime.runtimeId === 'claude-code';
  const isCodex = pendingRuntime.runtimeId === 'codex';
  const isOpenCode = (pendingRuntime.runtimeId as string) === 'opencode';
  const isAgentMode = isClaudeCode || isCodex || isOpenCode;
  // OpenCode zero-key check: all four provider booleans are false
  const openCodeHasNoKeys = isOpenCode && acpProviders
    && !acpProviders.google && !acpProviders.openai && !acpProviders.anthropic && !acpProviders.openrouter;
  const lastTurn = agentConversation[agentConversation.length - 1];
  const lastCodexTurn = codexConversation[codexConversation.length - 1];
  // Check both arrays — cancel routes by active turn, not by selected agent
  const agentRunning = (lastTurn?.isRunning ?? false) || (lastCodexTurn?.isRunning ?? false);
  const isLoading = isAgentMode ? agentRunning : isStreaming;
  // Sprint 74 R2 (#82): while an agent runs, the composer stays unlocked and
  // Enter queues the next prompt instead of sending it.
  const placeholder = isLoading && isAgentMode
    ? 'Add a follow-up… (Enter queues it for when the agent finishes)'
    : isClaudeCode
      ? 'Ask Claude... (type @ to mention an agent, / for commands)'
      : isCodex
        ? 'Ask Codex... (type / for commands)'
        : isOpenCode
          ? 'Ask OpenCode... (type / for commands)'
          : 'Ask anything... (type / for commands)';
  const hasSelectedContext = !selection.isEmpty && !!selection.text;

  // Build final message with path chips and pinned agent prepended
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

  const handleSend = useCallback((overridePrompt?: string) => {
    const prompt = overridePrompt ?? buildFinalPrompt();
    if (!prompt) return;
    // Block send when OpenCode has no keys (#76)
    if (isOpenCode && openCodeHasNoKeys) return;

    // Sprint 74 R2 (#82): while the agent runs, park the prompt in the queue
    // instead of dropping the send. Auto-sent when the run completes.
    if (shouldQueueInsteadOfSend({ isLoading, isAgentMode, hasOverridePrompt: overridePrompt !== undefined })) {
      setQueuedPrompt(prompt);
      setValue('');
      setPathChips([]);
      setShowMentionPopup(false);
      setShowCommandPopup(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (!isOnline || isLoading || (isCodex && codexStatus.state !== 'ready')) return;

    // Build hidden context (agent instructions — sent to AI but not shown in chat).
    // Dismissal + new pin can both be active when switching agents A → B.
    const hiddenParts: string[] = [];
    if (pinnedAgentDismissal) {
      hiddenParts.push(`[You are no longer acting as agent: '${pinnedAgentDismissal}'. Stop acting as that agent.]`);
    }
    if (pinnedAgent) {
      if (pinnedAgentContent) {
        hiddenParts.push(`[Agent instructions — respond as this agent for the rest of this conversation]\n\n${pinnedAgentContent}`);
      } else {
        hiddenParts.push(`[You are still acting as agent: '${pinnedAgent}']`);
      }
    } else if (pinnedAgentDismissal) {
      hiddenParts.push('[From here on, respond in your default role.]');
    }
    const hiddenContext = hiddenParts.length > 0 ? hiddenParts.join('\n\n') : undefined;

    // Collect file paths for @mentioned agents so the extension can load their instructions
    // Parsed inline to avoid referencing `mentions` which is defined later in this component.
    // Parse from the prompt actually being sent (#82): on the queued auto-send path
    // `value` has already been cleared, so an @agent mention in the queued prompt would
    // otherwise be dropped. `overridePrompt` carries the queued text in that case.
    const mentionedAgentPaths = parseMentions(discoveredAgents, overridePrompt ?? value)
      .map((m) => discoveredAgents.find((a) => a.id === m.agentId)?.filePath)
      .filter((p): p is string => !!p);

    if (isOpenCode) {
      sendOpenCodeMessage(prompt);
    } else if (isCodex) {
      sendCodexMessage(prompt, attachments.length > 0 ? attachments : undefined, pendingRuntime.mode, hideBrowserContext);
    } else {
      sendAgentMessage(prompt, attachments.length > 0 ? attachments : undefined, { skipActiveFile: hideActiveFile, skipBrowserContext: hideBrowserContext, hiddenContext, mentionedAgentPaths: mentionedAgentPaths.length > 0 ? mentionedAgentPaths : undefined });
    }
    setValue('');
    setAttachments([]);
    setPathChips([]);
    setHideActiveFile(false);
    setHideBrowserContext(false);
    setShowMentionPopup(false);
    setShowCommandPopup(false);
    clearPinnedAgentContent();
    clearPinnedAgentDismissal();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [buildFinalPrompt, attachments, isOnline, isLoading, isAgentMode, isClaudeCode, isCodex, isOpenCode, openCodeHasNoKeys, codexStatus.state, hideActiveFile, hideBrowserContext, pendingRuntime.mode, sendAgentMessage, sendCodexMessage, sendOpenCodeMessage, clearPinnedAgentContent, clearPinnedAgentDismissal, pinnedAgent, pinnedAgentContent, pinnedAgentDismissal, discoveredAgents, value]);

  // Sprint 74 R2 (#82): auto-send the queued prompt on the running → idle
  // transition. The ref-based transition check prevents double-sends on
  // unrelated re-renders while idle.
  const prevAgentRunningRef = useRef(agentRunning);
  useEffect(() => {
    const wasRunning = prevAgentRunningRef.current;
    prevAgentRunningRef.current = agentRunning;
    if (shouldAutoSendQueuedPrompt({ wasRunning, isRunning: agentRunning, queuedPrompt })) {
      const prompt = queuedPrompt as string;
      setQueuedPrompt(null);
      handleSend(prompt);
    }
  }, [agentRunning, queuedPrompt, handleSend]);

  const clearChat = useAISidebarStore((s) => s.clearChat);
  const startNewConversation = useAISidebarStore((s) => s.startNewConversation);
  const toggleHistoryPanel = useAISidebarStore((s) => s.toggleHistoryPanel);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);

  // Execute a slash command action
  const executeCommandAction = useCallback(
    (action: CommandAction) => {
      switch (action) {
        case 'clear':
          clearChat();
          break;
        case 'new':
          startNewConversation();
          break;
        case 'history':
          toggleHistoryPanel();
          break;
        case 'compact':
          // Send compact instruction to agent
          if (isClaudeCode) {
            sendAgentMessage('Please compact and summarize our conversation so far, preserving key context.');
          }
          break;
        case 'help': {
          // Show help as a system message in chat
          const helpText = 'Available commands:\n' +
            '  /clear — Clear conversation\n' +
            '  /new — Start new conversation\n' +
            '  /history — Show saved conversations\n' +
            '  /compact — Compact conversation context\n' +
            '  /settings — Open settings\n' +
            '  /cancel — Cancel current request\n' +
            '  /cost — Show cost of last turn\n' +
            '  /help — Show this help';
          sendAgentMessage(helpText);
          break;
        }
        case 'settings':
          openApiKeySettings();
          break;
        case 'cancel':
          cancelRequest();
          break;
        case 'cost': {
          // Find the last completed turn's metrics
          const lastCompleted = [...agentConversation].reverse().find((t) => t.result?.metrics);
          if (lastCompleted?.result?.metrics) {
            const m = lastCompleted.result.metrics;
            const cost = m.costUsd != null ? `$${m.costUsd.toFixed(4)}` : 'N/A';
            const duration = m.durationMs ? `${(m.durationMs / 1000).toFixed(1)}s` : 'N/A';
            const model = m.model || 'unknown';
            const msg = `Last turn: ${cost} | ${duration} | ${model}`;
            sendAgentMessage(msg);
          }
          break;
        }
      }
      setValue('');
      setShowCommandPopup(false);
    },
    [clearChat, startNewConversation, toggleHistoryPanel, openApiKeySettings, cancelRequest, agentConversation, isClaudeCode, sendAgentMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Forward to popup if open — popup handles navigation keys
      if (showMentionPopup && mentionPopupRef.current?.handleKeyDown(e)) {
        return;
      }
      if (showCommandPopup && commandPopupRef.current?.handleKeyDown(e)) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        // Check if this is a complete slash command
        const parsed = parseCommand(allCommands, value);
        if (parsed) {
          if (parsed.command.action === 'custom') {
            // Custom commands are sent as slash-command prompts to the agent
            const prompt = `/${parsed.command.id}${parsed.args ? ' ' + parsed.args : ''}`;
            // Respect the running-agent queue (#82): a slash command typed while
            // the agent is running must park in the queue like any other prompt,
            // not bypass straight to send (which drops it for Claude / misroutes
            // for Codex). Auto-send re-runs it through handleSend on completion.
            if (shouldQueueInsteadOfSend({ isLoading, isAgentMode, hasOverridePrompt: false })) {
              setQueuedPrompt(prompt);
              setValue('');
              setShowCommandPopup(false);
              return;
            }
            sendAgentMessage(prompt);
            setValue('');
            setShowCommandPopup(false);
          } else {
            executeCommandAction(parsed.command.action);
          }
          return;
        }

        handleSend();
      }

      if (e.key === 'Escape') {
        setShowMentionPopup(false);
        setShowCommandPopup(false);
      }
    },
    [handleSend, showMentionPopup, showCommandPopup, value, executeCommandAction, isLoading, isAgentMode]
  );

  // Handle text changes, @ mention detection, and / command detection
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setValue(newValue);

    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Detect / command trigger (only at start of input)
    // Show popup while typing command name (before first space)
    if (newValue.startsWith('/')) {
      const firstSpace = newValue.indexOf(' ');
      const commandPart = firstSpace === -1 ? newValue.slice(1) : null;
      if (commandPart !== null) {
        // Still typing the command name (no space yet)
        setCommandQuery(commandPart);
        setShowCommandPopup(true);
        setShowMentionPopup(false);
        setCommandPosition({ top: 0, left: 0 });
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
        // Show popup while typing agent name — allow letters, digits, hyphens
        if (/^[a-zA-Z0-9-]*$/.test(query)) {
          setMentionQuery(query);
          setMentionStartIndex(atIndex);
          setShowMentionPopup(true);

          // Position the popup above the cursor
          if (textareaRef.current && containerRef.current) {
            setMentionPosition({
              top: 0,
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

  // Handle agent selection from mention popup — uses Pin Agent flow (same as Launch Chat)
  // Removes the partial '@' text from textarea and shows the indigo pinned-agent chip instead
  const handleAgentSelect = useCallback(
    (agent: AgentDefinition) => {
      if (mentionStartIndex === null) return;

      const before = value.slice(0, mentionStartIndex);
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);

      // Strip the partial '@…' text the user was typing — pinned chip replaces it
      const newValue = before + after;
      setValue(newValue);
      setShowMentionPopup(false);
      setMentionStartIndex(null);

      // Trigger Pin Agent (loads .md as hidden context, shows indigo chip)
      const discovered = discoveredAgents.find((a) => a.id === agent.id);
      if (discovered?.filePath) {
        requestPinAgent(agent.id, discovered.filePath);
      }

      // Restore cursor at the '@' position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(mentionStartIndex, mentionStartIndex);
        }
      }, 0);
    },
    [value, mentionStartIndex, discoveredAgents, requestPinAgent]
  );

  // Handle mention popup close
  const handleMentionClose = useCallback(() => {
    setShowMentionPopup(false);
  }, []);

  // Handle slash command selection from popup — execute immediately
  const handleCommandSelect = useCallback(
    (command: SlashCommand) => {
      if (command.action === 'custom') {
        // Custom commands are sent as slash-command prompts to the agent
        const prompt = `/${command.id}`;
        sendAgentMessage(prompt);
        setValue('');
        setShowCommandPopup(false);
      } else {
        executeCommandAction(command.action);
      }
    },
    [executeCommandAction, sendAgentMessage]
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
    if (!isClaudeCode && !isCodex) return;

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
  }, [isClaudeCode, isCodex, processFile]);

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
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

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
      // Fall back to plain text — Explorer sends newline-separated paths for multi-file drag
      const lines = plainText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('/') || line.startsWith('file://')) {
          paths.push(extractPath(line));
        }
      }
    }

    // Also check for dropped files (actual file objects) — agent modes only
    if (e.dataTransfer.files.length > 0 && paths.length === 0 && isAgentMode) {
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
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
      const chip: PathChip = {
        id: `path-${++pathChipIdCounter}`,
        path,
        isFolder: !hasExtension,
      };
      setPathChips((prev) => {
        if (prev.some((p) => p.path === path)) return prev;
        return [...prev, chip];
      });
    }
  }, [isAgentMode, processFile]);

  // Listen for file paths sent from extension (Explorer context menu → "Send to AI Chat")
  useEffect(() => {
    const handler = (e: Event) => {
      const paths = (e as CustomEvent<string[]>).detail;
      if (!paths?.length) return;
      for (const path of paths) {
        const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
        const chip: PathChip = {
          id: `path-${++pathChipIdCounter}`,
          path,
          isFolder: !hasExtension,
        };
        setPathChips((prev) => {
          if (prev.some((p) => p.path === path)) return prev;
          return [...prev, chip];
        });
      }
      textareaRef.current?.focus();
    };
    window.addEventListener('ritemark:files-dropped', handler);
    return () => window.removeEventListener('ritemark:files-dropped', handler);
  }, []);

  // Reset "hide active file" when the active file changes
  useEffect(() => {
    setHideActiveFile(false);
    setHideBrowserContext(false);
  }, [activeFilePath]);

  // Determine if active file context chip should show
  // Don't show if: no active file, user dismissed it, or it's already in manual path chips
  const showActiveFileChip = activeFilePath && !hideActiveFile &&
    !pathChips.some((p) => p.path === activeFilePath || p.path.endsWith('/' + activeFilePath));
  const showBrowserContextChip = currentBrowserContext?.url && !hideBrowserContext;

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
  const mentions = parseMentions(discoveredAgents, value);

  const visibleAgents = agents.filter((a) => !a.experimental || agenticEnabled);
  const canUseClaude = visibleAgents.some((a) => a.id === 'claude-code');
  const canUseCodex = visibleAgents.some((a) => a.id === 'codex');
  const currentClaudeModel = models.find((m) => m.id === selectedModel) || models[0];
  const currentCodexModel = codexModels.find((m) => m.id === codexSelectedModel) || codexModels[0];
  // Sprint 76 R6: OpenCode model picker — only providers whose key is configured.
  const openCodeModels: { compositeValue: string; label: string; description: string }[] = [];
  if (opencodeEnabled && byokProviderModels) {
    for (const provider of ['google', 'openai', 'anthropic', 'openrouter'] as const) {
      if (acpProviders?.[provider]) {
        for (const m of byokProviderModels[provider] || []) {
          openCodeModels.push({ compositeValue: `opencode:${provider}/${m.id}`, label: m.label, description: m.description });
        }
      }
    }
  }
  const currentOpenCodeEntry = openCodeModels.find((m) => m.compositeValue === opencodeSelectedModel);
  const runtimeSelectValue = isOpenCode
    ? (opencodeSelectedModel || 'opencode:')
    : pendingRuntime.runtimeId === 'codex'
      ? `codex:${currentCodexModel?.id || codexSelectedModel}`
      : `claude-code:${currentClaudeModel?.id || selectedModel}`;
  const runtimeFooterLabel = isOpenCode
    ? `OpenCode · ${(currentOpenCodeEntry || openCodeModels[0])?.label || 'Select a model…'}`
    : pendingRuntime.runtimeId === 'codex'
      ? `Codex · ${currentCodexModel?.label || codexSelectedModel || 'Model'}`
      : `Claude · ${currentClaudeModel?.label || selectedModel || 'Model'}`;
  const contextCount = (showActiveFileChip ? 1 : 0) + (showBrowserContextChip ? 1 : 0) + pathChips.length;
  const contextSummary = [
    attachmentCount > 0 ? `${attachmentCount} attached` : null,
    contextCount > 0 ? `${contextCount} context` : null,
    mentions.length > 0 ? `${mentions.length} agent${mentions.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  function handleRuntimeChange(value: string) {
    if (value.startsWith('claude-code:')) {
      const modelId = value.slice('claude-code:'.length);
      if (selectedAgent !== 'claude-code') {
        selectAgent('claude-code' as AgentId);
      }
      selectModel(modelId);
      setPendingRuntime({ runtimeId: 'claude-code', modelId });
    } else if (value.startsWith('codex:')) {
      const modelId = value.slice('codex:'.length);
      if (selectedAgent !== 'codex') {
        selectAgent('codex' as AgentId);
      }
      selectCodexModel(modelId);
      setPendingRuntime({ runtimeId: 'codex', modelId });
    } else if (value.startsWith('opencode:')) {
      // composite: opencode:<provider>/<model> — host expects bare provider/model
      const providerModel = value.slice('opencode:'.length);
      if (selectedAgent !== 'opencode') {
        selectAgent('opencode' as AgentId);
      }
      selectOpenCodeModel(value);
      setPendingRuntime({ runtimeId: 'opencode', modelId: providerModel });
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative px-3 py-2.5 ${
        // Sprint 74 R2: no separator stripe above a notch — the notch visually
        // belongs to the input card, so the container border-top is dropped
        // whenever any notch (selected text / queued prompt) is showing.
        hasSelectedContext || queuedPrompt ? '' : 'border-t border-[var(--r-hairline)]'
      } ${isDragOver ? 'bg-[var(--r-surface-soft)]' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sprint 64 bonus track (S5): docked selected-text context tab.
          Renders only when the editor has a non-empty selection. The tab's
          rounded-t-lg + border-b-0 makes it visually connect to the input
          card below; the negative -mb-px on the tab overlaps the card's
          top border by 1px so there's no seam. */}
      <SelectedContextTab />

      {/* Sprint 74 R2 (#82): queued-prompt notch. Same SelectedContextTab notch
          pattern. When stacked below the selected-text tab it drops its top
          rounding/border and uses a thin internal divider instead — one visual
          block, zero seams (notch-stack rule, see prototypes/composer-queue.html). */}
      {queuedPrompt && (
        <div
          className={`mx-2.5 -mb-px px-2.5 py-1.5 border-[rgba(148,163,184,0.20)]
            bg-gradient-to-b from-[rgba(248,250,252,0.82)] to-[rgba(248,250,252,0.52)]
            dark:from-[rgba(25,22,53,0.62)] dark:to-[rgba(25,22,53,0.62)] dark:border-[rgba(129,140,248,0.16)]
            ${hasSelectedContext
              ? 'border-l border-r border-t border-t-[rgba(148,163,184,0.14)] dark:border-t-[rgba(129,140,248,0.10)]'
              : 'rounded-t-lg border border-b-0'}`}
          role="status"
          aria-label="Queued prompt"
        >
          <div className="flex items-center gap-1.5">
            <Icon name="clock" size={12} className="shrink-0 opacity-60" />
            <span className="text-[11px] font-medium text-[var(--r-ink-muted)] flex-1 truncate">
              Queued — sends when the agent finishes
            </span>
            <button
              onClick={() => setQueuedPrompt(null)}
              className="
                shrink-0 inline-flex items-center justify-center
                w-4 h-4 rounded
                text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)]
                focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--r-ring-color)]
                transition-colors
              "
              aria-label="Discard queued prompt"
              title="Discard queued prompt"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--r-ink-body)] truncate">
            {queuedPrompt}
          </div>
        </div>
      )}

      {/* Drag overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--vscode-focusBorder)] bg-[var(--vscode-editor-background)]/90 pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-[var(--r-ink-strong)]">
            <Icon name="file" size={20} />
            Drop files or folders here
          </div>
        </div>
      )}

      {/* @ Mention Popup */}
      {showMentionPopup && (
        <AgentMentionPopup
          ref={mentionPopupRef}
          query={mentionQuery}
          onSelect={handleAgentSelect}
          onClose={handleMentionClose}
          position={mentionPosition}
        />
      )}

      {/* Slash Command Popup */}
      {showCommandPopup && (
        <SlashCommandPopup
          ref={commandPopupRef}
          query={commandQuery}
          onSelect={handleCommandSelect}
          onClose={handleCommandClose}
          position={commandPosition}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--r-hairline)] bg-[var(--vscode-input-background)] shadow-[0_1px_2px_rgba(30,27,75,0.04)] focus-within:border-[var(--r-hairline-strong)] focus-within:shadow-[0_0_0_1px_rgba(100,116,139,0.08)]">
        {/* Context chips: active file + browser + manually added paths + @mentions + pinned agent */}
        {(showActiveFileChip || showBrowserContextChip || pathChips.length > 0 || mentions.length > 0 || pinnedAgent) && (
          <div className="flex gap-1.5 px-2.5 pt-2 flex-wrap">
            {showActiveFileChip && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/70 text-[var(--r-ink-muted)]">
                <Icon name="file-text" size={12} className="shrink-0" />
                <span className="truncate max-w-[140px]" title={activeFilePath!}>
                  Active: {getDisplayPath(activeFilePath!)}
                </span>
                <button
                  onClick={() => setHideActiveFile(true)}
                  className="shrink-0 rounded hover:text-[var(--r-error)]"
                  title="Remove from context"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}
            {showBrowserContextChip && (
              currentBrowserContext?.annotationMode && currentBrowserContext.screenshotPreview
                ? (
                  /* Sprint 78 (#73): annotation mode active — show screenshot preview chip
                     instead of the URL chip. Visual matches the image attachment strip. */
                  <div className="relative group overflow-hidden rounded-md border border-[var(--r-indigo-300,#a5b4fc)] bg-[var(--r-surface-muted)]/70">
                    <div className="w-14 h-14">
                      <img
                        src={currentBrowserContext.screenshotPreview.dataUrl}
                        alt={`Browser: ${currentBrowserContext.title || currentBrowserContext.url}`}
                        className="w-full h-full object-cover"
                        title={`Browser screenshot — ${currentBrowserContext.title || currentBrowserContext.url}`}
                      />
                    </div>
                    <button
                      onClick={() => setHideBrowserContext(true)}
                      className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-bl border border-[var(--r-hairline)] bg-[var(--r-surface)] text-[var(--r-ink-body)] shadow-sm opacity-95 group-hover:text-[var(--r-error)] group-hover:opacity-100 transition-colors"
                      title="Remove browser screenshot from this turn"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                )
                : (
                  /* Normal mode or no screenshot yet — URL globe chip */
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border ${currentBrowserContext?.annotationMode ? 'border-[var(--r-indigo-300,#a5b4fc)] bg-[var(--r-indigo-50,#eef2ff)] text-[var(--r-indigo-700,#4338ca)]' : 'border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/70 text-[var(--r-ink-muted)]'}`}>
                    <Icon name="globe" size={12} className="shrink-0" />
                    <span className="truncate max-w-[180px]" title={currentBrowserContext?.url}>
                      Browser: {currentBrowserContext?.title || currentBrowserContext?.url}
                      {currentBrowserContext?.annotationMode ? ' · Annotation' : ''}
                    </span>
                    <button
                      onClick={() => setHideBrowserContext(true)}
                      className="shrink-0 rounded hover:text-[var(--r-error)]"
                      title="Remove browser context from this turn"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                )
            )}
            {pathChips.map((chip) => (
              <div
                key={chip.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/70 text-[var(--r-ink-muted)]"
              >
                <Icon name="file" size={12} className="shrink-0" />
                <span className="truncate max-w-[140px]" title={chip.path}>
                  {getDisplayPath(chip.path)}
                </span>
                <button
                  onClick={() => removePathChip(chip.id)}
                  className="shrink-0 rounded hover:text-[var(--r-error)]"
                  title="Remove"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            {pinnedAgent && (() => {
              const agent = findAgent(discoveredAgents, pinnedAgent);
              const displayName = agent?.name ?? pinnedAgent;
              return (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-[var(--r-indigo-300,#a5b4fc)] bg-[var(--r-indigo-50,#eef2ff)] text-[var(--r-indigo-700,#4338ca)]">
                  <Icon name="robot" size={12} className="shrink-0" />
                  <span>{displayName}</span>
                  <button
                    onClick={() => setPinnedAgent(null)}
                    className="shrink-0 rounded hover:opacity-70"
                    title="Remove agent"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              );
            })()}
            {mentions.map((m) => {
              const agent = findAgent(discoveredAgents, m.agentId);
              if (!agent) return null;
              return (
                <div
                  key={m.start}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/70 text-[var(--r-ink-muted)]"
                >
                  <Icon name="robot" size={12} />
                  @{agent.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Sprint 74 R2 (#82): textarea stays unlocked during agent runs so the
            user can draft + queue the next prompt. It is disabled only while a
            prompt is already queued (one queued prompt at a time). */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={!!queuedPrompt}
          rows={2}
          className="block w-full resize-none bg-transparent px-3 py-2.5 leading-relaxed text-[var(--vscode-input-foreground)] placeholder:text-[var(--r-ink-faint)] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: 'var(--chat-font-size, 13px)' }}
        />

        {/* Attachment thumbnail strip */}
        {attachments.length > 0 && (
          <div className="flex gap-1.5 px-2.5 pb-2 flex-wrap">
            {attachments.map((att) => (
              <div key={att.id} className="relative group overflow-hidden rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/70">
                {att.kind === 'image' && att.thumbnail ? (
                  <div className="w-14 h-14">
                    <img
                      src={att.thumbnail}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-7 items-center gap-1.5 px-2 max-w-[160px]">
                    {att.kind === 'pdf' ? (
                      <Icon name="file-text" size={14} className="shrink-0 text-[var(--r-ink-muted)]" />
                    ) : (
                      <Icon name="file-image" size={14} className="shrink-0 text-[var(--r-ink-muted)]" />
                    )}
                    <span className="text-[10px] text-[var(--r-ink-muted)] truncate">
                      {att.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-bl border border-[var(--r-hairline)] bg-[var(--r-surface)] text-[var(--r-ink-body)] shadow-sm opacity-95 group-hover:text-[var(--r-error)] group-hover:opacity-100 transition-colors"
                  title="Remove"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-transparent">
          <Select value={runtimeSelectValue} onValueChange={handleRuntimeChange}>
            <SelectTrigger
              className="h-6 w-36 max-w-[42vw] min-w-0 shrink gap-1 border-transparent bg-transparent px-1.5 py-0 text-[11px] font-medium text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] focus:ring-0 focus:border-[var(--r-hairline)] [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0"
              title={runtimeFooterLabel}
            >
              <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
                {runtimeFooterLabel}
              </div>
            </SelectTrigger>
            <SelectContent
              className={[
                'max-h-[min(72vh,28rem)]',
                '[&_[data-radix-select-viewport]]:max-h-[min(72vh,28rem)]',
                '[&_[data-radix-select-viewport]]:overflow-y-scroll',
                '[&_[data-radix-select-viewport]]:pr-1',
                '[&_[data-radix-select-viewport]]:[scrollbar-gutter:stable]',
                '[&_[data-radix-select-viewport]]:[scrollbar-width:thin]',
                '[&_[data-radix-select-viewport]]:[scrollbar-color:var(--vscode-scrollbarSlider-background,rgba(120,120,120,0.45))_transparent]',
                '[&_[data-radix-select-viewport]::-webkit-scrollbar]:w-1.5',
                '[&_[data-radix-select-viewport]::-webkit-scrollbar-track]:bg-transparent',
                '[&_[data-radix-select-viewport]::-webkit-scrollbar-thumb]:rounded-full',
                '[&_[data-radix-select-viewport]::-webkit-scrollbar-thumb]:bg-[var(--vscode-scrollbarSlider-background,rgba(120,120,120,0.45))]',
                '[&_[data-radix-select-viewport]::-webkit-scrollbar-thumb:hover]:bg-[var(--vscode-scrollbarSlider-hoverBackground,rgba(120,120,120,0.65))]',
              ].join(' ')}
            >
              {canUseClaude && models.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Claude</SelectLabel>
                  {models.map((model) => {
                    const { versionLine, tagline } = parseModelDescription(model.description);
                    const primary = versionLine || model.label;
                    return (
                      <SelectItem
                        key={model.id}
                        value={`claude-code:${model.id}`}
                        className="items-start py-1.5"
                      >
                        <div className="block w-full">
                          <div className="text-[13px] font-medium text-[var(--r-ink-strong)] leading-tight">
                            {primary}
                          </div>
                          {tagline && (
                            <div className="text-[11px] text-[var(--r-ink-muted)] leading-snug mt-0.5">
                              {tagline}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
              {canUseClaude && models.length > 0 && canUseCodex && codexModels.length > 0 && <SelectSeparator />}
              {canUseCodex && codexModels.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px]">Codex</SelectLabel>
                  {codexModels.map((model) => {
                    const { versionLine, tagline } = parseModelDescription(model.description);
                    const primary = versionLine || model.label;
                    return (
                      <SelectItem
                        key={model.id}
                        value={`codex:${model.id}`}
                        className="items-start py-1.5"
                      >
                        <div className="block w-full">
                          <div className="text-[13px] font-medium text-[var(--r-ink-strong)] leading-tight">
                            {primary}
                          </div>
                          {tagline && (
                            <div className="text-[11px] text-[var(--r-ink-muted)] leading-snug mt-0.5">
                              {tagline}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
              {/* Sprint 76 R6/R7: OpenCode — provider/model rows, flag-gated */}
              {opencodeEnabled && ((canUseClaude && models.length > 0) || (canUseCodex && codexModels.length > 0)) && <SelectSeparator />}
              {opencodeEnabled && (
                <SelectGroup>
                  <SelectLabel className="text-[10px]">OpenCode</SelectLabel>
                  {openCodeModels.length > 0 ? (
                    openCodeModels.map((entry) => (
                      <SelectItem
                        key={entry.compositeValue}
                        value={entry.compositeValue}
                        className="items-start py-1.5"
                      >
                        <div className="block w-full">
                          <div className="text-[13px] font-medium text-[var(--r-ink-strong)] leading-tight">
                            {entry.label}
                          </div>
                          {entry.description && (
                            <div className="text-[11px] text-[var(--r-ink-muted)] leading-snug mt-0.5">
                              {entry.description}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    /* A2: no provider keys configured — non-selectable row */
                    <div className="px-2 py-1.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--r-ink-muted)]">Add API keys to use OpenCode</span>
                      <button
                        className="text-[11px] text-[var(--r-accent-deep)] cursor-pointer hover:underline bg-transparent border-none p-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAgentSettings();
                        }}
                      >
                        Open Settings
                      </button>
                    </div>
                  )}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {/* Unified approval policy — applies to all runtimes. */}
          <div className="inline-flex shrink-0 overflow-hidden rounded border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/60">
            {(['auto', 'ask', 'plan'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPendingRuntime({ mode })}
                title={
                  mode === 'auto' ? 'Auto — agent acts without asking'
                  : mode === 'ask' ? 'Ask — approve file writes & shell commands'
                  : 'Plan — propose a plan, then execute after approval'
                }
                className={[
                  'h-5 px-2 text-[10px] font-medium transition-colors capitalize',
                  pendingRuntime.mode === mode
                    ? 'bg-[var(--r-accent-soft)] text-[var(--r-accent-deep)] shadow-[inset_0_0_0_1px_var(--r-accent-fainter)]'
                    : 'text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]',
                ].join(' ')}
              >
                {mode}
              </button>
            ))}
          </div>

          {contextSummary && (
            <span className="min-w-0 truncate text-[10px] text-[var(--r-ink-faint)]">
              {contextSummary}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {isAgentMode && (
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
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Attach files"
                >
                  <Icon name="paperclip" size={14} />
                </button>
              </>
            )}
            {isLoading ? (
              <button
                onClick={cancelRequest}
                className="flex h-7 w-7 items-center justify-center rounded border border-[var(--r-hairline)] bg-[var(--r-surface-soft)] text-[var(--r-ink-body)] hover:bg-[var(--r-surface-muted)] shrink-0"
                title="Stop"
              >
                <Icon name="square" size={14} />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!value.trim() || !isOnline}
                className="flex h-7 w-7 items-center justify-center rounded border border-[var(--r-hairline)] bg-[var(--r-surface-soft)] text-[var(--r-ink-body)] hover:bg-[var(--r-surface-muted)] hover:text-[var(--r-ink-strong)] disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                title={sendTitle}
              >
                <Icon name="paper-plane-right" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
