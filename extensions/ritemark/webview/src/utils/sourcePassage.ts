/** A location carried by a source link. Checked again before the host reads a file. */
export interface SourcePassage {
  text?: string
  page?: number
}

export const MAX_FIND_TEXT = 200

export function sourcePage(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : undefined
}

export function sourceText(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_FIND_TEXT || /[\u0000-\u001f\u007f-\u009f]/.test(value)) return
  return value.trim() || undefined
}

export function decodeSourcePassage(value: unknown): SourcePassage | undefined {
  if (!value || typeof value !== 'object') return
  const { text, page } = value as SourcePassage
  if (text !== undefined && !sourceText(text)) return
  const safePage = sourcePage(page)
  if (!text && safePage === undefined) return
  return { ...(text ? { text: sourceText(text) } : {}), ...(safePage === undefined ? {} : { page: safePage }) }
}

export type SourcePreview =
  | { error: string }
  | { name: string; extension: string; page?: number; quote?: string; missing: boolean }
