/**
 * The block's bar on the stage (experience 46, 17 November; frames 23, 29 and 30; `blockBar.ts` does the work).
 *
 *  - **The bar** sits under the chosen block (the caret's Boxes, Steps, Columns or list): the type as a menu
 *    ("Boxes ▾"), the block's own group (Boxes: Style, Width, alignment; Columns: the count, the vertical alignment and
 *    frame 23's ⋯ with Add a column, Remove a column and Delete block), then Add and Delete. It is the page's own size at
 *    any stage size, so it goes in `document.body` (the slide's frame clips, and frame 29's bar runs past the slide), and
 *    follows its block as the stage moves and scales. A press outside it or Esc closes it; a press in the block opens it.
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
import { boxesLookOf, columnsAlignOf, type BoxWidth } from '../../../../../src/decks/blocks/fencedDiv'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'
import { Icon, type PhosphorIconName } from '../../ui/Icon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { useDismissOnOutside } from '../../../lib/dismissOnOutside'
import { setBlockValue } from './slideCommands'
import {
  BAR_KINDS, BAR_KIND_LABEL, HANDLE_SIZE, MAX_COLUMNS, MIN_COLUMNS, addItem, chosenBlockAt, columnCount, columnIndexAt, deleteBlock, divAttributesOf, dropGaps,
  gripSpot, moveBlock, nearestGap, plusSpot, removeColumn, setColumnCount, setColumnSplit, snapSplit, splitPlace, turnInto, type BarKind, type Box, type ChosenBlock,
} from './blockBar'

const KIND_ICON: Record<BarKind, PhosphorIconName> = { boxes: 'squares-four', steps: 'list-checks', columns: 'columns', list: 'list', numbered: 'list-numbers' }
const ADD_LABEL: Record<BarKind, string> = { boxes: 'Add a box', steps: 'Add a step', columns: 'Add a column', list: 'Add an item', numbered: 'Add an item' }

export interface SlideBlockBarProps {
  editor: TipTapEditor | null
  /** The slide's frame (unscaled; the slide is scaled inside it): the handles are drawn in it. */
  frame: HTMLDivElement | null
  theme: DeckTheme
  /** Run a change on the slide's editor (written to the deck as an undo step of its own). */
  apply: (tr: Transaction | null) => boolean
  /** A new Steps block's label: the deck's last (as the / menu's Steps). */
  stepsLabel: () => string | null
}

/** Where the chosen block and its parts are, in the frame. */
interface Placed {
  block: Box
  /** The block on the screen, for the bar in `document.body`. */
  screen: DOMRect
  /** Columns: the lines between them, each its x in the frame and the two columns' outer edges on the screen. */
  lines: { x: number; left: number; right: number }[]
}

