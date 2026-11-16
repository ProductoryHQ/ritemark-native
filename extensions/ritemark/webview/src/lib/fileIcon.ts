/**
 * A file's icon where the webview names a file (Sprint 159, deck icons): a deck (`*.deck.md`) shows Phosphor's
 * presentation everywhere, as its tab and Documents do (the file icon theme); every other file keeps the icon its
 * surface gives its kind. One place, so Search, the link list and the chat's chips can't drift apart.
 */
import { isDeckPath } from '../../../src/decks/deckName'
import type { PhosphorIconName } from '../components/ui/Icon'

export function fileIconOf(path: string | null | undefined, kindIcon: PhosphorIconName): PhosphorIconName {
  return path && isDeckPath(path) ? 'presentation' : kindIcon
}
