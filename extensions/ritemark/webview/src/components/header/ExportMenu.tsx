import { useEffect, useRef, useCallback, useState } from 'react'
import { Icon } from '../ui/Icon'
import { googleDocsMenuItems, type GoogleDocsAction, type GoogleDocsProjection } from './googleDocsMenu'

interface ExportMenuProps {
  isOpen: boolean
  onClose: () => void
  onExportPDF: (templateId?: string) => void
  onExportWord: (templateId?: string) => void
  onCopyAsMarkdown: () => void
  anchorElement: HTMLElement | null
  /** Host projection for Google Docs publishing; null hides the section. */
  googleDocs?: GoogleDocsProjection | null
  onGoogleDocsAction?: (action: GoogleDocsAction) => void
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
  googleDocs = null,
  onGoogleDocsAction,
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

  const googleDocsItems = onGoogleDocsAction ? googleDocsMenuItems(googleDocs) : []

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
          <Icon name="file-text" size={16} className="export-menu-icon" />
          <span>Export PDF</span>
        </button>
        <button className="export-menu-item" onClick={() => handleExportWord('clean')}>
          <Icon name="file-doc" size={16} className="export-menu-icon" />
          <span>Export Word</span>
        </button>

        {googleDocsItems.length > 0 && (
          <>
            <div className="export-menu-divider" />
            {googleDocsItems.map((item) => (
              <button
                key={item.label}
                className="export-menu-item"
                disabled={item.disabled}
                title={item.description}
                aria-busy={item.icon === 'circle-notch' || undefined}
                onClick={() => {
                  if (!item.action || !onGoogleDocsAction) return
                  onGoogleDocsAction(item.action)
                  onClose()
                }}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  className={`export-menu-icon${item.icon === 'circle-notch' ? ' export-menu-spin' : ''}`}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </>
        )}

        <div className="export-menu-divider" />

        <button
          className={`export-menu-item ${copied ? 'export-menu-item-success' : ''}`}
          onClick={handleCopyAsMarkdown}
        >
          {copied ? (
            <>
              <Icon name="check" size={16} className="export-menu-icon" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Icon name="clipboard" size={16} className="export-menu-icon" />
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

        .export-menu-item:disabled,
        .export-menu-item:disabled:hover {
          cursor: default;
          background: transparent;
          color: var(--vscode-disabledForeground, var(--vscode-menu-foreground));
          opacity: 1;
        }

        .export-menu-item span {
          white-space: nowrap;
        }

        .export-menu-spin {
          animation: export-menu-spin 1s linear infinite;
        }

        @keyframes export-menu-spin {
          to { transform: rotate(360deg); }
        }

        /* Success state for copy feedback */
        .export-menu-item-success {
          color: var(--r-success) !important;
        }

        .export-menu-item-success:hover {
          color: var(--r-success) !important;
        }

        .export-menu-icon {
          flex-shrink: 0;
        }
      `}</style>
    </>
  )
}
