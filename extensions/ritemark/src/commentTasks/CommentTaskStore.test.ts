import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CommentTaskStore,
  CommentTaskStoreError,
  MAX_RECORDS,
  TERMINAL_RETENTION_DAYS,
  commentTaskStoreDir,
  type CommentTaskStoreDependencies,
} from './CommentTaskStore';
import { nodeConversationStoreFileSystem, type ConversationStoreFileSystem } from '../conversations/ConversationStore';
import { resolveProjectScope } from '../conversations/projectScope';
import type { CommentTaskRecordV1 } from './types';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });
const SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function record(index: number, overrides: Partial<CommentTaskRecordV1> = {}): CommentTaskRecordV1 {
  return {
    schemaVersion: 1,
    taskId: uuid(index),
    bindingGeneration: 1,
    requestId: `request-${index}`,
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    source: {
      documentUri: 'file:///fixtures/project/docs/policy-brief.md',
      scopeId: scope.scopeId,
      scope: scope.descriptor,
      displayPath: 'docs/policy-brief.md',
      documentVersion: 12,
      contentSha256: SHA,
    },
    comments: [
      {
        commentId: `c-note${index}-x`,
        kind: 'mark',
        note: '@claude Strengthen this',
        instruction: 'Strengthen this',
        anchoredText: 'a single survey',
      },
    ],
    assignment: { alias: 'claude', runtimeId: 'claude-code', surface: 'rail' },
    runtime: { modelId: null, approvalMode: 'auto', planFirst: false, thinkingEffort: 'auto' },
    destination: {
      conversationId: uuid(900 + index),
      bindingGeneration: 1,
      titleSnapshot: 'Release note review',
      created: false,
    },
    turn: { conversationTurnId: `turn-${index}` },
    prompt: { text: 'Work through this comment.', sha256: SHA },
    lifecycle: { state: 'accepting', since: '2026-09-14T10:00:00.000Z' },
    history: [{ state: 'accepting', at: '2026-09-14T10:00:00.000Z', generation: 1 }],
    ...overrides,
  };
}

