/**
 * AI Sidebar Store (Zustand)
 *
 * Central state management for the AI sidebar.
 * Handles messages from the extension and provides actions for components.
 *
 * Sprint 99 (R5): the store holds N conversations, not one. `conversations` is
 * the source of truth; `activeConversationId` says which one the user is looking
 * at. There are NO flat conversation fields — anything that belongs to a thread
 * lives in `ConversationState` and is written through the conversation helpers
 * below. Views read the visible thread with `useActiveConversation()`.
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
  saveOpenThreadIds,
  loadOpenThreadIds,
  type SavedConversationV2,
} from './chatHistoryStorage';
import type { LegacyRitemarkConversationRun } from './conversationModel';
import { applyCodexPlanApproval, applyCodexPlanUpdate, finalizeCodexTurnResult, shouldRequestPlanMode } from './lifecycle';
import {
  createConversationState,
  isConversationEmpty,
  markConversationInterrupted,
  type ConversationState,
  type PendingRuntimeSelection,
} from './conversationState';
import {
  deriveThreadStatus,
  deriveThreadTitle,
  evaluateSoftCap,
  runtimeOfConversation,
  type CapCandidate,
  type ThreadRuntime,
  type ThreadStatus,
} from './threadStatus';
import { clearSlot, pruneSlots, setSlot, type ComposerSlots } from './composerQueue';
import { resolveInboundConversationId } from './conversationRouting';
import type {
  AgentId,
  AgentInfo,
  ModelOption,
  ChatMessage,
  EditorSelection,
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
  AgentEnvironmentStatus,
  SetupStatus,
  ExtensionMessage,
  SubagentProgress,
  AgentProgress,
  OnboardingStatus,
  OnboardingDependency,
  OnboardingInstallState,
  AcpProviderFlags,
  ByokModelOption,
} from './types';

export type { ConversationState, PendingRuntimeSelection } from './conversationState';

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

/**
 * Tell the host to throw away a conversation's runtime session.
 *
 * Sprint 99 (E4): this is NOT a switch-time operation any more. Switching threads
 * is a view change and must never tear a session down. It fires only when a
 * conversation is genuinely discarded — /clear, delete, or an explicit close —
 * and it targets exactly ONE conversation, never "all providers".
 */
function resetProviderSession(conversationId: string): void {
  vscode.postMessage({ type: 'conversation:reset', conversationId });
}

/**
 * Build a compact cross-runtime handoff block from the other runtime's turns
 * that occurred after `sinceTimestamp`. Only includes completed turns (with a
 * response). Injected as a preamble so the receiving runtime knows what the
 * other runtime already said in this conversation.
 *
 * Note (spec non-requirement #97): handoff is strictly WITHIN one conversation.
 * It never reads another thread's turns.
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

/**
 * First available OpenCode model as a composite "opencode:<provider>/<id>" value,
 * picking the first configured provider's first model. Used to give the OpenCode
 * picker a sensible default (Claude/Codex already default to their first model) so
 * the composer never shows "Select a model…" with a valid, key-backed provider.
 */
