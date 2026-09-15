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

// ── Sprint 117 (R1/R6): host-minted comment identity rides the item ──
const commentItem = item('E', {
  source: 'comment',
  taskId: 'task-77',
  conversationTurnId: 'host-turn-77',
  sourceDisplayPath: 'docs/notes.md',
});
const qe = enqueueItem({}, commentItem).queues;
const carried = queueFor(qe, 'E')[0];
assert.equal(carried.taskId, 'task-77', 'taskId survives enqueue');
assert.equal(carried.conversationTurnId, 'host-turn-77', 'the host-minted turn id is frozen with the item');
assert.equal(carried.sourceDisplayPath, 'docs/notes.md', 'the source document is frozen, not re-read at drain');

// Reordering/editing must not disturb the frozen identity (R3 capture rule).
let qf = enqueueItem(qe, item('E')).queues;
qf = moveItem(qf, 'E', commentItem.id, 1);
qf = updateItemPrompt(qf, 'E', commentItem.id, 'edited', 'edited full');
const afterOps = queueFor(qf, 'E').find((i) => i.id === commentItem.id)!;
assert.equal(afterOps.taskId, 'task-77');
assert.equal(afterOps.conversationTurnId, 'host-turn-77');
assert.equal(afterOps.sourceDisplayPath, 'docs/notes.md');

// A composer item carries none of it — no synthetic task identity is invented.
const composerItem = queueFor(qd, 'D')[0];
assert.equal(composerItem.taskId, undefined);
assert.equal(composerItem.conversationTurnId, undefined);
assert.equal(composerItem.sourceDisplayPath, undefined);

console.log('promptQueue tests passed.');
