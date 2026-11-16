/**
 * Sprint 157 (README frame 4, prototype `convert` and `hiddenNote`): a change of layout keeps the words. A layout only
 * draws the slide's words another way; its items, rows and lines are never thrown away by it, so going back loses
 * nothing.
 *
 *  - A kind that draws items, from a slide that has none: its table's rows (the first cell a heading, the rest its
 *    line), or its subtitle, or one empty item.
 *  - A table, from a slide that has no rows: a heading row and a row per item.
 *  - A section gets the number 1 when it has none.
 *  - Items made here for a layout that draws its own numbers or dots leave out the list marker it would draw
 *    (`listMarkerOf`: "1. " on the first), so the new items come out clean (Jarmo, 16 November: no number twice).
 *    Items a slide already has are never rewritten by a change of layout.
 *
 * When a layout can't show all the words, a quiet line under the slide says so.
 */
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { itemMarksOf, withoutListMarker } from './layoutSlide'

const DRAWS_ITEMS = new Set(['points', 'boxes', 'columns', 'exercise'])

export function convertKind(data: SlideData, to: string): SlideData {
  let next: SlideData = { ...data }
  if (DRAWS_ITEMS.has(to) && !(next.items && next.items.length)) {
    const marks = itemMarksOf(to, next.look || 'boxes')
    const clean = (words: string, position: number) => withoutListMarker(words, position, marks)
    if (next.rows && next.rows.length > 1) {
      next.items = next.rows.slice(1).map((row, index) => {
        const text = row.slice(1).filter(Boolean).join(' · ')
        const heading = clean(row[0] ?? '', index + 1)
        return text ? { heading, text } : { heading }
      })
    } else if (next.subtitle) {
      next.items = [{ heading: clean(next.subtitle, 1) }]
    } else {
      next.items = [{ heading: '' }]
    }
  }
  if (to === 'table' && !(next.rows && next.rows.length)) {
    const items = next.items ?? []
    next.rows = [['', ''], ...items.map(item => [item.heading ?? '', (item.text ?? '').replace(/\n/g, ' · ')])]
    if (next.rows.length === 1) next.rows.push(['', ''])
  }
  if (to === 'section' && !next.number) next = { ...next, number: '1' }
  return next
}

/** The quiet line under a slide whose layout can't show all its words, or ''. */
export function hiddenNote(kind: string, data: SlideData): string {
  const count = (data.items ?? []).length
  if (kind === 'columns' && count > 2) return `${count - 2} more ${count > 3 ? 'items are' : 'item is'} kept for other layouts`
  if (['title', 'section', 'statement', 'picture'].includes(kind) && count > 1 && (data.items ?? []).some(item => item.heading)) {
    return `${count} items are kept for other layouts`
  }
  return ''
}
