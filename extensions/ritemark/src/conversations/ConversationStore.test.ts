import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ConversationStore,
  ConversationStoreError,
  nodeConversationStoreFileSystem,
  type ConversationStoreFileSystem,
} from './ConversationStore';
import { resolveProjectScope } from './projectScope';
import type { ConversationEventV1 } from './types';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function userEvent(sequence: number, runtimeId: 'codex' | 'claude-code' = 'codex'): ConversationEventV1 {
  return {
    kind: 'user-message',
    eventId: `event-${sequence}`,
    turnId: `turn-${sequence}`,
    sequence,
    occurredAt: new Date(Date.UTC(2026, 7, 22, 10, 0, sequence)).toISOString(),
    runtimeId,
    text: `Message ${sequence}`,
    mode: 'agent',
    attachments: [],
  };
}

function failureFileSystem(shouldFail: (file: string) => boolean): ConversationStoreFileSystem {
  return {
    ...nodeConversationStoreFileSystem,
    async writeFile(file, contents) {
      if (shouldFail(file)) {
        const error = new Error(`Injected write failure: ${file}`) as NodeJS.ErrnoException;
        error.code = 'ENOSPC';
        throw error;
      }
      await nodeConversationStoreFileSystem.writeFile(file, contents);
    },
  };
}

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-conversations-'));
  let nextRandom = 9000;
  const dependencies = {
    now: () => new Date('2026-08-22T12:00:00.000Z'),
    randomId: () => uuid(nextRandom++),
  };

  try {
    const store = new ConversationStore(path.join(temp, 'main'), dependencies);

    await Promise.all(Array.from({ length: 80 }, (_, index) => store.create({
      conversationId: uuid(index + 1),
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: `Conversation ${index + 1}`,
      createdAt: new Date(Date.UTC(2026, 7, 20, 0, index)).toISOString(),
      lastActivityAt: new Date(Date.UTC(2026, 7, 20, 0, index)).toISOString(),
      events: [userEvent(0)],
    })));
    const firstList = await store.list(scope.scopeId);
    assert.equal(firstList.length, 80, 'records are not count-pruned');
    assert.equal(firstList[0].conversationId, uuid(80), 'newest activity sorts first');
    const slotsById = new Map(firstList.map((item) => [item.conversationId, item.identityColorSlot]));
    assert.equal(
      new Set(Array.from({ length: 24 }, (_, index) => slotsById.get(uuid(index + 1)))).size,
      24,
      'every base and variant slot is used before an exact color repeats',
    );
    assert.equal(slotsById.get(uuid(25)), 0, 'palette exhaustion reuses the least-recently active slot');

    fs.rmSync(path.join(temp, 'main', 'index.json'));
    assert.equal((await new ConversationStore(path.join(temp, 'main'), dependencies).list()).length, 80);
    fs.writeFileSync(path.join(temp, 'main', 'index.json'), '{ broken index');
    const afterCorruptIndex = await new ConversationStore(path.join(temp, 'main'), dependencies).list();
    assert.equal(afterCorruptIndex.length, 80);
    assert.ok(
      fs.readdirSync(path.join(temp, 'main', 'quarantine')).some((name) => name.includes('index.json')),
      'corrupt index bytes are quarantined',
    );

    const corruptId = uuid(40);
    fs.writeFileSync(path.join(temp, 'main', 'records', `${corruptId}.json`), '{ broken record');
    const afterCorruptRecord = await new ConversationStore(path.join(temp, 'main'), dependencies).list();
    assert.equal(afterCorruptRecord.length, 80, 'a damaged row does not hide healthy records');
    assert.equal(afterCorruptRecord.find((item) => item.conversationId === corruptId)?.integrity, 'corrupt');
    assert.equal((await new ConversationStore(path.join(temp, 'main'), dependencies).getDiagnostics()).corruptCount, 1);

    let failRecordWrite = false;
    const recordFailureStore = new ConversationStore(path.join(temp, 'record-failure'), {
      ...dependencies,
      fileSystem: failureFileSystem((file) => failRecordWrite && file.includes(`${path.sep}records${path.sep}`)),
    });
    const protectedId = uuid(100);
    await recordFailureStore.create({
      conversationId: protectedId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Protected previous version',
      events: [userEvent(0)],
    });
    failRecordWrite = true;
    await assert.rejects(
      recordFailureStore.checkpoint({
        conversationId: protectedId,
        bindingGeneration: 0,
        expectedRevision: 1,
        title: 'Must not replace previous version',
      }),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'storage',
    );
    failRecordWrite = false;
    assert.equal((await recordFailureStore.get(protectedId))?.title, 'Protected previous version');

    let failRecordRemove = false;
    const deleteFailureStore = new ConversationStore(path.join(temp, 'delete-failure'), {
      ...dependencies,
      fileSystem: {
        ...nodeConversationStoreFileSystem,
        async remove(file) {
          if (failRecordRemove && file.includes(`${path.sep}records${path.sep}`)) {
            const error = new Error(`Injected remove failure: ${file}`) as NodeJS.ErrnoException;
            error.code = 'EACCES';
            throw error;
          }
          await nodeConversationStoreFileSystem.remove(file);
        },
      },
    });
    const deleteFailureId = uuid(104);
    await deleteFailureStore.create({
      conversationId: deleteFailureId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Delete must roll back safely',
    });
    failRecordRemove = true;
    await assert.rejects(
      deleteFailureStore.delete(deleteFailureId, 0),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'storage',
    );
    failRecordRemove = false;
    assert.equal(
      (await deleteFailureStore.get(deleteFailureId))?.title,
      'Delete must roll back safely',
      'failed record removal rolls back the tombstone instead of hiding the conversation',
    );

    let failIndexWrite = false;
    const indexFailureDir = path.join(temp, 'index-failure');
    const indexFailureStore = new ConversationStore(indexFailureDir, {
      ...dependencies,
      fileSystem: failureFileSystem((file) => failIndexWrite && path.basename(file).startsWith('index.json.tmp-')),
    });
    failIndexWrite = true;
    const indexFailureId = uuid(101);
    await indexFailureStore.create({
      conversationId: indexFailureId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Committed without index',
      events: [userEvent(0)],
    });
    assert.equal((await new ConversationStore(indexFailureDir, dependencies).get(indexFailureId))?.title, 'Committed without index');

    const queueStore = new ConversationStore(path.join(temp, 'queue'), dependencies);
    const queueId = uuid(102);
    await queueStore.create({
      conversationId: queueId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Queued',
      events: [userEvent(0)],
    });
    await Promise.all(Array.from({ length: 20 }, (_, index) => queueStore.checkpoint({
      conversationId: queueId,
      bindingGeneration: 0,
      appendEvents: [userEvent(index + 1, index % 2 ? 'claude-code' : 'codex')],
    })));
    const queued = await queueStore.get(queueId);
    assert.equal(queued?.events.length, 21);
    assert.equal(queued?.revision, 21);
    assert.deepEqual(queued?.runtimeSummary, ['codex', 'claude-code']);

    const deleted = await queueStore.delete(queueId, 0);
    assert.equal(await queueStore.get(queueId), null);
    await assert.rejects(
      queueStore.checkpoint({ conversationId: queueId, bindingGeneration: 0, title: 'Late callback' }),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'deleted',
    );
    const createdDuringUndo = await queueStore.create({
      conversationId: uuid(103),
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Created while Undo is available',
    });
    assert.notEqual(createdDuringUndo.identityColorSlot, queued?.identityColorSlot, 'an Undo-reserved color is not reallocated');
    const restored = await queueStore.restore(deleted.undoToken);
    assert.equal(restored.conversationId, queueId);
    assert.equal(restored.bindingGeneration, 1);
    assert.equal(restored.identityColorSlot, queued?.identityColorSlot, 'Undo preserves conversation color identity');
    await assert.rejects(
      queueStore.checkpoint({ conversationId: queueId, bindingGeneration: 0, title: 'Pre-delete generation' }),
      (error: unknown) => error instanceof ConversationStoreError && error.code === 'stale-binding',
    );

    const migrationDir = path.join(temp, 'identity-color-migration');
    const migrationStore = new ConversationStore(migrationDir, dependencies);
    const newerId = uuid(202);
    const olderId = uuid(201);
    await migrationStore.create({
      conversationId: newerId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Newer draft record',
      createdAt: '2026-08-22T11:00:00.000Z',
    });
    await migrationStore.create({
      conversationId: olderId,
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      title: 'Older draft record',
      createdAt: '2026-08-22T10:00:00.000Z',
    });
    for (const conversationId of [newerId, olderId]) {
      const file = path.join(migrationDir, 'records', `${conversationId}.json`);
      const draft = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      delete draft.identityColorSlot;
      fs.writeFileSync(file, JSON.stringify(draft, null, 2));
    }
    fs.rmSync(path.join(migrationDir, 'index.json'));
    const migrated = await new ConversationStore(migrationDir, dependencies).list(scope.scopeId);
    const migratedSlots = new Map(migrated.map((item) => [item.conversationId, item.identityColorSlot]));
    assert.equal(migratedSlots.get(olderId), 0, 'pre-release backfill starts with the oldest conversation');
    assert.equal(migratedSlots.get(newerId), 1, 'pre-release backfill is deterministic by creation time');
    const persistedMigration = JSON.parse(fs.readFileSync(path.join(migrationDir, 'records', `${olderId}.json`), 'utf8')) as Record<string, unknown>;
    assert.equal(persistedMigration.identityColorSlot, 0, 'backfilled identity is persisted atomically');

    console.log('ConversationStore.test.ts: all tests passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
