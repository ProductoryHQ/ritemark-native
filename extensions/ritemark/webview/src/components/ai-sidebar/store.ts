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
  generateId,
  generateTitle,
  setWorkspaceContext,
  setLegacyStorageReadOnly,
  discoverLegacyConversationCandidates,
  type SavedConversationV2,
} from './chatHistoryStorage';
import type {
  ConversationInitializeResult,
  ConversationProjectionV1,
  ConversationRequest,
} from '../../../../src/conversations/protocol';
import { sendConversationRequest } from '../../bridge';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import type { LegacyRitemarkConversationRun } from './conversationModel';
import { applyCodexPlanApproval, applyCodexPlanUpdate, finalizeCodexTurnResult } from './lifecycle';
import {
  createConversationState,
  isConversationEmpty,
  policyOf,
  type ConversationState,
  type PendingRuntimeSelection,
} from './conversationState';
import { runtimeOfConversation } from './threadStatus';
import { clearSlot, setSlot, type ComposerSlots } from './composerQueue';
import {
  enqueueItem,
  removeItem as removeQueueItem,
  updateItemPrompt,
  moveItem as moveQueueItem,
  markStatus as markQueueStatus,
  requeueFailed,
  nextDispatchable,
  isReadyToDrain,
  type PromptQueues,
  type QueueItem,
} from './promptQueue';
import { deriveActivityState } from './activityState';
import { resolveInboundConversationId } from './conversationRouting';
import { projectionToConversation } from './conversationProjection';
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

function focusComposerSoon(): void {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => {
    // Wait through the panel-unmount frame. Otherwise the browser may move
    // focus back to <body> when the selected row disappears after we focus.
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')?.focus();
    });
  });
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

interface AISidebarState {
  // ── Connection state (APP-GLOBAL) ──
  hasApiKey: boolean;
  isOnline: boolean;
  isCheckingConnectivity: boolean;
  ready: boolean;

  // ── Agent config: catalogs + availability (APP-GLOBAL) ──
  agenticEnabled: boolean;
  /**
   * Sprint 99 kill-switch (R15). When false the sidebar behaves as it did before
   * parallel chats: no rail, one conversation at a time, and "new chat" replaces
   * rather than adds. Defaults to TRUE so a config message that never arrives
   * cannot silently disable a shipped feature — the host turns it off explicitly.
   */
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

  // ── Sprint 103 R6: per-runtime capability map (APP-GLOBAL, host-provided) ──
  runtimeCapabilities: Record<string, { planFirst: boolean; liveModeSwitch: boolean; structuredPlanSteps: boolean }>;

  // ── Chat history (APP-GLOBAL) ──
  savedConversations: SavedConversationV2[];
  showHistoryPanel: boolean;
  conversationRolloutMode: 'unknown' | 'legacy' | 'host-canonical' | 'host-compat';
  hostConversations: ConversationSummaryV1[];
  earlierConversations: ConversationSummaryV1[];
  pinnedConversationIds: string[];
  conversationStoreNotice: string | null;
  pendingUndo: { undoToken: string; title: string; recovery: boolean } | null;

  // ── Composer state, keyed per thread (Sprint 99 R14 / E5) ──
  /**
   * Queued follow-up prompt per conversation. Lives in the store rather than in
   * `ChatInput` state because the rail needs it too: a thread with a queued
   * prompt is NOT idle and must not offer a close × (Resolved Gap 4).
   */
  promptQueues: PromptQueues;
  /** Unsent draft text per conversation, so switching threads loses nothing. */
  composerDrafts: ComposerSlots;
  /**
   * Sprint 104 (#162): enqueue a captured prompt for its target conversation.
   * Returns 'full' (cap 10) without mutating anything, else 'queued'.
   */
  enqueuePrompt: (item: Omit<QueueItem, 'id' | 'status' | 'createdAt'>) => 'queued' | 'full';
  /**
   * Sprint 105 (#165): comment-task status registry keyed by queue item id.
   * Statuses reflect queue/turn FACTS only; every transition is pushed back to
   * the editor webviews via comment:task-status.
   */
  commentTasks: Record<string, { commentIds: string[]; documentPath: string; conversationId: string; status: 'queued' | 'running' | 'done' | 'failed' }>;
  removeQueued: (conversationId: string, itemId: string) => void;
  editQueued: (conversationId: string, itemId: string, displayText: string, prompt: string) => void;
  moveQueued: (conversationId: string, itemId: string, direction: -1 | 1) => void;
  retryQueued: (conversationId: string, itemId: string) => void;
  /** Explicit user resume after a failed/cancelled turn paused the queue. */
  resumeQueue: (conversationId: string) => void;
  /** Dispatch the head item when the target conversation is truly ready. */
  maybeDrainQueue: (conversationId: string) => void;
  setComposerDraft: (conversationId: string, text: string) => void;

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
  /** User pressed "+". Refocus an existing blank or create a conversation. */
  requestNewThread: () => void;
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
  sendCodexMessage: (prompt: string, attachments?: FileAttachment[], requestedMode?: 'auto' | 'ask' | 'plan', skipBrowserContext?: boolean, skipActiveFile?: boolean) => void;
  selectCodexModel: (modelId: string) => void;
  /** Select an OpenCode model. compositeValue is the full "opencode:<provider>/<model>" string. */
  selectOpenCodeModel: (compositeValue: string) => void;
  /** Send a message to the OpenCode (ACP) runtime. */
  sendOpenCodeMessage: (prompt: string, attachments?: FileAttachment[], options?: { skipActiveFile?: boolean }) => void;
  handleCodexApproval: (requestId: string | number, approved: boolean, alwaysAllow?: boolean) => void;
  /** Respond to a Claude Ask-mode file-write/shell-command approval card. */
  handleAgentToolApproval: (requestId: string, approved: boolean) => void;
  answerCodexQuestion: (turnId: string, question: CodexQuestion, answers: Record<string, string>) => void;
  approveCodexPlan: (turnId: string) => void;
  /** Sprint 103 R5: with feedback → "Keep planning" (new plan-mode turn); without → discard. */
  discardCodexPlan: (turnId: string, feedback?: string) => void;
  startCodexLogin: () => void;
  logoutCodex: () => void;
  refreshCodexStatus: () => void;
  repairCodex: () => void;
  dismissCodexNotice: (key: string) => void;
  dismissCurrentPlan: (key: string) => void;
  reloadWindow: () => void;
  openAgentSettings: () => void;
  recheckConnectivity: () => void;

