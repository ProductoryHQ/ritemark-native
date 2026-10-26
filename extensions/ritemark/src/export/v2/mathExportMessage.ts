/**
 * Sprint 138 (#481, the plan's decision 5): an equation KaTeX cannot typeset
 * never stops an export. It goes out as its source in the code style, and the
 * message after the export says how many did. PDF, Word and Google Docs share
 * the sentence.
 */
export function equationsShownAsSourceSentence(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? "1 equation couldn't be typeset and shows as its source."
    : `${count} equations couldn't be typeset and show as their source.`;
}
