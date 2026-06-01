/**
 * Conversation Model v2
 *
 * Unified types and pure migration helpers for mixed-runtime conversations.
 * No side effects, no localStorage access, no Zustand imports.
 */

import type {
  AgentId,
  AgentConversationTurn,
  CodexConversationTurn,
  ChatMessage,
  ConversationEntry,
} from './types';

// ── Runtime types ─────────────────────────────────────────────────────

export type RuntimeId = 'claude-code' | 'codex' | 'legacy-ritemark';

export type ConversationRunMode = 'plan' | 'edit';

export type ConversationRunStatus =
  | 'running'
  | 'waiting-for-user'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface RuntimeSelection {
  runtimeId: RuntimeId;
  modelId?: string;
  mode?: ConversationRunMode;
  thinkingEffort?: 'low' | 'medium' | 'high';
}

// ── Run types ─────────────────────────────────────────────────────────

interface ConversationRunBase {
  id: string;
  runtimeId: RuntimeId;
  userPrompt: string;
  activeFilePath?: string;
  status: ConversationRunStatus;
  timestamp: number;
  completedAt?: number;
}

export interface ClaudeConversationRun extends ConversationRunBase {
  runtimeId: 'claude-code';
  providerTurn: AgentConversationTurn;
}

export interface CodexConversationRun extends ConversationRunBase {
  runtimeId: 'codex';
  providerTurn: CodexConversationTurn;
}

export interface LegacyRitemarkConversationRun extends ConversationRunBase {
  runtimeId: 'legacy-ritemark';
  providerTurn: {
    messages: ChatMessage[];
    conversationHistory: ConversationEntry[];
  };
}

export type ConversationRun =
  | ClaudeConversationRun
  | CodexConversationRun
  | LegacyRitemarkConversationRun;

// ── Document type ─────────────────────────────────────────────────────

export interface ConversationDocument {
  schemaVersion: 2;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  runs: ConversationRun[];
}

// ── Input type for normalization (mirrors SavedConversationData) ───────

export interface SavedConversationRaw {
  id: string;
  title: string;
  /** May contain 'ritemark-agent' for backward-compat with old saved conversations */
  agentId: AgentId | 'ritemark-agent';
  createdAt: number;
  updatedAt: number;
  agentConversation: AgentConversationTurn[];
  codexConversation?: CodexConversationTurn[];
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
}

// ── Status helpers ─────────────────────────────────────────────────────

function claudeTurnStatus(turn: AgentConversationTurn): ConversationRunStatus {
  if (turn.isRunning) {
    if (turn.pendingQuestion !== undefined || turn.pendingPlanApproval !== undefined) {
      return 'waiting-for-user';
    }
    return 'running';
  }
  if (turn.result?.error) return 'error';
  if (turn.isPlan && !turn.planHandled) return 'waiting-for-user';
  return 'complete';
}

function codexTurnStatus(turn: CodexConversationTurn): ConversationRunStatus {
  if (turn.isRunning) {
    if (
      turn.approval !== undefined ||
      turn.pendingQuestion !== undefined ||
      turn.requiresPlanReview
    ) {
      return 'waiting-for-user';
    }
    return 'running';
  }
  if (turn.result?.error) return 'error';
  return 'complete';
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Convert a v1 saved conversation into the unified v2 in-memory model.
 * Handles legacy Codex-in-agentConversation saves and mixed-runtime edge cases.
 */
export function normalizeSavedConversation(data: SavedConversationRaw): ConversationDocument {
  const runs: ConversationRun[] = [];

  let agentConv = data.agentConversation || [];
  let codexConv = data.codexConversation || [];

  // Handle legacy saves where Codex turns were stored in agentConversation
  // (before the codexConversation field was added)
  if (data.agentId === 'codex' && codexConv.length === 0 && agentConv.length > 0) {
    codexConv = agentConv as unknown as CodexConversationTurn[];
    agentConv = [];
  }

  for (const turn of agentConv) {
    const run: ClaudeConversationRun = {
      id: turn.id,
      runtimeId: 'claude-code',
      userPrompt: turn.userPrompt,
      activeFilePath: turn.activeFilePath,
      status: claudeTurnStatus(turn),
      timestamp: turn.timestamp,
      completedAt: turn.isRunning ? undefined : turn.timestamp,
      providerTurn: turn,
    };
    runs.push(run);
  }

  for (const turn of codexConv) {
    const run: CodexConversationRun = {
      id: turn.id,
      runtimeId: 'codex',
      userPrompt: turn.userPrompt,
      activeFilePath: turn.activeFilePath,
      status: codexTurnStatus(turn),
      timestamp: turn.timestamp,
      completedAt: turn.isRunning ? undefined : turn.timestamp,
      providerTurn: turn,
    };
    runs.push(run);
  }

  // Sort mixed-runtime turns by timestamp; preserve insertion order when equal
  runs.sort((a, b) => a.timestamp - b.timestamp);

  // Legacy Ritemark Agent: wrap all messages in a single run
  const chatMessages = data.chatMessages || [];
  const conversationHistory = data.conversationHistory || [];
  const isLegacyAgent = data.agentId === 'ritemark-agent';
  const hasOnlyLegacy =
    chatMessages.length > 0 && agentConv.length === 0 && codexConv.length === 0;

  if (isLegacyAgent || hasOnlyLegacy) {
    const firstUserMsg = chatMessages.find((m) => m.role === 'user');
    const run: LegacyRitemarkConversationRun = {
      id: `${data.id}-legacy`,
      runtimeId: 'legacy-ritemark',
      userPrompt: firstUserMsg?.content ?? '',
      status: 'complete',
      timestamp: chatMessages[0]?.timestamp ?? data.createdAt,
      completedAt: data.updatedAt,
      providerTurn: { messages: chatMessages, conversationHistory },
    };
    runs.push(run);
  }

  return {
    schemaVersion: 2,
    id: data.id,
    title: data.title,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    runs,
  };
}

/**
 * Returns the deduplicated list of runtimes present in the conversation,
 * in order of first appearance.
 */
export function getRuntimeSummary(conversation: ConversationDocument): RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const run of conversation.runs) {
    seen.add(run.runtimeId);
  }
  return Array.from(seen);
}

/**
 * Returns the first run that is currently active (running or waiting for user input).
 */
export function getActiveRunningRun(conversation: ConversationDocument): ConversationRun | undefined {
  return conversation.runs.find(
    (r) => r.status === 'running' || r.status === 'waiting-for-user'
  );
}

/**
 * Serialize a ConversationDocument for future v2 localStorage persistence.
 * Defined here for the write path; not called in Phase 2 (gated by enableV2Storage).
 */
export function serializeConversationDocument(conversation: ConversationDocument): object {
  return { ...conversation };
}
