/**
 * BlockMenu Component
 *
 * A dropdown menu that appears when clicking the + button next to the drag handle.
 * Inserts a new block ABOVE the current block at the specified position.
 *
 * @see Sprint 14: Block Interactions
 */

import { type Editor as TipTapEditor } from '@tiptap/react'
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
} from 'lucide-react'

interface BlockMenuProps {
  editor: TipTapEditor
  onClose: () => void
  insertAtPos?: number | null
}

interface BlockItem {
  title: string
  description: string
  icon: React.ReactNode
  nodeType: string
  attrs?: Record<string, unknown>
}

const blockItems: BlockItem[] = [
  {
    title: 'Text',
    description: 'Plain text paragraph',
    icon: <Pilcrow size={18} />,
    nodeType: 'paragraph',
  },
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: <Heading1 size={18} />,
    nodeType: 'heading',
    attrs: { level: 1 },
  },
  {
    title: 'Heading 2',
    description: 'Medium heading',
    icon: <Heading2 size={18} />,
    nodeType: 'heading',
    attrs: { level: 2 },
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: <Heading3 size={18} />,
    nodeType: 'heading',
    attrs: { level: 3 },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: <List size={18} />,
    nodeType: 'bulletList',
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered size={18} />,
    nodeType: 'orderedList',
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: <ListChecks size={18} />,
    nodeType: 'taskList',
  },
  {
    title: 'Quote',
    description: 'Blockquote',
    icon: <Quote size={18} />,
    nodeType: 'blockquote',
  },
  {
    title: 'Code Block',
    description: 'Code with syntax highlighting',
    icon: <Code size={18} />,
    nodeType: 'codeBlock',
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: <Minus size={18} />,
    nodeType: 'horizontalRule',
  },
]

export function BlockMenu({ editor, onClose, insertAtPos }: BlockMenuProps) {
  const handleSelect = (item: BlockItem) => {
    if (insertAtPos == null) {
      onClose()
      return
    }

    const { nodeType, attrs } = item

    // Build the content to insert based on node type
    let content: Record<string, unknown>

    switch (nodeType) {
      case 'paragraph':
        content = { type: 'paragraph' }
        break
      case 'heading':
        content = { type: 'heading', attrs }
        break
      case 'bulletList':
        content = {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
        }
        break
      case 'orderedList':
        content = {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
        }
        break
      case 'taskList':
        content = {
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }]
        }
        break
      case 'blockquote':
        content = {
          type: 'blockquote',
          content: [{ type: 'paragraph' }]
        }
        break
      case 'codeBlock':
        content = { type: 'codeBlock' }
        break
      case 'horizontalRule':
        content = { type: 'horizontalRule' }
        break
      default:
        content = { type: 'paragraph' }
    }

    // Insert the new block at the position and focus into it
    editor.chain()
      .focus()
      .insertContentAt(insertAtPos, content)
      .setTextSelection(insertAtPos + 1) // Move cursor into the new block
      .run()

    onClose()
  }

  return (
    <div className="block-menu">
      {blockItems.map((item) => (
        <button
          key={item.title}
          className="block-menu-item"
          onClick={() => handleSelect(item)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="block-menu-icon">{item.icon}</span>
          <div className="block-menu-text">
            <span className="block-menu-title">{item.title}</span>
            <span className="block-menu-description">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

export default BlockMenu
