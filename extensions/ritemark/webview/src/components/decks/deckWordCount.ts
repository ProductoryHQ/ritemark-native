import { readMarkdown } from '../../../../src/search/worker/readers/markdown'

/** The search reader joins a table row's cells with ' · ': a separator, not a word (Codex, #962). */
const TABLE_CELL_SEPARATOR = '·'

/** Count the written slide and handout text, using the same reading as deck search. */
export function deckWordCount(markdown: string): number {
  const result = readMarkdown(markdown, Number.MAX_SAFE_INTEGER, { deck: true })
  if (!result.ok) return 0
  return result.passages.reduce((count, passage) => count + passage.text.split(/\s+/).filter(word => word && word !== TABLE_CELL_SEPARATOR).length, 0)
}
