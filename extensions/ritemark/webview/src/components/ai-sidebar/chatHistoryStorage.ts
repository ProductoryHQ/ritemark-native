/**
 * Chat History Storage
 *
 * Persists conversation sessions to localStorage with automatic cleanup.
 * Stores metadata separately from full conversation data for efficient listing.
 */

import type { AgentId, AgentConversationTurn, CodexConversationTurn, ChatMessage, ConversationEntry } from './types';
import type { RuntimeId, ConversationRun } from './conversationModel';
import { truncateThreadTitle } from './threadStatus';

// ── Types ─────────────────────────────────────────────────────────────

export interface SavedConversation {
  id: string;
  title: string;
  /** May contain 'ritemark-agent' for backward-compat with old saved conversations */
  agentId: AgentId | 'ritemark-agent';
  createdAt: number;
  updatedAt: number;
}

/** v2 metadata shape — normalizes agentId to runtimeSummary on load */
export interface SavedConversationV2 {
  id: string;
  title: string;
  /** May contain 'ritemark-agent' for backward-compat with old saved conversations */
  agentId?: AgentId | 'ritemark-agent';
  primaryRuntimeId?: RuntimeId;
  runtimeSummary: RuntimeId[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedConversationData extends SavedConversation {
  agentConversation: AgentConversationTurn[];
  codexConversation?: CodexConversationTurn[];
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
  // agentId inherited from SavedConversation (may be 'ritemark-agent' for legacy compat)
}

/** v2 data record — preserves old fields for downgrade compatibility */
export interface SavedConversationDataV2 extends SavedConversationV2 {
  schemaVersion: 2;
  runs: ConversationRun[];
  agentConversation?: AgentConversationTurn[];
  codexConversation?: CodexConversationTurn[];
  chatMessages?: ChatMessage[];
  conversationHistory?: ConversationEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────

const GLOBAL_PREFIX = 'ritemark-chat-';
const MAX_CONVERSATIONS = 50;

// ── v2 rollout guard ──────────────────────────────────────────────────

let _v2StorageEnabled = false;

/** Enable v2 conversation record writes. Off by default — flip after testing. */
export function enableV2Storage(): void {
  _v2StorageEnabled = true;
}

// ── Metadata normalization ────────────────────────────────────────────

function agentIdToRuntimeId(agentId: AgentId | 'ritemark-agent'): RuntimeId {
  if (agentId === 'claude-code') return 'claude-code';
  if (agentId === 'codex') return 'codex';
  return 'legacy-ritemark';
}

/**
 * Coerce a legacy or v2 metadata record to the v2 shape.
 *
 * Compatibility: conversations with agentId 'ritemark-agent' are mapped to
 * runtimeId 'legacy-ritemark'. The ritemark-agent was deprecated in the primary
 * UX (Phase 3, Sprint 62) but its saved conversations remain fully readable.
 * Do not remove this mapping.
 */
export function normalizeMetadata(raw: SavedConversation | SavedConversationV2): SavedConversationV2 {
  if ('runtimeSummary' in raw) {
    return raw as SavedConversationV2;
  }
  const primaryRuntimeId = agentIdToRuntimeId(raw.agentId);
  return {
    id: raw.id,
    title: raw.title,
    agentId: raw.agentId,
    primaryRuntimeId,
    runtimeSummary: [primaryRuntimeId],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// ── Workspace scoping ────────────────────────────────────────────────

let _workspacePath: string | undefined;

/**
 * Simple hash of workspace path for localStorage key scoping.
 * Returns a short alphanumeric string.
 */
function hashWorkspacePath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

function getStoragePrefix(): string {
  if (_workspacePath) {
    return `${GLOBAL_PREFIX}${hashWorkspacePath(_workspacePath)}-`;
  }
  return GLOBAL_PREFIX;
}

function getMetadataKey(): string {
  return `${getStoragePrefix()}metadata`;
}

/**
 * Set the workspace path for per-project history scoping.
 * Called once when the webview receives workspace info from the extension.
 * Automatically migrates legacy global conversations on first use.
 */
export function setWorkspaceContext(workspacePath: string | undefined): void {
  _workspacePath = workspacePath;
  if (workspacePath) {
    migrateGlobalConversations();
  }
}

const MIGRATION_DONE_KEY = 'ritemark-chat-migrated';

/**
 * One-time migration: copy conversations from the old global prefix
 * into the current workspace-scoped prefix.
 */
function migrateGlobalConversations(): void {
  const scopedMetaKey = getMetadataKey();

  // Skip if this workspace already has data or was already migrated
  const alreadyMigrated = localStorage.getItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`) === '1';
  if (alreadyMigrated) return;

  const existingScoped = localStorage.getItem(scopedMetaKey);
  if (existingScoped) {
    // Already has workspace-scoped data — mark done and skip
    localStorage.setItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`, '1');
    return;
  }

  // Read old global metadata
  const globalMetaKey = `${GLOBAL_PREFIX}metadata`;
  const globalRaw = localStorage.getItem(globalMetaKey);
  if (!globalRaw) {
    localStorage.setItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`, '1');
    return;
  }

  try {
    const globalMeta = JSON.parse(globalRaw) as (SavedConversation | SavedConversationV2)[];
    if (globalMeta.length === 0) {
      localStorage.setItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`, '1');
      return;
    }

    // Copy each conversation to workspace-scoped keys
    const migratedMeta: SavedConversationV2[] = [];
    for (const meta of globalMeta) {
      const oldKey = `${GLOBAL_PREFIX}${meta.id}`;
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(getConversationKey(meta.id), data);
        migratedMeta.push(normalizeMetadata(meta));
      }
    }

    // Save workspace-scoped metadata
    if (migratedMeta.length > 0) {
      localStorage.setItem(scopedMetaKey, JSON.stringify(migratedMeta));
      console.log(`[chatHistoryStorage] Migrated ${migratedMeta.length} conversations to workspace scope`);
    }
  } catch (err) {
    console.warn('[chatHistoryStorage] Migration failed:', err);
  }

