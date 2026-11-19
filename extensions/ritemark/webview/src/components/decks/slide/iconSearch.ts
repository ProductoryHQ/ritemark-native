/**
 * Sprint 169 (#866; decks README, "Every Phosphor icon, found by searching"): the icon menu's search over every
 * Phosphor regular icon, by its name, Phosphor's own tags (English: "people", "truck", "invoice") and the grid's names,
 * aliases and labels, so "mail" finds the envelopes. Pure and DOM-free; the menu draws only the results it shows.
 *
 * Its own module, apart from iconSet.ts, so the index (iconIndex.ts) reaches only the code that searches.
 */
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
