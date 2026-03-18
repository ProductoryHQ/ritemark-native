/**
 * Color mapping for kanban card badges.
 * Maps common priority/category values to colors.
 */

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#94a3b8',
}

const TYPE_COLORS: Record<string, string> = {
  bug: '#ef4444',
  feature: '#8b5cf6',
  enhancement: '#3b82f6',
  task: '#22c55e',
  docs: '#06b6d4',
  chore: '#94a3b8',
}

// Fallback palette for unknown values
const PALETTE = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e',
  '#eab308', '#f97316', '#ef4444', '#ec4899',
  '#6366f1', '#14b8a6', '#84cc16', '#f59e0b',
]

const valueColorCache = new Map<string, string>()

/**
 * Get a consistent color for a value string.
 * Checks known priority/type mappings first, then assigns from palette.
 */
export function getColorForValue(value: string): string {
  const lower = value.toLowerCase().trim()

  if (PRIORITY_COLORS[lower]) return PRIORITY_COLORS[lower]
  if (TYPE_COLORS[lower]) return TYPE_COLORS[lower]

  if (valueColorCache.has(lower)) return valueColorCache.get(lower)!

  // Hash to palette index for consistent assignment
  let hash = 0
  for (let i = 0; i < lower.length; i++) {
    hash = ((hash << 5) - hash + lower.charCodeAt(i)) | 0
  }
  const color = PALETTE[Math.abs(hash) % PALETTE.length]
  valueColorCache.set(lower, color)
  return color
}

/**
 * Default column colors (used when CSVY config doesn't specify colors).
 */
const COLUMN_COLORS = [
  '#94a3b8', // slate (backlog/default)
  '#e2e8f0', // light gray (todo)
  '#fbbf24', // amber (in-progress)
  '#60a5fa', // blue (review)
  '#34d399', // green (done)
  '#c084fc', // purple
  '#fb923c', // orange
  '#f472b6', // pink
]

export function getColumnColor(index: number): string {
  return COLUMN_COLORS[index % COLUMN_COLORS.length]
}
