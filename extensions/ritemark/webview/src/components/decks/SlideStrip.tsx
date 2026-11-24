/**
 * Sprint 157 (README frame 2): the strip of numbered thumbnails on the left.
 *
 *  - A click (or ↑ ↓) makes a slide the current one; the handout scrolls to its part.
 *  - Pointing between two thumbnails shows a +; it opens the prototype's small menu (the Experience lead's answer 5).
 *    Since Sprint 161's PR 3 its first item is New slide: an empty block slide, its title taking the caret; its blocks
 *    come from the slide's / menu (frame 22), so the menu no longer offers a layout (Boxes, Points, New exercise). From
 *    the library and From another deck stay. "New slide" under the last one does the same at the end.
 *  - Each thumbnail's menu (its ⋯, or a right-click): Duplicate, Skip slide or Show slide, Add to library…, Copy as
 *    picture, Slide
 *    settings… (17 November: the popover beside the thumbnail; the gear left the bar), Delete slide. Delete asks
 *    nothing and has Undo (answer 6). Backspace or Delete does the same to the selected slide (`stripKeys.ts`). The
 *    handout part number's ⋯ is the same menu (`SlideMenuItems`). Cmd+D duplicates the selected slide, and Cmd+↑ and
 *    Cmd+↓ move it with its handout part (17 November; Ctrl on Windows); its menu has them as Move up and Move down.
 *  - Undo that changes a slide which isn't the current one makes it current, and its thumbnail flashes once.
 *  - Dragging a thumbnail reorders, one transaction per move, with a line where it lands.
 *  - Several pictures dragged from the computer onto the strip show the same line, and dropped there make a Picture
 *    slide each (`stripPictures.ts`, item 8). A single picture is left to whatever took it before.
 *  - The menu's Copy as picture puts a 1920 × 1080 PNG of the slide on the clipboard (`slidePicture.tsx`, item 15).
 *  - A skipped slide is dimmed with an eye. A library copy carries the library's badge at its bottom left (17 November,
 *    replacing PR 4's amber dot): quiet, and amber when it was changed here or the library has a newer version.
 */
import { clockMinutes, explicitMinutes, sessionLengthFromEnd, type SessionTimeField, type Timetable } from '../../../../src/decks/timetable'
import { nextMinutesRow, slideMinutesText, timetableFoot, timetableRows } from '../../../../src/decks/timetableDisplay'
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { isBlockSlide, type SlideData } from '../../../../src/decks/deckFormat'
import { slideCommentCount } from '../../../../src/decks/blocks/slideComments'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { lengthMinutesOf } from '../../../../src/decks/present/presentSession'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useDismissOnOutside } from '../../lib/dismissOnOutside'
import { draftMinutes } from './DeckMinutes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, MoreActionsTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { isMac } from '../../hooks/usePlatform'
import type { DeckSlideEntry } from './deckDocument'
import { SlideCanvas } from './slide/SlideCanvas'
import { useSlidesMakingPictures } from '../pictures/ChatgptPicture'
import { slidePictureKey } from '../pictures/picturesAway'
import { keyOrigin, stripKeyOf } from './stripKeys'
import { slideMenuItems, type SlideMenuActions } from './slideMenuItems'
import { STRIP_PICTURES_MIN, draggedPictureCount, droppedPictures } from './stripPictures'

const THUMB_WIDTH = 96
/** The key beside the menu's Delete slide, so people can find it. */
const DELETE_KEY = isMac ? '⌫' : 'Del'
/** And beside Duplicate (17 November: Cmd+D on the strip or the stage). */
const DUPLICATE_KEY = isMac ? '⌘D' : 'Ctrl+D'
/** And beside Move up and Move down (18 November): the strip's Cmd+↑ and Cmd+↓. */
const UP_KEY = isMac ? '⌘↑' : 'Ctrl+↑'
const DOWN_KEY = isMac ? '⌘↓' : 'Ctrl+↓'
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
  /** Cmd+↑ (-1) or Cmd+↓ (+1): slide `index` one place up or down, with its handout part; nothing at the ends. */
  nudge: (index: number, step: -1 | 1) => void
  /** The + menu's From the library… and From another deck…: the Slide library opens, inserting before part `at`. */
  fromLibrary: (at: number, section: 'topics' | 'other') => void
  /** The strip menu's Add to library… and Show in the library. */
  addToLibrary: (index: number) => void
  showInLibrary: (index: number) => void
  /** Cmd+Z / Cmd+Shift+Z on the strip: the deck's history, as on the stage, so a slide deleted from the keyboard comes back. */
  undo: (redo: boolean) => void
  /** The menu's Slide settings… (17 November): the popover beside the thumbnail it came from. */
  settings: (index: number) => void
  /** The menu's Copy as picture (item 15). */
  copyPicture: (index: number) => void
  /** Item 8: several pictures dropped on the strip, before part `at`, a Picture slide each in the files' order. */
  dropPictures: (at: number, files: File[]) => void
}

