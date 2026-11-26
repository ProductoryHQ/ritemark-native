/**
 * Sprint 169 (#866; decks README, "Every Phosphor icon, found by searching"): the icon menu's search over every
 * Phosphor regular icon, by its name, Phosphor's own tags (English: "people", "truck", "invoice") and the grid's names,
 * aliases and labels, so "mail" finds the envelopes. Pure and DOM-free; the menu draws only the results it shows.
 *
 * Its own module, apart from iconSet.ts, so the index (iconIndex.ts) reaches only the code that searches.
 */
import { CLOSE_FENCE, CODE_FENCE, CODE_FENCE_CLOSE, OPEN_FENCE, boxesShowIcons, parseFenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { layoutSlide, type SlideBox } from './layoutSlide'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { ICON_TAGS, ICON_TAG_SEPARATOR } from './iconIndex'
import { PAGE_ICON_NAMES } from './pageIcons'
import { SLIDE_ICONS, SLIDE_ICON_ALIASES, slideIcon, type SlideIcon } from './iconSet'

/** How a query meets an icon, best first. */
const Match = { Name: 0, NameStart: 1, NameWord: 2, Tag: 3, TagStart: 4, NamePart: 5 } as const
type Match = (typeof Match)[keyof typeof Match]

interface Entry {
  /** The icon as a box writes and draws it (`slideIcon`'s). */
  icon: SlideIcon
  /** Its names: Phosphor's, and the grid's name and aliases for one of the 24. */
  names: string[]
  /** Its words: Phosphor's tags, and the grid's label for one of the 24. */
  tags: string[]
  /** One of the grid's 24, which come first among equals. */
  grid: boolean
  /**
   * Sprint 169 PR 4: the words a near name is measured against, each with its kind, a whole name (0), a word of one
   * (1) or a word of a tag (2); made once, with the index.
   */
  words: { word: string; kind: number }[]
}

let entries: Entry[] | null = null

/** One entry per Phosphor regular icon (each name draws its own icon), built on the first search. */
function index(): Entry[] {
  if (entries) return entries
  const byDrawing = new Map<string, Entry>()
  for (const phosphor of PAGE_ICON_NAMES) {
    const icon = slideIcon(phosphor) as SlideIcon
    byDrawing.set(phosphor, { icon, names: [phosphor], tags: ICON_TAGS[phosphor].split(ICON_TAG_SEPARATOR), grid: false, words: [] })
  }
  for (const grid of SLIDE_ICONS) {
    const entry = byDrawing.get(grid.phosphor)
    if (!entry) continue
    entry.grid = true
    entry.names.push(grid.name)
    entry.tags.push(grid.label.toLowerCase())
  }
  for (const alias of SLIDE_ICON_ALIASES) {
    const entry = byDrawing.get(slideIcon(alias)?.phosphor ?? '')
    if (entry && !entry.names.includes(alias)) entry.names.push(alias)
  }
  entries = [...byDrawing.values()]
  for (const entry of entries) {
    const seen = new Set<string>()
    const add = (word: string, kind: number) => { if (word && !seen.has(word)) { seen.add(word); entry.words.push({ word, kind }) } }
    for (const name of entry.names) add(name, 0)
    for (const name of entry.names) if (name.includes('-')) for (const word of name.split('-')) add(word, 1)
    for (const tag of entry.tags) for (const word of tag.split(' ')) add(word, 2)
  }
  return entries
}

const startsAnyWord = (text: string, separator: string, query: string) => text.split(separator).some(word => word.startsWith(query))

/** How well `query` (lower case, trimmed) meets an entry, or null when it doesn't. */
function matchOf(entry: Entry, query: string, asName: string): Match | null {
  let best: Match | null = null
  const take = (match: Match) => { if (best === null || match < best) best = match }
  for (const name of entry.names) {
    if (name === asName) return Match.Name
    if (name.startsWith(asName)) take(Match.NameStart)
    else if (startsAnyWord(name, '-', asName)) take(Match.NameWord)
    else if (asName.length >= 3 && name.includes(asName)) take(Match.NamePart)
  }
  for (const tag of entry.tags) {
    if (tag === query) take(Match.Tag)
    else if (tag.startsWith(query) || startsAnyWord(tag, ' ', query)) take(Match.TagStart)
  }
  return best
}

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** The icons a query (lower case, single spaces) finds by name and tag, best first; none when it meets none. */
function matchIcons(text: string): SlideIcon[] {
  const asName = text.replace(/ /g, '-')
  const found: { entry: Entry; match: Match }[] = []
  for (const entry of index()) {
    const match = matchOf(entry, text, asName)
    if (match !== null) found.push({ entry, match })
  }
  found.sort((a, b) => a.match - b.match || Number(b.entry.grid) - Number(a.entry.grid) || byName(a.entry.icon.phosphor, b.entry.icon.phosphor))
  return found.map(({ entry }) => entry.icon)
}

/** A query's own words, of three letters or more: "delivery-van" is "delivery" and "van". */
function wordsOf(asName: string): string[] {
  return asName.split('-').filter(word => word.length >= 3)
}

/**
 * The icons a query finds, best first: a name it is, then names it starts, then names with a word it starts, then
 * tags it is, then tags it starts, then names holding it. Among equals the grid's 24 come first, then by name. An empty
 * query finds nothing (the menu then shows the deck's icons and the 24).
 *
 * Sprint 169 PR 4 (#869): a query that finds nothing this way, a box's unknown name above all, is read by its words
 * next ("delivery-van" finds what "delivery" and "van" find, in that order), and then by the names nearest it
 * (`nearIcons`: "trukc" finds truck). Nonsense still finds nothing, so "No icons match" shows.
 */
export function searchIcons(query: string): SlideIcon[] {
  const text = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return []
  const found = matchIcons(text)
  if (found.length) return found
  const asName = text.replace(/ /g, '-')
  const words = wordsOf(asName)
  if (words.length > 1) {
    const byWords = new Map<string, SlideIcon>()
    for (const word of words) for (const icon of matchIcons(word)) if (!byWords.has(icon.phosphor)) byWords.set(icon.phosphor, icon)
    if (byWords.size) return [...byWords.values()]
  }
  return nearIcons(asName)
}

/**
 * How many edits a word may be from a query and still be near it: one for a query of four to six letters, two up to
 * ten, three beyond. A query shorter than four letters has no near words: among some 1,500 icons and their tags, nearly
 * every short string is one edit from something, and "No icons match" would never show.
 */
export function nearLimit(length: number): number {
  return length < 4 ? -1 : length <= 6 ? 1 : length <= 10 ? 2 : 3
}

/**
 * The edits between two words, letters added, taken out, changed, or two side by side swapped ("trukc" is one from
 * "truck"); `limit + 1` as soon as it is surely more than `limit`.
 */
export function editsBetween(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let least = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1)
      row.push(value)
      if (value < least) least = value
    }
    if (least > limit) return limit + 1
    before = previous
    previous = row
  }
  return previous[b.length]
}

