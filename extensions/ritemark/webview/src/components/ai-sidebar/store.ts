/**
 * AI Sidebar Store (Zustand)
 *
 * Central state management for the AI sidebar.
 * Handles messages from the extension and provides actions for components.
 */

import { create } from 'zustand';
import { vscode } from '../../lib/vscode';
import {
  listConversations,
  loadConversation,
  saveConversation,
  deleteConversation as deleteConversationFromStorage,
  generateId,
  generateTitle,
  setWorkspaceContext,
  type SavedConversation,
} from './chatHistoryStorage';
import type {
  AgentId,
  AgentInfo,
  ModelOption,
  ChatMessage,
  ConversationEntry,
  EditorSelection,
  RAGCitation,
  WidgetData,
  AgentConversationTurn,
  CodexConversationTurn,
  FileAttachment,
  DiscoveredAgent,
  DiscoveredCommand,
  IndexStatus,
  IndexProgress,
  SetupStatus,
  ExtensionMessage,
  SubagentProgress,
  AgentProgress,
} from './types';

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

// ── Context window estimation ─────────────────────────────────────────
const CONTEXT_WINDOW_TOKENS = 200_000;
const SYSTEM_OVERHEAD_TOKENS = 600;

function estimateConversationTokens(turns: AgentConversationTurn[]): number {
  let tokens = SYSTEM_OVERHEAD_TOKENS;
  for (const turn of turns) {
    // Per-turn framing overhead (role tokens, message structure)
    tokens += 200;
    // User prompt
    tokens += Math.ceil((turn.userPrompt?.length || 0) / 4);
    // Attachments
    if (turn.attachments) {
      for (const att of turn.attachments) {
        if (att.kind === 'text') {
          tokens += Math.ceil(att.data.length / 4);
        } else if (att.kind === 'image') {
          // Images use vision tokens — typically 1000-2000 tokens regardless of base64 size
          // A high-res screenshot is ~1600 tokens, not base64_length/4
          tokens += 1600;
        } else {
          // PDFs: base64 → binary → tokens (rough estimate)
          tokens += Math.ceil(att.data.length * 0.75 / 4);
        }
      }
    }
    // Agent response (only the final text — tool call internals are managed by SDK compaction)
    if (turn.result?.text) {
      tokens += Math.ceil(turn.result.text.length / 4);
    }
    // Tool calls: count only tool_use activities (not thinking/init/subagent metadata)
    const toolUseCount = (turn.activities || []).filter(a => a.type === 'tool_use').length;
    tokens += toolUseCount * 300;
  }
  return tokens;
}

function computeContextState(turns: AgentConversationTurn[]) {
  const estimatedTokens = estimateConversationTokens(turns);
  const contextUsagePercent = Math.min(100, (estimatedTokens / CONTEXT_WINDOW_TOKENS) * 100);
  const showContextWarning = contextUsagePercent >= 70;
  return { estimatedTokens, contextUsagePercent, showContextWarning };
}

interface AISidebarState {
  // ── Connection state ──
  hasApiKey: boolean;
  isOnline: boolean;
  ready: boolean;

  // ── Agent config ──
  agenticEnabled: boolean;
  selectedAgent: AgentId;
  selectedModel: string;
  agents: AgentInfo[];
  models: ModelOption[];

  // ── Selection ──
  selection: EditorSelection;
  activeFilePath: string | null;

  // ── Chat state (Ritemark Agent) ──
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
  streamingContent: string;
  isStreaming: boolean;
  pendingCitations: RAGCitation[];

  // ── Agent state (Claude Code) ──
  agentConversation: AgentConversationTurn[];

  // ── Codex state ──
  codexEnabled: boolean;
  codexModels: ModelOption[];
  codexSelectedModel: string;
  codexConversation: CodexConversationTurn[];

  // ── Chat history state ──
  currentConversationId: string | null;
  savedConversations: SavedConversation[];
  showHistoryPanel: boolean;

  // ── Setup state (Claude Code) ──
  setupStatus: SetupStatus | null;
  setupInProgress: boolean;
  setupError: string | null;
  hasSeenWelcome: boolean;

  // ── Index state ──
  indexStatus: IndexStatus;
  indexProgress: IndexProgress | null;
  isIndexing: boolean;

  // ── Discovered agents/commands from .claude/ ──
  discoveredAgents: DiscoveredAgent[];
  discoveredCommands: DiscoveredCommand[];