function samePlace(a: Placed, b: Placed): boolean {
  const same = (x: Box, y: Box) => x.left === y.left && x.top === y.top && x.width === y.width && x.height === y.height
  return same(a.block, b.block) && a.screen.left === b.screen.left && a.screen.top === b.screen.top && a.screen.bottom === b.screen.bottom
    && JSON.stringify(a.lines) === JSON.stringify(b.lines)
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

export function SlideBlockBar({ editor, frame, theme, apply, stepsLabel }: SlideBlockBarProps) {
  const [chosen, setChosen] = useState<ChosenBlock | null>(null)
  const [open, setOpen] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [barAt, setBarAt] = useState<{ left: number; top: number } | null>(null)
  const [drag, setDrag] = useState<{ kind: 'move'; y: number; width: number; left: number } | { kind: 'split'; x: number; top: number; height: number } | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
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
    const block = chosenBlockAt(editor.state)
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
      for (let index = 0; index + 1 < columns.length; index++) {
        const a = columns[index].getBoundingClientRect()
        const b = columns[index + 1].getBoundingClientRect()
        lines.push({ x: b.left - origin.left, left: a.left, right: b.right })
      }
    }
    const next: Placed = { block: boxIn(screen, origin), screen, lines }
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
    const press = () => { setOpen(true); later() }
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
      dom.removeEventListener('pointerdown', press)
      window.removeEventListener('resize', later)
      document.removeEventListener('scroll', later, true)
      observer?.disconnect()
    }
  }, [editor, frame, measure])

  const showing = open && !!chosen && !!placed
  // Esc or a press outside the bar and the slide closes it (the slide's frame is its trigger: a press there is the
  // block's own, and opens it again).
  useDismissOnOutside(barRef, () => setOpen(false), { trigger: () => frame, enabled: showing })

  // Under the block, the page's own size; above it when there is no room under it; never off the window.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!showing || !placed || !bar) { setBarAt(null); return }
    const width = bar.offsetWidth
    const height = bar.offsetHeight
    const room = window.innerHeight
    let top = placed.screen.bottom + 8
    if (top + height > room - 8) top = Math.max(8, placed.screen.top - height - 8)
    const left = Math.max(8, Math.min(placed.screen.left, window.innerWidth - width - 8))
    setBarAt(current => (current && current.left === left && current.top === top ? current : { left, top }))
    // Again only when the block moves or the bar's contents change (its width): never on its own update.
  }, [showing, placed, chosen?.node, chosen?.kind])

  if (!editor || !chosen || !placed || !layer) return null

  const run = (tr: Transaction | null) => { apply(tr); editor.view.focus() }
  const state = editor.state
  const attrs = divAttributesOf(chosen.node)
  const look = chosen.kind === 'boxes' ? boxesLookOf(attrs) : null
  const fill = look?.fill ?? theme.boxes
  const columns = chosen.kind === 'columns' ? columnCount(chosen.node) : 0
  const caretColumn = chosen.kind === 'columns' ? columnIndexAt(state, chosen.pos) : null
  const setValue = (key: string, value: string | null) => run(setBlockValue(editor.state, chosen.pos, key, value))
  const add = () => run(addItem(editor.state, chosen.pos))
  const canAdd = chosen.kind !== 'columns' || columns < MAX_COLUMNS

  // ---- The ⋮ drag: where the block lands, by the lines between the slide's blocks.
  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !frame) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const doc = editor.state.doc
    const index = doc.resolve(chosen.pos).index(0)
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
      if (drop && target !== null) run(moveBlock(editor.state, chosen.pos, target))
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
    const origin = frame.getBoundingClientRect()
    let fraction = splitPlace(event.clientX, edges.left, edges.right)
    const show = () => {
      const x = edges.left + snapSplit(fraction) * (edges.right - edges.left) - origin.left
      setDrag({ kind: 'split', x, top: placed.block.top, height: placed.block.height })
    }
    show()
    const onMove = (move: PointerEvent) => { fraction = splitPlace(move.clientX, edges.left, edges.right); show() }
    const end = (drop: boolean) => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      setDrag(null)
      if (drop) run(setColumnSplit(editor.state, chosen.pos, line, fraction))
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
  const plus = plusSpot(block, chosen.kind)
  const handleStyle = (spot: { left: number; top: number }): CSSProperties => ({ left: spot.left, top: spot.top, width: HANDLE_SIZE, height: HANDLE_SIZE })

  return (
    <>
      {/* The handles go in a layer of their own, put in the frame by this component (a portal): the frame's other
          children move (the bubble menu goes to the page), and React inserting beside them failed (the app run). */}
      {createPortal(showing ? (
        <>
          <div className="deck-block-ring" style={{ left: block.left - 4, top: block.top - 4, width: block.width + 8, height: block.height + 8 }} aria-hidden="true" />
          <Tooltip label="Drag to move the block on the slide">
            <Button variant="ghost" className="deck-block-grip" style={handleStyle(grip)} aria-label="Move the block" onPointerDown={startMove} onMouseDown={event => event.preventDefault()}>
              <Icon name="dots-six-vertical" size={14} tone="inherit" />
            </Button>
          </Tooltip>
          {canAdd ? (
            <Tooltip label={ADD_LABEL[chosen.kind]}>
              <Button variant="outline" className="deck-block-plus" style={handleStyle(plus)} aria-label={ADD_LABEL[chosen.kind]} onMouseDown={event => event.preventDefault()} onClick={add}>
                <Icon name="plus" size={12} tone="inherit" />
              </Button>
            </Tooltip>
          ) : null}
          {placed.lines.map((line, index) => (
            <Tooltip key={index} label="Drag to change the columns' widths">
              <Button
                variant="ghost"
                className="deck-block-split"
                style={{ left: line.x - 6, top: block.top, height: block.height }}
                aria-label="Change the columns' widths"
                onPointerDown={startSplit(index)}
                onMouseDown={event => event.preventDefault()}
              />
            </Tooltip>
          ))}
          {drag?.kind === 'move' ? <div className="deck-block-drop" style={{ left: drag.left, top: drag.y - 1, width: drag.width }} aria-hidden="true" /> : null}
          {drag?.kind === 'split' ? <div className="deck-block-guide" style={{ left: drag.x - 1, top: drag.top, height: drag.height }} aria-hidden="true" /> : null}
        </>
      ) : null, layer)}
      {showing
        ? createPortal(
            <div
              ref={barRef}
              className="deck-block-bar"
              role="toolbar"
              aria-label={`${BAR_KIND_LABEL[chosen.kind]} block`}
              style={{ left: barAt?.left ?? -9999, top: barAt?.top ?? -9999 }}
            >
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
                  {BAR_KINDS.map(kind => (
                    <DropdownMenuItem
                      key={kind}
                      className="gap-2"
                      onSelect={() => { if (kind !== chosen.kind) apply(turnInto(editor.state, chosen.pos, kind, kind === 'steps' ? stepsLabel() : null)) }}
                    >
                      <Icon name={KIND_ICON[kind]} size={16} tone="inherit" />
                      <span className="flex-1">{BAR_KIND_LABEL[kind]}</span>
                      {kind === chosen.kind ? <Icon name="check" size={14} tone="inherit" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {look ? (
                <>
                  <Sep />
                  <Segment label="Style">
                    <Choice on={fill === 'filled'} label="Filled" tip="Boxes filled with the theme's colour" onPick={() => setValue('fill', fill === 'filled' ? null : 'filled')} />
                    <Choice on={fill === 'outline'} label="Outline" tip="Boxes drawn as an outline" onPick={() => setValue('fill', fill === 'outline' ? null : 'outline')} />
                  </Segment>
                  <Sep />
                  <Segment label="Width">
                    <Choice on={!look.width} icon="columns" label="Auto" tip="One row while every box is at least S wide, else two rows" onPick={() => setValue('width', null)} />
                    {(['s', 'm', 'l'] as BoxWidth[]).map(width => (
                      <Choice key={width} on={look.width === width} label={width.toUpperCase()} tip={`Every box ${{ s: 'small', m: 'medium', l: 'large' }[width]} (about ${{ s: 180, m: 260, l: 400 }[width]} px on the slide), wrapping to rows`} onPick={() => setValue('width', width)} />
                    ))}
                  </Segment>
                  <Sep />
                  <Segment label="Text alignment">
                    <Choice on={!look.align} icon="text-align-left" tip="Text on the left" onPick={() => setValue('align', null)} />
                    <Choice on={look.align === 'center'} icon="text-align-center" tip="Text in the centre" onPick={() => setValue('align', 'center')} />
                  </Segment>
                </>
              ) : null}
              {chosen.kind === 'columns' ? (
                <>
                  <Sep />
                  <Segment label="Columns">
                    {[2, 3, 4].map(count => (
                      <Choice
                        key={count}
                        on={columns === count}
                        label={String(count)}
                        tip={count < columns ? `${count} columns: the words of the others go to the last one` : `${count} columns`}
                        onPick={() => run(setColumnCount(editor.state, chosen.pos, count))}
                      />
                    ))}
                  </Segment>
                  <Sep />
                  <Segment label="Vertical alignment">
                    <Choice on={!columnsAlignOf(attrs)} icon="align-top" tip="Columns' words at the top" onPick={() => setValue('valign', null)} />
                    <Choice on={columnsAlignOf(attrs) === 'middle'} icon="align-center-vertical" tip="Columns' words in the middle" onPick={() => setValue('valign', 'middle')} />
                    <Choice on={columnsAlignOf(attrs) === 'bottom'} icon="align-bottom" tip="Columns' words at the bottom" onPick={() => setValue('valign', 'bottom')} />
                  </Segment>
                </>
              ) : null}
              <Sep />
              <Tooltip label={canAdd ? ADD_LABEL[chosen.kind] : `A Columns block holds ${MAX_COLUMNS} columns at most`}>
                <Button variant="toolbar" size="compact" disabled={!canAdd} onMouseDown={event => event.preventDefault()} onClick={add}>
                  <Icon name="plus" size={16} tone="inherit" />
                  Add
                </Button>
              </Tooltip>
              <Tooltip label="Delete this block">
                <Button variant="toolbar" size="compact" aria-label="Delete this block" onMouseDown={event => event.preventDefault()} onClick={() => run(deleteBlock(editor.state, chosen.pos))}>
                  <Icon name="trash" size={16} tone="inherit" />
                </Button>
              </Tooltip>
              {chosen.kind === 'columns' ? (
                <DropdownMenu modal={false}>
                  <Tooltip label="More for the columns">
                    <DropdownMenuTrigger asChild>
                      <Button variant="toolbar" size="compact" aria-label="More for the columns" onMouseDown={event => event.preventDefault()}>
                        <Icon name="dots-three" size={16} tone="inherit" />
                      </Button>
                    </DropdownMenuTrigger>
                  </Tooltip>
                  <DropdownMenuContent align="end" onCloseAutoFocus={event => { event.preventDefault(); editor.view.focus() }}>
                    <DropdownMenuItem className="gap-2" disabled={columns >= MAX_COLUMNS} onSelect={() => apply(addItem(editor.state, chosen.pos))}>
                      <Icon name="plus" size={16} tone="inherit" />
                      Add a column
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      disabled={columns <= MIN_COLUMNS || caretColumn === null}
                      onSelect={() => { if (caretColumn !== null) apply(removeColumn(editor.state, chosen.pos, caretColumn)) }}
                    >
                      <Icon name="minus" size={16} tone="inherit" />
                      Remove a column
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2" tone="danger" onSelect={() => apply(deleteBlock(editor.state, chosen.pos))}>
                      <Icon name="trash" size={16} tone="inherit" />
                      Delete block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
