/**
 * Sprint 165 PR 1 (README "The library place, from first principles"): Other decks grouped by the folder each deck is
 * in. A folder is a plain heading, never opened or closed; a deck at the project's top level goes under the project's
 * name. Folders come in the order of their newest deck, and a folder's decks newest first. A row's date is the day the
 * file was last changed ("12 Nov", with the year when it isn't this one). Pure, so the panel and its tests share it.
 */

import { blockSectionNumberOf, isSectionSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { isBlockSlide, type SlideData } from '../../../../../src/decks/deckFormat'

export interface GroupedDeck {
  path: string
  modified: number
}

export interface DeckFolder<T extends GroupedDeck> {
  /** The folder's project-relative path ('' for the project's top level). */
  folder: string
  /** The heading: the folder's path with › between folders, or the project's name for the top level. */
  name: string
  decks: T[]
}

/** Between a folder and the one inside it, and between a folder and a deck: "Clients › North" (search uses it too). */
export const PLACE_SEPARATOR = ' › '

/** A folder's heading: its project-relative path with › between the folders ("Clients › North"). */
export function folderHeading(folder: string): string {
  return folder.split('/').filter(Boolean).join(PLACE_SEPARATOR)
}

/** The folder a deck is in, project-relative ('' at the top level). */
export function folderOfDeck(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? '' : path.slice(0, cut)
}

/** The decks by folder: folders by their newest deck, each folder's decks newest first (ties by path). */
export function groupByFolder<T extends GroupedDeck>(decks: readonly T[], projectName: string): DeckFolder<T>[] {
  const newestFirst = [...decks].sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path))
  const folders = new Map<string, DeckFolder<T>>()
  for (const deck of newestFirst) {
    const folder = folderOfDeck(deck.path)
    let group = folders.get(folder)
    if (!group) {
      group = { folder, name: folderHeading(folder) || projectName || 'This project', decks: [] }
      folders.set(folder, group)
    }
    group.decks.push(deck)
  }
  // A Map keeps insertion order, and each folder was first met at its newest deck.
  return [...folders.values()]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A deck's date as its row shows it: "12 Nov", or "12 Nov 2025" when it isn't this year. Empty for no date. */
export function deckDate(modified: number, now: number = Date.now()): string {
  if (!Number.isFinite(modified) || modified <= 0) return ''
  const day = new Date(modified)
  const text = `${day.getDate()} ${MONTHS[day.getMonth()]}`
  return day.getFullYear() === new Date(now).getFullYear() ? text : `${text} ${day.getFullYear()}`
}

/** A deck's count of slides as its row says it. */
export function slideCount(count: number): string {
  return count === 1 ? '1 slide' : `${count} slides`
}

/**
 * Whether a deck shows its slides. Every deck starts closed; a search opens every deck it found; "From another deck…"
 * (`openNewest`) opens the newest other deck until it is closed by hand.
 */
export function deckExpanded(path: string, options: { searching: boolean; open: Record<string, boolean>; openNewest: boolean; newest: string | undefined }): boolean {
  if (options.searching) return true
  if (options.open[path] !== undefined) return options.open[path]
  return options.openNewest && path === options.newest
}

/** A deck row's second line: "18 Nov · 9 slides", or only the count when the date is unknown. */
export function deckMeta(modified: number, count: number, now: number = Date.now()): string {
  const date = deckDate(modified, now)
  return date ? `${date} · ${slideCount(count)}` : slideCount(count)
}

/** Sprint 165 PR 2: one section of an open deck, from its section slide (included) up to the next one. */
export interface DeckSection<T> {
  /** The section's number as written ("1", "A"), '' for none. */
  number: string
  title: string
  slides: T[]
}

/**
 * Sprint 165 PR 2 (README "A section in one move"): a deck's slides by section. A section starts at a section slide (a
 * title-only slide with its number, as the Agenda reads it) and runs to the next one; the slides before the first
 * stand without a heading (`before`). A deck without sections has every slide in `before` and no sections.
 */
export function sectionsOf<T extends { kind: string; data: SlideData }>(slides: readonly T[]): { before: T[]; sections: DeckSection<T>[] } {
  const before: T[] = []
  const sections: DeckSection<T>[] = []
  for (const slide of slides) {
    // A skipped section slide starts no section, as the Agenda leaves it out.
    if (slide.data.skip !== true && isSectionSlide(slide.kind, slide.data)) {
      const number = isBlockSlide(slide.kind) ? blockSectionNumberOf(slide.data.markdown ?? '') ?? '' : String(slide.data.number ?? '').trim()
      const title = typeof slide.data.title === 'string' ? slide.data.title.trim() : ''
      sections.push({ number, title: title || (number ? `Section ${number}` : 'Section'), slides: [slide] })
    } else if (sections.length) sections[sections.length - 1].slides.push(slide)
    else before.push(slide)
  }
  return { before, sections }
}

/** The most slides one Take section sends (the host's decoder refuses more). */
export const MAX_SECTION_SLIDES = 200

/** A section's slide ids when Take section can send them (each a slide id, none twice, at most the limit), or null. */
export function sectionIds(slides: ReadonlyArray<{ id?: string }>): string[] | null {
  const ids = slides.map(slide => slide.id ?? '')
  if (ids.length === 0 || ids.length > MAX_SECTION_SLIDES) return null
  if (!ids.every(id => /^[0-9a-z]{1,16}$/i.test(id)) || new Set(ids).size !== ids.length) return null
  return ids
}

/**
 * Take section's tooltip (the Experience lead on #861): the count when it can be taken ("Take section · 3 slides"),
 * else why not.
 */
export function takeSectionTip(label: string | null, ids: readonly string[] | null, slides: number): string {
  if (!label) return 'Open a deck to insert this section into it.'
  if (!ids) return "This section's slides need ids of their own. Open its deck once to give them."
  return `Take section · ${slideCount(slides)}`
}

/**
 * Sprint 165 PR 3 (README "Search shows each slide once"): where a search hit's copy is, "Folder › Deck · 12 Nov", with
 * the same › as the folder headings (the project's name for a deck at its top level).
 */
export function placeLine(path: string, name: string, modified: number, projectName: string, now: number = Date.now()): string {
  const folder = folderHeading(folderOfDeck(path)) || projectName || 'This project'
  const date = deckDate(modified, now)
  return `${folder}${PLACE_SEPARATOR}${name}${date ? ` · ${date}` : ''}`
}

/**
 * The line under a hit: "also in 3 older decks", the other decks that have the same slide (the open deck left out: it
 * has the tick). A library slide's copies can be newer than its topic, so it says "also in 3 decks". Null for none.
 */
export function alsoLine(count: number, library: boolean): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return `also in ${count} ${library ? '' : 'older '}${count === 1 ? 'deck' : 'decks'}`
}

/** The search heading's count: "4 slides", or "60 of 412 slides" when the list stops short. */
export function hitsCount(shown: number, total: number): string {
  return total > shown ? `${shown} of ${total} slides` : slideCount(shown)
}