  // ── Onboarding actions ──
  installDependency: (dep: OnboardingDependency) => void;
  recheckDependencies: () => void;
  dismissOnboarding: () => void;

  // ── Chat history actions ──
  loadConversationList: () => void;
  saveCurrentConversation: () => void;
  loadSavedConversation: (id: string) => void;
  startNewConversation: () => void;
  toggleHistoryPanel: () => void;
  setPinnedConversationIds: (ids: string[]) => void;
  pinConversation: (id: string) => void;
  unpinConversation: (id: string) => void;
  renameHostConversation: (id: string, title: string) => void;
  moveEarlierConversation: (id: string) => void;
  deleteHostConversation: (id: string, stopRunning?: boolean, recovery?: boolean) => void;
  undoDeleteConversation: () => void;

  // ── Internal: message handler ──
  handleExtensionMessage: (message: ExtensionMessage) => void;
}

type ConversationRequestWithoutId = ConversationRequest extends infer Request
  ? Request extends { requestId: string }
    ? Omit<Request, 'requestId'>
    : never
  : never;

function postConversationRequest(message: ConversationRequestWithoutId): void {
  sendConversationRequest({ ...message, requestId: nextId() } as ConversationRequest);
}

const initialConversation = createConversationState(generateId());

let legacyInventorySent = false;

