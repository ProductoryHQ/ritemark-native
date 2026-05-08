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
  type SavedConversationV2,
} from './chatHistoryStorage';
import { applyCodexPlanApproval, applyCodexPlanUpdate, finalizeCodexTurnResult, shouldRequestPlanMode } from './lifecycle';
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
  AgentPlanApprovalRequest,
  AgentQuestion,
  CodexConversationTurn,
  CodexSidebarStatus,
  CodexQuestion,
  FileAttachment,
  DiscoveredAgent,
  DiscoveredCommand,
  IndexStatus,
  IndexProgress,
  AgentEnvironmentStatus,
  SetupStatus,
  ExtensionMessage,
  SubagentProgress,
  AgentProgress,
  OnboardingStatus,
  OnboardingDependency,
  OnboardingInstallState,
} from './types';

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function resetProviderSessions(): void {
  vscode.postMessage({ type: 'conversation:reset' });
}

/**
 * Build a compact cross-runtime handoff block from the other runtime's turns
 * that occurred after `sinceTimestamp`. Only includes completed turns (with a
 * response). Injected as a preamble so the receiving runtime knows what the
 * other runtime already said in this conversation.
 */
function buildHandoffContext(
  turns: Array<{ userPrompt: string; responseText: string | undefined; timestamp: number }>,
  runtimeLabel: string,
  sinceTimestamp: number,
  maxTurns = 6,
  maxResponseChars = 1200,
): string | null {
  const relevant = turns
    .filter((t) => t.timestamp > sinceTimestamp && t.responseText)
    .slice(-maxTurns);
  if (relevant.length === 0) return null;

  const lines: string[] = [
    `[The following turns were handled by ${runtimeLabel} earlier in this conversation. You are a different AI assistant continuing the same conversation — do not claim to be ${runtimeLabel}.]`,
  ];
  for (const t of relevant) {
    lines.push(`User: ${t.userPrompt}`);
    const text = t.responseText!;
    lines.push(`${runtimeLabel}: ${text.length > maxResponseChars ? text.slice(0, maxResponseChars) + '…' : text}`);
  }
  lines.push('[End of prior context. Respond to the user request below as yourself.]');
  return lines.join('\n');
}

const DEFAULT_CODEX_STATUS: CodexSidebarStatus = {
  enabled: false,
  state: 'disabled',
  version: null,
  authMethod: null,
  email: null,
  plan: null,
  error: null,
  diagnostics: [],
  repairCommand: null,
  binaryPath: null,
  compatibility: null,
};

// ── Context window estimation ─────────────────────────────────────────
// Disabled: our heuristics were inaccurate and too aggressive.
// AI agents (Claude Code, Codex) manage their own context via compaction.
// Claude Code emits compact_boundary events which we already display.
// TODO: revisit with per-turn input_tokens from SDK if needed.

function computeContextState(_turns: AgentConversationTurn[]) {
  return { estimatedTokens: 0, contextUsagePercent: 0, showContextWarning: false };
}

