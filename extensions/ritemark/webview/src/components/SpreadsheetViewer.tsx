import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataTable } from './DataTable'
import { SpreadsheetToolbar } from './header/SpreadsheetToolbar'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { Button } from './ui/button'
import { sendToExtension, onMessage } from '../bridge'
import type { DocumentSyncAction } from './header/DocumentSyncAction'
import type { DocumentApplyTarget } from '../types/documentSync'
import { cellValueFromText, isCellEdit, type CellEdit, type CellValue } from '../../../src/excel/cellEdit'

export interface SpreadsheetViewerProps {
  content: string
  filename: string
  fileType: 'csv' | 'xlsx'
  encoding?: string
  sizeBytes?: number
  // CSV: receives the serialized CSV text.
  onChange?: (content: string) => void
  // XLSX: cells can be edited. Each edit goes to the host on its own ({sheet, ref, value}); a save there changes
  // only those cells (Sprint 158, #711). .xls stays read-only.
  xlsxEditable?: boolean
  // XLSX: the host's load, numbered, so a revert re-reads a workbook whose bytes didn't change, with the edits not
  // saved yet (a reloaded webview shows them again)
  xlsxLoad?: { id: number; pendingEdits: unknown[] }
  syncEnabled?: boolean
  syncAction?: DocumentSyncAction
  syncTarget?: DocumentApplyTarget
  onDocumentApplied?: (target: DocumentApplyTarget) => void
}

interface ParsedData {
  columns: string[]
  rows: Record<string, unknown>[]
  error?: string
}

const MAX_DISPLAY_ROWS = 10000
const SIZE_WARNING_BYTES = 5 * 1024 * 1024 // 5MB

/** Write one edit into SheetJS's sheet, as the grid shows it: a value only, any formula gone. */
function writeSheetCell(worksheet: XLSX.WorkSheet, addr: string, value: CellValue) {
  if (value === null || value === '') {
    delete worksheet[addr]
    return
  }
  // Replacing the whole cell object drops any formula the cell had: basic editing stores plain values only
  worksheet[addr] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value }
  // Expand the used range when the edit lands outside it (e.g. in a leading blank row above the data)
  const { r, c } = XLSX.utils.decode_cell(addr)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || addr)
  range.s.r = Math.min(range.s.r, r)
  range.s.c = Math.min(range.s.c, c)
  range.e.r = Math.max(range.e.r, r)
  range.e.c = Math.max(range.e.c, c)
  worksheet['!ref'] = XLSX.utils.encode_range(range)
}

