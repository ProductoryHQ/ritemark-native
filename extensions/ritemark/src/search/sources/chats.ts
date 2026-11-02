/**
 * Sprint 148 (R3, A5): this project's chats, as sources for the index.
 *
 * Read in the worker, never on the extension host's main thread, and read only:
 * the conversation store's `index.json` lists the chats (`ConversationStore`
 * writes it; Home follows it the same way), each chat is one JSON record under
 * `records/`. A chat is found by its title and the words of the person's and the
 * AI's messages; tool activity, approvals, receipts and the host's own lines
 * (a turn Claude opened itself after background work) are left out. A passage
 * is one message. A deleted chat (gone from the index, or with a tombstone)
 * never shows. At most `maxChars` of message text per chat, the newest first.
 */
import { promises as fsp } from 'node:fs';
import * as nodePath from 'node:path';
import type { IndexSource } from '../protocol';

export interface ChatFs {
  readFile(target: string): Promise<string>;
  exists(target: string): Promise<boolean>;
}

export const nodeChatFs: ChatFs = {
  readFile: (target) => fsp.readFile(target, 'utf8'),
  exists: async (target) => {
    try {
      await fsp.stat(target);
      return true;
    } catch {
      return false;
    }
  },
};

interface IndexEntryShape {
  conversationId: string;
  scopeId: string;
  revision: number;
  integrity?: string;
}

const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,128}$/;

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A chat record as a source; null when it isn't one this project can show. */
export function chatSource(record: unknown, maxChars: number): IndexSource | null {
  if (!record || typeof record !== 'object') return null;
  const value = record as Record<string, unknown>;
  const id = str(value.conversationId);
  if (!id || !CONVERSATION_ID.test(id)) return null;
  const title = str(value.title) ?? '';
  const events = Array.isArray(value.events) ? value.events : [];
  const messages: { text: string; at: { eventId: string; speaker: string } }[] = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const e = event as Record<string, unknown>;
    const eventId = str(e.eventId);
    if (!eventId) continue;
    if (e.kind === 'user-message' && e.origin === undefined) {
      const text = str(e.text);
      if (text?.trim()) messages.push({ text, at: { eventId, speaker: 'you' } });
    } else if (e.kind === 'assistant-message') {
      const text = str(e.content);
      if (text?.trim()) messages.push({ text, at: { eventId, speaker: str(e.runtimeId) ?? 'ai' } });
    }
  }
  // The newest messages first within the budget, shown in their order.
  const kept: typeof messages = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && chars < maxChars; i--) {
    const room = maxChars - chars;
    const text = messages[i].text.length > room ? messages[i].text.slice(0, room) : messages[i].text;
    kept.unshift({ text, at: messages[i].at });
    chars += text.length;
  }
  const changedAt = Date.parse(str(value.lastActivityAt) ?? '') || 0;
  return { key: `chat:${id}`, kind: 'chat', name: title, where: null, changedAt, passages: kept };
}

/** Follows the store's index; each refresh says which chats to add again and which to drop. */
export class ChatFeed {
  private readonly known = new Map<string, number>();

  constructor(
    private readonly dir: string,
    private readonly scopeId: string,
    private readonly maxChars: number,
    private readonly fs: ChatFs = nodeChatFs,
  ) {}

  get size(): number {
    return this.known.size;
  }

  async refresh(): Promise<{ upserts: IndexSource[]; removed: string[] }> {
    let entries: IndexEntryShape[];
    try {
      const index = JSON.parse(await this.fs.readFile(nodePath.join(this.dir, 'index.json'))) as { entries?: unknown };
      entries = (Array.isArray(index.entries) ? index.entries : []).filter(
        (entry): entry is IndexEntryShape =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as IndexEntryShape).conversationId === 'string' &&
          CONVERSATION_ID.test((entry as IndexEntryShape).conversationId) &&
          (entry as IndexEntryShape).scopeId === this.scopeId &&
          (entry as IndexEntryShape).integrity !== 'corrupt',
      );
    } catch {
      // No store yet, or an index being written: keep what is known.
      return { upserts: [], removed: [] };
    }
    const live = new Set(entries.map((entry) => entry.conversationId));
    const removed: string[] = [];
    for (const id of [...this.known.keys()]) {
      if (!live.has(id)) {
        this.known.delete(id);
        removed.push(`chat:${id}`);
      }
    }
    const upserts: IndexSource[] = [];
    for (const entry of entries) {
      const revision = typeof entry.revision === 'number' ? entry.revision : -1;
      if (this.known.get(entry.conversationId) === revision) continue;
      if (await this.fs.exists(nodePath.join(this.dir, 'tombstones', `${entry.conversationId}.json`))) {
        if (this.known.delete(entry.conversationId)) removed.push(`chat:${entry.conversationId}`);
        continue;
      }
      let source: IndexSource | null = null;
      try {
        source = chatSource(JSON.parse(await this.fs.readFile(nodePath.join(this.dir, 'records', `${entry.conversationId}.json`))), this.maxChars);
      } catch {
        source = null;
      }
      if (!source || source.key !== `chat:${entry.conversationId}`) continue;
      this.known.set(entry.conversationId, revision);
      upserts.push(source);
    }
    return { upserts, removed };
  }
}
