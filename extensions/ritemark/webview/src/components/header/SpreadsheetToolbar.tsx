import React from 'react'
import { Icon } from '../ui/Icon'
import { defaultSpreadsheetApp, isMac } from '../../hooks/usePlatform'
import type { DocumentSyncAction } from './DocumentSyncAction'

interface SpreadsheetToolbarProps {
  filename: string
  onOpenInExcel?: () => void
  onOpenInNumbers?: () => void
  hasExcel: boolean
  syncAction?: DocumentSyncAction
}

/**
 * Toolbar for spreadsheet files (Excel/CSV) with external app integration
 *
 * Features:
 * - Split button: Primary action (Excel if installed, otherwise Numbers) + dropdown for alternative
 * - Ghost button style matching DocumentHeader
 *
 * Positioning: Sticky at top, z-index 60 (consistent with DocumentHeader)
 * Theme: Integrated with VS Code theme using CSS variables
 */
export function SpreadsheetToolbar({
  filename,
  onOpenInExcel,
  onOpenInNumbers,
  hasExcel,
  syncAction,
}: SpreadsheetToolbarProps) {
  const [showDropdown, setShowDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Determine primary and secondary actions based on Excel availability
  const altAppLabel = `Open in ${defaultSpreadsheetApp}`
  const primaryAction = hasExcel && onOpenInExcel ? onOpenInExcel : onOpenInNumbers
  const primaryLabel = hasExcel && onOpenInExcel ? 'Open in Excel' : altAppLabel
  // On Windows, "Open in Spreadsheet App" is the same as Excel — no point showing both
  const secondaryAction = hasExcel && onOpenInExcel
    ? (isMac ? onOpenInNumbers : undefined)
    : onOpenInExcel
  const secondaryLabel = hasExcel && onOpenInExcel ? altAppLabel : 'Open in Excel'
  const hasSecondary = !!secondaryAction

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  return (
    <header className="spreadsheet-toolbar">
      <div className="toolbar-content">
        {/* Filename on the left */}
        <div className="toolbar-filename">{filename}</div>

        {/* Spacer */}
        <div className="flex-1" />

        <span className="sr-only" role="status" aria-live="polite">
          {syncAction?.label ?? ''}
        </span>

        {/* Derived action: absent while the rendered document matches host state. */}
        {syncAction && (
          <button
            className={`refresh-button ${syncAction.kind}`}
            onClick={syncAction.onClick}
            aria-label={syncAction.label}
            title={syncAction.title ?? syncAction.label}
          >
            <Icon name={syncAction.kind === 'conflict' ? 'warning' : 'arrow-clockwise'} size={16} />
            <span className="refresh-text">{syncAction.label}</span>
          </button>
        )}

        {/* Right side: Split button */}
        <div className="split-button-container" ref={dropdownRef}>
          <div className="split-button">
            {/* Primary action */}
            <button
              className="split-btn-primary"
              onClick={primaryAction}
              aria-label={primaryLabel}
              title={primaryLabel}
            >
              <Icon name="arrow-up-right" size={16} />
              <span className="split-btn-text">{primaryLabel}</span>
            </button>

            {/* Dropdown toggle (only if there's a secondary option) */}
            {hasSecondary && (
              <button
                className="split-btn-dropdown"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="More options"
                title="More options"
              >
                <Icon name="caret-down" size={14} />
              </button>
            )}
          </div>

          {/* Dropdown menu */}
          {showDropdown && hasSecondary && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  secondaryAction?.()
                  setShowDropdown(false)
                }}
              >
                {/* Table2 for Excel, Grid3X3 for Numbers */}
                {secondaryLabel.includes('Excel') ? <Icon name="table" size={14} /> : <Icon name="grid-nine" size={14} />}
                <span>{secondaryLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Spreadsheet Toolbar - Sticky at top */
        .spreadsheet-toolbar {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: var(--vscode-editor-background);
          border-bottom: 1px solid var(--r-hairline);
          z-index: 60;
        }

        .toolbar-content {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 16px;
          gap: 12px;
        }

        /* Filename display */
        .toolbar-filename {
          font-size: 13px;
          color: var(--r-ink-muted);
          font-weight: 500;
        }

        /* Split button container */
        .split-button-container {
          position: relative;
        }

        /* Split button wrapper */
        .split-button {
          display: flex;
          align-items: stretch;
          border-radius: 6px;
          overflow: hidden;
        }

        /* Shared button styles */
        .split-btn-primary,
        .split-btn-dropdown {
          display: flex;
          align-items: center;
          border: none;
          background: transparent;
          color: var(--r-ink-strong);
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        /* Primary button */
        .split-btn-primary {
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px 0 0 6px;
        }

        .split-btn-primary:hover {
          background: var(--r-surface-soft);
        }

        .split-btn-primary:active {
          background: var(--r-surface-muted, var(--r-surface-soft));
        }

        /* Dropdown toggle */
        .split-btn-dropdown {
          padding: 6px 6px;
          border-left: 1px solid var(--r-hairline);
          border-radius: 0 6px 6px 0;
        }

        .split-btn-dropdown:hover {
          background: var(--r-surface-soft);
        }

        .split-btn-dropdown:active {
          background: var(--r-surface-muted, var(--r-surface-soft));
        }

        /* When no secondary option, round all corners */
        .split-button:not(:has(.split-btn-dropdown)) .split-btn-primary {
          border-radius: 6px;
        }

        /* Button text - hidden on narrow viewports */
        .split-btn-text {
          display: inline;
          white-space: nowrap;
        }

        /* Responsive: hide text on narrow screens */
        @media (max-width: 500px) {
          .split-btn-text {
            display: none;
          }
        }

        /* Dropdown menu */
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 180px;
          background: var(--vscode-menu-background);
          border: 1px solid var(--vscode-menu-border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 4px;
          z-index: 1000;
        }

        /* Dropdown item */
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--vscode-menu-foreground);
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s ease;
        }

        .dropdown-item:hover {
          background: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }

        /* Refresh button - matches DocumentHeader style */
        .refresh-button {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--r-ink-strong);
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .refresh-button:hover:not(:disabled) {
          background: var(--r-surface-soft);
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .refresh-button.conflict {
          color: var(--r-warning);
        }

        .refresh-button.retry {
          color: var(--r-error);
        }

        .refresh-text {
          display: inline;
        }

        @media (max-width: 500px) {
          .refresh-text { display: none; }
        }

      `}</style>
    </header>
  )
}
