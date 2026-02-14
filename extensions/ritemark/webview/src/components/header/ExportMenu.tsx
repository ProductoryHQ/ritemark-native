import { useEffect, useRef, useCallback, useState } from 'react'
import { FileText, FileType, Clipboard, Check } from 'lucide-react'

interface ExportMenuProps {
  isOpen: boolean
  onClose: () => void
  onExportPDF: (templateId?: string) => void
  onExportWord: (templateId?: string) => void
  onCopyAsMarkdown: () => void
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
  onCopyAsMarkdown,
  anchorElement,
}: ExportMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

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

  const handleExportPDF = useCallback((templateId = 'default') => {
    onExportPDF(templateId)
    onClose()
  }, [onExportPDF, onClose])

  const handleExportWord = useCallback((templateId = 'default') => {
    onExportWord(templateId)
    onClose()
  }, [onExportWord, onClose])

  const handleCopyAsMarkdown = useCallback(async () => {
    await onCopyAsMarkdown()
    setCopied(true)
    // Reset copied state after 2 seconds
    setTimeout(() => setCopied(false), 2000)
  }, [onCopyAsMarkdown])

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
        <button className="export-menu-item" onClick={() => handleExportPDF('clean')}>
          <FileText size={16} className="export-menu-icon" />
          <span>Export PDF</span>
        </button>
        <button className="export-menu-item" onClick={() => handleExportWord('clean')}>
          <FileType size={16} className="export-menu-icon" />
          <span>Export Word</span>
        </button>

        <div className="export-menu-divider" />

        <button
          className={`export-menu-item ${copied ? 'export-menu-item-success' : ''}`}
          onClick={handleCopyAsMarkdown}
        >
          {copied ? (
            <>
              <Check size={16} className="export-menu-icon" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard size={16} className="export-menu-icon" />
              <span>Copy as Markdown</span>
            </>
          )}
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
          font-family: var(--ritemark-ui-font-family);
          text-align: left;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .export-menu-divider {
          height: 1px;
          background: var(--vscode-menu-border);
          margin: 4px 0;
        }

        .export-menu-item:hover {
          background: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }

        .export-menu-item:active {
          opacity: 0.8;
        }

        /* Success state for copy feedback */
        .export-menu-item-success {
          color: #4ade80 !important;
        }

        .export-menu-item-success:hover {
          color: #4ade80 !important;
        }

        .export-menu-icon {
          flex-shrink: 0;
        }
      `}</style>
    </>
  )
}
