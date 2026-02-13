/**
 * AI Sidebar Store (Zustand)
 *
 * Central state management for the AI sidebar.
 * Handles messages from the extension and provides actions for components.
 */

import { create } from 'zustand';
import { vscode } from '../../lib/vscode';
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
  FileAttachment,
  IndexStatus,
  IndexProgress,
  SetupStatus,
  ExtensionMessage,
} from './types';

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
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

  // ── Chat state (Ritemark Agent) ──
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
  streamingContent: string;
  isStreaming: boolean;
  pendingCitations: RAGCitation[];

  // ── Agent state (Claude Code) ──
  agentConversation: AgentConversationTurn[];

  // ── Setup state (Claude Code) ──
  setupStatus: SetupStatus | null;
  setupInProgress: boolean;
  setupError: string | null;
  hasSeenWelcome: boolean;

  // ── Index state ──
  indexStatus: IndexStatus;
  indexProgress: IndexProgress | null;
  isIndexing: boolean;

  // ── Actions ──
  selectAgent: (agentId: AgentId) => void;
  selectModel: (modelId: string) => void;
  sendChatMessage: (prompt: string) => void;
  sendAgentMessage: (prompt: string, attachments?: FileAttachment[]) => void;
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

  chatMessages: [],
  conversationHistory: [],
  streamingContent: '',
  isStreaming: false,
  pendingCitations: [],

  agentConversation: [],

  setupStatus: null,
  setupInProgress: false,
  setupError: null,
  hasSeenWelcome: false,

  indexStatus: { totalDocs: 0, totalChunks: 0 },
  indexProgress: null,
  isIndexing: false,

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

  sendAgentMessage: (prompt, attachments?) => {
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
    vscode.postMessage({ type: 'ai-execute-agent', prompt, images: attachmentPayload });
  },

  cancelRequest: () => {
    const state = get();
    if (state.selectedAgent === 'claude-code') {
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

  clearChat: () => {
    set({
      chatMessages: [],
      conversationHistory: [],
      streamingContent: '',
      isStreaming: false,
      pendingCitations: [],
      agentConversation: [],
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
        set({
          agenticEnabled: message.agenticEnabled,
          selectedAgent: (message.selectedAgent as AgentId) || 'ritemark-agent',
          selectedModel: message.selectedModel || 'claude-sonnet-4-5',
          agents: message.agents,
          models: message.models || [],
          setupStatus: message.setupStatus ?? get().setupStatus,
          hasSeenWelcome: message.hasSeenWelcome ?? get().hasSeenWelcome,
        });
        break;

      case 'selection-update':
        set({ selection: message.selection });
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
        });
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
          conv[conv.length - 1] = {
            ...lastTurn,
            activities: [...lastTurn.activities, message.progress],
          };
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
          set({ agentConversation: conv });
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
    }
  },
}));