function firstAvailableOpenCodeModel(
  enabled: boolean,
  providers: AcpProviderFlags | undefined,
  models: Record<string, ByokModelOption[]> | undefined,
): string {
  if (!enabled || !providers || !models) return '';
  for (const provider of ['google', 'openai', 'anthropic', 'openrouter'] as const) {
    if (providers[provider]) {
      const first = models[provider]?.[0];
      if (first) return `opencode:${provider}/${first.id}`;
    }
  }
  return '';
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

/** Stamp `conversationId` onto turns rehydrated from storage (pre-Sprint-99 saves lack it). */
function stampConversationId<T extends { conversationId?: string }>(turns: T[], conversationId: string): T[] {
  return turns.map((t) => (t.conversationId === conversationId ? t : { ...t, conversationId }));
}

/**
 * A thread open on the rail, as the rail and History need to see it. Derived —
 * never stored — so it cannot drift from `conversations`.
 */
export interface OpenThreadSummary {
  id: string;
  title: string;
  runtime: ThreadRuntime;
  status: ThreadStatus;
  hasQueuedPrompt: boolean;
  isActive: boolean;
}

/** A thread-open action parked behind the soft-cap prompt (R11). */
export type PendingThreadOpen =
  | { kind: 'new' }
  | { kind: 'reopen'; conversationId: string };

interface AISidebarState {
  // ── Connection state (APP-GLOBAL) ──
  hasApiKey: boolean;
  isOnline: boolean;
  ready: boolean;

  // ── Agent config: catalogs + availability (APP-GLOBAL) ──
  agenticEnabled: boolean;
  agents: AgentInfo[];
  models: ModelOption[];

  // ── Editor context (APP-GLOBAL — one active editor regardless of thread count) ──
  selection: EditorSelection;
  activeFilePath: string | null;
  currentBrowserContext: { url: string; title?: string; sharedWithAgent?: boolean; annotationMode?: boolean; screenshotPreview?: { dataUrl: string } | null; error?: string } | null;

  // ── Conversations (Sprint 99 R5 — the source of truth) ──
  /** Every OPEN conversation, keyed by id. */
  conversations: Record<string, ConversationState>;
  /** Which conversation the sidebar is currently showing. */
  activeConversationId: string | null;

  // ── Codex runtime status (APP-GLOBAL — one binary, one auth) ──
  codexEnabled: boolean;
  codexModels: ModelOption[];
  codexStatus: CodexSidebarStatus;
  dismissedCodexNoticeKey: string | null;

  // ── OpenCode / ACP availability (APP-GLOBAL) ──
  opencodeEnabled: boolean;
  acpProviders: AcpProviderFlags;
  byokProviderModels: Record<string, ByokModelOption[]> | undefined;

  // ── Chat history (APP-GLOBAL) ──
  savedConversations: SavedConversationV2[];
  showHistoryPanel: boolean;

  // ── Composer state, keyed per thread (Sprint 99 R14 / E5) ──
  /**
   * Queued follow-up prompt per conversation. Lives in the store rather than in
   * `ChatInput` state because the rail needs it too: a thread with a queued
   * prompt is NOT idle and must not offer a close × (Resolved Gap 4).
   */
  composerQueues: ComposerSlots;
  /** Unsent draft text per conversation, so switching threads loses nothing. */
  composerDrafts: ComposerSlots;
  setComposerQueue: (conversationId: string, prompt: string) => void;
  clearComposerQueue: (conversationId: string) => void;
  setComposerDraft: (conversationId: string, text: string) => void;

  // ── Soft cap gate (Sprint 99 R11 + Resolved Gaps 2/3) ──
  /** Set when "+" or a History reopen hit the soft cap and needs a decision. */
  pendingThreadOpen: PendingThreadOpen | null;

  // ── Setup state (Claude Code) (APP-GLOBAL) ──
  setupStatus: SetupStatus | null;
  environmentStatus: AgentEnvironmentStatus | null;
  setupInProgress: boolean;
  setupError: string | null;
  hasSeenWelcome: boolean;
  claudeSdkVersion: string | null;

  // ── Onboarding state (APP-GLOBAL) ──
  onboardingStatus: OnboardingStatus | null;
  onboardingDismissed: boolean;
  onboardingInstallStates: Record<OnboardingDependency, OnboardingInstallState>;

  // ── Discovered agents/commands from .claude/ (APP-GLOBAL) ──
  discoveredAgents: DiscoveredAgent[];
  discoveredCommands: DiscoveredCommand[];

  // ── Pinned agent (set via Launch Chat from Agent Library) (APP-GLOBAL) ──
  pinnedAgent: string | null;
  pinnedAgentContent: string | null;
  pinnedAgentDismissal: string | null;
  setPinnedAgent: (agentId: string | null) => void;
  clearPinnedAgentContent: () => void;
  clearPinnedAgentDismissal: () => void;
  requestPinAgent: (agentId: string, filePath: string) => void;

  // ── Appearance (APP-GLOBAL) ──
  chatFontSize: number;

  // ── Multi-conversation actions (Sprint 99) ──
  /** Create a new empty thread and make it active. Never touches existing threads. */
  createConversation: () => string;
  /** Switch which thread the sidebar shows. Never resets or tears down anything. */
  switchConversation: (id: string) => void;
  /** Ids of every open thread, in creation order. */
  listOpenConversations: () => string[];
  /** Close a thread: frees its runtime session, keeps the transcript in History. */
  closeConversation: (id: string) => void;
  /**
   * User pressed "+". Refocuses an existing empty thread, opens a new one, or —
   * at the soft cap — raises `pendingThreadOpen` for the user to decide (R11).
   */
  requestNewThread: () => void;
  /**
   * User picked a conversation in History. Switches to it if it is already open,
   * otherwise reopens it onto the rail under the same cap rule as "+" (Gap 3).
   */
  requestOpenConversation: (id: string) => void;
  /** "Open anyway" / "opened after closing something" — perform the pending open. */
  confirmThreadOpen: () => void;
  /** Dismiss the cap prompt without opening anything. */
  cancelThreadOpen: () => void;
  /** Rail/History view model for every open thread, in creation order. */
  listOpenThreads: () => OpenThreadSummary[];
  /** Restore persisted transcript fields into the active thread (webview state restore). */
  restoreActiveConversation: (partial: Partial<ConversationState>) => void;

  // ── Actions ──
  selectAgent: (agentId: AgentId) => void;
  selectModel: (modelId: string) => void;
  setPendingRuntime: (partial: Partial<PendingRuntimeSelection>) => void;
  sendAgentMessage: (prompt: string, attachments?: FileAttachment[], options?: { skipActiveFile?: boolean; skipBrowserContext?: boolean; hiddenContext?: string; mentionedAgentPaths?: string[] }) => void;
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
  sendCodexMessage: (prompt: string, attachments?: FileAttachment[], requestedMode?: 'auto' | 'ask' | 'plan', skipBrowserContext?: boolean) => void;
  selectCodexModel: (modelId: string) => void;
  /** Select an OpenCode model. compositeValue is the full "opencode:<provider>/<model>" string. */
  selectOpenCodeModel: (compositeValue: string) => void;
  /** Send a message to the OpenCode (ACP) runtime. */
  sendOpenCodeMessage: (prompt: string) => void;
  handleCodexApproval: (requestId: string | number, approved: boolean, alwaysAllow?: boolean) => void;
  /** Respond to a Claude Ask-mode file-write/shell-command approval card. */
  handleAgentToolApproval: (requestId: string, approved: boolean) => void;
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

const initialConversation = createConversationState(generateId());

/**
 * Sprint 99 (R13): the open-thread set is restored ONCE per webview, on the
 * first `agent:config` that carries a workspace path — that is the first moment
 * the workspace-scoped storage prefix is known. A later `agent:config` must not
 * re-open threads the user has since closed, so the guard lives here at module
 * scope rather than in component state.
 */
let openThreadsRestored = false;

/** Test-only: forget the restore guard so a relaunch can be simulated. */
export function resetOpenThreadRestoreForTest(): void {
  openThreadsRestored = false;
}

export const useAISidebarStore = create<AISidebarState>((set, get) => {
  // ── Conversation write helpers ───────────────────────────────────────────
  // Everything that mutates a conversation goes through these so the active
  // conversation's mirror can never drift from the map.

  /** Commit a whole conversation object, refreshing the mirror when it is active. */
  function commitConversation(next: ConversationState): void {
    const state = get();
    set({ conversations: { ...state.conversations, [next.id]: next } });
  }

  /**
   * Apply a partial update to ONE conversation. No-ops (with no warning — the
   * caller already resolved the id) if the conversation is not open.
   */
  function patchConversation(
    id: string | null,
    updater: (conversation: ConversationState) => Partial<ConversationState> | null,
  ): void {
    if (!id) return;
    const conversation = get().conversations[id];
    if (!conversation) return;
    const partial = updater(conversation);
    if (!partial) return;
    commitConversation({ ...conversation, ...partial });
  }

  /** Patch the last turn of a conversation's Claude transcript. */
  function patchLastAgentTurn(
    id: string | null,
    updater: (turn: AgentConversationTurn) => AgentConversationTurn | null,
    options: { requireRunning?: boolean } = { requireRunning: true },
  ): void {
    patchConversation(id, (conversation) => {
      const conv = [...conversation.agentConversation];
      const lastTurn = conv[conv.length - 1];
      if (!lastTurn) return null;
      if (options.requireRunning && !lastTurn.isRunning) return null;
      const nextTurn = updater(lastTurn);
      if (!nextTurn) return null;
      conv[conv.length - 1] = nextTurn;
      return { agentConversation: conv };
    });
  }

  /** Patch the last turn of a conversation's Codex/OpenCode transcript. */
  function patchLastCodexTurn(
    id: string | null,
    updater: (turn: CodexConversationTurn) => CodexConversationTurn | null,
    options: { requireRunning?: boolean } = { requireRunning: true },
  ): void {
    patchConversation(id, (conversation) => {
      const conv = [...conversation.codexConversation];
      const lastTurn = conv[conv.length - 1];
      if (!lastTurn) return null;
      if (options.requireRunning && !lastTurn.isRunning) return null;
      const nextTurn = updater(lastTurn);
      if (!nextTurn) return null;
      conv[conv.length - 1] = nextTurn;
      return { codexConversation: conv };
    });
  }

  /** The conversation the composer is bound to (spec R14: the ACTIVE thread). */
  function activeConversation(): ConversationState | null {
    const state = get();
    return state.activeConversationId ? state.conversations[state.activeConversationId] ?? null : null;
  }

  /** Resolve an inbound message to a target conversation id, or null to drop it. */
  function routeInbound(message: { type: string; conversationId?: string }): string | null {
    const state = get();
    return resolveInboundConversationId(message, {
      knownConversationIds: state.conversations,
      activeConversationId: state.activeConversationId,
    });
  }

  /** Persist ONE conversation. Background threads autosave without touching the active one. */
  function persistConversation(id: string): void {
    const state = get();
    const conversation = state.conversations[id];
    if (!conversation) return;

    const hasContent = !isConversationEmpty(conversation);
    if (!hasContent) return;

    const title = generateTitle(
      conversation.agentConversation,
      conversation.chatMessages,
      conversation.codexConversation,
    );
    const now = Date.now();
    const existingConv = state.savedConversations.find((c) => c.id === id);

    saveConversation({
      id,
      title,
      agentId: conversation.selectedAgent,
      createdAt: existingConv?.createdAt || conversation.createdAt || now,
      updatedAt: now,
      agentConversation: conversation.agentConversation,
      codexConversation: conversation.codexConversation,
      chatMessages: conversation.chatMessages,
      conversationHistory: conversation.conversationHistory,
    });

    set({ savedConversations: listConversations() });
  }

  /**
   * Drop the conversation being switched away from if the user never used it
   * (spec R10: "an empty thread you switch away from is quietly auto-discarded").
   * Never discards the last remaining thread.
   */
  function discardIfEmptyOnSwitchAway(leavingId: string | null, arrivingId: string): Record<string, ConversationState> | null {
    const state = get();
    if (!leavingId || leavingId === arrivingId) return null;
    const leaving = state.conversations[leavingId];
    if (!leaving || !isConversationEmpty(leaving)) return null;
    if (Object.keys(state.conversations).length <= 1) return null;
    const next = { ...state.conversations };
    delete next[leavingId];
    return next;
  }

  /**
   * Sprint 99 (R13 / E7): mirror the open set to localStorage and drop composer
   * slots belonging to threads that are no longer open. Called after every
   * change to `conversations` so the persisted rail can never lag the store.
   */
  function syncOpenThreads(): void {
    const state = get();
    const ids = Object.values(state.conversations)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => c.id);
    saveOpenThreadIds(ids);

    const composerQueues = pruneSlots(state.composerQueues, ids);
    const composerDrafts = pruneSlots(state.composerDrafts, ids);
    if (composerQueues !== state.composerQueues || composerDrafts !== state.composerDrafts) {
      set({ composerQueues, composerDrafts });
    }
  }

  /** Read one open thread's rail/History view model. */
  function summarizeThread(conversation: ConversationState, activeId: string | null): OpenThreadSummary {
    return {
      id: conversation.id,
      title: deriveThreadTitle(conversation),
      runtime: runtimeOfConversation(conversation),
      status: deriveThreadStatus(conversation),
      hasQueuedPrompt: !!get().composerQueues[conversation.id]?.trim(),
      isActive: conversation.id === activeId,
    };
  }

  /** Cap inputs for the open set, in rail order. */
  function capCandidates(): CapCandidate[] {
    const state = get();
    return Object.values(state.conversations)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => {
        const summary = summarizeThread(c, state.activeConversationId);
        return { id: c.id, title: summary.title, status: summary.status, hasQueuedPrompt: summary.hasQueuedPrompt };
      });
  }

  /**
   * Rebuild a stored conversation as an OPEN thread.
   *
   * R13: transcripts restore immediately, sessions do NOT — nothing here starts
   * a runtime. The session re-attaches on the user's next prompt in the thread.
   */
  function rehydrateStoredConversation(id: string, template: ConversationState | null): ConversationState | null {
    const data = loadConversation(id);
    if (!data) return null;

    let agentConv = data.agentConversation || [];
    let codexConv = data.codexConversation || [];
    if (data.agentId === 'codex' && codexConv.length === 0 && agentConv.length > 0) {
      codexConv = agentConv as unknown as typeof codexConv;
      agentConv = [];
    }
    const restoredAgentId: AgentId =
      data.agentId === 'claude-code' || data.agentId === 'codex' ? data.agentId : 'claude-code';

    return markConversationInterrupted(createConversationState(id, {
      createdAt: data.createdAt,
      agentConversation: stampConversationId(agentConv, id),
      codexConversation: stampConversationId(codexConv, id),
      chatMessages: data.chatMessages || [],
      conversationHistory: data.conversationHistory || [],
      selectedAgent: restoredAgentId,
      selectedModel: template?.selectedModel ?? '',
      codexSelectedModel: template?.codexSelectedModel ?? '',
      opencodeSelectedModel: template?.opencodeSelectedModel ?? '',
      pendingRuntime: {
        runtimeId: restoredAgentId,
        modelId: template?.pendingRuntime.modelId ?? '',
        mode: template?.pendingRuntime.mode ?? 'auto',
      },
      ...computeContextState(agentConv),
    }));
  }

  /**
   * Repopulate the rail from the persisted open-thread set (R13).
   *
   * Threads whose stored record has gone (pruned by the 50-conversation cap, or
   * deleted) are simply skipped. The thread the user is already looking at is
   * kept active; it is only replaced when it is an untouched blank and there is
   * real restored work to show instead.
   */
  function restoreOpenThreads(): void {
    const state = get();
    const storedIds = loadOpenThreadIds();
    if (storedIds.length === 0) return;

    const template = state.activeConversationId ? state.conversations[state.activeConversationId] : null;
    const restored: ConversationState[] = [];
    for (const id of storedIds) {
      if (state.conversations[id]) continue;
      const conversation = rehydrateStoredConversation(id, template);
      if (conversation) restored.push(conversation);
    }
    if (restored.length === 0) return;

    const conversations = { ...state.conversations };
    for (const conversation of restored) conversations[conversation.id] = conversation;

    // Drop the throwaway blank the webview booted with — but only if the user
    // has not typed in it, and only when something real replaces it (R10).
    let activeId = state.activeConversationId;
    const active = activeId ? conversations[activeId] : null;
    if (active && isConversationEmpty(active)) {
      delete conversations[active.id];
      activeId = restored[restored.length - 1].id;
    }

    const nextActive = activeId ? conversations[activeId] : null;
    if (!nextActive) return;
    set({ conversations, activeConversationId: nextActive.id });
    syncOpenThreads();
  }

  return {
    // ── Initial state ──
    hasApiKey: false,
    isOnline: true,
    ready: false,

    agenticEnabled: false,
    agents: [],
    models: [],

    selection: { text: '', isEmpty: true, from: 0, to: 0 },
    activeFilePath: null,
    currentBrowserContext: null,

    conversations: { [initialConversation.id]: initialConversation },
    activeConversationId: initialConversation.id,

    codexEnabled: false,
    codexModels: [],
    codexStatus: DEFAULT_CODEX_STATUS,
    dismissedCodexNoticeKey: null,

    opencodeEnabled: false,
    acpProviders: { google: false, openai: false, anthropic: false, openrouter: false },
    byokProviderModels: undefined,

    savedConversations: [],
    showHistoryPanel: false,

    composerQueues: {},
    composerDrafts: {},
    pendingThreadOpen: null,

    setupStatus: null,
    environmentStatus: null,
    setupInProgress: false,
    setupError: null,
    hasSeenWelcome: false,
    claudeSdkVersion: null,

    onboardingStatus: null,
    onboardingDismissed: false,
    onboardingInstallStates: {
      'git': 'unknown',
      'node': 'unknown',
      'claude-cli': 'unknown',
      'codex-cli': 'unknown',
    },

    chatFontSize: 13,
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

    // ── Multi-conversation actions (Sprint 99) ──

    createConversation: () => {
      const state = get();
      const previous = state.activeConversationId ? state.conversations[state.activeConversationId] : null;

      // R10: only one empty thread at a time — "+" refocuses the existing blank.
      if (previous && isConversationEmpty(previous)) {
        return previous.id;
      }

      // Inherit the runtime/model selection so a new thread starts on whatever
      // the user was last using rather than resetting to the Claude default.
      const conversation = createConversationState(generateId(), {
        selectedAgent: previous?.selectedAgent ?? 'claude-code',
        selectedModel: previous?.selectedModel ?? '',
        codexSelectedModel: previous?.codexSelectedModel ?? '',
        opencodeSelectedModel: previous?.opencodeSelectedModel ?? '',
        pendingRuntime: previous?.pendingRuntime ?? { runtimeId: 'claude-code', modelId: '', mode: 'auto' },
      });

      set({
        conversations: { ...state.conversations, [conversation.id]: conversation },
        activeConversationId: conversation.id,
      });
      syncOpenThreads();
      return conversation.id;
    },

    switchConversation: (id) => {
      const state = get();
      const target = state.conversations[id];
      if (!target || id === state.activeConversationId) return;

      // Sprint 99 (E4): NO resetProviderSessions() here. Switching is a view
      // change — every other thread keeps streaming.
      const pruned = discardIfEmptyOnSwitchAway(state.activeConversationId, id);
      set({
        ...(pruned ? { conversations: pruned } : {}),
        activeConversationId: id,
        showHistoryPanel: false,
      });
      if (pruned) syncOpenThreads();
    },

    listOpenConversations: () => {
      const conversations = get().conversations;
      return Object.values(conversations)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((c) => c.id);
    },

    closeConversation: (id) => {
      const state = get();
      const target = state.conversations[id];
      if (!target) return;

      // Close ≠ delete: persist first so the transcript is complete in History.
      persistConversation(id);
      // Closing DOES free the runtime session — this is one of the two remaining
      // legitimate reset sites (the other is an explicit clear/delete).
      resetProviderSession(id);

      const remaining = { ...get().conversations };
      delete remaining[id];

      if (id !== state.activeConversationId) {
        set({ conversations: remaining });
        syncOpenThreads();
        return;
      }

      const nextId = Object.values(remaining).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (nextId) {
        set({ conversations: remaining, activeConversationId: nextId.id });
        syncOpenThreads();
        return;
      }
      const fresh = createConversationState(generateId(), {
        selectedAgent: target.selectedAgent,
        selectedModel: target.selectedModel,
        codexSelectedModel: target.codexSelectedModel,
        opencodeSelectedModel: target.opencodeSelectedModel,
        pendingRuntime: target.pendingRuntime,
      });
      set({
        conversations: { [fresh.id]: fresh },
        activeConversationId: fresh.id,
      });
      syncOpenThreads();
    },

    listOpenThreads: () => {
      const state = get();
      return Object.values(state.conversations)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((c) => summarizeThread(c, state.activeConversationId));
    },

    requestNewThread: () => {
      // R10: one empty thread at a time — "+" refocuses the blank that exists
      // rather than stacking another. Checked across the whole open set, not
      // just the active thread, so a blank parked in the background is reused.
      const state = get();
      const existingEmpty = Object.values(state.conversations)
        .sort((a, b) => a.createdAt - b.createdAt)
        .find(isConversationEmpty);
      if (existingEmpty) {
        if (existingEmpty.id !== state.activeConversationId) get().switchConversation(existingEmpty.id);
        set({ showHistoryPanel: false });
        return;
      }

      const evaluation = evaluateSoftCap(capCandidates());
      if (evaluation.atCap) {
        set({ pendingThreadOpen: { kind: 'new' }, showHistoryPanel: false });
        return;
      }
      get().startNewConversation();
    },

    requestOpenConversation: (id) => {
      const state = get();
      // Already on the rail → this is just a switch, and the cap is irrelevant.
      if (state.conversations[id]) {
        get().switchConversation(id);
        return;
      }
      // Resolved Gap 3: a reopened thread is an open thread, so it obeys the
      // same cap rule as "+". Exempting it would be an easy way to accumulate
      // ten open threads without ever seeing the prompt.
      const evaluation = evaluateSoftCap(capCandidates());
      if (evaluation.atCap) {
        set({ pendingThreadOpen: { kind: 'reopen', conversationId: id }, showHistoryPanel: false });
        return;
      }
      get().loadSavedConversation(id);
    },

    confirmThreadOpen: () => {
      const pending = get().pendingThreadOpen;
      if (!pending) return;
      set({ pendingThreadOpen: null });
      if (pending.kind === 'new') get().startNewConversation();
      else get().loadSavedConversation(pending.conversationId);
    },

    cancelThreadOpen: () => set({ pendingThreadOpen: null }),

    setComposerQueue: (conversationId, prompt) => {
      set({ composerQueues: setSlot(get().composerQueues, conversationId, prompt) });
    },

    clearComposerQueue: (conversationId) => {
      set({ composerQueues: clearSlot(get().composerQueues, conversationId) });
    },

    setComposerDraft: (conversationId, text) => {
      const drafts = get().composerDrafts;
      set({
        composerDrafts: text
          ? setSlot(drafts, conversationId, text)
          : clearSlot(drafts, conversationId),
      });
    },

    restoreActiveConversation: (partial) => {
      const active = activeConversation();
      if (!active) return;
      const merged: ConversationState = { ...active, ...partial, id: active.id };
      merged.agentConversation = stampConversationId(merged.agentConversation, merged.id);
      merged.codexConversation = stampConversationId(merged.codexConversation, merged.id);
      commitConversation(merged);
    },

    // ── Actions ──

    selectAgent: (agentId) => {
      patchConversation(get().activeConversationId, () => ({ selectedAgent: agentId }));
      vscode.postMessage({ type: 'ai-select-agent', agentId, conversationId: get().activeConversationId });
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
      patchConversation(get().activeConversationId, () => ({ selectedModel: modelId }));
      vscode.postMessage({ type: 'ai-select-model', modelId, conversationId: get().activeConversationId });
    },

    setPendingRuntime: (partial) => {
      patchConversation(get().activeConversationId, (c) => ({
        pendingRuntime: { ...c.pendingRuntime, ...partial },
      }));
    },

    sendAgentMessage: (prompt, attachments?, options?) => {
      const state = get();
      const conversation = activeConversation();
      if (!conversation) return;

      // Sprint 99 (E3): the guard consults the TARGET conversation. A running
      // thread A must not block sending in idle thread B.
      const lastTurn = conversation.agentConversation[conversation.agentConversation.length - 1];
      if (lastTurn?.isRunning) return;

      const activeFile = (!options?.skipActiveFile && state.activeFilePath) ? state.activeFilePath : undefined;

      // Prepend Codex turns that happened after Claude's last turn (same thread only)
      const lastAgentTimestamp = lastTurn?.timestamp ?? 0;
      const handoff = buildHandoffContext(
        conversation.codexConversation.map((t) => ({
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
        conversationId: conversation.id,
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

      patchConversation(conversation.id, (c) => ({ agentConversation: [...c.agentConversation, turn] }));

      // Send attachments as serializable payload (strip thumbnails for extension)
      const attachmentPayload = attachments?.map((att) => ({
        id: att.id,
        kind: att.kind,
        name: att.name,
        data: att.data,
        mediaType: att.mediaType,
      }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        agentId: 'claude-code',
        prompt: fullPrompt,
        attachments: attachmentPayload,
        approvalMode: conversation.pendingRuntime.mode,
        skipActiveFile: options?.skipActiveFile,
        skipBrowserContext: options?.skipBrowserContext,
        mentionedAgentPaths: options?.mentionedAgentPaths,
      });
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
      const { selection, activeFilePath } = state;
      if (selection.isEmpty || !selection.text) return undefined;
      // The approval mode is per-thread: frame the block for the thread the
      // composer is bound to (the active one).
      const approvalMode = activeConversation()?.pendingRuntime.mode ?? 'auto';

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
      const isEditMode = approvalMode !== 'plan';
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
      const conversation = activeConversation();
      if (!conversation) return;
      const conversationId = conversation.id;

      // Route by active turn, not selectedAgent — supports mixed-runtime conversations
      const hasRunningCodex = conversation.codexConversation.some((t) => t.isRunning);
      const hasRunningClaude = conversation.agentConversation.some((t) => t.isRunning);

      if (hasRunningCodex) {
        // Cancel the runtime that owns the running turn, not the (possibly switched)
        // picker selection — Codex and OpenCode both live in codexConversation.
        const runningTurn = [...conversation.codexConversation].reverse().find((t) => t.isRunning);
        const agentId = runningTurn?.runtime ?? 'codex';
        vscode.postMessage({ type: 'agent-cancel', conversationId, agentId });
        patchLastCodexTurn(conversationId, (last) => ({
          ...last,
          isRunning: false,
          result: { status: 'interrupted', error: 'Cancelled by user' },
        }));
      } else if (hasRunningClaude) {
        vscode.postMessage({ type: 'agent-cancel', conversationId, agentId: 'claude-code' });
        patchLastAgentTurn(conversationId, (last) => ({
          ...last,
          isRunning: false,
          result: { text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: 'Cancelled by user' },
        }));
      }
    },

    applyWidget: (widget) => {
      vscode.postMessage({
        type: 'execute-widget',
        toolName: widget.toolName,
        args: widget.args,
        selection: widget.selection,
      });
      patchConversation(get().activeConversationId, (c) => ({
        chatMessages: [
          ...c.chatMessages,
          { id: nextId(), role: 'assistant', content: 'Applied.', timestamp: Date.now() } as ChatMessage,
        ],
      }));
    },

    discardWidget: (messageId) => {
      patchConversation(get().activeConversationId, (c) => ({
        chatMessages: c.chatMessages.map((m) => (m.id === messageId ? { ...m, widget: undefined } : m)),
      }));
    },

    configureApiKey: () => {
      vscode.postMessage({ type: 'ai-configure-key' });
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
      const conversation = activeConversation();
      const targetTurn = conversation?.agentConversation.find((t) => t.id === turnId);
      if (!conversation || !targetTurn?.pendingPlanApproval) {
        return;
      }

      patchConversation(conversation.id, (c) => ({
        agentConversation: c.agentConversation.map((t) =>
          t.id === turnId
            ? { ...t, planHandled: true, planDecision: 'approved' as const, pendingPlanApproval: undefined }
            : t
        ),
      }));
      vscode.postMessage({
        type: 'agent-approve',
        conversationId: conversation.id,
        agentId: 'claude-code',
        requestId: targetTurn.pendingPlanApproval.toolUseId,
        approved: true,
        alwaysAllow: false,
      });
    },

    rejectPlan: (turnId, _feedback?) => {
      const conversation = activeConversation();
      const targetTurn = conversation?.agentConversation.find((t) => t.id === turnId);
      if (!conversation || !targetTurn?.pendingPlanApproval) {
        return;
      }

      patchConversation(conversation.id, (c) => ({
        agentConversation: c.agentConversation.map((t) =>
          t.id === turnId
            ? { ...t, planHandled: true, planDecision: 'rejected' as const, pendingPlanApproval: undefined }
            : t
        ),
      }));
      vscode.postMessage({
        type: 'agent-approve',
        conversationId: conversation.id,
        agentId: 'claude-code',
        requestId: targetTurn.pendingPlanApproval.toolUseId,
        approved: false,
        alwaysAllow: false,
      });
    },

    answerAgentQuestion: (turnId, question, answers) => {
      const conversation = activeConversation();
      if (!conversation) return;
      patchConversation(conversation.id, (c) => ({
        agentConversation: c.agentConversation.map((turn) =>
          turn.id === turnId ? { ...turn, pendingQuestion: undefined } : turn
        ),
      }));
      vscode.postMessage({
        type: 'agent-answer-question',
        conversationId: conversation.id,
        toolUseId: question.toolUseId,
        answers,
      });
    },

    dismissWelcome: () => {
      set({ hasSeenWelcome: true });
      vscode.postMessage({ type: 'agent-setup:dismiss-welcome' });
    },

    sendCodexMessage: (prompt, attachments?, requestedMode?, skipBrowserContext?) => {
      const conversation = activeConversation();
      if (!conversation) return;

      // Sprint 99 (E3): per-conversation guard.
      const lastTurn = conversation.codexConversation[conversation.codexConversation.length - 1];
      if (lastTurn?.isRunning) return;

      // Prepend Claude turns that happened after Codex's last turn (same thread only)
      const lastCodexTimestamp = lastTurn?.timestamp ?? 0;
      const handoff = buildHandoffContext(
        conversation.agentConversation.map((t) => ({
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
        conversationId: conversation.id,
        userPrompt: prompt,
        requestedPlanMode: requestedMode === 'plan' || shouldRequestPlanMode(prompt),
        activeFilePath: get().activeFilePath || undefined,
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

      patchConversation(conversation.id, (c) => ({ codexConversation: [...c.codexConversation, turn] }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        agentId: 'codex',
        prompt: fullPrompt,
        model: conversation.codexSelectedModel,
        // Unified approval policy (Auto/Ask/Plan) — the host maps it to the Codex
        // approval policy + plan collaboration mode.
        approvalMode: requestedMode ?? 'auto',
        skipBrowserContext,
        attachments: attachments?.map(a => ({ kind: a.kind, data: a.data, mediaType: a.mediaType })),
      });
    },

    selectCodexModel: (modelId) => {
      patchConversation(get().activeConversationId, () => ({ codexSelectedModel: modelId }));
    },

    selectOpenCodeModel: (compositeValue) => {
      patchConversation(get().activeConversationId, () => ({ opencodeSelectedModel: compositeValue }));
    },

    sendOpenCodeMessage: (prompt) => {
      const conversation = activeConversation();
      if (!conversation) return;

      // Sprint 99 (E3): per-conversation guard.
      const lastTurn = conversation.codexConversation[conversation.codexConversation.length - 1];
      if (lastTurn?.isRunning) return;

      // Strip the "opencode:" prefix — host expects bare "provider/model"
      const compositeValue = conversation.opencodeSelectedModel;
      const model = compositeValue.startsWith('opencode:')
        ? compositeValue.slice('opencode:'.length)
        : compositeValue;

      const turn: CodexConversationTurn = {
        id: nextId(),
        conversationId: conversation.id,
        runtime: 'opencode',
        userPrompt: prompt,
        requestedPlanMode: false,
        activeFilePath: get().activeFilePath || undefined,
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

      patchConversation(conversation.id, (c) => ({ codexConversation: [...c.codexConversation, turn] }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        agentId: 'opencode',
        prompt,
        model,
        approvalMode: conversation.pendingRuntime.mode,
      });
    },

    handleCodexApproval: (requestId, approved, alwaysAllow?) => {
      const conversation = activeConversation();
      if (!conversation) return;
      // Clear the approval from the turn that raised it
      patchConversation(conversation.id, (c) => ({
        codexConversation: c.codexConversation.map((t) =>
          t.approval?.requestId === requestId ? { ...t, approval: undefined } : t
        ),
      }));
      // ACP approvals (requestId starts with "acp-") use a different agentId
      if (typeof requestId === 'string' && requestId.startsWith('acp-')) {
        vscode.postMessage({ type: 'agent-approve', conversationId: conversation.id, agentId: 'opencode', requestId, approved, alwaysAllow });
      } else {
        vscode.postMessage({ type: 'agent-approve', conversationId: conversation.id, agentId: 'codex', requestId, approved, alwaysAllow: false });
      }
    },

    handleAgentToolApproval: (requestId, approved) => {
      const conversation = activeConversation();
      if (!conversation) return;
      // Clear the Ask-mode approval card from the Claude turn, then respond.
      patchConversation(conversation.id, (c) => ({
        agentConversation: c.agentConversation.map((t) =>
          t.approval?.requestId === requestId ? { ...t, approval: undefined } : t
        ),
      }));
      vscode.postMessage({ type: 'agent-approve', conversationId: conversation.id, agentId: 'claude-code', requestId, approved, alwaysAllow: false });
    },

    answerCodexQuestion: (turnId, question, answers) => {
      const conversation = activeConversation();
      if (!conversation) return;
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
      patchConversation(conversation.id, (c) => ({
        codexConversation: c.codexConversation.map((turn) =>
          turn.id === turnId ? { ...turn, pendingQuestion: undefined } : turn
        ),
      }));
      vscode.postMessage({ type: 'codex-answer-question', conversationId: conversation.id, requestId: question.requestId, answers: answerMap });
    },

    approveCodexPlan: (turnId) => {
      const conversation = activeConversation();
      if (!conversation) return;
      const { conversation: nextTurns, prompt } = applyCodexPlanApproval(conversation.codexConversation, turnId, nextId);
      if (!prompt) {
        return;
      }
      patchConversation(conversation.id, () => ({ codexConversation: nextTurns }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        agentId: 'codex',
        prompt,
        model: conversation.codexSelectedModel,
      });
    },

    discardCodexPlan: (turnId) => {
      patchConversation(get().activeConversationId, (c) => ({
        codexConversation: c.codexConversation.map((turn) =>
          turn.id === turnId
            ? { ...turn, planHandled: true, planDecision: 'rejected' as const }
            : turn
        ),
      }));
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
      patchConversation(get().activeConversationId, () => ({ dismissedCurrentPlanKey: key }));
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
      }
    },

    // ── Chat history actions ──

    loadConversationList: () => {
      const list = listConversations();
      set({ savedConversations: list });
    },

    saveCurrentConversation: () => {
      const id = get().activeConversationId;
      if (id) persistConversation(id);
    },

    /**
     * Open a conversation from History.
     *
     * Sprint 99 (E4 + R12): this NEVER resets a provider session and never
     * destroys the thread the user is on. An already-open conversation is just
     * switched to; a closed one is promoted back onto the open set.
     */
    loadSavedConversation: (id) => {
      const state = get();

      if (state.conversations[id]) {
        get().switchConversation(id);
        return;
      }

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

      // Coerce legacy 'ritemark-agent' agentId to 'claude-code' — legacy agent is
      // no longer selectable; legacy conversations are read-only via compat shim.
      const isLegacyAgent = data.agentId === 'ritemark-agent';
      const loadedAgentId: AgentId =
        data.agentId === 'claude-code' || data.agentId === 'codex'
          ? data.agentId
          : 'claude-code';

      // Build a LegacyRitemarkConversationRun so AISidebar can display it read-only
      // when agentConversation and codexConversation are both empty.
      const chatMessages = data.chatMessages || [];
      const conversationHistory = data.conversationHistory || [];
      const hasOnlyLegacyMessages =
        chatMessages.length > 0 && agentConv.length === 0 && codexConv.length === 0;
      let legacyConversation: LegacyRitemarkConversationRun | null = null;
      if (isLegacyAgent || hasOnlyLegacyMessages) {
        const firstUserMsg = chatMessages.find((m) => m.role === 'user');
        legacyConversation = {
          id: `${id}-legacy`,
          runtimeId: 'legacy-ritemark',
          userPrompt: firstUserMsg?.content ?? '',
          status: 'complete',
          timestamp: chatMessages[0]?.timestamp ?? data.createdAt,
          completedAt: data.updatedAt,
          providerTurn: { messages: chatMessages, conversationHistory },
        };
      }

      const previous = state.activeConversationId ? state.conversations[state.activeConversationId] : null;
      const restored = createConversationState(id, {
        createdAt: data.createdAt,
        agentConversation: stampConversationId(agentConv, id),
        codexConversation: stampConversationId(codexConv, id),
        chatMessages,
        conversationHistory,
        legacyConversation,
        selectedAgent: loadedAgentId,
        selectedModel: previous?.selectedModel ?? '',
        codexSelectedModel: previous?.codexSelectedModel ?? '',
        opencodeSelectedModel: previous?.opencodeSelectedModel ?? '',
        pendingRuntime: {
          runtimeId: loadedAgentId,
          modelId: previous?.pendingRuntime.modelId ?? '',
          mode: previous?.pendingRuntime.mode ?? 'auto',
        },
        ...computeContextState(agentConv),
      });

      const pruned = discardIfEmptyOnSwitchAway(state.activeConversationId, id) ?? state.conversations;
      set({
        conversations: { ...pruned, [id]: restored },
        activeConversationId: id,
        showHistoryPanel: false,
      });
      syncOpenThreads();

      // Update agent selection in extension
      vscode.postMessage({ type: 'ai-select-agent', agentId: loadedAgentId, conversationId: id });
    },

    deleteSavedConversation: (id) => {
      deleteConversationFromStorage(id);

      // Deleting an OPEN conversation also closes it — that is a genuine
      // "throw this away", so its runtime session is released.
      if (get().conversations[id]) {
        get().closeConversation(id);
      }

      set({ savedConversations: listConversations() });
    },

    /**
     * "New chat".
     *
     * Sprint 99 (R10 + E4): this creates an ADDITIONAL thread. It no longer
     * wipes the current one and no longer resets any provider session — the old
     * "new chat destroys the live one" semantic is gone.
     */
    startNewConversation: () => {
      const id = get().activeConversationId;
      if (id) persistConversation(id);
      get().createConversation();
      set({ showHistoryPanel: false });
    },

    toggleHistoryPanel: () => {
      const state = get();
      if (!state.showHistoryPanel) {
        // Load list when opening
        get().loadConversationList();
      }
      set({ showHistoryPanel: !state.showHistoryPanel });
    },

    /**
     * `/clear` — explicitly throw the current thread away.
     *
     * This is one of the two remaining legitimate reset sites (the other is
     * `closeConversation`). It resets exactly ONE conversation's runtime session,
     * never "all providers". The thread keeps its rail slot but gets a fresh id
     * so the next turn does not overwrite the cleared conversation in History
     * (#135).
     */
    clearChat: () => {
      const state = get();
      const previousId = state.activeConversationId;
      const previous = previousId ? state.conversations[previousId] : null;
      if (!previous || !previousId) return;

      resetProviderSession(previousId);

      const fresh = createConversationState(generateId(), {
        selectedAgent: previous.selectedAgent,
        selectedModel: previous.selectedModel,
        codexSelectedModel: previous.codexSelectedModel,
        opencodeSelectedModel: previous.opencodeSelectedModel,
        pendingRuntime: previous.pendingRuntime,
      });
      const conversations = { ...state.conversations };
      delete conversations[previousId];
      conversations[fresh.id] = fresh;

      set({ conversations, activeConversationId: fresh.id });
      syncOpenThreads();
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

        case 'comment:submit': {
          // Sprint 94 (#81): a comment assigned to an agent (@claude/@codex/
          // @opencode) was sent from the editor. Route it to the mentioned runtime
          // and submit — reuses the normal send path (→ agent-execute).
          const rt: 'claude-code' | 'codex' | 'opencode' =
            message.agentId === 'codex'
              ? 'codex'
              : message.agentId === 'opencode'
                ? 'opencode'
                : 'claude-code';
          get().setPendingRuntime({ runtimeId: rt });
          if (!message.prompt) break;
          if (rt === 'codex') get().sendCodexMessage(message.prompt);
          else if (rt === 'opencode') get().sendOpenCodeMessage(message.prompt);
          else get().sendAgentMessage(message.prompt);
          break;
        }

        case 'agent:config': {
          // Set workspace context for per-project history scoping, then immediately
          // reload the conversation list so the history panel shows all saved entries.
          if (message.workspacePath) {
            setWorkspaceContext(message.workspacePath);
            get().loadConversationList();
            // R13 / E7: the workspace prefix is only known now, so this is the
            // first moment the persisted open-thread set can be read. Runs once
            // per webview — a later agent:config must not re-open threads the
            // user has since closed.
            if (!openThreadsRestored) {
              openThreadsRestored = true;
              restoreOpenThreads();
            }
          }
          const newCodexModels = message.codexModels || [];
          const newClaudeModels = message.models || [];
          const incomingAgent = (message.selectedAgent as AgentId) || 'claude-code';
          const incomingRuntimeId: 'claude-code' | 'codex' | 'opencode' =
            incomingAgent === 'codex' ? 'codex'
            : incomingAgent === 'opencode' ? 'opencode'
            : 'claude-code';
          const incomingCodexStatus = message.codexStatus ?? get().codexStatus;
          const opencodeEnabled = message.opencodeEnabled ?? get().opencodeEnabled;
          const acpProviders = message.acpProviders ?? get().acpProviders;
          const byokProviderModels = message.byokProviderModels ?? get().byokProviderModels;

          // Model-catalog reconciliation applies to EVERY open thread: if a thread's
          // selection is no longer in the catalog it falls back to the first entry.
          // Runtime binding (selectedAgent / pendingRuntime.runtimeId) is applied only
          // to the ACTIVE thread — the host's "selected agent" is a single value and
          // must not re-bind background threads to a different runtime.
          const activeId = get().activeConversationId;
          const conversations: Record<string, ConversationState> = {};
          for (const conversation of Object.values(get().conversations)) {
            const codexSelectedModel = newCodexModels.some((m: { id: string }) => m.id === conversation.codexSelectedModel)
              ? conversation.codexSelectedModel
              : (newCodexModels[0]?.id || conversation.codexSelectedModel);
            const candidateClaude = conversation.id === activeId
              ? (message.selectedModel || conversation.selectedModel)
              : conversation.selectedModel;
            const selectedModel = newClaudeModels.some((m: { id: string }) => m.id === candidateClaude)
              ? candidateClaude
              : (newClaudeModels[0]?.id || candidateClaude);
            const isActive = conversation.id === activeId;
            conversations[conversation.id] = {
              ...conversation,
              selectedModel,
              codexSelectedModel,
              // Default the OpenCode picker to the first configured model (state isn't
              // persisted across window reloads, so it resets to '' otherwise).
              opencodeSelectedModel: conversation.opencodeSelectedModel || firstAvailableOpenCodeModel(
                opencodeEnabled,
                acpProviders,
                byokProviderModels,
              ),
              ...(isActive
                ? {
                    selectedAgent: incomingAgent,
                    pendingRuntime: { ...conversation.pendingRuntime, runtimeId: incomingRuntimeId, modelId: selectedModel },
                  }
                : {}),
            };
          }

          set({
            agenticEnabled: message.agenticEnabled,
            codexEnabled: message.codexEnabled ?? false,
            agents: message.agents,
            models: newClaudeModels,
            codexModels: newCodexModels,
            codexStatus: incomingCodexStatus,
            dismissedCodexNoticeKey: getCodexCompatibilityNoticeKey(incomingCodexStatus)
              ? get().dismissedCodexNoticeKey
              : null,
            setupStatus: message.setupStatus ?? get().setupStatus,
            environmentStatus: message.environmentStatus ?? get().environmentStatus,
            hasSeenWelcome: message.hasSeenWelcome ?? get().hasSeenWelcome,
            discoveredAgents: message.discoveredAgents || [],
            discoveredCommands: message.discoveredCommands || [],
            claudeSdkVersion: message.claudeSdkVersion ?? get().claudeSdkVersion,
            // Sprint 76: OpenCode / ACP fields
            opencodeEnabled,
            acpProviders,
            byokProviderModels,
            conversations,
          });
          break;
        }

        case 'acp-providers': {
          const conversations: Record<string, ConversationState> = {};
          for (const conversation of Object.values(get().conversations)) {
            conversations[conversation.id] = {
              ...conversation,
              opencodeSelectedModel: conversation.opencodeSelectedModel || firstAvailableOpenCodeModel(
                message.enabled,
                message.providers,
                get().byokProviderModels,
              ),
            };
          }
          set({
            opencodeEnabled: message.enabled,
            acpProviders: message.providers,
            conversations,
          });
          break;
        }

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

          set(updates);

          // The Codex binary/auth is app-global, so a not-ready status blocks the
          // running turn in EVERY thread that has one — not just the visible one.
          if (message.status.state !== 'ready') {
            for (const id of Object.keys(get().conversations)) {
              patchLastCodexTurn(id, (lastTurn) => ({
                ...lastTurn,
                approval: undefined,
                isRunning: false,
                result: {
                  status: 'blocked',
                  error: message.status.error || 'Codex is not ready.',
                },
              }));
            }
          }
          break;
        }

        // (Sprint 89 #109) 'agent:models-update' removed — the extension now re-sends
        // full 'agent:config' (with a reconciled selectedModel) on catalog refresh.

        case 'selection-update':
          set({
            selection: message.selection,
            ...(message.activeFilePath !== undefined ? { activeFilePath: message.activeFilePath ?? null } : {}),
          });
          break;

        case 'active-file-changed':
          set({ activeFilePath: message.path });
          break;

        case 'active-browser-changed':
          set({ currentBrowserContext: message.context ?? null });
          break;

        case 'ai-streaming':
          patchConversation(state.activeConversationId, () => ({ streamingContent: message.content }));
          break;

        case 'ai-result': {
          const assistantMsg: ChatMessage = {
            id: nextId(),
            role: 'assistant',
            content: message.message || '',
            timestamp: Date.now(),
          };
          const targetId = state.activeConversationId;
          patchConversation(targetId, (c) => ({
            isStreaming: false,
            streamingContent: '',
            chatMessages: [...c.chatMessages, assistantMsg],
            conversationHistory: [
              ...c.conversationHistory,
              { role: 'assistant' as const, content: message.message || '' },
            ],
          }));

          // Auto-save conversation after chat turn completes
          if (targetId) setTimeout(() => persistConversation(targetId), 100);
          break;
        }

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
          patchConversation(state.activeConversationId, (c) => ({
            isStreaming: false,
            streamingContent: '',
            chatMessages: [...c.chatMessages, widgetMsg],
          }));
          break;
        }

        case 'ai-error': {
          const errorMsg: ChatMessage = {
            id: nextId(),
            role: 'error',
            content: message.error,
            timestamp: Date.now(),
          };
          patchConversation(state.activeConversationId, (c) => ({
            isStreaming: false,
            streamingContent: '',
            chatMessages: [...c.chatMessages, errorMsg],
          }));
          break;
        }

        case 'ai-stopped':
          patchConversation(state.activeConversationId, () => ({ isStreaming: false, streamingContent: '' }));
          break;

        case 'clear-chat':
          // "New chat" (ritemark.newChat command). Route through
          // startNewConversation so it behaves exactly like the `/new` command:
          // saves the current thread and opens an ADDITIONAL one (Sprint 99 R10 —
          // it no longer destroys the current thread).
          get().startNewConversation();
          break;

        case 'toggle-history-panel':
          get().toggleHistoryPanel();
          break;

        case 'files-dropped':
          // Dispatch to ChatInput via DOM event (ChatInput manages its own pathChips state)
          window.dispatchEvent(new CustomEvent('ritemark:files-dropped', { detail: message.paths }));
          break;

        case 'agent-progress': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          const progress = message.progress as AgentProgress;

          patchLastAgentTurn(targetId, (lastTurn) => {
            if (progress.type === 'plan_text') {
              return {
                ...lastTurn,
                planText: `${lastTurn.planText || ''}${lastTurn.planText ? '\n\n' : ''}${progress.message}`,
              };
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
              return {
                ...lastTurn,
                activities: [...lastTurn.activities, progress],
                subagents: [...(lastTurn.subagents || []), newSubagent],
              };
            }
            if (progress.type === 'subagent_progress' && progress.parentToolUseId) {
              // Add activity to the matching subagent
              return {
                ...lastTurn,
                activities: [...lastTurn.activities, progress],
                subagents: lastTurn.subagents?.map((sa) =>
                  sa.id === progress.parentToolUseId
                    ? { ...sa, activities: [...sa.activities, progress] }
                    : sa
                ),
              };
            }
            if (progress.type === 'subagent_done' && progress.subagentId) {
              // Mark subagent as done
              return {
                ...lastTurn,
                activities: [...lastTurn.activities, progress],
                subagents: lastTurn.subagents?.map((sa) =>
                  sa.id === progress.subagentId
                    ? { ...sa, status: 'done' as const, result: progress.message }
                    : sa
                ),
              };
            }
            // Regular activity
            return { ...lastTurn, activities: [...lastTurn.activities, progress] };
          });
          break;
        }

        case 'agent-question': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastAgentTurn(targetId, (lastTurn) => ({ ...lastTurn, pendingQuestion: message.question }));
          break;
        }

        case 'agent-plan-approval': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastAgentTurn(targetId, (lastTurn) => {
            const pendingPlanApproval: AgentPlanApprovalRequest = message.request;
            return {
              ...lastTurn,
              isPlan: true,
              planHandled: false,
              planDecision: undefined,
              pendingPlanApproval,
              // ExitPlanMode's input.plan is the canonical plan text; streamed
              // plan_text events (lastTurn.planText) are only a fallback.
              planText: pendingPlanApproval.plan?.trim()
                ? pendingPlanApproval.plan
                : lastTurn.planText,
            };
          });
          break;
        }

        case 'agent-result': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          let landed = false;
          patchLastAgentTurn(
            targetId,
            (lastTurn) => {
              landed = true;
              // Check if this turn had a plan_ready activity → mark as plan
              const hasPlanActivity = lastTurn.activities.some(a => a.type === 'plan_ready');
              return {
                ...lastTurn,
                isRunning: false,
                isPlan: hasPlanActivity,
                pendingQuestion: undefined,
                pendingPlanApproval: undefined,
                approval: undefined,
                result: {
                  text: message.text || '',
                  filesModified: message.filesModified || [],
                  metrics: message.metrics || { durationMs: 0, costUsd: null, model: null },
                  error: message.error,
                },
              };
            },
            { requireRunning: false },
          );
          if (landed) {
            patchConversation(targetId, (c) => computeContextState(c.agentConversation));
            // Auto-save the conversation that finished — not "the current" one.
            setTimeout(() => persistConversation(targetId), 100);
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
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({
            ...lastTurn,
            activities: [...lastTurn.activities, message.progress as AgentProgress],
          }));
          break;
        }

        case 'codex-streaming': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({
            ...lastTurn,
            streamingText: lastTurn.streamingText + message.delta,
          }));
          break;
        }

        case 'codex-question': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({
            ...lastTurn,
            pendingQuestion: {
              requestId: message.requestId,
              questions: message.questions,
            },
            requiresPlanReview: false,
            planHandled: false,
            planDecision: undefined,
          }));
          break;
        }

        case 'codex-plan-text-delta': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({
            ...lastTurn,
            planText: `${lastTurn.planText || ''}${message.delta}`,
            planHandled: false,
            planDecision: undefined,
          }));
          break;
        }

        case 'codex-plan-update': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => applyCodexPlanUpdate(lastTurn, {
            explanation: message.explanation,
            plan: message.plan,
          }));
          break;
        }

        case 'codex-result': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          let landed = false;
          patchLastCodexTurn(
            targetId,
            (lastTurn) => {
              landed = true;
              return finalizeCodexTurnResult(lastTurn, {
                status: message.status,
                error: message.error,
              });
            },
            { requireRunning: false },
          );
          if (landed) setTimeout(() => persistConversation(targetId), 100);
          break;
        }

        case 'codex-rpc-progress': {
          // A slow RPC (typically thread/start at cold start) is still in
          // flight. Surface the message on the running turn so the user
          // sees progress instead of a frozen UI.
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({ ...lastTurn, rpcProgressMessage: message.message }));
          break;
        }

        case 'agent-approval-request': {
          const targetId = routeInbound(message);
          if (!targetId) break;

          // Reconstruct a fileChanges map so the card shows what's being changed.
          // ACP/Claude send a single `filePath`; Codex sends a JSON `diff` map.
          const buildFileChanges = (): Record<string, unknown> | undefined => {
            if (message.filePath) return { [message.filePath]: { type: 'edit' } };
            if (message.diff) { try { return JSON.parse(message.diff); } catch { return undefined; } }
            return undefined;
          };

          if (message.agentId === 'claude-code') {
            // Claude approvals render on the agent (Claude) conversation turn.
            patchLastAgentTurn(targetId, (lastTurn) => {
              if (message.kind === 'plan') {
                return {
                  ...lastTurn,
                  isPlan: true,
                  planHandled: false,
                  planDecision: undefined,
                  pendingPlanApproval: { toolUseId: message.requestId, plan: message.planText },
                  planText: message.planText?.trim() ? message.planText : lastTurn.planText,
                };
              }
              // Ask-mode file-write / shell-command approval.
              return {
                ...lastTurn,
                approval: {
                  approvalType: message.kind === 'file-write' ? 'fileChange' : 'command',
                  requestId: message.requestId,
                  command: message.command,
                  workingDir: message.workingDir,
                  fileChanges: buildFileChanges(),
                },
              };
            });
          } else {
            // File-write / shell-command / permission approval for Codex + ACP
            patchLastCodexTurn(targetId, (lastTurn) => ({
              ...lastTurn,
              approval: {
                approvalType: message.kind === 'file-write' ? 'fileChange' : 'command',
                requestId: message.requestId,
                command: message.command,
                workingDir: message.workingDir,
                fileChanges: buildFileChanges(),
              },
            }));
          }
          break;
        }

        case 'codex-approval': {
          const targetId = routeInbound(message);
          if (!targetId) break;
          patchLastCodexTurn(targetId, (lastTurn) => ({
            ...lastTurn,
            approval: {
              approvalType: message.approvalType,
              requestId: message.requestId,
              command: message.command,
              workingDir: message.workingDir,
              fileChanges: message.fileChanges,
            },
          }));
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
  };
});

