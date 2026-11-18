/**
 * Where a block chosen from a / menu goes, the one rule the slide editor (`slideCommands.insertSlideBlock`) and the Text
 * editor's Button (`buttonBlock/buttonCommands.insertButton`) both use (Sprint 163 PR 3: one placement, never two
 * copies). Pure ProseMirror, and no import of a menu's items, so both menus' modules can use it.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/** Meta on a slide editor transaction that the stage writes to the deck as an undo step of its own. */
export const SLIDE_COMMAND = 'deckSlideCommand'

const isTablePart = (node: PMNode) => typeof node.type.spec.tableRole === 'string'

/**
 * Put `node` where the / was (`at`, after its text is taken out): in place of the empty line it stood on, else after
 * the block the caret is in, at the first level that can hold it. Nothing goes inside a table: a Markdown table's cell
 * holds one line, so the block goes after the table. Its place, or -1 when no level can hold it (nothing is changed).
 */
export function placeBlock(tr: Transaction, at: number, node: PMNode): number {
  const $pos = tr.doc.resolve(Math.max(0, Math.min(at, tr.doc.content.size)))
  // The shallowest table on the way down: the levels from there on can't hold a block.
  let tableDepth = -1
  for (let depth = 1; depth <= $pos.depth; depth++) {
    if (isTablePart($pos.node(depth))) { tableDepth = depth; break }
  }
  let placed = -1
  if (tableDepth < 0 && $pos.depth > 0 && $pos.parent.type.name === 'paragraph' && $pos.parent.content.size === 0) {
    const depth = $pos.depth
    const holder = $pos.node(depth - 1)
    const index = $pos.index(depth - 1)
    if (holder.canReplaceWith(index, index + 1, node.type)) {
      placed = $pos.before(depth)
      tr.replaceWith(placed, $pos.after(depth), node)
    }
  }
  if (placed < 0 && $pos.depth === 0 && tr.doc.canReplaceWith($pos.index(0), $pos.index(0), node.type)) {
    placed = $pos.pos
    tr.insert(placed, node)
  }
  for (let depth = (tableDepth < 0 ? $pos.depth : tableDepth) - 1; placed < 0 && depth >= 0; depth--) {
    // After the child that holds the caret at this level, where that level can hold the block.
    const index = $pos.index(depth) + 1
    if (!$pos.node(depth).canReplaceWith(index, index, node.type)) continue
    placed = $pos.after(depth + 1)
    tr.insert(placed, node)
  }
  return placed
}