  // ── Appearance ──
  chatFontSize: number;

  // ── Context tracking ──
  estimatedTokens: number;
  contextUsagePercent: number;
  showContextWarning: boolean;

  // ── Actions ──
  selectAgent: (agentId: AgentId) => void;
  selectModel: (modelId: string) => void;
  sendChatMessage: (prompt: string) => void;
  sendAgentMessage: (prompt: string, attachments?: FileAttachment[], options?: { skipActiveFile?: boolean }) => void;
  cancelRequest: () => void;
  applyWidget: (widget: WidgetData) => void;
  discardWidget: (messageId: string) => void;
  configureApiKey: () => void;
  reindex: () => void;
  cancelIndex: () => void;
  openSource: (filePath: string, page?: number) => void;
  clearChat: () => void;
  startInstall: () => void;
  startLogin: () => void;
  openApiKeySettings: () => void;
  recheckSetup: () => void;
  approvePlan: (turnId: string) => void;
  rejectPlan: (turnId: string, feedback?: string) => void;
  dismissWelcome: () => void;
  sendCodexMessage: (prompt: string, attachments?: FileAttachment[]) => void;
  selectCodexModel: (modelId: string) => void;
  handleCodexApproval: (requestId: string | number, approved: boolean) => void;

  // ── Chat history actions ──
  loadConversationList: () => void;
  saveCurrentConversation: () => void;
  loadSavedConversation: (id: string) => void;
  deleteSavedConversation: (id: string) => void;
  startNewConversation: () => void;
  toggleHistoryPanel: () => void;

  // ── Internal: message handler ──
  handleExtensionMessage: (message: ExtensionMessage) => void;
}