// ── Reading the active thread ────────────────────────────────────────────────

/**
 * Placeholder returned when there is no active thread.
 *
 * A module-level constant, not a fresh object: `selectActiveConversation` runs
 * inside `useSyncExternalStore`, which compares the snapshot it gets back by
 * identity and loops forever ("The result of getSnapshot should be cached") if
 * the selector mints a new object each call. Everything else the selector can
 * return is an object the store already owns, so it is stable by construction.
 *
 * In practice this is unreachable — the store always keeps at least one open
 * conversation (`closeConversation` and `clearChat` both create a replacement) —
 * it exists so callers get a `ConversationState` rather than a nullable.
 */
const NO_ACTIVE_CONVERSATION: ConversationState = createConversationState('__no-active-conversation__');

type ActiveConversationSlice = Pick<AISidebarState, 'conversations' | 'activeConversationId'>;

/** The conversation the sidebar is currently showing. Stable reference. */
export function selectActiveConversation(state: ActiveConversationSlice): ConversationState {
  const id = state.activeConversationId;
  return (id ? state.conversations[id] : undefined) ?? NO_ACTIVE_CONVERSATION;
}

/**
 * Subscribe to the active thread's state.
 *
 * This is THE way a view reads conversation-scoped state — transcripts, runtime
 * and model selection, per-thread UI flags. Anything genuinely app-global
 * (connectivity, catalogs, setup status, appearance) stays on the store itself
 * and is read with `useAISidebarStore` as before.
 */
export function useActiveConversation(): ConversationState {
  return useAISidebarStore(selectActiveConversation);
}

/**
 * Replace the whole open-thread set. Used by tests and (from Phase 5) by the
 * per-workspace open-thread restore (R13).
 */
export function hydrateConversations(conversations: ConversationState[], activeId: string): void {
  const map: Record<string, ConversationState> = {};
  for (const conversation of conversations) map[conversation.id] = conversation;
  const active = map[activeId];
  if (!active) throw new Error(`hydrateConversations: active id "${activeId}" is not in the provided set`);
  useAISidebarStore.setState({ conversations: map, activeConversationId: activeId });
}
