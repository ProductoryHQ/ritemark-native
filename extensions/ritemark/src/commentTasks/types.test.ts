import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALIAS_TO_RUNTIME_ID,
  COMMENT_TASK_ALIASES,
  MAX_COMMENTS_PER_TASK,
  MAX_NOTE_CHARS,
  MAX_SUMMARY_CHARS,
  canTransition,
  decodeCommentTaskCommentsV1,
  decodeCommentTaskLifecycleV1,
  decodeCommentTaskRecordV1,
  isCommentId,
  isTerminalCommentTaskState,
  projectCommentTask,
  summarizeCommentTask,
  type CommentTaskRecordV1,
} from './types';
import { resolveProjectScope } from '../conversations/projectScope';

const scope = resolveProjectScope({ folderUris: ['file:///fixtures/project'], platform: 'darwin' });
const SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function record(overrides: Partial<CommentTaskRecordV1> = {}): CommentTaskRecordV1 {
  return {
    schemaVersion: 1,
    taskId: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
    bindingGeneration: 1,
    requestId: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:03:12.000Z',
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
        commentId: '11111111-1111-4111-8111-111111111111',
        kind: 'mark',
        note: '@claude Strengthen this argument',
        instruction: 'Strengthen this argument',
        anchoredText: 'a single survey from 2024',
      },
    ],
    assignment: { alias: 'claude', runtimeId: 'claude-code', surface: 'rail' },
    runtime: { modelId: 'claude-example', approvalMode: 'auto', planFirst: false, thinkingEffort: 'auto' },
    destination: {
      conversationId: '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b',
      bindingGeneration: 3,
      titleSnapshot: 'Release note review',
      created: false,
    },
    turn: { conversationTurnId: '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c' },
    prompt: { text: 'Work through this comment.', sha256: SHA },
    lifecycle: {
      state: 'completed',
      since: '2026-09-14T10:03:12.000Z',
      terminalEventId: '4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d',
      summary: 'Added a second source and rewrote the sentence.',
    },
    history: [{ state: 'accepting', at: '2026-09-14T10:00:00.000Z', generation: 1 }],
    ...overrides,
  };
}

function rejects(value: unknown, fragment: string, label: string): void {
  assert.throws(
    () => decodeCommentTaskRecordV1(value),
    (error: Error) => {
      assert.match(error.message, new RegExp(fragment), `${label}: unexpected message ${error.message}`);
      return true;
    },
    label,
  );
}

// ── Round trip ───────────────────────────────────────────────────────────────

const decoded = decodeCommentTaskRecordV1(JSON.parse(JSON.stringify(record())));
assert.deepEqual(decoded, record(), 'a valid record round-trips through JSON unchanged');

// ── Alias and runtime agree ──────────────────────────────────────────────────

// The host cannot import webview modules, so the alias list is duplicated. Read
// the webview's source and fail if the two ever drift: a comment assigned to an
// alias the host does not know would be silently unassignable.
const webviewModel = readFileSync(
  join(import.meta.dirname, '..', '..', 'webview', 'src', 'extensions', 'comment', 'commentModel.ts'),
  'utf8',
);
const webviewAliases = /COMMENT_AGENT_ALIASES = \[([^\]]*)\]/.exec(webviewModel);
assert.ok(webviewAliases, 'the webview still declares COMMENT_AGENT_ALIASES');
assert.deepEqual(
  webviewAliases[1].split(',').map((item) => item.trim().replace(/^'|'$/g, '')).filter(Boolean),
  [...COMMENT_TASK_ALIASES],
  'the host alias list matches the webview comment model',
);
for (const alias of COMMENT_TASK_ALIASES) {
  assert.ok(ALIAS_TO_RUNTIME_ID[alias], `${alias} maps to a runtime`);
  // The same mapping exists in the webview as ALIAS_TO_AGENT_ID; drift there
  // would route a comment to the wrong runtime.
  assert.match(
    webviewModel,
    new RegExp(`${alias}:\\s*'${ALIAS_TO_RUNTIME_ID[alias]}'`),
    `the webview maps @${alias} to ${ALIAS_TO_RUNTIME_ID[alias]} too`,
  );
}
rejects(
  record({ assignment: { alias: 'codex', runtimeId: 'claude-code', surface: 'rail' } }),
  'the runtime for @codex',
  'an alias that disagrees with its runtime is rejected',
);

