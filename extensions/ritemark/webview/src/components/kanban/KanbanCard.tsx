import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, Workflow, GripVertical } from 'lucide-react'
import type { ResolvedKanbanConfig } from './detectConfig'
import { getColorForValue } from './colors'

interface KanbanCardProps {
  row: Record<string, unknown>
  rowIndex: number
  config: ResolvedKanbanConfig
  onOpenFile?: (path: string) => void
}

export function KanbanCard({ row, rowIndex, config, onOpenFile }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false)

  const id = `card-${rowIndex}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { rowIndex, row } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const titleValue = String(row[config.title] || '')
  const subtitleValue = config.subtitle ? String(row[config.subtitle] || '') : null
  const colorValue = config.colorBy ? String(row[config.colorBy] || '') : null

  // Determine which extra fields to show
  const extraFields = expanded
    ? config.fields.filter((f) => f !== config.title && f !== config.subtitle && f !== config.colorBy)
    : []

  const hasExtraFields = config.fields.some(
    (f) => f !== config.title && f !== config.subtitle && f !== config.colorBy && String(row[f] || '')
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-card group"
      onClick={() => hasExtraFields && setExpanded(!expanded)}
    >
      {/* Drag handle */}
      <div
        className="kanban-card-handle"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </div>

      <div className="kanban-card-content">
        {/* Color badge */}
        {colorValue && (
          <span
            className="kanban-card-badge"
            style={{ background: getColorForValue(colorValue) }}
          >
            {colorValue}
          </span>
        )}

        {/* Title */}
        <div className="kanban-card-title">{titleValue || '(untitled)'}</div>

        {/* Subtitle */}
        {subtitleValue && (
          <div className="kanban-card-subtitle">{subtitleValue}</div>
        )}

        {/* Expanded fields */}
        {expanded && extraFields.length > 0 && (
          <div className="kanban-card-fields">
            {extraFields.map((field) => {
              const value = String(row[field] || '')
              if (!value) return null
              const isLink = config.linkFields.includes(field)

              return (
                <div key={field} className="kanban-card-field">
                  <span className="kanban-card-field-label">{field}</span>
                  {isLink ? (
                    <button
                      className="kanban-card-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenFile?.(value)
                      }}
                      title={`Open ${value}`}
                    >
                      {value.endsWith('.flow.json') ? (
                        <Workflow size={12} />
                      ) : (
                        <FileText size={12} />
                      )}
                      <span>{value}</span>
                    </button>
                  ) : (
                    <span className="kanban-card-field-value">{value}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Link icons row (always visible for link fields) */}
        {!expanded && config.linkFields.length > 0 && (
          <div className="kanban-card-links">
            {config.linkFields.map((field) => {
              const value = String(row[field] || '')
              if (!value) return null
              return (
                <button
                  key={field}
                  className="kanban-card-link-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenFile?.(value)
                  }}
                  title={`Open ${value}`}
                >
                  {value.endsWith('.flow.json') ? (
                    <Workflow size={12} />
                  ) : (
                    <FileText size={12} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