/**
 * Extract a single sheet from a parsed workbook into table data.
 * Uses spreadsheet-letter columns (A, B, C…) and a full 1:1 grid
 * (blank rows included, first row NOT swallowed as a header) so that
 * row/column indexes map exactly to worksheet cell addresses for editing.
 *
 * The grid is always anchored at A1 — even when the sheet's used range
 * starts later (e.g. data begins at B3) — so the grid's row numbers and
 * column letters match Excel's actual addresses and leading blank
 * rows/columns are visible.
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
  for (let c = 0; c <= range.e.c; c++) {
    columns.push(XLSX.utils.encode_col(c))
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
    range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e }),
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
  xlsxEditable = false,
  xlsxLoad,
  syncEnabled = false,
  syncAction,
  syncTarget,
  onDocumentApplied,
}: SpreadsheetViewerProps) {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSizeWarning, setShowSizeWarning] = useState(false)
  const [proceedWithLargeFile, setProceedWithLargeFile] = useState(false)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [cachedWorkbook, setCachedWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [hasExcel, setHasExcel] = useState(false)
  const [parsedSyncTarget, setParsedSyncTarget] = useState<DocumentApplyTarget | undefined>()

  // Conflict detection state
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showDiscardWarning, setShowDiscardWarning] = useState(false)
  const [isDiskConflict, setIsDiskConflict] = useState(false)

  // File change indicator (badge on refresh button)
  const [hasFileChanged, setHasFileChanged] = useState(false)

  // Editable when the host provides a change handler (CSV) or says the workbook is editable (.xlsx; .xls stays
  // read-only)
  const isEditable = fileType === 'xlsx' ? xlsxEditable : !!onChange

  // Sprint 158 (#711): each edit sent to the host waits there for its check; a refused one puts the cell back.
  // Keyed by the edit's id: the sheet, the address and the cell as it was before.
  const pendingEdits = useRef(new Map<number, { sheet: string; addr: string; previous: XLSX.CellObject | undefined }>())
  const nextEditId = useRef(1)
  const workbookRef = useRef<XLSX.WorkBook | null>(null)
  const selectedSheetRef = useRef('')
  const loadId = xlsxLoad?.id ?? 0
  const loadEdits = useMemo(() => (xlsxLoad?.pendingEdits ?? []).filter(isCellEdit), [xlsxLoad])
  // Whether a cell has been edited since the workbook was loaded, and whether a formula cell is being typed over
  const [hasEdited, setHasEdited] = useState(false)
  const [editingFormula, setEditingFormula] = useState(false)

  // Check if Excel is installed on mount and listen for messages
  useEffect(() => {
    sendToExtension('checkExcel', {})

    const unsubscribe = onMessage((message) => {
      if (message.type === 'excelStatus') {
        setHasExcel(message.hasExcel as boolean)
      } else if (!syncEnabled && message.type === 'showConflictDialog') {
        // True conflict: local edits + disk changes
        setIsDiskConflict(true)
        setShowConflictDialog(true)
      } else if (!syncEnabled && message.type === 'confirmDiscard') {
        // Simple discard: local edits only
        setIsDiskConflict(false)
        setShowDiscardWarning(true)
      } else if (!syncEnabled && message.type === 'fileChanged') {
        // File changed externally - show badge on refresh button
        setHasFileChanged(true)
      } else if (message.type === 'fileDeleted') {
        // File was deleted externally
        alert(`File ${message.filename} was deleted on disk.`)
      } else if (message.type === 'cellEditResult' && typeof message.id === 'number') {
        const pending = pendingEdits.current.get(message.id)
        pendingEdits.current.delete(message.id)
        const workbook = workbookRef.current
        if (message.ok || !pending || !workbook) return
        // A later edit of the same cell is drawn and on its way: it decides what the cell shows, and if it is refused
        // too, the cell goes back to what it held before this one
        for (const [id, other] of pendingEdits.current) {
          if (id > (message.id as number) && other.sheet === pending.sheet && other.addr === pending.addr) {
            other.previous = pending.previous
            return
          }
        }
        // Refused (the host said why): put the cell back as it was
        const worksheet = workbook.Sheets[pending.sheet]
        if (!worksheet) return
        if (pending.previous) worksheet[pending.addr] = pending.previous
        else delete worksheet[pending.addr]
        if (pending.sheet === selectedSheetRef.current) setParsedData(extractSheet(workbook, pending.sheet))
      }
    })

    return unsubscribe
  }, [syncEnabled])

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

    setIsLoading(true)
    parseCSV(content, syncTarget)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, fileType, showSizeWarning, proceedWithLargeFile, syncTarget])

  useEffect(() => {
    if (!parsedSyncTarget || !onDocumentApplied) return
    const frame = requestAnimationFrame(() => onDocumentApplied(parsedSyncTarget))
    return () => cancelAnimationFrame(frame)
  }, [parsedSyncTarget, onDocumentApplied])

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

      // A load (also a revert's, with the same bytes) starts over; edits the host holds but hasn't saved (a reloaded
      // webview) are shown again
      pendingEdits.current.clear()
      setHasEdited(loadEdits.length > 0)
      for (const edit of loadEdits) {
        const worksheet = workbook.Sheets[edit.sheet]
        if (worksheet) writeSheetCell(worksheet, edit.ref, edit.value)
      }

      workbookRef.current = workbook
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
  }, [content, fileType, encoding, showSizeWarning, proceedWithLargeFile, loadId, loadEdits])

  useEffect(() => {
    selectedSheetRef.current = selectedSheet
  }, [selectedSheet])

  // XLSX: extract the selected sheet from the cached workbook
  useEffect(() => {
    if (fileType !== 'xlsx' || !cachedWorkbook || !selectedSheet) return
    setParsedData(extractSheet(cachedWorkbook, selectedSheet))
    setIsLoading(false)
  }, [fileType, cachedWorkbook, selectedSheet])

  const parseCSV = (csvContent: string, target?: DocumentApplyTarget) => {
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
        setParsedSyncTarget(target)
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
  // Sprint 158 (#711): an edit is written into the cached workbook's cell, so the grid and the formula bar show it,
  // and sent to the host on its own. The host keeps the edits and a save changes only those cells in the file.

  // Formula lookup for the fx bar — the grid is anchored at A1, so display
  // indexes ARE the cell address. Returns the formula with a leading '='.
  const getExcelCellFormula = useCallback((rowPosition: number, columnIndex: number): string | undefined => {
    if (!cachedWorkbook || !selectedSheet) return undefined
    const worksheet = cachedWorkbook.Sheets[selectedSheet]
    const cell = worksheet?.[XLSX.utils.encode_cell({ r: rowPosition, c: columnIndex })]
    return cell?.f ? `=${cell.f}` : undefined
  }, [cachedWorkbook, selectedSheet])

  const handleExcelCellChange = useCallback((rowIndex: number, columnId: string, text: string) => {
    if (!cachedWorkbook || !selectedSheet || !parsedData || !isEditable) return
    const worksheet = cachedWorkbook.Sheets[selectedSheet]
    if (!worksheet) return

    // The grid is anchored at A1, so display indexes ARE the cell address
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c: XLSX.utils.decode_col(columnId) })
    const value = cellValueFromText(text)
    const id = nextEditId.current++
    pendingEdits.current.set(id, { sheet: selectedSheet, addr, previous: worksheet[addr] })
    writeSheetCell(worksheet, addr, value)

    const newRows = [...parsedData.rows]
    newRows[rowIndex] = { ...newRows[rowIndex], [columnId]: text }
    setParsedData({ ...parsedData, rows: newRows })
    setHasEdited(true)

    const edit: CellEdit = { sheet: selectedSheet, ref: addr, value }
    sendToExtension('cellEdit', { id, edit })
  }, [cachedWorkbook, selectedSheet, parsedData, isEditable])

  // Add row and the + column widen the grid to type in; the file changes once a cell in them is typed into
  const handleExcelAddRow = useCallback(() => {
    if (!cachedWorkbook || !selectedSheet || !isEditable) return
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
  }, [cachedWorkbook, selectedSheet, isEditable])

  const handleExcelAddColumn = useCallback(() => {
    if (!cachedWorkbook || !selectedSheet || !isEditable) return
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
  }, [cachedWorkbook, selectedSheet, isEditable])

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

  const toolbarSyncAction = syncAction ?? (hasFileChanged
    ? { kind: 'retry' as const, label: 'Refresh', onClick: handleRefresh }
    : undefined)

  // Handle opening in external apps
  const handleOpenInExcel = useCallback(() => {
    sendToExtension('openInExternalApp', { app: 'excel' })
  }, [])

  const handleOpenInNumbers = useCallback(() => {
    sendToExtension('openInExternalApp', { app: 'numbers' })
  }, [])

  // Sprint 158 (#711; experience 47, frame 2): once a cell is edited, the bar says once what a save does; while a
  // formula cell is typed over, what that typing does
  const excelNotice = fileType !== 'xlsx' || !isEditable
    ? undefined
    : editingFormula
      ? 'Typing here replaces the formula with a value.'
      : hasEdited
        ? 'Only the cells you change are saved; the rest of the workbook stays as it is. Totals that use them update when the file opens in Excel.'
        : undefined

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
        <Button onClick={() => setProceedWithLargeFile(true)}>
          Continue Anyway
        </Button>
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
          onOpenInExcel={hasExcel ? handleOpenInExcel : undefined}
          onOpenInNumbers={handleOpenInNumbers}
          hasExcel={hasExcel}
          syncAction={toolbarSyncAction}
          notice={excelNotice}
        />

      {/* Truncation warning — only rendered when a large file is cut off */}
      {statusInfo?.truncated && (
        <div className="flex items-center justify-end px-3 py-1 border-b border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)] text-xs text-[var(--vscode-editorWarning-foreground)]">
          <span>showing first {MAX_DISPLAY_ROWS.toLocaleString()} rows</span>
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
            <Button onClick={handleExcelAddRow}>
              Add a row to start editing
            </Button>
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
            getCellFormula={fileType === 'xlsx' ? getExcelCellFormula : undefined}
            onEditingFormulaChange={fileType === 'xlsx' ? setEditingFormula : undefined}
            namedColumns={fileType === 'csv'}
          />
        </div>
      )}

      {/* Sheet tab strip — bottom of the viewport, Excel-style (Excel only,
          if multiple sheets). The hairline runs across inactive tabs and the
          strip remainder but is BROKEN over the active tab, whose editor
          background merges seamlessly with the grid above (no gap, no line). */}
      {fileType === 'xlsx' && cachedWorkbook && cachedWorkbook.SheetNames.length > 1 && (
        <div className="flex bg-[var(--vscode-sideBar-background)] overflow-x-auto shrink-0">
          {cachedWorkbook.SheetNames.map(sheetName => (
            <Button
              key={sheetName}
              variant="ghost"
              size="sm"
              onClick={() => handleSheetChange(sheetName)}
              className={`h-auto rounded-none px-3.5 py-1 text-xs border-t border-b-2 ${
                sheetName === selectedSheet
                  ? 'bg-[var(--vscode-editor-background)] text-[var(--r-accent)] font-semibold border-t-transparent border-x border-x-[var(--r-hairline)] border-b-[var(--r-accent)] hover:bg-[var(--vscode-editor-background)] hover:text-[var(--r-accent)]'
                  : 'border-t-[var(--r-hairline)] border-x border-x-transparent border-b-transparent text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)]'
              }`}
            >
              {sheetName}
            </Button>
          ))}
          <div className="flex-1 min-w-4 border-t border-[var(--r-hairline)]" />
        </div>
      )}
    </div>
    </>
  )
}
