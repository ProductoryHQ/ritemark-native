import { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Icon } from './ui/Icon'
import { writeClipboard, readClipboard } from '../lib/clipboard'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface DataTableProps {
  data: Record<string, unknown>[]
  columns: string[]
  editable?: boolean
  onCellChange?: (rowIndex: number, columnId: string, value: string) => void
  onAddRow?: () => void
  onAddColumn?: () => void
  onRenameColumn?: (oldName: string, newName: string) => void
  onDeleteColumn?: (columnName: string) => void
  onInsertRowAt?: (index: number) => void
  onDeleteRow?: (index: number) => void
  /** Returns the cell's formula (with leading =) when it has one — shown in the
   *  fx bar instead of the cached value. Excel-backed grids only. */
  getCellFormula?: (rowPosition: number, columnIndex: number) => string | undefined
  /** The columns have names (a CSV's header row), so the formula bar names the cell "Row 2 · Item";
   *  otherwise the columns are letters and it uses A1-style references (Excel). */
  namedColumns?: boolean
}

interface ActiveCell {
  rowPosition: number
  columnIndex: number
}

export function DataTable({ data, columns, editable = false, onCellChange, onAddRow, onAddColumn, onRenameColumn, onDeleteColumn, onInsertRowAt, onDeleteRow, getCellFormula, namedColumns = false }: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const formulaRef = useRef<HTMLTextAreaElement>(null)
  const [formulaFocused, setFormulaFocused] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [hoverInsertIndex, setHoverInsertIndex] = useState<number | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<number | null>(null)

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [editingCell, setEditingCell] = useState<ActiveCell | null>(null)
  const [editValue, setEditValue] = useState('')

  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null)
  const [confirmDeleteColumn, setConfirmDeleteColumn] = useState<string | null>(null)
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const editStartedByTyping = useRef(false)
  const [editOverlayWidth, setEditOverlayWidth] = useState<number | null>(null)

  // Create column definitions from column names
  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const columnDefs: ColumnDef<Record<string, unknown>, unknown>[] = useMemo(() => {
    return columns.map((col) =>
      columnHelper.accessor((row) => row[col], {
        id: col,
        header: col,
        // numbers in number order and words in word order, whatever the first row holds ('auto' read the first
        // row's value, so an empty first cell sorted 1200 before 300)
        sortingFn: 'alphanumeric',
        cell: (info) => {
          const value = info.getValue()
          return value === null || value === undefined ? '' : String(value)
        },
      })
    )
  }, [columns])

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  const ROW_HEIGHT = 32 // Ritemark 2.0: rows 32, as the kit's .grid

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const lastRow = virtualRows[virtualRows.length - 1]
  const paddingBottom = virtualRows.length > 0 && lastRow
    ? Math.max(0, totalSize - (lastRow.end ?? totalSize))
    : 0

  const getCellKey = useCallback((cell: ActiveCell) => `${cell.rowPosition}:${cell.columnIndex}`, [])
  const isSameCell = useCallback((a: ActiveCell | null, b: ActiveCell | null) => {
    if (!a || !b) return false
    return a.rowPosition === b.rowPosition && a.columnIndex === b.columnIndex
  }, [])

  const getCellValue = useCallback((cell: ActiveCell): string => {
    const row = rows[cell.rowPosition]
    const columnId = columns[cell.columnIndex]
    if (!row || !columnId) return ''
    const value = row.getValue(columnId)
    return value === null || value === undefined ? '' : String(value)
  }, [rows, columns])

  const commitEdit = useCallback((nextCell?: ActiveCell | null) => {
    if (!editingCell) return

    const row = rows[editingCell.rowPosition]
    const columnId = columns[editingCell.columnIndex]
    if (!row || !columnId) {
      setEditingCell(null)
      return
    }

    const originalValue = getCellValue(editingCell)
    if (editValue !== originalValue && onCellChange) {
      onCellChange(row.index, columnId, editValue)
    }

    setEditingCell(null)
    if (nextCell) {
      setActiveCell(nextCell)
    }
  }, [editingCell, rows, columns, editValue, getCellValue, onCellChange])

  const cancelEdit = useCallback(() => {
    if (!editingCell) return
    setEditValue(getCellValue(editingCell))
    setEditingCell(null)
  }, [editingCell, getCellValue])

  const setActiveAndFocus = useCallback((cell: ActiveCell) => {
    setActiveCell(cell)
  }, [])

  const moveActiveCell = useCallback((rowDelta: number, colDelta: number) => {
    if (!activeCell) return

    const maxRow = Math.max(0, rows.length - 1)
    const maxCol = Math.max(0, columns.length - 1)
    const next: ActiveCell = {
      rowPosition: Math.min(maxRow, Math.max(0, activeCell.rowPosition + rowDelta)),
      columnIndex: Math.min(maxCol, Math.max(0, activeCell.columnIndex + colDelta)),
    }
    setActiveAndFocus(next)
  }, [activeCell, rows.length, columns.length, setActiveAndFocus])

  const startEditing = useCallback((cell: ActiveCell, initialValue?: string) => {
    editStartedByTyping.current = initialValue !== undefined
    setActiveCell(cell)
    setEditingCell(cell)
    setEditValue(initialValue ?? getCellValue(cell))
  }, [getCellValue])

  const activeColumnId = activeCell ? columns[activeCell.columnIndex] : ''
  const activeCellValue = activeCell ? getCellValue(activeCell) : ''
  // Excel-style: a formula cell shows its formula in the fx bar (read-only —
  // there is no formula engine; editing the cell in the grid replaces the
  // formula with a plain value, which is the documented basic-editing scope).
  const activeFormula = activeCell ? getCellFormula?.(activeCell.rowPosition, activeCell.columnIndex) : undefined
  const isEditingActive = isSameCell(editingCell, activeCell)
  const formulaValue = isEditingActive ? editValue : (activeFormula ?? activeCellValue)
  // The cell's name in the formula bar: "Row 2 · Item" when the columns have names, A1-style ("A3") when they are letters
  const cellReference = !activeCell
    ? '–'
    : namedColumns
      ? `Row ${activeCell.rowPosition + 1} · ${activeColumnId || '-'}`
      : `${activeColumnId || '-'}${activeCell.rowPosition + 1}`

  // The value field is one line; while it has the keyboard it grows with its value up to 5 lines (120), then scrolls
  useLayoutEffect(() => {
    const el = formulaRef.current
    if (!el) return
    if (formulaFocused) {
      el.style.height = 'auto'
      el.style.height = Math.min(120, el.scrollHeight) + 'px'
      el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'
    } else {
      el.style.height = ''
      el.style.overflowY = 'hidden'
    }
  }, [formulaValue, formulaFocused])

  useEffect(() => {
    if (!activeCell || editingCell) return
    const key = getCellKey(activeCell)
    cellRefs.current.get(key)?.focus()
  }, [activeCell, editingCell, getCellKey])

  useEffect(() => {
    if (!editingCell) return
    // An edit started in the formula bar stays there: the person goes on typing in it
    if (formulaRef.current && formulaRef.current === formulaRef.current.ownerDocument.activeElement) return
    const el = editorRef.current
    if (!el) return
    el.focus()
    // Always place cursor at end of content
    el.selectionStart = el.selectionEnd = el.value.length
  }, [editingCell])

  // Calculate overlay width when editing starts (Google Sheets style)
  useLayoutEffect(() => {
    if (!editingCell) {
      setEditOverlayWidth(null)
      return
    }
    const cellKey = getCellKey(editingCell)
    const cellEl = cellRefs.current.get(cellKey)
    const container = parentRef.current
    if (cellEl && container) {
      const cellRect = cellEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      // Extend from cell left edge to container right edge
      const availableWidth = containerRect.right - cellRect.left - 4
      setEditOverlayWidth(Math.min(600, Math.max(cellRect.width, availableWidth)))
    }
  }, [editingCell, getCellKey])

  // Auto-resize textarea height when content changes (capped at 200px)
  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el || !editingCell) return
    el.style.height = 'auto'
    el.style.height = Math.min(200, Math.max(56, el.scrollHeight + 4)) + 'px'
  }, [editValue, editingCell])

  useEffect(() => {
    if (!renamingColumn) return
    renameRef.current?.focus()
    renameRef.current?.select()
  }, [renamingColumn])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--r-ink-muted)]">
        No data to display
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Ritemark 2.0 (Experience 30, the kit's .grid; Jarmo's Mac pass on Sprint 132): the table is one area on the
          desk, 16 in from its sides. The formula bar sits 12 under the document bar, the table 12 under it (24 under the
          document bar without one); a short table's border ends after Add row, a long one scrolls inside its border. */}
      {editable && (
        <div className="flex-shrink-0 mx-4 mt-3 z-20">
          <div className="flex min-h-[32px] items-stretch rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface)]">
            {/* The reference sits beside the value's first line, also when the field grows */}
            <span className="flex min-w-[48px] max-w-[160px] flex-none items-start border-r border-[var(--r-hairline)] px-2.5 py-[5px] text-xs leading-5 text-[var(--r-ink-muted)]">
              <span className="truncate">{cellReference}</span>
            </span>
            <textarea
              value={formulaValue}
              readOnly={!!activeFormula && !isEditingActive}
              title={activeFormula && !isEditingActive ? 'Formula cell — formulas are read-only; editing the cell in the grid replaces the formula with a value' : undefined}
              onChange={(e) => {
                if (!activeCell) return
                if (activeFormula && !isSameCell(editingCell, activeCell)) return
                if (!isSameCell(editingCell, activeCell)) {
                  setEditingCell(activeCell)
                }
                setEditValue(e.target.value)
              }}
              onFocus={() => setFormulaFocused(true)}
              onBlur={() => {
                setFormulaFocused(false)
                if (isSameCell(editingCell, activeCell)) {
                  commitEdit()
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitEdit()
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              disabled={!activeCell}
              ref={formulaRef}
              rows={1}
              className="h-[30px] min-h-[30px] flex-1 resize-none overflow-hidden rounded-r-md border-0 bg-transparent px-2.5 py-[5px] text-[13px] leading-5 text-[var(--r-ink-strong)] outline-none"
              placeholder="Select a cell to view/edit full value"
            />
          </div>
        </div>
      )}
    <div
      className={`mx-4 mb-4 ${editable ? 'mt-3' : 'mt-6'} flex min-h-0 flex-[0_1_auto] flex-col overflow-hidden rounded-lg border border-[var(--r-hairline)]`}
    >
    <div
      ref={parentRef}
      className="min-h-0 flex-[0_1_auto] overflow-auto"
      onClick={() => {
        setSelectedRow(null)
        setConfirmDeleteRow(null)
        setOpenColumnMenu(null)
        setConfirmDeleteColumn(null)
      }}
    >
      <table className={`border-separate border-spacing-0 text-[13px] ${editable && onAddRow ? '' : 'rm-grid-closed'}`} style={{ tableLayout: 'fixed', width: '100%', minWidth: 'max-content' }}>
        <thead
          className="sticky z-10 bg-[var(--vscode-ritemark-aiSheet,var(--r-surface-muted))]"
          style={{ top: 0 }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              <th
                className="h-8 border-b border-[var(--r-hairline)] bg-[var(--vscode-ritemark-aiSheet,var(--r-surface-muted))]"
                style={{ minWidth: 36, width: 36 }}
              />
              {headerGroup.headers.map((header) => {
                const colId = header.column.id
                const isRenaming = renamingColumn === colId
                const isMenuOpen = openColumnMenu === colId
                const isColConfirming = confirmDeleteColumn === colId
                return (
                <th
                  key={header.id}
                  className="group relative h-8 px-2.5 py-0 text-left text-xs font-semibold border-b border-[var(--r-hairline)] bg-[var(--vscode-ritemark-aiSheet,var(--r-surface-muted))] text-[var(--r-ink-muted)] select-none"
                  style={{ minWidth: 120, maxWidth: 400, cursor: 'pointer' }}
                  onClick={(e) => {
                    if (isRenaming) return
                    setOpenColumnMenu(null)
                    setConfirmDeleteColumn(null)
                    header.column.getToggleSortingHandler()?.(e)
                  }}
                  onMouseDown={(e) => {
                    if (editable && onRenameColumn && e.detail >= 2) {
                      e.preventDefault()
                      e.stopPropagation()
                      setOpenColumnMenu(null)
                      setConfirmDeleteColumn(null)
                      setRenamingColumn(colId)
                      setRenameValue(colId)
                    }
                  }}
                >
                  {isRenaming ? (
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        const trimmed = renameValue.trim()
                        if (trimmed && trimmed !== colId && onRenameColumn) {
                          onRenameColumn(colId, trimmed)
                        }
                        setRenamingColumn(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingColumn(null)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[var(--r-surface-muted)] text-[var(--r-ink-strong)] border border-[var(--vscode-focusBorder)] rounded-sm px-1 py-0 text-sm font-semibold outline-none"
                    />
                  ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      {header.column.getIsSorted() === 'asc' ? (
                        <Icon name="caret-up" size={14} className="text-[var(--r-ink-muted)] flex-shrink-0" />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <Icon name="caret-down" size={14} className="text-[var(--r-ink-muted)] flex-shrink-0" />
                      ) : (
                        <Icon name="caret-up-down" size={14} className="text-[var(--r-ink-muted)] opacity-30 flex-shrink-0" />
                      )}
                    </div>

                    {editable && (onRenameColumn || onDeleteColumn) && (
                      <div className="relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDeleteColumn(null)
                            setOpenColumnMenu((prev) => prev === colId ? null : colId)
                          }}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)] ${
                            isMenuOpen ? 'opacity-100 bg-[var(--r-surface-soft)]' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                          }`}
                          title="Column actions"
                        >
                          <Icon name="dots-three" size={14} />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full z-30 mt-1 min-w-[148px] overflow-hidden rounded-md border border-[var(--r-hairline)] bg-[var(--vscode-menu-background,var(--vscode-editor-background))] shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isColConfirming && onDeleteColumn ? (
                              <div className="p-2">
                                <div className="mb-2 text-xs text-[var(--r-ink-muted)]">
                                  Delete this column?
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded px-2 py-1 text-xs text-white"
                                    style={{ background: 'var(--r-error, #f44)', border: 'none', cursor: 'pointer' }}
                                    onClick={() => {
                                      onDeleteColumn(colId)
                                      setConfirmDeleteColumn(null)
                                      setOpenColumnMenu(null)
                                    }}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded px-2 py-1 text-xs"
                                    style={{ background: 'var(--vscode-button-secondaryBackground, #555)', color: 'var(--vscode-button-secondaryForeground, #fff)', border: 'none', cursor: 'pointer' }}
                                    onClick={() => setConfirmDeleteColumn(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-1">
                                {onRenameColumn && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)]"
                                    onClick={() => {
                                      setOpenColumnMenu(null)
                                      setRenamingColumn(colId)
                                      setRenameValue(colId)
                                    }}
                                  >
                                    <Icon name="pencil-simple" size={14} />
                                    Rename
                                  </button>
                                )}
                                {onDeleteColumn && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--r-error)] hover:bg-[var(--r-surface-soft)]"
                                    onClick={() => setConfirmDeleteColumn(colId)}
                                  >
                                    <Icon name="trash" size={14} />
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </th>
                )
              })}
              {editable && onAddColumn && (
                <th
                  className="h-8 px-2 py-0 border-b border-[var(--r-hairline)] bg-[var(--vscode-ritemark-aiSheet,var(--r-surface-muted))] text-center"
                  style={{ width: 36, minWidth: 36 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddColumn()
                    }}
                    className="inline-flex items-center justify-center rounded-sm opacity-40 hover:opacity-100 transition-opacity text-[var(--r-ink-muted)] hover:text-[var(--r-accent)]"
                    title="Add column"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                style={{ minHeight: ROW_HEIGHT }}
              >
                <td
                  className={`relative h-8 pl-1 pr-2.5 py-0 text-right text-xs leading-[31px] border-b border-[var(--r-hairline)] whitespace-nowrap text-[var(--r-ink-muted)]`}
                  style={{ minWidth: 36, width: 36, verticalAlign: 'top', overflow: 'visible', cursor: onDeleteRow ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (onDeleteRow) {
                      e.stopPropagation()
                      setSelectedRow(prev => prev === virtualRow.index ? null : virtualRow.index)
                    }
                  }}
                >
                  {confirmDeleteRow === virtualRow.index && onDeleteRow ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="rounded px-1 text-white"
                        style={{ background: 'var(--r-error, #f44)', fontSize: 10, lineHeight: '18px', border: 'none', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteRow(row.index) // the row's place in the file, not its place in a sorted view
                          setConfirmDeleteRow(null)
                          setSelectedRow(null)
                        }}
                        title="Confirm delete"
                      >
                        Yes
                      </button>
                      <button
                        className="rounded px-1"
                        style={{ background: 'var(--vscode-button-secondaryBackground, #555)', color: 'var(--vscode-button-secondaryForeground, #fff)', fontSize: 10, lineHeight: '18px', border: 'none', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteRow(null)
                          setSelectedRow(null)
                        }}
                        title="Cancel"
                      >
                        No
                      </button>
                    </div>
                  ) : selectedRow === virtualRow.index && onDeleteRow ? (
                    <div
                      className="flex items-center justify-center rounded-full mx-auto"
                      style={{ width: 20, height: 20, background: 'var(--r-error, #f44)', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteRow(virtualRow.index)
                      }}
                      title="Delete row"
                    >
                      <Icon name="minus" size={12} className="text-white" />
                    </div>
                  ) : (
                    virtualRow.index + 1
                  )}

                  {onInsertRowAt && (
                    <div
                      className="absolute left-0 right-0 flex items-center justify-center z-20"
                      style={{ top: -6, height: 12, cursor: 'pointer' }}
                      onMouseEnter={() => setHoverInsertIndex(virtualRow.index)}
                      onMouseLeave={() => setHoverInsertIndex(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onInsertRowAt(row.index) // before this row in the file, also when the view is sorted
                      }}
                    >
                      {hoverInsertIndex === virtualRow.index && (
                        <div className="flex items-center w-full">
                          <div className="flex-1 h-px bg-[var(--r-accent)]" />
                          <div
                            className="flex items-center justify-center rounded-full bg-[var(--r-accent)] text-[var(--vscode-editor-background)]"
                            style={{ width: 16, height: 16, flexShrink: 0 }}
                          >
                            <Icon name="plus" size={12} />
                          </div>
                          <div className="flex-1 h-px bg-[var(--r-accent)]" />
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {row.getVisibleCells().map((cell, columnIndex) => {
                  const isActive = activeCell?.rowPosition === virtualRow.index && activeCell?.columnIndex === columnIndex
                  const isEditing = editingCell?.rowPosition === virtualRow.index && editingCell?.columnIndex === columnIndex
                  const cellCoord: ActiveCell = { rowPosition: virtualRow.index, columnIndex }
                  const rawValue = getCellValue(cellCoord)

                  return (
                    <td
                      key={cell.id}
                      ref={(el) => {
                        const key = `${virtualRow.index}:${columnIndex}`
                        if (el) {
                          cellRefs.current.set(key, el)
                        } else {
                          cellRefs.current.delete(key)
                        }
                      }}
                      tabIndex={isActive ? 0 : -1}
                      className={`relative h-8 px-2.5 py-0 align-middle leading-5 border-b border-[var(--r-hairline)] text-[var(--r-ink-strong)] cursor-cell focus:outline-none ${isEditing ? 'overflow-visible whitespace-normal' : 'overflow-hidden'}`}
                      style={{
                        minWidth: 120,
                        maxWidth: 400,
                        background: isActive && !isEditing
                          ? 'var(--r-accent-soft)' // the chosen cell: the soft indigo fill (comparison/after-sheet.png)
                          : undefined,
                        zIndex: isEditing ? 40 : undefined,
                      }}
                      title={rawValue || ''}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setSelectedRow(null)
                        setConfirmDeleteRow(null)
                        // Double-click: enter editing directly (detail >= 2)
                        // This is more reliable than onDoubleClick because the textarea
                        // appearing after the first click can intercept the second click
                        if (editable && e.detail >= 2) {
                          e.preventDefault() // Prevent browser text selection
                          startEditing(cellCoord)
                          return
                        }
                        if (editable && isActive && !isEditing) {
                          startEditing(cellCoord)
                          return
                        }
                        setActiveAndFocus(cellCoord)
                      }}
                      onKeyDown={(e) => {
                        // Copy works even in read-only mode
                        if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          writeClipboard(rawValue)
                          return
                        }

                        if (!editable) return
                        // When already editing, let the textarea handle all keys
                        if (isEditing) return

                        // Paste into selected cell
                        if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          readClipboard().then((text) => {
                            if (onCellChange) {
                              const row = rows[cellCoord.rowPosition]
                              const columnId = columns[cellCoord.columnIndex]
                              if (row && columnId) {
                                onCellChange(row.index, columnId, text)
                              }
                            }
                          })
                          return
                        }

                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          moveActiveCell(-1, 0)
                          return
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          moveActiveCell(1, 0)
                          return
                        }
                        if (e.key === 'ArrowLeft') {
                          e.preventDefault()
                          moveActiveCell(0, -1)
                          return
                        }
                        if (e.key === 'ArrowRight') {
                          e.preventDefault()
                          moveActiveCell(0, 1)
                          return
                        }
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          moveActiveCell(0, e.shiftKey ? -1 : 1)
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'F2') {
                          e.preventDefault()
                          startEditing(cellCoord)
                          return
                        }
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          e.preventDefault()
                          startEditing(cellCoord, '')
                          return
                        }
                        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
                          e.preventDefault()
                          startEditing(cellCoord, e.key)
                        }
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          ref={editorRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEdit()
                              return
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              commitEdit({
                                rowPosition: Math.min(rows.length - 1, virtualRow.index + 1),
                                columnIndex,
                              })
                              return
                            }
                            if (e.key === 'Tab') {
                              e.preventDefault()
                              commitEdit({
                                rowPosition: virtualRow.index,
                                columnIndex: Math.max(0, Math.min(columns.length - 1, columnIndex + (e.shiftKey ? -1 : 1))),
                              })
                            }
                          }}
                          className="absolute left-0 top-0 z-30 resize-none border-2 border-accent bg-[var(--vscode-editor-background)] p-2 text-ink-strong outline-none shadow-lg"
                          style={{
                            width: editOverlayWidth || 'calc(100% - 4px)',
                            minHeight: 56,
                          }}
                        />
                      ) : (
                        // Ritemark 2.0 (the Experience lead): a row stays one line, 32 high, cut with an ellipsis; the
                        // formula bar is where a long value is read and edited
                        <span className="block w-full truncate pointer-events-none">
                          {rawValue || '\u00A0'}
                        </span>
                      )}
                    </td>
                  )
                })}
                {editable && onAddColumn && (
                  <td
                    className="border-b border-[var(--r-hairline)]"
                    style={{ width: 36, minWidth: 36 }}
                  />
                )}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>

      {editable && onAddRow && (
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <tbody>
            <tr
              className="group cursor-pointer hover:bg-[var(--r-surface-soft)]"
              onClick={onAddRow}
            >
              <td
                className="h-8 pl-1 pr-2.5 py-0 text-right"
                style={{ width: 36, minWidth: 36 }}
              >
                <Icon name="plus" size={12} className="ml-auto text-[var(--r-ink-muted)] group-hover:text-[var(--r-accent)]" />
              </td>
              <td
                colSpan={columns.length + (onAddColumn ? 1 : 0)}
                className="h-8 px-2.5 py-0 text-[13px] text-[var(--r-ink-muted)] group-hover:text-[var(--r-ink-strong)]"
              >
                Add row
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
    </div>
    </div>
  )
}
