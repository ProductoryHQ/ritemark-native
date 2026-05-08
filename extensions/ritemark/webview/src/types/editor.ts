/**
 * Editor Selection Interface
 *
 * Tracks the current text selection in the TipTap editor.
 * Used by AI Chat to understand user context when they say "this" or "selected text".
 */
export interface EditorSelection {
  /** Plain text content of the selection */
  text: string

  /** Start position in the document (TipTap position) */
  from: number

  /** End position in the document (TipTap position) */
  to: number

  /** True if no text is selected (cursor only) */
  isEmpty: boolean

  /** Number of words in the selection (for UI display) */
  wordCount: number

  /**
   * Up to 80 characters of text immediately before the selection. Used by
   * the AI sidebar to give the agent an unambiguous fingerprint of WHERE
   * the selection sits in the document — line numbers proved unreliable
   * because TipTap positions don't map cleanly to markdown source offsets.
   */
  contextBefore?: string
  /** Up to 80 characters of text immediately after the selection. */
  contextAfter?: string
}
