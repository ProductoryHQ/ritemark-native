/**
 * The block's bar on the stage (experience 46, 17 November; frames 23, 29 and 30; `blockBar.ts` does the work).
 *
 *  - **The bar** sits under the chosen block (the caret's Boxes, Steps, Columns or list): the type as a menu
 *    ("Boxes ▾"), the block's own group (Boxes: Style, Mark, Size, alignment; Columns: the count, the vertical alignment and
 *    frame 23's ⋯ with Add a column, Remove a column and Delete block), then Add and Delete. It is the page's own size at
 *    any stage size, so it goes in `document.body`. It stays inside the slide and follows its block as the stage moves
 *    and scales. A press outside it or Esc closes it; a press in the block opens it.
 *  - **The handles** go in the slide's frame, over the slide, at the block's place on the screen, so they move and scale
 *    with the slide and stay a pointer's size: the accent ring, the ⋮ at the block's top left that drags it within the
 *    slide (a line shows where it lands), the round + at its right or bottom edge, and on Columns the line between two
 *    columns, which drags and snaps to ⅓, ½ and ⅔. A drag's distance on the screen is the slide's times its scale.
 *
 * Every button has a tooltip and one line of words; a press on the bar never takes the caret off the slide.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { BOXES_MARKS, boxesLookOf, boxesMarkOf, columnsAlignOf, type BoxWidth, type BoxesMark } from '../../../../../src/decks/blocks/fencedDiv'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'
import { Icon, type PhosphorIconName } from '../../ui/Icon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { isMac } from '../../../hooks/usePlatform'
import { useDismissOnOutside } from '../../../lib/dismissOnOutside'
import { setBlockValue } from './slideCommands'
import {
  AGENDA_TIP, BAR_KIND_LABEL, FOLD_AT, HANDLE_SIZE, MARK_LABEL, MARK_MENU_TIP, MARK_TIP, MAX_FOLD, REVEAL_LABEL, REVEAL_TIP, MAX_COLUMNS, addItem, barGap, barLeft, boxIconMenuReturnFocus, caretBoxIcon, caretBoxPos, chosenBlockAt, columnCount, columnShares, deleteBlock, divAttributesOf,
  dropGaps, gripSpot, iconSpot, isBoxIconShortcut, moveBlock, nearestGap, plusSpot, revealsOneBlock, ringGap, setBoxesMark, setColumnCount, setColumnSplit, setReveal, splitGuideX, splitPlace, turnInto, typeMenuKinds, type BarKind, type Box,
  type BoxIconMenuCloseReason, type ChosenBlock,
} from './blockBar'
import { markableBox } from './slideDivView'
import { blockItems, caretItemIndex, itemAtPoint, itemKindOf, type DropLine, type PlacedItem } from './itemHandle'
import { SlideIconPickerContent } from './SlideBlockTools'
import { SlideIconGlyph } from '../slide/SlideIconGlyph'
import { SlideItemHandle } from './SlideItemHandle'
import { addTab, setPendingRename } from '../../../extensions/tabs/tabsCommands'
import { buttonAt } from '../../../extensions/buttonBlock/buttonCommands'

const BOX_SIZE_LABEL: Record<BoxWidth, string> = { s: 'Small', m: 'Medium', l: 'Large' }

const KIND_ICON: Record<BarKind, PhosphorIconName> = { boxes: 'squares-four', steps: 'list-checks', columns: 'columns', list: 'list', numbered: 'list-numbers', agenda: 'calendar', tabs: 'tabs' }
/** Sprint 167 PR 2: the Mark menu's icons (README item C, `block-details.html`). */
const MARK_ICON: Record<BoxesMark, PhosphorIconName> = { icon: 'smiley', number: 'list-numbers', dot: 'record', arrow: 'arrow-right' }
const ADD_LABEL: Record<BarKind, string> = { boxes: 'Add a box', steps: 'Add a step', columns: 'Add a column', list: 'Add an item', numbered: 'Add an item', agenda: '', tabs: 'Add a tab' }

export interface SlideBlockBarProps {
  editor: TipTapEditor | null
  /** The slide's frame (unscaled; the slide is scaled inside it): the handles are drawn in it. */
  frame: HTMLDivElement | null
  theme: DeckTheme
  /** Run a change on the slide's editor (written to the deck as an undo step of its own). */
  apply: (tr: Transaction | null) => boolean
  /** The icon handle was pressed: open the grid of icons for the box at `pos`, under `anchor` (as a click on an icon). */
  pickIcon?: (pos: number, anchor: HTMLElement, current: string | null) => void
}

/** Where the chosen block and its parts are, in the frame. */
interface Placed {
  block: Box
  /** The block on the screen, for the bar in `document.body`. */
  screen: DOMRect
  /**
   * Columns: the lines between them, each its x in the frame, and on the screen its two columns' outer edges, the gap
   * between them, and the whole grid's edges (the first column's left, the last one's right).
   */
  lines: { x: number; left: number; right: number; gap: number; grid: { left: number; right: number } }[]
  /** A list's or Steps' numbers or bullets: their middle's x in the frame (the + goes under them). */
  markerX: number | null
  /** The slide's pane on the screen: the bar stays inside it. */
  pane: { left: number; right: number }
  caretBox: ReturnType<typeof caretBoxIcon>
  /** The icon handle: on the caret's box while it has no icon (its empty place is drawn), at its spot in the frame. */
  icon: { pos: number; left: number; top: number } | null
  /** Sprint 167 PR 5 (README item B): the block's boxes, columns, steps or list items in the frame, and the caret's. */
  items: PlacedItem[]
  caretItem: number | null
}

