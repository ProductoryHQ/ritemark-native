/**
 * Chat History Storage
 *
 * Persists conversation sessions to localStorage with automatic cleanup.
 * Stores metadata separately from full conversation data for efficient listing.
 */

import type { AgentId, AgentConversationTurn, CodexConversationTurn, ChatMessage, ConversationEntry } from './types';

// ── Types ─────────────────────────────────────────────────────────────

export interface SavedConversation {
  id: string;
  title: string;
  agentId: AgentId;
  createdAt: number;
  updatedAt: number;
}

export interface SavedConversationData extends SavedConversation {
  agentConversation: AgentConversationTurn[];
  codexConversation?: CodexConversationTurn[];
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────

const GLOBAL_PREFIX = 'ritemark-chat-';
const MAX_CONVERSATIONS = 50;

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
    const globalMeta = JSON.parse(globalRaw) as SavedConversation[];
    if (globalMeta.length === 0) {
      localStorage.setItem(`${MIGRATION_DONE_KEY}-${hashWorkspacePath(_workspacePath!)}`, '1');
      return;
    }

    // Copy each conversation to workspace-scoped keys
    const migratedMeta: SavedConversation[] = [];
    for (const meta of globalMeta) {
      const oldKey = `${GLOBAL_PREFIX}${meta.id}`;
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(getConversationKey(meta.id), data);
        migratedMeta.push(meta);
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
 * Load metadata list from localStorage
 */
export function loadMetadata(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(getMetadataKey());
    if (!raw) return [];
    return JSON.parse(raw) as SavedConversation[];
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to load metadata:', err);
    return [];
  }
}

/**
 * Save metadata list to localStorage
 */
function saveMetadata(list: SavedConversation[]): void {
  try {
    localStorage.setItem(getMetadataKey(), JSON.stringify(list));
  } catch (err) {
    console.warn('[chatHistoryStorage] Failed to save metadata:', err);
  }
}

/**
 * List all saved conversations (metadata only)
 */
export function listConversations(): SavedConversation[] {
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
    const meta: SavedConversation = {
      id: data.id,
      title: data.title,
      agentId: data.agentId,
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
  // For agent conversations, use first user prompt
  if (agentConversation.length > 0) {
    const firstPrompt = agentConversation[0].userPrompt;
    if (firstPrompt) {
      return firstPrompt.substring(0, 50) + (firstPrompt.length > 50 ? '...' : '');
    }
  }

  // For Codex conversations, use first user prompt
  if (codexConversation && codexConversation.length > 0) {
    const firstPrompt = codexConversation[0].userPrompt;
    if (firstPrompt) {
      return firstPrompt.substring(0, 50) + (firstPrompt.length > 50 ? '...' : '');
    }
  }

  // For chat messages, use first user message
  const firstUserMsg = chatMessages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
  }

  return 'New conversation';
}

/**
 * Check if there are any saved conversations
 */
export function hasHistory(): boolean {
  return loadMetadata().length > 0;
}
