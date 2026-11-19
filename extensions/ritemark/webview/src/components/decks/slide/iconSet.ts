/**
 * Sprint 157: the icons a box can carry, as the prototype's grid of 24 (prototype.html:1151). A slide stores an icon
 * by its Ritemark name (`icon: list-checks`), so the file reads the same in any AI or editor.
 *
 * Sprint 169 (#866; decks README, "Every Phosphor icon, found by searching"): a box may also carry any Phosphor regular
 * icon by its own name (`icon: truck`). A Phosphor name always means Phosphor's icon (the Experience lead, 19 November);
 * the grid's own names and its aliases only fill names Phosphor doesn't have (`mail`, `puzzle`, `search`). The 24 stay
 * as the menu's first view. The one import is `pageIcons.ts`, every regular icon's drawing, which has none: the host's
 * type check and the published page read this file too. SlideCanvas's `<Icon name>` checks that every `phosphor` in the
 * grid is one of Ritemark's chrome icons.
 */
import { isPageIconName, type PageIconName } from './pageIcons'

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
  /** The name written in the slide file: the grid's own for its 24 drawings, Phosphor's for every other. */
  name: string
  /** The Phosphor icon drawn for it. */
  phosphor: PageIconName
  /** Its words in a tooltip. */
  label: string
}

/** One of the grid's 24. */
export type GridIcon = (typeof SLIDE_ICONS)[number]

/**
 * Names other tools write (Lucide's and plain words) for the grid's icons, where Phosphor has no icon by that name.
 * Sprint 169 (the Experience lead, 19 November): an alias never shadows a Phosphor name, so `check`, `envelope`,
 * `chat`, `book` and `folder`, aliases before, are Phosphor's own icons now, and the aliases that named the very icon
 * the grid draws (`robot`, `sparkle`, `warning`, `puzzle-piece`) went as nothing reached them.
 */
const ALIASES: Record<string, string> = {
  'message': 'message-square',
  'chart': 'chart-column',
  'search': 'search-check',
  'help': 'circle-help',
}

const BY_NAME = new Map<string, GridIcon>(SLIDE_ICONS.map(icon => [icon.name, icon]))
const ALIAS_OF = new Map<string, string>(Object.entries(ALIASES))
/** The grid's icons by the Phosphor icon they draw: `envelope-simple` is the grid's `mail`. */
const BY_DRAWING = new Map<string, GridIcon>(SLIDE_ICONS.map(icon => [icon.phosphor, icon]))

/** A written icon name as the lookups read it: any case, spaces for hyphens (`User Circle` is `user-circle`), as the search does. */
function iconKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

/** A Phosphor name as a tooltip's words: `user-circle` is "User circle". */
function labelOf(phosphor: string): string {
  const words = phosphor.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The icon for a name a slide carries, or null when it names none (a box then draws `UNKNOWN_ICON`). Sprint 169 (#866):
 * a Phosphor regular name is Phosphor's icon, written as the grid writes it when one of the 24 draws it
 * (`envelope-simple` is `mail`); any other name is one of the grid's own or its aliases (`mail`, `search`), or none.
 * Names are read by `iconKey`.
 */
export function slideIcon(name: string | undefined): SlideIcon | null {
  if (!name) return null
  const key = iconKey(name)
  if (isPageIconName(key)) return BY_DRAWING.get(key) ?? { name: key, phosphor: key, label: labelOf(key) }
  return BY_NAME.get(key) ?? BY_NAME.get(ALIAS_OF.get(key) ?? '') ?? null
}

/**
 * The grid's icon for a name: `slideIcon`'s, when it is one of the 24's drawings; null for any other. The old layout
 * (`SlideCanvas`, `slideMarkup`) draws only these, through the chrome's `Icon`, until Sprint 169 PR 2 draws it from the
 * full set.
 */
export function gridIcon(name: string | undefined): GridIcon | null {
  const icon = slideIcon(name)
  return icon ? BY_DRAWING.get(icon.phosphor) ?? null : null
}

/**
 * #850 (the Experience lead, 19 November; decks README, "Every Phosphor icon"): what a box draws when its `icon` names
 * one Ritemark doesn't know, so its badge never stays empty: Phosphor's regular `circle-dashed`, in the theme's
 * placeholder colour on the badge's usual soft accent (`blk-icon is-unknown`, slide.css). The name stays in the file as
 * written. `scripts/generate-page-icons.mjs` reads this line and checks that the package has the drawing.
 */
export const UNKNOWN_ICON = 'circle-dashed'

/** What a box's `icon` draws: a known icon (`name` as `slideIcon` gives it), or the fallback for a name it doesn't know (as written). */
export type BoxIcon =
  | { known: true; name: string; phosphor: PageIconName }
  | { known: false; name: string; phosphor: typeof UNKNOWN_ICON }

/** A box's icon by the name it carries; null when it names none (no `icon`, or an empty one). */
export function boxIconOf(name: string | undefined): BoxIcon | null {
  const written = name?.trim()
  if (!written) return null
  const icon = slideIcon(written)
  return icon ? { known: true, name: icon.name, phosphor: icon.phosphor } : { known: false, name: written, phosphor: UNKNOWN_ICON }
}

/** The grid's 24 names, and the other names drawn as them. */
export const SLIDE_ICON_NAMES: readonly string[] = SLIDE_ICONS.map(icon => icon.name)
export const SLIDE_ICON_ALIASES: readonly string[] = Object.keys(ALIASES)

/**
 * Sprint 169 (#866), for the DECKS rules beside "any Phosphor regular icon name": the grid's names and aliases that
 * aren't Phosphor names (`mail` draws envelope-simple, `search` magnifying-glass), each with the icon it draws.
 */
export const RITEMARK_ICON_NAMES: readonly { name: string; phosphor: PageIconName }[] = [...SLIDE_ICON_NAMES, ...SLIDE_ICON_ALIASES]
  .map(name => ({ name, phosphor: (slideIcon(name) as SlideIcon).phosphor }))
  .filter(entry => entry.name !== entry.phosphor)
