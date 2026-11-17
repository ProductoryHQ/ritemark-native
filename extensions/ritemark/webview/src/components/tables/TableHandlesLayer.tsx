/**
 * Tables you can change (experience 48, frame 1): the handles each table draws in its own layer (`TableHandles.ts`'s
 * node view), and the menus they open. One component for the Text editor and the slide editor.
 *
 *  - Pointing at a cell shows its column's grip (a pill on the table's top edge, over the column) and its row's grip (on
 *    the left edge), and the + bars on the right and bottom edges. They show only on hover or while the caret is in the
 *    table, so a table being read is just a table.
 *  - A click on a grip chooses the column or row (its cells tinted) and opens its menu under the grip.
 *  - Dragging a grip moves the column or row; an accent line shows where it lands. One undo step.
 *  - The + bars add a column or a row at the end.
 *
 * The handles are drawn inside the table's element, positioned in its own coordinates: on a slide (drawn with
 * `transform: scale`) every measured rect is divided by the scale, so the handles scale with the slide and a click
 * lands where they are drawn, and a drag's pointer positions are divided by it too. Where the table's container clips
 * (a slide's text area), the handles stay inside it.
 */
import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import type { TableHandlesStorage, TableHandlesView, TableMenuRequest, TableRegistry, Rect } from '../../extensions/tables/TableHandles'
import { cellAtSelection, columnWidths, insertColumn, insertRow, moveColumn, moveRow, setColumnWidths, setTint, tableAt, tableTintKey } from '../../extensions/tables/tableOps'
import { minPercent, resizePair } from './columnResize'
import { MAX_WIDTH_COLUMNS, snapPercents } from '../../../../src/markdown/tableWidths'
import { TableMenuItems, type MenuKit } from './TableMenuItems'
import { dropTarget } from './dropTarget'

const GRIP_GAP = 4
const COL_GRIP = { width: 28, height: 14 }
const ROW_GRIP = { width: 14, height: 26 }
const BAR = 14
const DRAG_THRESHOLD = 4
/** On a slide drawn small, the handles are never drawn under 70 % of their size on the screen. */
const MIN_SCREEN = 0.7
const RESIZE_ZONE = 8

interface ResizeState {
  boundary: number
  start: number[]
  mins: number[]
  percents: number[]
  moved: boolean
}

let measureCanvas: HTMLCanvasElement | null = null

/** The widest word of a cell, with the cell's side padding, in the table's own (unscaled) pixels. */
function longestWordOf(cell: HTMLTableCellElement): number {
  measureCanvas ??= document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  const style = getComputedStyle(cell)
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  if (!context) return padding
  context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  let widest = 0
  for (const word of (cell.textContent ?? '').split(/\s+/)) {
    if (word) widest = Math.max(widest, context.measureText(word).width)
  }
  return widest + padding + 2
}

interface OpenMenu extends TableMenuRequest {
  serial: number
}

interface Geometry {
  scale: number
  box: DOMRect
  table: Rect
  rows: Rect[]
  cols: Rect[]
  /** The container that clips the table (a slide's text area), in the table's coordinates; null when nothing does. */
  clip: Rect | null
}

interface DragState {
  kind: 'column' | 'row'
  from: number
  startX: number
  startY: number
  moved: boolean
  /** Where it lands: the index the column or row ends up at, and the boundary the line is drawn on. */
  to: number
  line: number | null
}

export const dropdownKit: MenuKit = {
  Item: DropdownMenuItem as unknown as MenuKit['Item'],
  Separator: DropdownMenuSeparator as unknown as MenuKit['Separator'],
}

function registryOf(editor: Editor | null): TableRegistry | null {
  const storage = (editor?.storage as Record<string, unknown> | undefined)?.tableHandles as TableHandlesStorage | undefined
  return storage?.registry ?? null
}

const clipAncestors = new WeakMap<HTMLElement, HTMLElement | null>()

/** The nearest ancestor that clips its content, looked up once per table element (a table doesn't move between them). */
function clipAncestor(element: HTMLElement): HTMLElement | null {
  if (clipAncestors.has(element)) return clipAncestors.get(element) ?? null
  let found: HTMLElement | null = null
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') { found = node; break }
  }
  clipAncestors.set(element, found)
  return found
}

