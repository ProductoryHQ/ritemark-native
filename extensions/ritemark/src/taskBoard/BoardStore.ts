/**
 * BoardStore — the cards of one project folder (Sprint 130, #119).
 *
 * The cards are the user's files in `.ritemark/tasks/`, changed by the board,
 * by agents through the board tools, and by anything outside Ritemark (git,
 * sync tools, another editor). The store keeps three promises:
 *   - every change is semantic and serialized: re-read the file, apply the
 *     change, write `<file>.tmp-<id>`, rename. A crash leaves the old or the new
 *     file, never half of one;
 *   - a file that does not parse is never written to. It is listed as
 *     unreadable until the user fixes or deletes it;
 *   - only the changed card's file is written. A move rewrites one file, so two
 *     changes to different cards never conflict in git or a sync folder.
 *
 * The same shape as `../commentTasks/CommentTaskStore.ts` and the conversation
 * store: a plain base path, an injected filesystem (so the tests run on a temp
 * folder), one serialized mutation tail, tmp-then-rename writes.
 *
 * Contract: docs/development/releases/v1.14.0/sprint-130-task-board/
 *   technical-plan.md (W1) and research/storage-decision.md
 */

import * as path from 'path';
import { createHash, randomInt, randomUUID } from 'crypto';
import {
  nodeConversationStoreFileSystem,
  type ConversationStoreFileSystem,
} from '../conversations/ConversationStore';
import {
  CARD_FOLDER,
  CARD_STAGES,
  cardFileName,
  checkTitle,
  compareCards,
  mintCardId,
  parseCardFile,
  rankBetween,
  serializeCard,
  spreadRanks,
  withHistory,
  type Card,
  type CardStage,
} from './cardFile';

export interface BoardStoreFileSystem extends ConversationStoreFileSystem {
  /** Move a file to the system trash. */
  trash(file: string): Promise<void>;
}

export const nodeBoardStoreFileSystem: BoardStoreFileSystem = {
  ...nodeConversationStoreFileSystem,
  async trash() {
    throw new Error('No system trash outside VS Code; compose BoardStore with workspace.fs.');
  },
};

export type BoardStoreErrorCode = 'not-found' | 'unreadable' | 'invalid' | 'write-failed';

export class BoardStoreError extends Error {
  constructor(
    readonly code: BoardStoreErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BoardStoreError';
  }
}

/** One file in `.ritemark/tasks/` that claims to be a card. */
export type BoardEntry =
  | {
      kind: 'card';
      fileName: string;
      card: Card;
      /** Set on a copied file that still carries another card's id. The card
       *  is shown under a fresh id, which the next write puts in the file. */
      copiedFrom?: string;
    }
  | { kind: 'unreadable'; fileName: string; message: string };

export interface NewCard {
  title: string;
  stage: CardStage;
  by: string;
  doneWhen?: string;
  description?: string;
  files?: string[];
  /** History line; "Created" when omitted. */
  what?: string;
}

export interface BoardStoreDependencies {
  fileSystem?: BoardStoreFileSystem;
  now?: () => Date;
  /** An integer in [0, max), for card ids. */
  random?: (max: number) => number;
  /** Suffix for temporary files. */
  tempId?: () => string;
}

