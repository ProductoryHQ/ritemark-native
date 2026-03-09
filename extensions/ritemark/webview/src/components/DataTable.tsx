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
import { ChevronUp, ChevronDown, ChevronsUpDown, Plus, Minus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
}

interface ActiveCell {
  rowPosition: number
  columnIndex: number
}

export function DataTable({ data, columns, editable = false, onCellChange, onAddRow, onAddColumn, onRenameColumn, onDeleteColumn, onInsertRowAt, onDeleteRow }: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
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
    editStartedByTyping.current = initialValue !== undefined
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
      <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
        No data to display
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {editable && (
        <div className="flex-shrink-0 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] px-3 py-1 z-20">
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
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      onClick={() => {
        setSelectedRow(null)
        setConfirmDeleteRow(null)
        setOpenColumnMenu(null)
        setConfirmDeleteColumn(null)
      }}
    >
      <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: 'max-content' }}>
        <thead
          className="sticky z-10 bg-[var(--vscode-editor-background)]"
          style={{ top: 0 }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              <th
                className="px-2 py-2 text-center font-semibold border-b border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-descriptionForeground)]"
                style={{ minWidth: 50, width: 50 }}
              />
              {headerGroup.headers.map((header) => {
                const colId = header.column.id
                const isRenaming = renamingColumn === colId
                const isMenuOpen = openColumnMenu === colId
                const isColConfirming = confirmDeleteColumn === colId
                return (
                <th
                  key={header.id}
                  className="group relative px-3 py-2 text-left font-semibold border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)] select-none"
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
                      className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-focusBorder)] rounded-sm px-1 py-0 text-sm font-semibold outline-none"
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
                        <ChevronUp size={14} className="text-[var(--vscode-descriptionForeground)] flex-shrink-0" />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ChevronDown size={14} className="text-[var(--vscode-descriptionForeground)] flex-shrink-0" />
                      ) : (
                        <ChevronsUpDown size={14} className="text-[var(--vscode-descriptionForeground)] opacity-30 flex-shrink-0" />
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
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)] ${
                            isMenuOpen ? 'opacity-100 bg-[var(--vscode-toolbar-hoverBackground)]' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                          }`}
                          title="Column actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full z-30 mt-1 min-w-[148px] overflow-hidden rounded-md border border-[var(--vscode-widget-border,var(--vscode-panel-border))] bg-[var(--vscode-menu-background,var(--vscode-editor-background))] shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isColConfirming && onDeleteColumn ? (
                              <div className="p-2">
                                <div className="mb-2 text-xs text-[var(--vscode-descriptionForeground)]">
                                  Delete this column?
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded px-2 py-1 text-xs text-white"
                                    style={{ background: 'var(--vscode-errorForeground, #f44)', border: 'none', cursor: 'pointer' }}
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
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
                                    onClick={() => {
                                      setOpenColumnMenu(null)
                                      setRenamingColumn(colId)
                                      setRenameValue(colId)
                                    }}
                                  >
                                    <Pencil size={14} />
                                    Rename
                                  </button>
                                )}
                                {onDeleteColumn && (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--vscode-errorForeground,var(--vscode-foreground))] hover:bg-[var(--vscode-list-hoverBackground)]"
                                    onClick={() => setConfirmDeleteColumn(colId)}
                                  >
                                    <Trash2 size={14} />
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
                  className="px-2 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-center"
                  style={{ width: 36, minWidth: 36 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddColumn()
                    }}
                    className="inline-flex items-center justify-center rounded-sm opacity-40 hover:opacity-100 transition-opacity text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-textLink-foreground)]"
                    title="Add column"
                  >
                    <Plus size={14} />
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
                      className={`relative px-3 py-2 border-b border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] cursor-cell focus:outline-none ${isEditing ? 'overflow-visible whitespace-normal' : 'overflow-hidden'}`}
                      style={{
                        minWidth: 120,
                        maxWidth: 400,
                        boxShadow: isActive && !isEditing
                          ? 'inset 0 0 0 2px var(--vscode-focusBorder, var(--vscode-textLink-foreground))'
                          : undefined,
                        background: isActive && !isEditing
                          ? 'var(--vscode-editor-selectionHighlightBackground, transparent)'
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
                          navigator.clipboard.writeText(rawValue)
                          return
                        }

                        if (!editable) return
                        // When already editing, let the textarea handle all keys
                        if (isEditing) return

                        // Paste into selected cell
                        if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          navigator.clipboard.readText().then((text) => {
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
                          className="absolute left-0 top-0 z-30 resize-none border-2 border-[#4338ca] bg-[var(--vscode-editor-background)] p-2 text-[var(--vscode-foreground)] outline-none shadow-lg"
                          style={{
                            width: editOverlayWidth || 'calc(100% - 4px)',
                            minHeight: 56,
                          }}
                        />
                      ) : (
                        <span className="block w-full pointer-events-none" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                          {rawValue || '\u00A0'}
                        </span>
                      )}
                    </td>
                  )
                })}
                {editable && onAddColumn && (
                  <td
                    className="border-b border-[var(--vscode-panel-border)]"
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
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr
              className="group cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]"
              onClick={onAddRow}
            >
              <td
                className="px-2 py-1.5 text-center border-b border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]"
                style={{ width: 50, minWidth: 50 }}
              >
                <Plus size={12} className="mx-auto opacity-40 group-hover:opacity-100 text-[var(--vscode-textLink-foreground)] transition-opacity" />
              </td>
              <td
                colSpan={columns.length + (onAddColumn ? 1 : 0)}
                className="px-3 py-1.5 text-xs border-b border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)] opacity-40 group-hover:opacity-100 transition-opacity"
              >
                Add row
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
    </div>
  )
}
