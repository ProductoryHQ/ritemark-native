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
 * A card open as a page in the editor (design.md §5) is read and written
 * through its document (`CardDocuments`): only the front matter changes, so a
 * board change never lands as a disk change under the user's unsaved typing.
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
import { ensureProjectSubfolder, isProjectFolderError } from '../projects/projectFolderGuard';
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
  splitCardText,
  spreadRanks,
  withHistory,
  type Card,
  type CardFileProblem,
  type CardStage,
} from './cardFile';
import type { UnreadableReason } from './protocol';

export interface BoardStoreFileSystem extends ConversationStoreFileSystem {
  /** Move a file to the system trash. */
  trash(file: string): Promise<void>;
  /** Rename a card's file; an editor showing it follows (the host moves it
   *  with a workspace edit). */
  move(from: string, to: string): Promise<void>;
}

export const nodeBoardStoreFileSystem: BoardStoreFileSystem = {
  ...nodeConversationStoreFileSystem,
  async trash() {
    throw new Error('No system trash outside VS Code; compose BoardStore with workspace.fs.');
  },
  move: nodeConversationStoreFileSystem.rename,
};

/**
 * Card files open in an editor (the card page). Composed in the host from
 * `vscode.workspace.textDocuments`; absent in tests that need no editor.
 */
export interface CardDocuments {
  /** The open document's text (it may hold unsaved typing); undefined when the
   *  file is not open. */
  openText(file: string): string | undefined;
  /** The open document has unsaved changes. */
  isDirty(file: string): boolean;
  /**
   * Put the board's front matter (`head`, both `---` lines included) into the
   * open document, and its body too when the change touched the description.
   * Saves when the document had no unsaved changes. False when the file is not
   * open (any more): the store then writes the disk.
   */
  write(file: string, change: { head: string; body?: string }): Promise<boolean>;
}

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
  | { kind: 'unreadable'; fileName: string; message: string; reason: UnreadableReason };

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
  /** Card files open in an editor. */
  documents?: CardDocuments;
}

interface CachedEntry {
  fileName: string;
  hash: string;
  parsed:
    | { kind: 'card'; card: Card }
    | { kind: 'unreadable'; message: string; reason: UnreadableReason };
}

/** One file read: its text, gone, or the error that stopped the read. */
type FileRead = { kind: 'text'; text: string } | { kind: 'missing' } | { kind: 'failed'; error: unknown };

/** A re-read made outside the tail, with what it is checked against when it is applied. */
interface QueuedRead {
  ticket: number;
  epoch: number;
  version: number;
  read: FileRead;
}