/** What the strip shows of a copy's source: from a library topic, changed in this deck, or newer in the library. */
export interface StripMark {
  library: boolean
  newer: boolean
  changed?: boolean
}

/** The badge's tooltip, and whether it is amber (the Experience lead, 17 November). */
export function libraryBadge(mark: StripMark | undefined): { label: string; amber: boolean } | null {
  if (!mark?.library) return null
  if (mark.changed) return { label: 'From the library, changed in this deck', amber: true }
  if (mark.newer) return { label: 'From the library, which has a newer version', amber: true }
  return { label: 'From the library', amber: false }
}

/** A new slide takes the caret in its title: the menu doesn't hand the focus back to its + when it closes. */
const keepFocusOnNewSlide = (event: Event) => event.preventDefault()

/** Sprint 161: a slide's comment count for its dot: a block slide's comments with words (an old slide has none). */
export function stripCommentCount(entry: Pick<DeckSlideEntry, 'kind' | 'data'>): number {
  return isBlockSlide(entry.kind) ? slideCommentCount(entry.data.markdown ?? '') : 0
}

/**
 * The prototype's small menu for a new slide (the Experience lead's answer 5: it opens a menu, it adds nothing by
 * itself). Sprint 161 (PR 3): New slide, an empty block slide whose blocks come from its / menu; no layout to choose.
 */
function NewSlideItems({ at, actions }: { at: number; actions: StripActions }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => actions.insert(at, '')}>
        <Icon name="plus-square" size={14} tone="inherit" />
        New slide
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => actions.fromLibrary(at, 'topics')}>
        <Icon name="cards-three" size={14} tone="inherit" />
        From the library…
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.fromLibrary(at, 'other')}>
        <Icon name="presentation" size={14} tone="inherit" />
        From another deck…
      </DropdownMenuItem>
    </>
  )
}

/**
 * A slide's menu items, the same wherever the menu opens: the thumbnail's ⋯ (or a right-click) and the handout part
 * number's ⋯ (experience 46, "Removing a slide from the handout"). `slideMenuItems` is the list; each acts on that slide.
 */
