/**
 * Sprint 169 PR 2 (#867; decks README, "Every Phosphor icon, found by searching", R4): a slide's icon in React, drawn
 * from the full Phosphor set (`pageIcons.ts`), never through the chrome's `ui/Icon.tsx`. It is `iconSvg`'s element for
 * element (the same attributes, the same path), so the old layout's canvas (`SlideCanvas`), the icon menu
 * (`IconGrid`), the block slides' badge (`boxIconBadge`, which the stage, the strip, the wall, the presenter view and
 * the page draw) and the page's own markup (`slideMarkup`) all draw one drawing for a name.
 */
import { PAGE_ICON_PATHS, type PageIconName } from './pageIcons'

export function SlideIconGlyph({ name, size = 20 }: { name: PageIconName; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      // The generated module's own path, never words from a file: a name reaches here only as a `PageIconName`.
      dangerouslySetInnerHTML={{ __html: PAGE_ICON_PATHS[name] }}
    />
  )
}
