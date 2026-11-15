import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataTable } from './DataTable'
import { SpreadsheetToolbar } from './header/SpreadsheetToolbar'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { Button } from './ui/button'
import { Icon } from './ui/Icon'
import { sendToExtension, onMessage } from '../bridge'
import type { DocumentSyncAction } from './header/DocumentSyncAction'
import type { DocumentApplyTarget } from '../types/documentSync'
import { isCellEdit, type CellEdit } from '../../../src/excel/cellEdit'
import { readWorkbook } from './excel/readWorkbook'
import { MAX_DISPLAY_ROWS, modelSource, sheetJsSource, type SheetSource } from './excel/sheetSource'
import { SheetGrid } from './excel/SheetGrid'
import { Tooltip } from './ui/tooltip'
import { defaultSpreadsheetApp } from '../hooks/usePlatform'

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
  /** Each row's 1-based sheet row when hidden rows are left out (an .xlsx read by our reader). */
  rowLabels?: number[]
  error?: string
}
const SIZE_WARNING_BYTES = 5 * 1024 * 1024 // 5MB

/** Base64 from the host to bytes. */
function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Sprint 158 PR 2 (#711): an .xlsx is read by our reader (excel/readWorkbook.ts: number formats as Excel draws
 * them, hidden rows, columns and sheets, the sheet it opens on); .xls, and a workbook our reader can't read, by
 * SheetJS as before.
 */
async function openWorkbook(content: string, encoding: string | undefined, filename: string): Promise<SheetSource> {
  const isXlsx = filename.toLowerCase().endsWith('.xlsx') && encoding === 'base64'
  if (isXlsx) {
    try {
      return modelSource(await readWorkbook(bytesOf(content)))
    } catch (error) {
      console.warn('[Ritemark Excel] Falling back to SheetJS:', error)
    }
  }
  const workbook = XLSX.read(content, { type: encoding === 'base64' ? 'base64' : 'string', cellStyles: true })
  if (workbook.SheetNames.length === 0) throw new Error('Workbook contains no sheets')
  return sheetJsSource(workbook)
}

/** What a sheet keeps that the preview doesn't draw, said once on the line under the bar (experience 47, frame 7). */
function keptNotice(layout: { drawings: Array<{ what: string }>; conditionalFormats: number }): string | undefined {
  const count = (what: string) => layout.drawings.filter((d) => d.what === what).length
  const things: string[] = []
  const name = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`)
  if (count('chart')) things.push(name(count('chart'), 'chart', 'charts'))
  if (count('image')) things.push(name(count('image'), 'picture', 'pictures'))
  if (count('shape')) things.push(name(count('shape'), 'shape', 'shapes'))
  if (layout.conditionalFormats) things.push('colour rules')
  if (!things.length) return undefined
  const list = things.length === 1 ? things[0] : `${things.slice(0, -1).join(', ')} and ${things[things.length - 1]}`
  const one = things.length === 1 && /^an? /.test(list)
  return one
    ? `This sheet has ${list}. It's kept in the file; Open in Excel to see it.`
    : `This sheet has ${list}. They're kept in the file; Open in Excel to see them.`
}

