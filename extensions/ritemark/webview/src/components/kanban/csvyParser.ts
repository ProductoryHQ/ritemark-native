import yaml from 'js-yaml'

/**
 * CSVY frontmatter configuration for kanban view.
 * Based on csvy.org spec — YAML between `---` delimiters at top of CSV.
 */
export interface CsvyKanbanConfig {
  view?: 'kanban' | 'table'
  groupBy?: string
  title?: string
  subtitle?: string
  fields?: string[]
  colorBy?: string
  link?: string | string[]
  sort?: string // e.g. "priority desc"
  columns?: CsvyColumnConfig[]
}

export interface CsvyColumnConfig {
  value: string
  label?: string
  color?: string
}

export interface CsvyParseResult {
  /** Raw frontmatter string (including --- delimiters) for round-trip preservation */
  rawFrontmatter: string | null
  /** Parsed kanban config from frontmatter */
  config: CsvyKanbanConfig | null
  /** CSV content with frontmatter stripped */
  csvContent: string
}

/**
 * Parse a CSVY file — extract YAML frontmatter and return CSV content separately.
 * Frontmatter is stored as raw string for lossless round-trip serialization.
 */
export function parseCsvy(content: string): CsvyParseResult {
  const trimmed = content.trimStart()

  // Check for frontmatter delimiter
  if (!trimmed.startsWith('---')) {
    return { rawFrontmatter: null, config: null, csvContent: content }
  }

  // Find closing delimiter
  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) {
    return { rawFrontmatter: null, config: null, csvContent: content }
  }

  const rest = trimmed.substring(firstNewline + 1)
  const closingIndex = rest.indexOf('\n---')

  if (closingIndex === -1) {
    return { rawFrontmatter: null, config: null, csvContent: content }
  }

  const yamlBlock = rest.substring(0, closingIndex)
  const afterClosing = rest.substring(closingIndex + 4) // skip \n---
  // Skip the newline after closing ---
  const csvContent = afterClosing.startsWith('\n')
    ? afterClosing.substring(1)
    : afterClosing

  // Preserve the raw frontmatter block (including delimiters) for round-trip
  const rawFrontmatter = trimmed.substring(0, firstNewline + 1 + closingIndex + 4)

  // Parse YAML
  let config: CsvyKanbanConfig | null = null
  try {
    const parsed = yaml.load(yamlBlock) as Record<string, unknown>
    if (parsed && typeof parsed === 'object') {
      config = extractKanbanConfig(parsed)
    }
  } catch (e) {
    console.warn('[CSVY] Failed to parse frontmatter YAML:', e)
  }

  return { rawFrontmatter, config, csvContent }
}

/**
 * Serialize CSV content back with preserved frontmatter.
 * Frontmatter is prepended verbatim — never modified by kanban edits.
 */
export function serializeCsvy(rawFrontmatter: string | null, csvContent: string): string {
  if (!rawFrontmatter) {
    return csvContent
  }
  return rawFrontmatter + '\n' + csvContent
}

/**
 * Extract kanban-relevant config from parsed YAML object.
 */
function extractKanbanConfig(parsed: Record<string, unknown>): CsvyKanbanConfig {
  const config: CsvyKanbanConfig = {}

  if (parsed.view === 'kanban' || parsed.view === 'table') {
    config.view = parsed.view
  }
  if (typeof parsed.groupBy === 'string') config.groupBy = parsed.groupBy
  if (typeof parsed.title === 'string') config.title = parsed.title
  if (typeof parsed.subtitle === 'string') config.subtitle = parsed.subtitle
  if (typeof parsed.colorBy === 'string') config.colorBy = parsed.colorBy
  if (typeof parsed.sort === 'string') config.sort = parsed.sort

  if (typeof parsed.link === 'string') {
    config.link = parsed.link
  } else if (Array.isArray(parsed.link)) {
    config.link = parsed.link.filter((l): l is string => typeof l === 'string')
  }

  if (Array.isArray(parsed.fields)) {
    config.fields = parsed.fields.filter((f): f is string => typeof f === 'string')
  }

  if (Array.isArray(parsed.columns)) {
    config.columns = parsed.columns
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        value: String(c.value || ''),
        label: typeof c.label === 'string' ? c.label : undefined,
        color: typeof c.color === 'string' ? c.color : undefined,
      }))
      .filter((c) => c.value)
  }

  return config
}
