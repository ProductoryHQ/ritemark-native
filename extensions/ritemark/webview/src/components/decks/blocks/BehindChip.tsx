/**
 * Sprint 167 PR 4 (decks README item D, `block-details.html`; #838): the slide's picture Behind, reached from a corner
 * of the slide instead of a prompt in its middle, where it ran over the title.
 *
 *  - **Empty:** at rest a small round picture handle, like the block's other white handles; while the pointer is over
 *    the slide (or the place is chosen, or the keyboard is in it) it opens into "Picture behind · Choose… · ChatGPT".
 *  - **With a picture:** nothing at rest, since the picture shows itself; while the pointer is over the slide the chip
 *    "Picture behind · Choose" comes, and Choose chooses the picture, so it can be reached when words cover the slide.
 *
 * Its corner and size come from `behindChipPlace.ts`: it lies between the slide's edge and its words' box, so it never covers
 * a word or takes its click. A press on it keeps the slide's caret where it is.
 */
import type { CSSProperties } from 'react'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import type { ChipPlace } from './behindChipPlace'

export interface BehindChipProps {
  place: ChipPlace
  /** The place holds a picture (or names one whose file is missing). */
  filled: boolean
  /** The place is chosen: the chip stays open. */
  keep: boolean
  /** Empty: the file picker. With a picture: the picture chosen, its ring and bar. */
  onChoose: () => void
  /** Empty: ChatGPT makes a picture for the place. */
  onChatgpt?: () => void
}

export function BehindChip({ place, filled, keep, onChoose, onChatgpt }: BehindChipProps) {
  const style = {
    '--chip-edge': `${place.edge}px`,
    '--chip-right': `${place.right}px`,
    '--chip-scale': String(place.scale),
  } as CSSProperties
  return (
    <div
      role="group"
      aria-label="Picture behind"
      className={`deck-behind-chip is-${place.corner} ${filled ? 'is-filled' : 'is-empty'}${keep ? ' is-keep' : ''}`}
      style={style}
      // The slide's words keep their caret and the picture its choice: a press on the chip is the chip's own.
      onMouseDown={event => event.preventDefault()}
      onPointerDown={event => event.stopPropagation()}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation() }}
    >
      <span className="deck-behind-chip-dot" aria-hidden="true">
        <Icon name="image" size={14} tone="inherit" />
      </span>
      <span className="deck-behind-chip-full">
        <span className="deck-behind-chip-words">Picture behind</span>
        <Tooltip label={filled ? 'Choose the picture behind the words: its bar has Focus, Place, Description and Replace' : 'Choose a picture from the computer, or paste or drop one anywhere on the slide'}>
          <Button type="button" variant="ghost" size="compact" className="deck-behind-chip-button" onClick={onChoose}>
            {filled ? 'Choose' : 'Choose…'}
          </Button>
        </Tooltip>
        {!filled && onChatgpt ? (
          <Tooltip label="Describe a picture and ChatGPT makes it">
            <Button type="button" variant="ghost" size="compact" className="deck-behind-chip-button" onClick={onChatgpt}>
              <Icon name="sparkle" size={12} tone="inherit" />
              ChatGPT
            </Button>
          </Tooltip>
        ) : null}
      </span>
    </div>
  )
}