function samePlace(a: Placed, b: Placed): boolean {
  const same = (x: Box, y: Box) => x.left === y.left && x.top === y.top && x.width === y.width && x.height === y.height
  return same(a.block, b.block) && a.screen.left === b.screen.left && a.screen.top === b.screen.top && a.screen.bottom === b.screen.bottom
    && a.markerX === b.markerX && a.pane.left === b.pane.left && a.pane.right === b.pane.right && JSON.stringify(a.lines) === JSON.stringify(b.lines)
    && a.caretBox?.pos === b.caretBox?.pos && a.caretBox?.current === b.caretBox?.current && a.caretBox?.glyph === b.caretBox?.glyph
    && JSON.stringify(a.icon) === JSON.stringify(b.icon) && a.caretItem === b.caretItem && JSON.stringify(a.items) === JSON.stringify(b.items)
}

function boxIn(rect: DOMRect, origin: DOMRect): Box {
  return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }
}

/** A choice in one of the bar's segments: on or not, with its tooltip. */
function Choice({ on, label, tip, icon, onPick }: { on: boolean; label?: string; tip: string; icon?: PhosphorIconName; onPick: () => void }) {
  return (
    <Tooltip label={tip}>
      <Button
        variant="toolbar"
        size="compact"
        className="deck-bar-choice"
        data-state={on ? 'active' : undefined}
        aria-pressed={on}
        aria-label={label ? undefined : tip}
        onMouseDown={event => event.preventDefault()}
        onClick={onPick}
      >
        {icon ? <Icon name={icon} size={16} tone="inherit" /> : null}
        {label}
      </Button>
    </Tooltip>
  )
}

const Segment = ({ children, label }: { children: ReactNode; label: string }) => <div className="deck-bar-seg" role="group" aria-label={label}>{children}</div>
const Sep = () => <span className="deck-bar-sep" aria-hidden="true" />

/** One of a group's choices. */
interface Option {
  key: string
  on: boolean
  label?: string
  icon?: PhosphorIconName
  tip: string
  pick: () => void
}

/**
 * A group of the bar: its choices side by side, or, when the bar is wider than the slide's pane, one menu that shows
 * the value it has ("Auto ▾", "Filled ▾", the alignment's icon ▾) and lists the choices (the lead on #773). Its
 * trigger says the value to a screen reader too ("Size: Auto"). `bare` shows the value as its icon only, the word in the
 * tooltip ("Mark: Number"); `tip` overrides the tooltip.
 */
