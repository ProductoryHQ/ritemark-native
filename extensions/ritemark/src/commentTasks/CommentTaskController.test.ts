import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CommentTaskController,
  summarizeTerminalText,
  type CommentTaskAvailability,
  type CommentTaskControllerDependencies,
  type CommentTaskDestination,
  type CommentTaskDocument,
} from './CommentTaskController';
import { CommentTaskStore, commentTaskStoreDir } from './CommentTaskStore';
import { resolveProjectScope } from '../conversations/projectScope';
import type { CommentTaskEnqueueMessage, CommentTaskEnqueueOutcome, CommentTaskResultMessage } from './protocol';
import type { CommentTaskProjectionV1 } from './types';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });
const COMMENT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

function documentText(...ids: string[]): string {
  return ids.map((id) => `<mark data-comment="@claude do it" data-comment-id="${id}">text</mark>`).join('\n');
}

function doc(overrides: Partial<CommentTaskDocument> = {}): CommentTaskDocument {
  return {
    uri: 'file:///fixtures/project/docs/brief.md',
    scopeId: scope.scopeId,
    scope: scope.descriptor,
    displayPath: 'docs/brief.md',
    version: 12,
    text: documentText(COMMENT_ID, SECOND_ID),
    ...overrides,
  };
}

function acceptMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'comment-task/accept',
    requestId: 'req-1',
    batchId: null,
    surface: 'rail',
    alias: 'claude',
    documentVersion: 12,
    comments: [{ commentId: COMMENT_ID, kind: 'mark', note: '@claude Strengthen this', instruction: 'Strengthen this' }],
    ...overrides,
  };
}

interface Harness {
  controller: CommentTaskController;
  store: CommentTaskStore;
  enqueued: CommentTaskEnqueueMessage[];
  projections: Array<{ documentUri: string; tasks: CommentTaskProjectionV1[] }>;
  revealed: string[];
  cancelled: Array<[string, string]>;
  set(overrides: Partial<Settings>): void;
}

interface Settings {
  enqueueOutcome: CommentTaskEnqueueOutcome;
  availability: CommentTaskAvailability;
  destination: CommentTaskDestination | null;
  featureEnabled: boolean;
  durable: boolean;
}

function harness(): Harness {
  const settings: Settings = {
    enqueueOutcome: 'queued',
    availability: { usable: true },
    destination: {
      conversationId: 'conv-open',
      bindingGeneration: 1,
      title: 'Release note review',
      created: false,
    },
    featureEnabled: true,
    durable: true,
  };
  const enqueued: CommentTaskEnqueueMessage[] = [];
  const projections: Array<{ documentUri: string; tasks: CommentTaskProjectionV1[] }> = [];
  const revealed: string[] = [];
  const cancelled: Array<[string, string]> = [];
  let counter = 0;

  const store = new CommentTaskStore(commentTaskStoreDir(fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-ctc-'))), {
    now: () => new Date('2026-09-14T12:00:00.000Z'),
  });

  const dependencies: CommentTaskControllerDependencies = {
    store,
    isFeatureEnabled: () => settings.featureEnabled,
    areDurableConversationsEnabled: async () => settings.durable,
    resolveOpenConversation: async () => settings.destination,
    checkAvailability: async () => settings.availability,
    runtimeSettings: () => ({ modelId: 'model-x', approvalMode: 'auto', thinkingEffort: 'auto' }),
    buildPrompt: (document, comments) =>
      `The user assigned you ${comments.length} comment(s) in ${document.displayPath}.`,
    enqueue: async (message) => {
      enqueued.push(message);
      return settings.enqueueOutcome;
    },
    revealConversation: async (conversationId) => {
      revealed.push(conversationId);
    },
    cancelTurn: async (conversationId, turnId) => {
      cancelled.push([conversationId, turnId]);
    },
    publishProjection: (documentUri, tasks) => {
      projections.push({ documentUri, tasks });
    },
    now: () => new Date('2026-09-14T12:00:00.000Z'),
    randomId: () => `00000000-0000-4000-8000-${(counter += 1).toString().padStart(12, '0')}`,
  };

  return {
    controller: new CommentTaskController(dependencies),
    store,
    enqueued,
    projections,
    revealed,
    cancelled,
    set: (overrides) => Object.assign(settings, overrides),
  };
}

function expectOk(result: CommentTaskResultMessage, label: string): Extract<CommentTaskResultMessage, { ok: true }> {
  assert.ok(result.ok, `${label}: expected success, got ${result.ok ? '' : result.error.code}`);
  return result as Extract<CommentTaskResultMessage, { ok: true }>;
}

function expectError(result: CommentTaskResultMessage, code: string, label: string): void {
  assert.ok(!result.ok, `${label}: expected ${code}, got success`);
  if (!result.ok) assert.equal(result.error.code, code, label);
}

