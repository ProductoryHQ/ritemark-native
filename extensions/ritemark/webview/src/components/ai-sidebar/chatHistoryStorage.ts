/**
 * Chat History Storage
 *
 * Persists conversation sessions to localStorage with automatic cleanup.
 * Stores metadata separately from full conversation data for efficient listing.
 */

import type { AgentId, AgentConversationTurn, ChatMessage, ConversationEntry } from './types';

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
  chatMessages: ChatMessage[];
  conversationHistory: ConversationEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'ritemark-chat-';
const METADATA_KEY = `${STORAGE_PREFIX}metadata`;
const MAX_CONVERSATIONS = 50;

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
  return `${STORAGE_PREFIX}${id}`;
}

/**
 * Load metadata list from localStorage
 */
export function loadMetadata(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
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
    localStorage.setItem(METADATA_KEY, JSON.stringify(list));
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
  chatMessages: ChatMessage[]
): string {
  // For agent conversations, use first user prompt
  if (agentConversation.length > 0) {
    const firstPrompt = agentConversation[0].userPrompt;
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
