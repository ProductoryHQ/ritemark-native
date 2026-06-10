import { useState, useEffect, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataTable } from './DataTable'
import { SpreadsheetToolbar } from './header/SpreadsheetToolbar'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { sendToExtension, onMessage } from '../bridge'

export interface SpreadsheetViewerProps {
  content: string
  filename: string
  fileType: 'csv' | 'xlsx'
  encoding?: string
  sizeBytes?: number
  // CSV: receives the serialized CSV text.
  // XLSX: receives the serialized workbook as base64.
  onChange?: (content: string) => void
}

interface ParsedData {
  columns: string[]
  rows: Record<string, unknown>[]
  error?: string
}

const MAX_DISPLAY_ROWS = 10000
const SIZE_WARNING_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Extract a single sheet from a parsed workbook into table data.
 * Uses spreadsheet-letter columns (A, B, C…) and a full 1:1 grid
 * (blank rows included, first row NOT swallowed as a header) so that
 * row/column indexes map exactly to worksheet cell addresses for editing.
 */
function extractSheet(workbook: XLSX.WorkBook, sheetName: string): ParsedData {
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    return { columns: [], rows: [], error: 'Sheet not found in workbook' }
  }

  const ref = worksheet['!ref']
  if (!ref) {
    return { columns: [], rows: [] }
  }

  const range = XLSX.utils.decode_range(ref)
  const columns: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    columns.push(XLSX.utils.encode_col(c))
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
  })

  let rows = aoa.map(cells => {
    const row: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      row[col] = cells[i] ?? ''
    })
    return row
  })

  if (rows.length > MAX_DISPLAY_ROWS) {
    rows = rows.slice(0, MAX_DISPLAY_ROWS)
  }

  return { columns, rows }
}