/** Test-only: allow a fresh migration handshake in the same process. */
export function resetConversationMigrationGuardForTest(): void {
  legacyInventorySent = false;
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
    if (state.conversationRolloutMode !== 'legacy') return;
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
      // Sprint 103 R8: persist the thread's policy — a reload must never
      // silently widen Manual back to Auto.
      turnPolicy: {
        mode: conversation.pendingRuntime.mode,
        planFirst: conversation.pendingRuntime.planFirst === true,
      },
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
   * Repopulate the rail from the persisted open-thread set (R13).
   *
   * Threads whose stored record has gone (pruned by the 50-conversation cap, or
   * deleted) are simply skipped. The thread the user is already looking at is
   * kept active; it is only replaced when it is an untouched blank and there is
   * real restored work to show instead.
   */
  // ── Sprint 104 (#162): queue dispatch + comment target resolution ──────

  /** Sprint 105 (#165): update the registry + push the fact editor-ward. */
  function setCommentTaskStatus(
    itemId: string,
    task: { commentIds: string[]; documentPath: string; conversationId: string; status: 'queued' | 'running' | 'done' | 'failed' },
  ): void {
    set({ commentTasks: { ...get().commentTasks, [itemId]: task } });
    vscode.postMessage({
      type: 'comment:task-status',
      documentPath: task.documentPath,
      commentIds: task.commentIds,
      status: task.status,
    });
  }

  /** A user-removed queued comment task returns its markers to neutral. */
  function clearCommentTask(itemId: string): void {
    const task = get().commentTasks[itemId];
    if (!task || task.status !== 'queued') return;
    const next = { ...get().commentTasks };
    delete next[itemId];
    set({ commentTasks: next });
    vscode.postMessage({
      type: 'comment:task-status',
      documentPath: task.documentPath,
      commentIds: task.commentIds,
      status: 'cleared',
    });
  }

  /** Terminal transition for every RUNNING comment task of a conversation. */
  function finalizeCommentTasks(conversationId: string, status: 'done' | 'failed'): void {
    for (const [itemId, task] of Object.entries(get().commentTasks)) {
      if (task.conversationId === conversationId && task.status === 'running') {
        setCommentTaskStatus(itemId, { ...task, status });
      }
    }
  }

  /**
   * Dispatch one captured queue item to ITS OWN conversation — which may be a
   * background thread. Mirrors the send functions' turn shapes but reads
   * nothing from the active conversation: everything was frozen at enqueue.
   */
  function dispatchQueueItem(item: QueueItem): void {
    const state = get();
    const conversation = state.conversations[item.conversationId];
    if (!conversation) {
      // Target thread is gone — drop the item rather than misroute it.
      set({ promptQueues: removeQueueItem(state.promptQueues, item.conversationId, item.id) });
      return;
    }
    try {
      set({ promptQueues: markQueueStatus(get().promptQueues, item.conversationId, item.id, 'sending') });
      if (item.runtimeId === 'claude-code') {
        const turn: AgentConversationTurn = {
          id: nextId(),
          conversationId: item.conversationId,
          userPrompt: item.displayText,
          activeFilePath: item.documentPath,
          attachments: item.attachments,
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
        patchConversation(item.conversationId, (c) => ({
          agentConversation: [...c.agentConversation, turn],
          restoredTranscript: false,
        }));
        vscode.postMessage({
          type: 'agent-execute',
          conversationId: item.conversationId,
          conversationTurnId: turn.id,
          agentId: 'claude-code',
          prompt: item.prompt,
          displayPrompt: item.displayText,
          // Model drift fix: pin the frozen model — never let the CLI's own
          // user config decide (falls back to the conversation selection).
          model: item.modelId || get().conversations[item.conversationId]?.selectedModel || undefined,
          attachments: item.attachments?.map((att) => ({ id: att.id, kind: att.kind, name: att.name, data: att.data, mediaType: att.mediaType })),
          approvalMode: item.autonomy,
          planFirst: item.planFirst,
          skipActiveFile: item.skipActiveFile,
          skipBrowserContext: item.skipBrowserContext,
          mentionedAgentPaths: item.mentionedAgentPaths,
        });
      } else {
        const turn: CodexConversationTurn = {
          id: nextId(),
          conversationId: item.conversationId,
          userPrompt: item.displayText,
          runtime: item.runtimeId === 'opencode' ? 'opencode' : 'codex',
          requestedPlanMode: item.planFirst,
          activeFilePath: item.documentPath,
          attachments: item.attachments,
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
        patchConversation(item.conversationId, (c) => ({
          codexConversation: [...c.codexConversation, turn],
          restoredTranscript: false,
        }));
        vscode.postMessage({
          type: 'agent-execute',
          conversationId: item.conversationId,
          conversationTurnId: turn.id,
          agentId: item.runtimeId,
          prompt: item.prompt,
          displayPrompt: item.displayText,
          model: item.modelId,
          approvalMode: item.autonomy,
          planFirst: item.planFirst,
          skipActiveFile: item.skipActiveFile,
          skipBrowserContext: item.skipBrowserContext,
          attachments: item.attachments?.map((att) => ({ id: att.id, kind: att.kind, name: att.name, data: att.data, mediaType: att.mediaType })),
        });
      }
      set({ promptQueues: removeQueueItem(get().promptQueues, item.conversationId, item.id) });
      const task = get().commentTasks[item.id];
      if (task) setCommentTaskStatus(item.id, { ...task, status: 'running' });
    } catch (err) {
      // Keep the item visible with its error — never silently discard (R3).
      set({
        promptQueues: markQueueStatus(
          get().promptQueues, item.conversationId, item.id, 'failed',
          err instanceof Error ? err.message : String(err),
        ),
      });
      const task = get().commentTasks[item.id];
      if (task) setCommentTaskStatus(item.id, { ...task, status: 'failed' });
    }
  }

  /**
   * Sprint 104 R2: a comment task targets a STABLE conversation for its
   * assigned agent — an open thread already bound to that runtime (prefer one
   * that is ready), else a new background thread. The visible thread is never
   * retargeted.
   */
  function resolveCommentTargetConversation(runtimeId: 'claude-code' | 'codex' | 'opencode'): string {
    const state = get();
    const threadRt = runtimeId === 'claude-code' ? 'claude' : runtimeId;
    const candidates = Object.values(state.conversations)
      .filter((c) => runtimeOfConversation(c) === threadRt);
    const ready = candidates.find((c) => isReadyToDrain(deriveActivityState(c)));
    if (ready) return ready.id;
    if (candidates.length > 0) {
      return [...candidates].sort((a, b) => b.createdAt - a.createdAt)[0].id;
    }
    const conversation = createConversationState(nextId(), {
      selectedAgent: runtimeId,
      pendingRuntime: { runtimeId, modelId: '', mode: 'auto', planFirst: false },
    });
    set({ conversations: { ...state.conversations, [conversation.id]: conversation } });
    return conversation.id;
  }

  return {
    // ── Initial state ──
    hasApiKey: false,
    isOnline: true,
    isCheckingConnectivity: false,
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

    // Mirrors src/runtime/capabilities.ts until the first agent:config arrives.
    runtimeCapabilities: {
      'claude-code': { planFirst: true, liveModeSwitch: true, structuredPlanSteps: false },
      'codex': { planFirst: true, liveModeSwitch: false, structuredPlanSteps: true },
      'opencode': { planFirst: false, liveModeSwitch: false, structuredPlanSteps: false },
    },

    savedConversations: [],
    showHistoryPanel: false,
    conversationRolloutMode: 'unknown',
    hostConversations: [],
    earlierConversations: [],
    pinnedConversationIds: [],
    conversationStoreNotice: null,
    pendingUndo: null,

    promptQueues: {},
    commentTasks: {},
    composerDrafts: {},
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
      return conversation.id;
    },

    switchConversation: (id) => {
      const state = get();
      const target = state.conversations[id];
      if (!target) return;
      if (id === state.activeConversationId) {
        set({ showHistoryPanel: false });
        focusComposerSoon();
        return;
      }

      // Sprint 99 (E4): NO resetProviderSessions() here. Switching is a view
      // change — every other thread keeps streaming.
      const pruned = discardIfEmptyOnSwitchAway(state.activeConversationId, id);
      set({
        ...(pruned ? { conversations: pruned } : {}),
        activeConversationId: id,
        showHistoryPanel: false,
      });
      focusComposerSoon();
    },

    listOpenConversations: () => {
      const conversations = get().conversations;
      return Object.values(conversations)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((c) => c.id);
    },

    requestNewThread: () => {
      const state = get();
      const existingEmpty = Object.values(state.conversations)
        .sort((a, b) => a.createdAt - b.createdAt)
        .find(isConversationEmpty);
      if (existingEmpty) {
        if (existingEmpty.id !== state.activeConversationId) get().switchConversation(existingEmpty.id);
        set({ showHistoryPanel: false });
        return;
      }
      get().startNewConversation();
    },

    // ── Sprint 104 (#162): bounded per-conversation prompt queue ──────────

    enqueuePrompt: (input) => {
      const item: QueueItem = {
        ...input,
        id: nextId(),
        status: 'queued',
        createdAt: Date.now(),
      };
      const result = enqueueItem(get().promptQueues, item);
      if (result.outcome === 'full') return 'full';
      set({ promptQueues: result.queues });
      // Sprint 105 (#165): a comment-originated item enters the status registry
      // as 'queued' and the editor's margin marker learns about it immediately.
      if (item.source === 'comment' && item.commentIds?.length && item.documentPath) {
        setCommentTaskStatus(item.id, {
          commentIds: item.commentIds,
          documentPath: item.documentPath,
          conversationId: item.conversationId,
          status: 'queued',
        });
      }
      // Idle target → the item should not sit in the queue a moment longer.
      get().maybeDrainQueue(item.conversationId);
      return 'queued';
    },

    removeQueued: (conversationId, itemId) => {
      set({ promptQueues: removeQueueItem(get().promptQueues, conversationId, itemId) });
      clearCommentTask(itemId);
    },

    editQueued: (conversationId, itemId, displayText, prompt) => {
      set({ promptQueues: updateItemPrompt(get().promptQueues, conversationId, itemId, displayText, prompt) });
    },

    moveQueued: (conversationId, itemId, direction) => {
      set({ promptQueues: moveQueueItem(get().promptQueues, conversationId, itemId, direction) });
    },

    retryQueued: (conversationId, itemId) => {
      set({ promptQueues: requeueFailed(get().promptQueues, conversationId, itemId) });
      get().maybeDrainQueue(conversationId);
    },

    resumeQueue: (conversationId) => {
      // Explicit user action after a failed/cancelled turn paused the queue:
      // force-dispatch the head item (readiness gate deliberately bypassed for
      // the paused states only — running/waiting states still block).
      const conversation = get().conversations[conversationId];
      if (!conversation) return;
      const state = deriveActivityState(conversation);
      if (state === 'running' || state === 'plan-review' || state === 'waiting-input' || state === 'waiting-approval') return;
      const item = nextDispatchable(get().promptQueues, conversationId);
      if (item) dispatchQueueItem(item);
    },

    maybeDrainQueue: (conversationId) => {
      const conversation = get().conversations[conversationId];
      if (!conversation) return;
      if (!isReadyToDrain(deriveActivityState(conversation))) return;
      const item = nextDispatchable(get().promptQueues, conversationId);
      if (item) dispatchQueueItem(item);
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

      patchConversation(conversation.id, (c) => ({
        agentConversation: [...c.agentConversation, turn],
        restoredTranscript: false,
      }));

      // Send attachments as serializable payload (strip thumbnails for extension)
      const attachmentPayload = attachments?.map((att) => ({
        id: att.id,
        kind: att.kind,
        name: att.name,
        data: att.data,
        mediaType: att.mediaType,
      }));
      // Sprint 103 R1: two-axis policy on the wire (legacy 'plan' normalized).
      const claudePolicy = policyOf(conversation.pendingRuntime);
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        conversationTurnId: turn.id,
        agentId: 'claude-code',
        prompt: fullPrompt,
        displayPrompt: prompt,
        // Model drift fix: always pin the UI-selected model.
        model: conversation.selectedModel || undefined,
        attachments: attachmentPayload,
        approvalMode: claudePolicy.autonomy,
        planFirst: claudePolicy.planFirst,
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
      // The policy is per-thread: frame the block for the thread the
      // composer is bound to (the active one). Sprint 103 R1: plan framing
      // comes from the Plan chip, not a third mode value.
      const pending = activeConversation()?.pendingRuntime;
      const planFraming = pending ? policyOf(pending).planFirst : false;

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
      const isEditMode = !planFraming;
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
        // Sprint 103 D2: plan approval auto-resets the Plan chip (rejection
        // and cancel deliberately leave it on).
        pendingRuntime: {
          ...c.pendingRuntime,
          mode: c.pendingRuntime.mode === 'plan' ? 'auto' : c.pendingRuntime.mode,
          planFirst: false,
        },
      }));
      vscode.postMessage({
        type: 'agent-approve',
        conversationId: conversation.id,
        agentId: 'claude-code',
        requestId: targetTurn.pendingPlanApproval.toolUseId,
        approved: true,
        alwaysAllow: false,
      });
      // Sprint 104 R3: a resolved checkpoint may unblock the queue (no-op
      // while the turn keeps running — the readiness gate decides).
      get().maybeDrainQueue(conversation.id);
    },

    rejectPlan: (turnId, feedback?) => {
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
      // Sprint 103 R2 "Keep planning": the feedback rides the deny message and
      // the session stays in plan mode — a revised plan card follows.
      vscode.postMessage({
        type: 'agent-approve',
        conversationId: conversation.id,
        agentId: 'claude-code',
        requestId: targetTurn.pendingPlanApproval.toolUseId,
        approved: false,
        alwaysAllow: false,
        feedback: feedback?.trim() || undefined,
      });
      get().maybeDrainQueue(conversation.id);
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

    sendCodexMessage: (prompt, attachments?, requestedMode?, skipBrowserContext?, skipActiveFile?) => {
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

      // Sprint 103 R1 (D4): plan-first comes ONLY from explicit UI state —
      // prompt-text sniffing removed.
      const codexPolicy = policyOf(conversation.pendingRuntime);
      const codexPlanFirst = requestedMode === 'plan' || codexPolicy.planFirst;
      const codexAutonomy: 'auto' | 'ask' = requestedMode === 'ask' ? 'ask' : codexPolicy.autonomy;

      const turn: CodexConversationTurn = {
        id: nextId(),
        conversationId: conversation.id,
        userPrompt: prompt,
        requestedPlanMode: codexPlanFirst,
        activeFilePath: skipActiveFile ? undefined : get().activeFilePath || undefined,
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

      patchConversation(conversation.id, (c) => ({
        codexConversation: [...c.codexConversation, turn],
        restoredTranscript: false,
      }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        conversationTurnId: turn.id,
        agentId: 'codex',
        prompt: fullPrompt,
        displayPrompt: prompt,
        model: conversation.codexSelectedModel,
        // Sprint 103 R1: autonomy + planFirst on the wire — the host maps them
        // to the Codex approval policy, sandbox, and plan collaboration mode.
        approvalMode: codexAutonomy,
        planFirst: codexPlanFirst,
        skipBrowserContext,
        skipActiveFile,
        attachments: attachments?.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          name: attachment.name,
          data: attachment.data,
          mediaType: attachment.mediaType,
        })),
      });
    },

    selectCodexModel: (modelId) => {
      patchConversation(get().activeConversationId, () => ({ codexSelectedModel: modelId }));
    },

    selectOpenCodeModel: (compositeValue) => {
      patchConversation(get().activeConversationId, () => ({ opencodeSelectedModel: compositeValue }));
    },

    sendOpenCodeMessage: (prompt, attachments?, options?) => {
      const conversation = activeConversation();
      if (!conversation) return;

      // Sprint 99 (E3): per-conversation guard.
      const lastTurn = conversation.codexConversation[conversation.codexConversation.length - 1];
      if (lastTurn?.isRunning) return;

      // Cross-runtime handoff. OpenCode's send path was the only one of the three
      // that never built this, so switching to OpenCode mid-conversation dropped
      // everything Claude had said — it would answer "I have no prior context"
      // with that context sitting one bubble above. Mirror sendCodexMessage:
      // prepend Claude turns since OpenCode's last turn, plus the selection block.
      const lastOpenCodeTimestamp = lastTurn?.timestamp ?? 0;
      const handoff = buildHandoffContext(
        conversation.agentConversation.map((t) => ({
          userPrompt: t.userPrompt,
          responseText: t.result?.text || undefined,
          timestamp: t.timestamp,
        })),
        'Claude',
        lastOpenCodeTimestamp,
      );
      const selectionBlock = get().buildSelectionContextBlock();
      const handoffPrompt = handoff ? `${handoff}\n\nUser request:\n${prompt}` : prompt;
      const fullPrompt = selectionBlock
        ? `${selectionBlock}\n\n---\n\n${handoffPrompt}`
        : handoffPrompt;

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
        activeFilePath: options?.skipActiveFile ? undefined : get().activeFilePath || undefined,
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

      patchConversation(conversation.id, (c) => ({
        codexConversation: [...c.codexConversation, turn],
        restoredTranscript: false,
      }));
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        conversationTurnId: turn.id,
        agentId: 'opencode',
        // The chat bubble shows the raw `prompt` (turn.userPrompt); the model
        // receives the handoff/selection-wrapped `fullPrompt`, same as Codex.
        prompt: fullPrompt,
        displayPrompt: prompt,
        model,
        approvalMode: conversation.pendingRuntime.mode,
        skipActiveFile: options?.skipActiveFile,
        attachments: attachments?.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          name: attachment.name,
          data: attachment.data,
          mediaType: attachment.mediaType,
        })),
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
      patchConversation(conversation.id, (c) => ({
        codexConversation: nextTurns,
        // Sprint 103 D2: plan approval auto-resets the Plan chip.
        pendingRuntime: {
          ...c.pendingRuntime,
          mode: c.pendingRuntime.mode === 'plan' ? 'auto' : c.pendingRuntime.mode,
          planFirst: false,
        },
      }));
      // The continuation turn executes (planFirst off) under the thread's
      // autonomy policy — this also flips the Codex sandbox back to writable.
      vscode.postMessage({
        type: 'agent-execute',
        conversationId: conversation.id,
        conversationTurnId: turnId,
        agentId: 'codex',
        prompt,
        conversationContinuation: true,
        model: conversation.codexSelectedModel,
        approvalMode: policyOf(conversation.pendingRuntime).autonomy,
        planFirst: false,
      });
      get().maybeDrainQueue(conversation.id);
    },

    discardCodexPlan: (turnId, feedback?) => {
      patchConversation(get().activeConversationId, (c) => ({
        codexConversation: c.codexConversation.map((turn) =>
          turn.id === turnId
            ? { ...turn, planHandled: true, planDecision: 'rejected' as const }
            : turn
        ),
      }));
      // Sprint 103 R5 "Keep planning": feedback becomes a new plan-mode turn so
      // Codex revises the plan instead of the review dead-ending in a discard.
      const trimmed = feedback?.trim();
      if (trimmed) {
        get().sendCodexMessage(
          `The user reviewed your plan and wants it revised before anything runs:\n${trimmed}\n\nPresent an updated plan for review.`,
          undefined,
          'plan',
        );
      }
      get().maybeDrainQueue(get().activeConversationId ?? '');
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

    recheckConnectivity: () => {
      set({ isCheckingConnectivity: true });
      vscode.postMessage({ type: 'connectivity:recheck' });
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
      if (get().conversationRolloutMode === 'legacy') {
        set({ savedConversations: listConversations() });
      } else {
        postConversationRequest({ type: 'conversation/list' });
      }
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

      if (state.conversationRolloutMode !== 'legacy' && state.hostConversations.some((item) => item.conversationId === id)) {
        postConversationRequest({ type: 'conversation/get', conversationId: id });
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
      focusComposerSoon();

      // Update agent selection in extension
      vscode.postMessage({ type: 'ai-select-agent', agentId: loadedAgentId, conversationId: id });
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
      focusComposerSoon();
    },

    toggleHistoryPanel: () => {
      const state = get();
      if (!state.showHistoryPanel) {
        // Load list when opening
        get().loadConversationList();
      }
      set({ showHistoryPanel: !state.showHistoryPanel });
    },

    setPinnedConversationIds: (ids) => {
      const unique = [...new Set(ids)].slice(0, 5);
      set({ pinnedConversationIds: unique });
    },

    pinConversation: (id) => {
      const state = get();
      if (state.pinnedConversationIds.includes(id) || state.pinnedConversationIds.length >= 5) return;
      set({ pinnedConversationIds: [...state.pinnedConversationIds, id] });
    },

    unpinConversation: (id) => {
      set({ pinnedConversationIds: get().pinnedConversationIds.filter((item) => item !== id) });
    },

    renameHostConversation: (id, title) => {
      const summary = get().hostConversations.find((item) => item.conversationId === id);
      const normalized = title.replace(/\s+/g, ' ').trim();
      if (!summary || !normalized || normalized === summary.title) return;
      postConversationRequest({
        type: 'conversation/rename',
        conversationId: id,
        bindingGeneration: summary.bindingGeneration,
        title: normalized,
      });
    },

    moveEarlierConversation: (id) => {
      const summary = get().earlierConversations.find((item) => item.conversationId === id);
      if (!summary) return;
      postConversationRequest({
        type: 'conversation/move-unassigned',
        conversationId: id,
        bindingGeneration: summary.bindingGeneration,
      });
    },

    deleteHostConversation: (id, stopRunning = false, recovery = false) => {
      const summaries = recovery ? get().earlierConversations : get().hostConversations;
      const summary = summaries.find((item) => item.conversationId === id);
      if (!summary) return;
      postConversationRequest({
        type: 'conversation/delete',
        conversationId: id,
        bindingGeneration: summary.bindingGeneration,
        stopRunning,
        ...(recovery ? { recovery: true } : {}),
      });
    },

    undoDeleteConversation: () => {
      const pending = get().pendingUndo;
      if (!pending) return;
      postConversationRequest({
        type: 'conversation/undo-delete',
        undoToken: pending.undoToken,
        ...(pending.recovery ? { recovery: true } : {}),
      });
    },

    /**
     * `/clear` — explicitly throw the current thread away.
     *
     * It resets exactly ONE conversation's runtime session, never "all
     * providers". The replacement gets a fresh id
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
    },

    // ── Message handler ──

    handleExtensionMessage: (message) => {
      const state = get();

      switch (message.type) {
        case 'conversation/canonical-id': {
          const current = get();
          const local = current.conversations[message.clientConversationId];
          if (!local) break;
          const conversations = { ...current.conversations };
          delete conversations[message.clientConversationId];
          conversations[message.conversationId] = {
            ...local,
            id: message.conversationId,
            restoredTranscript: false,
            agentConversation: stampConversationId(local.agentConversation, message.conversationId),
            codexConversation: stampConversationId(local.codexConversation, message.conversationId),
          };
          set({
            conversations,
            activeConversationId: current.activeConversationId === message.clientConversationId
              ? message.conversationId
              : current.activeConversationId,
            pinnedConversationIds: current.pinnedConversationIds.map((id) => id === message.clientConversationId ? message.conversationId : id),
          });
          break;
        }

        case 'conversation/runtime-released': {
          const current = get();
          const conversation = current.conversations[message.conversationId];
          if (!conversation) break;
          set({
            conversations: {
              ...current.conversations,
              [message.conversationId]: { ...conversation, restoredTranscript: true },
            },
          });
          break;
        }

        case 'conversation/result': {
          if (!message.ok) {
            set({ conversationStoreNotice: message.error.message });
            break;
          }
          const data = message.data as Record<string, unknown>;
          if (message.operation === 'conversation/initialize') {
            const initialized = message.data as ConversationInitializeResult;
            setLegacyStorageReadOnly(initialized.rolloutMode !== 'legacy');
            set({
              conversationRolloutMode: initialized.rolloutMode,
              hostConversations: initialized.conversations,
              earlierConversations: initialized.earlierConversations,
              savedConversations: initialized.rolloutMode === 'legacy' ? listConversations() : [],
              conversationStoreNotice: null,
            });
            if (initialized.rolloutMode !== 'legacy' && !legacyInventorySent) {
              legacyInventorySent = true;
              const records = discoverLegacyConversationCandidates();
              if (records.length > 0) postConversationRequest({ type: 'legacy/import-batch', records: records.slice(0, 100) });
            }
            if (initialized.selectedConversationId) {
              postConversationRequest({ type: 'conversation/get', conversationId: initialized.selectedConversationId });
            }
            break;
          }
          if (message.operation === 'conversation/list' && Array.isArray(data.conversations)) {
            set({
              hostConversations: data.conversations as ConversationSummaryV1[],
              earlierConversations: Array.isArray(data.earlierConversations) ? data.earlierConversations as ConversationSummaryV1[] : [],
              conversationStoreNotice: null,
            });
            break;
          }
          if (message.operation === 'legacy/import-batch') {
            postConversationRequest({ type: 'conversation/list' });
            break;
          }
          if ((message.operation === 'conversation/rename' || message.operation === 'conversation/move-unassigned') && data.conversation) {
            postConversationRequest({ type: 'conversation/list' });
            set({ conversationStoreNotice: null });
            break;
          }
          if ((message.operation === 'conversation/get' || message.operation === 'conversation/undo-delete') && data.conversation) {
            if (data.recovery === true) {
              postConversationRequest({ type: 'conversation/list' });
              set({ conversationStoreNotice: null, pendingUndo: null });
              break;
            }
            const projection = data.conversation as ConversationProjectionV1;
            const current = get();
            const restored = projectionToConversation(projection, current.activeConversationId ? current.conversations[current.activeConversationId] : undefined);
            const conversations = { ...current.conversations, [restored.id]: restored };
            const activeConversationId = restored.id;
            set({
              conversations,
              activeConversationId,
              showHistoryPanel: false,
              conversationStoreNotice: null,
              ...(message.operation === 'conversation/undo-delete' ? { pendingUndo: null } : {}),
            });
            focusComposerSoon();
            postConversationRequest({ type: 'conversation/list' });
            vscode.postMessage({ type: 'ai-select-agent', agentId: restored.selectedAgent, conversationId: restored.id });
            break;
          }
          if (message.operation === 'conversation/delete' && typeof data.conversationId === 'string' && typeof data.undoToken === 'string') {
            const current = get();
            const recovery = data.recovery === true;
            const source = recovery ? current.earlierConversations : current.hostConversations;
            const title = source.find((item) => item.conversationId === data.conversationId)?.title ?? 'Conversation';
            const conversations = { ...current.conversations };
            delete conversations[data.conversationId];
            const nextSummary = recovery ? undefined : current.hostConversations.find((item) => item.conversationId !== data.conversationId);
            const nextOpenId = Object.keys(conversations)[0] ?? null;
            set({
              conversations,
              activeConversationId: current.activeConversationId === data.conversationId ? nextOpenId : current.activeConversationId,
              pinnedConversationIds: current.pinnedConversationIds.filter((id) => id !== data.conversationId),
              pendingUndo: { undoToken: data.undoToken, title, recovery },
            });
            postConversationRequest({ type: 'conversation/list' });
            if (!nextOpenId && nextSummary) postConversationRequest({ type: 'conversation/get', conversationId: nextSummary.conversationId });
            break;
          }
          break;
        }

        case 'conversation/changed':
          postConversationRequest({ type: 'conversation/list' });
          break;

        case 'conversation/store-status':
          set({ conversationStoreNotice: message.state === 'degraded' ? (message.message ?? 'Conversation storage needs attention.') : null });
          break;

        case 'ai-key-status':
          set({ hasApiKey: message.hasKey, ready: true });
          break;

        case 'connectivity-status':
          set({ isOnline: message.isOnline, isCheckingConnectivity: false });
          break;

        case 'comment:submit': {
          // Sprint 104 (#162, supersedes the Sprint 94 direct-send): a comment
          // assigned to an agent routes through the SAME queue as composer
          // prompts, into a stable conversation for that agent. The old path
          // retargeted the visible thread's runtime and silently dropped the
          // prompt when the runtime was busy (audit F-class bug) — both gone.
          if (!message.prompt) break;
          const rt: 'claude-code' | 'codex' | 'opencode' =
            message.agentId === 'codex'
              ? 'codex'
              : message.agentId === 'opencode'
                ? 'opencode'
                : 'claude-code';
          const targetId = resolveCommentTargetConversation(rt);
          const target = get().conversations[targetId];
          const policy = target ? policyOf(target.pendingRuntime) : { autonomy: 'auto' as const, planFirst: false };
          get().enqueuePrompt({
            conversationId: targetId,
            runtimeId: rt,
            autonomy: policy.autonomy,
            planFirst: false,
            modelId: rt === 'codex' ? target?.codexSelectedModel : rt === 'opencode' ? target?.opencodeSelectedModel : undefined,
            prompt: message.prompt,
            displayText: message.prompt,
            source: 'comment',
            commentIds: Array.isArray(message.commentIds) ? message.commentIds : undefined,
            documentPath: typeof message.documentPath === 'string' ? message.documentPath : undefined,
          });
          break;
        }

        case 'agent:config': {
          // Set workspace context for per-project history scoping, then immediately
          // initialize the authoritative rollout mode before choosing legacy or
          // host storage. The host cutover state, not the flag alone, owns this.
          if (message.workspacePath) {
            setWorkspaceContext(message.workspacePath);
          }
          if (get().conversationRolloutMode === 'unknown') {
            postConversationRequest({ type: 'conversation/initialize' });
          } else {
            get().loadConversationList();
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
            // Sprint 103 R6: capability map from the host registry.
            runtimeCapabilities: message.runtimeCapabilities ?? get().runtimeCapabilities,
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
            // Sprint 105 (#165): the running comment task of THIS conversation
            // reaches its terminal state with the turn.
            finalizeCommentTasks(targetId, message.error ? 'failed' : 'done');
            // Sprint 104 R3: the turn ended — drain this conversation's queue
            // (readiness-gated: pending cards / failed turns block inside).
            get().maybeDrainQueue(targetId);
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
          if (landed) {
            setTimeout(() => persistConversation(targetId), 100);
            finalizeCommentTasks(targetId, message.error ? 'failed' : (message.status === 'interrupted' ? 'failed' : 'done'));
            // Sprint 104 R3: drain on turn completion (readiness-gated —
            // a requiresPlanReview turn keeps the queue waiting).
            get().maybeDrainQueue(targetId);
          }
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
 * In practice this is unreachable — New and `/clear` always leave an active
 * conversation —
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
