/**
 * Tables you can change (experience 48): the table's own handles, in the Text editor and on a slide.
 *
 * The table is drawn by a node view: the `<table>` as before, and beside it, inside the same element, a layer the
 * handles are drawn in (`.rm-table-ui`, not editable). The handles are part of the table's own page, never an overlay
 * over the window: on a slide, which is drawn scaled, they scale with it and a click lands where they are drawn. The
 * layer is filled by React (`TableHandlesLayer`), which finds the tables through this extension's registry.
 *
 * The extension also gives the table its keys:
 *  - Tab goes to the next cell, and in the last cell adds a row (one undo step); Shift+Tab goes back;
 *  - Shift+F10 (or the context-menu key) opens the cell's menu: its row's and its column's items together, or the
 *    table's own menu when the whole table is chosen;
 *  - with `contextMenu`, a right-click in a cell does the same at the pointer (the Text editor; the slide puts the items
 *    in its own right-click menu instead, beside Comment and Slide settings).
 *
 * Its storage is a registry per editor: the tables drawn now, and the menu asked for.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { cellAtPos, cellAtSelection, cellPos, columnWidths, nextCellOrNewRow, previousCell, tableTintPlugin, wholeTableChosen } from './tableOps'
import { columnFloors, floorCss } from '../../../../src/markdown/tableColumns'
import { watchTableEdges } from './tableEdges'

/** The words of a table's body cells (every row under the header), one string per cell. */
export function bodyTexts(table: PMNode): string[][] {
  const rows: string[][] = []
  table.forEach((row, _offset, index) => {
    if (index === 0) return
    const cells: string[] = []
    row.forEach(cell => { cells.push(cell.textContent) })
    rows.push(cells)
  })
  return rows
}

/**
 * Each column's floor as the CSS its `<col>` carries (`tableColumns.ts`), '' for a column that keeps only its widest
 * word. A table with widths gives its stored shares to the floors.
 */
export function columnFloorsCss(table: PMNode, widths: number[] | null): string[] {
  return columnFloors(bodyTexts(table), table.firstChild?.childCount ?? 0, widths).map(floor => floor ? floorCss(floor) : '')
}

export type TableMenuKind = 'column' | 'row' | 'cell' | 'table'

/**
 * The `table-handles` flag (the kill switch), as the host sent it with the document. The editors read it when they are
 * made: off, a table has no handles, menus or column lines (`Editor.tsx`, `SlideEditor.tsx`).
 */
let handlesEnabled = true

export function setTableHandlesEnabled(enabled: boolean): void {
  handlesEnabled = enabled
}

