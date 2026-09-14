import assert from 'node:assert/strict';
import {
  CommentTaskProtocolError,
  commentTaskError,
  commentTaskFailure,
  commentTaskSuccess,
  decodeCommentTaskRequest,
  decodeCommentTaskSidebarMessage,
  isCommentTaskRequest,
} from './protocol';
import { MAX_COMMENTS_PER_TASK } from './types';

function acceptRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'comment-task/accept',
    requestId: 'req-1',
    batchId: null,
    surface: 'rail',
    alias: 'claude',
    documentVersion: 12,
    comments: [
      {
        commentId: '11111111-1111-4111-8111-111111111111',
        kind: 'mark',
        note: '@claude Strengthen this',
        instruction: 'Strengthen this',
        anchoredText: 'a single survey',
      },
    ],
    ...overrides,
  };
}

function rejectsWith(value: unknown, code: string, label: string): void {
  assert.throws(
    () => decodeCommentTaskRequest(value),
    (error: CommentTaskProtocolError) => {
      assert.equal(error.code, code, `${label}: got ${error.code} — ${error.message}`);
      return true;
    },
    label,
  );
}

// ── Accept ───────────────────────────────────────────────────────────────────

const accepted = decodeCommentTaskRequest(acceptRequest());
assert.equal(accepted.type, 'comment-task/accept');
if (accepted.type === 'comment-task/accept') {
  assert.equal(accepted.alias, 'claude');
  assert.equal(accepted.surface, 'rail');
  assert.equal(accepted.comments.length, 1);
  assert.equal(accepted.batchId, null);
}

// The webview cannot choose where the work lands: the destination is the
// conversation open in the sidebar, resolved by the host (D5). A field here
// would let a guessed id retarget someone else's conversation.
const withDestination = decodeCommentTaskRequest(
  acceptRequest({ destination: { conversationId: 'someone-elses-conversation' } }),
);
assert.ok(!('destination' in withDestination), 'a destination sent by the webview is ignored, not honoured');

const bulk = decodeCommentTaskRequest(acceptRequest({ batchId: 'batch-1', surface: 'menu' }));
if (bulk.type === 'comment-task/accept') {
  assert.equal(bulk.batchId, 'batch-1', 'a bulk send is grouped so results can be reported per agent');
  assert.equal(bulk.surface, 'menu');
}

// ── Rejections ───────────────────────────────────────────────────────────────

rejectsWith(acceptRequest({ comments: [] }), 'invalid-request', 'an empty comment list is the old commentIds: [] bug');
rejectsWith(acceptRequest({ alias: 'other' }), 'unsupported-alias', '@other never becomes a task');
rejectsWith(acceptRequest({ alias: 'Claude' }), 'unsupported-alias', 'aliases are matched exactly as the collector parses them');
rejectsWith(acceptRequest({ surface: 'toolbar' }), 'invalid-request', 'an unknown surface is rejected');
rejectsWith(acceptRequest({ requestId: '' }), 'invalid-request', 'a blank request id is rejected');
rejectsWith(acceptRequest({ documentVersion: -1 }), 'invalid-request', 'a negative document version is rejected');
rejectsWith(acceptRequest({ documentVersion: 'twelve' }), 'invalid-request', 'a non-numeric document version is rejected');

rejectsWith(
  acceptRequest({
    comments: [
      {
        commentId: '11111111-1111-4111-8111-111111111111',
        kind: 'mark',
        note: '@claude',
        instruction: '   ',
      },
    ],
  }),
  'empty-instruction',
  'a comment that is only a mention carries no task',
);

rejectsWith(
  acceptRequest({
    comments: [
      { commentId: '11111111-1111-4111-8111-111111111111', kind: 'mark', note: '@claude a', instruction: 'a' },
      { commentId: '11111111-1111-4111-8111-111111111111', kind: 'mark', note: '@claude b', instruction: 'b' },
    ],
  }),
  'duplicate-comment-id',
  'duplicate ids are named as such so the UI can say what to do',
);

