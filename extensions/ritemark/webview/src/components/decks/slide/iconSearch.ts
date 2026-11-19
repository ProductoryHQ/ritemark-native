/**
 * Sprint 169 (#866; decks README, "Every Phosphor icon, found by searching"): the icon menu's search over every
 * Phosphor regular icon, by its name, Phosphor's own tags (English: "people", "truck", "invoice") and the grid's names,
 * aliases and labels, so "mail" finds the envelopes. Pure and DOM-free; the menu draws only the results it shows.
 *
 * Its own module, apart from iconSet.ts, so the index (iconIndex.ts) reaches only the code that searches.
 */
import { OPEN_FENCE, parseFenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
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
export function deckIconsInUse(slides: ReadonlyArray<{ data: SlideData }>): SlideIcon[] {
  const found = new Map<string, SlideIcon>()
  const take = (name: string | undefined) => {
    const icon = slideIcon(name)
    if (icon && !found.has(icon.phosphor)) found.set(icon.phosphor, icon)
  }
  for (const { data } of slides) {
    for (const item of data.items ?? []) take(item.icon)
    if (!data.markdown) continue
    // A `:::` line inside a code block is the code's words, not a box.
    let code: string | null = null
    for (const line of data.markdown.split('\n')) {
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)
      if (fence) {
        if (code === null) code = fence[1]
        else if (fence[1][0] === code[0] && fence[1].length >= code.length && !line.trim().slice(fence[1].length).trim()) code = null
        continue
      }
      if (code !== null) continue
      const open = OPEN_FENCE.exec(line)
      if (!open || !open[2].startsWith('{')) continue
      take(parseFenceAttributes(open[2])?.values.icon)
    }
  }
  return [...found.values()]
}

/** How many results the menu draws at once: ten rows of six. A longer list asks for more words. */
export const ICON_MENU_PAGE = 60

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

/**
 * Sprint 169 PR 3: where ↓ (`step` 1) or ↑ (-1) moves the menu's highlight, a row of `columns` at a time. `at` is an
 * icon's place, `count` for No icon (there only `withNoIcon`, when the box has an icon to take out), or -1 for none
 * (the field alone). ↓ from the last row goes to No icon, else to the last icon; ↑ from the first row to none.
 */
export function iconMenuMove(at: number, step: 1 | -1, count: number, withNoIcon: boolean, columns: number): number {
  const noIcon = withNoIcon ? count : -1
  if (step === 1) {
    if (at < 0) return count ? 0 : noIcon
    if (at >= count) return at
    if (at + columns < count) return at + columns
    return noIcon >= 0 ? noIcon : Math.max(at, count - 1)
  }
  if (at >= count) return count ? Math.floor((count - 1) / columns) * columns : -1
  return at - columns >= 0 ? at - columns : -1
}