export function tableHandlesEnabled(): boolean {
  return handlesEnabled
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** A menu asked for: what it is on, and the place on the screen it opens under. */
export interface TableMenuRequest {
  kind: TableMenuKind
  tablePos: number
  row: number
  col: number
  anchor: Rect
}

/** One table drawn in the editor: its element, its `<table>`, the handles' layer, and its place in the document. */
export class TableHandlesView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  table: HTMLTableElement
  ui: HTMLElement

  constructor(public node: PMNode, public getPos: () => number | undefined, private registry: TableRegistry, tableClass: string) {
    this.dom = document.createElement('div')
    this.dom.className = 'rm-table'
    this.table = document.createElement('table')
    this.table.className = tableClass
    this.contentDOM = document.createElement('tbody')
    this.table.appendChild(this.contentDOM)
    this.ui = document.createElement('div')
    this.ui.className = 'rm-table-ui'
    this.ui.contentEditable = 'false'
    this.dom.appendChild(this.table)
    this.dom.appendChild(this.ui)
    this.drawWidths()
    // A wide table that scrolls in its own frame (a deck's handout) fades at the side with more to scroll to
    // (tableEdges.ts). Where the element doesn't scroll (a Text document, a slide), it gets no class.
    this.unwatchEdges = watchTableEdges(this.dom, this.table)
    registry.add(this)
  }

  private unwatchEdges: () => void

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    // The layer draws again on the editor's transaction that brought the change: no second render from here.
    this.drawWidths()
    return true
  }

  /**
   * The columns' widths (experience 48), as a `<colgroup>` the table's layout follows: shares of the table's width, a
   * column never narrower than its longest word (the browser's own rule for a table's columns). None: automatic.
   *
   * Each text column's floor (`tableColumns.ts`) goes on its `<col>` too, as `--rm-col-floor`: a deck's handout, where
   * a wide table scrolls in its own frame, makes it the column's `min-width` (decks.css), so a note wraps into two or
   * three lines instead of one word per line. It is read from the cells' words, so nothing is measured: only when the
   * table's node changes (an update for its decorations alone keeps the node), and the `<col>`s change in place only
   * when a width or a floor does. Elsewhere (a Text document, a slide) the variable is unused.
   */
  private drawWidths(): void {
    if (this.node === this.drawnNode) return
    this.drawnNode = this.node
    const widths = columnWidths(this.node)
    const floors = columnFloorsCss(this.node, widths)
    const key = `${widths ? widths.join(',') : ''}|${floors.join(';')}`
    if (key === this.widthsKey) return
    this.widthsKey = key
    this.table.classList.toggle('has-widths', !!widths)
    // A table with widths takes its container's width, as the slide renderer draws it (`slideRenderer.ts`).
    this.table.style.width = widths ? '100%' : ''
    let group = this.table.querySelector<HTMLElement>(':scope > colgroup')
    if (!widths && !floors.some(Boolean)) {
      group?.remove()
      return
    }
    if (!group || group.children.length !== floors.length) {
      group?.remove()
      group = document.createElement('colgroup')
      for (let col = 0; col < floors.length; col++) group.appendChild(document.createElement('col'))
      this.table.insertBefore(group, this.contentDOM)
    }
    floors.forEach((floor, col) => {
      const element = group!.children[col] as HTMLElement
      element.style.width = widths ? `${widths[col]}%` : ''
      if (floor) element.style.setProperty('--rm-col-floor', floor)
      else element.style.removeProperty('--rm-col-floor')
    })
  }

  private drawnNode: PMNode | null = null

  private widthsKey = ''

  /** Only the table's rows are the editor's to read: the handles' layer and the wrapper's own attributes are not. */
  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return false
    return !this.contentDOM.contains(mutation.target)
  }

  /** Events on the handles are theirs: the editor neither selects nor drags from them. */
  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.ui.contains(event.target)
  }

  destroy(): void {
    this.unwatchEdges()
    this.registry.remove(this)
  }
}

/** The tables an editor draws now, and the menu asked of them; React subscribes to both. */
export class TableRegistry {
  readonly views = new Set<TableHandlesView>()
  private listeners = new Set<() => void>()
  private menuListeners = new Set<(request: TableMenuRequest) => void>()

  add(view: TableHandlesView): void {
    this.views.add(view)
    this.changed()
  }

  remove(view: TableHandlesView): void {
    this.views.delete(view)
    this.changed()
  }