interface CachedEntry {
  fileName: string;
  hash: string;
  parsed:
    | { kind: 'card'; card: Card }
    | { kind: 'unreadable'; message: string };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissing(error: unknown): boolean {
  return Boolean(error) && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function isCardFileName(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.') && !name.includes('/') && !name.includes('\\');
}

export class BoardStore {
  readonly tasksDir: string;
  private readonly fs: BoardStoreFileSystem;
  private readonly now: () => Date;
  private readonly random: (max: number) => number;
  private readonly tempId: () => string;
  private readonly entries = new Map<string, CachedEntry>();
  /** fileName → the id a copied file is shown under until its next write. */
  private readonly provisionalIds = new Map<string, string>();
  /** effective card id → fileName. */
  private readonly byId = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private mutationTail: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(readonly folderPath: string, dependencies: BoardStoreDependencies = {}) {
    this.tasksDir = path.join(folderPath, ...CARD_FOLDER.split('/'));
    this.fs = dependencies.fileSystem ?? nodeBoardStoreFileSystem;
    this.now = dependencies.now ?? (() => new Date());
    this.random = dependencies.random ?? ((max) => randomInt(max));
    this.tempId = dependencies.tempId ?? (() => randomUUID().slice(0, 8));
  }

  /** Called after every change the store makes or picks up from disk. */
  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Every card file, cards in stage order then rank, unreadable files last. */
  list(): Promise<BoardEntry[]> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      return this.snapshot();
    });
  }

  get(cardId: string): Promise<Card | null> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const entry = this.cardEntry(cardId);
      return entry ? structuredClone(entry.card) : null;
    });
  }

  /** Absolute path of a card's file (Open as document). */
  filePathOf(cardId: string): string | null {
    const fileName = this.byId.get(cardId);
    return fileName ? path.join(this.tasksDir, fileName) : null;
  }

  /** A new card at the top of its stage, in a new file. */
  create(input: NewCard): Promise<Card> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const title = checkTitle(input.title);
      if (!title.ok) throw new BoardStoreError('invalid', title.message);
      const at = this.timestamp();
      const taken = new Set<string>(this.byId.keys());
      for (const entry of this.entries.values()) {
        if (entry.parsed.kind === 'card') taken.add(entry.parsed.card.id);
      }
      let id = mintCardId(taken, this.random);
      let fileName = cardFileName(id, title.value);
      // The id is new, so only a hand-made file can already have this name.
      while (this.entries.has(fileName) || (await this.exists(fileName))) {
        taken.add(id);
        id = mintCardId(taken, this.random);
        fileName = cardFileName(id, title.value);
      }
      const rank = await this.topRank(input.stage);
      const card = withHistory(
        {
          id,
          title: title.value,
          ...(input.doneWhen ? { doneWhen: input.doneWhen } : {}),
          stage: input.stage,
          rank,
          files: [...(input.files ?? [])],
          created: at,
          updated: at,
          history: [],
          description: input.description ?? '',
        },
        { at, by: input.by, what: input.what ?? 'Created' },
      );
      const text = serializeCard(card);
      await this.fs.mkdir(this.tasksDir);
      await this.write(fileName, text);
      this.entries.set(fileName, { fileName, hash: hashOf(text), parsed: { kind: 'card', card } });
      this.resolveIds();
      this.emit();
      return structuredClone(card);
    });
  }

  /**
   * Change one card. The file is read fresh; `apply` gets the card as it is on
   * disk now and returns the changed card (same id). `history` adds a line;
   * `updated` is set. Refuses, without writing, when the file no longer parses.
   */
  mutate(
    cardId: string,
    history: { by: string; what: string } | null,
    apply: (card: Card) => Card,
  ): Promise<Card> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const changed = await this.rewrite(cardId, history, apply);
      this.emit();
      return structuredClone(changed);
    });
  }

  /** Move a card's file to the system trash. */
  remove(cardId: string): Promise<void> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const fileName = this.byId.get(cardId);
      if (!fileName) throw new BoardStoreError('not-found', 'That card is no longer on the board.');
      try {
        await this.fs.trash(path.join(this.tasksDir, fileName));
      } catch (error) {
        if (!isMissing(error)) throw new BoardStoreError('write-failed', `Couldn't move the card to the trash: ${messageOf(error)}`, error);
      }
      this.entries.delete(fileName);
      this.provisionalIds.delete(fileName);
      this.resolveIds();
      this.emit();
    });
  }

  /**
   * Give every card of a stage fresh, evenly spaced ranks, keeping their order.
   * Needed only when hand-edited ranks leave no room for a move.
   */
  rebalance(stage: CardStage): Promise<void> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      await this.spreadStage(stage, null);
      this.emit();
    });
  }

  /**
   * Re-read one file after the watcher saw it change. Returns whether the
   * board changed: the echo of the store's own write (same content) and
   * changes to files that are not cards return false.
   */
  invalidate(fileName: string): Promise<boolean> {
    return this.serialized(async () => {
      if (!isCardFileName(fileName)) return false;
      await this.ensureLoaded();
      const changed = await this.reread(fileName);
      if (changed) {
        this.resolveIds();
        this.emit();
      }
      return changed;
    });
  }

  /** Read the whole folder again (a branch switch, a sync that moved many files). */
  reload(): Promise<void> {
    return this.serialized(async () => {
      this.entries.clear();
      this.loaded = false;
      await this.ensureLoaded();
      this.emit();
    });
  }

  // ── Internals (all run on the mutation tail) ──────────────────────────────

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    let names: string[] = [];
    try {
      names = await this.fs.readDir(this.tasksDir);
    } catch (error) {
      if (!isMissing(error)) throw new BoardStoreError('write-failed', `Couldn't read the task folder: ${messageOf(error)}`, error);
    }
    for (const name of names.filter(isCardFileName).sort()) await this.reread(name);
    this.resolveIds();
    this.loaded = true;
  }

  /** Read one file into the cache. True when the cache changed. */
  private async reread(fileName: string): Promise<boolean> {
    let text: string;
    try {
      text = await this.fs.readFile(path.join(this.tasksDir, fileName));
    } catch (error) {
      if (!isMissing(error)) throw new BoardStoreError('write-failed', `Couldn't read ${fileName}: ${messageOf(error)}`, error);
      const had = this.entries.delete(fileName);
      this.provisionalIds.delete(fileName);
      return had;
    }
    const hash = hashOf(text);
    if (this.entries.get(fileName)?.hash === hash) return false;
    const parsed = parseCardFile(text);
    if (parsed.kind === 'not-a-card') {
      const had = this.entries.delete(fileName);
      this.provisionalIds.delete(fileName);
      return had;
    }
    this.entries.set(fileName, {
      fileName,
      hash,
      parsed: parsed.kind === 'card' ? { kind: 'card', card: parsed.card } : { kind: 'unreadable', message: parsed.message },
    });
    return true;
  }

  private async rewrite(
    cardId: string,
    history: { by: string; what: string } | null,
    apply: (card: Card) => Card,
  ): Promise<Card> {
    const fileName = this.byId.get(cardId);
    if (!fileName) throw new BoardStoreError('not-found', 'That card is no longer on the board.');
    const file = path.join(this.tasksDir, fileName);
    let text: string;
    try {
      text = await this.fs.readFile(file);
    } catch (error) {
      if (!isMissing(error)) throw new BoardStoreError('write-failed', `Couldn't read ${fileName}: ${messageOf(error)}`, error);
      this.entries.delete(fileName);
      this.resolveIds();
      throw new BoardStoreError('not-found', 'That card is no longer on the board.');
    }
    const parsed = parseCardFile(text);
    if (parsed.kind !== 'card') {
      if (parsed.kind === 'error') {
        this.entries.set(fileName, { fileName, hash: hashOf(text), parsed: { kind: 'unreadable', message: parsed.message } });
      } else {
        this.entries.delete(fileName);
      }
      this.resolveIds();
      throw parsed.kind === 'error'
        ? new BoardStoreError('unreadable', `Couldn't read this card: ${parsed.message}`)
        : new BoardStoreError('not-found', 'That card is no longer on the board.');
    }
    const copiedFrom = this.provisionalIds.has(fileName) ? parsed.card.id : null;
    let current: Card = { ...parsed.card, id: cardId };
    const at = this.timestamp();
    if (copiedFrom) current = withHistory(current, { at, by: 'you', what: `Copied from ${copiedFrom}` });
    const next = apply(structuredClone(current));
    if (next.id !== cardId) throw new BoardStoreError('invalid', 'A change may not give a card a new id.');
    let changed: Card = { ...next, updated: at };
    if (history) changed = withHistory(changed, { at, ...history });
    const out = serializeCard(changed, parsed.source);
    await this.write(fileName, out);
    this.provisionalIds.delete(fileName);
    this.entries.set(fileName, { fileName, hash: hashOf(out), parsed: { kind: 'card', card: changed } });
    this.resolveIds();
    return changed;
  }

  /**
   * Work out which id each card is shown under. A file copied in Finder or by
   * git carries its original's id; the original keeps it (the file whose name
   * starts with the id, shortest name first) and every copy gets a fresh id,
   * kept stable across re-reads until its next write.
   */
  private resolveIds(): void {
    const filesById = new Map<string, string[]>();
    for (const entry of this.entries.values()) {
      if (entry.parsed.kind !== 'card') continue;
      const list = filesById.get(entry.parsed.card.id) ?? [];
      list.push(entry.fileName);
      filesById.set(entry.parsed.card.id, list);
    }
    const taken = new Set<string>(filesById.keys());
    for (const id of this.provisionalIds.values()) taken.add(id);
    this.byId.clear();
    for (const [id, files] of filesById) {
      const ordered = [...files].sort((a, b) => {
        const aOwn = a.startsWith(`${id}-`) ? 0 : 1;
        const bOwn = b.startsWith(`${id}-`) ? 0 : 1;
        return aOwn - bOwn || a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
      });
      const [original, ...copies] = ordered;
      this.provisionalIds.delete(original);
      this.byId.set(id, original);
      for (const copy of copies) {
        let provisional = this.provisionalIds.get(copy);
        if (!provisional) {
          provisional = mintCardId(taken, this.random);
          taken.add(provisional);
          this.provisionalIds.set(copy, provisional);
        }
        this.byId.set(provisional, copy);
      }
    }
    for (const fileName of [...this.provisionalIds.keys()]) {
      const entry = this.entries.get(fileName);
      if (!entry || entry.parsed.kind !== 'card') this.provisionalIds.delete(fileName);
    }
  }

  private cardEntry(cardId: string): { fileName: string; card: Card; copiedFrom?: string } | null {
    const fileName = this.byId.get(cardId);
    const entry = fileName ? this.entries.get(fileName) : undefined;
    if (!fileName || !entry || entry.parsed.kind !== 'card') return null;
    const copied = this.provisionalIds.has(fileName);
    return {
      fileName,
      card: { ...entry.parsed.card, id: cardId },
      ...(copied ? { copiedFrom: entry.parsed.card.id } : {}),
    };
  }

  private snapshot(): BoardEntry[] {
    const cards: BoardEntry[] = [];
    for (const cardId of this.byId.keys()) {
      const entry = this.cardEntry(cardId);
      if (entry) cards.push({ kind: 'card', ...structuredClone(entry) });
    }
    cards.sort((a, b) => {
      if (a.kind !== 'card' || b.kind !== 'card') return 0;
      const stage = CARD_STAGES.indexOf(a.card.stage) - CARD_STAGES.indexOf(b.card.stage);
      return stage || compareCards(a.card, b.card);
    });
    const unreadable: BoardEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.parsed.kind === 'unreadable') {
        unreadable.push({ kind: 'unreadable', fileName: entry.fileName, message: entry.parsed.message });
      }
    }
    unreadable.sort((a, b) => (a.fileName < b.fileName ? -1 : 1));
    return [...cards, ...unreadable];
  }

  private stageCards(stage: CardStage): Card[] {
    const cards: Card[] = [];
    for (const cardId of this.byId.keys()) {
      const entry = this.cardEntry(cardId);
      if (entry && entry.card.stage === stage) cards.push(entry.card);
    }
    return cards.sort(compareCards);
  }

  /** A rank above every card of the stage; spreads the stage when hand-edited
   *  ranks leave no room. */
  private async topRank(stage: CardStage): Promise<string> {
    const first = this.stageCards(stage)[0];
    const rank = rankBetween(undefined, first?.rank);
    if (rank !== null) return rank;
    return this.spreadStage(stage, 'top');
  }

  /** Rewrite a stage's ranks evenly. With `reserve: 'top'`, the first rank is
   *  kept free and returned. */
  private async spreadStage(stage: CardStage, reserve: 'top' | null): Promise<string> {
    const cards = this.stageCards(stage);
    const ranks = spreadRanks(cards.length + (reserve ? 1 : 0));
    const offset = reserve ? 1 : 0;
    for (const [index, card] of cards.entries()) {
      const rank = ranks[index + offset];
      if (card.rank === rank) continue;
      try {
        await this.rewrite(card.id, null, (current) => ({ ...current, rank }));
      } catch (error) {
        // An unreadable or vanished card keeps its place; the rest still spread.
        if (!(error instanceof BoardStoreError) || error.code === 'write-failed') throw error;
      }
    }
    return ranks[0];
  }

  private async exists(fileName: string): Promise<boolean> {
    try {
      await this.fs.readFile(path.join(this.tasksDir, fileName));
      return true;
    } catch (error) {
      return !isMissing(error);
    }
  }

  private async write(fileName: string, contents: string): Promise<void> {
    const target = path.join(this.tasksDir, fileName);
    const temp = `${target}.tmp-${this.tempId()}`;
    try {
      await this.fs.writeFile(temp, contents);
      await this.fs.rename(temp, target);
    } catch (error) {
      try {
        await this.fs.remove(temp);
      } catch {
        // A leftover temp file is ignored by every reader (it does not end in .md).
      }
      throw new BoardStoreError('write-failed', `Couldn't save ${fileName}: ${messageOf(error)}`, error);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A listener's failure is its own; the store's state is already saved.
      }
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
