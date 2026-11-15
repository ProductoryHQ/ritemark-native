/**
 * Sprint 157 (README frame 2): the strip of numbered thumbnails on the left.
 *
 *  - A click (or ↑ ↓) makes a slide the current one; the handout scrolls to its part.
 *  - Pointing between two thumbnails shows a +; it opens the prototype's small menu: New slide (Boxes or Points) and
 *    New exercise (the Experience lead's answer 5). "New slide" under the last one does the same at the end.
 *  - Each thumbnail's menu (its ⋯, or a right-click): Duplicate, Skip slide or Show slide, Delete slide. Delete asks
 *    nothing and has Undo (answer 6).
 *  - Dragging a thumbnail reorders, one transaction per move, with a line where it lands.
 *  - A skipped slide is dimmed with an eye; a library copy with a newer version has an amber dot (PR 4).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { SlideData } from '../../../../src/decks/deckFormat'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, MoreActionsTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import type { DeckSlideEntry } from './deckDocument'
import { SlideCanvas } from './slide/SlideCanvas'

const THUMB_WIDTH = 96
/** How far a pointer moves before a press becomes a drag. */
const DRAG_THRESHOLD = 4

export interface StripActions {
  pick: (index: number) => void
  /** A new slide of `kind` before part `at` (the count: at the end). */
  insert: (at: number, kind: string) => void
  duplicate: (index: number) => void
  toggleSkip: (index: number) => void
  remove: (index: number) => void
  /** Move part `from` to stand before part `to`. */
  move: (from: number, to: number) => void
  /** The strip menu's Add to library… and Show in the library. */
  addToLibrary: (index: number) => void
  showInLibrary: (index: number) => void
}

/** What the strip shows of a copy's source: from a library topic, and whether the library has a newer version. */
export interface StripMark {
  library: boolean
  newer: boolean
}

/** A new slide takes the caret in its title: the menu doesn't hand the focus back to its + when it closes. */
const keepFocusOnNewSlide = (event: Event) => event.preventDefault()

/** The prototype's small menu for a new slide (the Experience lead's answer 5: it opens a menu, it adds nothing by itself). */
function NewSlideItems({ at, actions }: { at: number; actions: StripActions }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => actions.insert(at, 'boxes')}>
        <Icon name="squares-four" size={14} tone="inherit" />
        <span className="flex-1">New slide</span>
        <span className="deck-menu-sub">Boxes</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.insert(at, 'points')}>
        <Icon name="list" size={14} tone="inherit" />
        <span className="flex-1">New slide</span>
        <span className="deck-menu-sub">Points</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.insert(at, 'exercise')}>
        <Icon name="list-checks" size={14} tone="inherit" />
        New exercise
      </DropdownMenuItem>
    </>
  )
}