/** The system trash refused a file the board couldn't read (Remove on its row, Sprint 145, #596). */
export class TrashRefusedError extends BoardStoreError {
  constructor(message: string, cause?: unknown) {
    super('write-failed', message, cause);
    this.name = 'TrashRefusedError';
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Re-reads out of the tail at once, across files (libuv has 4 threads by default; the tail and saves keep the rest). */
const MAX_OUTSIDE_READS = 2;
/** How often a re-read the store overtook is made again before the next watcher event is left to do it. */
const MAX_REREADS = 3;

function isMissing(error: unknown): boolean {
  // `FileNotFound` is what `workspace.fs` (the host's trash) says for a file that is already gone.
  const code = error ? (error as NodeJS.ErrnoException).code : undefined;
  return code === 'ENOENT' || code === 'FileNotFound';
}

/**
 * The sentence a file the board couldn't read shows, said once, in plain words (Sprint 145, #596; experience 41).
 * The error itself goes to the log. A Windows cloud file that isn't on the computer yet fails its read with
 * `UNKNOWN` (patch 011 maps the same case), so it gets the cloud sentence too.
 */
export function readFailureWords(error: unknown): string {
  const { code } = (error ?? {}) as NodeJS.ErrnoException;
  if (isSlowFileError(error)) {
    return 'Ritemark couldn’t open this file in time. If this folder syncs from the cloud, the file may still be downloading.';
  }
  if (code === 'EACCES' || code === 'EPERM') return 'This computer doesn’t let Ritemark open this file.';
  return 'Ritemark couldn’t open this file.';
}

/** A file that didn't answer in time or was busy: what a cloud drive still fetching it gives. */
function isSlowFileError(error: unknown): boolean {
  const { code, syscall } = (error ?? {}) as NodeJS.ErrnoException;
  // EDEADLK: macOS refusing to read an iCloud Drive file that isn't on the Mac yet.
  return code === 'ETIMEDOUT' || code === 'EBUSY' || code === 'EAGAIN' || code === 'EDEADLK' || (code === 'UNKNOWN' && (syscall === 'read' || syscall === 'open'));
}

/**
 * What a card change that couldn't be saved says, naming the card (experience 41, checked in #610). The error code
 * and the path go to the log, not the notice.
 */
export function saveFailedWords(name: string, error: unknown): string {
  const { code } = (error ?? {}) as NodeJS.ErrnoException;
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return `Couldn’t save “${name}”: this computer doesn’t let Ritemark change files in this folder.`;
  }
  if (isSlowFileError(error)) return `Couldn’t save “${name}” in time. If this folder syncs from the cloud, try again in a moment.`;
  return `Couldn’t save “${name}”. Try again in a moment.`;
}

function saveFailed(name: string, fileName: string, error: unknown): BoardStoreError {
  console.warn(`[taskBoard] couldn't save ${fileName}: ${messageOf(error)}`);
  return new BoardStoreError('write-failed', saveFailedWords(name, error), error);
}

/** The sentence a card file whose front matter the board can't use shows (experience 41). */
export function formatProblemWords(problem: CardFileProblem, parserMessage: string): string {
  if (problem === 'yaml') return 'The lines at the top of this file, where the board keeps the card’s title and column, have a mistake.';
  if (problem === 'newer') return 'A newer Ritemark made this card. Update Ritemark to see it.';
  return parserMessage;
}

function unreadableOf(parsed: { message: string; problem: CardFileProblem }): CachedEntry['parsed'] {
  return { kind: 'unreadable', message: formatProblemWords(parsed.problem, parsed.message), reason: parsed.problem === 'newer' ? 'newer' : 'format' };
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function isCardFileName(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('.') && !name.includes('/') && !name.includes('\\');
}

export class BoardStore {
  readonly tasksDir: string;
  /** This store's own id: its change count (`revision`) means something only with it. */
  readonly id = randomUUID();
  private readonly fs: BoardStoreFileSystem;
  private readonly now: () => Date;
  private readonly random: (max: number) => number;
  private readonly tempId: () => string;
  private readonly documents: CardDocuments | null;
  private readonly entries = new Map<string, CachedEntry>();
  /** fileName → the id a copied file is shown under until its next write. */
  private readonly provisionalIds = new Map<string, string>();
  /** effective card id → fileName. */
  private readonly byId = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private mutationTail: Promise<void> = Promise.resolve();
  private loaded = false;
  /**
   * Re-reads happen outside the tail (Sprint 145, #597): a file that hangs (a cloud drive still fetching it) used
   * to hold every move, add and edit until its read gave up. Per file they run one at a time, so they finish in the
   * order they started. A read is applied only while the store hasn't changed that file's entry since it started:
   * `fileVersions` counts the store's own changes to an entry (writes, loads, removals), `epoch` whole reloads.
   * One entry per file name the store has seen. Try again reads at once, beside a read still running, so reads
   * also carry a ticket: one that finishes after a later one was applied changes nothing.
   */
  private readonly fileVersions = new Map<string, number>();
  /** fileName → the re-read running for it, and the one queued after it that every later caller shares. */
  private readonly fileReads = new Map<string, { running: Promise<QueuedRead>; next: Promise<QueuedRead> | null }>();
  /** fileName → the ticket of the last re-read applied. */
  private readonly appliedReads = new Map<string, number>();
  private readTicket = 0;
  /** fileName → a fresh read (Try again, Remove's look) still running: another fresh read of it joins this one. */
  private readonly freshReads = new Map<string, Promise<QueuedRead>>();
  /** Re-reads out of the tail at once, across files: a few hung cloud files can't take every I/O thread. */
  private outsideReads = 0;
  private readonly readWaiters: Array<() => void> = [];
  private epoch = 0;
  /** Counts the store's changes (every `emit`); a snapshot and an answer carry it, so a surface can tell their order. */
  private changes = 0;

  constructor(readonly folderPath: string, dependencies: BoardStoreDependencies = {}) {
    this.tasksDir = path.join(folderPath, ...CARD_FOLDER.split('/'));
    this.fs = dependencies.fileSystem ?? nodeBoardStoreFileSystem;
    this.now = dependencies.now ?? (() => new Date());
    this.random = dependencies.random ?? ((max) => randomInt(max));
    this.tempId = dependencies.tempId ?? (() => randomUUID().slice(0, 8));
    this.documents = dependencies.documents ?? null;
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

  /** `list()`, with the count of the store's changes it includes (Sprint 145, #597: the order of snapshots). */
  listWithRevision(): Promise<{ entries: BoardEntry[]; revision: number }> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      return { entries: this.snapshot(), revision: this.changes };
    });
  }