/** A chart sheet's card title (frame 8). */
function chartSheetTitle(name: string): string {
  return `${name} is a chart.`
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
  const [source, setSource] = useState<SheetSource | null>(null)
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
  const pendingEdits = useRef(new Map<number, { sheet: string; row: number; col: number; previous: unknown }>())
  const nextEditId = useRef(1)
  const sourceRef = useRef<SheetSource | null>(null)
  const selectedSheetRef = useRef('')
  const loadId = xlsxLoad?.id ?? 0
  const loadEdits = useMemo(() => (xlsxLoad?.pendingEdits ?? []).filter(isCellEdit), [xlsxLoad])
  // Whether a cell has been edited since the workbook was loaded, and whether a formula cell is being typed over
  const [hasEdited, setHasEdited] = useState(false)
  const [editingFormula, setEditingFormula] = useState(false)
  // Sprint 158 PR 3: raised by every edit, so the sheet grid draws the model again
  const [version, setVersion] = useState(0)

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
        const current = sourceRef.current
        if (message.ok || !pending || !current) return
        // A later edit of the same cell is drawn and on its way: it decides what the cell shows, and if it is refused
        // too, the cell goes back to what it held before this one
        for (const [id, other] of pendingEdits.current) {
          if (id > (message.id as number) && other.sheet === pending.sheet && other.row === pending.row && other.col === pending.col) {
            other.previous = pending.previous
            return
          }
        }
        // Refused (the host said why): put the cell back as it was
        current.restore(pending.sheet, pending.row, pending.col, pending.previous)
        setVersion((v) => v + 1)
        if (pending.sheet === selectedSheetRef.current && !current.model) setParsedData(current.extract(pending.sheet))
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

  // XLSX: read the workbook ONCE per load and keep it.
  //
  // Fix for #110: this effect must NOT depend on selectedSheet. The old
  // combined effect cleared the cache whenever the default sheet was
  // set (selectedSheet was a dependency), which left it null and
  // permanently hid the sheet selector. Sheet switching is a separate,
  // extraction-only effect below.
  useEffect(() => {
    if (fileType !== 'xlsx') return
    if (showSizeWarning && !proceedWithLargeFile) return
    let cancelled = false

    openWorkbook(content, encoding, filename).then(
      (opened) => {
        if (cancelled) return
        // A load (also a revert's, with the same bytes) starts over; edits the host holds but hasn't saved (a reloaded
        // webview) are shown again
        pendingEdits.current.clear()
        setHasEdited(loadEdits.length > 0)
        for (const edit of loadEdits) {
          const at = XLSX.utils.decode_cell(edit.ref)
          opened.write(edit.sheet, at.r, at.c, edit.value)
        }
        sourceRef.current = opened
        setSource(opened)
        // Keep the current sheet across refreshes when it is still shown; otherwise the sheet the workbook opens on
        setSelectedSheet((prev) => (prev && opened.tabs.includes(prev) ? prev : opened.initial))
      },
      (error) => {
        if (cancelled) return
        console.error('Excel parse error:', error)
        setParsedData({
          columns: [],
          rows: [],
          error: error instanceof Error ? error.message : 'Failed to parse Excel file',
        })
        setIsLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [content, fileType, encoding, filename, showSizeWarning, proceedWithLargeFile, loadId, loadEdits])

  useEffect(() => {
    selectedSheetRef.current = selectedSheet
  }, [selectedSheet])

  // XLSX: extract the selected sheet from the workbook
  useEffect(() => {
    if (fileType !== 'xlsx' || !source || !selectedSheet) return
    setParsedData(source.extract(selectedSheet))
    setIsLoading(false)
  }, [fileType, source, selectedSheet])

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

  // Formula lookup for the fx bar. The grid is anchored at A1 and names each row's sheet row, so a row index and a
  // column letter are the cell's address. Returns the formula with a leading '='.
  const sheetRowOf = useCallback((rowIndex: number) => parsedData?.rowLabels?.[rowIndex] !== undefined
    ? parsedData.rowLabels[rowIndex] - 1
    : rowIndex, [parsedData])

  const getExcelCellFormula = useCallback((rowIndex: number, columnIndex: number): string | undefined => {
    if (!source || !selectedSheet || !parsedData) return undefined
    const col = XLSX.utils.decode_col(parsedData.columns[columnIndex] ?? 'A')
    return source.formulaAt(selectedSheet, sheetRowOf(rowIndex), col)
  }, [source, selectedSheet, parsedData, sheetRowOf])

  const getExcelCellInput = useCallback((rowIndex: number, columnIndex: number): string | undefined => {
    if (!source || !selectedSheet || !parsedData) return undefined
    const col = XLSX.utils.decode_col(parsedData.columns[columnIndex] ?? 'A')
    return source.inputAt(selectedSheet, sheetRowOf(rowIndex), col)
  }, [source, selectedSheet, parsedData, sheetRowOf])

  /** One cell typed into, by its sheet row and column: shown at once, and sent to the host on its own. */
  const editCell = useCallback((row: number, col: number, text: string) => {
    if (!source || !selectedSheet || !isEditable) return
    const value = source.valueFor(selectedSheet, row, col, text)
    const id = nextEditId.current++
    const previous = source.write(selectedSheet, row, col, value)
    pendingEdits.current.set(id, { sheet: selectedSheet, row, col, previous })
    // the cell is drawn as its format draws it (14 in a money cell: 14.00 €)
    setVersion((v) => v + 1)
    if (!source.model) setParsedData(source.extract(selectedSheet))
    setHasEdited(true)

    const edit: CellEdit = { sheet: selectedSheet, ref: XLSX.utils.encode_cell({ r: row, c: col }), value }
    sendToExtension('cellEdit', { id, edit })
  }, [source, selectedSheet, isEditable])

  const handleExcelCellChange = useCallback((rowIndex: number, columnId: string, text: string) => {
    editCell(sheetRowOf(rowIndex), XLSX.utils.decode_col(columnId), text)
  }, [editCell, sheetRowOf])

  // Add row and the + column of the table (an .xlsx our reader can't open, read by SheetJS) widen it to type in; the
  // file changes once a cell in them is typed into. The sheet grid has neither: its sheet goes on as Excel's does
  const handleExcelAddRow = useCallback(() => {
    if (!source || !selectedSheet || !isEditable) return
    source.widen(selectedSheet, 1, 0)
    setVersion((v) => v + 1)
    setParsedData(source.extract(selectedSheet))
  }, [source, selectedSheet, isEditable])

  const handleExcelAddColumn = useCallback(() => {
    if (!source || !selectedSheet || !isEditable) return
    source.widen(selectedSheet, 0, 1)
    setVersion((v) => v + 1)
    setParsedData(source.extract(selectedSheet))
  }, [source, selectedSheet, isEditable])

  // the sheet grid's lookups, by sheet row and column
  const gridInput = useCallback((row: number, col: number) => (source && selectedSheet ? source.inputAt(selectedSheet, row, col) ?? '' : ''), [source, selectedSheet])
  const gridFormula = useCallback((row: number, col: number) => (source && selectedSheet ? source.formulaAt(selectedSheet, row, col) : undefined), [source, selectedSheet])

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

  // Sprint 158 (#711; experience 47, frame 2): once a cell is edited, the line under the bar says what a save does;
  // while a formula cell is typed over, what that typing does
  const sheetModel = source?.model?.sheets.find((s) => s.name === selectedSheet)
  const excelNotice = fileType !== 'xlsx'
    ? undefined
    : isEditable && editingFormula
      ? 'Typing here replaces the formula with a value.'
      : isEditable && hasEdited
        ? 'Only the cells you change are saved; the rest of the workbook stays as it is. Totals that use them update when the file opens in Excel.'
        : sheetModel && sheetModel.kind === 'worksheet' ? keptNotice(sheetModel.layout) : undefined
  const openInLabel = `Open in ${hasExcel ? 'Excel' : defaultSpreadsheetApp}`

  // Status bar info
  const statusInfo = useMemo(() => {
    if (!parsedData) return null
    const rowCount = parsedData.rows.length
    const colCount = parsedData.columns.length
    // the sheet grid draws every row; only the table stops at MAX_DISPLAY_ROWS
    const truncated = sizeBytes && rowCount === MAX_DISPLAY_ROWS && !source?.model
    return { rowCount, colCount, truncated }
  }, [parsedData, sizeBytes, source])

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
        />

      {/* Sprint 158 (#711; experience 47, frame 2): under the bar, where PR 0's warning stood, a quiet line says once
          what a save does after the first edit, and while a formula cell is typed over, what that typing does. It
          wraps rather than being cut; the bar keeps the file's name. */}
      {excelNotice && (
        <div className="flex shrink-0 items-start gap-1.5 px-4 pb-2 text-xs leading-[18px] text-[var(--r-ink-muted)]" role="status" aria-live="polite">
          <Icon name="info" size={14} tone="inherit" className="mt-0.5 shrink-0" />
          <span>{excelNotice}</span>
        </div>
      )}

      {/* Truncation warning — only rendered when a large file is cut off */}
      {statusInfo?.truncated && (
        <div className="flex items-center justify-end px-3 py-1 border-b border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)] text-xs text-[var(--vscode-editorWarning-foreground)]">
          <span>showing first {MAX_DISPLAY_ROWS.toLocaleString()} rows</span>
        </div>
      )}

      {/* Sprint 158 PR 3 (#711; experience 47): a workbook our reader read is drawn as Excel draws it, in the sheet
          grid; a chart sheet is a card (frame 8). .xls and the SheetJS fallback keep the table below. */}
      {source?.model && sheetModel?.kind === 'chartsheet' ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex h-[320px] w-[560px] max-w-[calc(100%-32px)] flex-col items-center justify-center gap-1.5 rounded border border-dashed border-[#9aa3ae] bg-white text-center text-xs text-[#5f6b7a]">
            <Icon name="chart-bar" size={20} tone="inherit" />
            <b className="text-[15px] text-[#3b4452]">{chartSheetTitle(sheetModel.name)}</b>
            <span>It's kept in the file as it is. The preview doesn't draw charts yet.</span>
            <Tooltip label={`${openInLabel}, where the chart is drawn`}>
              <Button type="button" variant="outline" size="compact" className="mt-2" onClick={hasExcel ? handleOpenInExcel : handleOpenInNumbers}>
                <Icon name="arrow-square-out" size={14} tone="inherit" />
                <span>{openInLabel}</span>
              </Button>
            </Tooltip>
          </div>
        </div>
      ) : source?.model && sheetModel ? (
        <SheetGrid
          model={source.model}
          sheet={sheetModel}
          version={version}
          editable={isEditable}
          onEdit={editCell}
          getInput={gridInput}
          getFormula={gridFormula}
          onEditingFormulaChange={setEditingFormula}
          onOpenInExcel={hasExcel ? handleOpenInExcel : handleOpenInNumbers}
          openInLabel={openInLabel}
        />
      ) : isEmpty ? (
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
            getCellInput={fileType === 'xlsx' ? getExcelCellInput : undefined}
            rowLabels={parsedData.rowLabels}
            onEditingFormulaChange={fileType === 'xlsx' ? setEditingFormula : undefined}
            namedColumns={fileType === 'csv'}
          />
        </div>
      )}

      {/* Sheet tab strip — bottom of the viewport, Excel-style (Excel only).
          The hairline runs across inactive tabs and the strip remainder but is
          BROKEN over the active tab, whose editor background merges seamlessly
          with the grid above (no gap, no line). Sprint 158 PR 3 (experience 47,
          decisions 5 and 11): a workbook our reader read shows the strip even
          for one sheet, since that is where the sheet's name is; a tab colour
          is a strip, a chart sheet has a chart icon, a hidden sheet no tab. */}
      {fileType === 'xlsx' && source && (source.tabs.length > 1 || (source.model && source.tabs.length > 0)) && (
        <div className={`flex bg-[var(--vscode-sideBar-background)] overflow-x-auto shrink-0${source.model ? ' mx-4 mb-4 rounded-b-lg border border-t-0 border-[var(--r-hairline)]' : ''}`}>
          {source.tabs.map(sheetName => {
            const tab = source.model?.sheets.find((s) => s.name === sheetName)
            return (
              <Button
                key={sheetName}
                variant="ghost"
                size="sm"
                onClick={() => handleSheetChange(sheetName)}
                className={`relative h-auto rounded-none px-3.5 py-1 text-xs border-t border-b-2 ${
                  sheetName === selectedSheet
                    ? 'bg-[var(--vscode-editor-background)] text-[var(--r-accent)] font-semibold border-t-transparent border-x border-x-[var(--r-hairline)] border-b-[var(--r-accent)] hover:bg-[var(--vscode-editor-background)] hover:text-[var(--r-accent)]'
                    : 'border-t-[var(--r-hairline)] border-x border-x-transparent border-b-transparent text-[var(--r-ink-muted)] hover:text-[var(--r-ink-strong)]'
                }`}
              >
                {tab?.kind === 'chartsheet' && <Icon name="chart-bar" size={12} tone="inherit" />}
                {sheetName}
                {tab?.layout.tabColor && (
                  <span aria-hidden className="absolute inset-x-1 bottom-0 h-[3px] rounded-sm" style={{ background: tab.layout.tabColor }} />
                )}
              </Button>
            )
          })}
          <div className="flex-1 min-w-4 border-t border-[var(--r-hairline)]" />
        </div>
      )}
    </div>
    </>
  )
}