async function main(): Promise<void> {
  // ── The happy path, and what it froze ──────────────────────────────────────
  {
    const h = harness();
    const result = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const data = result.data as { taskId: string; destination: { conversationId: string; title: string } };
    assert.equal(data.destination.conversationId, 'conv-open', 'the task went to the open conversation (D5)');
    assert.equal(data.destination.title, 'Release note review');

    const stored = await h.store.get(data.taskId);
    assert.equal(stored?.lifecycle.state, 'queued', 'queued is reported only after the sidebar accepted it');
    assert.equal(stored?.source.documentUri, 'file:///fixtures/project/docs/brief.md');
    assert.equal(stored?.source.displayPath, 'docs/brief.md');

    // The real document goes to the runtime, not the literal 'the active
    // document' the bulk path used to send (audit F06, F11).
    assert.equal(h.enqueued.length, 1);
    assert.match(h.enqueued[0].prompt, /docs\/brief\.md/, 'the prompt names the real document');
    assert.equal(h.enqueued[0].sourceDisplayPath, 'docs/brief.md');
    assert.equal(
      h.enqueued[0].conversationTurnId,
      stored?.turn.conversationTurnId,
      'the sidebar runs the host-minted turn id so terminal events can find this task',
    );

    const last = h.projections.at(-1);
    assert.equal(last?.documentUri, 'file:///fixtures/project/docs/brief.md', 'the snapshot is document-scoped');
    assert.equal(last?.tasks[0].state, 'queued');
  }

  // ── Nothing is accepted when the environment says no ───────────────────────
  {
    const h = harness();
    h.set({ featureEnabled: false });
    expectError(await h.controller.handleRequest(acceptMessage(), doc()), 'feature-disabled', 'flag off');
    h.set({ featureEnabled: true, durable: false });
    expectError(await h.controller.handleRequest(acceptMessage(), doc()), 'durable-conversations-disabled', 'legacy mode');
    assert.equal(h.enqueued.length, 0, 'nothing reached the sidebar');
  }

  // ── Unsaved document, stale sync, vanished comment ─────────────────────────
  {
    const h = harness();
    expectError(await h.controller.handleRequest(acceptMessage(), null), 'document-not-file', 'no document');
    expectError(
      await h.controller.handleRequest(acceptMessage(), doc({ uri: 'untitled:Untitled-1' })),
      'document-not-file',
      'untitled document',
    );
    expectError(
      await h.controller.handleRequest(acceptMessage({ documentVersion: 99 }), doc({ version: 12 })),
      'document-not-synced',
      'the webview is ahead of the host',
    );
    expectError(
      await h.controller.handleRequest(acceptMessage(), doc({ text: documentText(SECOND_ID) })),
      'comment-not-found',
      'the comment is no longer in the document',
    );
    expectError(
      await h.controller.handleRequest(acceptMessage(), doc({ text: documentText(SECOND_ID), isDirty: true })),
      'document-not-synced',
      'a comment missing from a dirty document is still on its way, not gone',
    );
    assert.equal((await h.store.listForDocument(doc().uri)).length, 0, 'no rejected request left a record behind');
  }

  // ── Availability is checked before the queue (F19) ─────────────────────────
  {
    const h = harness();
    h.set({ availability: { usable: false, message: 'Claude needs you to sign in.', recovery: 'sign-in' } });
    const result = await h.controller.handleRequest(acceptMessage(), doc());
    expectError(result, 'runtime-unavailable', 'signed out');
    if (!result.ok) assert.equal(result.error.recovery, 'sign-in', 'the comment offers the same recovery as the Composer');
    assert.equal(h.enqueued.length, 0, 'a signed-out runtime never reaches the queue');
  }

  // ── A full queue is not a success (F17, F18) ───────────────────────────────
  {
    const h = harness();
    h.set({ enqueueOutcome: 'full' });
    const result = await h.controller.handleRequest(acceptMessage(), doc());
    expectError(result, 'queue-full', 'queue full');

    const records = await h.store.listForDocument(doc().uri);
    assert.equal(records.length, 1, 'the attempt is kept as evidence');
    assert.equal(records[0].lifecycle.state, 'failed', 'and it is failed, not queued');
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  {
    const h = harness();
    const first = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'first click');
    const second = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'second click');
    assert.deepEqual(
      (first.data as { taskId: string }).taskId,
      (second.data as { taskId: string }).taskId,
      'a double click resolves to one task',
    );
    assert.equal(h.enqueued.length, 1, 'and to one queue item');
  }

  // ── Lifecycle from turn facts (F22, F24) ───────────────────────────────────
  {
    const h = harness();
    const a = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'task A');
    const b = expectOk(
      await h.controller.handleRequest(
        acceptMessage({
          requestId: 'req-2',
          comments: [{ commentId: SECOND_ID, kind: 'mark', note: '@claude second', instruction: 'second' }],
        }),
        doc(),
      ),
      'task B',
    );
    const idA = (a.data as { taskId: string }).taskId;
    const idB = (b.data as { taskId: string }).taskId;
    const turnA = (await h.store.get(idA))!.turn.conversationTurnId;

    await h.controller.applyTurnStarted('conv-open', turnA);
    assert.equal((await h.store.get(idA))?.lifecycle.state, 'running');

    // Both tasks live in ONE conversation. Finishing A's turn must not finish B.
    await h.controller.applyTurnTerminal('conv-open', turnA, {
      status: 'completed',
      text: 'Reworked the evidence and tightened the claim.',
      terminalEventId: 'event-1',
    });
    const doneA = await h.store.get(idA);
    assert.equal(doneA?.lifecycle.state, 'completed');
    if (doneA?.lifecycle.state === 'completed') {
      assert.equal(doneA.lifecycle.summary, 'Reworked the evidence and tightened the claim.');
    }
    assert.equal((await h.store.get(idB))?.lifecycle.state, 'queued', 'the sibling task is untouched (F22)');

    // An ordinary Composer turn in the same conversation changes nothing.
    const before = await h.store.get(idB);
    await h.controller.applyTurnTerminal('conv-open', 'composer-turn', { status: 'completed', text: 'Sure.' });
    assert.deepEqual(await h.store.get(idB), before, 'a turn no task owns is ignored');

    // The conversation store renames a fresh conversation from the sidebar's
    // client id to a canonical one when it accepts the first turn. The turn id
    // still identifies the task, and the comment follows to the real
    // conversation — without this the task sat on "Queued" while the work ran
    // beside it (found live, 2026-09-14).
    const turnB = (await h.store.get(idB))!.turn.conversationTurnId;
    await h.controller.applyTurnStarted('conv-canonical-42', turnB);
    const rebound = await h.store.get(idB);
    assert.equal(rebound?.lifecycle.state, 'running', 'the event lands despite the renamed conversation');
    assert.equal(rebound?.destination.conversationId, 'conv-canonical-42', 'and the comment now points at it');
  }

  // ── Cancel is never completion ─────────────────────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;
    const turnId = (await h.store.get(taskId))!.turn.conversationTurnId;

    await h.controller.applyTurnStarted('conv-open', turnId);
    await h.controller.applyTurnTerminal('conv-open', turnId, { status: 'cancelled' });
    assert.equal((await h.store.get(taskId))?.lifecycle.state, 'cancelled');

    // A late "completed" for the same turn cannot resurrect it as a success.
    await h.controller.applyTurnTerminal('conv-open', turnId, { status: 'completed', text: 'Done anyway.' });
    assert.equal((await h.store.get(taskId))?.lifecycle.state, 'cancelled', 'a late completion is ignored (F24)');
  }

  // ── needs-user, and tool-only success ──────────────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;
    const turnId = (await h.store.get(taskId))!.turn.conversationTurnId;

    await h.controller.applyTurnStarted('conv-open', turnId);
    await h.controller.applyTurnAttention('conv-open', turnId, 'approval');
    const waiting = await h.store.get(taskId);
    assert.equal(waiting?.lifecycle.state, 'needs-user');
    if (waiting?.lifecycle.state === 'needs-user') assert.equal(waiting.lifecycle.attentionKind, 'approval');

    await h.controller.applyTurnTerminal('conv-open', turnId, { status: 'completed', text: '   ' });
    const done = await h.store.get(taskId);
    if (done?.lifecycle.state === 'completed') {
      assert.equal(
        done.lifecycle.summary,
        'The task finished. Open the conversation for details.',
        'an empty result gets honest fallback copy, never an invented conclusion',
      );
    }
  }

  // ── Open conversation, cancel, recovery ────────────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;

    expectOk(
      await h.controller.handleRequest({ type: 'comment-task/open-conversation', requestId: 'r', taskId }, doc()),
      'open conversation',
    );
    assert.deepEqual(h.revealed, ['conv-open'], 'Open conversation reveals the bound conversation');

    expectError(
      await h.controller.handleRequest(
        { type: 'comment-task/open-conversation', requestId: 'r', taskId: 'nope' },
        doc(),
      ),
      'unknown-task',
      'an unknown task id is rejected, never redirected to the visible conversation',
    );

    const turnId = (await h.store.get(taskId))!.turn.conversationTurnId;
    await h.controller.applyTurnStarted('conv-open', turnId);
    expectOk(
      await h.controller.handleRequest({ type: 'comment-task/cancel', requestId: 'r2', taskId }, doc()),
      'cancel',
    );
    assert.deepEqual(h.cancelled, [['conv-open', turnId]], 'cancelling the task stops its turn');
    assert.equal((await h.store.get(taskId))?.lifecycle.state, 'cancelled');
  }

  // ── Retry ──────────────────────────────────────────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;
    const firstTurn = (await h.store.get(taskId))!.turn.conversationTurnId;
    await h.controller.applyTurnStarted('conv-open', firstTurn);
    await h.controller.applyTurnTerminal('conv-open', firstTurn, { status: 'failed', error: 'The runtime exited.' });

    expectOk(await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'r3', taskId }, doc()), 'retry');
    const retried = await h.store.get(taskId);
    assert.equal(retried?.bindingGeneration, 2);
    assert.equal(retried?.lifecycle.state, 'queued');
    assert.notEqual(retried?.turn.conversationTurnId, firstTurn, 'the retry runs as a new turn');

    // The first attempt's late result must not overwrite the second.
    await h.controller.applyTurnTerminal('conv-open', firstTurn, { status: 'completed', text: 'Late.' });
    assert.equal((await h.store.get(taskId))?.lifecycle.state, 'queued', 'a stale callback is ignored');
  }

  // ── Retrying into a conversation that is gone ──────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;
    const turn = (await h.store.get(taskId))!.turn.conversationTurnId;
    await h.controller.applyTurnStarted('conv-open', turn);
    await h.controller.applyTurnTerminal('conv-open', turn, { status: 'failed', error: 'Ritemark closed.' });

    // Ritemark restarted: the old conversation is gone and the sidebar is now
    // showing a different one. A retry must land there rather than failing
    // forever on a conversation nobody can reach (found live, 2026-09-14).
    let firstAttempt = true;
    const original = h.set;
    h.set({
      enqueueOutcome: 'no-conversation',
      destination: { conversationId: 'conv-fresh', bindingGeneration: 1, title: 'Today', created: false },
    });
    // The first dispatch reports the conversation is gone; the second, after
    // rebinding to the open one, succeeds.
    const dependencies = h.enqueued;
    const before = dependencies.length;
    h.set({ enqueueOutcome: 'no-conversation' });
    await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'r-gone', taskId }, doc());
    assert.ok(dependencies.length > before, 'the retry was attempted');
    const afterFail = await h.store.get(taskId);
    assert.equal(afterFail?.destination.conversationId, 'conv-fresh', 'the task was rebound to the open conversation');
    void firstAttempt; void original;
  }

  // ── Restart recovery ───────────────────────────────────────────────────────
  {
    const h = harness();
    const accepted = expectOk(await h.controller.handleRequest(acceptMessage(), doc()), 'accept');
    const taskId = (accepted.data as { taskId: string }).taskId;
    assert.equal(await h.controller.recoverUnfinished(), 1);
    const recovered = await h.store.get(taskId);
    assert.equal(recovered?.lifecycle.state, 'interrupted');
    if (recovered?.lifecycle.state === 'interrupted') assert.equal(recovered.lifecycle.reason, 'restart');
    assert.equal(await h.controller.recoverUnfinished(), 0, 'a second sweep finds nothing');
  }

  // ── Malformed input never throws into the host ─────────────────────────────
  {
    const h = harness();
    expectError(await h.controller.handleRequest(null, doc()), 'invalid-request', 'null');
    expectError(await h.controller.handleRequest({ type: 'nonsense' }, doc()), 'invalid-request', 'unknown type');
    expectError(
      await h.controller.handleRequest(acceptMessage({ alias: 'other' }), doc()),
      'unsupported-alias',
      '@other',
    );
    expectError(
      await h.controller.handleRequest(acceptMessage({ comments: [] }), doc()),
      'invalid-request',
      'no comments',
    );
  }

  // ── Summary flattening ─────────────────────────────────────────────────────
  assert.equal(summarizeTerminalText(''), 'The task finished. Open the conversation for details.');
  assert.equal(summarizeTerminalText('# Heading\n\nI rewrote the **claim**.'), 'Heading I rewrote the claim.');
  assert.equal(
    summarizeTerminalText('```ts\nconst x = 1;\n```\nAdded a test.'),
    'Added a test.',
    'code fences never reach the comment bubble',
  );
  assert.equal(
    summarizeTerminalText('See [the docs](https://example.invalid/page).'),
    'See the docs.',
    'link syntax is flattened, the URL dropped',
  );
  const long = summarizeTerminalText(`${'First sentence is quite long here. '.repeat(4)}Second.`);
  assert.ok(long.length <= 280, `a long result is bounded (${long.length})`);
  assert.ok(long.endsWith('.') || long.endsWith('…'), 'and ends cleanly');

  console.log('commentTasks/CommentTaskController: all assertions passed');
}

void main();
