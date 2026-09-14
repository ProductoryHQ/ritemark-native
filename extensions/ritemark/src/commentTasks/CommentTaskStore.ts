/**
 * CommentTaskStore — durable home for comment-task records (Sprint 117, #292).
 *
 * Before this store the ledger was a module-global object inside the editor
 * webview, keyed only by comment id: it crossed documents, vanished on reload,
 * and could not answer "what happened to this comment?" after a restart
 * (audit F13–F16). Records now live on disk beside the conversation store, and
 * the host answers that question from them.
 *
 * Deliberately the same shape as `../conversations/ConversationStore.ts`: a
 * plain base path plus an injected filesystem, one serialized mutation tail,
 * tmp-then-rename writes, and quarantine instead of deletion for anything that
 * fails to decode. That store is the proven pattern for this problem in this
 * codebase; a second, cleverer one would only be a second thing to debug.
 *
 * The store enforces two invariants nothing above it may bypass:
 *   - transitions follow `COMMENT_TASK_TRANSITIONS`, so a cancelled task can
 *     never be reported as completed (audit F24);
 *   - a transition must name the binding generation it belongs to, so a late
 *     callback from a previous attempt is rejected as stale (R6).
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D1, D2, D4)
 */

import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  nodeConversationStoreFileSystem,
  type ConversationStoreFileSystem,
} from '../conversations/ConversationStore';
import {
  COMMENT_TASK_SCHEMA_VERSION,
  MAX_HISTORY_ENTRIES,
  canTransition,
  decodeCommentTaskRecordV1,
  isTerminalCommentTaskState,
  summarizeCommentTask,
  type CommentTaskIndexEntryV1,
  type CommentTaskLifecycleV1,
  type CommentTaskRecordV1,
} from './types';

const RECORD_SUFFIX = '.json';
const INDEX_FILE = 'index.json';

/** Terminal records are swept 30 days after they finished (D4). Long enough to
 *  reopen last month's document and still see what the agent did; short enough
 *  that the store does not grow without bound. */
export const TERMINAL_RETENTION_DAYS = 30;
/** Hard cap regardless of age — oldest terminal records go first. */
export const MAX_RECORDS = 500;

export function commentTaskStoreDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'comment-tasks', 'v1');
}

export type CommentTaskStoreErrorCode =
  | 'not-found'
  | 'already-exists'
  | 'invalid-record'
  | 'stale-generation'
  | 'illegal-transition'
  | 'write-failed';

export class CommentTaskStoreError extends Error {
  constructor(
    readonly code: CommentTaskStoreErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CommentTaskStoreError';
  }
}

export interface CommentTaskStoreDiagnostics {
  recordCount: number;
  quarantineCount: number;
  corruptCount: number;
  totalBytes: number;
  degraded: boolean;
  lastError: string | null;
  baseDir: string;
}

export interface CommentTaskStoreDependencies {
  fileSystem?: ConversationStoreFileSystem;
  now?: () => Date;
  randomId?: () => string;
}

interface StoredIndex {
  schemaVersion: number;
  entries: CommentTaskIndexEntryV1[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissing(error: unknown): boolean {
  return Boolean(error) && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export class CommentTaskStore {
  private readonly fs: ConversationStoreFileSystem;
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly recordsDir: string;
  private readonly quarantineDir: string;
  private readonly indexFile: string;
  private mutationTail: Promise<void> = Promise.resolve();
  private initialized = false;
  private lastError: string | null = null;

  constructor(readonly baseDir: string, dependencies: CommentTaskStoreDependencies = {}) {
    this.fs = dependencies.fileSystem ?? nodeConversationStoreFileSystem;
    this.now = dependencies.now ?? (() => new Date());
    this.randomId = dependencies.randomId ?? randomUUID;
    this.recordsDir = path.join(baseDir, 'records');
    this.quarantineDir = path.join(baseDir, 'quarantine');
    this.indexFile = path.join(baseDir, INDEX_FILE);
  }

  /**
   * Persist a newly accepted task. The caller has already validated the
   * request, resolved the destination and minted the ids; the store's job is to
   * make the record durable BEFORE anyone is told the task was queued, so a
   * crash between acknowledgment and dispatch leaves evidence rather than a
   * comment stuck on "Sending…" forever (R5).
   */
  create(record: CommentTaskRecordV1): Promise<CommentTaskRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const validated = this.validate(record);
      if (await this.recordExists(validated.taskId)) {
        throw new CommentTaskStoreError('already-exists', `Comment task ${validated.taskId} already exists`);
      }
      await this.writeRecord(validated);
      await this.updateIndexBestEffort();
      return validated;
    });
  }

