/**
 * Sprint 157: the icons a box can carry, as the prototype's grid of 24 (prototype.html:1151). A slide stores an icon
 * by its Ritemark name (`icon: list-checks`), so the file reads the same in any AI or editor; the stage draws the
 * Phosphor icon for it through the one `Icon` component.
 */
import type { PhosphorIconName } from '../../ui/Icon'

export interface SlideIcon {
  /** The name written in the slide file. */
  name: string
  /** The Phosphor icon drawn for it. */
  phosphor: PhosphorIconName
  /** Its words in the grid's tooltip. */
  label: string
}

export const SLIDE_ICONS: SlideIcon[] = [
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
]

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

const BY_NAME = new Map(SLIDE_ICONS.map(icon => [icon.name, icon]))

/** The icon for a name a slide carries, or null when it is none of the grid's (the box draws no icon). */
export function slideIcon(name: string | undefined): SlideIcon | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return BY_NAME.get(key) ?? BY_NAME.get(ALIASES[key] ?? '') ?? null
}
