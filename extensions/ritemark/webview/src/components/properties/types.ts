export type PropertyType = 'text' | 'date' | 'tags' | 'status'

export const COMMON_PROPERTIES = [
  { key: 'title', label: 'Title', type: 'text' as const },
  { key: 'author', label: 'Author', type: 'text' as const },
  { key: 'date', label: 'Date', type: 'date' as const },
  { key: 'tags', label: 'Tags', type: 'tags' as const },
  { key: 'status', label: 'Status', type: 'status' as const },
  { key: 'description', label: 'Description', type: 'text' as const },
] as const
