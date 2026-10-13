/**
 * CardTaskStore — the machine-local side of the task board (Sprint 130).
 *
 * Which conversation a card's work runs in, its current turn and the live
 * state (sending, queued, working, needs you, waiting to start) are true only
 * on this computer, so they live in global storage, not in the shared card
 * file: one record per card per project, `<globalStorage>/task-board/v1/
 * <project key>/<cardId>.json`. The record keeps the card's conversation across
 * handoffs, so Give to again and Ask for changes continue the same one.
 *
 * Same shape as the other global stores: injected filesystem, one serialized
 * tail, tmp-then-rename writes; a record that does not decode is set aside.
 */

import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { nodeConversationStoreFileSystem, type ConversationStoreFileSystem } from '../conversations/ConversationStore';
import type { AgentId } from '../agent/types';
import type { CardTurnKind } from './boardPrompt';
import type { HandoffState, NeedsKind, WaitReason } from './protocol';

export interface CardHandoffRecordV1 {
  schemaVersion: 1;
  cardId: string;
  /** The current attempt; the sidebar's queue and the turn events carry it. */
  taskId: string;
  runtimeId: AgentId;
  /** The card's conversation on this computer; kept across handoffs. */
  conversationId: string | null;
  conversationTitle: string | null;
  /** The current attempt's host-minted turn id. */
  turnId: string | null;
  state: HandoffState;
  since: string;
  needs?: NeedsKind;
  waitFor?: WaitReason;
  failure?: string;
  /** When the current turn started running, for "finished in 4m 12s". */
  startedAt?: string;
  /** What the last turn asked, so Retry sends it again. */
  lastTurn?: { kind: CardTurnKind; text?: string };
  /** The conversation's title still has to be set to the card's (a new
   *  conversation gets its canonical id, and only then a title, at its first turn). */
  titlePending?: string;
  createdAt: string;
  updatedAt: string;
}

const STATES: ReadonlySet<string> = new Set([
  'waiting', 'accepting', 'queued', 'running', 'needs-user', 'completed', 'failed', 'cancelled', 'interrupted', 'conversation-gone',
]);

/** A short stable directory name for a project folder. */
export function projectKey(folderPath: string): string {
  return createHash('sha256').update(folderPath).digest('hex').slice(0, 16);
}

export function cardTaskStoreDir(globalStoragePath: string, folderPath: string): string {
  return path.join(globalStoragePath, 'task-board', 'v1', projectKey(folderPath));
}

function decode(value: unknown): CardHandoffRecordV1 | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<CardHandoffRecordV1>;
  if (record.schemaVersion !== 1) return null;
  if (typeof record.cardId !== 'string' || !/^[a-z0-9]{6}$/.test(record.cardId)) return null;
  if (typeof record.taskId !== 'string' || !record.taskId) return null;
  if (record.runtimeId !== 'claude-code' && record.runtimeId !== 'codex' && record.runtimeId !== 'opencode') return null;
  if (typeof record.state !== 'string' || !STATES.has(record.state)) return null;
  if (typeof record.since !== 'string') return null;
  return record as CardHandoffRecordV1;
}

export class CardTaskStore {
  private readonly fs: ConversationStoreFileSystem;
  private readonly randomId: () => string;
  private readonly records = new Map<string, CardHandoffRecordV1>();
  private tail: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(readonly baseDir: string, dependencies: { fileSystem?: ConversationStoreFileSystem; randomId?: () => string } = {}) {
    this.fs = dependencies.fileSystem ?? nodeConversationStoreFileSystem;
    this.randomId = dependencies.randomId ?? randomUUID;
  }

  /** Read every record once. A record that does not decode is moved aside. */
  load(): Promise<CardHandoffRecordV1[]> {
    return this.serialized(async () => {
      if (!this.loaded) {
        let names: string[] = [];
        try {
          names = await this.fs.readDir(this.baseDir);
        } catch {
          names = [];
        }
        for (const name of names) {
          if (!name.endsWith('.json') || name.includes('.tmp-')) continue;
          const file = path.join(this.baseDir, name);
          try {
            const record = decode(JSON.parse(await this.fs.readFile(file)));
            if (record) this.records.set(record.cardId, record);
            else await this.fs.rename(file, `${file}.unreadable`);
          } catch {
            await this.fs.rename(file, `${file}.unreadable`).catch(() => undefined);
          }
        }
        this.loaded = true;
      }
      return [...this.records.values()].map((record) => ({ ...record }));
    });
  }

  /** The cached records (after `load`). */
  all(): CardHandoffRecordV1[] {
    return [...this.records.values()];
  }

  get(cardId: string): CardHandoffRecordV1 | null {
    return this.records.get(cardId) ?? null;
  }

  findByTask(taskId: string): CardHandoffRecordV1 | null {
    for (const record of this.records.values()) if (record.taskId === taskId) return record;
    return null;
  }

  findByTurn(turnId: string): CardHandoffRecordV1 | null {
    for (const record of this.records.values()) if (record.turnId === turnId) return record;
    return null;
  }

  /** Replace a card's record; the cache changes at once, the write follows. */
  put(record: CardHandoffRecordV1): Promise<void> {
    this.records.set(record.cardId, record);
    return this.serialized(() => this.write(record));
  }

  remove(cardId: string): Promise<void> {
    this.records.delete(cardId);
    return this.serialized(async () => {
      await this.fs.remove(path.join(this.baseDir, `${cardId}.json`)).catch(() => undefined);
    });
  }

  private async write(record: CardHandoffRecordV1): Promise<void> {
    // The cache may hold a newer version by now; write that.
    const current = this.records.get(record.cardId);
    if (!current) return;
    await this.fs.mkdir(this.baseDir);
    const target = path.join(this.baseDir, `${current.cardId}.json`);
    const temp = `${target}.tmp-${this.randomId()}`;
    await this.fs.writeFile(temp, JSON.stringify(current, null, 2));
    await this.fs.rename(temp, target);
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