export function SlideMenuItems({ index, count, skipped, fromLibrary, actions }: { index: number; count: number; skipped: boolean; fromLibrary: boolean; actions: SlideMenuActions }) {
  return (
    <>
      {slideMenuItems({ index, count, skipped, fromLibrary, deleteKey: DELETE_KEY, duplicateKey: DUPLICATE_KEY, upKey: UP_KEY, downKey: DOWN_KEY }).map(item => {
        const row = (
          <DropdownMenuItem tone={item.danger ? 'danger' : undefined} disabled={item.disabled} onSelect={() => item.run(actions)} className={item.disabledTip ? 'w-full' : undefined}>
            <Icon name={item.icon} size={14} tone="inherit" />
            {item.keyHint ? <span className="flex-1">{item.label}</span> : item.label}
            {item.keyHint ? <span className="deck-menu-key">{item.keyHint}</span> : null}
          </DropdownMenuItem>
        )
        return (
          <Fragment key={item.key}>
            {item.separated ? <DropdownMenuSeparator /> : null}
            {/* An item that is off says why (Move up on the first slide, Move down on the last). */}
            {item.disabled && item.disabledTip ? <Tooltip label={item.disabledTip} side="right" className="flex w-full">{row}</Tooltip> : row}
          </Fragment>
        )
      })}
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
  minutesLabel: string | null
  current: boolean
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  /** 17 November: pictures the host found no file for, drawn as missing with their names. */
  missing?: ReadonlySet<string>
  actions: StripActions
  dragging: boolean
  onDragStart: (index: number, event: ReactPointerEvent<HTMLDivElement>) => void
  /** The menu, open or closed; the strip opens it from the keyboard too. */
  menuOpen: boolean
  onMenuOpen: (index: number | null) => void
  /** Where the focus goes when the menu closes: the strip, so its keys work at once (Backspace, the arrows). */
  onMenuCloseFocus: (event: Event) => void
  /** A copy of a library slide: its badge's tooltip (its menu then has Show in the library), and whether it is amber. */
  badgeLabel: string | null
  badgeAmber: boolean
  /** Sprint 161: how many comments are on the slide (its amber dot); 0 for none. */
  comments: number
  /** The handout's first Backspace marks this slide to be joined into the one above: it lights up. */
  joining: boolean
  /** Undo just changed this slide: a serial (0: none), so each undo flashes it once more. */
  flash: number
  /** ChatGPT is making a picture for this slide (shown or left): a quiet spinner in its corner until it lands or stops. */
  makingPicture: boolean
}

/** One numbered thumbnail, with its menu. */
const Thumbnail = memo(function Thumbnail({ entry, count, minutesLabel, current, theme, borderless, assets, missing, actions, dragging, onDragStart, menuOpen, onMenuOpen, onMenuCloseFocus, badgeLabel, badgeAmber, comments, joining, flash, makingPicture }: ThumbnailProps) {
  const { index, kind, data } = entry
  const skipped = data.skip === true
  const fromLibrary = badgeLabel !== null
  return (
    <div
      role="option"
      aria-selected={current}
      aria-label={`Slide ${index + 1}${data.title ? `: ${data.title}` : ''}${skipped ? ', skipped' : ''}${minutesLabel ? `, ${minutesLabel}` : ''}${badgeLabel ? `, ${badgeLabel.toLowerCase()}` : ''}${makingPicture ? ', ChatGPT is making a picture' : ''}`}
      data-thumb={index}
      className={`deck-thumb${current ? ' is-current' : ''}${skipped ? ' is-skip' : ''}${dragging ? ' is-dragging' : ''}${menuOpen ? ' is-menu' : ''}${joining ? ' is-join' : ''}`}
      onPointerDown={event => onDragStart(index, event)}
      onDragStart={event => event.preventDefault()}
      onClick={() => actions.pick(index)}
      onContextMenu={event => {
        event.preventDefault()
        onMenuOpen(entry.index)
      }}
    >
      <span className="deck-thumb-no">{index + 1}</span>
      <div className="deck-thumb-slide">
        <SlideCanvas kind={kind} data={data as SlideData} width={THUMB_WIDTH} theme={theme} borderless={borderless} assets={assets} missing={missing} />
        {minutesLabel ? (
          <Tooltip label={`${minutesLabel} planned`} className="deck-thumb-minutes">
            <span aria-hidden="true">{minutesLabel}</span>
          </Tooltip>
        ) : null}
        {/* Keyed by the serial: a second undo of the same slide plays it again. None under reduced motion (decks.css). */}
        {flash ? <span key={flash} className="deck-thumb-flash" aria-hidden="true" /> : null}
      </div>
      {makingPicture ? (
        // The Experience lead on #803: a quiet circle in the accent, still under Reduce motion (decks.css). No toast; a
        // screen reader hears it in the slide's own name.
        <Tooltip label="ChatGPT is making a picture" className="deck-thumb-making">
          <span aria-hidden="true" />
        </Tooltip>
      ) : null}
      {skipped ? <span className="deck-thumb-eye"><Icon name="eye-slash" size={12} tone="inherit" /></span> : null}
      {comments > 0 ? (
        // Sprint 161: the slide's comments, counted on the strip only (the thumbnails people see draw none).
        <Tooltip label={comments === 1 ? '1 comment on this slide' : `${comments} comments on this slide`} className={`deck-thumb-comments${minutesLabel ? ' has-minutes' : ''}`}>
          <span>{comments}</span>
        </Tooltip>
      ) : null}
      {badgeLabel ? (
        // The tooltip's own wrapper is placed (absolute), so the badge never joins the thumbnail's row.
        <Tooltip label={badgeLabel} className={`deck-thumb-badge${badgeAmber ? ' is-amber' : ''}`}>
          <span><Icon name="cards-three" size={12} tone="inherit" /></span>
        </Tooltip>
      ) : null}
      <div className="deck-thumb-more" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={open => onMenuOpen(open ? entry.index : null)}>
          <MoreActionsTrigger label={`Slide ${index + 1}: more actions`} className="deck-thumb-more-button" />
          <DropdownMenuContent align="start" side="right" onCloseAutoFocus={onMenuCloseFocus}>
            <SlideMenuItems index={index} count={count} skipped={skipped} fromLibrary={fromLibrary} actions={actions} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

/** How wide the lifted copy is: the prototype's 120 pixels, the thumbnail's 96 scaled up. */
const GHOST_WIDTH = 120

/** The prototype's drag ghost: a copy of the thumbnail's slide, a little larger and tilted, under the pointer. */
function liftedCopy(thumb: HTMLElement): HTMLElement | null {
  const slide = thumb.querySelector<HTMLElement>('.deck-thumb-slide')
  if (!slide) return null
  const ghost = document.createElement('div')
  ghost.className = 'deck-drag-ghost'
  ghost.setAttribute('aria-hidden', 'true')
  const copy = slide.cloneNode(true) as HTMLElement
  copy.style.transform = `scale(${GHOST_WIDTH / THUMB_WIDTH})`
  ghost.appendChild(copy)
  // Inside the deck view, so the copy keeps its fonts; fixed, so it is placed against the window.
  const home = thumb.closest('.deck-view') ?? document.body
  home.appendChild(ghost)
  return ghost
}

interface SlideStripProps {
  slides: DeckSlideEntry[]
  timing: Timetable
  mode: 'thumbnails' | 'list'
  onMode: (mode: 'thumbnails' | 'list') => void
  onPickTimedSlide: (index: number) => void
  onMinutes: (index: number, value: string | undefined) => void
  onSession: (field: SessionTimeField, value: string) => void
  current: number
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  missing?: ReadonlySet<string>
  actions: StripActions
  stripRef: React.RefObject<HTMLDivElement>
  /** Each copy's source marks, by the slide's id. */
  marks: Record<string, StripMark>
  /** Sprint 161: count each slide's comments in its dot (the comment flag on). */
  commentCounts?: boolean
  /** The slide the handout's first Backspace marked to join into the one above (null: none). */
  joinAt?: number | null
  /** The slide an undo just changed, to flash once (null: none). */
  flash?: { index: number; serial: number } | null
}

const sessionFields = {
  start: { placeholder: 'Start', tip: "Set the session's start. The rows then show clock times." },
  length: { placeholder: 'Length', tip: "The session's length in minutes. The presenter view uses it too." },
  end: { placeholder: 'End', tip: "Set the session's end. Ritemark keeps it as the session's length." },
}

function SessionTime({ field, value, display, start, onSave }: {
  field: SessionTimeField
  value: string | null
  display?: string | null
  start?: number | null
  onSave: (field: SessionTimeField, value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const closing = useRef(false)
  const editing = draft !== null
  useLayoutEffect(() => {
    if (editing) {
      closing.current = false
      input.current?.focus()
      input.current?.select()
    } else if (returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus({ preventScroll: true })
    }
  }, [editing])
  useDismissOnOutside(input, () => input.current?.blur(), { enabled: editing })

  const label = `Session ${field}`
  const { placeholder, tip } = sessionFields[field]
  if (draft === null) return (
    <Tooltip label={tip}>
      <Button ref={trigger} variant="ghost" size="compact" className="deck-session-time" aria-label={`${label}${value ? ` ${value}` : ''}`} onClick={() => setDraft(value ?? '')}>
        {display ?? value ?? placeholder}
      </Button>
    </Tooltip>
  )

  const minutes = clockMinutes(draft)
  const valid = field === 'length' ? draft === '' || lengthMinutesOf(draft) !== null
    : field === 'start' ? draft === '' || minutes !== null
    : minutes !== null && sessionLengthFromEnd(start ?? null, minutes) !== null
  const close = (save: boolean) => {
    if (closing.current) return
    closing.current = true
    setDraft(null)
    if (save && valid && draft !== value) onSave(field, draft)
  }
  return (
    <>
      <Tooltip label={tip} hoverOnly>
        <Input ref={input} className="deck-session-input" aria-label={label} aria-invalid={!valid}
          inputMode={field === 'length' ? 'numeric' : undefined} placeholder={field === 'length' ? placeholder : 'HH:MM'}
          value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => close(true)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
            event.preventDefault()
            event.stopPropagation()
            if (event.key === 'Enter' && !valid) return
            returnFocus.current = true
            close(event.key === 'Enter')
          }}
        />
      </Tooltip>
      {field === 'length' && <span>min</span>}
    </>
  )
}

function MinutesCell({ index, minutes, fromLabel, onPick, onSave, onMove }: {
  index: number
  minutes: number | null
  fromLabel: boolean
  onPick: () => void
  onSave: (value: string | undefined) => void
  onMove: (backwards: boolean) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const cancel = useRef(false)
  useDismissOnOutside(input, () => input.current?.blur(), { enabled: focused })
  const value = draft === null ? null : draftMinutes(draft)
  return (
    <Tooltip label={fromLabel ? 'From the exercise label. Click to change.' : 'Whole minutes, 0 to 1440. Press Return for the next slide.'} hoverOnly>
      <Input
        ref={input}
        className="deck-list-minutes"
        data-minutes-row={index}
        inputMode="numeric"
        aria-label={`Slide ${index + 1} minutes`}
        aria-invalid={draft !== null && value === null}
        value={draft ?? (minutes === null ? '' : String(minutes))}
        onFocus={event => {
          cancel.current = false
          setFocused(true)
          event.currentTarget.select()
          onPick()
        }}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          setFocused(false)
          setDraft(null)
          if (!cancel.current && value !== null && value !== (minutes === null ? undefined : String(minutes))) onSave(value)
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Enter' && draft !== null && value === null) return
          cancel.current = event.key === 'Escape'
          event.currentTarget.blur()
          if (!cancel.current) onMove(event.shiftKey)
        }}
      />
    </Tooltip>
  )
}

function TimedRows({ slides, timing, current, onPickTimedSlide, onMinutes, onSession }: SlideStripProps) {
  const rowsRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => timetableRows(timing), [timing])
  const foot = timetableFoot(timing)
  useLayoutEffect(() => {
    rowsRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const move = (index: number, backwards: boolean) => {
    const next = nextMinutesRow(timing.slides, index, backwards)
    if (next !== null) rowsRef.current?.querySelector<HTMLInputElement>(`[data-minutes-row="${next}"]`)?.focus()
  }

  return (
    <>
      <div ref={rowsRef} className="deck-list-rows" aria-label="Slide timings" role="group">
        {rows.map(row => {
          const entry = slides[row.index]
          const title = entry.data.title?.replace(/\s+/g, ' ').trim() || 'Untitled slide'
          return (
            <div key={entry.data.id ?? row.index} className={`deck-list-row${row.skipped ? ' is-skip' : ''}${row.sectionMinutes !== null ? ' is-section' : ''}`}
              aria-current={row.index === current ? 'true' : undefined}>
              <Tooltip label={title} hoverOnly className="deck-list-title">
                <Button variant="ghost" size="compact" className="deck-list-pick"
                  aria-label={`Slide ${row.index + 1}: ${title}${row.skipped ? ', skipped' : ''}`}
                  onClick={() => onPickTimedSlide(row.index)}>
                  <span className="deck-list-no">{row.index + 1}</span>
                  <span className="deck-list-name">{title}</span>
                </Button>
              </Tooltip>
              <span className="deck-list-start">{row.start}</span>
              {row.sectionMinutes !== null
                ? <span className="deck-list-sum" aria-label={`Section total ${row.sectionMinutes} minutes`}>{row.sectionMinutes}</span>
                : <MinutesCell index={row.index} minutes={row.minutes} fromLabel={row.labelMinutes !== null && explicitMinutes(entry.data.time) === null}
                    onPick={() => onPickTimedSlide(row.index)} onSave={value => onMinutes(row.index, value)} onMove={backwards => move(row.index, backwards)} />}
            </div>
          )
        })}
      </div>
      <div className="deck-list-foot">
        <div className="deck-list-total">{foot.count} · {foot.total}</div>
        <div className="deck-list-session">
          <span className="deck-list-times">
            Session{' '}
            {foot.start === null && <SessionTime field="length" display={foot.length}
              value={timing.sessionMinutes === null ? null : String(timing.sessionMinutes)} onSave={onSession} />}
            <SessionTime field="start" value={foot.start} onSave={onSession} />
            {foot.start !== null && <> to <SessionTime field="end" value={foot.end} start={timing.sessionStart} onSave={onSession} /></>}
          </span>
          {foot.comparison && <span className={foot.over ? 'is-over' : undefined}>{foot.comparison}</span>}
        </div>
        {foot.untimed && <div>{foot.untimed}</div>}
        <div>Type the minutes, then ↵ for the next slide.</div>
      </div>
    </>
  )
}

export function SlideStrip(props: SlideStripProps) {
  const { mode, onMode } = props
  return (
    <div className={`deck-strip-panel${mode === 'list' ? ' is-list' : ''}`}>
      <div className="deck-strip-head">
        <div className="deck-strip-switch" role="group" aria-label="Slide strip view">
          {([
            ['thumbnails', 'Slide thumbnails', 'squares-four'],
            ['list', 'Timed slide list', 'list'],
          ] as const).map(([value, label, icon]) => (
            <Tooltip key={value} label={label}>
              <Button variant="toolbar" size="icon-xs" aria-label={label} aria-pressed={mode === value}
                data-state={mode === value ? 'active' : undefined} onClick={() => onMode(value)}>
                <Icon name={icon} size={14} tone="inherit" />
              </Button>
            </Tooltip>
          ))}
        </div>
        {mode === 'list' && <><span>Starts</span><span>Min</span></>}
      </div>
      {mode === 'list' ? <TimedRows {...props} /> : <Thumbnails {...props} />}
    </div>
  )
}

function Thumbnails({ slides, timing, current, theme, borderless, assets, missing, actions, stripRef, marks, commentCounts, joinAt = null, flash = null }: SlideStripProps) {
  const count = slides.length
  const [drag, setDrag] = useState<{ from: number; to: number | null } | null>(null)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const makingPictures = useSlidesMakingPictures()
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

  /** Over the strip, with the prototype's margins: a little to its left, more to its right. */
  const overStrip = (event: PointerEvent): boolean => {
    const box = stripRef.current?.getBoundingClientRect()
    return !!box && event.clientX >= box.left - 20 && event.clientX <= box.right + 40 && event.clientY >= box.top && event.clientY <= box.bottom
  }

  /** The drag under way, so a second press never starts another one beside it. */
  const dragSession = useRef<(() => void) | null>(null)

  const startDrag = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragSession.current) return
    // The press is the drag's: no text selection across the thumbnails, and no native drag of their words or pictures,
    // which would take the pointer away (Jarmo, 15 November: slides could not be dragged). The strip takes the focus
    // the press would have given it, so the arrow keys still work.
    event.preventDefault()
    stripRef.current?.focus({ preventScroll: true })
    const startY = event.clientY
    const pointerId = event.pointerId
    // The pointer stays the drag's when it leaves the thumbnail, or the deck's frame.
    const target = event.currentTarget
    try { target.setPointerCapture(pointerId) } catch { /* the pointer is gone already */ }
    const startX = event.clientX
    let moved = false
    // The prototype's lifted copy of the slide, which follows the pointer (Jarmo, 15 November: without it nothing
    // seemed to move until the pointer passed the next slide's middle).
    let ghost: HTMLElement | null = null
    // On the window, so the drag ends however the pointer leaves the thumbnail.
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return
      if (!moved) ghost = liftedCopy(target)
      moved = true
      if (ghost) {
        ghost.style.left = `${moveEvent.clientX - 20}px`
        ghost.style.top = `${moveEvent.clientY - 14}px`
      }
      setDrag({ from: index, to: overStrip(moveEvent) ? gapAt(moveEvent.clientY) : null })
    }
    const end = () => {
      ghost?.remove()
      ghost = null
      try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId) } catch { /* released */ }
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
      // Let go away from the strip, the drag is called off, as in the prototype.
      if (overStrip(upEvent)) actions.move(index, gapAt(upEvent.clientY))
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

  // A thumbnail's ⋯ shows only on hover, so the focus Radix hands back to it on close fell to the page, and no strip key
  // arrived (Jarmo, 16 November: a selected slide couldn't be deleted with the keyboard). The strip takes it instead, but
  // only when the focus is lost: a click into the handout, or a sheet the menu opened, keeps it.
  const onMenuCloseFocus = useCallback((event: Event) => {
    const strip = stripRef.current
    const active = strip?.ownerDocument.activeElement
    if (!strip || (active && active !== strip.ownerDocument.body)) return
    event.preventDefault()
    strip.focus({ preventScroll: true })
  }, [stripRef])

  const stripKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const origin = keyOrigin(event.target as HTMLElement, event.currentTarget)
    const { key: name, code, shiftKey, metaKey, ctrlKey, altKey, repeat } = event
    return stripKeyOf({ key: name, code, shiftKey, metaKey, ctrlKey, altKey, repeat, isComposing: event.nativeEvent.isComposing, defaultPrevented: event.isDefaultPrevented() }, origin, count, current, isMac)
  }

  // Cmd+D, Cmd+↑ and Cmd+↓ before anything inside the strip: a thumbnail's ⋯ would take Cmd+↓ as its own ↓ and open
  // its menu (review of #784). Taken here, the ⋯ sees the key handled and leaves it.
  const onKeyCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = stripKey(event)
    if (key?.type !== 'duplicate' && key?.type !== 'nudge') return
    event.preventDefault()
    if (key.type === 'duplicate') actions.duplicate(key.index)
    else actions.nudge(key.index, key.step)
  }

  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = stripKey(event)
    if (!key || key.type === 'duplicate' || key.type === 'nudge') return
    event.preventDefault()
    if (key.type === 'pick') actions.pick(key.index)
    else if (key.type === 'menu') setMenuFor(current)
    else if (key.type === 'undo') actions.undo(key.redo)
    else actions.remove(key.index)
  }

  // Item 8: pictures from the computer over the strip. Only a drag of several is the strip's: one picture keeps the way
  // it went before, so its drag over is left alone and the drop never comes here.
  const [pictureGap, setPictureGap] = useState<number | null>(null)
  // How deep the drag is inside the strip: each element it enters counts, each it leaves takes one off, so the line goes
  // only when the drag has left the strip itself (a leave's related element isn't always given; review of #794).
  const pictureDepth = useRef(0)
  const onPictureEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (draggedPictureCount(event.dataTransfer) >= STRIP_PICTURES_MIN) pictureDepth.current++
  }
  const onPictureOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (draggedPictureCount(event.dataTransfer) < STRIP_PICTURES_MIN) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const at = gapAt(event.clientY)
    if (at !== pictureGap) setPictureGap(at)
  }
  const onPictureLeave = () => {
    if (pictureDepth.current === 0) return
    pictureDepth.current--
    if (pictureDepth.current === 0) setPictureGap(null)
  }
  const onPictureDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    pictureDepth.current = 0
    setPictureGap(null)
    const files = droppedPictures(event.dataTransfer)
    if (files.length < STRIP_PICTURES_MIN) return
    event.preventDefault()
    event.stopPropagation()
    actions.dropPictures(gapAt(event.clientY), files)
  }

  const dragAt = drag && drag.to !== null && drag.to !== drag.from && drag.to !== drag.from + 1 ? drag.to : null
  const dropAt = dragAt ?? pictureGap

  return (
    <div
      ref={stripRef}
      className={`deck-strip${borderless ? ' is-borderless' : ''}`}
      role="listbox"
      aria-label="Slides"
      tabIndex={0}
      onKeyDownCapture={onKeyCapture}
      onKeyDown={onKey}
      onDragEnter={onPictureEnter}
      onDragOver={onPictureOver}
      onDragLeave={onPictureLeave}
      onDrop={onPictureDrop}
    >
      {slides.map(entry => (
        <div key={entry.index}>
          <Gap at={entry.index} count={count} actions={actions} dropHere={dropAt === entry.index} />
          <Thumbnail
            entry={entry}
            count={count}
            minutesLabel={slideMinutesText(timing.slides[entry.index])}
            current={entry.index === current}
            theme={theme}
            borderless={borderless}
            assets={assets}
            missing={missing}
            actions={pickUnlessDragged}
            dragging={drag?.from === entry.index}
            onDragStart={onDragStart}
            menuOpen={menuFor === entry.index}
            onMenuOpen={setMenuFor}
            onMenuCloseFocus={onMenuCloseFocus}
            badgeLabel={(entry.data.id && libraryBadge(marks[entry.data.id])?.label) || null}
            badgeAmber={!!(entry.data.id && libraryBadge(marks[entry.data.id])?.amber)}
            comments={commentCounts ? stripCommentCount(entry) : 0}
            joining={joinAt === entry.index}
            makingPicture={makingPictures.has(slidePictureKey({ id: entry.data.id, index: entry.index }))}
            flash={flash?.index === entry.index ? flash.serial : 0}
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
          {/* A deck with no slides chooses its look on the bar's Theme menu (Sprint 162), so this menu only adds. */}
          <NewSlideItems at={count} actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
