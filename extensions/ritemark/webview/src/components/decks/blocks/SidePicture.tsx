/**
 * One picture editor (experience 49) for the slide's picture beside or behind its words (`picture:` left, right or
 * behind). It fills its place, so its bar has Place, Description, Comment and ⋯ but no size or crop; what stays in view
 * is its focus point, a dot dragged on the picture (`focus:` in the slide's header).
 *
 * A click on the picture chooses it (the accent ring); Esc, or a press anywhere else, leaves it; Backspace or Delete
 * removes it. Removed, the place stays, empty, and says "Paste or drop a picture"; only Picture: None takes the place
 * away. The picture's file is never touched.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { missingHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { readSideFocus } from '../../../../../src/markdown/pictureLook'
import { PictureBar, type PicturePlace } from '../../pictures/PictureBar'
import { Icon } from '../../ui/Icon'
import { copyPicture, stageBounds } from '../../pictures/PictureTools'
import type { SidePlace } from './slidePicturePlace'

const OWN_LAYERS = '[data-radix-popper-content-wrapper], .picture-bar'

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
  onReveal: () => void
  onRemove: () => void
  onFocus: (focus: string) => void
}

export function SidePicture(props: SidePictureProps) {
  const { side, url, path, missing, alt, focus, chosen } = props
  const ref = useRef<HTMLDivElement | null>(null)
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
          }}
        >
          {!url ? (
            <span className="photo-hint">
              <Icon name="image" size={20} tone="inherit" />
              Paste or drop a picture
            </span>
          ) : null}
          {chosen && url ? (
            <span
              className="photo-focus"
              role="slider"
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
          anchor={ref.current?.getBoundingClientRect() ?? null}
          // A slide-wide place: the bar inside it, at its bottom, kept on the slide's side (experience 49).
          inside
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