/** The table's rows, header cells and clip, in the table element's own (unscaled) coordinates. */
export function measureTable(view: TableHandlesView): Geometry | null {
  const dom = view.dom
  if (!dom.isConnected || !dom.offsetWidth) return null
  const box = dom.getBoundingClientRect()
  const scale = box.width / dom.offsetWidth || 1
  const local = (rect: DOMRect): Rect => ({
    left: (rect.left - box.left) / scale,
    top: (rect.top - box.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  })
  const rows = Array.from(view.table.rows)
  const clip = clipAncestor(dom)
  return {
    scale,
    box,
    table: local(view.table.getBoundingClientRect()),
    rows: rows.map(row => local(row.getBoundingClientRect())),
    cols: Array.from(rows[0]?.cells ?? []).map(cell => local(cell.getBoundingClientRect())),
    clip: clip ? local(clip.getBoundingClientRect()) : null,
  }
}

/** Keep a handle of size `size` starting at `at` inside the clip's span [min, max]. */
function clamp(at: number, size: number, min: number | undefined, max: number | undefined): number {
  let value = at
  if (max !== undefined) value = Math.min(value, max - size)
  if (min !== undefined) value = Math.max(value, min)
  return value
}

export function TableHandlesLayer({ editor }: { editor: Editor | null }) {
  const registry = registryOf(editor)
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const serial = useRef(0)

  useEffect(() => registry?.subscribe(rerender), [registry])
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', rerender)
    editor.on('focus', rerender)
    editor.on('blur', rerender)
    return () => {
      editor.off('transaction', rerender)
      editor.off('focus', rerender)
      editor.off('blur', rerender)
    }
  }, [editor])

  const openMenu = useCallback((request: TableMenuRequest) => {
    if (!editor || editor.isDestroyed) return
    // The column or row chosen, its cells tinted, while its menu is open.
    if (request.kind === 'column' || request.kind === 'row') {
      editor.view.dispatch(setTint(editor.state, { tablePos: request.tablePos, kind: request.kind, index: request.kind === 'column' ? request.col : request.row }))
    }
    serial.current += 1
    setMenu({ ...request, serial: serial.current })
  }, [editor])
  useEffect(() => registry?.onMenu(openMenu), [registry, openMenu])

  const menuRef = useRef<OpenMenu | null>(null)
  menuRef.current = menu
  const closeMenu = useCallback((outside: boolean) => {
    const current = menuRef.current
    menuRef.current = null
    setMenu(null)
    if (!current || !editor || editor.isDestroyed) return
    // The tint goes with the menu.
    if (tableTintKey.getState(editor.state)) editor.view.dispatch(setTint(editor.state, null))
    if (!outside) editor.view.focus()
  }, [editor])

  if (!editor || !registry) return null
  return (
    <>
      {Array.from(registry.views).map(view => createPortal(
        <TableHandleSet view={view} editor={editor} menu={menu} onMenu={openMenu} />,
        view.ui,
        keyOf(view),
      ))}
      {menu ? <TableMenu key={menu.serial} editor={editor} menu={menu} onClose={closeMenu} /> : null}
    </>
  )
}

const keys = new WeakMap<TableHandlesView, string>()
let nextKey = 0
function keyOf(view: TableHandlesView): string {
  let key = keys.get(view)
  if (!key) {
    key = `rm-table-${nextKey++}`
    keys.set(view, key)
  }
  return key
}

