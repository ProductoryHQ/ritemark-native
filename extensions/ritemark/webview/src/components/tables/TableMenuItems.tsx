/**
 * Tables you can change (experience 48, frame 1): the items of a table's menus, one list for every menu that shows
 * them: the column's and the row's (from their grips), the cell's (Shift+F10 or a right-click: the row's and the
 * column's together) and the table's own (the whole table chosen: Copy as Markdown, Delete table). The Text editor
 * shows them in a dropdown under the grip or at the pointer (`TableHandlesLayer`); a slide also shows the cell's and
 * the table's in its own right-click menu, so the items are drawn with whichever menu primitives the caller passes.
 *
 * What each item does is a function of `tableOps.ts`, dispatched as one transaction.
 */
import type { ComponentType, ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { getHTMLFromFragment } from '@tiptap/core'
import { Fragment, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import { editorHTMLToMarkdown } from '../../utils/editorMarkdown'
import { writeClipboard } from '../../lib/clipboard'
import { Icon, type PhosphorIconName } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { cn } from '../../lib/utils'
import {
  alignColumn,
  columnAlign,
  deleteColumn,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  sortByColumn,
  tableAt,
  type ColumnAlign,
} from '../../extensions/tables/tableOps'
import type { TableMenuKind } from '../../extensions/tables/TableHandles'

export interface TableMenuTarget {
  kind: TableMenuKind
  tablePos: number
  row: number
  col: number
}

/** The menu primitives the items are drawn with: a dropdown's or a context menu's. */
export interface MenuKit {
  Item: ComponentType<{ onSelect?: (event: Event) => void; disabled?: boolean; className?: string; children?: ReactNode; 'aria-label'?: string; 'data-on'?: string }>
  Separator: ComponentType<Record<string, never>>
}

/** The table as Markdown, written as the document saves it. */
export function tableMarkdown(table: PMNode, schema: Schema): string {
  return editorHTMLToMarkdown(getHTMLFromFragment(Fragment.from(table), schema)).trim()
}

const ITEM = 'gap-2.5 text-[13px] [&_svg]:shrink-0'
const DANGER = 'text-[var(--r-error)] focus:text-[var(--r-error)] [&_svg]:text-[var(--r-error)]'

const ALIGNS: { align: Exclude<ColumnAlign, null>; icon: PhosphorIconName; label: string }[] = [
  { align: 'left', icon: 'text-align-left', label: 'Align left' },
  { align: 'center', icon: 'text-align-center', label: 'Align centre' },
  { align: 'right', icon: 'text-align-right', label: 'Align right' },
]

export function TableMenuItems({ editor, target, kit, sortDescending, onActed }: {
  editor: Editor
  target: TableMenuTarget
  kit: MenuKit
  /** ⌥ is held: Sort A to Z reads, and sorts, Z to A. */
  sortDescending: boolean
  /** An item ran (the menu closes after, except for the alignment, which stays to show its choice). */
  onActed?: () => void
}) {
  const { Item, Separator } = kit
  const table = tableAt(editor.state.doc, target.tablePos)
  if (!table) return null
  const map = TableMap.get(table.node)
  const { tablePos, row, col, kind } = target
  const act = (make: (state: EditorState) => Transaction | null) => {
    if (editor.isDestroyed) return
    const tr = make(editor.state)
    if (tr) editor.view.dispatch(tr)
    onActed?.()
  }
  const item = (icon: PhosphorIconName, label: string, make: (state: EditorState) => Transaction | null, options: { disabled?: boolean; danger?: boolean } = {}) => (
    <Item key={label} className={cn(ITEM, options.danger && DANGER)} disabled={options.disabled} onSelect={() => act(make)}>
      <Icon name={icon} size={14} tone="inherit" />
      {label}
    </Item>
  )

  if (kind === 'table') {
    return (
      <>
        <Item className={ITEM} onSelect={() => { writeClipboard(tableMarkdown(table.node, editor.schema)); onActed?.() }}>
          <Icon name="copy" size={14} tone="inherit" />
          Copy as Markdown
        </Item>
        <Separator />
        {item('trash', 'Delete table', state => deleteTable(state, tablePos), { danger: true })}
      </>
    )
  }

  const withRow = kind === 'row' || kind === 'cell'
  const withColumn = kind === 'column' || kind === 'cell'
  // GFM's first row is the header: it has no Move and no Delete.
  const header = row === 0
  const align = columnAlign(table.node, col)
  const inserts = [
    ...(withRow ? [
      item('arrow-line-up', 'Insert above', state => insertRow(state, tablePos, row, col)),
      item('arrow-line-down', 'Insert below', state => insertRow(state, tablePos, row + 1, col)),
    ] : []),
    ...(withColumn ? [
      item('arrow-line-left', 'Insert left', state => insertColumn(state, tablePos, col, row)),
      item('arrow-line-right', 'Insert right', state => insertColumn(state, tablePos, col + 1, row)),
    ] : []),
  ]
  const moves = [
    ...(withRow && !header ? [
      item('arrow-up', 'Move up', state => moveRow(state, tablePos, row, row - 1, col), { disabled: row <= 1 }),
      item('arrow-down', 'Move down', state => moveRow(state, tablePos, row, row + 1, col), { disabled: row >= map.height - 1 }),
    ] : []),
    ...(withColumn ? [
      item('arrow-left', 'Move left', state => moveColumn(state, tablePos, col, col - 1, row), { disabled: col <= 0 }),
      item('arrow-right', 'Move right', state => moveColumn(state, tablePos, col, col + 1, row), { disabled: col >= map.width - 1 }),
    ] : []),
  ]
  const deletes = [
    ...(withRow && !header ? [item('trash', 'Delete row', state => deleteRow(state, tablePos, row, col), { danger: true })] : []),
    ...(withColumn ? [item('trash', 'Delete column', state => deleteColumn(state, tablePos, col), { danger: true })] : []),
  ]
  return (
    <>
      {inserts}
      {moves.length && kind === 'cell' ? <Separator /> : null}
      {moves}
      {withColumn ? (
        <>
          <Separator />
          <div className="rm-table-align" role="group" aria-label="Column alignment">
            {ALIGNS.map(choice => {
              const on = (align ?? 'left') === choice.align
              return (
                <Tooltip key={choice.align} label={choice.label} className="flex-1">
                  <Item
                    className="rm-table-align-choice"
                    aria-label={choice.label}
                    data-on={on ? 'true' : undefined}
                    // The menu stays open, showing the column's new alignment.
                    onSelect={event => { event.preventDefault(); act(state => alignColumn(state, tablePos, col, choice.align)) }}
                  >
                    <Icon name={choice.icon} size={14} tone="inherit" />
                  </Item>
                </Tooltip>
              )
            })}
          </div>
          <Item
            className={ITEM}
            disabled={map.height < 3}
            onSelect={() => act(state => sortByColumn(state, tablePos, col, sortDescending ? 'desc' : 'asc'))}
          >
            <Icon name={sortDescending ? 'sort-descending' : 'sort-ascending'} size={14} tone="inherit" />
            {sortDescending ? 'Sort Z to A' : 'Sort A to Z'}
            <span className="ml-auto pl-3 text-[12px] text-ink-muted">{sortDescending ? '' : '⌥ Z to A'}</span>
          </Item>
        </>
      ) : null}
      {deletes.length ? <Separator /> : null}
      {deletes}
    </>
  )
}