export function SpreadsheetViewer({
  content,
  filename,
  fileType,
  encoding,
  sizeBytes,
  onChange,
}: SpreadsheetViewerProps) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSizeWarning, setShowSizeWarning] = useState(false)
  const [proceedWithLargeFile, setProceedWithLargeFile] = useState(false)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [cachedWorkbook, setCachedWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [hasExcel, setHasExcel] = useState(false)

  // Conflict detection state
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showDiscardWarning, setShowDiscardWarning] = useState(false)
  const [isDiskConflict, setIsDiskConflict] = useState(false)

  // File change indicator (badge on refresh button)
  const [hasFileChanged, setHasFileChanged] = useState(false)

  // Editable when the host provides a change handler
  // (App passes one for CSV and for .xlsx files; .xls stays read-only)
  const isEditable = !!onChange

  // Check if Excel is installed on mount and listen for messages
  useEffect(() => {
    sendToExtension('checkExcel', {})

    onMessage((message) => {
      if (message.type === 'excelStatus') {
        setHasExcel(message.hasExcel as boolean)
      } else if (message.type === 'showConflictDialog') {
        // True conflict: local edits + disk changes
        setIsDiskConflict(true)
        setShowConflictDialog(true)
      } else if (message.type === 'confirmDiscard') {
        // Simple discard: local edits only
        setIsDiskConflict(false)
        setShowDiscardWarning(true)
      } else if (message.type === 'fileChanged') {
        // File changed externally - show badge on refresh button
        setHasFileChanged(true)
      } else if (message.type === 'fileDeleted') {
        // File was deleted externally
        alert(`File ${message.filename} was deleted on disk.`)
      }
    })

    return () => {
      // Cleanup if needed (onMessage doesn't return cleanup function)
    }
  }, [])

  // Check file size before parsing
  useEffect(() => {
    if (sizeBytes && sizeBytes > SIZE_WARNING_BYTES && !proceedWithLargeFile) {
      setShowSizeWarning(true)
      setIsLoading(false)
      return
    }
    setShowSizeWarning(false)
  }, [sizeBytes, proceedWithLargeFile])

  // CSV: parse on content change
  useEffect(() => {
    if (fileType !== 'csv') return
    if (showSizeWarning && !proceedWithLargeFile) return

    parseCSV(content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, fileType, showSizeWarning, proceedWithLargeFile])

  // XLSX: parse the workbook ONCE per content change and cache it.
  //
  // Fix for #110: this effect must NOT depend on selectedSheet. The old
  // combined effect cleared cachedWorkbook whenever the default sheet was
  // set (selectedSheet was a dependency), which left the cache null and
  // permanently hid the sheet selector. Sheet switching is now a separate,
  // extraction-only effect below.
  useEffect(() => {
    if (fileType !== 'xlsx') return
    if (showSizeWarning && !proceedWithLargeFile) return

    try {
      const workbook = XLSX.read(content, {
        type: encoding === 'base64' ? 'base64' : 'string',
        // Keeps column widths / row heights through an edit-save round-trip
        cellStyles: true,
      })

      if (workbook.SheetNames.length === 0) {
        setParsedData({ columns: [], rows: [], error: 'Workbook contains no sheets' })
        setIsLoading(false)
        return
      }

      setCachedWorkbook(workbook)
      // Keep the current sheet across refreshes when it still exists
      setSelectedSheet(prev =>
        prev && workbook.SheetNames.includes(prev) ? prev : workbook.SheetNames[0]
      )
    } catch (error) {
      console.error('Excel parse error:', error)
      setParsedData({
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : 'Failed to parse Excel file',
      })
      setIsLoading(false)
    }
  }, [content, fileType, encoding, showSizeWarning, proceedWithLargeFile])

  // XLSX: extract the selected sheet from the cached workbook
  useEffect(() => {
    if (fileType !== 'xlsx' || !cachedWorkbook || !selectedSheet) return
    setParsedData(extractSheet(cachedWorkbook, selectedSheet))
    setIsLoading(false)
  }, [fileType, cachedWorkbook, selectedSheet])

  const parseCSV = (csvContent: string) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields || []
        let rows = results.data as Record<string, unknown>[]

        // Truncate if too many rows
        if (rows.length > MAX_DISPLAY_ROWS) {
          rows = rows.slice(0, MAX_DISPLAY_ROWS)
        }

        setParsedData({ columns, rows })
        setIsLoading(false)
      },
      error: (error: Error) => {
        console.error('CSV parse error:', error)
        setParsedData({
          columns: [],
          rows: [],
          error: error.message || 'Failed to parse CSV',
        })
        setIsLoading(false)
      },
    })
  }

  // Handle cell edits (CSV only)
  const handleCellChange = useCallback((rowIndex: number, columnId: string, value: string) => {
    if (!parsedData || !onChange) return

    // Update the row data
    const newRows = [...parsedData.rows]
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      [columnId]: value,
    }

    // Update local state
    setParsedData({
      ...parsedData,
      rows: newRows,
    })

    // Serialize back to CSV and notify parent
    const csvString = Papa.unparse(newRows, {
      columns: parsedData.columns,
    })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle adding a new empty row at the end (CSV only)
  const handleAddRow = useCallback(() => {
    if (!parsedData || !onChange) return

    const emptyRow: Record<string, unknown> = {}
    for (const col of parsedData.columns) {
      emptyRow[col] = ''
    }

    const newRows = [...parsedData.rows, emptyRow]
    setParsedData({ ...parsedData, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: parsedData.columns })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle inserting a new empty row at a specific index (CSV only)
  const handleInsertRowAt = useCallback((index: number) => {
    if (!parsedData || !onChange) return

    const emptyRow: Record<string, unknown> = {}
    for (const col of parsedData.columns) {
      emptyRow[col] = ''
    }

    const newRows = [...parsedData.rows]
    newRows.splice(index, 0, emptyRow)
    setParsedData({ ...parsedData, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: parsedData.columns })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle adding a new column (CSV only)
  const handleAddColumn = useCallback(() => {
    if (!parsedData || !onChange) return

    // Generate a unique column name
    let colName = `Column${parsedData.columns.length + 1}`
    let counter = parsedData.columns.length + 1
    while (parsedData.columns.includes(colName)) {
      counter++
      colName = `Column${counter}`
    }

    const newColumns = [...parsedData.columns, colName]
    const newRows = parsedData.rows.map(row => ({ ...row, [colName]: '' }))
    setParsedData({ ...parsedData, columns: newColumns, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: newColumns })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle renaming a column (CSV only)
  const handleRenameColumn = useCallback((oldName: string, newName: string) => {
    if (!parsedData || !onChange) return
    if (oldName === newName) return
    // Prevent duplicate column names
    if (parsedData.columns.includes(newName)) return

    const newColumns = parsedData.columns.map(c => c === oldName ? newName : c)
    const newRows = parsedData.rows.map(row => {
      const newRow: Record<string, unknown> = {}
      for (const col of parsedData.columns) {
        newRow[col === oldName ? newName : col] = row[col]
      }
      return newRow
    })
    setParsedData({ ...parsedData, columns: newColumns, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: newColumns })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle deleting a column by name (CSV only)
  const handleDeleteColumn = useCallback((columnName: string) => {
    if (!parsedData || !onChange) return
    if (parsedData.columns.length <= 1) return // Don't delete the last column

    const newColumns = parsedData.columns.filter(c => c !== columnName)
    const newRows = parsedData.rows.map(row => {
      const newRow: Record<string, unknown> = {}
      for (const col of newColumns) {
        newRow[col] = row[col]
      }
      return newRow
    })
    setParsedData({ ...parsedData, columns: newColumns, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: newColumns })
    onChange(csvString)
  }, [parsedData, onChange])

  // Handle deleting a row at a specific index (CSV only)
  const handleDeleteRow = useCallback((index: number) => {
    if (!parsedData || !onChange) return

    const newRows = [...parsedData.rows]
    newRows.splice(index, 1)
    setParsedData({ ...parsedData, rows: newRows })

    const csvString = Papa.unparse(newRows, { columns: parsedData.columns })
    onChange(csvString)
  }, [parsedData, onChange])

  // ── Excel editing (XLSX only) ────────────────────────────────────────
  // Edits write directly into the cached workbook's worksheet cells, so
  // formulas/values in untouched cells are preserved. The whole workbook
  // is then re-serialized and sent to the extension for dirty/save handling.

  const serializeWorkbook = useCallback((workbook: XLSX.WorkBook) => {
    if (!onChange) return
    try {
      const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }) as string
      onChange(base64)
    } catch (error) {
      console.error('Excel serialize error:', error)
      sendToExtension('error', {
        message: error instanceof Error ? error.message : 'Failed to serialize workbook',
      })
    }
  }, [onChange])

  const handleExcelCellChange = useCallback((rowIndex: number, columnId: string, value: string) => {
    if (!cachedWorkbook || !selectedSheet || !parsedData || !onChange) return
    const worksheet = cachedWorkbook.Sheets[selectedSheet]
    if (!worksheet) return

    const colIndex = parsedData.columns.indexOf(columnId)
    if (colIndex === -1) return

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const addr = XLSX.utils.encode_cell({
      r: range.s.r + rowIndex,
      c: range.s.c + colIndex,
    })

    if (value === '') {
      delete worksheet[addr]
    } else {
      // Replacing the whole cell object drops any formula the cell had —
      // basic editing stores plain values only
      const numeric = value.trim() !== '' && !Number.isNaN(Number(value))
      worksheet[addr] = numeric ? { t: 'n', v: Number(value) } : { t: 's', v: value }
    }

    const newRows = [...parsedData.rows]
    newRows[rowIndex] = { ...newRows[rowIndex], [columnId]: value }
    setParsedData({ ...parsedData, rows: newRows })

    serializeWorkbook(cachedWorkbook)
  }, [cachedWorkbook, selectedSheet, parsedData, onChange, serializeWorkbook])

  const handleExcelAddRow = useCallback(() => {
    if (!cachedWorkbook || !selectedSheet || !onChange) return
    const worksheet = cachedWorkbook.Sheets[selectedSheet]
    if (!worksheet) return

    const ref = worksheet['!ref']
    if (!ref) {
      // Empty sheet: seed a 1×1 grid so editing can start
      worksheet['!ref'] = 'A1'
    } else {
      const range = XLSX.utils.decode_range(ref)
      range.e.r += 1
      worksheet['!ref'] = XLSX.utils.encode_range(range)
    }

    setParsedData(extractSheet(cachedWorkbook, selectedSheet))
    serializeWorkbook(cachedWorkbook)
  }, [cachedWorkbook, selectedSheet, onChange, serializeWorkbook])

  const handleExcelAddColumn = useCallback(() => {
    if (!cachedWorkbook || !selectedSheet || !onChange) return
    const worksheet = cachedWorkbook.Sheets[selectedSheet]
    if (!worksheet) return

    const ref = worksheet['!ref']
    if (!ref) {
      // Empty sheet: seed a 1×1 grid so editing can start
      worksheet['!ref'] = 'A1'
    } else {
      const range = XLSX.utils.decode_range(ref)
      range.e.c += 1
      worksheet['!ref'] = XLSX.utils.encode_range(range)
    }

    setParsedData(extractSheet(cachedWorkbook, selectedSheet))
    serializeWorkbook(cachedWorkbook)
  }, [cachedWorkbook, selectedSheet, onChange, serializeWorkbook])

  // Handle conflict dialog actions
  const handleConfirmDiscard = useCallback(() => {
    sendToExtension('confirmRefresh', {})
    setShowConflictDialog(false)
    setShowDiscardWarning(false)
  }, [])

  const handleCancelRefresh = useCallback(() => {
    sendToExtension('cancelRefresh', {})
    setShowConflictDialog(false)
    setShowDiscardWarning(false)
  }, [])

  // Handle sheet switching (Excel only)
  const handleSheetChange = useCallback((sheetName: string) => {
    setSelectedSheet(sheetName)
    // Sheet extraction happens automatically via useEffect dependency
  }, [])

  // Handle refresh from disk
  const handleRefresh = useCallback(() => {
    setHasFileChanged(false) // Clear badge when refresh clicked
    sendToExtension('refresh', {})
  }, [])

  // Handle opening in external apps
  const handleOpenInExcel = useCallback(() => {
    sendToExtension('openInExternalApp', { app: 'excel' })
  }, [])

  const handleOpenInNumbers = useCallback(() => {
    sendToExtension('openInExternalApp', { app: 'numbers' })
  }, [])

  // Status bar info
  const statusInfo = useMemo(() => {
    if (!parsedData) return null
    const rowCount = parsedData.rows.length
    const colCount = parsedData.columns.length
    const truncated = sizeBytes && rowCount === MAX_DISPLAY_ROWS
    return { rowCount, colCount, truncated }
  }, [parsedData, sizeBytes])

  // Size warning (checked first: no data is parsed while it's showing)
  if (showSizeWarning) {
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : '?'
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--vscode-editor-background)] gap-4">
        <div className="text-[var(--r-ink-strong)] text-center">
          <div className="text-lg font-semibold mb-2">Large File Warning</div>
          <div className="text-[var(--r-ink-muted)]">
            {filename} is {sizeMB}MB. Parsing large files may take a moment.
          </div>
        </div>
        <button
          onClick={() => setProceedWithLargeFile(true)}
          className="px-4 py-2 bg-[var(--r-accent)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          Continue Anyway
        </button>
      </div>
    )
  }

  // Loading state
  if (isLoading || !parsedData) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--r-ink-strong)]">Parsing {filename}...</div>
      </div>
    )
  }

  // Error state
  if (parsedData.error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--vscode-editor-background)] gap-2">
        <div className="text-[var(--r-error)] font-semibold">
          Failed to open {filename}
        </div>
        <div className="text-[var(--r-ink-muted)] text-sm">
          {parsedData.error}
        </div>
      </div>
    )
  }

  const isEmpty = parsedData.rows.length === 0

  return (
    <>
      {/* Conflict dialogs */}
      <ConflictDialog
        isOpen={showConflictDialog}
        filename={filename}
        onDiscard={handleConfirmDiscard}
        onCancel={handleCancelRefresh}
        isDiskConflict={isDiskConflict}
      />

      <ConflictDialog
        isOpen={showDiscardWarning}
        filename={filename}
        onDiscard={handleConfirmDiscard}
        onCancel={handleCancelRefresh}
        isDiskConflict={false}
      />

      <div className="flex flex-col h-screen bg-[var(--vscode-editor-background)]">
        {/* Toolbar with external app actions */}
        <SpreadsheetToolbar
          filename={filename}
          onRefresh={handleRefresh}
          onOpenInExcel={hasExcel ? handleOpenInExcel : undefined}
          onOpenInNumbers={handleOpenInNumbers}
          hasExcel={hasExcel}
          hasFileChanged={hasFileChanged}
        />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)] text-xs text-[var(--r-ink-muted)]">
        <span>
          {isEditable && (
            <span className="text-[var(--r-accent)]">
              (click cell to edit)
            </span>
          )}
        </span>
        <span>
          {statusInfo?.rowCount.toLocaleString()} rows × {statusInfo?.colCount} columns
          {statusInfo?.truncated && (
            <span className="ml-2 text-[var(--vscode-editorWarning-foreground)]">
              (showing first {MAX_DISPLAY_ROWS.toLocaleString()})
            </span>
          )}
        </span>
      </div>

      {/* Sheet selector (Excel only, if multiple sheets) */}
      {fileType === 'xlsx' && cachedWorkbook && cachedWorkbook.SheetNames.length > 1 && (
        <div className="flex gap-1 px-2 py-1 border-b border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)] overflow-x-auto">
          {cachedWorkbook.SheetNames.map(sheetName => (
            <button
              key={sheetName}
              onClick={() => handleSheetChange(sheetName)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                sheetName === selectedSheet
                  ? 'bg-[var(--r-accent)] text-[var(--vscode-button-foreground)] font-medium'
                  : 'bg-transparent text-[var(--r-ink-strong)] hover:bg-[var(--r-surface-soft)]'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Table — empty state rendered inline so the toolbar and sheet
          selector stay accessible (an empty first sheet must not hide
          the other sheets in a multi-sheet workbook) */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-[var(--r-ink-muted)]">
            {fileType === 'xlsx' && selectedSheet ? `${selectedSheet} is empty` : `${filename} is empty`}
          </div>
          {isEditable && fileType === 'xlsx' && (
            <button
              onClick={handleExcelAddRow}
              className="px-4 py-2 bg-[var(--r-accent)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Add a row to start editing
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DataTable
            data={parsedData.rows}
            columns={parsedData.columns}
            editable={isEditable}
            onCellChange={fileType === 'xlsx' ? handleExcelCellChange : handleCellChange}
            onAddRow={isEditable ? (fileType === 'xlsx' ? handleExcelAddRow : handleAddRow) : undefined}
            onAddColumn={isEditable ? (fileType === 'xlsx' ? handleExcelAddColumn : handleAddColumn) : undefined}
            onRenameColumn={isEditable && fileType === 'csv' ? handleRenameColumn : undefined}
            onDeleteColumn={isEditable && fileType === 'csv' ? handleDeleteColumn : undefined}
            onInsertRowAt={isEditable && fileType === 'csv' ? handleInsertRowAt : undefined}
            onDeleteRow={isEditable && fileType === 'csv' ? handleDeleteRow : undefined}
          />
        </div>
      )}
    </div>
    </>
  )
}
