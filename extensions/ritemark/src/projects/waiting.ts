/**
 * Sprint 134 (R3, R6, W3): what waits for the person, in each project.
 *
 * A project's total is its board's calls plus its chats that need the person.
 * Every count comes from the same rules the board and the chat store already
 * use, read without opening the project:
 *   - a card's call: `BoardStore.list()` on the folder (read only) and this
 *     computer's hand-off records, through `callsOf`, the Tasks place's own
 *     rules. A hand-off still in flight in a project no live window holds is
 *     read as interrupted, as that project's next start would record it;
 *   - a chat's question or approval: `needs-user` in `index.json`, held by a
 *     live window (a crash leaves none behind);
 *   - a chat's unread reply (Jarmo, 19 October): its newest reply finished
 *     after the person last had it in front.
 * A chat a card runs in is counted through the card only.
 *
 * No `vscode` import.
 * Research: docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/
 *   research/waiting-audit.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeProjectUri, resolveProjectScope } from '../conversations/projectScope';
import { hasUnreadReply } from '../conversations/types';
import { liveTurnOwnerIds, turnOwnersDir } from '../conversations/turnOwners';
import { callsOf } from '../taskBoard/BoardController';
import { BoardStore } from '../taskBoard/BoardStore';
import type { Card } from '../taskBoard/cardFile';
import { cardTaskStoreDir, decodeCardHandoffRecord, handoffViewOf, type CardHandoffRecordV1 } from '../taskBoard/CardTaskStore';
import { ACTIVE_HANDOFF_STATES, type BoardCall, type CallKind, type CardHandoffView } from '../taskBoard/protocol';
import { liveProjectWindows, projectWindowsDir } from './projectWindows';

export type ChatWaitKind = 'approval' | 'question' | 'plan-review' | 'reply';

export type WaitingItem =
  | { source: 'card'; kind: CallKind; cardId: string; title: string; since: string }
  | { source: 'chat'; kind: ChatWaitKind; conversationId: string; title: string; since: string; runtimeId: string | null };

export interface ProjectWaiting {
  /** The board's calls; undefined when the board can't be read, 0 with no board. */
  tasks: number | undefined;
  /** Chats that need the person; undefined when the chat store can't be read. */
  chats: number | undefined;
  /** What the projects list, the switcher and Home show; undefined rather than wrong. */
  total: number | undefined;
  /** Cards first, most urgent first; then chats, longest waiting first. */
  items: WaitingItem[];
}

/** The part of an `index.json` entry this module reads; older entries lack the last two. */
export interface ChatIndexEntry {
  conversationId: string;
  scopeId: string;
  title: string;
  lastActivityAt: string;
  lifecycle: { state: string; attentionKind?: string };
  readAt?: string;
  lastReplyAt?: string;
  /** The runtimes the chat used, oldest first: the last one is its AI now. */
  runtimeSummary?: string[];
}

const ATTENTION_KINDS: ReadonlySet<string> = new Set(['approval', 'question', 'plan-review']);

export { hasUnreadReply };

function lastRuntime(entry: ChatIndexEntry): string | null {
  const runtimes = Array.isArray(entry.runtimeSummary) ? entry.runtimeSummary.filter((id) => typeof id === 'string') : [];
  return runtimes[runtimes.length - 1] ?? null;
}

/** A project's chats that need the person, longest waiting first. */
export function chatsWaiting(
  entries: readonly ChatIndexEntry[],
  scopeId: string,
  heldByLiveWindow: ReadonlySet<string>,
  cardConversationIds: ReadonlySet<string>,
): Extract<WaitingItem, { source: 'chat' }>[] {
  const items: Extract<WaitingItem, { source: 'chat' }>[] = [];
  for (const entry of entries) {
    if (entry.scopeId !== scopeId || cardConversationIds.has(entry.conversationId)) continue;
    const { lifecycle } = entry;
    if (lifecycle.state === 'needs-user' && lifecycle.attentionKind && ATTENTION_KINDS.has(lifecycle.attentionKind)) {
      if (heldByLiveWindow.has(entry.conversationId)) {
        items.push({ source: 'chat', kind: lifecycle.attentionKind as ChatWaitKind, conversationId: entry.conversationId, title: entry.title, since: entry.lastActivityAt, runtimeId: lastRuntime(entry) });
        continue;
      }
    }
    if (hasUnreadReply(entry)) {
      items.push({ source: 'chat', kind: 'reply', conversationId: entry.conversationId, title: entry.title, since: entry.lastReplyAt!, runtimeId: lastRuntime(entry) });
    }
  }
  return items.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
}