/** The + between two thumbnails, at gap `at` (before part `at`). */
function Gap({ at, count, actions, dropHere }: { at: number; count: number; actions: StripActions; dropHere: boolean }) {
  const where = at === 0 ? 'Add before slide 1' : `Add after slide ${at}`
  return (
    <div className={`deck-gap${dropHere ? ' is-drop' : ''}`} data-gap={at}>
      {at < count ? (
        <DropdownMenu modal={false}>
          <Tooltip label="Add slides here">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" className="deck-gap-plus" aria-label={where}>
                <Icon name="plus" size={12} tone="inherit" />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="start" side="right" onCloseAutoFocus={keepFocusOnNewSlide}>
            <div className="deck-menu-head">{where}</div>
            <NewSlideItems at={at} actions={actions} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

interface ThumbnailProps {
  entry: DeckSlideEntry
  count: number
  current: boolean
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  actions: StripActions
  dragging: boolean
  onDragStart: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void
  /** The menu, open or closed; the strip opens it from the keyboard too. */
  menuOpen: boolean
  onMenuOpen: (index: number | null) => void
  /** A copy of a library slide; the amber dot when the library has a newer version (README frame 4). */
  fromLibrary: boolean
  newer: boolean
}

/** One numbered thumbnail, with its menu. */
const Thumbnail = memo(function Thumbnail({ entry, count, current, theme, borderless, assets, actions, dragging, onDragStart, menuOpen, onMenuOpen, fromLibrary, newer }: ThumbnailProps) {
  const { index, kind, data } = entry
  const skipped = data.skip === true
  return (
    <div
      role="option"
      aria-selected={current}
      aria-label={`Slide ${index + 1}${data.title ? `: ${data.title}` : ''}${skipped ? ', skipped' : ''}${newer ? ', the library has a newer version' : ''}`}
      data-thumb={index}
      className={`deck-thumb${current ? ' is-current' : ''}${skipped ? ' is-skip' : ''}${dragging ? ' is-dragging' : ''}${menuOpen ? ' is-menu' : ''}`}
      onPointerDown={event => onDragStart(index, event)}
      onClick={() => actions.pick(index)}
      onContextMenu={event => {
        event.preventDefault()
        onMenuOpen(entry.index)
      }}
    >
      <span className="deck-thumb-no">{index + 1}</span>
      <div className="deck-thumb-slide">
        <SlideCanvas kind={kind} data={data as SlideData} width={THUMB_WIDTH} theme={theme} borderless={borderless} assets={assets} />
      </div>
      {skipped ? <span className="deck-thumb-eye"><Icon name="eye-slash" size={12} tone="inherit" /></span> : null}
      {newer ? (
        // The tooltip's own wrapper is the dot: a child inside it would join the thumbnail's row and push the slide over.
        <Tooltip label="The library has a newer version" className="deck-thumb-dot">{null}</Tooltip>
      ) : null}
      <div className="deck-thumb-more" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={open => onMenuOpen(open ? entry.index : null)}>
          <MoreActionsTrigger label={`Slide ${index + 1}: more actions`} />
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onSelect={() => actions.duplicate(index)}>
              <Icon name="copy" size={14} tone="inherit" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.toggleSkip(index)}>
              <Icon name={skipped ? 'eye' : 'eye-slash'} size={14} tone="inherit" />
              {skipped ? 'Show slide' : 'Skip slide'}
            </DropdownMenuItem>
            {fromLibrary ? (
              <DropdownMenuItem onSelect={() => actions.showInLibrary(index)}>
                <Icon name="books" size={14} tone="inherit" />
                Show in the library
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => actions.addToLibrary(index)}>
                <Icon name="books" size={14} tone="inherit" />
                Add to library…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" disabled={count < 2} onSelect={() => actions.remove(index)}>
              <Icon name="trash" size={14} tone="inherit" />
              Delete slide
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

interface SlideStripProps {
  slides: DeckSlideEntry[]
  current: number
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  actions: StripActions
  stripRef: React.RefObject<HTMLDivElement>
  /** Each copy's source marks, by the slide's id. */
  marks: Record<string, StripMark>
}

export function SlideStrip({ slides, current, theme, borderless, assets, actions, stripRef, marks }: SlideStripProps) {
  const count = slides.length
  const [drag, setDrag] = useState<{ from: number; to: number | null } | null>(null)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const suppressClick = useRef(false)

  /** The gap nearest the pointer: before the thumbnail whose middle is below it. */
  const gapAt = (clientY: number): number => {
    const strip = stripRef.current
    if (!strip) return count
    const thumbs = Array.from(strip.querySelectorAll<HTMLElement>('[data-thumb]'))
    for (let index = 0; index < thumbs.length; index++) {
      const box = thumbs[index].getBoundingClientRect()
      if (clientY < box.top + box.height / 2) return index
    }
    return count
  }

  /** The drag under way, so a second press never starts another one beside it. */
  const dragSession = useRef<(() => void) | null>(null)

  const startDrag = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragSession.current) return
    const startY = event.clientY
    const pointerId = event.pointerId
    let moved = false
    // On the window, so the drag ends however the pointer leaves the thumbnail.
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      if (!moved && Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD) return
      moved = true
      setDrag({ from: index, to: gapAt(moveEvent.clientY) })
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      dragSession.current = null
    }
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      end()
      if (!moved) return
      // The click that ends a drag picks nothing; when none comes, the next real click still counts.
      suppressClick.current = true
      window.setTimeout(() => { suppressClick.current = false }, 0)
      setDrag(null)
      actions.move(index, gapAt(upEvent.clientY))
    }
    const cancel = () => {
      end()
      setDrag(null)
    }
    dragSession.current = cancel
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  // A drag under way when the strip goes ends with it.
  useEffect(() => () => dragSession.current?.(), [])

  // Stable for the memoised thumbnails: the latest drag start, through a ref.
  const startDragRef = useRef(startDrag)
  startDragRef.current = startDrag
  const onDragStart = useCallback((index: number, event: ReactPointerEvent<HTMLDivElement>) => startDragRef.current(index, event), [])
  const pickUnlessDragged: StripActions = useMemo(() => ({
    ...actions,
    pick: (index: number) => {
      // A drag ends with a click on the thumbnail it started on: that click picks nothing.
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      actions.pick(index)
    },
  }), [actions])

  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (count === 0 || event.target !== event.currentTarget) return
    if (event.key === 'Home') { event.preventDefault(); actions.pick(0); return }
    if (event.key === 'End') { event.preventDefault(); actions.pick(count - 1); return }
    // The current slide's menu, as a right-click opens it: Shift+F10 or the menu key.
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) { event.preventDefault(); setMenuFor(current); return }
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    actions.pick(Math.max(0, Math.min(count - 1, current + step)))
  }

  const dropAt = drag && drag.to !== null && drag.to !== drag.from && drag.to !== drag.from + 1 ? drag.to : null

  return (
    <div
      ref={stripRef}
      className={`deck-strip${borderless ? ' is-borderless' : ''}`}
      role="listbox"
      aria-label="Slides"
      tabIndex={0}
      onKeyDown={onKey}
    >
      {slides.map(entry => (
        <div key={entry.index}>
          <Gap at={entry.index} count={count} actions={actions} dropHere={dropAt === entry.index} />
          <Thumbnail
            entry={entry}
            count={count}
            current={entry.index === current}
            theme={theme}
            borderless={borderless}
            assets={assets}
            actions={pickUnlessDragged}
            dragging={drag?.from === entry.index}
            onDragStart={onDragStart}
            menuOpen={menuFor === entry.index}
            onMenuOpen={setMenuFor}
            fromLibrary={!!(entry.data.id && marks[entry.data.id]?.library)}
            newer={!!(entry.data.id && marks[entry.data.id]?.newer)}
          />
        </div>
      ))}
      <Gap at={count} count={count} actions={actions} dropHere={dropAt === count} />
      <DropdownMenu modal={false}>
        <Tooltip label="Add a slide at the end">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="deck-add-end">
              <Icon name="plus" size={14} tone="inherit" />
              New slide
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" side="right" onCloseAutoFocus={keepFocusOnNewSlide}>
          <div className="deck-menu-head">Add at the end</div>
          <NewSlideItems at={count} actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
