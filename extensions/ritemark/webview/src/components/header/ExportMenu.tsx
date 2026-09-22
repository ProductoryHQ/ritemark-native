import { useEffect, useRef, useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
 * - Keyboard (Sprint 119): opening focuses the first item; Arrow keys, Home and
 *   End move between enabled items; Escape and Tab close the menu and return
 *   focus to the Export button. Without this the menu was mouse-only.
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

  const closeAndRestoreFocus = useCallback(() => {
    onClose()
    anchorElement?.focus()
  }, [onClose, anchorElement])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAndRestoreFocus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeAndRestoreFocus])

  // Keyboard navigation between the enabled items (a busy line is skipped).
  const enabledItems = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.export-menu-item:not(:disabled)') ?? []),
    [],
  )

  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => enabledItems()[0]?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen, enabledItems])

  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = enabledItems()
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const moveTo = (index: number) => {
      event.preventDefault()
      items[(index + items.length) % items.length].focus()
    }
    switch (event.key) {
      case 'ArrowDown': moveTo(current + 1); break
      case 'ArrowUp': moveTo(current < 0 ? items.length - 1 : current - 1); break
      case 'Home': moveTo(0); break
      case 'End': moveTo(items.length - 1); break
      case 'Tab':
        event.preventDefault()
        closeAndRestoreFocus()
        break
    }
  }, [enabledItems, closeAndRestoreFocus])

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
    closeAndRestoreFocus()
  }, [onExportPDF, closeAndRestoreFocus])

  const handleExportWord = useCallback((templateId = 'default') => {
    onExportWord(templateId)
    closeAndRestoreFocus()
  }, [onExportWord, closeAndRestoreFocus])

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
        role="menu"
        aria-label="Export"
        onKeyDown={handleMenuKeyDown}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-100%)', // Right-align with button
        }}
      >
        <button className="export-menu-item" role="menuitem" onClick={() => handleExportPDF('clean')}>
          <Icon name="file-text" size={16} className="export-menu-icon" />
          <span>Export PDF</span>
        </button>
        <button className="export-menu-item" role="menuitem" onClick={() => handleExportWord('clean')}>
          <Icon name="file-doc" size={16} className="export-menu-icon" />
          <span>Export Word</span>
        </button>

        {googleDocsItems.length > 0 && (
          <>
            <div className="export-menu-divider" role="separator" />
            {googleDocsItems.map((item) => (
              <button
                key={item.label}
                className="export-menu-item"
                role="menuitem"
                disabled={item.disabled}
                title={item.description}
                aria-busy={item.icon === 'circle-notch' || undefined}
                onClick={() => {
                  if (!item.action || !onGoogleDocsAction) return
                  onGoogleDocsAction(item.action)
                  closeAndRestoreFocus()
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

        <div className="export-menu-divider" role="separator" />

        <button
          className={`export-menu-item ${copied ? 'export-menu-item-success' : ''}`}
          role="menuitem"
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

        .export-menu-item:focus-visible {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
          background: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }

        /* An icon always takes its row's text colour when the row is
           highlighted (Icon's muted default is a fill attribute, which CSS
           overrides). */
        .export-menu-item:hover:not(:disabled) svg,
        .export-menu-item:focus-visible svg {
          fill: currentColor;
          color: currentColor;
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
