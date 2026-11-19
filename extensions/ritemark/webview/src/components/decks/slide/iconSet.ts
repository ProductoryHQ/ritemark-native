/**
 * Sprint 157: the icons a box can carry, as the prototype's grid of 24 (prototype.html:1151). A slide stores an icon
 * by its Ritemark name (`icon: list-checks`), so the file reads the same in any AI or editor; the stage draws the
 * Phosphor icon for it through the one `Icon` component.
 *
 * No imports (Sprint 159): the published handout page draws the same icons on the host (`slideMarkup`, from
 * `@phosphor-icons/core`'s SVGs), so the host's type check reads this file too. SlideCanvas's `<Icon name>` checks
 * that every `phosphor` here is one of Ritemark's icons.
 */
export const SLIDE_ICONS = [
  { name: 'list-checks', phosphor: 'list-checks', label: 'Checklist' },
  { name: 'book-open', phosphor: 'book-open', label: 'Book' },
  { name: 'puzzle', phosphor: 'puzzle-piece', label: 'Puzzle piece' },
  { name: 'wrench', phosphor: 'wrench', label: 'Wrench' },
  { name: 'folder-open', phosphor: 'folder-open', label: 'Folder' },
  { name: 'mail', phosphor: 'envelope-simple', label: 'Mail' },
  { name: 'calendar', phosphor: 'calendar', label: 'Calendar' },
  { name: 'globe', phosphor: 'globe', label: 'Globe' },
  { name: 'users', phosphor: 'users', label: 'People' },
  { name: 'user-check', phosphor: 'user-check', label: 'Person checked' },
  { name: 'shield-check', phosphor: 'shield-check', label: 'Shield' },
  { name: 'lightbulb', phosphor: 'lightbulb', label: 'Idea' },
  { name: 'target', phosphor: 'target', label: 'Target' },
  { name: 'clock', phosphor: 'clock', label: 'Clock' },
  { name: 'chart-column', phosphor: 'chart-bar', label: 'Chart' },
  { name: 'table', phosphor: 'table', label: 'Table' },
  { name: 'search-check', phosphor: 'magnifying-glass', label: 'Search' },
  { name: 'message-square', phosphor: 'chat-text', label: 'Message' },
  { name: 'file-text', phosphor: 'file-text', label: 'Document' },
  { name: 'bot', phosphor: 'robot', label: 'Robot' },
  { name: 'sparkles', phosphor: 'sparkle', label: 'Sparkle' },
  { name: 'circle-help', phosphor: 'question', label: 'Question' },
  { name: 'triangle-alert', phosphor: 'warning', label: 'Warning' },
  { name: 'circle-check', phosphor: 'check-circle', label: 'Done' },
] as const

export interface SlideIcon {
  /** The name written in the slide file. */
  name: string
  /** The Phosphor icon drawn for it. */
  phosphor: (typeof SLIDE_ICONS)[number]['phosphor']
  /** Its words in the grid's tooltip. */
  label: string
}

/** Names other tools write for the same icons (Lucide's and a few plain words), drawn as the grid's own. */
const ALIASES: Record<string, string> = {
  'puzzle-piece': 'puzzle',
  'envelope': 'mail',
  'chat': 'message-square',
  'message': 'message-square',
  'chart': 'chart-column',
  'search': 'search-check',
  'robot': 'bot',
  'sparkle': 'sparkles',
  'help': 'circle-help',
  'warning': 'triangle-alert',
  'check': 'circle-check',
  'book': 'book-open',
  'folder': 'folder-open',
}

const BY_NAME = new Map<string, SlideIcon>(SLIDE_ICONS.map(icon => [icon.name, icon]))

/** The icon for a name a slide carries, or null when it is none of the grid's (a box then draws `UNKNOWN_ICON`). */
export function slideIcon(name: string | undefined): SlideIcon | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return BY_NAME.get(key) ?? BY_NAME.get(ALIASES[key] ?? '') ?? null
}

/**
 * #850 (the Experience lead, 19 November; decks README, "Every Phosphor icon"): what a box draws when its `icon` names
 * one Ritemark doesn't know, so its badge never stays empty: Phosphor's regular `circle-dashed`, in the theme's
 * placeholder colour on the badge's usual soft accent (`blk-icon is-unknown`, slide.css). The name stays in the file as
 * written. `scripts/generate-page-icons.mjs` reads this line, so the page carries the drawing.
 */
export const UNKNOWN_ICON = 'circle-dashed'

/** What a box's `icon` draws: a known icon (`name` the grid's), or the fallback for a name it doesn't know (as written). */
export type BoxIcon =
  | { known: true; name: string; phosphor: SlideIcon['phosphor'] }
  | { known: false; name: string; phosphor: typeof UNKNOWN_ICON }

/** A box's icon by the name it carries; null when it names none (no `icon`, or an empty one). */
export function boxIconOf(name: string | undefined): BoxIcon | null {
  const written = name?.trim()
  if (!written) return null
  const icon = slideIcon(written)
  return icon ? { known: true, name: icon.name, phosphor: icon.phosphor } : { known: false, name: written, phosphor: UNKNOWN_ICON }
}

/** The names a box's `icon` may carry, for the DECKS rules: the grid's 24, and the other names drawn as them. */
export const SLIDE_ICON_NAMES: readonly string[] = SLIDE_ICONS.map(icon => icon.name)
export const SLIDE_ICON_ALIASES: readonly string[] = Object.keys(ALIASES)
