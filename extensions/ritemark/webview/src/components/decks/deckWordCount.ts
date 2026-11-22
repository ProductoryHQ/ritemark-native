import { readMarkdown } from '../../../../src/search/worker/readers/markdown'

/** Count the written slide and handout text, using the same reading as deck search. */
export function deckWordCount(markdown: string): number {
  const result = readMarkdown(markdown, Number.MAX_SAFE_INTEGER, { deck: true })
  if (!result.ok) return 0
  return result.passages.reduce((count, passage) => count + passage.text.split(/\s+/).filter(Boolean).length, 0)
}
