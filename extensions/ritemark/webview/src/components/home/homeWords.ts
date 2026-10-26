/**
 * Home's words (Sprint 134, R4): what waits, when, and the other projects.
 * Pure functions, so the page's sentences are tested without React.
 */

import type { HomeWaitingItem, HomeRecentItem, HomeState } from '../../../../src/projects/protocol'

const DAY = 24 * 60 * 60 * 1000

/** "40 minutes ago", "yesterday", "2 days ago", "last week"; "today" for a file changed today. */
export function whenWords(iso: string, now: number, precision: 'minutes' | 'days'): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const today = startOfToday.getTime()
  if (then >= today) {
    if (precision === 'days') return 'today'
    const minutes = Math.max(0, Math.round((now - then) / 60000))
    if (minutes < 1) return 'just now'
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
    const hours = Math.round(minutes / 60)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (then >= today - DAY) return 'yesterday'
  const days = Math.ceil((today - then) / DAY)
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * A folder's path in three parts, for the cut in the middle (#525; Sprint 142 R4, #557): the start, the project's
 * parent folder and the project's own folder. `~/Documents/Ritemark/Harbour` is `~/Documents`, `/Ritemark/` and
 * `Harbour`. A Windows path splits at its backslashes. A path of one or two parts is all folder.
 */
export function placeParts(place: string): { start: string; parent: string; folder: string } {
  const separator = place.includes('/') || !place.includes('\\') ? '/' : '\\'
  const parts = place.split(separator)
  if (parts.length < 3) return { start: '', parent: '', folder: place }
  return { start: parts.slice(0, -2).join(separator), parent: separator + parts[parts.length - 2] + separator, folder: parts[parts.length - 1] }
}

export const ELLIPSIS = '…'

/**
 * Sprint 142 R4 (experience 3, #557): the path line as one string, cut in the middle when `fits` says the whole path
 * doesn't. The start gives way first, from its end, then the parent folder; the ellipsis joins what is left with no
 * space ("/private/tmp/rm-smo…/proj/Leadership programme"). The project's own folder is never cut: when even
 * "…/Folder" doesn't fit, the line is the folder's name on its own, and `wrap` says it wraps at its spaces (anywhere,
 * if it has none), as experience 3 draws it.
 */
export function middleCut(place: string, fits: (text: string) => boolean): { text: string; wrap: boolean } {
  if (fits(place)) return { text: place, wrap: false }
  const { start, parent, folder } = placeParts(place)
  if (!parent) return { text: place, wrap: true }
  // The longest of a run of candidates (longest first) that fits; candidates shrink as `keep` falls
  const longest = (count: number, make: (keep: number) => string): string | null => {
    let low = 0
    let high = count - 1
    let found: string | null = null
    while (low <= high) {
      const keep = Math.floor((low + high) / 2)
      const text = make(keep)
      if (fits(text)) {
        found = text
        low = keep + 1
      } else {
        high = keep - 1
      }
    }
    return found
  }
  // The start, from all but its last character down to none ("…/proj/Folder")
  const fromStart = longest(start.length, (keep) => start.slice(0, keep).trimEnd() + ELLIPSIS + parent + folder)
  if (fromStart) return { text: fromStart, wrap: false }
  // Then the parent folder's name, down to none ("…/Folder")
  const separator = parent[0]
  const parentName = parent.slice(1, -1)
  const fromParent = longest(parentName.length, (keep) =>
    keep === 0 ? ELLIPSIS + separator + folder : ELLIPSIS + separator + parentName.slice(0, keep).trimEnd() + ELLIPSIS + separator + folder)
  if (fromParent) return { text: fromParent, wrap: false }
  // The folder's name on its own, on one line if it fits there, wrapped if not
  return { text: folder, wrap: !fits(folder) }
}

/** Sprint 142 R3 (experience 3; experience 36's Done note): the switch note goes this long after it shows. */
export const SWITCH_NOTE_MS = 6000

/**
 * Sprint 142 R3: what on Home ends the switch note at once, because the person started something: a press on the
 * page outside the note, a key typed (Tab only moves the focus, and a modifier alone types nothing), or files
 * dragged over Home. Inside the note, a press or a key is the person using the note.
 */
export function noteEndsOn(event: { type: 'pointerdown' | 'keydown' | 'dragenter'; insideNote: boolean; key?: string; files?: boolean }): boolean {
  if (event.type === 'dragenter') return event.files === true
  if (event.insideNote) return false
  if (event.type === 'pointerdown') return true
  const key = event.key ?? ''
  return !['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn'].includes(key)
}

/** Home's row fits about this much of a quoted message beside its lead and time at the page's width. */
export const QUOTE_LIMIT = 56

/** A quoted first message, cut at a word with the ellipsis inside the quote marks. */
export function quoteWords(message: string, limit = QUOTE_LIMIT): string {
  const text = message.replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space >= limit * 0.55 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?…–—-]+$/, '')}…`
}

/**
 * The row's sentence, and the muted tag after it. A chat titled by its first
 * message is quoted, the quote cut inside its marks (`quote`): Claude replied
 * to “In one sentence…” (the Experience lead, 19 October).
 */
export function waitingWords(item: HomeWaitingItem): { text: string; quote?: string; tag: string | null } {
  const ai = item.ai ?? 'The AI'
  if (item.source === 'chat') {
    const named = (lead: string) => (item.quoted ? { text: lead, quote: quoteWords(item.title) } : { text: `${lead} ${item.title}` })
    switch (item.kind) {
      case 'question':
        return item.detail
          ? { text: `${ai} asks: ${item.detail}`, tag: item.quoted ? `“${quoteWords(item.title)}”` : item.title }
          : { ...named(`${ai} asks you something in`), tag: null }
      case 'approval':
        return { ...named(`${ai} waits for your OK in`), tag: null }
      case 'plan-review':
        return { ...named(`${ai}’s plan waits for you in`), tag: null }
      default:
        return item.quoted ? { text: `${ai} replied to`, quote: quoteWords(item.title), tag: null } : { text: `${ai} replied in ${item.title}`, tag: null }
    }
  }
  switch (item.kind) {
    case 'needs-you':
      return { text: item.title, tag: 'Waits for you' }
    case 'decision':
      return { text: item.title, tag: 'Your decision' }
    case 'review':
      return { text: item.title, tag: 'Ready to review' }
    default:
      return { text: item.title, tag: 'Didn’t finish' }
  }
}

/** The icon for a waiting row (the Icon component's names). */
export function waitingIcon(item: HomeWaitingItem): 'question' | 'shield-check' | 'list-checks' | 'chat-circle' | 'hand-pointing' | 'eye' | 'warning-circle' {
  switch (item.kind) {
    case 'question':
    case 'decision':
      return 'question'
    case 'approval':
      return 'shield-check'
    case 'plan-review':
      return 'list-checks'
    case 'reply':
      return 'chat-circle'
    case 'needs-you':
      return 'hand-pointing'
    case 'review':
      return 'eye'
    default:
      return 'warning-circle'
  }
}

const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

/**
 * The line about the other projects (experience 3 frame 1; experience 29 frame 1):
 * "In your other projects: 1 in Sales proposal Q4, 1 in Research: hybrid work."
 * or, when nothing waits here, "Three things, in your other projects."
 */
export function othersWords(others: HomeState['others'], hereCount: number): string | null {
  if (!others || others.length === 0) return null
  if (hereCount > 0) return `In your other projects: ${others.map((other) => `${other.count} in ${other.name}`).join(', ')}.`
  const total = others.reduce((sum, other) => sum + other.count, 0)
  const number = total < SMALL.length ? SMALL[total] : String(total)
  return `${number} ${total === 1 ? 'thing' : 'things'}, in your other projects.`
}

/** The icon for a file row. */
export function recentIcon(item: HomeRecentItem): 'book-open-text' | 'file-text' | 'file-pdf' | 'file-doc' | 'table' | 'presentation' | 'graph' | 'flow-arrow' | 'file' {
  if (item.about) return 'book-open-text'
  switch (item.kind) {
    case 'markdown': return 'file-text'
    case 'pdf': return 'file-pdf'
    case 'word': return 'file-doc'
    case 'sheet': return 'table'
    case 'slides': return 'presentation'
    case 'drawing': return 'graph'
    case 'flow': return 'flow-arrow'
    default: return 'file'
  }
}
