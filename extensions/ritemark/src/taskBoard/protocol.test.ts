import assert from 'node:assert/strict';
import { BoardProtocolError, decodeBoardRequest, isBoardRequest } from './protocol';

function rejects(value: unknown, pattern: RegExp, code: 'invalid-request' | 'payload-too-large' = 'invalid-request'): void {
  assert.throws(
    () => decodeBoardRequest(value),
    (error: unknown) => error instanceof BoardProtocolError && error.code === code && pattern.test(error.message),
    JSON.stringify(value).slice(0, 120),
  );
}

function main(): void {
  // ── Valid requests decode to exactly their fields ──────────────────────────
  assert.deepEqual(decodeBoardRequest({ type: 'board/ready', surface: 'sidebar' }), { type: 'board/ready', surface: 'sidebar' });
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/add', requestId: 'r1', title: 'Call Maria', stage: 'todo' }),
    { type: 'board/add', requestId: 'r1', title: 'Call Maria', stage: 'todo' },
  );
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/give', requestId: 'r2', cardId: 'k3f9x2', runtimeId: 'codex', force: true }),
    { type: 'board/give', requestId: 'r2', cardId: 'k3f9x2', runtimeId: 'codex', force: true },
  );
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/update', requestId: 'r3', cardId: 'k3f9x2', doneWhen: '', files: ['a.md'] }),
    { type: 'board/update', requestId: 'r3', cardId: 'k3f9x2', doneWhen: '', files: ['a.md'] },
  );
  assert.deepEqual(decodeBoardRequest({ type: 'board/set-wip', requestId: 'r4', limit: null }), { type: 'board/set-wip', requestId: 'r4', limit: null });
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/move', requestId: 'r5', cardId: 'k3f9x2', stage: 'doing', beforeCardId: 'a1b2c3' }),
    { type: 'board/move', requestId: 'r5', cardId: 'k3f9x2', stage: 'doing', beforeCardId: 'a1b2c3' },
  );
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/open-as-document', fileName: 'b0rk3n-broken.md' }),
    { type: 'board/open-as-document', fileName: 'b0rk3n-broken.md' },
  );
  assert.deepEqual(
    decodeBoardRequest({ type: 'board/follow-up', requestId: 'r6', cardId: 'k3f9x2', text: 'Shorter', runtimeId: undefined }),
    { type: 'board/follow-up', requestId: 'r6', cardId: 'k3f9x2', text: 'Shorter' },
    'an undefined optional field is the same as a missing one',
  );

  // ── Anything else is refused by name ───────────────────────────────────────
  rejects(null, /must be an object/);
  rejects({ type: 'board/explode' }, /known board request/);
  rejects({ type: 'board/add', requestId: 'r', title: 'T' }, /stage is required/);
  rejects({ type: 'board/add', requestId: 'r', title: 'T', stage: 'review' }, /stage must be one of/);
  rejects({ type: 'board/add', requestId: 'r', title: 'T', stage: 'todo', extra: 1 }, /extra is not part of board\/add/);
  rejects({ type: 'board/give', requestId: 'r', cardId: 'K3F9X2', runtimeId: 'codex' }, /cardId must be a card id/);
  rejects({ type: 'board/give', requestId: 'r', cardId: 'k3f9x2', runtimeId: 'gpt' }, /runtimeId must be one of/);
  rejects({ type: 'board/give', requestId: 'r', cardId: 'k3f9x2', runtimeId: 'codex', force: 'yes' }, /force must be true or false/);
  rejects({ type: 'board/set-wip', requestId: 'r', limit: 7 }, /limit must be 1–6 or null/);
  rejects({ type: 'board/set-wip', requestId: 'r', limit: 0 }, /limit must be 1–6 or null/);
  rejects({ type: 'board/answer', requestId: 'r', cardId: 'k3f9x2', optionIndex: -1 }, /option number/);
  rejects({ type: 'board/open-as-document' }, /exactly one of cardId or fileName/);
  rejects({ type: 'board/open-as-document', cardId: 'k3f9x2', fileName: 'k3f9x2-a.md' }, /exactly one/);
  rejects({ type: 'board/open-as-document', fileName: '../escape.md' }, /card file name/);
  rejects({ type: 'board/follow-up', requestId: 'r', cardId: 'k3f9x2', text: 'x'.repeat(300 * 1024) }, /too long/, 'payload-too-large');
  rejects({ type: 'board/recover', action: 'format-disk' }, /known recovery/);
  rejects({ type: 'board/ready', surface: 'sidebar', requestId: 'r' }, /requestId is not part of board\/ready/);

  assert.equal(isBoardRequest({ type: 'board/ready' }), true);
  assert.equal(isBoardRequest({ type: 'comment-task/accept' }), false);
  assert.equal(isBoardRequest({ type: 'toString' }), false, 'prototype keys are not request types');

  console.log('taskBoard/protocol: all assertions passed');
}

main();
