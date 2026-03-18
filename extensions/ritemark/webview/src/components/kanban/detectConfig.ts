import type { CsvyKanbanConfig, CsvyColumnConfig } from './csvyParser'

/**
 * Resolved kanban configuration — all fields guaranteed present.
 * Built from CSVY frontmatter + smart defaults.
 */
export interface ResolvedKanbanConfig {
  groupBy: string
  title: string
  subtitle: string | null
  fields: string[]
  colorBy: string | null
  linkFields: string[]
  sort: { field: string; direction: 'asc' | 'desc' } | null
  columns: CsvyColumnConfig[]
}

// Known column name patterns (case-insensitive matching)
const GROUP_BY_PATTERNS = ['status', 'state', 'stage', 'phase', 'column', 'kanban']
const TITLE_PATTERNS = ['title', 'name', 'task', 'subject', 'summary', 'description']
const SUBTITLE_PATTERNS = ['assignee', 'owner', 'assigned_to', 'assigned', 'person', 'user', 'responsible']
const COLOR_PATTERNS = ['priority', 'severity', 'importance', 'urgency', 'type', 'category', 'label']

// Known status workflow orderings
const KNOWN_ORDERINGS: Record<string, string[]> = {
  standard: ['backlog', 'todo', 'to do', 'to-do', 'in-progress', 'in progress', 'review', 'done', 'archived', 'closed'],
  issue: ['new', 'open', 'active', 'in progress', 'in-progress', 'resolved', 'closed'],
  simple: ['planned', 'active', 'completed'],
  draft: ['draft', 'ready', 'in-progress', 'in progress', 'done'],
}

/**
 * Resolve a full kanban config from CSVY frontmatter + smart defaults.
 */
export function resolveKanbanConfig(
  columns: string[],
  rows: Record<string, unknown>[],
  csvyConfig: CsvyKanbanConfig | null
): ResolvedKanbanConfig | null {
  const lowerColumns = columns.map((c) => c.toLowerCase().trim())

  // 1. Determine groupBy
  const groupBy = csvyConfig?.groupBy || detectColumn(columns, lowerColumns, GROUP_BY_PATTERNS)
  if (!groupBy) return null // Can't create kanban without a group column

  // 2. Determine title
  const title = csvyConfig?.title || detectColumn(
    columns,
    lowerColumns,
    TITLE_PATTERNS,
    [groupBy] // exclude groupBy from title candidates
  ) || columns.find((c) => c !== groupBy) || groupBy

  // 3. Subtitle
  const subtitle = csvyConfig?.subtitle || detectColumn(columns, lowerColumns, SUBTITLE_PATTERNS, [groupBy, title]) || null

  // 4. Fields to display on card
  const fields = csvyConfig?.fields || columns.filter(
    (c) => c !== groupBy && c !== title && c !== subtitle
  ).slice(0, 4) // Show max 4 extra fields by default

  // 5. Color coding
  const colorBy = csvyConfig?.colorBy || detectColumn(columns, lowerColumns, COLOR_PATTERNS, [groupBy, title]) || null

  // 6. Link fields — detect from config or auto-detect from cell values
  let linkFields: string[] = []
  if (csvyConfig?.link) {
    linkFields = Array.isArray(csvyConfig.link) ? csvyConfig.link : [csvyConfig.link]
  } else {
    linkFields = detectLinkFields(columns, rows)
  }

  // 7. Sort
  let sort: ResolvedKanbanConfig['sort'] = null
  if (csvyConfig?.sort) {
    const parts = csvyConfig.sort.trim().split(/\s+/)
    if (parts[0] && columns.includes(parts[0])) {
      sort = {
        field: parts[0],
        direction: parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc',
      }
    }
  }

  // 8. Column ordering
  const kanbanColumns = resolveColumnOrder(groupBy, rows, csvyConfig?.columns || null)

  return {
    groupBy,
    title,
    subtitle,
    fields,
    colorBy,
    linkFields,
    sort,
    columns: kanbanColumns,
  }
}

/**
 * Detect a column by matching patterns, with exclusions.
 */
function detectColumn(
  columns: string[],
  lowerColumns: string[],
  patterns: string[],
  exclude: string[] = []
): string | null {
  for (const pattern of patterns) {
    const idx = lowerColumns.findIndex(
      (lc, i) => lc === pattern && !exclude.includes(columns[i])
    )
    if (idx !== -1) return columns[idx]
  }
  // Also try partial match (e.g., "task_status" contains "status")
  for (const pattern of patterns) {
    const idx = lowerColumns.findIndex(
      (lc, i) => lc.includes(pattern) && !exclude.includes(columns[i])
    )
    if (idx !== -1) return columns[idx]
  }
  return null
}

/**
 * Auto-detect link fields by scanning cell values for .md and .flow.json references.
 */
function detectLinkFields(columns: string[], rows: Record<string, unknown>[]): string[] {
  const linkCols: string[] = []
  const sampleRows = rows.slice(0, 20) // Check first 20 rows

  for (const col of columns) {
    const hasLink = sampleRows.some((row) => {
      const val = String(row[col] || '')
      return val.endsWith('.md') || val.endsWith('.flow.json') || val.endsWith('.json')
    })
    if (hasLink) linkCols.push(col)
  }
  return linkCols
}

/**
 * Resolve column order: explicit config → known workflow patterns → data order.
 */
function resolveColumnOrder(
  groupBy: string,
  rows: Record<string, unknown>[],
  explicitColumns: CsvyColumnConfig[] | null
): CsvyColumnConfig[] {
  // Extract unique values from data
  const uniqueValues: string[] = []
  for (const row of rows) {
    const val = String(row[groupBy] || '').trim()
    if (val && !uniqueValues.includes(val)) {
      uniqueValues.push(val)
    }
  }

  // If explicit columns provided, use them (but include any data values not in config)
  if (explicitColumns && explicitColumns.length > 0) {
    const explicitValues = explicitColumns.map((c) => c.value)
    const missing = uniqueValues.filter((v) => !explicitValues.includes(v))
    return [
      ...explicitColumns,
      ...missing.map((v) => ({ value: v })),
    ]
  }

  // Try to match against known workflow orderings
  const lowerValues = uniqueValues.map((v) => v.toLowerCase())

  for (const ordering of Object.values(KNOWN_ORDERINGS)) {
    const matched = ordering.filter((step) => lowerValues.includes(step))
    if (matched.length >= 2 && matched.length >= lowerValues.length * 0.5) {
      // Good match — order values according to this workflow
      const sorted = [...uniqueValues].sort((a, b) => {
        const aIdx = ordering.indexOf(a.toLowerCase())
        const bIdx = ordering.indexOf(b.toLowerCase())
        if (aIdx === -1 && bIdx === -1) return 0
        if (aIdx === -1) return 1
        if (bIdx === -1) return -1
        return aIdx - bIdx
      })
      return sorted.map((v) => ({ value: v }))
    }
  }

  // Fallback: order of first appearance in data
  return uniqueValues.map((v) => ({ value: v }))
}

/**
 * Check if kanban view can be offered for given columns.
 */
export function canShowKanban(columns: string[]): boolean {
  const lowerColumns = columns.map((c) => c.toLowerCase().trim())
  return GROUP_BY_PATTERNS.some((p) => lowerColumns.some((lc) => lc === p || lc.includes(p)))
}
