/**
 * Sprint 167 PR 4: a box of its own for the slide's bubble menu, in the slide's frame.
 *
 * TipTap's bubble menu plugin takes the menu's element out of the page as soon as it starts (it shows it later in the
 * page's body). React still counts that element as the frame's child, so a new node React inserts before it (a missing
 * picture's Replace picture…, the picture Behind's corner chip) made `insertBefore` throw, and the whole deck view went
 * blank: on a picture going missing while its slide was on the stage, and on Behind chosen in Slide settings. This box
 * stays in the frame (`display: contents`, so it draws nothing), and React inserts before it instead.
 */
import type { ReactNode } from 'react'

export function BubbleMenuBox({ children }: { children: ReactNode }) {
  return <div className="deck-bubble-box" style={{ display: 'contents' }}>{children}</div>
}
