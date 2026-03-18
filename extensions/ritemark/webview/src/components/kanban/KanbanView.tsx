import { useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { KanbanFilterBar, type KanbanFilter } from './KanbanFilterBar'
import type { ResolvedKanbanConfig } from './detectConfig'
import { sendToExtension } from '../../bridge'

interface KanbanViewProps {
  rows: Record<string, unknown>[]
  columns: string[]
  config: ResolvedKanbanConfig
  onCardMove: (rowIndex: number, newGroupValue: string) => void
}

export function KanbanView({ rows, columns, config, onCardMove }: KanbanViewProps) {
  const [filters, setFilters] = useState<KanbanFilter[]>([])
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Apply filters
  const filteredRows = useMemo(() => {
    if (filters.length === 0) return rows
    return rows.filter((row) =>
      filters.every((f) => String(row[f.field] || '').trim() === f.value)
    )
  }, [rows, filters])

  // Group rows by the groupBy column
  const groupedRows = useMemo(() => {
    const groups: Map<string, { row: Record<string, unknown>; originalIndex: number }[]> = new Map()

    // Initialize all configured columns (even empty ones)
    for (const col of config.columns) {
      groups.set(col.value, [])
    }

    // Assign rows to columns
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i]
      const groupValue = String(row[config.groupBy] || '').trim()
      // Find original index in unfiltered array
      const originalIndex = rows.indexOf(row)

      if (!groups.has(groupValue)) {
        groups.set(groupValue, [])
      }
      groups.get(groupValue)!.push({ row, originalIndex })
    }

    // Apply sort within columns
    if (config.sort) {
      const { field, direction } = config.sort
      for (const [, items] of groups) {
        items.sort((a, b) => {
          const aVal = String(a.row[field] || '')
          const bVal = String(b.row[field] || '')
          const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
          return direction === 'desc' ? -cmp : cmp
        })
      }
    }

    return groups
  }, [filteredRows, rows, config])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current
    if (data?.rowIndex !== undefined) {
      setActiveCardIndex(data.rowIndex)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveCardIndex(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    if (!activeData || activeData.rowIndex === undefined) return

    // Determine target column
    let targetColumnValue: string | null = null

    if (over.id.toString().startsWith('column-')) {
      targetColumnValue = over.data.current?.columnValue
    } else if (over.id.toString().startsWith('card-')) {
      // Dropped on another card — find which column that card is in
      const overRowIndex = over.data.current?.rowIndex
      if (overRowIndex !== undefined) {
        targetColumnValue = String(rows[overRowIndex]?.[config.groupBy] || '').trim()
      }
    }

    if (targetColumnValue === null) return

    // Check if the card is already in this column
    const currentValue = String(rows[activeData.rowIndex]?.[config.groupBy] || '').trim()
    if (currentValue === targetColumnValue) return

    onCardMove(activeData.rowIndex, targetColumnValue)
  }, [rows, config.groupBy, onCardMove])

  const handleOpenFile = useCallback((path: string) => {
    sendToExtension('csv:openFile', { path })
  }, [])

  const activeRow = activeCardIndex !== null ? rows[activeCardIndex] : null

  return (
    <div className="kanban-container">
      {/* Filter bar */}
      <KanbanFilterBar
        columns={columns}
        rows={rows}
        filters={filters}
        onFiltersChange={setFilters}
        excludeColumns={[config.groupBy]}
      />

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {config.columns.map((col, idx) => (
            <KanbanColumn
              key={col.value}
              column={col}
              columnIndex={idx}
              rows={groupedRows.get(col.value) || []}
              config={config}
              onOpenFile={handleOpenFile}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRow && (
            <div className="kanban-card kanban-card-dragging">
              <div className="kanban-card-content">
                <div className="kanban-card-title">
                  {String(activeRow[config.title] || '(untitled)')}
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <style>{kanbanStyles}</style>
    </div>
  )
}

const kanbanStyles = `
  .kanban-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .kanban-board {
    display: flex;
    gap: 12px;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px;
    align-items: flex-start;
  }

  /* Column */
  .kanban-column {
    flex: 0 0 280px;
    min-width: 280px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--vscode-sideBar-background);
    border-radius: 8px;
    border: 1px solid var(--vscode-panel-border);
  }

  .kanban-column-over {
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
  }

  .kanban-column-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .kanban-column-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .kanban-column-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--vscode-foreground);
    flex: 1;
  }

  .kanban-column-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .kanban-column-cards {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kanban-column-empty {
    padding: 20px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.5;
    border: 2px dashed var(--vscode-panel-border);
    border-radius: 6px;
  }

  /* Card */
  .kanban-card {
    display: flex;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    cursor: grab;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .kanban-card:hover {
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  .kanban-card-dragging {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    border-color: var(--vscode-focusBorder);
    cursor: grabbing;
  }

  .kanban-card-handle {
    display: flex;
    align-items: flex-start;
    padding: 10px 2px 10px 6px;
    color: var(--vscode-descriptionForeground);
    opacity: 0;
    transition: opacity 0.15s;
    cursor: grab;
  }

  .kanban-card:hover .kanban-card-handle {
    opacity: 0.5;
  }

  .kanban-card-handle:hover {
    opacity: 1 !important;
  }

  .kanban-card-content {
    flex: 1;
    padding: 8px 10px 8px 4px;
    min-width: 0;
  }

  .kanban-card-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    color: white;
    padding: 1px 6px;
    border-radius: 3px;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .kanban-card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--vscode-foreground);
    line-height: 1.3;
    word-break: break-word;
  }

  .kanban-card-subtitle {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
  }

  .kanban-card-fields {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .kanban-card-field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .kanban-card-field-label {
    color: var(--vscode-descriptionForeground);
    min-width: 50px;
  }

  .kanban-card-field-value {
    color: var(--vscode-foreground);
    word-break: break-word;
  }

  .kanban-card-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--vscode-textLink-foreground);
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }

  .kanban-card-link:hover {
    text-decoration: underline;
  }

  .kanban-card-links {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .kanban-card-link-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .kanban-card-link-icon:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-textLink-foreground);
  }

  /* Filter bar */
  .kanban-filter-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-wrap: wrap;
  }

  .kanban-filter-icon {
    color: var(--vscode-descriptionForeground);
    display: flex;
    align-items: center;
  }

  .kanban-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px 2px 8px;
    font-size: 11px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 12px;
  }

  .kanban-filter-chip-field {
    opacity: 0.7;
  }

  .kanban-filter-chip-remove {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    opacity: 0.6;
  }

  .kanban-filter-chip-remove:hover {
    opacity: 1;
  }

  .kanban-filter-add {
    font-size: 11px;
    color: var(--vscode-textLink-foreground);
    background: none;
    border: 1px dashed var(--vscode-panel-border);
    border-radius: 12px;
    padding: 2px 10px;
    cursor: pointer;
    font-family: inherit;
  }

  .kanban-filter-add:hover {
    border-color: var(--vscode-textLink-foreground);
  }

  .kanban-filter-clear {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: none;
    border: none;
    padding: 2px 6px;
    cursor: pointer;
    font-family: inherit;
  }

  .kanban-filter-clear:hover {
    color: var(--vscode-foreground);
  }

  .kanban-filter-dropdown-container {
    position: relative;
  }

  .kanban-filter-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
    z-index: 100;
  }

  .kanban-filter-dropdown-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--vscode-menu-foreground);
    cursor: pointer;
    font-family: inherit;
  }

  .kanban-filter-dropdown-item:hover {
    background: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
  }

  .kanban-filter-dropdown-back {
    display: block;
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid var(--vscode-panel-border);
    border-radius: 0;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 2px;
  }

  .kanban-filter-dropdown-back:hover {
    color: var(--vscode-foreground);
  }
`
