import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, Plus, Minus } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface DataTableProps {
  data: Record<string, unknown>[]
  columns: string[]
  editable?: boolean
  onCellChange?: (rowIndex: number, columnId: string, value: string) => void
  onAddRow?: () => void
  onInsertRowAt?: (index: number) => void
  onDeleteRow?: (index: number) => void
}

interface ActiveCell {
  rowPosition: number
  columnIndex: number
}

export function DataTable({ data, columns, editable = false, onCellChange, onAddRow, onInsertRowAt, onDeleteRow }: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [hoverInsertIndex, setHoverInsertIndex] = useState<number | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<number | null>(null)

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [editingCell, setEditingCell] = useState<ActiveCell | null>(null)
  const [editValue, setEditValue] = useState('')

  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // Create column definitions from column names
  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const columnDefs: ColumnDef<Record<string, unknown>, unknown>[] = useMemo(() => {
    return columns.map((col) =>
      columnHelper.accessor((row) => row[col], {
        id: col,
        header: col,
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

  const ROW_HEIGHT = 37

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
    setActiveCell(cell)
    setEditingCell(cell)
    setEditValue(initialValue ?? getCellValue(cell))
  }, [getCellValue])

  const activeColumnId = activeCell ? columns[activeCell.columnIndex] : ''
  const activeCellValue = activeCell ? getCellValue(activeCell) : ''
  const formulaValue = isSameCell(editingCell, activeCell) ? editValue : activeCellValue

  useEffect(() => {
    if (!activeCell || editingCell) return
    const key = getCellKey(activeCell)
    cellRefs.current.get(key)?.focus()
  }, [activeCell, editingCell, getCellKey])

  useEffect(() => {
    if (!editingCell) return
    editorRef.current?.focus()
    editorRef.current?.select()
  }, [editingCell])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
        No data to display
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      onClick={() => {
        setSelectedRow(null)
        setConfirmDeleteRow(null)
      }}
    >
      {editable && (
        <div className="sticky top-0 z-20 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] px-3 py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--vscode-descriptionForeground)]">fx</span>
            <span className="min-w-[90px] text-xs text-[var(--vscode-descriptionForeground)]">
              {activeCell ? `${activeColumnId || '-'}${activeCell.rowPosition + 1}` : 'No cell selected'}
            </span>
            <textarea
              value={formulaValue}
              onChange={(e) => {
                if (!activeCell) return
                if (!isSameCell(editingCell, activeCell)) {
                  setEditingCell(activeCell)
                }
                setEditValue(e.target.value)
              }}
              onBlur={() => {
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
              rows={1}
              className="min-h-[28px] flex-1 resize-y rounded border border-[var(--vscode-input-border,var(--vscode-panel-border))] bg-[var(--vscode-input-background,var(--vscode-editor-background))] px-2 py-1 text-xs text-[var(--vscode-input-foreground,var(--vscode-foreground))] outline-none"
              placeholder="Select a cell to view/edit full value"
            />
          </div>
        </div>
      )}
      <table className="w-full border-collapse text-sm">
        <thead
          className="sticky z-10 bg-[var(--vscode-editor-background)]"
          style={{ top: editable ? 38 : 0 }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              <th
                className="px-2 py-2 text-center font-semibold border-b border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-descriptionForeground)]"
                style={{ minWidth: 50, width: 50 }}
              />
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left font-semibold border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)] select-none"
                  style={{ minWidth: 100, cursor: 'pointer' }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getIsSorted() === 'asc' ? (
                      <ChevronUp size={14} className="text-[var(--vscode-descriptionForeground)] flex-shrink-0" />
                    ) : header.column.getIsSorted() === 'desc' ? (
                      <ChevronDown size={14} className="text-[var(--vscode-descriptionForeground)] flex-shrink-0" />
                    ) : (
                      <ChevronsUpDown size={14} className="text-[var(--vscode-descriptionForeground)] opacity-30 flex-shrink-0" />
                    )}
                  </div>
                </th>
              ))}
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
                style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
              >
                <td
                  className={`relative px-2 py-2 text-center text-xs border-b border-r border-[var(--vscode-panel-border)] whitespace-nowrap bg-[var(--vscode-sideBar-background)] text-[var(--vscode-descriptionForeground)]`}
                  style={{ minWidth: 50, width: 50, verticalAlign: 'top', overflow: 'visible', cursor: onDeleteRow ? 'pointer' : 'default' }}
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
                        style={{ background: 'var(--vscode-errorForeground, #f44)', fontSize: 10, lineHeight: '18px', border: 'none', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteRow(virtualRow.index)
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
                      style={{ width: 20, height: 20, background: 'var(--vscode-errorForeground, #f44)', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteRow(virtualRow.index)
                      }}
                      title="Delete row"
                    >
                      <Minus size={12} className="text-white" />
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
                        onInsertRowAt(virtualRow.index)
                      }}
                    >
                      {hoverInsertIndex === virtualRow.index && (
                        <div className="flex items-center w-full">
                          <div className="flex-1 h-px bg-[var(--vscode-textLink-foreground)]" />
                          <div
                            className="flex items-center justify-center rounded-full bg-[var(--vscode-textLink-foreground)] text-[var(--vscode-editor-background)]"
                            style={{ width: 16, height: 16, flexShrink: 0 }}
                          >
                            <Plus size={10} />
                          </div>
                          <div className="flex-1 h-px bg-[var(--vscode-textLink-foreground)]" />
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {row.getVisibleCells().map((cell, columnIndex) => {
                  const isActive = activeCell?.rowPosition === virtualRow.index && activeCell?.columnIndex === columnIndex
                  const isEditing = editingCell?.rowPosition === virtualRow.index && editingCell?.columnIndex === columnIndex
                  const renderedValue = flexRender(cell.column.columnDef.cell, cell.getContext()) as string
                  const cellCoord: ActiveCell = { rowPosition: virtualRow.index, columnIndex }

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
                      className={`relative px-3 py-2 border-b border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] cursor-cell focus:outline-none ${isEditing ? 'overflow-visible whitespace-normal' : 'overflow-hidden whitespace-nowrap text-ellipsis'}`}
                      style={{
                        boxShadow: isActive
                          ? 'inset 0 0 0 2px var(--vscode-focusBorder, var(--vscode-textLink-foreground))'
                          : undefined,
                        background: isActive
                          ? 'var(--vscode-editor-selectionHighlightBackground, transparent)'
                          : undefined,
                        zIndex: isEditing ? 30 : undefined,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setSelectedRow(null)
                        setConfirmDeleteRow(null)
                        if (editable && isActive && !isEditing) {
                          startEditing(cellCoord)
                          return
                        }
                        setActiveAndFocus(cellCoord)
                      }}
                      onDoubleClick={(e) => {
                        if (!editable) return
                        e.stopPropagation()
                        startEditing(cellCoord)
                      }}
                      onKeyDown={(e) => {
                        if (!editable) return

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
                          className="absolute left-[2px] top-[2px] z-10 w-[calc(100%-4px)] resize-none rounded-sm border border-[var(--vscode-focusBorder,var(--vscode-textLink-foreground))] bg-[var(--vscode-editor-background)] p-1 text-[var(--vscode-foreground)] outline-none"
                          rows={Math.max(2, Math.min(8, editValue.split('\n').length))}
                          style={{ minHeight: 56 }}
                        />
                      ) : (
                        <span className="block w-full truncate" title={renderedValue || ''}>
                          {renderedValue || '\u00A0'}
                        </span>
                      )}
                    </td>
                  )
                })}
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
        <div className="sticky bottom-0 left-0 right-0 p-2 bg-[var(--vscode-editor-background)] border-t border-[var(--vscode-panel-border)]">
          <button
            onClick={onAddRow}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
          >
            <Plus size={14} />
            Add row
          </button>
        </div>
      )}
    </div>
  )
}