rejectsWith(
  acceptRequest({
    comments: Array.from({ length: MAX_COMMENTS_PER_TASK + 1 }, (_, index) => ({
      commentId: `c-bulk${index}-x`,
      kind: 'node',
      note: '@claude a',
      instruction: 'a',
    })),
  }),
  'payload-too-large',
  'an oversized bulk send is rejected as too large, not as malformed',
);

rejectsWith({ type: 'comment-task/nonsense', requestId: 'r' }, 'invalid-request', 'an unknown type is rejected');
rejectsWith(null, 'invalid-request', 'null is rejected');
rejectsWith('accept', 'invalid-request', 'a string is rejected');
rejectsWith([], 'invalid-request', 'an array is rejected');

// ── Task-scoped requests ─────────────────────────────────────────────────────

for (const type of ['comment-task/open-conversation', 'comment-task/retry', 'comment-task/cancel'] as const) {
  const request = decodeCommentTaskRequest({ type, requestId: 'req-2', taskId: 'task-1' });
  assert.equal(request.type, type);
  if ('taskId' in request) assert.equal(request.taskId, 'task-1');
  rejectsWith({ type, requestId: 'req-2' }, 'invalid-request', `${type} without a task id is rejected`);
}

const preview = decodeCommentTaskRequest({ type: 'comment-task/destination-preview', requestId: 'req-3' });
assert.equal(preview.type, 'comment-task/destination-preview');

assert.ok(isCommentTaskRequest({ type: 'comment-task/accept' }), 'a comment-task message is recognised');
assert.ok(!isCommentTaskRequest({ type: 'agent-execute' }), 'other host traffic is not claimed');
assert.ok(!isCommentTaskRequest(undefined));

// ── Sidebar messages ─────────────────────────────────────────────────────────

assert.deepEqual(
  decodeCommentTaskSidebarMessage({ type: 'comment-task/enqueue-result', taskId: 'task-1', outcome: 'full' }),
  { type: 'comment-task/enqueue-result', taskId: 'task-1', outcome: 'full' },
  'a full queue is a first-class outcome, not a silent success (audit F17)',
);
assert.deepEqual(
  decodeCommentTaskSidebarMessage({ type: 'comment-task/dequeued', taskId: 'task-1' }),
  { type: 'comment-task/dequeued', taskId: 'task-1' },
);
assert.throws(
  () => decodeCommentTaskSidebarMessage({ type: 'comment-task/enqueue-result', taskId: 't', outcome: 'maybe' }),
  /outcome must be queued, full or no-conversation/,
);
assert.throws(() => decodeCommentTaskSidebarMessage({ type: 'something-else' }), CommentTaskProtocolError);

// ── Errors carry recovery ────────────────────────────────────────────────────

const queueFull = commentTaskError('queue-full', 'This conversation already has ten queued prompts.');
assert.equal(queueFull.retryable, true);
assert.equal(queueFull.recovery, 'retry');

const notFile = commentTaskError('document-not-file', 'Save this document before sending comments to an agent.');
assert.equal(notFile.retryable, false, 'an unsaved document is not fixed by pressing Send again');
assert.equal(notFile.recovery, 'save-document');

const signIn = commentTaskError('runtime-unavailable', 'Claude needs you to sign in.', 'sign-in');
assert.equal(signIn.recovery, 'sign-in', 'the availability policy supplies the specific recovery');

const alias = commentTaskError('unsupported-alias', 'Only @claude, @codex, @opencode can be assigned a comment');
assert.equal(alias.recovery, 'none');
assert.equal(alias.retryable, false);

// ── Result envelopes ─────────────────────────────────────────────────────────

const success = commentTaskSuccess('req-1', 'comment-task/accept', {
  taskId: 'task-1',
  state: 'queued',
  destination: { conversationId: 'conv-1', title: 'Release note review', created: false },
});
assert.equal(success.ok, true);
assert.equal(success.requestId, 'req-1', 'the answer is correlated to its request');

const failure = commentTaskFailure('req-1', 'comment-task/accept', queueFull);
assert.equal(failure.ok, false);
if (!failure.ok) assert.equal(failure.error.code, 'queue-full');

console.log('commentTasks/protocol: all assertions passed');
