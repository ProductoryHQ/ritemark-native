/**
 * DragHandleWithMenu Component
 *
 * Provides a drag handle with an adjacent + button that opens a block insertion menu.
 * Uses tiptap-extension-global-drag-handle for the drag functionality.
 *
 * @see Sprint 14: Block Interactions
 */

import { useState, useEffect, useRef } from 'react'
import { type Editor as TipTapEditor } from '@tiptap/react'
import { GripVertical, Plus } from 'lucide-react'
import { BlockMenu } from './BlockMenu'

interface DragHandleWithMenuProps {
  editor: TipTapEditor | null
}

export function DragHandleWithMenu({ editor }: DragHandleWithMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showMenu])

  const handlePlusClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Position menu near the + button
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
    })
    setShowMenu(!showMenu)
  }

  if (!editor) return null

  return (
    <>
      {/* Plus button - positioned by CSS relative to drag-handle */}
      <button
        ref={buttonRef}
        className="block-plus-btn"
        onClick={handlePlusClick}
        onMouseDown={(e) => e.preventDefault()}
        title="Add block"
        aria-label="Add block"
      >
        <Plus size={16} />
      </button>

      {/* Block insertion menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="block-menu-container"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 100,
          }}
        >
          <BlockMenu editor={editor} onClose={() => setShowMenu(false)} />
        </div>
      )}
    </>
  )
}

export default DragHandleWithMenu