  /** The count of the store's changes so far: a snapshot with this revision or later includes them. */
  get revision(): number {
    return this.changes;
  }

  get(cardId: string): Promise<Card | null> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const entry = this.cardEntry(cardId);
      return entry ? structuredClone(entry.card) : null;
    });
  }

  /** Absolute path of a card's file (the card page). */
  filePathOf(cardId: string): string | null {
    const fileName = this.byId.get(cardId);
    return fileName ? path.join(this.tasksDir, fileName) : null;
  }

  /** The id a card file is shown under (a copy's provisional id included);
   *  null until the folder is read or when the file is not a card. */
  cardIdOfFile(fileName: string): string | null {
    for (const [id, name] of this.byId) if (name === fileName) return id;
    return null;
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
      const id = mintCardId(taken, this.random);
      let copy = 1;
      let fileName = cardFileName(title.value);
      while (this.entries.has(fileName) || (await this.exists(fileName))) {
        copy += 1;
        fileName = cardFileName(title.value, copy);
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
      // The project's folder must still be there: a recursive mkdir would
      // bring back one that was deleted while it was open (Sprint 134, R13).
      try {
        await ensureProjectSubfolder(this.folderPath, this.tasksDir, { mkdir: (dir) => this.fs.mkdir(dir) });
      } catch (error) {
        if (isProjectFolderError(error)) {
          throw new BoardStoreError('write-failed', `Couldn't save ${fileName}: ${messageOf(error)}`, error);
        }
        throw error;
      }
      await this.write(fileName, text, card.title);
      this.setEntry({ fileName, hash: hashOf(text), parsed: { kind: 'card', card } });
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

  /**
   * Give a card's file the name a new card with its title would get. Make it a
   * task changes an idea's title, and the file kept the idea's name (Windows
   * test, Sprint 130). The file is moved, so an open card page follows; a name
   * another file has gets a number, as for a new card. Nothing happens when
   * the name already fits.
   */
  renameToTitle(cardId: string): Promise<void> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const entry = this.cardEntry(cardId);
      if (!entry) throw new BoardStoreError('not-found', 'That card is no longer on the board.');
      // A copy carrying the same id (not written since) decides by file name
      // which file is the original: a new name could swap them.
      const ownId = this.entries.get(entry.fileName)?.parsed;
      const shared = [...this.entries.values()].some((other) => (
        other.fileName !== entry.fileName && other.parsed.kind === 'card' && ownId?.kind === 'card' && other.parsed.card.id === ownId.card.id
      ));
      if (shared) return;
      // A name that differs only in case is the file itself on a
      // case-insensitive disk (macOS, Windows): it fits.
      const own = (name: string) => name.toLowerCase() === entry.fileName.toLowerCase();
      let copy = 1;
      let fileName = cardFileName(entry.card.title);
      while (!own(fileName) && (this.entries.has(fileName) || (await this.exists(fileName)))) {
        copy += 1;
        fileName = cardFileName(entry.card.title, copy);
      }
      if (own(fileName)) return;
      try {
        await this.fs.move(path.join(this.tasksDir, entry.fileName), path.join(this.tasksDir, fileName));
      } catch (error) {
        throw new BoardStoreError('write-failed', `Couldn't rename ${entry.fileName}: ${messageOf(error)}`, error);
      }
      const cached = this.entries.get(entry.fileName)!;
      const provisional = this.provisionalIds.get(entry.fileName);
      this.dropEntry(entry.fileName);
      this.setEntry({ ...cached, fileName });
      if (provisional) this.provisionalIds.set(fileName, provisional);
      this.resolveIds();
      this.emit();
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
      this.dropEntry(fileName);
      this.resolveIds();
      this.emit();
    });
  }

  /**
   * Move a file the board couldn't read to the system trash (Sprint 145, #596): Remove on its row. Only a bare
   * file name that is an unreadable entry of this board's folder is accepted; anything else is refused and
   * nothing is trashed.
   */
  removeFile(fileName: string): Promise<void> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const entry = isCardFileName(fileName) ? this.entries.get(fileName) : undefined;
      if (!entry || entry.parsed.kind !== 'unreadable') {
        throw new BoardStoreError('not-found', 'That file is not one the board couldn’t read.');
      }
      const file = path.join(this.tasksDir, fileName);
      try {
        await this.fs.trash(file);
      } catch (error) {
        if (!isMissing(error)) throw new TrashRefusedError(`Couldn't move ${fileName} to the trash: ${messageOf(error)}`, error);
      }
      this.dropEntry(fileName);
      this.resolveIds();
      this.emit();
    });
  }

  /** A file of this board listed as one it couldn't read. From the cache: it waits on nothing. */
  isUnreadable(fileName: string): boolean {
    return this.entries.get(fileName)?.parsed.kind === 'unreadable';
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
   * Re-read one file after the watcher saw it change, or when Try again asks (Sprint 145, #596). Returns whether
   * the board changed: the echo of the store's own write (same content), the same failure again and changes to
   * files that are not cards return false.
   *
   * The file is read outside the tail and the result applied under it (Sprint 145, #597): a re-read that hangs
   * holds no move, add or edit of another card. When the store changed that file while it was being read (it
   * wrote, loaded or removed it), what was read may be older than the disk, so the file is read again.
   */
  async invalidate(fileName: string, options: { fresh?: boolean; own?: boolean } = {}, attempt = 1): Promise<boolean> {
    if (!isCardFileName(fileName)) return false;
    // `fresh` (Try again): read now, not after a watcher read of the same file that may be stuck.
    // `own` (Remove's last look): a read of its own that starts at once, without waiting for a free read or sharing
    // an earlier one, so the look's moment always covers a read made for it. One per Remove a person confirms, so
    // it can't take the I/O threads.
    const pending = options.own ? this.startRead(fileName, { waitForSlot: false }) : options.fresh ? this.freshRead(fileName) : this.queueRead(fileName);
    const { ticket, epoch, version, read } = await pending;
    const outcome = await this.serialized(async () => {
      await this.ensureLoaded();
      if (epoch !== this.epoch || version !== (this.fileVersions.get(fileName) ?? 0)) return 'overtaken' as const;
      if ((this.appliedReads.get(fileName) ?? 0) > ticket) return false;
      this.appliedReads.set(fileName, ticket);
      const changed = this.applyRead(fileName, read);
      if (changed) {
        this.resolveIds();
        this.emit();
      }
      return changed;
    });
    // Overtaken: read again, a few times at most (a card the store keeps rewriting gives its own watcher events).
    if (outcome === 'overtaken') return attempt < MAX_REREADS ? this.invalidate(fileName, options, attempt + 1) : false;
    return outcome;
  }

  /** Read the whole folder again (a branch switch, a sync that moved many files). */
  reload(): Promise<void> {
    return this.serialized(async () => {
      this.entries.clear();
      this.epoch += 1;
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
    for (const name of names.filter(isCardFileName).sort()) {
      this.bump(name);
      this.applyRead(name, await this.readFile(name));
    }
    this.resolveIds();
    this.loaded = true;
  }

  /** Read one card file: its text, gone, or why not. Touches no state, so it may run outside the tail. */
  private async readFile(fileName: string): Promise<FileRead> {
    const file = path.join(this.tasksDir, fileName);
    // Unsaved typing on a card page is what the user sees, so the board shows
    // it too. A saved document is read from disk, which is never older.
    const unsaved = this.documents?.isDirty(file) ? this.documents.openText(file) : undefined;
    try {
      return { kind: 'text', text: unsaved ?? (await this.fs.readFile(file)) };
    } catch (error) {
      // A folder whose name ends in .md is no card file: not listed, so Remove never sends a folder to the trash.
      const notAFile = (error as NodeJS.ErrnoException)?.code === 'EISDIR';
      return isMissing(error) || notAFile ? { kind: 'missing' } : { kind: 'failed', error };
    }
  }

  /** Put one file's read into the cache. True when the cache changed. */
  private applyRead(fileName: string, read: FileRead): boolean {
    if (read.kind === 'missing') {
      const had = this.entries.delete(fileName);
      this.provisionalIds.delete(fileName);
      return had;
    }
    if (read.kind === 'failed') {
      // A file that can't be read right now (a cloud drive still fetching it, a
      // permission) is listed as unreadable, like a file that doesn't parse, and
      // the rest of the board still loads. One timed-out OneDrive file used to
      // leave the whole board and the Tasks side bar empty (v1.14.0). The row
      // says what happened in plain words; the error itself goes to the log.
      const message = readFailureWords(read.error);
      const previous = this.entries.get(fileName);
      if (previous?.parsed.kind === 'unreadable' && previous.parsed.reason === 'read' && previous.parsed.message === message) return false;
      console.warn(`[taskBoard] couldn't read ${fileName}: ${messageOf(read.error)}`);
      this.entries.set(fileName, { fileName, hash: `unreadable:${message}`, parsed: { kind: 'unreadable', message, reason: 'read' } });
      this.provisionalIds.delete(fileName);
      return true;
    }
    const hash = hashOf(read.text);
    if (this.entries.get(fileName)?.hash === hash) return false;
    const parsed = parseCardFile(read.text);
    if (parsed.kind === 'not-a-card') {
      const had = this.entries.delete(fileName);
      this.provisionalIds.delete(fileName);
      return had;
    }
    if (parsed.kind === 'error') console.warn(`[taskBoard] ${fileName} is not a card the board can use: ${parsed.message}`);
    this.entries.set(fileName, {
      fileName,
      hash,
      parsed: parsed.kind === 'card' ? { kind: 'card', card: parsed.card } : unreadableOf(parsed),
    });
    return true;
  }

  /**
   * A re-read outside the tail. Per file, one runs at a time and at most one waits after it, shared by every
   * caller that comes meanwhile: a file that hangs is not asked again and again while it is still answering (a
   * sync client can touch it many times), and the read after it still sees what changed since. Each read notes,
   * as it starts, what it is checked against when it is applied.
   */
  private queueRead(fileName: string): Promise<QueuedRead> {
    const run = () => this.startRead(fileName);
    const slot = this.fileReads.get(fileName);
    if (slot) {
      slot.next ??= slot.running.then(run, run);
      return slot.next;
    }
    const entry = { running: run(), next: null as Promise<QueuedRead> | null };
    const settled = () => {
      if (this.fileReads.get(fileName) !== entry) return;
      if (entry.next) {
        entry.running = entry.next;
        entry.next = null;
        entry.running.then(settled, settled);
      } else {
        this.fileReads.delete(fileName);
      }
    };
    this.fileReads.set(fileName, entry);
    entry.running.then(settled, settled);
    return entry.running;
  }

  /** One re-read, started now, noting what it is checked against when it is applied. */
  private async startRead(fileName: string, options: { waitForSlot?: boolean } = {}): Promise<QueuedRead> {
    const counted = options.waitForSlot !== false;
    if (counted) await this.readSlot();
    try {
      const ticket = ++this.readTicket;
      const epoch = this.epoch;
      const version = this.fileVersions.get(fileName) ?? 0;
      return { ticket, epoch, version, read: await this.readFile(fileName) };
    } finally {
      if (counted) {
        this.outsideReads -= 1;
        this.readWaiters.shift()?.();
      }
    }
  }

  /** A fresh read; one already running for the file is shared, so pressing Try again again starts no second one. */
  private freshRead(fileName: string): Promise<QueuedRead> {
    const running = this.freshReads.get(fileName);
    if (running) return running;
    const read = this.startRead(fileName);
    this.freshReads.set(fileName, read);
    const forget = () => {
      if (this.freshReads.get(fileName) === read) this.freshReads.delete(fileName);
    };
    read.then(forget, forget);
    return read;
  }

  private async readSlot(): Promise<void> {
    while (this.outsideReads >= MAX_OUTSIDE_READS) await new Promise<void>((resolve) => this.readWaiters.push(resolve));
    this.outsideReads += 1;
  }

  /** The store's own change to a file's entry: a read made outside the tail before it no longer applies. */
  private bump(fileName: string): void {
    this.fileVersions.set(fileName, (this.fileVersions.get(fileName) ?? 0) + 1);
  }

  private setEntry(entry: CachedEntry): void {
    this.bump(entry.fileName);
    this.entries.set(entry.fileName, entry);
  }

  private dropEntry(fileName: string): void {
    this.bump(fileName);
    this.entries.delete(fileName);
    this.provisionalIds.delete(fileName);
  }

  private async rewrite(
    cardId: string,
    history: { by: string; what: string } | null,
    apply: (card: Card) => Card,
  ): Promise<Card> {
    const fileName = this.byId.get(cardId);
    if (!fileName) throw new BoardStoreError('not-found', 'That card is no longer on the board.');
    const file = path.join(this.tasksDir, fileName);
    // A card open as a page is changed through its document, which may hold
    // typing the disk has not seen yet.
    const open = this.documents?.openText(file);
    let text: string;
    try {
      text = open ?? (await this.fs.readFile(file));
    } catch (error) {
      if (!isMissing(error)) {
        const cached = this.entries.get(fileName)?.parsed;
        throw saveFailed(cached?.kind === 'card' ? cached.card.title : fileName, fileName, error);
      }
      this.dropEntry(fileName);
      this.resolveIds();
      throw new BoardStoreError('not-found', 'That card is no longer on the board.');
    }
    const parsed = parseCardFile(text);
    if (parsed.kind !== 'card') {
      if (parsed.kind === 'error') {
        this.setEntry({ fileName, hash: hashOf(text), parsed: unreadableOf(parsed) });
      } else {
        this.dropEntry(fileName);
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
    const written =
      open !== undefined && (await this.writeOpen(file, out, changed.description !== parsed.card.description, changed.title));
    if (!written) await this.write(fileName, out, changed.title);
    this.provisionalIds.delete(fileName);
    this.setEntry({ fileName, hash: hashOf(out), parsed: { kind: 'card', card: changed } });
    this.resolveIds();
    return changed;
  }

  /**
   * Work out which id each card is shown under. A file copied in Finder or by
   * git carries its original's id; the original keeps it (an older file whose
   * name starts with the id first, then the shortest name, as a Finder copy
   * adds " copy") and every copy gets a fresh id, kept stable across re-reads
   * until its next write.
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
        unreadable.push({ kind: 'unreadable', fileName: entry.fileName, message: entry.parsed.message, reason: entry.parsed.reason });
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

  /** Write through the card's open document; false when it is not open. */
  private async writeOpen(file: string, contents: string, bodyChanged: boolean, title: string): Promise<boolean> {
    const split = splitCardText(contents);
    if (!this.documents || !split) return false;
    try {
      return await this.documents.write(file, bodyChanged ? split : { head: split.head });
    } catch (error) {
      throw saveFailed(title, path.basename(file), error);
    }
  }

  /** Write a card file atomically; `title` names the card if it fails. */
  private async write(fileName: string, contents: string, title: string): Promise<void> {
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
      throw saveFailed(title, fileName, error);
    }
  }

  private emit(): void {
    this.changes += 1;
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
