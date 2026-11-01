/**
 * Sprint 145 R1 (revised 1 November, #588): the words for a place both the person and a writer changed, from the
 * Experience lead's experience 44 (*Editing alongside the AI*, ritemark-dev `ec25356`). `writer` is the AI's name
 * (Claude, ChatGPT, OpenCode) only when Ritemark knows that AI made the write; otherwise "another app".
 */

export interface ParagraphReviewWords {
  /** The document bar's Review changes tooltip. */
  tooltip: string
  title: string
  line: string
  mineLabel: string
  theirsLabel: string
  useTheirs: string
  keepMine: string
}

export function paragraphReviewWords(count: number, writer?: string): ParagraphReviewWords {
  const many = count > 1
  if (writer) {
    return {
      tooltip: many
        ? `${writer} also changed ${count} paragraphs you were writing in. Yours are kept. Review changes shows both versions.`
        : `${writer} also changed the paragraph you were writing in. Yours is kept. Review changes shows both.`,
      title: 'A paragraph changed in two places',
      line: `${writer} changed a paragraph you were writing in. Ritemark kept yours in the document.`,
      mineLabel: 'Yours, in the document',
      theirsLabel: `${writer}'s`,
      useTheirs: `Use ${writer}'s`,
      keepMine: 'Keep mine',
    }
  }
  return {
    tooltip: many
      ? `Another app saved a copy that changes ${count} paragraphs you were writing in. Yours are kept. Review changes shows both versions.`
      : 'Another app saved a copy that changes the paragraph you were writing in. Yours is kept. Review changes shows both.',
    title: 'A paragraph changed in two places',
    line: 'Another app saved a copy that changes a paragraph you were writing in. Ritemark kept yours in the document.',
    mineLabel: 'Yours, in the document',
    theirsLabel: 'The other copy',
    useTheirs: 'Use the other copy',
    keepMine: 'Keep mine',
  }
}
