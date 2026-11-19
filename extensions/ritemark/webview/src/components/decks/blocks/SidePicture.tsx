/**
 * One picture editor (experience 49) for the slide's picture beside or behind its words (`picture:` left, right or
 * behind). It fills its place, so its bar has Place, Description, Comment and ⋯ but no size or crop; what stays in view
 * is its focus point, a dot dragged on the picture (`focus:` in the slide's header).
 *
 * A click on the picture chooses it (the accent ring); Esc, or a press anywhere else, leaves it; Backspace or Delete
 * removes it. Removed, the place stays, empty, and says "Choose, paste or drop a picture" (a click opens the file picker); only Picture: None takes the place
 * away. The picture's file is never touched.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { missingHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { readSideFocus } from '../../../../../src/markdown/pictureLook'
import { PictureBar, type PicturePlace } from '../../pictures/PictureBar'
import { Icon } from '../../ui/Icon'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'
import { copyPicture, stageBounds } from '../../pictures/PictureTools'
import type { SidePlace } from './slidePicturePlace'

// Sprint 167 PR 4: the picture Behind's corner chip is the picture's own too (its Choose keeps the picture chosen).
const OWN_LAYERS = '[data-radix-popper-content-wrapper], .picture-bar, .deck-behind-chip'

export interface SidePictureProps {
  side: SidePlace
  /** The picture's webview address, when it has one. */
  url?: string
  /** The path the slide names ('' for an empty place). */
  path: string
  /** The host looked for the file and didn't find it. */
  missing: boolean
  alt: string
  /** `focus:` as written (`40,30`). */
  focus?: string
  /** The stage is being edited (the empty place says what to do). */
  chosen: boolean
  comments: boolean
  onChoose: () => void
  onLeave: () => void
  onPlace: (place: PicturePlace) => void
  onWords: (alt: string) => void
  onComment: () => void
  onReplace: () => void
  /** ChatGPT: Make a new picture… or Change this picture… for this place. */
  onChatgpt?: (mode: 'new' | 'change') => void
  /** The side picture is a file in the project, so ChatGPT can change it. */
  chatgptCanChange?: boolean
  /** ChatGPT's field or strip is on this place: the bar gives it the place. */
  barHidden?: boolean
  onReveal: () => void
  onRemove: () => void
  onFocus: (focus: string) => void
}