/**
 * The hand-off views of a project's records. In a project no live window
 * holds, work still marked in flight ended with that window: it reads as
 * interrupted, as `CardHandoffLedger.recover` records it on the next start.
 */
export function handoffViewsFor(records: readonly CardHandoffRecordV1[], heldByLiveWindow: boolean): Map<string, CardHandoffView> {
  const views = new Map<string, CardHandoffView>();
  for (const record of records) {
    const view = handoffViewOf(record);
    if (heldByLiveWindow || !ACTIVE_HANDOFF_STATES.has(record.state)) {
      views.set(record.cardId, view);
      continue;
    }
    const { needs: _needs, ...ended } = view;
    views.set(record.cardId, { ...ended, state: 'interrupted' });
  }
  return views;
}

export function cardItems(calls: readonly BoardCall[], titleOf: (cardId: string) => string): Extract<WaitingItem, { source: 'card' }>[] {
  return calls.map((call): Extract<WaitingItem, { source: 'card' }> => ({ source: 'card', kind: call.kind, cardId: call.cardId, title: titleOf(call.cardId), since: call.since }));
}

export function summarize(tasks: Extract<WaitingItem, { source: 'card' }>[] | undefined, chats: Extract<WaitingItem, { source: 'chat' }>[] | undefined): ProjectWaiting {
  return {
    tasks: tasks?.length,
    chats: chats?.length,
    total: tasks && chats ? tasks.length + chats.length : undefined,
    items: [...(tasks ?? []), ...(chats ?? [])],
  };
}

export interface WaitingReaderOptions {
  globalStoragePath: string;
  /** Off with the `task-board` flag: no task counts, chats still count (R13). */
  boardEnabled: () => boolean;
  isAlive?: (pid: number) => boolean;
  now?: () => number;
  /** Other projects are read when shown, then kept this long (ms). */
  cacheMs?: number;
}

/** The board of the open project, from its live controller, so Home and the tab never lag it. */
export interface LiveBoard {
  calls: readonly BoardCall[];
  titleOf(cardId: string): string;
  /** The conversations its cards run in (from the ledger). */
  conversationIds: ReadonlySet<string>;
}

/**
 * Reads what waits in any project from what this computer already has.
 * Reads only: nothing here writes, renames or removes a file.
 */
export class WaitingReader {
  private readonly cache = new Map<string, { at: number; value: ProjectWaiting }>();
  private readonly now: () => number;

  constructor(private readonly options: WaitingReaderOptions) {
    this.now = options.now ?? Date.now;
  }

  /** `index.json` as it is; undefined when it can't be read, empty when there is none. */
  async readChatIndex(): Promise<ChatIndexEntry[] | undefined> {
    const file = path.join(this.options.globalStoragePath, 'conversations', 'v1', 'index.json');
    let text: string;
    try {
      text = await fs.promises.readFile(file, 'utf8');
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : undefined;
    }
    try {
      const value = JSON.parse(text) as { entries?: unknown };
      if (!Array.isArray(value.entries)) return undefined;
      return value.entries.filter((entry): entry is ChatIndexEntry => {
        const e = entry as Partial<ChatIndexEntry> | null;
        return Boolean(e && typeof e.conversationId === 'string' && typeof e.scopeId === 'string' && typeof e.title === 'string'
          && typeof e.lastActivityAt === 'string' && e.lifecycle && typeof e.lifecycle.state === 'string');
      });
    } catch {
      return undefined;
    }
  }

