/**
 * Sprint 157 (README frame 4, prototype `convert` and `hiddenNote`): a change of layout keeps the words. A layout only
 * draws the slide's words another way; its items, rows and lines are never thrown away by it, so going back loses
 * nothing.
 *
 *  - A kind that draws items, from a slide that has none: its table's rows (the first cell a heading, the rest its
 *    line), or its subtitle, or one empty item.
 *  - A table, from a slide that has no rows: a heading row and a row per item.
 *  - A section gets the number 1 when it has none.
 *
 * When a layout can't show all the words, a quiet line under the slide says so.
 */
import type { SlideData } from '../../../../../src/decks/deckFormat'

const DRAWS_ITEMS = new Set(['points', 'boxes', 'columns', 'exercise'])

export function convertKind(data: SlideData, to: string): SlideData {
  let next: SlideData = { ...data }
  if (DRAWS_ITEMS.has(to) && !(next.items && next.items.length)) {
    if (next.rows && next.rows.length > 1) {
      next.items = next.rows.slice(1).map(row => {
        const text = row.slice(1).filter(Boolean).join(' · ')
        return text ? { heading: row[0] ?? '', text } : { heading: row[0] ?? '' }
      })
    } else if (next.subtitle) {
      next.items = [{ heading: next.subtitle }]
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
