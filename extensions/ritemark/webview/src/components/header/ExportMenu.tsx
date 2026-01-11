import { useEffect, useRef, useCallback, useState } from 'react'
import { FileText, FileType } from 'lucide-react'

interface ExportMenuProps {
  isOpen: boolean
  onClose: () => void
  onExportPDF: () => void
  onExportWord: () => void
  anchorElement: HTMLElement | null
}

/**
 * Dropdown menu for export options
 *
 * Features:
 * - Positioned below Export button, right-aligned
 * - Click outside closes menu
 * - ESC key closes menu
 * - Menu item click triggers export and closes menu
 *
 * Z-index: 100 (below bubble menu 200, above header 60)
 */
export function ExportMenu({
  isOpen,
  onClose,
  onExportPDF,
  onExportWord,
  anchorElement,
}: ExportMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside menu AND not on anchor button
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorElement &&
        !anchorElement.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    // Use capture phase to catch clicks before they reach other handlers
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [isOpen, onClose, anchorElement])

  // Calculate position relative to anchor
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!isOpen || !anchorElement) return

    const updatePosition = () => {
      const anchorRect = anchorElement.getBoundingClientRect()
      setPosition({
        top: anchorRect.bottom + 4, // 4px gap below button
        left: anchorRect.right, // Right-aligned with button
      })
    }

    updatePosition()

    // Update position on scroll/resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, anchorElement])

  const handleExportPDF = useCallback(() => {
    onExportPDF()
    onClose()
  }, [onExportPDF, onClose])

  const handleExportWord = useCallback(() => {
    onExportWord()
    onClose()
  }, [onExportWord, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        ref={menuRef}
        className="export-menu"
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-100%)', // Right-align with button
        }}
      >
        {/* Export PDF */}
        <button className="export-menu-item" onClick={handleExportPDF}>
          <FileText size={16} className="export-menu-icon" />
          <span>Export PDF</span>
        </button>

        {/* Export Word */}
        <button className="export-menu-item" onClick={handleExportWord}>
          <FileType size={16} className="export-menu-icon" />
          <span>Export Word</span>
        </button>
      </div>

      <style>{`
        /* Dropdown menu container */
        .export-menu {
          min-width: 160px;
          background: var(--vscode-menu-background);
          border: 1px solid var(--vscode-menu-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          overflow: hidden;
          animation: export-menu-fade-in 100ms ease-out;
        }

        @keyframes export-menu-fade-in {
          from {
            opacity: 0;
            transform: translateX(-100%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-100%) translateY(0);
          }
        }

        /* Menu item button */
        .export-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--vscode-menu-foreground);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .export-menu-item:hover {
          background: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }

        .export-menu-item:active {
          opacity: 0.8;
        }

        .export-menu-icon {
          flex-shrink: 0;
        }
      `}</style>
    </>
  )
}
