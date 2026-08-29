import { randomUUID } from 'crypto';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { AgentId } from '../agent/types';
import type { ThinkingEffort } from '../runtime/thinkingEffort';
import {
  allocateConversationIdentityColorSlot,
  isConversationIdentityColorSlot,
  type ConversationIdentityColorOwner,
} from './identityColor';
import { projectScopeId } from './projectScope';
import {
  CONVERSATION_INDEX_VERSION,
  CONVERSATION_SCHEMA_VERSION,
  assertConversationId,
  decodeConversationLifecycleV1,
  decodeConversationRecordV1,
  decodeTombstoneV1,
  summarizeConversationRecord,
  type ConversationCheckpointV1,
  type ConversationCreateInputV1,
  type ConversationDeleteResultV1,
  type ConversationIndexV1,
  type ConversationRecordV1,
  type ConversationStoreDiagnostics,
  type ConversationSummaryV1,
  type ProjectScopeDescriptorV1,
  type RuntimeId,
  type TombstoneV1,
} from './types';

const RECORD_SUFFIX = '.json';
const INDEX_FILE = 'index.json';

export interface ConversationStoreFileSystem {
  mkdir(directory: string): Promise<void>;
  readDir(directory: string): Promise<string[]>;
  readFile(file: string): Promise<string>;
  writeFile(file: string, contents: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(file: string): Promise<void>;
  statSize(file: string): Promise<number>;
}

export const nodeConversationStoreFileSystem: ConversationStoreFileSystem = {
  async mkdir(directory) {
    await fsp.mkdir(directory, { recursive: true });
  },
  async readDir(directory) {
    return fsp.readdir(directory);
  },
  async readFile(file) {
    return fsp.readFile(file, 'utf8');
  },
  async writeFile(file, contents) {
    await fsp.writeFile(file, contents, 'utf8');
  },
  async rename(from, to) {
    await fsp.rename(from, to);
  },
  async remove(file) {
    await fsp.rm(file, { force: true });
  },
  async statSize(file) {
    return (await fsp.stat(file)).size;
  },
};

export interface ConversationStoreDependencies {
  fileSystem?: ConversationStoreFileSystem;
  now?: () => Date;
  randomId?: () => string;
}

export type ConversationStoreErrorCode =
  | 'not-found'
  | 'already-exists'
  | 'deleted'
  | 'stale-revision'
  | 'stale-binding'
  | 'invalid-record'
  | 'storage';

export class ConversationStoreError extends Error {
  constructor(
    readonly code: ConversationStoreErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ConversationStoreError';
  }
}

interface UndoEntry {
  record: ConversationRecordV1;
  tombstone: TombstoneV1;
}

interface ReconcileResult {
  index: ConversationIndexV1;
  corruptCount: number;
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stableSummarySort(a: ConversationSummaryV1, b: ConversationSummaryV1): number {
  return b.lastActivityAt.localeCompare(a.lastActivityAt) || a.conversationId.localeCompare(b.conversationId);
}

function runtimeSummaryFor(record: Pick<ConversationRecordV1, 'events'>): RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const event of record.events) seen.add(event.runtimeId);
  return [...seen];
}

function decodeIndex(value: unknown): ConversationIndexV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('index must be an object');
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== CONVERSATION_INDEX_VERSION || !Array.isArray(input.entries)) {
    throw new Error('unsupported conversation index');
  }
  const entries = input.entries.map((value, index): ConversationSummaryV1 => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`index entry ${index} is invalid`);
    const entry = value as Record<string, unknown>;
    const conversationId = String(entry.conversationId ?? '');
    assertConversationId(conversationId);
    if (entry.integrity !== 'verified' && entry.integrity !== 'corrupt') throw new Error(`index entry ${index} integrity is invalid`);
    if (!Array.isArray(entry.runtimeSummary)) throw new Error(`index entry ${index} runtimes are invalid`);
    const runtimeSummary = entry.runtimeSummary as RuntimeId[];
    if (runtimeSummary.some((runtime) => !['claude-code', 'codex', 'opencode', 'legacy-ritemark'].includes(runtime))) {
      throw new Error(`index entry ${index} runtime is invalid`);
    }
    for (const key of ['scopeId', 'title', 'createdAt', 'lastActivityAt', 'lastVerifiedAt'] as const) {
      if (typeof entry[key] !== 'string') throw new Error(`index entry ${index} ${key} is invalid`);
    }
    if (!Number.isSafeInteger(entry.revision) || !Number.isSafeInteger(entry.bindingGeneration)) {
      throw new Error(`index entry ${index} revision is invalid`);
    }
    if (!isConversationIdentityColorSlot(entry.identityColorSlot)) {
      throw new Error(`index entry ${index} identity color slot is invalid`);
    }
    return {
      conversationId,
      scopeId: entry.scopeId as string,
      title: entry.title as string,
      identityColorSlot: entry.identityColorSlot,
      createdAt: entry.createdAt as string,
      lastActivityAt: entry.lastActivityAt as string,
      revision: entry.revision as number,
      bindingGeneration: entry.bindingGeneration as number,
      lifecycle: decodeConversationLifecycleV1(entry.lifecycle, `index.entries[${index}].lifecycle`),
      runtimeSummary: [...runtimeSummary],
      integrity: entry.integrity,
      lastVerifiedAt: entry.lastVerifiedAt as string,
    };
  });
  return {
    schemaVersion: CONVERSATION_INDEX_VERSION,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date(0).toISOString(),
    entries,
  };
}