/** One table's grips, + bars and drop line. */
function TableHandleSet({ view, editor, menu, onMenu }: { view: TableHandlesView; editor: Editor; menu: OpenMenu | null; onMenu: (request: TableMenuRequest) => void }) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const [inside, setInside] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  /** A grip pressed (until it is let go): its tooltip stays closed, so it never covers the drag. */
  const [pressing, setPressing] = useState(false)
  /** The line between two columns being dragged (experience 48, "Column widths"). */
  const [resize, setResize] = useState<ResizeState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const [, rerender] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    const dom = view.dom
    let leave = 0
    const move = (event: PointerEvent) => {
      window.clearTimeout(leave)
      setInside(true)
      const cell = event.target instanceof Element ? event.target.closest('td, th') : null
      if (cell instanceof HTMLTableCellElement && view.table.contains(cell)) {
        const row = (cell.parentElement as HTMLTableRowElement).rowIndex
        setHover(current => (current && current.row === row && current.col === cell.cellIndex ? current : { row, col: cell.cellIndex }))
      }
    }
    // A short grace, so the pointer can cross from a cell to its grip.
    const out = () => {
      window.clearTimeout(leave)
      leave = window.setTimeout(() => { setInside(false); setHover(null) }, 300)
    }
    dom.addEventListener('pointermove', move)
    dom.addEventListener('pointerleave', out)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => rerender())
    resize?.observe(view.table)
    return () => {
      window.clearTimeout(leave)
      dom.removeEventListener('pointermove', move)
      dom.removeEventListener('pointerleave', out)
      resize?.disconnect()
    }
  }, [view])

  const tablePos = view.getPos()
  const table = tablePos === undefined ? null : tableAt(editor.state.doc, tablePos)
  if (tablePos === undefined || !table) return null
  const caretCell = cellAtSelection(editor.state)
  const caret = caretCell && caretCell.pos === tablePos && editor.isFocused && !(editor.state.selection instanceof CellSelection) ? caretCell : null
  const menuHere = menu && menu.tablePos === tablePos ? menu : null
  if (!inside && !caret && !menuHere && !drag && !resize) return null
  const geometry = measureTable(view)
  if (!geometry || !geometry.cols.length) return null
  const { table: box, rows, cols, clip } = geometry
  // The handles' sizes in the table's coordinates: on a slide drawn small, larger, so they stay big enough to point at.
  const k = Math.max(1, MIN_SCREEN / geometry.scale)
  const colGrip = { width: COL_GRIP.width * k, height: COL_GRIP.height * k }
  const rowGrip = { width: ROW_GRIP.width * k, height: ROW_GRIP.height * k }
  const bar = BAR * k
  const gap = GRIP_GAP * k
  const active = menuHere ?? hover ?? caret
  const width = cols.length
  const height = rows.length
  const activeCol = drag?.kind === 'column' ? drag.from : active && active.col < width ? active.col : null
  const activeRow = drag?.kind === 'row' ? drag.from : active && active.row < height ? active.row : null

  const run = (tr: Transaction | null) => {
    if (!tr || editor.isDestroyed) return
    editor.view.dispatch(tr)
    editor.view.focus()
  }

  const gripRectOf = (element: Element): Rect => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  }

  const startDrag = (kind: 'column' | 'row', index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    // Not prevented: the grip's tooltip closes on the press, as any tooltip's does (the mouse-down is, below, so the
    // editor keeps its focus and its selection and nothing is dragged as text).
    event.currentTarget.setPointerCapture(event.pointerId)
    setPressing(true)
    dragRef.current = { kind, from: index, startX: event.clientX, startY: event.clientY, moved: false, to: index, line: null }
  }
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current) return
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) return
    // The header row isn't moved: its grip only opens its menu.
    if (current.kind === 'row' && current.from === 0) return
    const fresh = measureTable(view)
    if (!fresh) return
    if (!current.moved) editor.view.dispatch(setTint(editor.state, { tablePos, kind: current.kind, index: current.from }))
    // The pointer in the table's own coordinates: divided by the slide's scale.
    const at = current.kind === 'column'
      ? (event.clientX - fresh.box.left) / fresh.scale
      : (event.clientY - fresh.box.top) / fresh.scale
    const target = dropTarget(current.kind === 'column' ? fresh.cols : fresh.rows, current.kind, current.from, at)
    const next = { ...current, moved: true, to: target.to, line: target.to === current.from ? null : target.line }
    dragRef.current = next
    setDrag(next)
  }
  const endDrag = (cancel: boolean) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current) return
    dragRef.current = null
    setDrag(null)
    setPressing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (current.moved) editor.view.dispatch(setTint(editor.state, null))
    if (cancel) return
    if (!current.moved) {
      onMenu({
        kind: current.kind,
        tablePos,
        row: current.kind === 'row' ? current.from : 0,
        col: current.kind === 'column' ? current.from : 0,
        anchor: gripRectOf(event.currentTarget),
      })
      return
    }
    const focus = current.kind === 'column' ? (activeRow ?? 0) : (activeCol ?? 0)
    if (current.to === current.from) return
    run(current.kind === 'column'
      ? moveColumn(editor.state, tablePos, current.from, current.to, focus)
      : moveRow(editor.state, tablePos, current.from, current.to, focus))
  }

  // ---- The line between two columns: dragged, it sets the two columns' widths in 5 % steps; double-clicked, the
  // table goes back to automatic widths. Its place is in the table's coordinates, so on a slide it scales with it.
  const startResize = (boundary: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const node = tableAt(editor.state.doc, tablePos)?.node
    const start = (node && columnWidths(node)) ?? snapPercents(cols.map(c => c.width))
    const firstRow = view.table.rows[0]
    const mins = cols.map((_, index) => {
      let widest = 0
      for (const tableRow of Array.from(view.table.rows)) {
        const cell = tableRow.cells[index]
        if (cell) widest = Math.max(widest, longestWordOf(cell))
      }
      return firstRow ? minPercent(widest, box.width) : 5
    })
    const next = { boundary, start, mins, percents: start, moved: false }
    resizeRef.current = next
    setResize(next)
  }
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = resizeRef.current
    if (!current) return
    const fresh = measureTable(view)
    if (!fresh || !fresh.cols.length) return
    // The pointer in the table's own coordinates (divided by the slide's scale), as a share of the table's width.
    const at = (event.clientX - fresh.box.left) / fresh.scale
    const before = current.start.slice(0, current.boundary - 1).reduce((sum, value) => sum + value, 0)
    const leftPercent = ((at - fresh.table.left) / fresh.table.width) * 100 - before
    const percents = resizePair(current.start, current.mins, current.boundary, leftPercent)
    const next = { ...current, percents, moved: current.moved || percents.some((value, index) => value !== current.start[index]) }
    resizeRef.current = next
    setResize(next)
  }
  const endResize = (cancel: boolean) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = resizeRef.current
    if (!current) return
    resizeRef.current = null
    setResize(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!cancel && current.moved) run(setColumnWidths(editor.state, tablePos, current.percents))
  }
  const resizeLine = resize
    ? box.left + (box.width * resize.percents.slice(0, resize.boundary).reduce((sum, value) => sum + value, 0)) / 100
    : null

  const clipLeft = clip?.left
  const clipTop = clip?.top
  const clipRight = clip ? clip.left + clip.width : undefined
  const clipBottom = clip ? clip.top + clip.height : undefined
  const tableRight = box.left + box.width
  const tableBottom = box.top + box.height
  const col = activeCol !== null ? cols[activeCol] : null
  const row = activeRow !== null ? rows[activeRow] : null
  const columnOpen = menuHere?.kind === 'column' && menuHere.col === activeCol
  const rowOpen = menuHere?.kind === 'row' && menuHere.row === activeRow

  return (
    <>
      {col && activeCol !== null && !resize && (!drag || drag.kind === 'column') ? (
        <div
          className="rm-table-grip-spot"
          style={{
            left: clamp(col.left + col.width / 2 - colGrip.width / 2, colGrip.width, clipLeft, clipRight),
            top: clamp(box.top - gap - colGrip.height, colGrip.height, clipTop, clipBottom),
            width: colGrip.width,
            height: colGrip.height,
            ['--rm-k' as string]: k,
          }}
        >
          <Tooltip label="Click for the column's menu, drag to move it" className="size-full" side="top" suppressed={pressing || !!drag}>
            <Button
              type="button"
              variant="ghost"
              className={`rm-table-grip is-column${columnOpen || drag ? ' is-on' : ''}`}
              aria-label={`Column ${activeCol + 1}: menu, or drag to move`}
              aria-haspopup="menu"
              onPointerDown={startDrag('column', activeCol)}
              onMouseDown={event => event.preventDefault()}
              onPointerMove={moveDrag}
              onPointerUp={endDrag(false)}
              onPointerCancel={endDrag(true)}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onMenu({ kind: 'column', tablePos, row: 0, col: activeCol, anchor: gripRectOf(event.currentTarget) })
              }}
            >
              <Icon name="dots-six" size={12} tone="inherit" />
            </Button>
          </Tooltip>
        </div>
      ) : null}
      {row && activeRow !== null && !resize && (!drag || drag.kind === 'row') ? (
        <div
          className="rm-table-grip-spot"
          style={{
            left: clamp(box.left - gap - rowGrip.width, rowGrip.width, clipLeft, clipRight),
            top: clamp(row.top + row.height / 2 - rowGrip.height / 2, rowGrip.height, clipTop, clipBottom),
            width: rowGrip.width,
            height: rowGrip.height,
            ['--rm-k' as string]: k,
          }}
        >
          <Tooltip label={activeRow === 0 ? "Click for the header row's menu" : "Click for the row's menu, drag to move it"} className="size-full" side="left" suppressed={pressing || !!drag}>
            <Button
              type="button"
              variant="ghost"
              className={`rm-table-grip is-row${rowOpen || drag ? ' is-on' : ''}`}
              aria-label={activeRow === 0 ? 'Header row: menu' : `Row ${activeRow}: menu, or drag to move`}
              aria-haspopup="menu"
              onPointerDown={startDrag('row', activeRow)}
              onMouseDown={event => event.preventDefault()}
              onPointerMove={moveDrag}
              onPointerUp={endDrag(false)}
              onPointerCancel={endDrag(true)}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onMenu({ kind: 'row', tablePos, row: activeRow, col: 0, anchor: gripRectOf(event.currentTarget) })
              }}
            >
              <Icon name="dots-six-vertical" size={12} tone="inherit" />
            </Button>
          </Tooltip>
        </div>
      ) : null}
      {!drag && cols.length <= MAX_WIDTH_COLUMNS ? cols.slice(1).map((column, index) => {
        const boundary = index + 1
        return (
          <div
            key={`resize-${boundary}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Column width: drag to change, double-click for automatic widths"
            className={`rm-table-resize${resize?.boundary === boundary ? ' is-on' : ''}`}
            style={{ left: column.left - (RESIZE_ZONE * k) / 2, top: box.top, width: RESIZE_ZONE * k, height: box.height }}
            onMouseDown={event => event.preventDefault()}
            onPointerDown={startResize(boundary)}
            onPointerMove={moveResize}
            onPointerUp={endResize(false)}
            onPointerCancel={endResize(true)}
            onDoubleClick={() => run(setColumnWidths(editor.state, tablePos, null))}
          />
        )
      }) : null}
      {resizeLine !== null ? (
        <div className="rm-table-drop" style={{ left: resizeLine - 1.5 * k, top: box.top - 4 * k, width: 3 * k, height: box.height + 8 * k }} />
      ) : null}
      {drag?.line != null ? (
        <div
          className="rm-table-drop"
          style={drag.kind === 'column'
            ? { left: drag.line - 1.5, top: box.top - 4, width: 3, height: box.height + 8 }
            : { left: box.left - 4, top: drag.line - 1.5, width: box.width + 8, height: 3 }}
        />
      ) : null}
      {!drag && !resize ? (
        <>
          <div
            className="rm-table-add-spot"
            style={{ left: clamp(tableRight + gap, bar, clipLeft, clipRight), top: box.top, width: bar, height: box.height, ['--rm-k' as string]: k }}
          >
            <Tooltip label="Add a column" className="size-full" side="right">
              <Button
                type="button"
                variant="ghost"
                className="rm-table-add"
                aria-label="Add a column"
                onMouseDown={event => event.preventDefault()}
                onClick={() => run(insertColumn(editor.state, tablePos, width, activeRow ?? 0))}
              >
                <Icon name="plus" size={12} tone="inherit" />
              </Button>
            </Tooltip>
          </div>
          <div
            className="rm-table-add-spot"
            style={{ left: box.left, top: clamp(tableBottom + gap, bar, clipTop, clipBottom), width: box.width, height: bar, ['--rm-k' as string]: k }}
          >
            <Tooltip label="Add a row" className="size-full" side="bottom">
              <Button
                type="button"
                variant="ghost"
                className="rm-table-add"
                aria-label="Add a row"
                onMouseDown={event => event.preventDefault()}
                onClick={() => run(insertRow(editor.state, tablePos, height, activeCol ?? 0))}
              >
                <Icon name="plus" size={12} tone="inherit" />
              </Button>
            </Tooltip>
          </div>
        </>
      ) : null}
      <DragEscape active={!!drag} onEscape={() => {
        const current = dragRef.current
        dragRef.current = null
        setDrag(null)
        setPressing(false)
        if (current?.moved) editor.view.dispatch(setTint(editor.state, null))
      }} />
    </>
  )
}

/** Esc while dragging puts the column or row back where it was. */
function DragEscape({ active, onEscape }: { active: boolean; onEscape: () => void }) {
  const latest = useRef(onEscape)
  latest.current = onEscape
  useEffect(() => {
    if (!active) return
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      latest.current()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [active])
  return null
}

/** Is ⌥ held (Sort A to Z becomes Z to A)? */
export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const key = (event: KeyboardEvent) => setHeld(event.altKey)
    const pointer = (event: PointerEvent) => setHeld(event.altKey)
    window.addEventListener('keydown', key, true)
    window.addEventListener('keyup', key, true)
    window.addEventListener('pointermove', pointer, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keyup', key, true)
      window.removeEventListener('pointermove', pointer, true)
    }
  }, [])
  return held
}

/**
 * The menu: under the grip it came from, or at the pointer (a right-click) or the cell (Shift+F10). It closes on a press
 * outside and on Esc, and gives the focus back to the editor unless the press outside took it.
 */
function TableMenu({ editor, menu, onClose }: { editor: Editor; menu: OpenMenu; onClose: (outside: boolean) => void }) {
  const outside = useRef(false)
  const alt = useAltHeld()
  const anchor = menu.anchor
  return (
    <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose(outside.current) }}>
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            className="rm-table-menu-anchor"
            style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
          />
        </DropdownMenuTrigger>,
        document.body,
      )}
      <DropdownMenuContent
        align="start"
        side="bottom"
        className="rm-table-menu w-[236px] max-w-none"
        onInteractOutside={() => { outside.current = true }}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <TableMenuItems editor={editor} target={menu} kit={dropdownKit} sortDescending={alt} edits={menu.kind === 'cell'} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
