import { useMemo, useState } from 'react'
import { X, Filter } from 'lucide-react'

export interface KanbanFilter {
  field: string
  value: string
}

interface KanbanFilterBarProps {
  columns: string[]
  rows: Record<string, unknown>[]
  filters: KanbanFilter[]
  onFiltersChange: (filters: KanbanFilter[]) => void
  /** Columns to exclude from filter options (e.g. groupBy) */
  excludeColumns?: string[]
}

export function KanbanFilterBar({
  columns,
  rows,
  filters,
  onFiltersChange,
  excludeColumns = [],
}: KanbanFilterBarProps) {
  // Get unique values per column for filter dropdowns
  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    const filterableCols = columns.filter((c) => !excludeColumns.includes(c))

    for (const col of filterableCols) {
      const uniqueVals = new Set<string>()
      for (const row of rows) {
        const val = String(row[col] || '').trim()
        if (val) uniqueVals.add(val)
      }
      // Only show columns with 2-20 unique values as filter candidates
      if (uniqueVals.size >= 2 && uniqueVals.size <= 20) {
        options[col] = Array.from(uniqueVals).sort()
      }
    }
    return options
  }, [columns, rows, excludeColumns])

  const filterableColumns = Object.keys(filterOptions)
  if (filterableColumns.length === 0) return null

  const addFilter = (field: string, value: string) => {
    // Don't add duplicate filters
    if (filters.some((f) => f.field === field && f.value === value)) return
    onFiltersChange([...filters, { field, value }])
  }

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index))
  }

  const clearAll = () => onFiltersChange([])

  return (
    <div className="kanban-filter-bar">
      <div className="kanban-filter-icon">
        <Filter size={14} />
      </div>

      {/* Active filters */}
      {filters.map((filter, idx) => (
        <span key={`${filter.field}-${filter.value}-${idx}`} className="kanban-filter-chip">
          <span className="kanban-filter-chip-field">{filter.field}:</span>
          <span>{filter.value}</span>
          <button
            className="kanban-filter-chip-remove"
            onClick={() => removeFilter(idx)}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Add filter dropdown */}
      <FilterDropdown
        filterableColumns={filterableColumns}
        filterOptions={filterOptions}
        onSelect={addFilter}
      />

      {filters.length > 0 && (
        <button className="kanban-filter-clear" onClick={clearAll}>
          Clear all
        </button>
      )}
    </div>
  )
}

function FilterDropdown({
  filterableColumns,
  filterOptions,
  onSelect,
}: {
  filterableColumns: string[]
  filterOptions: Record<string, string[]>
  onSelect: (field: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedField, setSelectedField] = useState<string | null>(null)

  return (
    <div className="kanban-filter-dropdown-container">
      <button
        className="kanban-filter-add"
        onClick={() => {
          setOpen(!open)
          setSelectedField(null)
        }}
      >
        + Filter
      </button>

      {open && (
        <div className="kanban-filter-dropdown">
          {!selectedField ? (
            // Step 1: Pick column
            filterableColumns.map((col) => (
              <button
                key={col}
                className="kanban-filter-dropdown-item"
                onClick={() => setSelectedField(col)}
              >
                {col}
              </button>
            ))
          ) : (
            // Step 2: Pick value
            <>
              <button
                className="kanban-filter-dropdown-back"
                onClick={() => setSelectedField(null)}
              >
                ← {selectedField}
              </button>
              {filterOptions[selectedField]?.map((val) => (
                <button
                  key={val}
                  className="kanban-filter-dropdown-item"
                  onClick={() => {
                    onSelect(selectedField, val)
                    setOpen(false)
                    setSelectedField(null)
                  }}
                >
                  {val}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