export const useAISidebarStore = create<AISidebarState>((set, get) => ({
  // ── Initial state ──
  hasApiKey: false,
  isOnline: true,
  ready: false,

  agenticEnabled: false,
  selectedAgent: 'ritemark-agent',
  selectedModel: 'claude-sonnet-4-5',
  agents: [],
  models: [],

  selection: { text: '', isEmpty: true, from: 0, to: 0 },
  activeFilePath: null,

  chatMessages: [],
  conversationHistory: [],
  streamingContent: '',
  isStreaming: false,
  pendingCitations: [],

  agentConversation: [],

  codexEnabled: false,
  codexModels: [],
  codexSelectedModel: 'gpt-5.3-codex',
  codexConversation: [],

  currentConversationId: null,
  savedConversations: [],
  showHistoryPanel: false,

  setupStatus: null,
  setupInProgress: false,
  setupError: null,
  hasSeenWelcome: false,

  indexStatus: { totalDocs: 0, totalChunks: 0 },
  indexProgress: null,
  chatFontSize: 13,
  isIndexing: false,
  discoveredAgents: [],
  discoveredCommands: [],

  estimatedTokens: 0,
  contextUsagePercent: 0,
  showContextWarning: false,

  // ── Actions ──

  selectAgent: (agentId) => {
    set({ selectedAgent: agentId });
    vscode.postMessage({ type: 'ai-select-agent', agentId });
  },

  selectModel: (modelId) => {
    set({ selectedModel: modelId });
    vscode.postMessage({ type: 'ai-select-model', modelId });
  },

  sendChatMessage: (prompt) => {
    const state = get();
    if (state.isStreaming) return;

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    set({
      chatMessages: [...state.chatMessages, userMsg],
      conversationHistory: [...state.conversationHistory, { role: 'user', content: prompt }],
      isStreaming: true,
      streamingContent: '',
      pendingCitations: [],
    });

    vscode.postMessage({
      type: 'ai-execute',
      prompt,
      selection: state.selection,
      conversationHistory: [...state.conversationHistory, { role: 'user', content: prompt }],
    });
  },

  sendAgentMessage: (prompt, attachments?, options?) => {
    const state = get();
    const lastTurn = state.agentConversation[state.agentConversation.length - 1];
    if (lastTurn?.isRunning) return;

    const turn: AgentConversationTurn = {
      id: nextId(),
      userPrompt: prompt,
      attachments,
      activities: [],
      isRunning: true,
      isPlan: false,
      planHandled: false,
      timestamp: Date.now(),
    };

    set({ agentConversation: [...state.agentConversation, turn] });

    // Send attachments as serializable payload (strip thumbnails for extension)
    const attachmentPayload = attachments?.map((att) => ({
      id: att.id,
      kind: att.kind,
      name: att.name,
      data: att.data,
      mediaType: att.mediaType,
    }));
    vscode.postMessage({ type: 'ai-execute-agent', prompt, images: attachmentPayload, skipActiveFile: options?.skipActiveFile });
  },

  cancelRequest: () => {
    const state = get();
    if (state.selectedAgent === 'codex') {
      vscode.postMessage({ type: 'codex-cancel' });
      const conv = [...state.codexConversation];
      const last = conv[conv.length - 1];
      if (last?.isRunning) {
        conv[conv.length - 1] = { ...last, isRunning: false, result: { status: 'interrupted', error: 'Cancelled by user' } };
      }
      set({ codexConversation: conv });
    } else if (state.selectedAgent === 'claude-code') {
      vscode.postMessage({ type: 'ai-cancel-agent' });
      const conv = [...state.agentConversation];
      const last = conv[conv.length - 1];
      if (last?.isRunning) {
        conv[conv.length - 1] = {
          ...last,
          isRunning: false,
          result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'Cancelled by user' },
        };
      }
      set({ agentConversation: conv });
    } else {
      vscode.postMessage({ type: 'ai-cancel' });
      set({ isStreaming: false, streamingContent: '' });
    }
  },

  applyWidget: (widget) => {
    vscode.postMessage({
      type: 'execute-widget',
      toolName: widget.toolName,
      args: widget.args,
      selection: widget.selection,
    });
    const state = get();
    set({
      chatMessages: [
        ...state.chatMessages,
        { id: nextId(), role: 'assistant', content: 'Applied.', timestamp: Date.now() },
      ],
    });
  },

  discardWidget: (messageId) => {
    const state = get();
    // Remove widget from the message
    set({
      chatMessages: state.chatMessages.map((m) =>
        m.id === messageId ? { ...m, widget: undefined } : m
      ),
    });
  },

  configureApiKey: () => {
    vscode.postMessage({ type: 'ai-configure-key' });
  },

  reindex: () => {
    vscode.postMessage({ type: 'reindex' });
  },

  cancelIndex: () => {
    vscode.postMessage({ type: 'cancelIndex' });
  },

  openSource: (filePath, page) => {
    vscode.postMessage({ type: 'open-source', filePath, page });
  },

  startInstall: () => {
    set({ setupInProgress: true, setupError: null });
    vscode.postMessage({ type: 'agent-setup:install' });
  },

  startLogin: () => {
    set({ setupInProgress: true, setupError: null });
    vscode.postMessage({ type: 'agent-setup:login' });
  },

  openApiKeySettings: () => {
    vscode.postMessage({ type: 'agent-setup:apikey' });
  },

  recheckSetup: () => {
    set({ setupError: null });
    vscode.postMessage({ type: 'agent-setup:check' });
  },

  approvePlan: (turnId) => {
    const state = get();
    const conv = state.agentConversation.map((t) =>
      t.id === turnId ? { ...t, planHandled: true } : t
    );
    set({ agentConversation: conv });

    // Send approval as a follow-up message to the agent
    vscode.postMessage({
      type: 'ai-execute-agent',
      prompt: 'Plan approved. Proceed with implementation.',
    });

    // Add a new running turn for the implementation
    const implTurn: AgentConversationTurn = {
      id: nextId(),
      userPrompt: 'Plan approved. Proceed with implementation.',
      activities: [],
      isRunning: true,
      isPlan: false,
      planHandled: false,
      timestamp: Date.now(),
    };
    set({ agentConversation: [...conv, implTurn] });
  },

  rejectPlan: (turnId, feedback?) => {
    const state = get();
    const conv = state.agentConversation.map((t) =>
      t.id === turnId ? { ...t, planHandled: true } : t
    );
    set({ agentConversation: conv });

    if (feedback) {
      const rejectPrompt = `Plan rejected. ${feedback}`;
      vscode.postMessage({
        type: 'ai-execute-agent',
        prompt: rejectPrompt,
      });

      const retryTurn: AgentConversationTurn = {
        id: nextId(),
        userPrompt: rejectPrompt,
        activities: [],
        isRunning: true,
        isPlan: false,
        planHandled: false,
        timestamp: Date.now(),
      };
      set({ agentConversation: [...conv, retryTurn] });
    }
  },

  dismissWelcome: () => {
    set({ hasSeenWelcome: true });
    vscode.postMessage({ type: 'agent-setup:dismiss-welcome' });
  },

  sendCodexMessage: (prompt, attachments?) => {
    const state = get();
    const lastTurn = state.codexConversation[state.codexConversation.length - 1];
    if (lastTurn?.isRunning) return;

    const turn: CodexConversationTurn = {
      id: nextId(),
      userPrompt: prompt,
      attachments,
      streamingText: '',
      activities: [],
      isRunning: true,
      timestamp: Date.now(),
    };

    set({ codexConversation: [...state.codexConversation, turn] });
    vscode.postMessage({
      type: 'codex-execute',
      prompt,
      model: state.codexSelectedModel,
      attachments: attachments?.map(a => ({ kind: a.kind, data: a.data, mediaType: a.mediaType })),
    });
  },

  selectCodexModel: (modelId) => {
    set({ codexSelectedModel: modelId });
  },

  handleCodexApproval: (requestId, approved) => {
    const state = get();
    // Clear the approval from the current turn
    const conv = state.codexConversation.map((t) =>
      t.approval?.requestId === requestId ? { ...t, approval: undefined } : t
    );
    set({ codexConversation: conv });
    vscode.postMessage({ type: 'codex-approve', requestId, approved });
  },

  // ── Chat history actions ──

  loadConversationList: () => {
    const list = listConversations();
    set({ savedConversations: list });
  },

  saveCurrentConversation: () => {
    const state = get();
    const hasContent =
      state.agentConversation.length > 0 ||
      state.codexConversation.length > 0 ||
      state.chatMessages.length > 0;

    if (!hasContent) return;

    const id = state.currentConversationId || generateId();
    const title = generateTitle(state.agentConversation, state.chatMessages, state.codexConversation);
    const now = Date.now();

    const existingConv = state.savedConversations.find((c) => c.id === id);
    const createdAt = existingConv?.createdAt || now;

    saveConversation({
      id,
      title,
      agentId: state.selectedAgent,
      createdAt,
      updatedAt: now,
      agentConversation: state.agentConversation,
      codexConversation: state.codexConversation,
      chatMessages: state.chatMessages,
      conversationHistory: state.conversationHistory,
    });

    // Refresh the list
    const list = listConversations();
    set({ currentConversationId: id, savedConversations: list });
  },

  loadSavedConversation: (id) => {
    const data = loadConversation(id);
    if (!data) return;

    // Handle legacy saves: Codex conversations were stored in agentConversation
    // before the codexConversation field was added
    let agentConv = data.agentConversation || [];
    let codexConv = data.codexConversation || [];
    if (data.agentId === 'codex' && codexConv.length === 0 && agentConv.length > 0) {
      codexConv = agentConv as unknown as typeof codexConv;
      agentConv = [];
    }

    const contextState = computeContextState(agentConv);
    set({
      currentConversationId: id,
      selectedAgent: data.agentId,
      agentConversation: agentConv,
      codexConversation: codexConv,
      chatMessages: data.chatMessages || [],
      conversationHistory: data.conversationHistory || [],
      showHistoryPanel: false,
      ...contextState,
    });

    // Update agent selection in extension
    vscode.postMessage({ type: 'ai-select-agent', agentId: data.agentId });
  },

  deleteSavedConversation: (id) => {
    const state = get();
    deleteConversationFromStorage(id);

    // If deleting current conversation, clear it
    if (state.currentConversationId === id) {
      set({
        currentConversationId: null,
        chatMessages: [],
        conversationHistory: [],
        agentConversation: [],
        codexConversation: [],
      });
    }

    // Refresh the list
    const list = listConversations();
    set({ savedConversations: list });
  },

  startNewConversation: () => {
    const state = get();
    // Save current conversation first if it has content
    const hasContent =
      state.agentConversation.length > 0 ||
      state.codexConversation.length > 0 ||
      state.chatMessages.length > 0;
    if (hasContent && state.currentConversationId) {
      get().saveCurrentConversation();
    }

    // Clear and start fresh
    set({
      currentConversationId: null,
      chatMessages: [],
      conversationHistory: [],
      streamingContent: '',
      isStreaming: false,
      pendingCitations: [],
      agentConversation: [],
      codexConversation: [],
      showHistoryPanel: false,
      estimatedTokens: 0,
      contextUsagePercent: 0,
      showContextWarning: false,
    });
  },

  toggleHistoryPanel: () => {
    const state = get();
    if (!state.showHistoryPanel) {
      // Load list when opening
      get().loadConversationList();
    }
    set({ showHistoryPanel: !state.showHistoryPanel });
  },

  clearChat: () => {
    set({
      chatMessages: [],
      conversationHistory: [],
      streamingContent: '',
      isStreaming: false,
      pendingCitations: [],
      agentConversation: [],
      estimatedTokens: 0,
      contextUsagePercent: 0,
      showContextWarning: false,
    });
  },

  // ── Message handler ──

  handleExtensionMessage: (message) => {
    const state = get();

    switch (message.type) {
      case 'ai-key-status':
        set({ hasApiKey: message.hasKey, ready: true });
        break;

      case 'connectivity-status':
        set({ isOnline: message.isOnline });
        break;

      case 'agent:config':
        // Set workspace context for per-project history scoping
        if (message.workspacePath) {
          setWorkspaceContext(message.workspacePath);
        }
        set({
          agenticEnabled: message.agenticEnabled,
          codexEnabled: message.codexEnabled ?? false,
          selectedAgent: (message.selectedAgent as AgentId) || 'ritemark-agent',
          selectedModel: message.selectedModel || 'claude-sonnet-4-5',
          agents: message.agents,
          models: message.models || [],
          codexModels: message.codexModels || [],
          setupStatus: message.setupStatus ?? get().setupStatus,
          hasSeenWelcome: message.hasSeenWelcome ?? get().hasSeenWelcome,
          discoveredAgents: message.discoveredAgents || [],
          discoveredCommands: message.discoveredCommands || [],
        });
        break;

      case 'selection-update':
        set({
          selection: message.selection,
          ...(message.activeFilePath !== undefined ? { activeFilePath: message.activeFilePath ?? null } : {}),
        });
        break;

      case 'active-file-changed':
        set({ activeFilePath: message.path });
        break;

      case 'ai-streaming':
        set({ streamingContent: message.content });
        break;

      case 'ai-result': {
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          content: message.message || '',
          citations: message.hasRagContext ? state.pendingCitations : undefined,
          timestamp: Date.now(),
        };
        set({
          isStreaming: false,
          streamingContent: '',
          chatMessages: [...state.chatMessages, assistantMsg],
          conversationHistory: [
            ...state.conversationHistory,
            { role: 'assistant', content: message.message || '' },
          ],
        });

        // Auto-save conversation after chat turn completes
        setTimeout(() => get().saveCurrentConversation(), 100);
        break;
      }

      case 'rag-results':
        set({ pendingCitations: message.results });
        break;

      case 'ai-widget': {
        const preview =
          typeof message.args.newText === 'string'
            ? message.args.newText
            : typeof message.args.content === 'string'
              ? message.args.content
              : JSON.stringify(message.args);

        const widgetMsg: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          content: "Here's what I'll do:",
          widget: {
            toolName: message.toolName,
            args: message.args,
            selection: message.selection,
            preview: typeof preview === 'string' ? preview : JSON.stringify(preview),
          },
          timestamp: Date.now(),
        };
        set({
          isStreaming: false,
          streamingContent: '',
          chatMessages: [...state.chatMessages, widgetMsg],
        });
        break;
      }

      case 'ai-error': {
        const errorMsg: ChatMessage = {
          id: nextId(),
          role: 'error',
          content: message.error,
          timestamp: Date.now(),
        };
        set({
          isStreaming: false,
          streamingContent: '',
          chatMessages: [...state.chatMessages, errorMsg],
        });
        break;
      }

      case 'ai-stopped':
        set({ isStreaming: false, streamingContent: '' });
        break;

      case 'clear-chat':
        set({
          chatMessages: [],
          conversationHistory: [],
          streamingContent: '',
          isStreaming: false,
          pendingCitations: [],
          agentConversation: [],
          codexConversation: [],
        });
        break;

      case 'toggle-history-panel':
        get().toggleHistoryPanel();
        break;

      case 'files-dropped':
        // Dispatch to ChatInput via DOM event (ChatInput manages its own pathChips state)
        window.dispatchEvent(new CustomEvent('ritemark:files-dropped', { detail: message.paths }));
        break;

      case 'index-status':
        set({
          indexStatus: { totalDocs: message.totalDocs, totalChunks: message.totalChunks },
          isIndexing: false,
          indexProgress: null,
        });
        break;

      case 'index-progress':
        set({
          isIndexing: true,
          indexProgress: {
            processed: message.processed,
            total: message.total,
            current: message.current,
          },
        });
        break;

      case 'index-done':
        set({ isIndexing: false, indexProgress: null });
        break;

      case 'agent-progress': {
        const conv = [...state.agentConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          const progress = message.progress as AgentProgress;

          // Handle subagent events specially
          if (progress.type === 'subagent_start' && progress.subagentId) {
            // Create a new subagent entry
            const newSubagent: SubagentProgress = {
              id: progress.subagentId,
              parentTurnId: lastTurn.id,
              task: progress.subagentTask || progress.message,
              status: 'running',
              activities: [],
              timestamp: progress.timestamp,
            };
            conv[conv.length - 1] = {
              ...lastTurn,
              activities: [...lastTurn.activities, progress],
              subagents: [...(lastTurn.subagents || []), newSubagent],
            };
          } else if (progress.type === 'subagent_progress' && progress.parentToolUseId) {
            // Add activity to the matching subagent
            const subagents = lastTurn.subagents?.map((sa) =>
              sa.id === progress.parentToolUseId
                ? { ...sa, activities: [...sa.activities, progress] }
                : sa
            );
            conv[conv.length - 1] = {
              ...lastTurn,
              activities: [...lastTurn.activities, progress],
              subagents,
            };
          } else if (progress.type === 'subagent_done' && progress.subagentId) {
            // Mark subagent as done
            const subagents = lastTurn.subagents?.map((sa) =>
              sa.id === progress.subagentId
                ? { ...sa, status: 'done' as const, result: progress.message }
                : sa
            );
            conv[conv.length - 1] = {
              ...lastTurn,
              activities: [...lastTurn.activities, progress],
              subagents,
            };
          } else {
            // Regular activity
            conv[conv.length - 1] = {
              ...lastTurn,
              activities: [...lastTurn.activities, progress],
            };
          }
          set({ agentConversation: conv });
        }
        break;
      }

      case 'agent-result': {
        const conv = [...state.agentConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn) {
          // Check if this turn had a plan_ready activity → mark as plan
          const hasPlanActivity = lastTurn.activities.some(a => a.type === 'plan_ready');
          conv[conv.length - 1] = {
            ...lastTurn,
            isRunning: false,
            isPlan: hasPlanActivity,
            result: {
              text: message.text || '',
              filesModified: message.filesModified || [],
              metrics: message.metrics || { durationMs: 0, costUsd: null, model: null },
              error: message.error,
            },
          };
          const contextState = computeContextState(conv);
          set({ agentConversation: conv, ...contextState });

          // Auto-save conversation after turn completes
          setTimeout(() => get().saveCurrentConversation(), 100);
        }
        break;
      }

      case 'agent-setup:progress':
        // Progress is informational — setupInProgress stays true
        break;

      case 'agent-setup:complete':
        set({ setupStatus: message.status, setupInProgress: false, setupError: null });
        break;

      case 'agent-setup:error':
        set({ setupInProgress: false, setupError: message.error });
        break;

      // ── Codex messages ──

      case 'codex-progress': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            activities: [...lastTurn.activities, message.progress as AgentProgress],
          };
          set({ codexConversation: conv });
        }
        break;
      }

      case 'codex-streaming': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            streamingText: lastTurn.streamingText + message.delta,
          };
          set({ codexConversation: conv });
        }
        break;
      }

      case 'codex-result': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn) {
          conv[conv.length - 1] = {
            ...lastTurn,
            isRunning: false,
            result: { status: message.status || 'success', error: message.error },
          };
          set({ codexConversation: conv });
          setTimeout(() => get().saveCurrentConversation(), 100);
        }
        break;
      }

      case 'codex-approval': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            approval: {
              approvalType: message.approvalType,
              requestId: message.requestId,
              command: message.command,
              workingDir: message.workingDir,
              fileChanges: message.fileChanges,
            },
          };
          set({ codexConversation: conv });
        }
        break;
      }

      case 'settings:chatFontSize':
        set({ chatFontSize: message.fontSize });
        // Apply CSS variable to document root
        document.documentElement.style.setProperty('--chat-font-size', `${message.fontSize}px`);
        break;
    }
  },
}));