export function SidePicture(props: SidePictureProps) {
  const { side, url, path, missing, alt, focus, chosen } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLSpanElement | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const [, redraw] = useState(0)

  // The latest callbacks, so the listeners below are set once while the picture is chosen (review of #774).
  const latest = useRef(props)
  latest.current = props

  // Esc leaves the picture, Backspace or Delete removes it; a press outside it and its bar leaves it. A key pressed in
  // the bar's own layers (its Description, its menu) is theirs (review of #774).
  useEffect(() => {
    if (!chosen) return
    const keys = (event: KeyboardEvent) => {
      const target = event.target as Element | null
      if (target?.closest?.(OWN_LAYERS)) return
      const typing = target?.closest?.('input, textarea, [contenteditable="true"]')
      if (event.key === 'Escape') { event.preventDefault(); latest.current.onLeave() }
      else if ((event.key === 'Backspace' || event.key === 'Delete') && !typing && latest.current.path) { event.preventDefault(); latest.current.onRemove() }
    }
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || ref.current?.contains(target) || target.closest(OWN_LAYERS)) return
      latest.current.onLeave()
    }
    // The bar follows the picture as the window or the deck scrolls (review of #774).
    const again = () => redraw(count => count + 1)
    window.addEventListener('keydown', keys, true)
    document.addEventListener('pointerdown', press, true)
    window.addEventListener('resize', again)
    window.addEventListener('scroll', again, true)
    return () => {
      window.removeEventListener('keydown', keys, true)
      document.removeEventListener('pointerdown', press, true)
      window.removeEventListener('resize', again)
      window.removeEventListener('scroll', again, true)
    }
  }, [chosen])

  const written = readSideFocus(focus)
  const point = draft ?? written ?? { x: 50, y: 50 }
  const position = draft || written ? `${point.x}% ${point.y}%` : undefined

  const focusAt = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    // A share of the place on the screen, the same at any scale of the slide.
    const x = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)))
    const y = Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)))
    return { x, y }
  }

  const classes = `photo${url ? '' : ' empty'}${missing ? ' is-missing' : ''}${chosen ? ' is-chosen' : ''}`
  return (
    <>
      {missing && path ? (
        // The renderer's own words for a missing picture (escaped there), so the stage and its thumbnail agree.
        <div ref={ref} className={classes} data-picture={path} dangerouslySetInnerHTML={{ __html: missingHtml(path) }} onPointerDown={event => { if (event.button === 0) props.onChoose() }} />
      ) : (
        <div
          ref={ref}
          className={classes}
          style={url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")`, backgroundPosition: position } : undefined}
          onPointerDown={event => {
            if (event.button !== 0) return
            event.preventDefault()
            props.onChoose()
            // An empty place opens the file picker at once (experience 49).
            if (!url && !missing) props.onReplace()
          }}
          // A double click on the picture chooses another one, as ⋯ → Replace picture… does.
          onDoubleClick={() => { if (url) props.onReplace() }}
        >
          {/* Sprint 167 PR 4 (decks README item D): an empty place Behind has no prompt in the middle, where it ran over
              the title; its Choose… and ChatGPT are on the corner chip (`BehindChip`). */}
          {!url && side !== 'behind' ? (
            <span className="photo-hint">
              <Icon name="image" size={20} tone="inherit" />
              Choose, paste or drop a picture
              {/* Experience 49: "or make one with ChatGPT", the hint's one part that doesn't open the file picker. */}
              {props.onChatgpt ? (
                <Tooltip label="Describe a picture and ChatGPT makes it">
                  <Button
                    type="button"
                    variant="link"
                    className="photo-make"
                    onPointerDown={event => {
                      event.stopPropagation()
                      if (event.button === 0) props.onChoose()
                    }}
                    onClick={event => {
                      event.stopPropagation()
                      props.onChatgpt?.('new')
                    }}
                  >
                    or make one with ChatGPT
                  </Button>
                </Tooltip>
              ) : null}
            </span>
          ) : null}
          {chosen && url ? (
            <span
              ref={dotRef}
              className="photo-focus"
              role="slider"
              // Sprint 167 PR 4: the bar's Focus brings the keyboard here; the arrow keys move what stays in view, 5 %
              // a press (1 % with Shift), each move one undo step.
              tabIndex={0}
              onKeyDown={event => {
                const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
                const step = steps[event.key]
                if (!step) return
                event.preventDefault()
                event.stopPropagation()
                const by = event.shiftKey ? 1 : 5
                const x = Math.max(0, Math.min(100, point.x + step[0] * by))
                const y = Math.max(0, Math.min(100, point.y + step[1] * by))
                if (x !== point.x || y !== point.y) props.onFocus(`${x},${y}`)
              }}
              aria-label="What stays in view"
              aria-valuetext={`${point.x}% across, ${point.y}% down`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onPointerDown={event => {
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.setPointerCapture(event.pointerId)
                dragging.current = true
              }}
              onPointerMove={event => {
                if (!dragging.current) return
                const next = focusAt(event)
                if (next) setDraft(next)
              }}
              onPointerUp={event => {
                if (!dragging.current) return
                dragging.current = false
                const next = focusAt(event) ?? draft
                setDraft(null)
                if (next && (!written || next.x !== written.x || next.y !== written.y)) props.onFocus(`${next.x},${next.y}`)
              }}
              onPointerCancel={() => { dragging.current = false; setDraft(null) }}
            />
          ) : null}
        </div>
      )}
      {/* The veil darkens the picture behind the words; a click on it chooses the picture. */}
      {side === 'behind' ? <div className="veil" style={{ pointerEvents: 'none' }} /> : null}
      {chosen ? (
        <PictureBar
          anchor={props.barHidden ? null : ref.current?.getBoundingClientRect() ?? null}
          // A side place: the bar inside it, at its bottom, kept on the slide's side (experience 49). Behind, it opens
          // under the slide (Sprint 167 PR 4, decks README item D), so it never sits over the slide's last words.
          inside={side !== 'behind'}
          bounds={ref.current ? stageBounds(ref.current) : undefined}
          context="slide"
          kind="side"
          look={{}}
          alt={alt}
          canCrop={false}
          crop={null}
          place={side}
          comments={props.comments}
          empty={!path}
          onSize={() => {}}
          onAlign={() => {}}
          onCrop={() => {}}
          onCropShape={() => {}}
          onCropReset={() => {}}
          onCropDone={() => {}}
          onCropCancel={() => {}}
          onPlace={props.onPlace}
          onWords={words => props.onWords(words)}
          onComment={props.onComment}
          onChatgpt={props.onChatgpt}
          chatgptCanChange={props.chatgptCanChange}
          onFocusPoint={url ? () => dotRef.current?.focus({ preventScroll: true }) : undefined}
          onReplace={props.onReplace}
          onCopy={() => {
            if (!url) return
            const image = new Image()
            image.src = url
            void copyPicture(image, null)
          }}
          onReveal={props.onReveal}
          onRemove={props.onRemove}
          onLeave={props.onLeave}
        />
      ) : null}
    </>
  )
}
