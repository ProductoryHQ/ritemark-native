import type { Node as PMNode } from '@tiptap/pm/model'

/** Sprint 138 (experience 38): the equations in a document, for the status bar's "· 5 equations". */
export function countEquations(doc: Pick<PMNode, 'descendants'>): number {
  let count = 0
  doc.descendants(node => {
    if (node.type.name === 'mathInline' || node.type.name === 'mathBlock') count++
    return !node.isLeaf
  })
  return count
}
