import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import type { CsvyColumnConfig } from './csvyParser'
import type { ResolvedKanbanConfig } from './detectConfig'
import { getColumnColor } from './colors'

interface KanbanColumnProps {
  column: CsvyColumnConfig
  columnIndex: number
  rows: { row: Record<string, unknown>; originalIndex: number }[]
  config: ResolvedKanbanConfig
  onOpenFile?: (path: string) => void
}

export function KanbanColumn({ column, columnIndex, rows, config, onOpenFile }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.value}`,
    data: { columnValue: column.value },
  })

  const headerColor = column.color || getColumnColor(columnIndex)
  const cardIds = rows.map((r) => `card-${r.originalIndex}`)

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column-over' : ''}`}
    >
      {/* Column header */}
      <div className="kanban-column-header">
        <div
          className="kanban-column-indicator"
          style={{ background: headerColor }}
        />
        <span className="kanban-column-title">
          {column.label || column.value}
        </span>
        <span className="kanban-column-count">{rows.length}</span>
      </div>

      {/* Cards */}
      <div className="kanban-column-cards">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {rows.map(({ row, originalIndex }) => (
            <KanbanCard
              key={originalIndex}
              row={row}
              rowIndex={originalIndex}
              config={config}
              onOpenFile={onOpenFile}
            />
          ))}
        </SortableContext>

        {rows.length === 0 && (
          <div className="kanban-column-empty">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  )
}