  get(taskId: string): Promise<CommentTaskRecordV1 | null> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      return this.readRecord(taskId);
    });
  }

  /**
   * Every task bound to one document, newest first. This is what an editor
   * webview gets when it becomes ready; the document URI is canonical, so two
   * windows holding same-named files in different projects never see each
   * other's tasks (audit F10, F13).
   */
  listForDocument(documentUri: string, scopeId?: string): Promise<CommentTaskRecordV1[]> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      const matches = index.entries.filter(
        (entry) => entry.documentUri === documentUri && (scopeId === undefined || entry.scopeId === scopeId),
      );
      const records: CommentTaskRecordV1[] = [];
      for (const entry of matches) {
        const record = await this.readRecord(entry.taskId);
        if (record) records.push(record);
      }
      return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  /** Idempotency (R5): a double click or a retried response resolves to the
   *  task the first request already created instead of a second one. */
  findByRequestId(requestId: string): Promise<CommentTaskRecordV1 | null> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      for (const taskId of await this.listTaskIds()) {
        const record = await this.readRecord(taskId);
        if (record?.requestId === requestId) return record;
      }
      return null;
    });
  }

  /**
   * The task owning one conversation turn, if any. This is the lookup that
   * replaces `finalizeCommentTasks`: a terminal event resolves to exactly one
   * task instead of every running task in the conversation (audit F22).
   */
  findByTurn(conversationId: string, conversationTurnId: string): Promise<CommentTaskRecordV1 | null> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      const entry = index.entries.find(
        (candidate) =>
          candidate.conversationId === conversationId && candidate.conversationTurnId === conversationTurnId,
      );
      return entry ? this.readRecord(entry.taskId) : null;
    });
  }

  /** Every non-terminal task, for the activation sweep that turns work
   *  abandoned by a crash into an honest `interrupted` (R5). */
  listUnfinished(): Promise<CommentTaskRecordV1[]> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      const records: CommentTaskRecordV1[] = [];
      for (const entry of index.entries.filter((candidate) => !isTerminalCommentTaskState(candidate.state))) {
        const record = await this.readRecord(entry.taskId);
        if (record) records.push(record);
      }
      return records;
    });
  }

  /**
   * Move one task to its next state. `bindingGeneration` is the caller's claim
   * about which attempt it observed; a mismatch means the event belongs to a
   * previous attempt and is rejected rather than applied to the current one.
   */
  transition(
    taskId: string,
    bindingGeneration: number,
    lifecycle: CommentTaskLifecycleV1,
    note?: string,
  ): Promise<CommentTaskRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const current = await this.requireRecord(taskId);
      if (current.bindingGeneration !== bindingGeneration) {
        throw new CommentTaskStoreError(
          'stale-generation',
          `Comment task ${taskId} is at generation ${current.bindingGeneration}, not ${bindingGeneration}`,
        );
      }
      if (current.lifecycle.state === lifecycle.state) {
        // Re-announcing the same state (a duplicate queue event, a second
        // attention callback) is not an error and must not grow the history.
        return current;
      }
      if (!canTransition(current.lifecycle.state, lifecycle.state)) {
        throw new CommentTaskStoreError(
          'illegal-transition',
          `Comment task ${taskId} cannot go from ${current.lifecycle.state} to ${lifecycle.state}`,
        );
      }
      const next = this.validate({
        ...current,
        updatedAt: this.timestamp(),
        lifecycle,
        history: this.appendHistory(current, lifecycle, bindingGeneration, note),
      });
      await this.writeRecord(next);
      await this.updateIndexBestEffort();
      return next;
    });
  }

  /**
   * Start a fresh attempt at a finished task. The previous outcome stays in the
   * history so the evidence is not lost, but only the new generation projects —
   * which is why the user never sees two replies on one comment (R7).
   */
  retry(taskId: string, conversationTurnId: string): Promise<CommentTaskRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const current = await this.requireRecord(taskId);
      if (!isTerminalCommentTaskState(current.lifecycle.state)) {
        throw new CommentTaskStoreError(
          'illegal-transition',
          `Comment task ${taskId} is still ${current.lifecycle.state} and cannot be retried`,
        );
      }
      const generation = current.bindingGeneration + 1;
      const at = this.timestamp();
      const lifecycle: CommentTaskLifecycleV1 = { state: 'accepting', since: at };
      const next = this.validate({
        ...current,
        bindingGeneration: generation,
        updatedAt: at,
        turn: { conversationTurnId },
        lifecycle,
        history: this.appendHistory(current, lifecycle, generation, 'retry'),
      });
      await this.writeRecord(next);
      await this.updateIndexBestEffort();
      return next;
    });
  }

  /**
   * Follow an in-app rename or move (D4). Nothing else follows a document: an
   * external move leaves the task bound to the old URI, where it stops
   * projecting and expires by retention rather than guessing at a new home.
   */
  renameSource(fromDocumentUri: string, toDocumentUri: string, displayPath: string): Promise<number> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      const affected = index.entries.filter((entry) => entry.documentUri === fromDocumentUri);
      let moved = 0;
      for (const entry of affected) {
        const record = await this.readRecord(entry.taskId);
        if (!record) continue;
        await this.writeRecord(
          this.validate({
            ...record,
            updatedAt: this.timestamp(),
            source: { ...record.source, documentUri: toDocumentUri, displayPath },
          }),
        );
        moved += 1;
      }
      if (moved > 0) await this.updateIndexBestEffort();
      return moved;
    });
  }

  /** Retention sweep (D4): terminal records older than the window, then the
   *  oldest terminal records above the cap. Unfinished work is never swept. */
  prune(): Promise<number> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      const cutoff = this.now().getTime() - TERMINAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const terminal = index.entries
        .filter((entry) => isTerminalCommentTaskState(entry.state))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

      const doomed = new Set<string>();
      for (const entry of terminal) {
        if (Date.parse(entry.updatedAt) < cutoff) doomed.add(entry.taskId);
      }
      // Then the cap, oldest terminal first. Unfinished tasks count toward the
      // total but are never swept — losing running work to make room would be
      // exactly the dishonesty this sprint exists to remove.
      let overflow = index.entries.length - doomed.size - MAX_RECORDS;
      for (const entry of terminal) {
        if (overflow <= 0) break;
        if (doomed.has(entry.taskId)) continue;
        doomed.add(entry.taskId);
        overflow -= 1;
      }
      for (const taskId of doomed) {
        try {
          await this.fs.remove(this.recordFile(taskId));
        } catch (error) {
          if (!isMissing(error)) this.lastError = `Prune failed for ${taskId}: ${messageOf(error)}`;
        }
      }
      if (doomed.size > 0) await this.updateIndexBestEffort();
      return doomed.size;
    });
  }

  getDiagnostics(): Promise<CommentTaskStoreDiagnostics> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index, corruptCount } = await this.reconcile();
      const quarantine = await this.safeReadDir(this.quarantineDir);
      let totalBytes = 0;
      for (const directory of [this.baseDir, this.recordsDir, this.quarantineDir]) {
        for (const name of await this.safeReadDir(directory)) {
          try {
            totalBytes += await this.fs.statSize(path.join(directory, name));
          } catch {
            // A file that changed while we counted does not invalidate the rest.
          }
        }
      }
      return {
        recordCount: index.entries.length,
        quarantineCount: quarantine.filter((name) => !name.endsWith('.reason.json')).length,
        corruptCount,
        totalBytes,
        degraded: this.lastError !== null || corruptCount > 0,
        lastError: this.lastError,
        baseDir: this.baseDir,
      };
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private appendHistory(
    current: CommentTaskRecordV1,
    lifecycle: CommentTaskLifecycleV1,
    generation: number,
    note?: string,
  ): CommentTaskRecordV1['history'] {
    const entry = { state: lifecycle.state, at: lifecycle.since, generation, ...(note ? { note } : {}) };
    const history = [...current.history, entry];
    // The tail is what matters; an old accepting/queued pair is not worth
    // failing a write over once a task has been retried many times.
    return history.length > MAX_HISTORY_ENTRIES ? history.slice(history.length - MAX_HISTORY_ENTRIES) : history;
  }

  private validate(record: CommentTaskRecordV1): CommentTaskRecordV1 {
    try {
      return decodeCommentTaskRecordV1(record);
    } catch (error) {
      throw new CommentTaskStoreError('invalid-record', messageOf(error), error);
    }
  }

  private async requireRecord(taskId: string): Promise<CommentTaskRecordV1> {
    const record = await this.readRecord(taskId);
    if (!record) throw new CommentTaskStoreError('not-found', `Comment task ${taskId} was not found`);
    return record;
  }

  private async readRecord(taskId: string): Promise<CommentTaskRecordV1 | null> {
    try {
      return decodeCommentTaskRecordV1(JSON.parse(await this.fs.readFile(this.recordFile(taskId))));
    } catch (error) {
      if (isMissing(error)) return null;
      // Unreadable bytes are moved aside, not deleted: a corrupt record is
      // evidence about a bug, and the user's comments are unaffected either way.
      await this.quarantine(this.recordFile(taskId), 'record-read', error);
      return null;
    }
  }

  private async writeRecord(record: CommentTaskRecordV1): Promise<void> {
    try {
      await this.atomicWrite(this.recordFile(record.taskId), JSON.stringify(record, null, 2));
    } catch (error) {
      this.lastError = `Write failed for ${record.taskId}: ${messageOf(error)}`;
      throw new CommentTaskStoreError('write-failed', this.lastError, error);
    }
  }

  private async listTaskIds(): Promise<string[]> {
    return (await this.safeReadDir(this.recordsDir))
      .filter((name) => name.endsWith(RECORD_SUFFIX) && !name.includes('.tmp-'))
      .map((name) => name.slice(0, -RECORD_SUFFIX.length));
  }

  /**
   * The index is a cache, never the truth: it is rebuilt from the record files
   * on every read so a partially written or hand-edited index cannot make a
   * task disappear.
   */
  private async reconcile(): Promise<{ index: StoredIndex; corruptCount: number }> {
    const entries: CommentTaskIndexEntryV1[] = [];
    let corruptCount = 0;
    for (const taskId of await this.listTaskIds()) {
      const record = await this.readRecord(taskId);
      if (record) entries.push(summarizeCommentTask(record));
      else corruptCount += 1;
    }
    entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { index: { schemaVersion: COMMENT_TASK_SCHEMA_VERSION, entries }, corruptCount };
  }

  private async updateIndexBestEffort(): Promise<void> {
    try {
      const { index } = await this.reconcile();
      await this.atomicWrite(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      // Records are the truth; a stale index costs a directory scan, not data.
      this.lastError = `Index update failed: ${messageOf(error)}`;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    for (const directory of [this.baseDir, this.recordsDir, this.quarantineDir]) {
      await this.fs.mkdir(directory);
    }
    this.initialized = true;
  }

  private async recordExists(taskId: string): Promise<boolean> {
    try {
      await this.fs.readFile(this.recordFile(taskId));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      return true;
    }
  }

  private async atomicWrite(target: string, contents: string): Promise<void> {
    const temp = `${target}.tmp-${this.randomId()}`;
    await this.fs.writeFile(temp, contents);
    await this.fs.rename(temp, target);
  }

  private async quarantine(source: string, reason: string, error: unknown): Promise<void> {
    const name = `${this.timestamp().replace(/[:.]/g, '-')}-${this.randomId()}-${path.basename(source)}`;
    const destination = path.join(this.quarantineDir, name);
    try {
      await this.fs.rename(source, destination);
      try {
        await this.atomicWrite(
          `${destination}.reason.json`,
          JSON.stringify({ reason, error: messageOf(error), quarantinedAt: this.timestamp() }, null, 2),
        );
      } catch {
        // The bytes are already safe; the sidecar is diagnostics only.
      }
    } catch (quarantineError) {
      this.lastError = `Quarantine failed for ${path.basename(source)}: ${messageOf(quarantineError)}`;
    }
  }

  private async safeReadDir(directory: string): Promise<string[]> {
    try {
      return await this.fs.readDir(directory);
    } catch (error) {
      if (isMissing(error)) return [];
      this.lastError = `Directory read failed for ${directory}: ${messageOf(error)}`;
      return [];
    }
  }

  private recordFile(taskId: string): string {
    return path.join(this.recordsDir, `${taskId}${RECORD_SUFFIX}`);
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