function Group({ label, options, folded, tip, bare = false }: { label: string; options: Option[]; folded: boolean; tip?: string; bare?: boolean }) {
  if (!folded) return <Segment label={label}>{options.map(option => <Choice key={option.key} on={option.on} label={option.label} icon={option.icon} tip={option.tip} onPick={option.pick} />)}</Segment>
  const current = options.find(option => option.on) ?? options[0]
  const hasIcons = options.some(option => option.icon)
  return (
    <DropdownMenu modal={false}>
      <Tooltip label={tip ?? (bare ? `${label}: ${current.label ?? current.tip}` : label)}>
        <DropdownMenuTrigger asChild>
          <Button variant="toolbar" size="compact" aria-label={`${label}: ${current.label ?? current.tip}`} onMouseDown={event => event.preventDefault()}>
            {current.icon ? <Icon name={current.icon} size={16} tone="inherit" /> : null}
            {bare && current.icon ? null : current.label}
            <Icon name="caret-down" size={12} tone="inherit" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start" onCloseAutoFocus={event => event.preventDefault()}>
        {options.map(option => (
          <DropdownMenuItem key={option.key} className="gap-2" onSelect={option.pick}>
            {option.icon ? <Icon name={option.icon} size={16} tone="inherit" /> : hasIcons ? <span className="size-4 shrink-0" aria-hidden="true" /> : null}
            <span className="flex-1">{option.label ?? option.tip}</span>
            {option.on ? <Icon name="check" size={14} tone="inherit" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/*! @license lucide (smile-plus) ISC
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright
 * (c) for Lucide are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
 * granted, provided that the above copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
 * AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * Lucide's `smile-plus`, drawn inline (its notice above is a legal comment, kept in the bundle): the icon handle says
 * "add an icon", not "add an item" (the Experience lead's follow-up to #773). Phosphor has no such glyph, and the app
 * has no Lucide package.
 */
function SmilePlusGlyph() {
  return (
    // A stroke glyph: the Button fills its svgs and sizes them 16 unless told (the app run drew a filled disc), so it
    // keeps no fill and the ⋮'s 14 px.
    <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" style={{ fill: 'none' }} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11v1a10 10 0 1 1-9-10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
      <path d="M16 5h6" />
      <path d="M19 2v6" />
    </svg>
  )
}

function BoxIconButton({ box, trigger, onPick, focusEditor }: {
  box: NonNullable<ReturnType<typeof caretBoxIcon>>
  trigger: { current: HTMLButtonElement | null }
  onPick: (name: string | null) => void
  focusEditor: () => void
}) {
  const [open, setOpen] = useState(false)
  const openedByKeyboard = useRef(false)
  const pickedByKeyboard = useRef(false)
  const closeReason = useRef<BoxIconMenuCloseReason>('outside')
  useEffect(() => {
    if (!open) return
    // An icon's tooltip can close the picker on Escape before the menu sees the key.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing && !event.defaultPrevented) {
        closeReason.current = 'escape'
      }
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [open])
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={next => {
      if (next) {
        pickedByKeyboard.current = false
        closeReason.current = 'outside'
      }
      setOpen(next)
    }}>
      <Tooltip label={`This box's icon (${isMac ? '⌥F10' : 'Alt+F10'})`} suppressed={open}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger} variant="toolbar" size="compact" aria-label="Icon" aria-keyshortcuts="Alt+F10"
            onMouseDown={event => event.preventDefault()}
            onPointerDownCapture={() => { if (open) closeReason.current = 'trigger'; else openedByKeyboard.current = false }}
            onKeyDownCapture={event => {
              if (!open && ['Enter', ' ', 'ArrowDown'].includes(event.key)) openedByKeyboard.current = true
            }}
          >
            <SlideIconGlyph name={box.glyph} size={16} />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <SlideIconPickerContent
        current={box.current}
        onKeyDownCapture={event => { pickedByKeyboard.current = event.key === 'Enter' || event.key === ' ' }}
        onPointerUpCapture={() => { pickedByKeyboard.current = false }}
        onInteractOutside={event => {
          closeReason.current = trigger.current?.contains(event.target as Node) ? 'trigger' : 'outside'
        }}
        onPick={name => {
          closeReason.current = pickedByKeyboard.current ? 'keyboard-pick' : 'mouse-pick'
          onPick(name)
        }}
        onCloseAutoFocus={event => {
          event.preventDefault()
          const returnFocus = boxIconMenuReturnFocus(openedByKeyboard.current, closeReason.current)
          if (returnFocus === 'trigger') trigger.current?.focus({ preventScroll: true })
          if (returnFocus === 'editor') focusEditor()
        }}
      />
    </DropdownMenu>
  )
}

export function SlideBlockBar({ editor, frame, theme, apply, pickIcon }: SlideBlockBarProps) {
  const [chosen, setChosen] = useState<ChosenBlock | null>(null)
  const [open, setOpen] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [barAt, setBarAt] = useState<{ left: number; top: number } | null>(null)
  const [drag, setDrag] = useState<{ kind: 'move'; y: number; width: number; left: number } | { kind: 'split'; x: number; top: number; height: number } | { kind: 'item'; from: number; line: DropLine | null } | null>(null)
  // Sprint 167 PR 5: the item the pointer is at (the handle follows it), and the item whose menu is open.
  const [hoverItem, setHoverItem] = useState<number | null>(null)
  const [itemMenu, setItemMenu] = useState<number | null>(null)
  const placedRef = useRef<Placed | null>(null)
  const dragRef = useRef(false)
  const barRef = useRef<HTMLDivElement | null>(null)
  const iconTrigger = useRef<HTMLButtonElement | null>(null)
  const focusIcon = useRef(false)
  const chosenKey = useRef<string | null>(null)
  // The handles' layer, the frame's last child while the frame is there.
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!frame) return
    const element = document.createElement('div')
    element.className = 'deck-block-layer'
    frame.append(element)
    setLayer(element)
    return () => { element.remove(); setLayer(null) }
  }, [frame])

  /** The chosen block now, and where it and its parts are. */
  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed || !frame) return
    // Sprint 163 PR 3: a button chosen inside a block (a column's) has its own bar; the block's waits.
    const block = buttonAt(editor.state) ? null : chosenBlockAt(editor.state)
    const key = block ? `${block.pos}:${block.kind}` : null
    // Another block chosen with the caret (it moved into one) opens its bar; the same one keeps the bar as it was, so
    // after Esc it stays closed until a press in the block. A change from the bar (Turn into, a move) keeps it open.
    if (key !== chosenKey.current) {
      chosenKey.current = key
      if (block && editor.isFocused) setOpen(true)
    }
    setChosen(current => (current && block && current.pos === block.pos && current.node === block.node ? current : block))
    const dom = block ? (editor.view.nodeDOM(block.pos) as HTMLElement | null) : null
    if (!block || !dom || typeof dom.getBoundingClientRect !== 'function') { setPlaced(null); return }
    const origin = frame.getBoundingClientRect()
    const screen = dom.getBoundingClientRect()
    const lines: Placed['lines'] = []
    if (block.kind === 'columns') {
      const columns = Array.from(dom.children).filter(child => child.classList.contains('blk-column')) as HTMLElement[]
      const grid = columns.length ? { left: columns[0].getBoundingClientRect().left, right: columns[columns.length - 1].getBoundingClientRect().right } : null
      for (let index = 0; grid && index + 1 < columns.length; index++) {
        const a = columns[index].getBoundingClientRect()
        const b = columns[index + 1].getBoundingClientRect()
        // The split's handle sits in the middle of the gap between the two columns (README "Spacing on the slide").
        lines.push({ x: (a.right + b.left) / 2 - origin.left, left: a.left, right: b.right, gap: b.left - a.right, grid })
      }
    }
    // A list's or Steps' markers sit left of its first item's words: the + goes under their middle.
    let markerX: number | null = null
    if (block.kind !== 'boxes' && block.kind !== 'columns') {
      const words = dom.querySelector('li > *')?.getBoundingClientRect()
      const item = dom.querySelector('li')?.getBoundingClientRect()
      if (words && item) markerX = (block.kind === 'steps' ? item.left + (words.left - item.left) * 0.3 : item.left - (item.left - screen.left) / 2) - origin.left
    }
    const pane = { left: origin.left, right: origin.right }
    // The caret's box shows the icon handle while it has no icon: its view draws the empty place (hidden on the stage)
    // only then, and only under the looks that draw icons.
    let icon: Placed['icon'] = null
    const caretBox = caretBoxIcon(editor.state)
    const boxPos = block.kind === 'boxes' ? caretBox?.pos ?? null : null
    const box = boxPos === null ? null : markableBox(editor.view.nodeDOM(boxPos) as HTMLElement | null)
    if (boxPos !== null && box && dom.contains(box) && box.querySelector(':scope > .blk-icon.is-place')) {
      const rect = box.getBoundingClientRect()
      const scale = box.offsetWidth ? rect.width / box.offsetWidth : 1
      icon = { pos: boxPos, ...iconSpot(boxIn(rect, origin), scale) }
    }
    // README item B: each item's place, and its top padding (a box's handle sits in it, never over its words).
    // Every item or none: one not drawn yet would put the handles' indexes out of step with the document's items.
    let items: PlacedItem[] = []
    // A box's padding is the look's, the same for every box: read once (this runs at every keystroke).
    let padTop: number | null = null
    if (itemKindOf(block.kind)) {
      for (const item of blockItems(block)) {
        const element = editor.view.nodeDOM(item.pos) as HTMLElement | null
        if (!element || typeof element.getBoundingClientRect !== 'function') { items = []; break }
        const rect = element.getBoundingClientRect()
        // Only a box's handle sits in its padding: the style is read for boxes alone.
        if (padTop === null) padTop = block.kind === 'boxes' ? (parseFloat(getComputedStyle(element).paddingTop) || 0) * (element.offsetWidth ? rect.width / element.offsetWidth : 1) : 0
        items.push({ ...boxIn(rect, origin), padTop })
      }
    }
    const caretItem = caretItemIndex(editor.state, block)
    const next: Placed = { block: boxIn(screen, origin), screen, lines, markerX, pane, caretBox, icon, items, caretItem }
    // The same place draws nothing again (a transaction that moves nothing, a scroll elsewhere).
    setPlaced(current => (current && samePlace(current, next) ? current : next))
  }, [editor, frame])

  useEffect(() => {
    if (!editor) return
    let frameId = 0
    const later = () => { cancelAnimationFrame(frameId); frameId = requestAnimationFrame(measure) }
    measure()
    editor.on('transaction', later)
    editor.on('focus', later)
    // A press in the slide's words opens the bar again (after Esc or a press outside it).
    const dom = editor.view.dom
    // A press the stage took for the picture Behind (between the words, cancelled on its way down) opens nothing here.
    const press = (event: PointerEvent) => { if (event.defaultPrevented) return; setOpen(true); later() }
    // Tab moves between boxes. Alt+F10 moves from the text to its Icon control.
    const focusToolbar = (event: KeyboardEvent) => {
      if (!isBoxIconShortcut(event)) return
      if (!frame || !caretBoxIcon(editor.state) || !chosenBlockAt(editor.state) || buttonAt(editor.state)) return
      event.preventDefault()
      if (iconTrigger.current) {
        iconTrigger.current.focus({ preventScroll: true })
      } else {
        focusIcon.current = true
        setOpen(true)
        measure()
      }
    }
    dom.addEventListener('keydown', focusToolbar)
    dom.addEventListener('pointerdown', press)
    window.addEventListener('resize', later)
    // The stage scrolls, so the bar in `document.body` follows its block.
    document.addEventListener('scroll', later, true)
    const observer = typeof ResizeObserver === 'undefined' || !frame ? null : new ResizeObserver(later)
    if (observer && frame) observer.observe(frame)
    return () => {
      cancelAnimationFrame(frameId)
      editor.off('transaction', later)
      editor.off('focus', later)
      dom.removeEventListener('keydown', focusToolbar)
      dom.removeEventListener('pointerdown', press)
      window.removeEventListener('resize', later)
      document.removeEventListener('scroll', later, true)
      observer?.disconnect()
    }
  }, [editor, frame, measure])

  const showing = open && !!chosen && !!placed
  placedRef.current = placed
  dragRef.current = !!drag
  // Another block (or none) chosen: no item of the last one is pointed at or has its menu open.
  const itemsKey = chosen ? `${chosen.pos}:${chosen.kind}` : ''
  useEffect(() => { setHoverItem(null); setItemMenu(null) }, [itemsKey])
  // The item under the pointer, while it is over the chosen block or near it (`itemAtPoint`); none when it leaves the
  // slide's frame (the caret's item then has the handle). It holds still while a handle drags.
  useEffect(() => {
    if (!frame) return
    const pointer = (event: PointerEvent) => {
      const now = placedRef.current
      if (dragRef.current || !now) return
      const origin = frame.getBoundingClientRect()
      const next = itemAtPoint(now.items, now.block, event.clientX - origin.left, event.clientY - origin.top)
      setHoverItem(current => (current === next ? current : next))
    }
    const leave = () => { if (!dragRef.current) setHoverItem(null) }
    frame.addEventListener('pointermove', pointer)
    frame.addEventListener('pointerleave', leave)
    return () => {
      frame.removeEventListener('pointermove', pointer)
      frame.removeEventListener('pointerleave', leave)
    }
  }, [frame])
  // Esc or a press outside the bar and the slide closes it (the slide's frame is its trigger: a press there is the
  // block's own, and opens it again).
  useDismissOnOutside(barRef, () => setOpen(false), { trigger: () => frame, returnFocus: () => null, enabled: showing })

  // Under the block, the page's own size; above it when there is no room under it; never off the window.
  // Inside the slide's pane (the Experience lead on #773): when the bar is wider than the pane, its own group folds
  // into menus that show their value, from the right: alignment, then the count, then Style. A new block or
  // a new pane width starts again unfolded.
  const [fold, setFold] = useState(0)
  const foldKey = `${chosen?.pos}:${chosen?.kind}:${placed ? Math.round(placed.pane.right - placed.pane.left) : 0}`
  useEffect(() => { setFold(0) }, [foldKey])
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!showing || !placed || !bar || !chosen) { setBarAt(null); return }
    if (focusIcon.current && iconTrigger.current) {
      focusIcon.current = false
      iconTrigger.current.focus({ preventScroll: true })
    }
    const width = bar.getBoundingClientRect().width
    const height = bar.offsetHeight
    const room = window.innerHeight
    let top = placed.screen.bottom + barGap(chosen.kind)
    if (top + height > room - 8) top = Math.max(8, placed.screen.top - height - 8)
    const inPane = barLeft(placed.screen.left, width, placed.pane, window.innerWidth)
    if (inPane === null && fold < MAX_FOLD) { setFold(fold + 1); return }
    const left = inPane ?? Math.max(8, placed.pane.left + 8)
    setBarAt(current => (current && current.left === left && current.top === top ? current : { left, top }))
    // Again only when the block moves, the bar's contents change (its width) or it folds: never on its own update.
  }, [showing, placed, chosen, drag, fold])

  if (!editor || !chosen || !placed || !layer) return null

  const run = (tr: Transaction | null) => { apply(tr); editor.view.focus() }
  const attrs = divAttributesOf(chosen.node)
  const look = chosen.kind === 'boxes' ? boxesLookOf(attrs) : null
  const fill = look?.fill ?? theme.boxes
  const mark = chosen.kind === 'boxes' ? boxesMarkOf(attrs) : null
  const columns = chosen.kind === 'columns' ? columnCount(chosen.node) : 0
  const reveal = revealsOneBlock(chosen)
  /**
   * A change on the chosen block as it is now: found again from the caret, so a change that came in meanwhile (an AI's
   * edit, an undo) never makes the bar act on another block's place. Nothing when the block is gone.
   */
  const act = (make: (pos: number) => Transaction | null): Transaction | null => {
    const now = chosenBlockAt(editor.state)
    return now && now.kind === chosen.kind ? make(now.pos) : null
  }
  const setValue = (key: string, value: string | null) => run(act(pos => setBlockValue(editor.state, pos, key, value)))
  const add = () => {
    // Sprint 163: a new tab opens with its name chosen, so typing names it (its band reads the pending name).
    if (chosen.kind === 'tabs') {
      const now = chosenBlockAt(editor.state)
      const made = now?.kind === 'tabs' ? addTab(editor.state, now.pos) : null
      if (now && made) { setPendingRename(editor.view, now.pos, made.index); apply(made.tr) }
      return
    }
    run(act(pos => addItem(editor.state, pos)))
  }
  // The Agenda (small details 14) is one piece: no item to add, and no other kind to turn into.
  const agenda = chosen.kind === 'agenda'
  const tabs = chosen.kind === 'tabs'
  const canAdd = !agenda && (chosen.kind !== 'columns' || columns < MAX_COLUMNS)
  // Sprint 163: a Tabs block in a column moves with its column; only a block on the slide itself has the ⋮.
  const nested = editor.state.doc.resolve(Math.min(chosen.pos, editor.state.doc.content.size)).depth > 0

  // ---- The ⋮ drag: where the block lands, by the lines between the slide's blocks.
  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !frame) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const doc = editor.state.doc
    const start = chosenBlockAt(editor.state)
    if (!start) return
    const index = doc.resolve(start.pos).index(0)
    const gaps = dropGaps(doc, index)
    const origin = frame.getBoundingClientRect()
    const flow = (editor.view.dom as HTMLElement).getBoundingClientRect()
    // Each gap's line: under the last drawn block before it (comments are drawn nowhere), or over the first after it.
    const bottoms: number[] = []
    const tops: number[] = []
    doc.forEach((_child, offset) => {
      const dom = editor.view.nodeDOM(offset) as HTMLElement | null
      const rect = dom && typeof dom.getBoundingClientRect === 'function' ? dom.getBoundingClientRect() : null
      const drawn = rect && rect.height > 0 ? rect : null
      tops.push(drawn ? drawn.top : NaN)
      bottoms.push(drawn ? drawn.bottom : NaN)
    })
    const lines = new Map<number, number>()
    for (const gap of gaps) {
      let y = NaN
      for (let at = gap - 1; at >= 0 && Number.isNaN(y); at--) y = bottoms[at]
      for (let at = gap; at < tops.length && Number.isNaN(y); at++) y = tops[at]
      if (!Number.isNaN(y)) lines.set(gap, y)
    }
    let target: number | null = null
    const moveTo = (y: number) => {
      target = nearestGap(y, gaps, lines)
      const line = target === null ? undefined : lines.get(target)
      setDrag(line === undefined ? null : { kind: 'move', y: line - origin.top, left: flow.left - origin.left, width: flow.width })
    }
    const onMove = (move: PointerEvent) => moveTo(move.clientY)
    const end = (drop: boolean) => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      setDrag(null)
      if (drop && target !== null && editor.state.doc === doc) run(act(pos => moveBlock(editor.state, pos, target!)))
    }
    const onUp = () => end(true)
    const onCancel = () => end(false)
    const onKey = (key: KeyboardEvent) => { if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); end(false) } }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
  }

  // ---- The split: the line between two columns, snapped to ⅓, ½ or ⅔ of them.
  const startSplit = (line: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !frame) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const edges = placed.lines[line]
    // A drop on a document that changed meanwhile is no drop: the line's place was read from the one before.
    const startDoc = editor.state.doc
    const origin = frame.getBoundingClientRect()
    const shares = columnShares(chosen.node)
    let fraction = splitPlace(event.clientX, edges.left, edges.right, edges.gap)
    const show = () => {
      // In the middle of the gap the line will have (#829), as the handle is once it lands.
      const x = splitGuideX(edges.grid, edges.gap, shares, line, fraction) - origin.left
      setDrag({ kind: 'split', x, top: placed.block.top, height: placed.block.height })
    }
    show()
    const onMove = (move: PointerEvent) => { fraction = splitPlace(move.clientX, edges.left, edges.right, edges.gap); show() }
    const end = (drop: boolean) => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      setDrag(null)
      if (drop && editor.state.doc === startDoc) run(act(pos => setColumnSplit(editor.state, pos, line, fraction)))
    }
    const onUp = () => end(true)
    const onCancel = () => end(false)
    const onKey = (key: KeyboardEvent) => { if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); end(false) } }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
  }

  const block = placed.block
  const grip = gripSpot(block)
  const plus = plusSpot(block, chosen.kind, placed.markerX)
  // While a handle drags, only its drop line or guide shows (the lead on #773): the handles stay in the page, hidden,
  // so the dragged one keeps its pointer, and no tooltip opens.
  const hidden: CSSProperties = drag ? { visibility: 'hidden' } : {}
  // Each handle sits in a box of its own at its place (`deck-block-at`), its tooltip's trigger inside it: the trigger is
  // the Tooltip's own span, which had no size while the button itself was absolute, so every handle's tooltip opened at
  // the layer's top left corner (the follow-up's app run).
  const at = (spot: { left: number; top: number }, width = HANDLE_SIZE, height = HANDLE_SIZE, z = 5): CSSProperties => ({ left: spot.left, top: spot.top, width, height, zIndex: z, ...hidden })
  const handleSize: CSSProperties = { width: HANDLE_SIZE, height: HANDLE_SIZE }
  // The ring keeps 8 px from the words: a box has its own padding, so a Boxes block's ring sits closer.
  const ring = ringGap(chosen.kind)

  const boxIconButton = placed.caretBox ? (
    <BoxIconButton
      box={placed.caretBox}
      trigger={iconTrigger}
      focusEditor={() => editor.view.focus()}
      onPick={name => {
        const box = caretBoxIcon(editor.state)
        if (box && box.pos === placed.caretBox?.pos) {
          apply(setBlockValue(editor.state, box.pos, 'icon', name))
        }
      }}
    />
  ) : null

  return (
    <>
      {/* The handles go in a layer of their own, put in the frame by this component (a portal): the frame's other
          children move (the bubble menu goes to the page), and React inserting beside them failed (the app run). */}
      {createPortal(showing ? (
        <>
          <div className="deck-block-ring" style={{ left: block.left - ring, top: block.top - ring, width: block.width + ring * 2, height: block.height + ring * 2, ...hidden }} aria-hidden="true" />
          {nested ? null : (
            <div className="deck-block-at" style={at(grip)}>
              <Tooltip label="Drag to move the block on the slide" suppressed={!!drag}>
                <Button variant="ghost" className="deck-block-grip" style={handleSize} aria-label="Move the block" onPointerDown={startMove} onMouseDown={event => event.preventDefault()}>
                  <Icon name="dots-six-vertical" size={14} tone="inherit" />
                </Button>
              </Tooltip>
            </div>
          )}
          {/* A Tabs block's + is at its band's end (its node view's). */}
          {canAdd && !tabs ? (
            <div className="deck-block-at" style={at(plus)}>
              <Tooltip label={ADD_LABEL[chosen.kind]} suppressed={!!drag}>
                <Button variant="outline" className="deck-block-plus" style={handleSize} aria-label={ADD_LABEL[chosen.kind]} onMouseDown={event => event.preventDefault()} onClick={add}>
                  <Icon name="plus" size={12} tone="inherit" />
                </Button>
              </Tooltip>
            </div>
          ) : null}
          {placed.icon && pickIcon ? (
            <div className="deck-block-at" style={at(placed.icon)}>
              <Tooltip label="Add an icon" suppressed={!!drag}>
                <Button
                  variant="outline"
                  className="deck-block-icon"
                  style={handleSize}
                  aria-label="Add an icon"
                  onMouseDown={event => event.preventDefault()}
                  // The caret's box as it is now, never the place measured before (an AI's edit or an undo may have
                  // moved it meanwhile, as `act` says).
                  onClick={event => {
                    const pos = caretBoxPos(editor.state)
                    if (pos !== null) pickIcon(pos, event.currentTarget, null)
                  }}
                >
                  <SmilePlusGlyph />
                </Button>
              </Tooltip>
            </div>
          ) : null}
          {placed.lines.map((line, index) => (
            <div key={index} className="deck-block-at" style={at({ left: line.x - 6, top: block.top }, 12, block.height, 4)}>
              <Tooltip label="Drag to change the columns' widths" suppressed={!!drag}>
                <Button
                  variant="ghost"
                  // Pointed at, only the line shows: no ghost hover fill (it drew a light 12 px bar on the slide, #829).
                  className="deck-block-split hover:bg-transparent"
                  style={{ height: block.height }}
                  aria-label="Change the columns' widths"
                  onPointerDown={startSplit(index)}
                  onMouseDown={event => event.preventDefault()}
                />
              </Tooltip>
            </div>
          ))}
          {drag?.kind === 'move' ? <div className="deck-block-drop" style={{ left: drag.left, top: drag.y - 1, width: drag.width }} aria-hidden="true" /> : null}
          {drag?.kind === 'split' ? <div className="deck-block-guide" style={{ left: drag.x - 1, top: drag.top, height: drag.height }} aria-hidden="true" /> : null}
          {/* README item B: the item's own handle, on the pointer's item, else the caret's; its drop line while it drags. */}
          {frame ? <SlideItemHandle
            editor={editor}
            frame={frame}
            chosen={chosen}
            block={block}
            items={placed.items}
            index={drag?.kind === 'item' ? drag.from : hoverItem !== null && hoverItem < placed.items.length ? hoverItem : placed.caretItem}
            hidden={!!drag}
            menuAt={itemMenu !== null && itemMenu < placed.items.length ? itemMenu : null}
            onMenu={setItemMenu}
            onDrag={state => setDrag(state ? { kind: 'item', ...state } : null)}
            run={make => run(act(make))}
          /> : null}
          {drag?.kind === 'item' && drag.line ? (
            drag.line.width > 0
              ? <div className="deck-block-drop" style={{ left: drag.line.left, top: drag.line.top - 1, width: drag.line.width }} aria-hidden="true" />
              : <div className="deck-block-guide" style={{ left: drag.line.left - 1, top: drag.line.top, height: drag.line.height }} aria-hidden="true" />
          ) : null}
        </>
      ) : null, layer)}
      {/* Hidden while a handle drags, so it never covers where the block lands (the app run's drag shot). */}
      {showing && !drag
        ? createPortal(
            <div
              ref={barRef}
              className="deck-block-bar"
              onKeyDown={event => {
                // Radix may consume Escape to dismiss a tooltip over a toolbar button.
                if (event.key !== 'Escape' || event.nativeEvent.isComposing
                  || !event.currentTarget.contains(event.target as Node)) return
                event.preventDefault()
                editor.view.focus()
                setOpen(false)
              }}
              role="toolbar"
              aria-label={`${BAR_KIND_LABEL[chosen.kind]} block`}
              style={{
                left: barAt?.left ?? -9999,
                top: barAt?.top ?? -9999,
                ...(fold === MAX_FOLD ? {
                  maxWidth: Math.max(0, Math.min(window.innerWidth - 8, placed.pane.right - 8) - Math.max(8, placed.pane.left + 8)),
                  flexWrap: 'wrap',
                } : {}),
              }}
            >
              {agenda ? (
                <Tooltip label={AGENDA_TIP}>
                  <span className="deck-bar-type deck-bar-type-fixed" tabIndex={0} aria-label={`${BAR_KIND_LABEL.agenda}: ${AGENDA_TIP}`}>
                    <Icon name={KIND_ICON.agenda} size={16} tone="inherit" />
                    {BAR_KIND_LABEL.agenda}
                  </span>
                </Tooltip>
              ) : (
              <DropdownMenu modal={false}>
                <Tooltip label="Turn this block into another kind">
                  <DropdownMenuTrigger asChild>
                    <Button variant="toolbar" size="compact" className="deck-bar-type" onMouseDown={event => event.preventDefault()}>
                      <Icon name={KIND_ICON[chosen.kind]} size={16} tone="inherit" />
                      {BAR_KIND_LABEL[chosen.kind]}
                      <Icon name="caret-down" size={12} tone="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="start" onCloseAutoFocus={event => { event.preventDefault(); editor.view.focus() }}>
                  {typeMenuKinds(chosen.kind, nested).map(kind => (
                    <DropdownMenuItem
                      key={kind}
                      className="gap-2"
                      onSelect={() => { if (kind !== chosen.kind) apply(act(pos => turnInto(editor.state, pos, kind))) }}
                    >
                      <Icon name={KIND_ICON[kind]} size={16} tone="inherit" />
                      <span className="flex-1">{BAR_KIND_LABEL[kind]}</span>
                      {kind === chosen.kind ? <Icon name="check" size={14} tone="inherit" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              )}
              {!look && boxIconButton ? <><Sep />{boxIconButton}</> : null}
              {look ? (
                <>
                  <Sep />
                  {/* The theme's own style writes nothing: only a block that differs from it carries `fill`. */}
                  <Group label="Style" folded={fold >= FOLD_AT.style} options={[
                    { key: 'filled', on: fill === 'filled', label: 'Filled', tip: "Boxes filled with the theme's colour", pick: () => setValue('fill', theme.boxes === 'filled' ? null : 'filled') },
                    { key: 'outline', on: fill === 'outline', label: 'Outline', tip: 'Boxes drawn as an outline', pick: () => setValue('fill', theme.boxes === 'outline' ? null : 'outline') },
                  ]} />
                  <Sep />
                  {/* Sprint 167 PR 2 (README item C): Mark, a menu that shows its value; Icon, the default, writes nothing. On
                      the narrowest pane it folds last, to its value's icon. */}
                  <Group label="Mark" tip={MARK_MENU_TIP} folded bare={fold >= FOLD_AT.mark} options={BOXES_MARKS.map(choice => ({
                    key: choice,
                    on: mark === choice,
                    icon: MARK_ICON[choice],
                    label: MARK_LABEL[choice],
                    tip: MARK_TIP[choice],
                    pick: () => run(act(pos => setBoxesMark(editor.state, pos, choice))),
                  }))} />
                  {boxIconButton}
                  <Sep />
                  <Group label="Size" folded tip={`Size: ${look.width ? BOX_SIZE_LABEL[look.width] : 'Auto'}`} options={[
                    { key: 'auto', on: !look.width, icon: 'columns', label: 'Auto', tip: 'Auto', pick: () => setValue('width', null) },
                    ...(['s', 'm', 'l'] as BoxWidth[]).map(width => ({ key: width, on: look.width === width, label: BOX_SIZE_LABEL[width], tip: BOX_SIZE_LABEL[width], pick: () => setValue('width', width) })),
                  ]} />
                  <Sep />
                  <Group label="Text alignment" folded={fold >= FOLD_AT.alignment} options={[
                    { key: 'left', on: !look.align, icon: 'text-align-left', tip: 'Text on the left', pick: () => setValue('align', null) },
                    { key: 'center', on: look.align === 'center', icon: 'text-align-center', tip: 'Text in the centre', pick: () => setValue('align', 'center') },
                  ]} />
                </>
              ) : null}
              {chosen.kind === 'columns' ? (
                <>
                  <Sep />
                  {/* The count is how columns are added and taken away (the lead on #773: no ⋯ for Columns). */}
                  <Group label="Columns" folded={fold >= FOLD_AT.size} options={[2, 3, 4].map(count => ({
                    key: String(count),
                    on: columns === count,
                    label: String(count),
                    tip: count < columns ? `${count} columns: the words of the others go to the last one` : `${count} columns`,
                    pick: () => run(act(pos => setColumnCount(editor.state, pos, count))),
                  }))} />
                  <Sep />
                  <Group label="Vertical alignment" folded={fold >= FOLD_AT.alignment} options={[
                    { key: 'top', on: !columnsAlignOf(attrs), icon: 'align-top', tip: "Columns' words at the top", pick: () => setValue('valign', null) },
                    { key: 'middle', on: columnsAlignOf(attrs) === 'middle', icon: 'align-center-vertical', tip: "Columns' words in the middle", pick: () => setValue('valign', 'middle') },
                    { key: 'bottom', on: columnsAlignOf(attrs) === 'bottom', icon: 'align-bottom', tip: "Columns' words at the bottom", pick: () => setValue('valign', 'bottom') },
                  ]} />
                </>
              ) : null}
              {agenda || tabs ? null : (
                <>
                  <Sep />
                  {/* README item 18: one toggle, pressed when on; off (All at once, the default) writes nothing. Folded,
                      it keeps its toggle as an icon with the same tooltip. */}
                  <Segment label="Reveal">
                    <Choice
                      on={reveal}
                      icon="cards-three"
                      label={fold >= FOLD_AT.reveal ? undefined : REVEAL_LABEL}
                      tip={REVEAL_TIP}
                      onPick={() => run(act(pos => setReveal(editor.state, pos, !reveal)))}
                    />
                  </Segment>
                </>
              )}
              <Sep />
              {agenda ? null : (
                <Tooltip label={canAdd ? ADD_LABEL[chosen.kind] : `A Columns block holds ${MAX_COLUMNS} columns at most`}>
                  <Button variant="toolbar" size="compact" disabled={!canAdd} onMouseDown={event => event.preventDefault()} onClick={add}>
                    <Icon name="plus" size={16} tone="inherit" />
                    Add
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="Delete this block">
                <Button variant="toolbar" size="compact" aria-label="Delete this block" onMouseDown={event => event.preventDefault()} onClick={() => run(act(pos => deleteBlock(editor.state, pos)))}>
                  <Icon name="trash" size={16} tone="inherit" />
                </Button>
              </Tooltip>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