function getCodexCompatibilityNoticeKey(status: CodexSidebarStatus): string | null {
  const compatibility = status.compatibility;
  if (status.state !== 'ready' || !compatibility || compatibility.state === 'compatible') {
    return null;
  }

  const caps = compatibility.capabilities;
  return [
    status.version ?? 'unknown',
    compatibility.state,
    caps.approvals ? 'approvals' : 'no-approvals',
    caps.requestUserInput ? 'question' : 'no-question',
    caps.planUpdates ? 'plan' : 'no-plan',
  ].join(':');
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
  codexStatus: CodexSidebarStatus;
  codexConversation: CodexConversationTurn[];
  dismissedCodexNoticeKey: string | null;
  dismissedCurrentPlanKey: string | null;

  // ── Pending runtime (per-run draft selection) ──
  pendingRuntime: { runtimeId: 'claude-code' | 'codex'; modelId: string; mode: 'plan' | 'edit' };

  // ── Chat history state ──
  currentConversationId: string | null;
  savedConversations: SavedConversationV2[];
  showHistoryPanel: boolean;

  // ── Setup state (Claude Code) ──
  setupStatus: SetupStatus | null;
  environmentStatus: AgentEnvironmentStatus | null;
  setupInProgress: boolean;
  setupError: string | null;
  hasSeenWelcome: boolean;

  // ── Onboarding state ──
  onboardingStatus: OnboardingStatus | null;
  onboardingDismissed: boolean;
  onboardingInstallStates: Record<OnboardingDependency, OnboardingInstallState>;

  // ── Index state ──
  indexStatus: IndexStatus;
  indexProgress: IndexProgress | null;
  isIndexing: boolean;

  // ── Discovered agents/commands from .claude/ ──
  discoveredAgents: DiscoveredAgent[];
  discoveredCommands: DiscoveredCommand[];

  // ── Pinned agent (set via Launch Chat from Agent Library) ──
  pinnedAgent: string | null;
  pinnedAgentContent: string | null;
  pinnedAgentDismissal: string | null;
  setPinnedAgent: (agentId: string | null) => void;
  clearPinnedAgentContent: () => void;
  clearPinnedAgentDismissal: () => void;
  requestPinAgent: (agentId: string, filePath: string) => void;

  // ── Appearance ──
  chatFontSize: number;

  // ── Context tracking ──
  estimatedTokens: number;
  contextUsagePercent: number;
  showContextWarning: boolean;

  // ── Actions ──
  selectAgent: (agentId: AgentId) => void;
  selectModel: (modelId: string) => void;
  setPendingRuntime: (partial: Partial<{ runtimeId: 'claude-code' | 'codex'; modelId: string; mode: 'plan' | 'edit' }>) => void;
  sendChatMessage: (prompt: string) => void;
  sendAgentMessage: (prompt: string, attachments?: FileAttachment[], options?: { skipActiveFile?: boolean; hiddenContext?: string; mentionedAgentPaths?: string[] }) => void;
  cancelRequest: () => void;
  /**
   * Detach the editor selection from the chat input context. Does NOT clear
   * the editor's actual selection — only the chat-side reference. Sprint 62
   * S5 default behaviour (per bonus-track tracking doc, Open Question).
   */
  dismissSelectedContext: () => void;
  /**
   * Build the LLM-facing prompt block describing the current editor
   * selection. Returns undefined if no selection. Used internally by
   * sendAgentMessage and sendCodexMessage to inject selection context
   * into the hidden prompt prefix without showing it in the chat bubble.
   */
  buildSelectionContextBlock: () => string | undefined;
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
  openGitDownload: () => void;
  openNodeDownload: () => void;
  recheckSetup: () => void;
  approvePlan: (turnId: string) => void;
  rejectPlan: (turnId: string, feedback?: string) => void;
  answerAgentQuestion: (turnId: string, question: AgentQuestion, answers: Record<string, string>) => void;
  dismissWelcome: () => void;
  sendCodexMessage: (prompt: string, attachments?: FileAttachment[], requestedMode?: 'plan' | 'edit') => void;
  selectCodexModel: (modelId: string) => void;
  handleCodexApproval: (requestId: string | number, approved: boolean) => void;
  answerCodexQuestion: (turnId: string, question: CodexQuestion, answers: Record<string, string>) => void;
  approveCodexPlan: (turnId: string) => void;
  discardCodexPlan: (turnId: string) => void;
  startCodexLogin: () => void;
  logoutCodex: () => void;
  refreshCodexStatus: () => void;
  repairCodex: () => void;
  dismissCodexNotice: (key: string) => void;
  dismissCurrentPlan: (key: string) => void;
  reloadWindow: () => void;
  openAgentSettings: () => void;

  // ── Onboarding actions ──
  installDependency: (dep: OnboardingDependency) => void;
  recheckDependencies: () => void;
  dismissOnboarding: () => void;

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
  selectedAgent: 'claude-code',
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
  codexStatus: DEFAULT_CODEX_STATUS,
  codexConversation: [],
  dismissedCodexNoticeKey: null,
  dismissedCurrentPlanKey: null,

  pendingRuntime: { runtimeId: 'claude-code', modelId: 'claude-sonnet-4-5', mode: 'edit' },

  currentConversationId: null,
  savedConversations: [],
  showHistoryPanel: false,

  setupStatus: null,
  environmentStatus: null,
  setupInProgress: false,
  setupError: null,
  hasSeenWelcome: false,

  onboardingStatus: null,
  onboardingDismissed: false,
  onboardingInstallStates: {
    'git': 'unknown',
    'node': 'unknown',
    'claude-cli': 'unknown',
    'codex-cli': 'unknown',
  },

  indexStatus: { totalDocs: 0, totalChunks: 0 },
  indexProgress: null,
  chatFontSize: 13,
  isIndexing: false,
  discoveredAgents: [],
  discoveredCommands: [],
  pinnedAgent: null,
  pinnedAgentContent: null,
  pinnedAgentDismissal: null,
  setPinnedAgent: (agentId) => {
    const current = get().pinnedAgent;
    if (!agentId && current) {
      set({ pinnedAgent: null, pinnedAgentContent: null, pinnedAgentDismissal: current });
    } else {
      set({ pinnedAgent: agentId, pinnedAgentContent: null, pinnedAgentDismissal: null });
    }
  },
  clearPinnedAgentContent: () => set({ pinnedAgentContent: null }),
  clearPinnedAgentDismissal: () => set({ pinnedAgentDismissal: null }),
  requestPinAgent: (agentId, filePath) => {
    vscode.postMessage({ type: 'pin-agent-request', agentId, filePath });
  },

  estimatedTokens: 0,
  contextUsagePercent: 0,
  showContextWarning: false,

  // ── Actions ──

  selectAgent: (agentId) => {
    set({ selectedAgent: agentId });
    vscode.postMessage({ type: 'ai-select-agent', agentId });
    // When switching to Codex, force a fresh auth status check.
    // The AI sidebar and Settings each maintain their own CodexAppServer instance,
    // so logging out from Settings can leave the AI sidebar with a stale "ready"
    // state. A fresh status round-trip ensures CodexSetupView appears whenever
    // the user actually needs to sign in.
    if (agentId === 'codex') {
      vscode.postMessage({ type: 'codex:refreshStatus' });
    }
  },

  selectModel: (modelId) => {
    set({ selectedModel: modelId });
    vscode.postMessage({ type: 'ai-select-model', modelId });
  },

  setPendingRuntime: (partial) => {
    set({ pendingRuntime: { ...get().pendingRuntime, ...partial } });
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

    const activeFile = (!options?.skipActiveFile && state.activeFilePath) ? state.activeFilePath : undefined;

    // Prepend Codex turns that happened after Claude's last turn
    const lastAgentTimestamp = lastTurn?.timestamp ?? 0;
    const handoff = buildHandoffContext(
      state.codexConversation.map((t) => ({
        userPrompt: t.userPrompt,
        responseText: t.streamingText || undefined,
        timestamp: t.timestamp,
      })),
      'Codex',
      lastAgentTimestamp,
    );
    const basePrompt = handoff ? `${handoff}\n\nUser request:\n${prompt}` : prompt;
    // Selection context comes BEFORE the pinned-agent hidden context so the
    // agent's role instructions (if any) can frame their response around the
    // selected text. The order is:
    //   [Selection context] → [Pinned agent instructions] → handoff → prompt
    const selectionBlock = get().buildSelectionContextBlock();
    const hiddenPieces = [
      selectionBlock,
      options?.hiddenContext,
    ].filter((p): p is string => Boolean(p));
    const fullPrompt = hiddenPieces.length > 0
      ? `${hiddenPieces.join('\n\n---\n\n')}\n\n---\n\n${basePrompt}`
      : basePrompt;

    const turn: AgentConversationTurn = {
      id: nextId(),
      userPrompt: prompt,
      activeFilePath: activeFile,
      attachments,
      activities: [],
      isRunning: true,
      isPlan: false,
      planHandled: false,
      planDecision: undefined,
      planText: '',
      pendingQuestion: undefined,
      pendingPlanApproval: undefined,
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
    vscode.postMessage({ type: 'ai-execute-agent', prompt: fullPrompt, images: attachmentPayload, skipActiveFile: options?.skipActiveFile, mentionedAgentPaths: options?.mentionedAgentPaths });
  },

  dismissSelectedContext: () => {
    set({ selection: { text: '', isEmpty: true, from: 0, to: 0 } });
  },

  /**
   * Build the hidden prompt block that tells the LLM about the currently-
   * selected text. Used by sendAgentMessage and sendCodexMessage so the
   * agent actually receives the selection — without this, the docked tab
   * is purely cosmetic and the LLM has no idea what text the user means
   * by "this".
   *
   * Format chosen for clarity to the LLM:
   *   - Plain-text [Selection context] header (no XML — works equally well
   *     across Claude and Codex models)
   *   - Explicit instruction that the request applies to this selection
   *     "unless explicitly indicated otherwise" — gives the LLM permission
   *     to override when the user's prompt clearly references something
   *     else
   *   - Selected text rendered as a blockquote so multi-line content
   *     stays readable and won't be confused with the user's request
   *   - User request: prefix is the conventional separator the agent
   *     instructions can latch onto
   */
  buildSelectionContextBlock: () => {
    const state = get();
    const { selection, activeFilePath, pendingRuntime } = state;
    if (selection.isEmpty || !selection.text) return undefined;

    const fileLine = activeFilePath ? `File: ${activeFilePath}\n` : '';

    // Build an unambiguous fingerprint by wrapping the selection in
    // sentinels and showing it inside its surrounding context. The agent
    // can then locate the selection by matching the FULL window
    // (contextBefore + selection + contextAfter), which is unique within
    // the file even when the selected word itself isn't (e.g. "runtime"
    // in body vs frontmatter — same word, different sentences around it).
    const hasContext = Boolean(selection.contextBefore || selection.contextAfter);
    const contextWindow = hasContext
      ? `${selection.contextBefore ?? ''}<<<SELECTION>>>${selection.text}<<</SELECTION>>>${selection.contextAfter ?? ''}`
      : null;

    // Mode-aware framing. Without explicit "use your file editing tools"
    // language, models default to chat replies even when the user clearly
    // asks for a modification. Tested 2026-05-07: weaker wording produced
    // chat suggestions instead of apply_patch calls; strong directive
    // language fixes the mode but earlier line-number disambiguation
    // pointed at the wrong occurrence — replaced with a context window.
    const isEditMode = pendingRuntime.mode === 'edit';
    const header = isEditMode
      ? '[Selection context — Edit mode]'
      : '[Selection context — Plan mode]';
    const instruction = isEditMode
      ? [
          'The user has selected text in the active file (shown below',
          'wrapped in <<<SELECTION>>>...<<</SELECTION>>> sentinels with',
          'surrounding context).',
          'You are in EDIT MODE — MODIFY this exact selection in the file',
          'using your file editing tools (apply_patch). To find the right',
          'spot, match the SURROUNDING CONTEXT below — do NOT search for',
          'just the selected word, because the same word may appear in',
          'frontmatter, headings, or other paragraphs.',
          'Do NOT just suggest changes in chat — make the actual file',
          'edit. Reply text should briefly confirm what you changed.',
        ].join('\n')
      : [
          'The user has selected text in the active file (shown below',
          'wrapped in <<<SELECTION>>>...<<</SELECTION>>> sentinels with',
          'surrounding context).',
          'You are in PLAN MODE — propose changes to this selection using',
          'your plan tools. Do NOT make file edits yet; wait for plan',
          'approval before applying anything.',
        ].join('\n');

    const contextSection = contextWindow
      ? [
          fileLine + 'Surrounding context (selection wrapped in sentinels):',
          '',
          contextWindow,
        ].join('\n')
      : [
          fileLine + 'Selected text:',
          '',
          selection.text.split('\n').map((line) => `> ${line}`).join('\n'),
        ].join('\n');

    return [
      header,
      instruction,
      '',
      contextSection,
      '',
      '---',
      '',
      'User request:',
    ].join('\n');
  },

  cancelRequest: () => {
    const state = get();
    // Route by active turn, not selectedAgent — supports mixed-runtime conversations
    const hasRunningCodex = state.codexConversation.some((t) => t.isRunning);
    const hasRunningClaude = state.agentConversation.some((t) => t.isRunning);

    if (hasRunningCodex) {
      vscode.postMessage({ type: 'codex-cancel' });
      const conv = [...state.codexConversation];
      const last = conv[conv.length - 1];
      if (last?.isRunning) {
        conv[conv.length - 1] = { ...last, isRunning: false, result: { status: 'interrupted', error: 'Cancelled by user' } };
      }
      set({ codexConversation: conv });
    } else if (hasRunningClaude) {
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

  openGitDownload: () => {
    vscode.postMessage({ type: 'agent-setup:open-git-download' });
  },

  openNodeDownload: () => {
    vscode.postMessage({ type: 'agent-setup:open-node-download' });
  },

  recheckSetup: () => {
    set({ setupError: null });
    vscode.postMessage({ type: 'agent-setup:check' });
  },

  approvePlan: (turnId) => {
    const state = get();
    const targetTurn = state.agentConversation.find((t) => t.id === turnId);
    if (!targetTurn?.pendingPlanApproval) {
      return;
    }

    const conv = state.agentConversation.map((t) =>
      t.id === turnId
        ? {
            ...t,
            planHandled: true,
            planDecision: 'approved' as const,
            pendingPlanApproval: undefined,
          }
        : t
    );
    set({ agentConversation: conv });
    vscode.postMessage({
      type: 'agent-answer-plan',
      toolUseId: targetTurn.pendingPlanApproval.toolUseId,
      approved: true,
    });
  },

  rejectPlan: (turnId, feedback?) => {
    const state = get();
    const targetTurn = state.agentConversation.find((t) => t.id === turnId);
    if (!targetTurn?.pendingPlanApproval) {
      return;
    }

    const conv = state.agentConversation.map((t) =>
      t.id === turnId
        ? {
            ...t,
            planHandled: true,
            planDecision: 'rejected' as const,
            pendingPlanApproval: undefined,
          }
        : t
    );
    set({ agentConversation: conv });
    vscode.postMessage({
      type: 'agent-answer-plan',
      toolUseId: targetTurn.pendingPlanApproval.toolUseId,
      approved: false,
      feedback,
    });
  },

  answerAgentQuestion: (turnId, question, answers) => {
    const state = get();
    const conv = state.agentConversation.map((turn) =>
      turn.id === turnId
        ? { ...turn, pendingQuestion: undefined }
        : turn
    );
    set({ agentConversation: conv });
    vscode.postMessage({
      type: 'agent-answer-question',
      toolUseId: question.toolUseId,
      answers,
    });
  },

  dismissWelcome: () => {
    set({ hasSeenWelcome: true });
    vscode.postMessage({ type: 'agent-setup:dismiss-welcome' });
  },

  sendCodexMessage: (prompt, attachments?, requestedMode?) => {
    const state = get();
    const lastTurn = state.codexConversation[state.codexConversation.length - 1];
    if (lastTurn?.isRunning) return;

    // Prepend Claude turns that happened after Codex's last turn
    const lastCodexTimestamp = lastTurn?.timestamp ?? 0;
    const handoff = buildHandoffContext(
      state.agentConversation.map((t) => ({
        userPrompt: t.userPrompt,
        responseText: t.result?.text || undefined,
        timestamp: t.timestamp,
      })),
      'Claude',
      lastCodexTimestamp,
    );
    // Prepend selection context so the agent actually receives the docked
    // selection. The Codex turn shows only the user-typed prompt in the chat
    // bubble; the selection wrapper is invisible to the user but visible to
    // the model — same pattern Claude already uses for hiddenContext.
    const selectionBlock = get().buildSelectionContextBlock();
    const handoffPrompt = handoff ? `${handoff}\n\nUser request:\n${prompt}` : prompt;
    const fullPrompt = selectionBlock
      ? `${selectionBlock}\n\n---\n\n${handoffPrompt}`
      : handoffPrompt;

    const turn: CodexConversationTurn = {
      id: nextId(),
      userPrompt: prompt,
      requestedPlanMode: requestedMode === 'plan' || shouldRequestPlanMode(prompt),
      activeFilePath: state.activeFilePath || undefined,
      attachments,
      streamingText: '',
      activities: [],
      pendingQuestion: undefined,
      executionContinuation: false,
      requiresPlanReview: false,
      planText: '',
      planExplanation: undefined,
      planSteps: [],
      planHandled: false,
      planDecision: undefined,
      isRunning: true,
      timestamp: Date.now(),
    };

    set({ codexConversation: [...state.codexConversation, turn] });
    vscode.postMessage({
      type: 'codex-execute',
      prompt: fullPrompt,
      model: state.codexSelectedModel,
      // The Edit/Plan toggle in ChatInput sets pendingRuntime.mode; until
      // 51095ad this never reached the extension because mode wasn't on
      // the wire. Now it is — Codex collaboration mode actually responds
      // to the toggle.
      mode: requestedMode,
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

  answerCodexQuestion: (turnId, question, answers) => {
    const state = get();
    const answerMap = Object.fromEntries(
      question.questions.map((item) => {
        const value = answers[item.question] ?? '';
        const normalizedAnswers = value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
        return [item.id, { answers: normalizedAnswers }];
      })
    );
    const conv = state.codexConversation.map((turn) =>
      turn.id === turnId
        ? { ...turn, pendingQuestion: undefined }
        : turn
    );
    set({ codexConversation: conv });
    vscode.postMessage({ type: 'codex-answer-question', requestId: question.requestId, answers: answerMap });
  },

  approveCodexPlan: (turnId) => {
    const state = get();
    const { conversation, prompt } = applyCodexPlanApproval(state.codexConversation, turnId, nextId);
    if (!prompt) {
      return;
    }
    set({ codexConversation: conversation });
    vscode.postMessage({
      type: 'codex-execute',
      prompt,
      model: state.codexSelectedModel,
      mode: 'execute',
    });
  },

  discardCodexPlan: (turnId) => {
    const state = get();
    const conv = state.codexConversation.map((turn) =>
      turn.id === turnId
        ? { ...turn, planHandled: true, planDecision: 'rejected' as const }
        : turn
    );
    set({ codexConversation: conv });
  },

  startCodexLogin: () => {
    const status = get().codexStatus;
    set({
      codexStatus: {
        ...status,
        state: 'auth-in-progress',
        error: null,
      },
    });
    vscode.postMessage({ type: 'codex:login' });
  },

  logoutCodex: () => {
    vscode.postMessage({ type: 'codex:logout' });
  },

  refreshCodexStatus: () => {
    vscode.postMessage({ type: 'codex:refreshStatus' });
  },

  repairCodex: () => {
    vscode.postMessage({ type: 'codex:repair' });
  },

  dismissCodexNotice: (key) => {
    set({ dismissedCodexNoticeKey: key });
  },

  dismissCurrentPlan: (key) => {
    set({ dismissedCurrentPlanKey: key });
  },

  reloadWindow: () => {
    vscode.postMessage({ type: 'codex:reloadWindow' });
  },

  openAgentSettings: () => {
    vscode.postMessage({ type: 'codex:openSettings' });
  },

  // ── Onboarding actions ──

  installDependency: (dep) => {
    const messageMap: Record<OnboardingDependency, string> = {
      'git': 'onboarding:install-git',
      'node': 'onboarding:install-node',
      'claude-cli': 'onboarding:install-claude',
      'codex-cli': 'onboarding:install-codex',
    };
    const state = get();
    set({
      onboardingInstallStates: {
        ...state.onboardingInstallStates,
        [dep]: 'installing' as OnboardingInstallState,
      },
    });
    vscode.postMessage({ type: messageMap[dep] });
  },

  recheckDependencies: () => {
    vscode.postMessage({ type: 'onboarding:recheck' });
  },

  dismissOnboarding: () => {
    set({ onboardingDismissed: true });
    // Auto-select best available agent
    const status = get().onboardingStatus;
    if (status) {
      if (status.claudeCliAuthenticated) {
        get().selectAgent('claude-code');
      } else if (status.codexCliAuthenticated) {
        get().selectAgent('codex');
      }
      // Ritemark Agent is lowest priority — only if user explicitly has OpenAI key
    }
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

    resetProviderSessions();

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
      dismissedCurrentPlanKey: null,
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
        dismissedCurrentPlanKey: null,
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

    resetProviderSessions();

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
      dismissedCurrentPlanKey: null,
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
    resetProviderSessions();
    set({
      chatMessages: [],
      conversationHistory: [],
      streamingContent: '',
      isStreaming: false,
      pendingCitations: [],
      agentConversation: [],
      codexConversation: [],
      dismissedCurrentPlanKey: null,
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
        const newCodexModels = message.codexModels || [];
        const newClaudeModels = message.models || [];
        // If current selection isn't in the new model list, pick the first one
        const currentCodex = get().codexSelectedModel;
        const codexSelectedModel = newCodexModels.some((m: { id: string }) => m.id === currentCodex)
          ? currentCodex
          : (newCodexModels[0]?.id || currentCodex);
        const currentClaude = message.selectedModel || get().selectedModel;
        const selectedModel = newClaudeModels.some((m: { id: string }) => m.id === currentClaude)
          ? currentClaude
          : (newClaudeModels[0]?.id || currentClaude);
        const incomingCodexStatus = message.codexStatus ?? get().codexStatus;
        const incomingRuntimeId = message.selectedAgent === 'codex' ? 'codex' : 'claude-code';
        set({
          agenticEnabled: message.agenticEnabled,
          codexEnabled: message.codexEnabled ?? false,
          selectedAgent: (message.selectedAgent as AgentId) || 'claude-code',
          selectedModel,
          pendingRuntime: { ...get().pendingRuntime, runtimeId: incomingRuntimeId, modelId: selectedModel },
          agents: message.agents,
          models: newClaudeModels,
          codexModels: newCodexModels,
          codexSelectedModel,
          codexStatus: incomingCodexStatus,
          dismissedCodexNoticeKey: getCodexCompatibilityNoticeKey(incomingCodexStatus)
            ? get().dismissedCodexNoticeKey
            : null,
          setupStatus: message.setupStatus ?? get().setupStatus,
          environmentStatus: message.environmentStatus ?? get().environmentStatus,
          hasSeenWelcome: message.hasSeenWelcome ?? get().hasSeenWelcome,
          discoveredAgents: message.discoveredAgents || [],
          discoveredCommands: message.discoveredCommands || [],
        });
        break;

      case 'pin-agent': {
        const newAgentId = message.agentId ?? null;
        const currentAgent = get().pinnedAgent;
        const currentDismissal = get().pinnedAgentDismissal;
        // Carry over a dismissal: prefer the agent being replaced; otherwise keep
        // any pending dismissal that hasn't been delivered yet (unless it's the same agent now)
        let dismissal: string | null = null;
        if (currentAgent && currentAgent !== newAgentId) {
          dismissal = currentAgent;
        } else if (currentDismissal && currentDismissal !== newAgentId) {
          dismissal = currentDismissal;
        }
        set({
          pinnedAgent: newAgentId,
          pinnedAgentContent: message.content ?? null,
          pinnedAgentDismissal: dismissal,
        });
        break;
      }

      case 'codex:status': {
        const updates: Partial<AISidebarState> = {
          codexStatus: message.status,
        };

        if (!getCodexCompatibilityNoticeKey(message.status)) {
          updates.dismissedCodexNoticeKey = null;
        }

        if (message.status.state !== 'ready') {
          const conv = [...state.codexConversation];
          const lastTurn = conv[conv.length - 1];
          if (lastTurn?.isRunning) {
            conv[conv.length - 1] = {
              ...lastTurn,
              approval: undefined,
              isRunning: false,
              result: {
                status: 'blocked',
                error: message.status.error || 'Codex is not ready.',
              },
            };
            updates.codexConversation = conv;
          }
        }

        set(updates);
        break;
      }

      case 'agent:models-update': {
        const newModels = message.models || [];
        if (newModels.length > 0) {
          const current = get().selectedModel;
          const selectedModel = newModels.some((m: { id: string }) => m.id === current)
            ? current
            : (newModels[0]?.id || current);
          set({ models: newModels, selectedModel });
        }
        break;
      }

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
          dismissedCurrentPlanKey: null,
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

          if (progress.type === 'plan_text') {
            conv[conv.length - 1] = {
              ...lastTurn,
              planText: `${lastTurn.planText || ''}${lastTurn.planText ? '\n\n' : ''}${progress.message}`,
            };
            set({ agentConversation: conv });
            break;
          }

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

      case 'agent-question': {
        const conv = [...state.agentConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            pendingQuestion: message.question,
          };
          set({ agentConversation: conv });
        }
        break;
      }

      case 'agent-plan-approval': {
        const conv = [...state.agentConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          const pendingPlanApproval: AgentPlanApprovalRequest = message.request;
          conv[conv.length - 1] = {
            ...lastTurn,
            isPlan: true,
            planHandled: false,
            planDecision: undefined,
            pendingPlanApproval,
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
            pendingQuestion: undefined,
            pendingPlanApproval: undefined,
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
        set({
          setupStatus: message.status,
          environmentStatus: message.environmentStatus ?? get().environmentStatus,
          setupInProgress: false,
          setupError: null,
        });
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

      case 'codex-question': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            pendingQuestion: {
              requestId: message.requestId,
              questions: message.questions,
            },
            requiresPlanReview: false,
            planHandled: false,
            planDecision: undefined,
          };
          set({ codexConversation: conv });
        }
        break;
      }

      case 'codex-plan-text-delta': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = {
            ...lastTurn,
            planText: `${lastTurn.planText || ''}${message.delta}`,
            planHandled: false,
            planDecision: undefined,
          };
          set({ codexConversation: conv });
        }
        break;
      }

      case 'codex-plan-update': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = applyCodexPlanUpdate(lastTurn, {
            explanation: message.explanation,
            plan: message.plan,
          });
          set({ codexConversation: conv });
        }
        break;
      }

      case 'codex-result': {
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn) {
          conv[conv.length - 1] = finalizeCodexTurnResult(lastTurn, {
            status: message.status,
            error: message.error,
          });
          set({ codexConversation: conv });
          setTimeout(() => get().saveCurrentConversation(), 100);
        }
        break;
      }

      case 'codex-rpc-progress': {
        // A slow RPC (typically thread/start at cold start) is still in
        // flight. Surface the message on the running turn so the user
        // sees progress instead of a frozen UI.
        const conv = [...state.codexConversation];
        const lastTurn = conv[conv.length - 1];
        if (lastTurn?.isRunning) {
          conv[conv.length - 1] = { ...lastTurn, rpcProgressMessage: message.message };
          set({ codexConversation: conv });
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

      // ── Onboarding messages ──

      case 'onboarding:status': {
        // Reset stale "installing" states when a recheck shows the dep is still missing.
        // This prevents the UI from being stuck on "Installing..." after a terminal
        // cancel/failure (Git, Node, Codex installs don't have progress events).
        const prev = state.onboardingInstallStates;
        const s = message.status;
        const installStates = { ...prev };
        if (!s.gitInstalled && prev.git === 'installing') installStates.git = 'missing';
        if (!s.nodeInstalled && prev.node === 'installing') installStates.node = 'missing';
        if (!s.claudeCliInstalled && prev['claude-cli'] === 'installing') installStates['claude-cli'] = 'missing';
        if (!s.codexCliInstalled && prev['codex-cli'] === 'installing') installStates['codex-cli'] = 'missing';
        // Also mark installed deps as such
        if (s.gitInstalled) installStates.git = 'installed';
        if (s.nodeInstalled) installStates.node = 'installed';
        if (s.claudeCliInstalled) installStates['claude-cli'] = 'installed';
        if (s.codexCliInstalled) installStates['codex-cli'] = 'installed';
        set({ onboardingStatus: s, onboardingInstallStates: installStates });
        break;
      }

      case 'onboarding:install-progress':
        set({
          onboardingInstallStates: {
            ...state.onboardingInstallStates,
            [message.dependency]: message.state,
          },
        });
        break;
    }
  },
}));
