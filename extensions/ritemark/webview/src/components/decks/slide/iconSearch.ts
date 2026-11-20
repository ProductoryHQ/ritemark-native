/**
 * Sprint 169 (#866; decks README, "Every Phosphor icon, found by searching"): the icon menu's search over every
 * Phosphor regular icon, by its name, Phosphor's own tags (English: "people", "truck", "invoice") and the grid's names,
 * aliases and labels, so "mail" finds the envelopes. Pure and DOM-free; the menu draws only the results it shows.
 *
 * Its own module, apart from iconSet.ts, so the index (iconIndex.ts) reaches only the code that searches.
 */
import { CLOSE_FENCE, CODE_FENCE, CODE_FENCE_CLOSE, OPEN_FENCE, boxesMarkOf, parseFenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
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
}

let entries: Entry[] | null = null

/** One entry per Phosphor regular icon (each name draws its own icon), built on the first search. */
function index(): Entry[] {
  if (entries) return entries
  const byDrawing = new Map<string, Entry>()
  for (const phosphor of PAGE_ICON_NAMES) {
    const icon = slideIcon(phosphor) as SlideIcon
    byDrawing.set(phosphor, { icon, names: [phosphor], tags: ICON_TAGS[phosphor].split(ICON_TAG_SEPARATOR), grid: false })
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

/**
 * The icons a query finds, best first: a name it is, then names it starts, then names with a word it starts, then
 * tags it is, then tags it starts, then names holding it. Among equals the grid's 24 come first, then by name. An empty
 * query finds nothing (the menu then shows the deck's icons and the 24).
 */
export function searchIcons(query: string): SlideIcon[] {
  const text = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return []
  const asName = text.replace(/ /g, '-')
  const found: { entry: Entry; match: Match }[] = []
  for (const entry of index()) {
    const match = matchOf(entry, text, asName)
    if (match !== null) found.push({ entry, match })
  }
  const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  found.sort((a, b) => a.match - b.match || Number(b.entry.grid) - Number(a.entry.grid) || byName(a.entry.icon.phosphor, b.entry.icon.phosphor))
  return found.map(({ entry }) => entry.icon)
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
    // The open divs, innermost last, each marked when it draws no box icons: a Boxes block set to Number, Dot or Arrow
    // (`boxesMarkOf`) draws its own mark where the icon would be, so its boxes' icons are in use nowhere until it is
    // Icon again.
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
        const ownMark = attrs.classes.includes('boxes') && boxesMarkOf(attrs) !== 'icon'
        if (attrs.classes.includes('box') && !open.includes(true)) take(attrs.values.icon)
        open.push(ownMark)
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
