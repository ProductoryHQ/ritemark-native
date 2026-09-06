/**
 * Chat History Storage
 *
 * Persists conversation sessions to localStorage with automatic cleanup.
 * Stores metadata separately from full conversation data for efficient listing.
 */

import type { AgentId, AgentConversationTurn, CodexConversationTurn, ChatMessage, ConversationEntry } from './types';
import type { RuntimeId, ConversationRun } from './conversationModel';
import { truncateThreadTitle } from './threadStatus';
import type { LegacyConversationCandidateV1 } from '../../../../src/conversations/LegacyConversationMigrator';

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
  /**
   * Sprint 103 R8: the thread's autonomy policy + Plan chip, so a reload
   * cannot silently widen Manual back to Auto. Absent on pre-103 records.
   */
  turnPolicy?: { mode: 'auto' | 'ask' | 'plan'; planFirst?: boolean };
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
let _legacyStorageReadOnly = false;

/** Enable v2 conversation record writes. Off by default — flip after testing. */
export function enableV2Storage(): void {
  _v2StorageEnabled = true;
}

/**
 * Monotonic Sprint 109 cutover guard. Once the host owns conversations, this
 * adapter remains available for migration/rollback reads but cannot create a
 * second writable source of truth.
 */
export function setLegacyStorageReadOnly(readOnly: boolean): void {
  _legacyStorageReadOnly = _legacyStorageReadOnly || readOnly;
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
let _legacyStorageScope: 'workspace' | 'global' = 'workspace';

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
  if (_workspacePath && _legacyStorageScope === 'workspace') {
    return `${GLOBAL_PREFIX}${hashWorkspacePath(_workspacePath)}-`;
  }
  return GLOBAL_PREFIX;
}

function getMetadataKey(): string {
  return `${getStoragePrefix()}metadata`;
}

/**
 * Set the workspace path for per-project history scoping. This critical
 * bootstrap operation is intentionally side-effect-free; the host rollout
 * result decides later whether legacy storage is authoritative at all.
 */
export function setWorkspaceContext(workspacePath: string | undefined): void {
  if (_workspacePath === workspacePath) return;
  _workspacePath = workspacePath;
  _legacyStorageScope = workspacePath ? 'workspace' : 'global';
}

/**
 * Select the existing legacy authority after the host has explicitly kept the
 * webview in pre-cutover legacy mode. This is deliberately read-only: copying
 * full records during bootstrap can temporarily double storage and exhaust the
 * webview quota. Existing scoped data wins; otherwise an existing global store
 * remains readable/writable for rollback compatibility. A brand-new store uses
 * workspace scope.
 */
export function selectLegacyStorageScope(): 'workspace' | 'global' {
  if (_legacyStorageReadOnly || !_workspacePath) {
    _legacyStorageScope = _workspacePath ? 'workspace' : 'global';
    return _legacyStorageScope;
  }
  try {
    const scopedMetadataKey = `${GLOBAL_PREFIX}${hashWorkspacePath(_workspacePath)}-metadata`;
    if (localStorage.getItem(scopedMetadataKey)) {
      _legacyStorageScope = 'workspace';
    } else if (localStorage.getItem(`${GLOBAL_PREFIX}metadata`)) {
      _legacyStorageScope = 'global';
    } else {
      _legacyStorageScope = 'workspace';
    }
  } catch (error) {
    // Storage availability is optional UI state. Keep a deterministic scope and
    // let the existing guarded read helpers surface an empty legacy list.
    _legacyStorageScope = 'workspace';
    console.warn('[chatHistoryStorage] Could not select legacy storage scope:', error);
  }
  return _legacyStorageScope;
}

// ── Storage Functions ─────────────────────────────────────────────────

/**
 * Generate a unique conversation ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // RFC 4122 v4 fallback for older embedded webviews.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

/**
 * Get the storage key for a conversation's data
 */
function getConversationKey(id: string): string {
  return `${getStoragePrefix()}${id}`;
}

/** Read-only inventory handed to the host migrator after canonical cutover. */
export function discoverLegacyConversationCandidates(): LegacyConversationCandidateV1[] {
  const candidates: LegacyConversationCandidateV1[] = [];
  const seen = new Set<string>();
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const metadataKey = localStorage.key(index);
      if (!metadataKey?.startsWith(GLOBAL_PREFIX) || !metadataKey.endsWith('metadata')) continue;
      try {
        const raw = localStorage.getItem(metadataKey);
        const metadata = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(metadata)) continue;
        const prefix = metadataKey.slice(0, -'metadata'.length);
        for (const value of metadata) {
          if (!value || typeof value !== 'object') continue;
          const meta = value as Record<string, unknown>;
          if (typeof meta.id !== 'string') continue;
          const sourceKey = `${prefix}${meta.id}`;
          if (seen.has(sourceKey)) continue;
          try {
            const sourceRaw = localStorage.getItem(sourceKey);
            if (!sourceRaw) continue;
            const data = JSON.parse(sourceRaw);
            seen.add(sourceKey);
            candidates.push({
              sourceKey,
              sourceId: meta.id,
              ...(typeof meta.title === 'string' ? { title: meta.title } : {}),
              ...(typeof meta.agentId === 'string' ? { agentId: meta.agentId } : {}),
              ...(typeof meta.createdAt === 'number' ? { createdAt: meta.createdAt } : {}),
              ...(typeof meta.updatedAt === 'number' ? { updatedAt: meta.updatedAt } : {}),
              data,
            });
          } catch (error) {
            console.warn('[chatHistoryStorage] Skipped malformed legacy record:', sourceKey, error);
          }
        }
      } catch (error) {
        console.warn('[chatHistoryStorage] Skipped malformed legacy inventory:', metadataKey, error);
      }
    }
  } catch (error) {
    console.warn('[chatHistoryStorage] Legacy inventory unavailable:', error);
  }
  return candidates;
}

/** Keep each bridge message within the host protocol's bounded import limit. */
export function buildLegacyMigrationBatches(
  candidates: readonly LegacyConversationCandidateV1[],
  batchSize = 100,
): LegacyConversationCandidateV1[][] {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');
  if (candidates.length === 0) return [[]];
  const batches: LegacyConversationCandidateV1[][] = [];
  for (let index = 0; index < candidates.length; index += batchSize) {
    batches.push(candidates.slice(index, index + batchSize));
  }
  return batches;
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
  if (_legacyStorageReadOnly) return;
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
  if (_legacyStorageReadOnly) return;
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
  if (_legacyStorageReadOnly) return;
  deleteConversationData(id);

  const metadata = loadMetadata();
  const filtered = metadata.filter((m) => m.id !== id);
  saveMetadata(filtered);
}

/**
 * Delete only the conversation data (not metadata)
 */
function deleteConversationData(id: string): void {
  if (_legacyStorageReadOnly) return;
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
  if (_legacyStorageReadOnly) return;
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

/**
 * Save a v2 conversation record. No-op unless enableV2Storage() has been called.
 * Preserves old fields in the record so a downgrade can still read it.
 */
export function saveConversationV2(data: SavedConversationDataV2): void {
  if (!_v2StorageEnabled || _legacyStorageReadOnly) return;
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
