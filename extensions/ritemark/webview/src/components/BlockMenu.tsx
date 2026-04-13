/**
 * BlockMenu Component
 *
 * A dropdown menu that appears when clicking the + button next to the drag handle.
 * Inserts a new block ABOVE the current block at the specified position.
 * Uses the shared block items and CommandsList visual component.
 *
 * @see Sprint 14: Block Interactions
 */

import { type Editor as TipTapEditor } from '@tiptap/react'
import { CommandsList } from '../extensions/CommandsList'
import { blockItems, executeBlockInsert } from '../extensions/blockItems'

interface BlockMenuProps {
  editor: TipTapEditor
  onClose: () => void
  insertAtPos?: number | null
}

export function BlockMenu({ editor, onClose, insertAtPos }: BlockMenuProps) {
  return (
    <CommandsList
      items={blockItems}
      command={(item) => {
        if (insertAtPos == null) {
          onClose()
          return
        }
        executeBlockInsert(editor, insertAtPos, item)
        onClose()
      }}
    />
  )
}

export default BlockMenu