// ── Identity ─────────────────────────────────────────────────────────────────

rejects(record({ taskId: 'not-a-uuid' }), 'taskId must be a UUID', 'a non-UUID task id is rejected');
rejects(record({ bindingGeneration: 0 }), 'bindingGeneration must be at least 1', 'generation 0 is rejected');

assert.ok(isCommentId('11111111-1111-4111-8111-111111111111'), 'a UUID comment id is accepted');
assert.ok(isCommentId('c-abc123-def456'), 'a legacy fallback comment id is accepted');
assert.ok(!isCommentId('c-'), 'a malformed legacy id is rejected');
assert.ok(!isCommentId(''), 'an empty comment id is rejected');

// ── Source binding (R3, D4) ──────────────────────────────────────────────────

rejects(
  record({ source: { ...record().source, documentUri: 'untitled:Untitled-1' } }),
  'documentUri must be a file: URI',
  'an untitled document cannot own a task',
);
rejects(
  record({ source: { ...record().source, contentSha256: 'nope' } }),
  'contentSha256 must be a lowercase hex SHA-256 digest',
  'a malformed content digest is rejected',
);

// ── Comments (R2, D3) ────────────────────────────────────────────────────────

assert.throws(
  () => decodeCommentTaskCommentsV1([], 'comments'),
  /comments must be a non-empty array/,
  'a task with no comments is rejected — this is the commentIds: [] bug (F08)',
);

const duplicate = [
  { commentId: '11111111-1111-4111-8111-111111111111', kind: 'mark', note: '@claude a', instruction: 'a' },
  { commentId: '11111111-1111-4111-8111-111111111111', kind: 'mark', note: '@claude b', instruction: 'b' },
];
assert.throws(
  () => decodeCommentTaskCommentsV1(duplicate, 'comments'),
  /free of duplicate comment ids/,
  'duplicate comment ids inside one task are rejected',
);

assert.throws(
  () =>
    decodeCommentTaskCommentsV1(
      [{ commentId: '11111111-1111-4111-8111-111111111111', kind: 'node', note: '@claude a', instruction: 'a', anchoredText: 'x' }],
      'comments',
    ),
  /anchoredText must be absent for a standalone note/,
  'a standalone note cannot carry anchored text',
);

assert.throws(
  () =>
    decodeCommentTaskCommentsV1(
      Array.from({ length: MAX_COMMENTS_PER_TASK + 1 }, (_, index) => ({
        commentId: `c-bulk${index}-x`,
        kind: 'node',
        note: '@claude a',
        instruction: 'a',
      })),
      'comments',
    ),
  new RegExp(`at most ${MAX_COMMENTS_PER_TASK} comments`),
  'an oversized bulk task is rejected',
);

assert.throws(
  () =>
    decodeCommentTaskCommentsV1(
      [
        {
          commentId: '11111111-1111-4111-8111-111111111111',
          kind: 'mark',
          note: 'x'.repeat(MAX_NOTE_CHARS + 1),
          instruction: 'a',
        },
      ],
      'comments',
    ),
  new RegExp(`at most ${MAX_NOTE_CHARS} characters`),
  'an oversized note is rejected',
);

// ── Lifecycle (R6, D2) ───────────────────────────────────────────────────────

assert.deepEqual(
  decodeCommentTaskLifecycleV1({ state: 'queued', since: '2026-09-14T10:00:00.000Z' }),
  { state: 'queued', since: '2026-09-14T10:00:00.000Z' },
  'a simple state decodes without extra fields',
);

assert.throws(
  () => decodeCommentTaskLifecycleV1({ state: 'needs-user', since: '2026-09-14T10:00:00.000Z' }),
  /attentionKind must be one of approval, question, plan-review/,
  'needs-user without an attention kind is rejected',
);

