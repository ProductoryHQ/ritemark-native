/**
 * Shared block item definitions for slash commands and block menu.
 * Single source of truth for all insertable block types.
 */

import type { PhosphorIconName } from '../components/ui/Icon'
import { sendToExtension, emitInternalEvent } from '../bridge'

export interface BlockItemDef {
  title: string
  description: string
  icon: PhosphorIconName
  nodeType: string
  attrs?: Record<string, unknown>
}

export const blockItems: BlockItemDef[] = [
  { title: 'Text', description: 'Plain text paragraph', icon: 'paragraph', nodeType: 'paragraph' },
  { title: 'Heading 1', description: 'Large heading', icon: 'text-h-one', nodeType: 'heading', attrs: { level: 1 } },
  { title: 'Heading 2', description: 'Medium heading', icon: 'text-h-two', nodeType: 'heading', attrs: { level: 2 } },
  { title: 'Heading 3', description: 'Small heading', icon: 'text-h-three', nodeType: 'heading', attrs: { level: 3 } },
  { title: 'Bullet List', description: 'Create a bulleted list', icon: 'list', nodeType: 'bulletList' },
  { title: 'Numbered List', description: 'Create a numbered list', icon: 'list-numbers', nodeType: 'orderedList' },
  { title: 'Task List', description: 'Create a checklist', icon: 'check-square', nodeType: 'taskList' },
  { title: 'Quote', description: 'Insert a blockquote', icon: 'quotes', nodeType: 'blockquote' },
  { title: 'Code Block', description: 'Insert a code block', icon: 'code', nodeType: 'codeBlock' },
  { title: 'Table', description: 'Insert a 3×3 table', icon: 'table', nodeType: 'table' },
  { title: 'Mermaid Diagram', description: 'Insert a mermaid diagram', icon: 'git-branch', nodeType: 'mermaid' },
  { title: 'Image', description: 'Insert an image from file', icon: 'image', nodeType: 'image' },
  { title: 'Divider', description: 'Horizontal rule', icon: 'minus', nodeType: 'horizontalRule' },
]

/**
 * Execute a block item via slash command (deletes the /query range first).
 */
export function executeSlashCommand(editor: any, range: any, item: BlockItemDef) {
  if (item.nodeType === 'image') {
    const insertPos = range.from
    editor.chain().focus().deleteRange(range).run()
    emitInternalEvent('image:pending-position', insertPos)
    sendToExtension('selectImageFile')
    return
  }

  const chain = editor.chain().focus().deleteRange(range)

  switch (item.nodeType) {
    case 'paragraph':
      chain.setNode('paragraph').run()
      break
    case 'heading':
      chain.setNode('heading', item.attrs).run()
      break
    case 'bulletList':
      chain.toggleBulletList().run()
      break
    case 'orderedList':
      chain.toggleOrderedList().run()
      break
    case 'taskList':
      chain.toggleTaskList().run()
      break
    case 'blockquote':
      chain.toggleBlockquote().run()
      break
    case 'codeBlock':
      chain.setCodeBlock().run()
      break
    case 'mermaid':
      chain.setCodeBlock({ language: 'mermaid' }).run()
      break
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      break
    case 'horizontalRule':
      chain.setHorizontalRule().run()
      break
  }
}

/**
 * Execute a block item via block menu (inserts at a specific position).
 */
export function executeBlockInsert(editor: any, pos: number, item: BlockItemDef) {
  if (item.nodeType === 'image') {
    emitInternalEvent('image:pending-position', pos)
    sendToExtension('selectImageFile')
    return
  }

  if (item.nodeType === 'table') {
    editor.chain().focus().setTextSelection(pos).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    return
  }

  let content: Record<string, unknown>

  switch (item.nodeType) {
    case 'paragraph':
      content = { type: 'paragraph' }
      break
    case 'heading':
      content = { type: 'heading', attrs: item.attrs }
      break
    case 'bulletList':
      content = { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }
      break
    case 'orderedList':
      content = { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }
      break
    case 'taskList':
      content = { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }
      break
    case 'blockquote':
      content = { type: 'blockquote', content: [{ type: 'paragraph' }] }
      break
    case 'codeBlock':
      content = { type: 'codeBlock' }
      break
    case 'mermaid':
      content = { type: 'codeBlock', attrs: { language: 'mermaid' } }
      break
    case 'horizontalRule':
      content = { type: 'horizontalRule' }
      break
    default:
      content = { type: 'paragraph' }
  }

  editor.chain().focus().insertContentAt(pos, content).setTextSelection(pos + 1).run()
}