  localStorage.setItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`, '1');
}

// ── Storage Functions ─────────────────────────────────────────────────

/**
 * Generate a unique conversation ID
 */
export function generateId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the storage key for a conversation's data
 */
function getConversationKey(id: string): string {
  return `${getStoragePrefix()}${id}`;
}

/**
 * Load metadata list from localStorage, normalizing all records to v2 shape.
 */
export function loadMetadata(): SavedConversationV2[] {
  try {
    const raw = localStorage.getItem(getMetadataKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (SavedConversation | SavedConversationV2)[];
    return parsed.map(normalizeMetadata);
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to load metadata:', err);
    return [];
  }
}

/**
 * Save metadata list to localStorage
 */
function saveMetadata(list: SavedConversationV2[]): void {
  try {
    localStorage.setItem(getMetadataKey(), JSON.stringify(list));
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to save metadata:', err);
  }
}

/**
 * List all saved conversations (metadata only)
 */
export function listConversations(): SavedConversationV2[] {
  return loadMetadata().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Load a full conversation by ID
 */
export function loadConversation(id: string): SavedConversationData | null {
  try {
    const raw = localStorage.getItem(getConversationKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as SavedConversationData;
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to load conversation:', err);
    return null;
  }
}

/**
 * Save a conversation (creates or updates)
 */
export function saveConversation(data: SavedConversationData): void {
  try {
    const key = getConversationKey(data.id);
    localStorage.setItem(key, JSON.stringify(data));

    // Update metadata
    const metadata = loadMetadata();
    const existingIndex = metadata.findIndex((m) => m.id === data.id);
    const primaryRuntimeId = agentIdToRuntimeId(data.agentId);
    const meta: SavedConversationV2 = {
      id: data.id,
      title: data.title,
      agentId: data.agentId,
      primaryRuntimeId,
      runtimeSummary: [primaryRuntimeId],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    if (existingIndex >= 0) {
      metadata[existingIndex] = meta;
    } else {
      metadata.unshift(meta);
    }

    // Enforce limit
    if (metadata.length > MAX_CONVERSATIONS) {
      const toRemove = metadata.splice(MAX_CONVERSATIONS);
      for (const old of toRemove) {
        deleteConversationData(old.id);
      }
    }

    saveMetadata(metadata);
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to save conversation:', err);
    // If quota exceeded, try cleanup
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      cleanupOldConversations();
      try {
        localStorage.setItem(getConversationKey(data.id), JSON.stringify(data));
      } catch {
        console.error('[chatHistoryStorage] Still failed after cleanup');
      }
    }
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
  deleteConversationData(id);

  const metadata = loadMetadata();
  const filtered = metadata.filter((m) => m.id !== id);
  saveMetadata(filtered);
}

/**
 * Delete only the conversation data (not metadata)
 */
function deleteConversationData(id: string): void {
  try {
    localStorage.removeItem(getConversationKey(id));
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to delete conversation data:', err);
  }
}

/**
 * Clean up old conversations to free space
 */
function cleanupOldConversations(): void {
  const metadata = loadMetadata();
  if (metadata.length > MAX_CONVERSATIONS / 2) {
    // Remove oldest half
    const toRemove = metadata.slice(Math.floor(MAX_CONVERSATIONS / 2));
    for (const old of toRemove) {
      deleteConversation(old.id);
    }
  }
}

/**
 * Generate a title from conversation content
 */
export function generateTitle(
  agentConversation: AgentConversationTurn[],
  chatMessages: ChatMessage[],
  codexConversation?: CodexConversationTurn[]
): string {
  // Sprint 99 (R6 / Resolved Gap 1): the rail tooltip and History must agree,
  // so both go through `truncateThreadTitle`. The old rule here was a raw
  // 50-character cut with a literal "..." appended, which broke mid-word and
  // produced doubled ellipses on prompts that already ended in one.

  // For agent conversations, use first user prompt
  if (agentConversation.length > 0) {
    const firstPrompt = agentConversation[0].userPrompt;
    if (firstPrompt) return truncateThreadTitle(firstPrompt);
  }

  // For Codex conversations, use first user prompt
  if (codexConversation && codexConversation.length > 0) {
    const firstPrompt = codexConversation[0].userPrompt;
    if (firstPrompt) return truncateThreadTitle(firstPrompt);
  }

  // For chat messages, use first user message
  const firstUserMsg = chatMessages.find((m) => m.role === 'user');
  if (firstUserMsg) return truncateThreadTitle(firstUserMsg.content);

  return 'New conversation';
}

/**
 * Check if there are any saved conversations
 */
export function hasHistory(): boolean {
  return loadMetadata().length > 0;
}

// ── Open-thread set (Sprint 99 R13 / E7) ──────────────────────────────

/**
 * Which conversations were on the rail, per workspace.
 *
 * Transcripts already persist per conversation id under this same prefix; the
 * only thing missing for R13 was *which* of them were open. This is deliberately
 * a list of ids and nothing else — titles, runtime bindings and turns all come
 * back from the conversation records themselves, so the two can never disagree.
 */
function getOpenThreadsKey(): string {
  return `${getStoragePrefix()}open-threads`;
}

export function saveOpenThreadIds(ids: readonly string[]): void {
  try {
    localStorage.setItem(getOpenThreadsKey(), JSON.stringify(ids));
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to save open threads:', err);
  }
}

export function loadOpenThreadIds(): string[] {
  try {
    const raw = localStorage.getItem(getOpenThreadsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to load open threads:', err);
    return [];
  }
}

/**
 * Save a v2 conversation record. No-op unless enableV2Storage() has been called.
 * Preserves old fields in the record so a downgrade can still read it.
 */
export function saveConversationV2(data: SavedConversationDataV2): void {
  if (!_v2StorageEnabled) return;
  try {
    const key = getConversationKey(data.id);
    localStorage.setItem(key, JSON.stringify(data));

    const metadata = loadMetadata();
    const existingIndex = metadata.findIndex((m) => m.id === data.id);
    const meta: SavedConversationV2 = {
      id: data.id,
      title: data.title,
      agentId: data.agentId,
      primaryRuntimeId: data.primaryRuntimeId,
      runtimeSummary: data.runtimeSummary,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    if (existingIndex >= 0) {
      metadata[existingIndex] = meta;
    } else {
      metadata.unshift(meta);
    }

    if (metadata.length > MAX_CONVERSATIONS) {
      const toRemove = metadata.splice(MAX_CONVERSATIONS);
      for (const old of toRemove) {
        try { localStorage.removeItem(getConversationKey(old.id)); } catch { /* ignore */ }
      }
    }

    saveMetadata(metadata);
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to save v2 conversation:', err);
  }
}