function tempDir(): string {
  return commentTaskStoreDir(fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-comment-tasks-')));
}

function newStore(overrides: CommentTaskStoreDependencies = {}): CommentTaskStore {
  let counter = 0;
  return new CommentTaskStore(tempDir(), {
    now: () => new Date('2026-09-14T12:00:00.000Z'),
    randomId: () => `id-${(counter += 1)}`,
    ...overrides,
  });
}

async function main(): Promise<void> {
  // ── Create, read back, survive a fresh instance ────────────────────────────
  {
    const dir = tempDir();
    const store = new CommentTaskStore(dir, { now: () => new Date('2026-09-14T12:00:00.000Z') });
    await store.create(record(1));
    const read = await store.get(uuid(1));
    assert.equal(read?.taskId, uuid(1), 'a created task reads back');

    // The point of the store: a new process still sees the task. The old
    // webview-memory registry lost this on every reload (audit F15).
    const reopened = new CommentTaskStore(dir, {});
    assert.equal((await reopened.get(uuid(1)))?.lifecycle.state, 'accepting', 'a fresh store instance sees the task');

    await assert.rejects(
      () => store.create(record(1)),
      (error: CommentTaskStoreError) => error.code === 'already-exists',
      'the same task id cannot be created twice',
    );
  }

  // ── Transitions ────────────────────────────────────────────────────────────
  {
    const store = newStore();
    await store.create(record(2));
    const queued = await store.transition(uuid(2), 1, { state: 'queued', since: '2026-09-14T10:00:01.000Z' });
    assert.equal(queued.lifecycle.state, 'queued');
    assert.equal(queued.history.length, 2, 'the transition is recorded in the history');

    await store.transition(uuid(2), 1, { state: 'running', since: '2026-09-14T10:00:02.000Z' });

    // The bug this exists to prevent: a cancelled turn reported as completion.
    await store.transition(uuid(2), 1, { state: 'cancelled', since: '2026-09-14T10:00:03.000Z' });
    await assert.rejects(
      () =>
        store.transition(uuid(2), 1, {
          state: 'completed',
          since: '2026-09-14T10:00:04.000Z',
          terminalEventId: 'e1',
          summary: 'Done.',
        }),
      (error: CommentTaskStoreError) => error.code === 'illegal-transition',
      'a cancelled task can never be completed in place (F24)',
    );
  }

  // ── Stale generations ──────────────────────────────────────────────────────
  {
    const store = newStore();
    await store.create(record(3));
    await store.transition(uuid(3), 1, { state: 'queued', since: '2026-09-14T10:00:01.000Z' });
    await store.transition(uuid(3), 1, { state: 'running', since: '2026-09-14T10:00:02.000Z' });
    await store.transition(uuid(3), 1, {
      state: 'failed',
      since: '2026-09-14T10:00:03.000Z',
      safeMessage: 'The runtime exited.',
    });

    const retried = await store.retry(uuid(3), 'turn-3b');
    assert.equal(retried.bindingGeneration, 2, 'retry starts a new generation');
    assert.equal(retried.lifecycle.state, 'accepting');
    assert.equal(retried.turn.conversationTurnId, 'turn-3b', 'the retry runs as a new turn');
    assert.ok(
      retried.history.some((entry) => entry.state === 'failed' && entry.generation === 1),
      'the previous failure stays as evidence',
    );

    // A late callback from attempt 1 must not touch attempt 2.
    await assert.rejects(
      () =>
        store.transition(uuid(3), 1, {
          state: 'completed',
          since: '2026-09-14T10:00:05.000Z',
          terminalEventId: 'e-old',
          summary: 'Late result from the first attempt.',
        }),
      (error: CommentTaskStoreError) => error.code === 'stale-generation',
      'a stale callback cannot overwrite the current attempt',
    );

    await assert.rejects(
      () => store.retry(uuid(3), 'turn-3c'),
      (error: CommentTaskStoreError) => error.code === 'illegal-transition',
      'a task that is not finished cannot be retried',
    );
  }

  // ── Repeated same-state events are idempotent ──────────────────────────────
  {
    const store = newStore();
    await store.create(record(4));
    await store.transition(uuid(4), 1, { state: 'queued', since: '2026-09-14T10:00:01.000Z' });
    const again = await store.transition(uuid(4), 1, { state: 'queued', since: '2026-09-14T10:00:09.000Z' });
    assert.equal(again.history.length, 2, 'a duplicate event does not grow the history');
  }

  // ── Document scoping (F10, F13) ────────────────────────────────────────────
  {
    const store = newStore();
    await store.create(record(5));
    await store.create(
      record(6, {
        source: { ...record(6).source, documentUri: 'file:///fixtures/other/docs/policy-brief.md' },
      }),
    );

    const mine = await store.listForDocument('file:///fixtures/project/docs/policy-brief.md');
    assert.deepEqual(mine.map((item) => item.taskId), [uuid(5)], 'only this document’s tasks are listed');

    const scoped = await store.listForDocument('file:///fixtures/project/docs/policy-brief.md', 'ps1-other');
    assert.deepEqual(scoped, [], 'a wrong project scope matches nothing');
  }

  // ── Turn and request lookups ───────────────────────────────────────────────
  {
    const store = newStore();
    await store.create(record(7, { destination: { ...record(7).destination, conversationId: uuid(700) } }));
    await store.create(
      record(8, {
        destination: { ...record(8).destination, conversationId: uuid(700) },
        turn: { conversationTurnId: 'turn-8' },
      }),
    );

    // Two tasks in ONE conversation: a terminal event must resolve to exactly
    // one of them, which is what replaces finalizeCommentTasks (F22).
    const found = await store.findByTurn('turn-8');
    assert.equal(found?.taskId, uuid(8), 'a turn resolves to its own task');
    assert.equal(await store.findByTurn('turn-unknown'), null, 'an unknown turn resolves to nothing');

    // The conversation a task was accepted into can be renamed by the store
    // (client id -> canonical id on the first accepted turn). The turn id still
    // finds the task, and rebinding points the comment at the real conversation.
    const rebound = await store.rebindDestination(uuid(8), {
      conversationId: uuid(701),
      bindingGeneration: 2,
      title: 'Strengthen policy argument',
    });
    assert.equal(rebound.destination.conversationId, uuid(701));
    assert.equal(rebound.destination.titleSnapshot, 'Strengthen policy argument');
    assert.equal(rebound.taskId, uuid(8), 'rebinding never changes task identity');
    assert.equal((await store.findByTurn('turn-8'))?.destination.conversationId, uuid(701));

    const byRequest = await store.findByRequestId('request-7');
    assert.equal(byRequest?.taskId, uuid(7), 'a repeated request resolves to the task it already created');
    assert.equal(await store.findByRequestId('request-none'), null);
  }

  // ── Unfinished sweep ───────────────────────────────────────────────────────
  {
    const store = newStore();
    await store.create(record(9));
    await store.create(
      record(10, {
        lifecycle: {
          state: 'completed',
          since: '2026-09-14T10:00:00.000Z',
          terminalEventId: 'e1',
          summary: 'Done.',
        },
      }),
    );
    const unfinished = await store.listUnfinished();
    assert.deepEqual(unfinished.map((item) => item.taskId), [uuid(9)], 'only unfinished tasks need recovery');
  }

  // ── Rename follows, external move does not ─────────────────────────────────
  {
    const store = newStore();
    await store.create(record(11));
    const moved = await store.renameSource(
      'file:///fixtures/project/docs/policy-brief.md',
      'file:///fixtures/project/docs/brief.md',
      'docs/brief.md',
    );
    assert.equal(moved, 1);
    const after = await store.get(uuid(11));
    assert.equal(after?.source.documentUri, 'file:///fixtures/project/docs/brief.md');
    assert.equal(after?.source.displayPath, 'docs/brief.md', 'the prompt label follows the rename too');
    assert.deepEqual(
      await store.listForDocument('file:///fixtures/project/docs/policy-brief.md'),
      [],
      'the old URI no longer matches',
    );
  }

  // ── Retention ──────────────────────────────────────────────────────────────
  {
    const store = newStore();
    const old = new Date(Date.parse('2026-09-14T12:00:00.000Z') - (TERMINAL_RETENTION_DAYS + 1) * 86_400_000).toISOString();
    await store.create(
      record(12, {
        updatedAt: old,
        lifecycle: { state: 'completed', since: old, terminalEventId: 'e1', summary: 'Old but done.' },
      }),
    );
    await store.create(record(13, { updatedAt: old }));

    const pruned = await store.prune();
    assert.equal(pruned, 1, 'only the old terminal record is swept');
    assert.equal(await store.get(uuid(12)), null, 'the expired record is gone');
    assert.ok(await store.get(uuid(13)), 'an unfinished task is never swept, however old');
  }

  // ── Corruption is quarantined, not lost ────────────────────────────────────
  {
    const dir = tempDir();
    const store = new CommentTaskStore(dir, { now: () => new Date('2026-09-14T12:00:00.000Z') });
    await store.create(record(14));
    fs.writeFileSync(path.join(dir, 'records', `${uuid(14)}.json`), '{ not json', 'utf8');

    assert.equal(await store.get(uuid(14)), null, 'a corrupt record reads as absent rather than throwing');
    const diagnostics = await store.getDiagnostics();
    assert.equal(diagnostics.quarantineCount, 1, 'the bytes were moved aside for diagnosis');
    assert.equal(diagnostics.recordCount, 0);
    assert.ok(fs.readdirSync(path.join(dir, 'quarantine')).some((name) => name.endsWith('.reason.json')));
  }

  // ── A failed write surfaces instead of silently dropping the task ──────────
  {
    const failing: ConversationStoreFileSystem = {
      ...nodeConversationStoreFileSystem,
      async writeFile(file, contents) {
        if (file.includes('records')) {
          const error = new Error('Injected write failure') as NodeJS.ErrnoException;
          error.code = 'ENOSPC';
          throw error;
        }
        await nodeConversationStoreFileSystem.writeFile(file, contents);
      },
    };
    const store = new CommentTaskStore(tempDir(), { fileSystem: failing });
    await assert.rejects(
      () => store.create(record(15)),
      (error: CommentTaskStoreError) => error.code === 'write-failed',
      'a task that could not be persisted is never reported as accepted',
    );
  }

  // ── Invalid records never reach disk ───────────────────────────────────────
  {
    const store = newStore();
    await assert.rejects(
      () => store.create(record(16, { comments: [] })),
      (error: CommentTaskStoreError) => error.code === 'invalid-record',
      'a task with no comments is rejected at the store boundary too',
    );
    await assert.rejects(
      () => store.transition(uuid(99), 1, { state: 'queued', since: '2026-09-14T10:00:01.000Z' }),
      (error: CommentTaskStoreError) => error.code === 'not-found',
      'an unknown task id is rejected, never created on the fly',
    );
  }

  // ── The cap holds ──────────────────────────────────────────────────────────
  {
    const store = newStore();
    for (let index = 0; index < MAX_RECORDS + 5; index += 1) {
      const at = new Date(Date.parse('2026-09-14T00:00:00.000Z') + index * 1000).toISOString();
      await store.create(
        record(1000 + index, {
          updatedAt: at,
          lifecycle: { state: 'completed', since: at, terminalEventId: `e${index}`, summary: 'Done.' },
        }),
      );
    }
    const pruned = await store.prune();
    assert.equal(pruned, 5, 'the five oldest terminal records go when the cap is exceeded');
    assert.equal((await store.getDiagnostics()).recordCount, MAX_RECORDS);
    assert.equal(await store.get(uuid(1000)), null, 'the oldest went first');
    assert.ok(await store.get(uuid(1000 + MAX_RECORDS + 4)), 'the newest stayed');
  }

  console.log('commentTasks/CommentTaskStore: all assertions passed');
}

void main();
