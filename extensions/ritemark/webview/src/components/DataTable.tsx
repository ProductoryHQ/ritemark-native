import { useMemo, useRef, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface DataTableProps {
  data: Record<string, unknown>[]
  columns: string[]
  editable?: boolean
  onCellChange?: (rowIndex: number, columnId: string, value: string) => void
}

interface EditableCellProps {
  value: string
  rowIndex: number
  columnId: string
  onCellChange?: (rowIndex: number, columnId: string, value: string) => void
}

function EditableCell({ value, rowIndex, columnId, onCellChange }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    setIsEditing(true)
    setEditValue(value)
    // Focus input after render
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select() // Select all text for easy replacement
    }, 0)
  }, [value])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    if (editValue !== value && onCellChange) {
      onCellChange(rowIndex, columnId, editValue)
    }
  }, [editValue, value, rowIndex, columnId, onCellChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBlur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(value)
    }
  }, [handleBlur, value])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent text-[var(--vscode-foreground)] outline-none"
        style={{ margin: 0, padding: 0 }}
      />
    )
  }

  return (
    <span
      onClick={handleClick}
      className="block w-full cursor-text"
    >
      {value || '\u00A0'}
    </span>
  )
}

export function DataTable({ data, columns, editable = false, onCellChange }: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const toggleRowExpanded = useCallback((rowIndex: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
      } else {
        next.add(rowIndex)
      }
      return next
    })
  }, [])

  // Create column definitions from column names
  const columnHelper = createColumnHelper<Record<string, unknown>>()

  const columnDefs: ColumnDef<Record<string, unknown>, unknown>[] = useMemo(() => {
    return columns.map((col) =>
      columnHelper.accessor((row) => row[col], {
        id: col,
        header: col,
        cell: (info) => {
          const value = info.getValue()
          const stringValue = value === null || value === undefined ? '' : String(value)

          if (editable) {
            return (
              <EditableCell
                value={stringValue}
                rowIndex={info.row.index}
                columnId={col}
                onCellChange={onCellChange}
              />
            )
          }

          return stringValue
        },
      })
    )
  }, [columns, editable, onCellChange])

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()

  const ROW_HEIGHT = 37 // Fixed row height (py-2 = 16px + text ~20px + border 1px)

  // Virtual scrolling for performance with large datasets
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  // Calculate padding to position rows correctly with safe bounds
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const lastRow = virtualRows[virtualRows.length - 1]
  const paddingBottom = virtualRows.length > 0 && lastRow
    ? Math.max(0, totalSize - (lastRow.end ?? totalSize))
    : 0

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
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--vscode-editor-background)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {/* Row number header */}
              <th
                className="px-2 py-2 text-center font-semibold border-b border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-descriptionForeground)]"
                style={{ minWidth: 50, width: 50 }}
              />
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left font-semibold border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]"
                  style={{ minWidth: 100 }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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
            const isExpanded = expandedRows.has(virtualRow.index)
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                onClick={() => toggleRowExpanded(virtualRow.index)}
                className={`hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer ${isExpanded ? 'bg-[var(--vscode-list-activeSelectionBackground)]' : ''}`}
                style={{ height: isExpanded ? 'auto' : ROW_HEIGHT, minHeight: ROW_HEIGHT }}
              >
                {/* Row number */}
                <td
                  className={`px-2 py-2 text-center text-xs border-b border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-[var(--vscode-descriptionForeground)] ${isExpanded ? '' : 'overflow-hidden whitespace-nowrap'}`}
                  style={{ minWidth: 50, width: 50, verticalAlign: 'top' }}
                >
                  {virtualRow.index + 1}
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 border-b border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] ${isExpanded ? 'whitespace-pre-wrap break-words' : 'overflow-hidden whitespace-nowrap text-ellipsis'}`}
                    style={{ maxWidth: isExpanded ? 'none' : 300, verticalAlign: 'top' }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
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
    </div>
  )
}