assert.throws(
  () => decodeCommentTaskLifecycleV1({ state: 'completed', since: '2026-09-14T10:00:00.000Z', terminalEventId: 'e1' }),
  /summary must be a string/,
  'a completion without a summary is rejected — the reply is never invented at render time',
);

assert.throws(
  () =>
    decodeCommentTaskLifecycleV1({
      state: 'completed',
      since: '2026-09-14T10:00:00.000Z',
      terminalEventId: 'e1',
      summary: '   ',
    }),
  /summary must be a non-empty string/,
  'a blank summary is rejected too — "completed" must carry real text',
);

assert.throws(
  () =>
    decodeCommentTaskLifecycleV1({
      state: 'completed',
      since: '2026-09-14T10:00:00.000Z',
      terminalEventId: 'e1',
      summary: 'x'.repeat(MAX_SUMMARY_CHARS + 1),
    }),
  new RegExp(`at most ${MAX_SUMMARY_CHARS} characters`),
  'an oversized summary is rejected',
);

assert.throws(
  () => decodeCommentTaskLifecycleV1({ state: 'interrupted', since: '2026-09-14T10:00:00.000Z', reason: 'because' }),
  /reason must be one of restart, sidebar-unreachable, conversation-deleted, runtime-exited/,
  'an unknown interrupt reason is rejected',
);

// ── Transitions ──────────────────────────────────────────────────────────────

assert.ok(canTransition('accepting', 'queued'), 'accepting → queued');
assert.ok(canTransition('queued', 'running'), 'queued → running');
assert.ok(canTransition('running', 'needs-user'), 'running → needs-user');
assert.ok(canTransition('needs-user', 'completed'), 'needs-user → completed');
assert.ok(!canTransition('accepting', 'running'), 'a task cannot start running before it is queued');
assert.ok(!canTransition('completed', 'running'), 'a terminal state never resumes in place — retry bumps the generation');
assert.ok(!canTransition('cancelled', 'completed'), 'a cancelled task can never report completion (F24)');
assert.ok(!canTransition('queued', 'completed'), 'a queued task cannot complete without running');

for (const state of ['completed', 'failed', 'cancelled', 'interrupted'] as const) {
  assert.ok(isTerminalCommentTaskState(state), `${state} is terminal`);
}
for (const state of ['accepting', 'queued', 'running', 'needs-user'] as const) {
  assert.ok(!isTerminalCommentTaskState(state), `${state} is not terminal`);
}

// ── Projection (R4, R7) ──────────────────────────────────────────────────────

const projection = projectCommentTask(record());
assert.equal(projection.state, 'completed');
assert.equal(projection.summary, 'Added a second source and rewrote the sentence.');
assert.equal(projection.destination.title, 'Release note review', 'the comment can name its destination');
assert.deepEqual(projection.commentIds, ['11111111-1111-4111-8111-111111111111']);
assert.ok(!('prompt' in projection), 'the prompt never reaches the editor webview');
assert.ok(!('history' in projection), 'the history never reaches the editor webview');
assert.ok(projection.safeMessage === undefined, 'a completed task carries no failure text');

const failed = projectCommentTask(
  record({ lifecycle: { state: 'failed', since: '2026-09-14T10:05:00.000Z', safeMessage: 'Claude needs you to sign in.' } }),
);
assert.equal(failed.safeMessage, 'Claude needs you to sign in.');
assert.ok(failed.summary === undefined, 'a failed task shows no completion summary');

const needsUser = projectCommentTask(
  record({ lifecycle: { state: 'needs-user', since: '2026-09-14T10:05:00.000Z', attentionKind: 'approval' } }),
);
assert.equal(needsUser.attentionKind, 'approval');

// ── Index entry ──────────────────────────────────────────────────────────────

assert.deepEqual(summarizeCommentTask(record()), {
  taskId: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
  documentUri: 'file:///fixtures/project/docs/policy-brief.md',
  scopeId: scope.scopeId,
  conversationId: '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b',
  conversationTurnId: '3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c',
  state: 'completed',
  bindingGeneration: 1,
  updatedAt: '2026-09-14T10:03:12.000Z',
});

console.log('commentTasks/types: all assertions passed');
