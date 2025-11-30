/**
 * TableOverlayControls - Spreadsheet-Style Table Controls (Notion-like)
 *
 * APPROACH: Absolutely positioned overlay elements that sit OUTSIDE contenteditable
 *
 * Key principles:
 * 1. Render control handles as absolutely positioned divs
 * 2. Position them relative to table using getBoundingClientRect()
 * 3. Controls are OUTSIDE TipTap's contenteditable area
 * 4. No DOM manipulation inside editor
 *
 * UX:
 * - Row handles appear on LEFT when hovering table row
 * - Column handles appear on TOP when hovering table column
 * - Click +/- icons to add/remove rows/columns
 *
 * @see /docs/sprints/sprint-11-task-breakdown.md - Phase 3
 */

import React, { useState, useEffect, useRef } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Plus, Trash2 } from 'lucide-react'

interface TableInfo {
  tableRect: DOMRect
  rowRects: DOMRect[]
  colRects: DOMRect[]
  tableElement: Element
}

interface TableOverlayControlsProps {
  editor: TipTapEditor | null
}

export function TableOverlayControls({ editor }: TableOverlayControlsProps) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [hoveredRow, setHoveredRow] = useState<{ tableIndex: number; rowIndex: number } | null>(null)
  const [hoveredCol, setHoveredCol] = useState<{ tableIndex: number; colIndex: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tablesRef = useRef<TableInfo[]>([])  // Ref to store latest tables state

  useEffect(() => {
    if (!editor) return

    const getEditorElement = (): HTMLElement | null => {
      try {
        return ((editor as any).view?.dom ?? null) as HTMLElement | null
      } catch {
        return null
      }
    }

    // Find ALL table elements in DOM
    const updateTablePositions = () => {
      const tableElements = document.querySelectorAll('.tiptap-table-node')

      if (tableElements.length > 0) {
        const tableInfos: TableInfo[] = Array.from(tableElements).map(tableElement => {
          const rect = tableElement.getBoundingClientRect()

          // Get positions of all rows
          const rows = tableElement.querySelectorAll('.tiptap-table-row')
          const rowRects = Array.from(rows).map(row => row.getBoundingClientRect())

          // Get positions of all columns (from first row cells)
          const firstRow = rows[0]
          const cells = firstRow ? firstRow.querySelectorAll('.tiptap-table-cell, .tiptap-table-header') : []
          const colRects = Array.from(cells).map(cell => cell.getBoundingClientRect())

          return {
            tableRect: rect,
            rowRects,
            colRects,
            tableElement
          }
        })

        setTables(tableInfos)
        tablesRef.current = tableInfos  // Update ref with latest tables
      } else {
        setTables([])
        tablesRef.current = []  // Clear ref when no tables
      }
    }

    // Listen to mouse movement over table rows and cells
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Check if hovering over a table row
      const row = target.closest('.tiptap-table-row')
      if (row) {
        // Find which table and row index - use tablesRef.current for latest state
        tablesRef.current.forEach((tableInfo, tableIndex) => {
          const rows = tableInfo.tableElement.querySelectorAll('.tiptap-table-row')
          const rowIndex = Array.from(rows).indexOf(row)

          if (rowIndex >= 0) {
            setHoveredRow({ tableIndex, rowIndex })
          }
        })
      } else {
        // Not hovering over any row - clear row hover
        setHoveredRow(null)
      }

      // Check if hovering over a header cell (for column controls)
      const headerCell = target.closest('.tiptap-table-header')
      if (headerCell) {
        // Use tablesRef.current for latest state
        tablesRef.current.forEach((tableInfo, tableIndex) => {
          const firstRow = tableInfo.tableElement.querySelector('.tiptap-table-row')
          if (firstRow) {
            const headers = firstRow.querySelectorAll('.tiptap-table-header')
            const colIndex = Array.from(headers).indexOf(headerCell)

            if (colIndex >= 0) {
              setHoveredCol({ tableIndex, colIndex })
            }
          }
        })
      } else {
        // Not hovering over any header - clear column hover
        setHoveredCol(null)
      }
    }

    // Update on editor changes
    editor.on('create', updateTablePositions)
    editor.on('transaction', updateTablePositions)
    editor.on('focus', updateTablePositions)
    editor.on('blur', updateTablePositions)

    // Update on scroll/mouse within editor element once available
    let editorElement: HTMLElement | null = getEditorElement()
    const attachDomListeners = () => {
      const el = getEditorElement()
      if (!el) return
      editorElement = el
      el.addEventListener('scroll', updateTablePositions)
      el.addEventListener('mousemove', handleMouseMove)
    }

    // Try attach immediately and also after create
    attachDomListeners()
    editor.on('create', attachDomListeners)

    window.addEventListener('scroll', updateTablePositions)
    window.addEventListener('resize', updateTablePositions)

    // Initial update deferred to next frame to ensure DOM ready
    requestAnimationFrame(() => updateTablePositions())

    return () => {
      editor.off('create', updateTablePositions)
      editor.off('transaction', updateTablePositions)
      editor.off('focus', updateTablePositions)
      editor.off('blur', updateTablePositions)
      editor.off('create', attachDomListeners)
      if (editorElement) {
        editorElement.removeEventListener('scroll', updateTablePositions)
        editorElement.removeEventListener('mousemove', handleMouseMove)
      }
      window.removeEventListener('scroll', updateTablePositions)
      window.removeEventListener('resize', updateTablePositions)
    }
  }, [editor])

  if (!editor || tables.length === 0) return null

  return (
    <div ref={overlayRef} className="table-overlay-controls">
      {/* Render controls for ALL tables */}
      {tables.map((tableInfo, tableIndex) => (
        <React.Fragment key={tableIndex}>
          {/* Row handles on the left */}
          {tableInfo.rowRects.map((rowRect, rowIndex) => (
            <div
              key={`table-${tableIndex}-row-${rowIndex}`}
              className="row-handle"
              style={{
                position: 'fixed',
                left: `${rowRect.left - 40}px`,
                top: `${rowRect.top}px`,
                width: '32px',
                height: `${rowRect.height}px`,
                zIndex: 10,
              }}
              onMouseEnter={() => {
                setHoveredRow({ tableIndex, rowIndex })
              }}
              onMouseLeave={() => {
                // Don't clear immediately - let mousemove handler manage it
              }}
            >
              {hoveredRow?.tableIndex === tableIndex && hoveredRow?.rowIndex === rowIndex && (
                <div className="handle-buttons">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      // Find the cell element in the DOM
                      const cell = tableInfo.tableElement.querySelector(`.tiptap-table-row:nth-child(${rowIndex + 1}) .tiptap-table-cell, .tiptap-table-row:nth-child(${rowIndex + 1}) .tiptap-table-header`)

                      if (cell) {
                        // Get the DOM position of the cell
                        const cellElement = cell as HTMLElement
                        const pos = editor.view.posAtDOM(cellElement, 0)


                        // Set cursor to this position and add row
                        editor.chain()
                          .focus()
                          .setTextSelection(pos)
                          .addRowBefore()
                          .run()
                      }
                    }}
                    title="Add row above"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      const cell = tableInfo.tableElement.querySelector(`.tiptap-table-row:nth-child(${rowIndex + 1}) .tiptap-table-cell, .tiptap-table-row:nth-child(${rowIndex + 1}) .tiptap-table-header`)

                      if (cell) {
                        const cellElement = cell as HTMLElement
                        const pos = editor.view.posAtDOM(cellElement, 0)


                        editor.chain()
                          .focus()
                          .setTextSelection(pos)
                          .deleteRow()
                          .run()
                      }
                    }}
                    title="Delete row"
                    className="destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Column handles on the top */}
          {tableInfo.colRects.map((colRect, colIndex) => (
            <div
              key={`table-${tableIndex}-col-${colIndex}`}
              className="col-handle"
              style={{
                position: 'fixed',
                left: `${colRect.left}px`,
                top: `${colRect.top - 32}px`,
                width: `${colRect.width}px`,
                height: '28px',
                zIndex: 10,
              }}
              onMouseEnter={() => {
                setHoveredCol({ tableIndex, colIndex })
              }}
              onMouseLeave={() => {
                // Don't clear immediately - let mousemove handler manage it
              }}
            >
              {hoveredCol?.tableIndex === tableIndex && hoveredCol?.colIndex === colIndex && (
                <div className="handle-buttons horizontal">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      const cell = tableInfo.tableElement.querySelector(`.tiptap-table-row:first-child > :nth-child(${colIndex + 1})`)

                      if (cell) {
                        const cellElement = cell as HTMLElement
                        const pos = editor.view.posAtDOM(cellElement, 0)


                        editor.chain()
                          .focus()
                          .setTextSelection(pos)
                          .addColumnBefore()
                          .run()
                      }
                    }}
                    title="Add column left"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      const cell = tableInfo.tableElement.querySelector(`.tiptap-table-row:first-child > :nth-child(${colIndex + 1})`)

                      if (cell) {
                        const cellElement = cell as HTMLElement
                        const pos = editor.view.posAtDOM(cellElement, 0)


                        editor.chain()
                          .focus()
                          .setTextSelection(pos)
                          .deleteColumn()
                          .run()
                      }
                    }}
                    title="Delete column"
                    className="destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </React.Fragment>
      ))}

      <style>{`
        .table-overlay-controls {
          pointer-events: none;
        }

        .row-handle {
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
        }

        .row-handle:hover {
          background: transparent;
        }

        .handle-buttons {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .handle-buttons button {
          padding: 4px;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .handle-buttons button:hover {
          background: #f9fafb;
        }

        .handle-buttons button.destructive:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        /* Column handles */
        .col-handle {
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
        }

        .col-handle:hover {
          background: transparent;
        }

        .handle-buttons.horizontal {
          flex-direction: row;
        }
      `}</style>
    </div>
  )
}