export function conversationStoreDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'conversations', 'v1');
}

/**
 * Canonical, file-backed conversation storage.
 *
 * The class deliberately takes a plain path and injected filesystem rather than
 * a VS Code URI. That keeps atomic ordering, reconciliation, and failure paths
 * executable in fast Node tests on every supported platform.
 */
export class ConversationStore {
  private readonly fs: ConversationStoreFileSystem;
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly recordsDir: string;
  private readonly tombstonesDir: string;
  private readonly quarantineDir: string;
  private readonly indexFile: string;
  private mutationTail: Promise<void> = Promise.resolve();
  private initialized = false;
  private lastError: string | null = null;
  private readonly undo = new Map<string, UndoEntry>();

  constructor(readonly baseDir: string, dependencies: ConversationStoreDependencies = {}) {
    this.fs = dependencies.fileSystem ?? nodeConversationStoreFileSystem;
    this.now = dependencies.now ?? (() => new Date());
    this.randomId = dependencies.randomId ?? randomUUID;
    this.recordsDir = path.join(baseDir, 'records');
    this.tombstonesDir = path.join(baseDir, 'tombstones');
    this.quarantineDir = path.join(baseDir, 'quarantine');
    this.indexFile = path.join(baseDir, INDEX_FILE);
  }

  list(scopeId?: string): Promise<ConversationSummaryV1[]> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      return index.entries
        .filter((entry) => scopeId === undefined || entry.scopeId === scopeId)
        .sort(stableSummarySort)
        .map((entry) => ({ ...entry, runtimeSummary: [...entry.runtimeSummary] }));
    });
  }

  get(conversationId: string): Promise<ConversationRecordV1 | null> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      assertConversationId(conversationId);
      if (await this.readTombstone(conversationId)) return null;
      const { index } = await this.reconcile();
      if (index.entries.some((entry) => entry.conversationId === conversationId && entry.integrity === 'corrupt')) {
        return null;
      }
      try {
        return decodeConversationRecordV1(JSON.parse(await this.fs.readFile(this.recordFile(conversationId))));
      } catch (error) {
        if (isMissing(error)) return null;
        await this.quarantine(this.recordFile(conversationId), 'record-read', error);
        await this.reconcile();
        return null;
      }
    });
  }

  create(input: ConversationCreateInputV1): Promise<ConversationRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const conversationId = input.conversationId ?? this.randomId();
      assertConversationId(conversationId);
      if (projectScopeId(input.scope) !== input.scopeId) {
        throw new ConversationStoreError('invalid-record', 'Scope ID does not match its canonical descriptor');
      }
      if (await this.readTombstone(conversationId)) throw new ConversationStoreError('deleted', 'Conversation was deleted');
      if (await this.recordExists(conversationId)) throw new ConversationStoreError('already-exists', 'Conversation already exists');

      const createdAt = input.createdAt ?? this.timestamp();
      const { index } = await this.reconcile();
      const identityColorSlot = allocateConversationIdentityColorSlot(
        this.identityColorOwners(index.entries, input.scopeId),
      );
      const record: ConversationRecordV1 = decodeConversationRecordV1({
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        conversationId,
        scopeId: input.scopeId,
        scope: input.scope,
        title: input.title,
        identityColorSlot,
        createdAt,
        lastActivityAt: input.lastActivityAt ?? createdAt,
        revision: 1,
        bindingGeneration: 0,
        lifecycle: input.lifecycle ?? { state: 'idle' },
        runtimeSummary: runtimeSummaryFor({ events: input.events ?? [] }),
        events: input.events ?? [],
        composerPreferences: input.composerPreferences ?? { thinkingEffortByRuntime: {} },
        ...(input.continuations ? { continuations: input.continuations } : {}),
        ...(input.migration ? { migration: input.migration } : {}),
      });

      await this.writeRecord(record);
      await this.updateIndexBestEffort();
      return record;
    });
  }

  checkpoint(update: ConversationCheckpointV1): Promise<ConversationRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      await this.reconcile();
      assertConversationId(update.conversationId);
      if (await this.readTombstone(update.conversationId)) throw new ConversationStoreError('deleted', 'Conversation was deleted');
      const current = await this.readRecord(update.conversationId);
      if (!current) throw new ConversationStoreError('not-found', 'Conversation does not exist');
      if (current.bindingGeneration !== update.bindingGeneration) {
        throw new ConversationStoreError('stale-binding', 'Conversation binding generation is stale');
      }
      if (update.expectedRevision !== undefined && current.revision !== update.expectedRevision) {
        throw new ConversationStoreError('stale-revision', 'Conversation revision is stale');
      }

      const events = [...current.events, ...(update.appendEvents ?? [])];
      const continuations = { ...(current.continuations ?? {}) };
      if (update.continuationUpdate) {
        const { runtimeId, descriptor } = update.continuationUpdate;
        if (descriptor === null) delete continuations[runtimeId];
        else continuations[runtimeId] = descriptor;
      }
      const next: ConversationRecordV1 = decodeConversationRecordV1({
        ...current,
        title: update.title ?? current.title,
        lifecycle: update.lifecycle ?? current.lifecycle,
        composerPreferences: update.composerPreferences ?? current.composerPreferences,
        events,
        runtimeSummary: runtimeSummaryFor({ events }),
        revision: current.revision + 1,
        lastActivityAt: this.timestamp(),
        ...(Object.keys(continuations).length > 0 ? { continuations } : { continuations: undefined }),
      });

      await this.writeRecord(next);
      await this.updateIndexBestEffort();
      return next;
    });
  }

  /**
   * Persist the latest Composer preference atomically. Range input can emit
   * several changes before an earlier disk write completes, so this mutation
   * must read and merge the record inside the store's serialization boundary.
   */
  setComposerThinkingEffort(input: {
    conversationId: string;
    scopeId: string;
    bindingGeneration: number;
    agentId: AgentId;
    thinkingEffort: ThinkingEffort;
  }): Promise<ConversationRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      await this.reconcile();
      assertConversationId(input.conversationId);
      if (await this.readTombstone(input.conversationId)) {
        throw new ConversationStoreError('deleted', 'Conversation was deleted');
      }
      const current = await this.readRecord(input.conversationId);
      if (!current) throw new ConversationStoreError('not-found', 'Conversation does not exist');
      if (current.scopeId !== input.scopeId) {
        throw new ConversationStoreError('not-found', 'Conversation does not belong to the current project');
      }
      if (current.bindingGeneration !== input.bindingGeneration) {
        throw new ConversationStoreError('stale-binding', 'Conversation binding generation is stale');
      }

      const next = decodeConversationRecordV1({
        ...current,
        composerPreferences: {
          thinkingEffortByRuntime: {
            ...current.composerPreferences.thinkingEffortByRuntime,
            [input.agentId]: input.thinkingEffort,
          },
        },
        revision: current.revision + 1,
        // Draft controls are not conversation activity and must not reorder
        // the user's recent-chat rail.
        lastActivityAt: current.lastActivityAt,
      });

      await this.writeRecord(next);
      await this.updateIndexBestEffort();
      return next;
    });
  }

  delete(conversationId: string, bindingGeneration: number): Promise<ConversationDeleteResultV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      await this.reconcile();
      assertConversationId(conversationId);
      const existingTombstone = await this.readTombstone(conversationId);
      if (existingTombstone) throw new ConversationStoreError('deleted', 'Conversation was already deleted');
      const record = await this.readRecord(conversationId);
      if (!record) throw new ConversationStoreError('not-found', 'Conversation does not exist');
      if (record.bindingGeneration !== bindingGeneration) {
        throw new ConversationStoreError('stale-binding', 'Conversation binding generation is stale');
      }

      const deletedAt = this.timestamp();
      const tombstone: TombstoneV1 = {
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        conversationId,
        scopeId: record.scopeId,
        deletedGeneration: bindingGeneration,
        deletedAt,
      };
      await this.atomicWrite(this.tombstoneFile(conversationId), JSON.stringify(tombstone, null, 2));
      const undoToken = this.randomId();
      try {
        await this.fs.remove(this.recordFile(conversationId));
      } catch (error) {
        try {
          await this.fs.remove(this.tombstoneFile(conversationId));
        } catch (rollbackError) {
          throw this.storageError(
            `Could not remove conversation ${conversationId} or roll back its tombstone`,
            rollbackError,
          );
        }
        throw this.storageError(`Could not remove conversation ${conversationId}`, error);
      }
      // Each actionable native notification keeps its own process-lifetime
      // token. Dismissing that notification releases its record via dismissUndo.
      this.undo.set(undoToken, { record, tombstone });
      await this.updateIndexBestEffort();
      return { conversationId, undoToken, deletedAt };
    });
  }

  restore(undoToken: string, expectedScopeId?: string): Promise<ConversationRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const entry = this.undo.get(undoToken);
      if (!entry) throw new ConversationStoreError('not-found', 'Undo token is unknown or expired');
      if (expectedScopeId !== undefined && entry.record.scopeId !== expectedScopeId) {
        throw new ConversationStoreError('not-found', 'Undo token does not belong to the current project');
      }
      const tombstone = await this.readTombstone(entry.record.conversationId);
      if (!tombstone || tombstone.deletedGeneration !== entry.tombstone.deletedGeneration) {
        throw new ConversationStoreError('stale-binding', 'Delete generation no longer matches');
      }
      const restored = decodeConversationRecordV1({
        ...entry.record,
        revision: entry.record.revision + 1,
        bindingGeneration: entry.record.bindingGeneration + 1,
      });
      await this.writeRecord(restored);
      try {
        await this.fs.remove(this.tombstoneFile(restored.conversationId));
      } catch (error) {
        throw this.storageError(`Could not remove tombstone for ${restored.conversationId}`, error);
      }
      this.undo.delete(undoToken);
      await this.updateIndexBestEffort();
      return restored;
    });
  }

  dismissUndo(undoToken: string): void {
    this.undo.delete(undoToken);
  }

  moveScope(
    conversationId: string,
    bindingGeneration: number,
    expectedSourceScopeId: string,
    destinationScopeId: string,
    destinationScope: ProjectScopeDescriptorV1,
  ): Promise<ConversationRecordV1> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index } = await this.reconcile();
      assertConversationId(conversationId);
      if (projectScopeId(destinationScope) !== destinationScopeId) {
        throw new ConversationStoreError('invalid-record', 'Destination scope ID does not match its canonical descriptor');
      }
      const current = await this.readRecord(conversationId);
      if (!current || current.scopeId !== expectedSourceScopeId) {
        throw new ConversationStoreError('not-found', 'Conversation does not belong to the expected source project');
      }
      if (current.bindingGeneration !== bindingGeneration) {
        throw new ConversationStoreError('stale-binding', 'Conversation binding generation is stale');
      }

      const destinationOwners = this.identityColorOwners(index.entries, destinationScopeId)
        .filter((entry) => entry.conversationId !== conversationId);
      const identityColorSlot = destinationOwners.some(
        (entry) => entry.identityColorSlot === current.identityColorSlot,
      )
        ? allocateConversationIdentityColorSlot(destinationOwners)
        : current.identityColorSlot;
      const moved = decodeConversationRecordV1({
        ...current,
        scopeId: destinationScopeId,
        scope: destinationScope,
        identityColorSlot,
        revision: current.revision + 1,
        // Native provider identities are project-bound. Moving a recovered
        // conversation preserves transcript history but never its bindings.
        continuations: undefined,
      });
      await this.writeRecord(moved);
      await this.updateIndexBestEffort();
      return moved;
    });
  }

  getDiagnostics(): Promise<ConversationStoreDiagnostics> {
    return this.serialized(async () => {
      await this.ensureInitialized();
      const { index, corruptCount } = await this.reconcile();
      const tombstones = (await this.safeReadDir(this.tombstonesDir)).filter((name) => name.endsWith(RECORD_SUFFIX));
      const quarantine = await this.safeReadDir(this.quarantineDir);
      let totalBytes = 0;
      for (const directory of [this.baseDir, this.recordsDir, this.tombstonesDir, this.quarantineDir]) {
        for (const name of await this.safeReadDir(directory)) {
          try {
            totalBytes += await this.fs.statSize(path.join(directory, name));
          } catch {
            // A concurrently changed diagnostics file does not invalidate counts.
          }
        }
      }
      return {
        recordCount: index.entries.filter((entry) => entry.integrity === 'verified').length,
        tombstoneCount: tombstones.length,
        corruptCount,
        quarantineCount: quarantine.filter((name) => !name.endsWith('.reason.json')).length,
        totalBytes,
        degraded: this.lastError !== null || corruptCount > 0,
        lastError: this.lastError,
        baseDir: this.baseDir,
      };
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private identityColorOwners(
    entries: readonly ConversationSummaryV1[],
    scopeId: string,
  ): Array<ConversationIdentityColorOwner & { conversationId: string }> {
    const live = entries
      .filter((entry) => entry.scopeId === scopeId && entry.integrity === 'verified')
      .map((entry) => ({
        conversationId: entry.conversationId,
        identityColorSlot: entry.identityColorSlot,
        lastActivityAt: entry.lastActivityAt,
      }));
    const undoReserved = Array.from(this.undo.values())
      .map((entry) => entry.record)
      .filter((record) => record.scopeId === scopeId)
      .map((record) => ({
        conversationId: record.conversationId,
        identityColorSlot: record.identityColorSlot,
        lastActivityAt: record.lastActivityAt,
      }));
    return [...live, ...undoReserved];
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    for (const directory of [this.baseDir, this.recordsDir, this.tombstonesDir, this.quarantineDir]) {
      await this.fs.mkdir(directory);
    }
    await this.migrateMissingIdentityColorSlots();
    await this.reconcile();
    this.initialized = true;
  }

  /**
   * Sprint 109 records created before persisted colors did not have a slot. The
   * release has not shipped that draft schema, so this is a narrow pre-release
   * backfill: validate every legacy-shaped record, allocate deterministically
   * within its project, and atomically rewrite only the missing field.
   */
  private async migrateMissingIdentityColorSlots(): Promise<void> {
    const tombstonedIds = new Set(
      (await this.safeReadDir(this.tombstonesDir))
        .filter((name) => name.endsWith(RECORD_SUFFIX))
        .map((name) => name.slice(0, -RECORD_SUFFIX.length)),
    );
    const assignedByScope = new Map<string, ConversationIdentityColorOwner[]>();
    const missing: ConversationRecordV1[] = [];
    const names = (await this.safeReadDir(this.recordsDir))
      .filter((name) => name.endsWith(RECORD_SUFFIX) && !name.includes('.tmp-'))
      .sort();

    for (const name of names) {
      const conversationId = name.slice(0, -RECORD_SUFFIX.length);
      if (tombstonedIds.has(conversationId)) continue;
      const file = path.join(this.recordsDir, name);
      try {
        const parsed = JSON.parse(await this.fs.readFile(file));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const input = parsed as Record<string, unknown>;
        const needsSlot = input.identityColorSlot === undefined;
        const record = decodeConversationRecordV1(needsSlot ? { ...input, identityColorSlot: 0 } : input);
        if (record.conversationId !== conversationId) continue;
        if (needsSlot) {
          missing.push(record);
        } else {
          const owners = assignedByScope.get(record.scopeId) ?? [];
          owners.push(record);
          assignedByScope.set(record.scopeId, owners);
        }
      } catch {
        // Reconcile owns corruption handling and quarantine diagnostics.
      }
    }

    missing.sort((a, b) => (
      a.createdAt.localeCompare(b.createdAt)
      || a.conversationId.localeCompare(b.conversationId)
    ));
    for (const record of missing) {
      const owners = assignedByScope.get(record.scopeId) ?? [];
      const migrated: ConversationRecordV1 = {
        ...record,
        identityColorSlot: allocateConversationIdentityColorSlot(owners),
      };
      await this.writeRecord(migrated);
      owners.push(migrated);
      assignedByScope.set(migrated.scopeId, owners);
    }
  }

  private async reconcile(): Promise<ReconcileResult> {
    const previous = await this.readIndex();
    const previousEntries = new Map(previous.entries.map((entry) => [entry.conversationId, entry]));
    const verified: ConversationSummaryV1[] = [];
    const damaged = new Map(
      previous.entries.filter((entry) => entry.integrity === 'corrupt').map((entry) => [entry.conversationId, entry]),
    );
    let corruptCount = damaged.size;

    const names = (await this.safeReadDir(this.recordsDir))
      .filter((name) => name.endsWith(RECORD_SUFFIX) && !name.includes('.tmp-'))
      .sort();
    for (const name of names) {
      const file = path.join(this.recordsDir, name);
      const inferredId = name.slice(0, -RECORD_SUFFIX.length);
      if (await this.readTombstone(inferredId)) continue;
      try {
        const record = decodeConversationRecordV1(JSON.parse(await this.fs.readFile(file)));
        if (record.conversationId !== inferredId) throw new Error('record id does not match filename');
        verified.push(summarizeConversationRecord(record, this.timestamp()));
        damaged.delete(record.conversationId);
      } catch (error) {
        corruptCount += 1;
        const prior = previousEntries.get(inferredId);
        if (prior) damaged.set(inferredId, { ...prior, integrity: 'corrupt' });
        await this.quarantine(file, 'record-reconcile', error);
      }
    }

    const index: ConversationIndexV1 = {
      schemaVersion: CONVERSATION_INDEX_VERSION,
      updatedAt: this.timestamp(),
      entries: [...verified, ...damaged.values()].sort(stableSummarySort),
    };
    await this.writeIndexBestEffort(index);
    return { index, corruptCount };
  }

  private async readIndex(): Promise<ConversationIndexV1> {
    try {
      return decodeIndex(JSON.parse(await this.fs.readFile(this.indexFile)));
    } catch (error) {
      if (!isMissing(error)) await this.quarantine(this.indexFile, 'index-read', error);
      return { schemaVersion: CONVERSATION_INDEX_VERSION, updatedAt: this.timestamp(), entries: [] };
    }
  }

  private async updateIndexBestEffort(): Promise<void> {
    await this.reconcile();
  }

  private async writeIndexBestEffort(index: ConversationIndexV1): Promise<void> {
    try {
      await this.atomicWrite(this.indexFile, JSON.stringify(index, null, 2));
      this.lastError = null;
    } catch (error) {
      this.lastError = `Index update failed: ${messageOf(error)}`;
    }
  }

  private async writeRecord(record: ConversationRecordV1): Promise<void> {
    try {
      await this.atomicWrite(this.recordFile(record.conversationId), JSON.stringify(record, null, 2));
    } catch (error) {
      throw this.storageError(`Could not save conversation ${record.conversationId}`, error);
    }
  }

  private async readRecord(conversationId: string): Promise<ConversationRecordV1 | null> {
    try {
      return decodeConversationRecordV1(JSON.parse(await this.fs.readFile(this.recordFile(conversationId))));
    } catch (error) {
      if (isMissing(error)) return null;
      await this.quarantine(this.recordFile(conversationId), 'record-read', error);
      throw new ConversationStoreError('invalid-record', `Conversation ${conversationId} is corrupt`, error);
    }
  }

  private async readTombstone(conversationId: string): Promise<TombstoneV1 | null> {
    try {
      return decodeTombstoneV1(JSON.parse(await this.fs.readFile(this.tombstoneFile(conversationId))));
    } catch (error) {
      if (isMissing(error)) return null;
      await this.quarantine(this.tombstoneFile(conversationId), 'tombstone-read', error);
      throw new ConversationStoreError('invalid-record', `Tombstone ${conversationId} is corrupt`, error);
    }
  }

  private async recordExists(conversationId: string): Promise<boolean> {
    try {
      await this.fs.readFile(this.recordFile(conversationId));
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
        // The original bytes are already safe; a missing sidecar is diagnostic-only.
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

  private recordFile(conversationId: string): string {
    return path.join(this.recordsDir, `${conversationId}${RECORD_SUFFIX}`);
  }

  private tombstoneFile(conversationId: string): string {
    return path.join(this.tombstonesDir, `${conversationId}${RECORD_SUFFIX}`);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private storageError(message: string, cause: unknown): ConversationStoreError {
    this.lastError = `${message}: ${messageOf(cause)}`;
    return new ConversationStoreError('storage', message, cause);
  }
}
