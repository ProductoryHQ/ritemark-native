import assert from 'node:assert/strict';
import { buildCommentTaskPrompt, MARKER_PRESERVATION_GUARD } from './commentTaskPrompt';
import type { CommentTaskCommentV1 } from './types';

const DOC = 'docs/notes/release-plan.md';

function mark(overrides: Partial<CommentTaskCommentV1> = {}): CommentTaskCommentV1 {
  return {
    commentId: '11111111-1111-4111-8111-111111111111',
    kind: 'mark',
    note: '@claude Strengthen this',
    instruction: 'Strengthen this',
    anchoredText: 'a single survey',
    ...overrides,
  };
}

function note(overrides: Partial<CommentTaskCommentV1> = {}): CommentTaskCommentV1 {
  return {
    commentId: '22222222-2222-4222-8222-222222222222',
    kind: 'node',
    note: '@codex Check the numbers in the appendix',
    instruction: 'Check the numbers in the appendix',
    ...overrides,
  };
}

// ── One comment ──────────────────────────────────────────────────────────────

const one = buildCommentTaskPrompt(DOC, [mark()]);
assert.ok(one.includes(DOC), 'the real document path is in the prompt');
assert.ok(!one.includes('the active document'), 'the placeholder label is gone (F06)');
assert.ok(one.includes('this comment'), 'one comment is singular');
assert.ok(one.includes('Work through it.'), 'one comment is worked through as "it"');
assert.ok(one.includes(MARKER_PRESERVATION_GUARD), 'the guard rides a single-comment task too (F04)');
assert.ok(one.includes('1. Strengthen this'), 'the instruction is numbered');
assert.ok(
  one.includes('   Comment id: 11111111-1111-4111-8111-111111111111'),
  'the stable id is carried so the agent can reference the exact comment',
);
assert.ok(one.includes('   Anchored to: "a single survey"'), 'the anchored passage is quoted');
assert.ok(!one.includes('standalone note'), 'an anchored mark is not labelled standalone');
assert.equal(one, one.trimEnd(), 'no trailing blank line');

// ── Three comments, document order preserved ─────────────────────────────────

const three = buildCommentTaskPrompt(DOC, [
  mark({ commentId: 'c-aaa-111', instruction: 'First thing' }),
  mark({ commentId: 'c-bbb-222', instruction: 'Second thing', anchoredText: 'the middle passage' }),
  note({ commentId: 'c-ccc-333', instruction: 'Third thing' }),
]);
assert.ok(three.includes('these 3 comments'), 'the count is stated');
assert.ok(three.includes('Work through them in order.'), 'many comments are worked in order');
assert.ok(three.includes(MARKER_PRESERVATION_GUARD), 'the guard is always present');
assert.ok(
  three.indexOf('1. First thing') < three.indexOf('2. Second thing')
    && three.indexOf('2. Second thing') < three.indexOf('3. Third thing'),
  'entries keep the order they were given in',
);
assert.ok(three.includes('   Comment id: c-bbb-222'), 'legacy-format ids survive verbatim');

// ── A standalone note ────────────────────────────────────────────────────────

const standalone = buildCommentTaskPrompt(DOC, [note()]);
assert.ok(
  standalone.includes('   (standalone note — not anchored to specific text)'),
  'a standalone note is marked as such so the agent does not hunt for a passage',
);
assert.ok(!standalone.includes('Anchored to:'), 'a standalone note quotes no passage');
assert.ok(standalone.includes(MARKER_PRESERVATION_GUARD));

// ── An anchored passage that spans blocks ────────────────────────────────────

const multiBlock = buildCommentTaskPrompt(DOC, [
  mark({ anchoredText: 'first fragment second fragment third fragment' }),
]);
assert.ok(
  multiBlock.includes('Anchored to: "first fragment second fragment third fragment"'),
  'the joined multi-block passage is passed through whole',
);

// ── The instruction falls back to the raw note, never to nothing ─────────────

const fallback = buildCommentTaskPrompt(DOC, [mark({ instruction: '', note: '@claude Tighten the intro' })]);
assert.ok(fallback.includes('1. @claude Tighten the intro'));

// ── The guard is present for every shape we build ────────────────────────────

for (const comments of [[mark()], [note()], [mark(), note()], [mark({ anchoredText: undefined })]]) {
  assert.ok(
    buildCommentTaskPrompt(DOC, comments).includes(MARKER_PRESERVATION_GUARD),
    'the marker-preservation guard is unconditional',
  );
}

console.log('commentTasks/commentTaskPrompt: all assertions passed');