  changed(): void {
    for (const listener of this.listeners) listener()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  onMenu(listener: (request: TableMenuRequest) => void): () => void {
    this.menuListeners.add(listener)
    return () => { this.menuListeners.delete(listener) }
  }

  requestMenu(request: TableMenuRequest): boolean {
    if (this.menuListeners.size === 0) return false
    for (const listener of this.menuListeners) listener(request)
    return true
  }
}

export interface TableHandlesOptions {
  /** A right-click in a cell opens the table's menu (the Text editor). Off on a slide, whose own menu takes the items. */
  contextMenu: boolean
  /** The `<table>`'s class, as the table node's `HTMLAttributes` give it. */
  tableClass: string
}

export interface TableHandlesStorage {
  registry: TableRegistry
}

export const tableHandlesKey = new PluginKey('rmTableHandles')

function rectOf(element: Element): Rect {
  const rect = element.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/** The DOM cell of a table cell at `pos` (before the cell). */
function cellElement(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos)
  return dom instanceof HTMLElement ? dom : null
}

/**
 * What a right-click (or Shift+F10) at a place in the editor is on: the whole table when it is chosen and the place is in
 * it, else the cell. Null outside a table.
 */
export function tableMenuTargetAt(view: EditorView, target: EventTarget | null): Omit<TableMenuRequest, 'anchor'> | null {
  if (!(target instanceof Element)) return null
  const cell = target.closest('td, th')
  if (!cell || !view.dom.contains(cell)) return null
  let pos: number
  try {
    pos = view.posAtDOM(cell, 0)
  } catch {
    return null
  }
  const at = cellAtPos(view.state.doc.resolve(pos))
  if (!at) return null
  const whole = wholeTableChosen(view.state)
  if (whole && whole.pos === at.pos) return { kind: 'table', tablePos: at.pos, row: at.row, col: at.col }
  return { kind: 'cell', tablePos: at.pos, row: at.row, col: at.col }
}

export const TableHandles = Extension.create<TableHandlesOptions, TableHandlesStorage>({
  name: 'tableHandles',
  // Before the table's own Tab (TipTap's Table, 100): Tab is one undo step here.
  priority: 110,

  addOptions() {
    return { contextMenu: true, tableClass: 'tiptap-table-node' }
  },

  addStorage() {
    return { registry: new TableRegistry() }
  },

  addKeyboardShortcuts() {
    const openCellMenu = () => {
      const view = this.editor.view
      const state = view.state
      const whole = wholeTableChosen(state)
      const cell = cellAtSelection(state)
      if (!cell && !whole) return false
      const tablePos = whole ? whole.pos : cell!.pos
      const dom = whole ? view.nodeDOM(whole.pos) : null
      const at = cell ? cellPos(state.doc, cell.pos, cell.row, cell.col) : null
      const cellDom = at !== null ? cellElement(view, at) : null
      const anchorElement = (cellDom ?? dom) as Element | null
      if (!anchorElement) return false
      return this.storage.registry.requestMenu({
        kind: whole ? 'table' : 'cell',
        tablePos,
        row: cell?.row ?? 0,
        col: cell?.col ?? 0,
        anchor: rectOf(anchorElement),
      })
    }
    return {
      Tab: () => {
        const tr = nextCellOrNewRow(this.editor.state)
        if (!tr) return false
        this.editor.view.dispatch(tr)
        return true
      },
      'Shift-Tab': () => {
        if (!cellAtSelection(this.editor.state)) return false
        const tr = previousCell(this.editor.state)
        if (tr) this.editor.view.dispatch(tr)
        // In the first cell Shift+Tab stays in the table, as Tab does in the last.
        return true
      },
      'Shift-F10': openCellMenu,
      ContextMenu: openCellMenu,
    }
  },

  addProseMirrorPlugins() {
    const registry = this.storage.registry
    const options = this.options
    return [
      new Plugin({
        key: tableHandlesKey,
        props: {
          nodeViews: {
            table: (node, _view, getPos) => new TableHandlesView(node, getPos as () => number | undefined, registry, options.tableClass),
          },
          handleDOMEvents: {
            contextmenu: (view, event) => {
              if (!options.contextMenu) return false
              const target = tableMenuTargetAt(view, event.target)
              if (!target) return false
              event.preventDefault()
              event.stopPropagation()
              // The caret goes where the person right-clicked, unless what they chose is there already, so the menu's
              // Paste and Cut act on that cell, as the webview's own menu did (the app run on #772: Paste went to the
              // caret left at the top of the document).
              if (target.kind === 'cell') {
                const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
                const chosen = cellAtSelection(view.state)
                const sameCell = chosen && chosen.pos === target.tablePos && chosen.row === target.row && chosen.col === target.col
                if (at && !(sameCell && !view.state.selection.empty)) {
                  const $at = view.state.doc.resolve(at.pos)
                  const cell = cellAtPos($at)
                  if (cell && cell.pos === target.tablePos && cell.row === target.row && cell.col === target.col) {
                    view.dispatch(view.state.tr.setSelection(TextSelection.near($at)))
                  }
                }
              }
              return registry.requestMenu({ ...target, anchor: { left: event.clientX, top: event.clientY, width: 0, height: 0 } })
            },
          },
        },
      }),
      // The chosen column or row, tinted while its menu is open or it is dragged.
      tableTintPlugin(),
    ]
  },
})
