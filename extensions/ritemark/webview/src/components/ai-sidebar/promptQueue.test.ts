/**
 * Sprint 104 (#162) — prompt queue pure-op tests (spec R1/R3, scenarios ★).
 */
import assert from 'node:assert/strict';
import {
  QUEUE_CAP,
  enqueueItem,
  removeItem,
  updateItemPrompt,
  moveItem,
  markStatus,
  requeueFailed,
  pruneQueues,
  queueFor,
  nextDispatchable,
  isReadyToDrain,
  isQueuePaused,
  type QueueItem,
  type PromptQueues,
} from './promptQueue';

let seq = 0;
function item(conversationId: string, over: Partial<QueueItem> = {}): QueueItem {
  seq += 1;
  return {
    id: `q${seq}`,
    conversationId,
    runtimeId: 'claude-code',
    autonomy: 'auto',
    planFirst: false,
    thinkingEffort: 'auto',
    prompt: `full prompt ${seq}`,
    displayText: `typed ${seq}`,
    source: 'composer',
    status: 'queued',
    createdAt: 1000 + seq,
    ...over,
  };
}

// ── R1: enqueue, order, cap ──
let q: PromptQueues = {};
const a1 = item('A'); const a2 = item('A'); const b1 = item('B');
q = enqueueItem(q, a1).queues;
q = enqueueItem(q, a2).queues;
q = enqueueItem(q, b1).queues;
assert.deepEqual(queueFor(q, 'A').map(i => i.id), [a1.id, a2.id], 'FIFO order per conversation');
assert.deepEqual(queueFor(q, 'B').map(i => i.id), [b1.id], 'isolation: B unaffected by A');
assert.deepEqual(queueFor(q, null), [], 'null conversation reads empty, never falls back');

let full: PromptQueues = {};
for (let i = 0; i < QUEUE_CAP; i++) full = enqueueItem(full, item('C')).queues;
const overflow = enqueueItem(full, item('C'));
assert.equal(overflow.outcome, 'full', 'cap rejects the 11th item');
assert.equal(queueFor(overflow.queues, 'C').length, QUEUE_CAP, 'queue unchanged on overflow');

// ── R4 ops: edit / move / remove ──
q = updateItemPrompt(q, 'A', a2.id, 'edited', 'edited full');
assert.equal(queueFor(q, 'A')[1].displayText, 'edited');
q = moveItem(q, 'A', a2.id, -1);
assert.deepEqual(queueFor(q, 'A').map(i => i.id), [a2.id, a1.id], 'move up reorders');
assert.equal(moveItem(q, 'A', a2.id, -1), q, 'move past the edge is a no-op');
q = removeItem(q, 'A', a1.id);
assert.deepEqual(queueFor(q, 'A').map(i => i.id), [a2.id]);

// ── R3: dispatchable head + status transitions ──
assert.equal(nextDispatchable(q, 'A')?.id, a2.id);
q = markStatus(q, 'A', a2.id, 'sending');
assert.equal(nextDispatchable(q, 'A'), null, 'sending head is not re-dispatchable');
q = markStatus(q, 'A', a2.id, 'failed', 'boom');
assert.equal(queueFor(q, 'A')[0].error, 'boom');
q = requeueFailed(q, 'A', a2.id);
assert.equal(queueFor(q, 'A')[0].status, 'queued', 'retry restores queued');
assert.equal(queueFor(q, 'A')[0].error, undefined);

// ── R3: readiness gating (Sprint 103 states) ──
assert.equal(isReadyToDrain('idle'), true);
assert.equal(isReadyToDrain('done'), true);
for (const s of ['running', 'plan-review', 'waiting-input', 'waiting-approval'] as const) {
  assert.equal(isReadyToDrain(s), false, `${s} blocks draining`);
}
for (const s of ['failed', 'cancelled'] as const) {
  assert.equal(isReadyToDrain(s), false, `${s} pauses, never auto-drains`);
  assert.equal(isQueuePaused(s, 1), true, `${s}+items = paused`);
  assert.equal(isQueuePaused(s, 0), false, 'empty queue is never "paused"');
}
assert.equal(isQueuePaused('idle', 3), false);

// ── prune (closed-thread guard) ──
const pruned = pruneQueues(q, ['B']);
assert.deepEqual(queueFor(pruned, 'A'), [], 'closed thread queue dropped');
assert.equal(queueFor(pruned, 'B').length, 1, 'open thread kept');

// ── capture immutability: enqueued snapshot is never recomputed ──
const frozen = item('D', { runtimeId: 'codex', autonomy: 'ask', planFirst: true });
const qd = enqueueItem({}, frozen).queues;
const got = queueFor(qd, 'D')[0];
assert.equal(got.runtimeId, 'codex');
assert.equal(got.autonomy, 'ask');
assert.equal(got.planFirst, true);

console.log('promptQueue tests passed.');
