import { useState } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'

/**
 * TablePicker Component
 *
 * Provides a visual grid picker for selecting table dimensions before insertion.
 * Users hover over cells to preview table size and click to insert.
 *
 * Features:
 * - 10x10 grid by default (configurable)
 * - Visual hover preview with blue highlighting
 * - Shows selected dimensions (e.g., "3 × 4")
 * - Inserts table with header row by default
 * - Mobile-responsive (touch-friendly)
 *
 * @see /docs/sprints/sprint-11-task-breakdown.md - Tasks
 */

interface TablePickerProps {
  /** The TipTap editor instance (required) */
  editor: TipTapEditor
  /** Callback fired when user closes picker without selection */
  onClose: () => void
}

export function TablePicker({ editor, onClose }: TablePickerProps) {
  const [hoveredCell, setHoveredCell] = useState({ row: 0, col: 0 })
  const maxRows = 10
  const maxCols = 10

  /**
   * Updates hover state when user hovers over a grid cell
   * Calculates which cells should be highlighted based on mouse position
   */
  const handleCellHover = (row: number, col: number) => {
    setHoveredCell({ row, col })
  }

  /**
   * Inserts table with specified dimensions when user clicks a cell
   * Always inserts with header row for better markdown compatibility
   * Collapses selection to end first to avoid replacing selected text
   */
  const handleCellClick = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .setTextSelection(editor.state.selection.to) // Move cursor to end of selection
      .insertContent('\n') // Add newline before table
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
    onClose()
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg border">
      {/* Dimension label - shows current hover selection */}
      <div className="text-sm text-gray-600 mb-2 text-center font-medium">
        {hoveredCell.row} × {hoveredCell.col}
      </div>

      {/* Grid picker - 10x10 cells */}
      <div className="grid gap-1" style={{
        gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`
      }}>
        {Array.from({ length: maxRows * maxCols }).map((_, index) => {
          const row = Math.floor(index / maxCols) + 1
          const col = (index % maxCols) + 1
          const isHighlighted = row <= hoveredCell.row && col <= hoveredCell.col

          return (
            <div
              key={index}
              className={`w-6 h-6 border-2 cursor-pointer transition-colors ${
                isHighlighted
                  ? 'bg-blue-100 border-blue-400'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
              onMouseEnter={() => handleCellHover(row, col)}
              onClick={() => handleCellClick(row, col)}
              role="button"
              tabIndex={0}
              aria-label={`Insert ${row} by ${col} table`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleCellClick(row, col)
                }
              }}
            />
          )
        })}
      </div>

      {/* Instruction label */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Click to insert table
      </div>
    </div>
  )
}