/**
 * Sprint 169 PR 4 (#869): the icons whose names or words are nearest a query that found none, nearest first: a whole
 * name, a word of one ("truck" in `fire-truck`) or a word of one of Phosphor's tags within `nearLimit` edits of the
 * query, or of one of its words ("delivery-vann": "vann" is near "van"). Among equals, a whole name before a word of
 * one before a tag's, then the grid's 24, then by name. None when nothing is that near.
 */
export function nearIcons(asName: string): SlideIcon[] {
  const queries = [asName, ...(asName.includes('-') ? wordsOf(asName) : [])]
    .map(query => ({ query, limit: nearLimit(query.length) }))
    .filter(({ limit }) => limit >= 0)
  if (!queries.length) return []
  const found: { entry: Entry; edits: number; kind: number }[] = []
  for (const entry of index()) {
    let best = { edits: Infinity, kind: 3 }
    for (const { query, limit } of queries) {
      for (const { word, kind } of entry.words) {
        const edits = editsBetween(query, word, Math.min(limit, best.edits))
        if (edits <= limit && (edits < best.edits || (edits === best.edits && kind < best.kind))) best = { edits, kind }
      }
    }
    if (best.edits !== Infinity) found.push({ entry, ...best })
  }
  found.sort((a, b) => a.edits - b.edits || a.kind - b.kind || Number(b.entry.grid) - Number(a.entry.grid) || byName(a.entry.icon.phosphor, b.entry.icon.phosphor))
  return found.map(({ entry }) => entry.icon)
}

/**
 * Sprint 169 PR 4 (#869; decks README, "Every Phosphor icon"): the words the icon menu's search starts with. For a box
 * whose icon names one Ritemark doesn't know, that name as written, so the nearest icons show at once; else none.
 */
export function iconMenuStartQuery(current: string | null): string {
  const written = current?.trim()
  return written && !slideIcon(written) ? written : ''
}

/**
 * Sprint 169 PR 3 (#868): the icons a deck's boxes carry, in the order the deck first uses them, each once: an old
 * layout's items (`icon:`) and a block slide's boxes (`::: {.box icon="x"}`). Only names that draw an icon; an unknown
 * one draws the dashed circle and is no choice to offer.
 */