  /** A project's hand-off records, decoded; a record that doesn't decode is skipped, never moved. */
  async readHandoffs(folderPath: string): Promise<CardHandoffRecordV1[]> {
    const dir = cardTaskStoreDir(this.options.globalStoragePath, folderPath);
    let names: string[];
    try {
      names = await fs.promises.readdir(dir);
    } catch {
      return [];
    }
    const records: CardHandoffRecordV1[] = [];
    for (const name of names) {
      if (!name.endsWith('.json') || name.includes('.tmp-')) continue;
      try {
        const record = decodeCardHandoffRecord(JSON.parse(await fs.promises.readFile(path.join(dir, name), 'utf8')));
        if (record) records.push(record);
      } catch {
        // Unreadable: the project's own board moves it aside when it opens.
      }
    }
    return records;
  }

  /** A project's cards, as its board reads them; undefined when its task folder can't be read. */
  async readCards(folderPath: string): Promise<Card[] | undefined> {
    try {
      const entries = await new BoardStore(folderPath).list();
      return entries.flatMap((entry) => (entry.kind === 'card' ? [entry.card] : []));
    } catch {
      return undefined;
    }
  }

  /**
   * What waits in one project. `folderUri` is the folder's `uri.toString()`,
   * `folderPath` its `fsPath`. The open project passes its live board.
   */
  async read(folderUri: string, folderPath: string, live?: LiveBoard, index?: ChatIndexEntry[] | undefined): Promise<ProjectWaiting> {
    const isAlive = this.options.isAlive;
    const chatIndex = index !== undefined ? index : await this.readChatIndex();
    const owners = liveTurnOwnerIds(turnOwnersDir(this.options.globalStoragePath), isAlive);
    let tasks: Extract<WaitingItem, { source: 'card' }>[] | undefined = [];
    let cardConversations: ReadonlySet<string> = new Set<string>();
    const boardOn = this.options.boardEnabled();
    if (live) {
      cardConversations = live.conversationIds;
      tasks = boardOn ? cardItems(live.calls, (id) => live.titleOf(id)) : [];
    } else {
      const records = await this.readHandoffs(folderPath);
      cardConversations = new Set(records.flatMap((record) => (record.conversationId ? [record.conversationId] : [])));
      if (boardOn) {
        const cards = await this.readCards(folderPath);
        if (cards) {
          const windows = new Set([...liveProjectWindows(projectWindowsDir(this.options.globalStoragePath), isAlive)].map((uri) => normalizeProjectUri(uri)));
          const handoffs = handoffViewsFor(records, windows.has(normalizeProjectUri(folderUri)));
          const titles = new Map(cards.map((card) => [card.id, card.title]));
          tasks = cardItems(callsOf(cards, handoffs), (id) => titles.get(id) ?? '');
        } else {
          tasks = undefined;
        }
      }
    }
    const chats = chatIndex
      ? chatsWaiting(chatIndex, resolveProjectScope({ folderUris: [folderUri] }).scopeId, owners, cardConversations)
      : undefined;
    return summarize(tasks, chats);
  }

  /** Other projects' counts, read once per show and kept for a short while. */
  async readMany(projects: readonly { folderUri: string; folderPath: string }[]): Promise<Map<string, ProjectWaiting>> {
    const result = new Map<string, ProjectWaiting>();
    const stale = projects.filter((project) => {
      const hit = this.cache.get(project.folderUri);
      if (hit && this.now() - hit.at < (this.options.cacheMs ?? 30_000)) {
        result.set(project.folderUri, hit.value);
        return false;
      }
      return true;
    });
    if (stale.length === 0) return result;
    const index = await this.readChatIndex();
    await Promise.all(stale.map(async (project) => {
      const value = await this.read(project.folderUri, project.folderPath, undefined, index);
      this.cache.set(project.folderUri, { at: this.now(), value });
      result.set(project.folderUri, value);
    }));
    return result;
  }

  /** Forget cached counts, for example when the window gains focus. */
  invalidate(): void {
    this.cache.clear();
  }
}
