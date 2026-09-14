/**
 * The ONE comment-task prompt builder (Sprint 117, D8).
 *
 * Before this, two surfaces built two different prompts: the Comments menu
 * emitted ordered structured entries but hardcoded the literal string
 * `the active document` (audit F06), while the margin rail wrote prose around a
 * single anchored range and omitted the marker-preservation guard entirely, so
 * a single-comment task could ask an agent to delete its own source marker
 * (audit F04, F05). Both are retired: the host builds every prompt here, from
 * the record's own frozen comments and the REAL document path.
 *
 * The wording is deliberately inherited from the webview's former
 * `buildAgentTaskPrompt` (`webview/src/extensions/comment/commentIndex.ts` on
 * `main`) so the agents keep seeing instructions they already handle well. The
 * one substantive change is the document label.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D8)
 */

import type { CommentTaskCommentV1 } from './types';

/**
 * The guard that keeps an agent from clearing the user's own comments while
 * acting on them. It is unconditional: every task, every surface, one or fifty
 * comments. `commentTaskPrompt.test.ts` asserts its presence in every shape.
 */
export const MARKER_PRESERVATION_GUARD =
  'Do NOT remove or rewrite the comment markers themselves (the <mark data-comment> wrappers / <!-- --> notes) '
  + 'unless a comment explicitly asks for that — the user clears their own comments.';

/**
 * Build the prompt for one accepted comment task.
 *
 * @param displayPath the source document as the user would name it
 *   (`workspace.asRelativePath`), never a placeholder.
 * @param comments the task's frozen comments, already in document order.
 */
export function buildCommentTaskPrompt(displayPath: string, comments: CommentTaskCommentV1[]): string {
  const single = comments.length === 1;
  const lines: string[] = [
    `The user assigned you ${single ? 'this comment' : `these ${comments.length} comments`} in ${displayPath}. `
      + `Work through ${single ? 'it' : 'them in order'}.`,
    MARKER_PRESERVATION_GUARD,
    '',
  ];

  comments.forEach((comment, index) => {
    // `instruction` is the note with the assignment mention removed and the
    // codec already rejects an empty one; the fallback exists so a record that
    // predates that guarantee still says something real.
    lines.push(`${index + 1}. ${comment.instruction || comment.note}`);
    lines.push(`   Comment id: ${comment.commentId}`);
    if (comment.anchoredText) lines.push(`   Anchored to: "${comment.anchoredText}"`);
    if (comment.kind === 'node') lines.push('   (standalone note — not anchored to specific text)');
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}