export function deckIconsInUse(slides: ReadonlyArray<{ kind: string; data: SlideData }>): SlideIcon[] {
  const found = new Map<string, SlideIcon>()
  const take = (name: string | undefined) => {
    const icon = slideIcon(name)
    if (icon && !found.has(icon.phosphor)) found.set(icon.phosphor, icon)
  }
  for (const { kind, data } of slides) {
    if (data.markdown === undefined) {
      // An old layout: the icons its layout draws (an item's `icon:` a layout never draws is in use nowhere).
      const walk = (boxes: readonly SlideBox[]) => {
        for (const box of boxes) {
          if (box.type === 'group') walk(box.children)
          else if (box.type === 'mark' && box.iconIndex !== undefined && !box.placeholder) take(box.icon)
        }
      }
      walk(layoutSlide(kind, data).boxes)
      continue
    }
    // A block slide's boxes. A `:::` line inside a code block is the code's words, not a box (fencedDiv's rule).
    // The open divs, innermost last, each marked when it draws no box icons (Dot or Arrow).
    let code: { char: string; size: number } | null = null
    const open: boolean[] = []
    for (const line of data.markdown.split('\n')) {
      if (code) {
        const close = CODE_FENCE_CLOSE.exec(line)
        if (close && close[1][0] === code.char && close[1].length >= code.size) code = null
        continue
      }
      const fence = CODE_FENCE.exec(line)
      if (fence) {
        code = { char: fence[1][0], size: fence[1].length }
        continue
      }
      const opening = OPEN_FENCE.exec(line)
      const attrs = opening ? parseFenceAttributes(opening[2]) : null
      if (attrs) {
        const hidesIcons = attrs.classes.includes('boxes') && !boxesShowIcons(attrs.values.look ?? 'boxes')
        if (attrs.classes.includes('box') && !open.includes(true)) take(attrs.values.icon)
        open.push(hidesIcons)
      } else if (CLOSE_FENCE.test(line)) open.pop()
    }
  }
  return [...found.values()]
}

/** How many results the menu draws at once: ten rows of six. A longer list asks for more words. */
export const ICON_MENU_PAGE = 60

/**
 * The quiet line under the results when the search found more than it draws (the Experience lead on #908): "60 of 212
 * · type more to narrow"; null when everything found is shown.
 */
export function iconMenuMoreLine(shown: number, total: number): string | null {
  return total > shown ? `${shown} of ${total} · type more to narrow` : null
}

/**
 * Sprint 169 PR 3 (#868; decks README, "Every Phosphor icon, found by searching"): what the icon menu shows. Before
 * typing, the deck's icons in use, then the grid's 24 (each icon once, so one in use isn't offered twice); after, the
 * search's results, best first, at most a page of them, with how many there are in all.
 */
export function iconMenuChoices(query: string, inUse: readonly SlideIcon[]): { icons: SlideIcon[]; total: number; searching: boolean } {
  if (!query.trim()) {
    const shown = new Set(inUse.map(icon => icon.phosphor))
    const icons = [...inUse, ...SLIDE_ICONS.filter(icon => !shown.has(icon.phosphor))]
    return { icons, total: icons.length, searching: false }
  }
  const found = searchIcons(query)
  return { icons: found.slice(0, ICON_MENU_PAGE), total: found.length, searching: true }
}

export type IconMenuMove = 'up' | 'down' | 'left' | 'right'

/**
 * Sprint 169 PR 3: where an arrow key moves the menu's highlight. `at` is an icon's place, `count` for No icon (there
 * only `withNoIcon`, when the box has an icon to take out), or -1 for none (the field alone). ↓ and ↑ move a row of
 * `columns`: ↓ from the last row goes to No icon, else to the last icon; ↑ from the first row to none. ← and → move one
 * icon along the list, stopping at its ends, and leave No icon and none as they are.
 */
export function iconMenuMove(at: number, move: IconMenuMove, count: number, withNoIcon: boolean, columns: number): number {
  const noIcon = withNoIcon ? count : -1
  if (move === 'left' || move === 'right') {
    if (at < 0 || at >= count) return at
    return move === 'right' ? Math.min(at + 1, count - 1) : Math.max(at - 1, 0)
  }
  if (move === 'down') {
    if (at < 0) return count ? 0 : noIcon
    if (at >= count) return at
    if (at + columns < count) return at + columns
    return noIcon >= 0 ? noIcon : Math.max(at, count - 1)
  }
  if (at >= count) return count ? Math.floor((count - 1) / columns) * columns : -1
  return at - columns >= 0 ? at - columns : -1
}

/** Enter chooses the highlight, or the first result while still in the search field. */
export function iconMenuEnterChoice(at: number, count: number, withNoIcon: boolean): number | 'none' | null {
  if (withNoIcon && at === count) return 'none'
  return count ? Math.max(at, 0) : null
}
