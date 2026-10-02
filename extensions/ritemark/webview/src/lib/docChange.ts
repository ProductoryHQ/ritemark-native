import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/** Words in a document; blocks and line breaks separate words (GH #378). */
export function countWords(doc: Pick<ProseMirrorNode, 'textBetween' | 'content'>): number {
  return doc.textBetween(0, doc.content.size, ' ', ' ').trim().split(/\s+/).filter(Boolean).length
}

/**
 * Run `callback` after every change to the document, including revisions
 * applied from the host with `preventUpdate` — TipTap emits `transaction` for
 * those but not `update`. Returns the unsubscribe function.
 */
export function onDocChanged(editor: Pick<Editor, 'on' | 'off'>, callback: () => void): () => void {
  const handler = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (transaction.docChanged) callback()
  }
  editor.on('transaction', handler)
  return () => { editor.off('transaction', handler) }
}
