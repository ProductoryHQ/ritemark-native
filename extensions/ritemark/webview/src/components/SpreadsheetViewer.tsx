import { useState, useEffect, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DataTable } from './DataTable'
import { SpreadsheetToolbar } from './header/SpreadsheetToolbar'
import { sendToExtension, onMessage } from '../bridge'

export interface SpreadsheetViewerProps {
  content: string
  filename: string
  fileType: 'csv' | 'xlsx'
  encoding?: string
  sizeBytes?: number
  onChange?: (content: string) => void
  // Multi-sheet support: handled via client-side caching of workbook
}

interface ParsedData {
  columns: string[]
  rows: Record<string, unknown>[]
  error?: string
}

const MAX_DISPLAY_ROWS = 10000
const SIZE_WARNING_BYTES = 5 * 1024 * 1024 // 5MB

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

  // CSV is editable, Excel is read-only
  const isEditable = fileType === 'csv' && !!onChange

  // Check if Excel is installed on mount
  useEffect(() => {
    sendToExtension('checkExcel', {})

    const handleMessage = onMessage((message) => {
      if (message.type === 'excelStatus') {
        setHasExcel(message.hasExcel as boolean)
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

  // Parse content based on file type
  useEffect(() => {
    if (showSizeWarning && !proceedWithLargeFile) {
      return
    }

    setIsLoading(true)

    try {
      if (fileType === 'csv') {
        parseCSV(content)
      } else if (fileType === 'xlsx') {
        parseExcel(content, encoding, selectedSheet)
      }
    } catch (error) {
      console.error('Parse error:', error)
      setParsedData({
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : 'Failed to parse file',
      })
      setIsLoading(false)
    }
  }, [content, fileType, encoding, showSizeWarning, proceedWithLargeFile, selectedSheet])

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
      error: (error) => {
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

  const parseExcel = (base64Content: string, enc?: string, sheetName?: string) => {
    try {
      // CLIENT-SIDE CACHING: Parse workbook ONCE and cache it
      let workbook = cachedWorkbook
      if (!workbook) {
        workbook = XLSX.read(base64Content, {
          type: enc === 'base64' ? 'base64' : 'string',
        })
        setCachedWorkbook(workbook)

        // Set default selected sheet if not already set
        if (!selectedSheet && workbook.SheetNames.length > 0) {
          setSelectedSheet(workbook.SheetNames[0])
        }
      }

      // Determine which sheet to display
      const targetSheet = sheetName || selectedSheet || workbook.SheetNames[0]
      if (!targetSheet || !workbook.Sheets[targetSheet]) {
        setParsedData({
          columns: [],
          rows: [],
          error: 'Sheet not found in workbook',
        })
        setIsLoading(false)
        return
      }

      const worksheet = workbook.Sheets[targetSheet]

      // Convert to JSON with header row
      let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

      // Get column names from first row
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []

      // Truncate if too many rows
      if (rows.length > MAX_DISPLAY_ROWS) {
        rows = rows.slice(0, MAX_DISPLAY_ROWS)
      }

      setParsedData({ columns, rows })
      setIsLoading(false)
    } catch (error) {
      console.error('Excel parse error:', error)
      setParsedData({
        columns: [],
        rows: [],
        error: error instanceof Error ? error.message : 'Failed to parse Excel file',
      })
      setIsLoading(false)
    }
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

  // Handle sheet switching (Excel only)
  const handleSheetChange = useCallback((sheetName: string) => {
    setSelectedSheet(sheetName)
    // Re-parse will happen automatically via useEffect dependency
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--vscode-foreground)]">Parsing {filename}...</div>
      </div>
    )
  }

  // Size warning
  if (showSizeWarning) {
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : '?'
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--vscode-editor-background)] gap-4">
        <div className="text-[var(--vscode-foreground)] text-center">
          <div className="text-lg font-semibold mb-2">Large File Warning</div>
          <div className="text-[var(--vscode-descriptionForeground)]">
            {filename} is {sizeMB}MB. Parsing large files may take a moment.
          </div>
        </div>
        <button
          onClick={() => setProceedWithLargeFile(true)}
          className="px-4 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          Continue Anyway
        </button>
      </div>
    )
  }

  // Error state
  if (parsedData?.error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--vscode-editor-background)] gap-2">
        <div className="text-[var(--vscode-errorForeground)] font-semibold">
          Failed to open {filename}
        </div>
        <div className="text-[var(--vscode-descriptionForeground)] text-sm">
          {parsedData.error}
        </div>
      </div>
    )
  }

  // No data
  if (!parsedData || parsedData.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--vscode-descriptionForeground)]">
          {filename} is empty
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-editor-background)]">
      {/* Toolbar with external app actions */}
      <SpreadsheetToolbar
        filename={filename}
        onOpenInExcel={hasExcel ? handleOpenInExcel : undefined}
        onOpenInNumbers={handleOpenInNumbers}
        hasExcel={hasExcel}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-xs text-[var(--vscode-descriptionForeground)]">
        <span>
          {isEditable && (
            <span className="text-[var(--vscode-textLink-foreground)]">
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
        <div className="flex gap-1 px-2 py-1 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] overflow-x-auto">
          {cachedWorkbook.SheetNames.map(sheetName => (
            <button
              key={sheetName}
              onClick={() => handleSheetChange(sheetName)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                sheetName === selectedSheet
                  ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] font-medium'
                  : 'bg-transparent text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <DataTable
          data={parsedData.rows}
          columns={parsedData.columns}
          editable={isEditable}
          onCellChange={handleCellChange}
        />
      </div>
    </div>
  )
}
