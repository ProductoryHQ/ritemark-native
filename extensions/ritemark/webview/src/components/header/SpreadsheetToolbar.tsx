import React from 'react'
import { ArrowUpRight, ChevronDown, Table2, Grid3X3, RotateCw } from 'lucide-react'

interface SpreadsheetToolbarProps {
  filename: string
  onOpenInExcel?: () => void
  onOpenInNumbers?: () => void
  hasExcel: boolean
  onRefresh?: () => void
  refreshDisabled?: boolean
  hasFileChanged?: boolean // Show badge when file changed externally
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
  onRefresh,
  refreshDisabled = false,
  hasFileChanged = false,
}: SpreadsheetToolbarProps) {
  const [showDropdown, setShowDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Determine primary and secondary actions based on Excel availability
  const primaryAction = hasExcel && onOpenInExcel ? onOpenInExcel : onOpenInNumbers
  const primaryLabel = hasExcel && onOpenInExcel ? 'Open in Excel' : 'Open in Numbers'
  const secondaryAction = hasExcel && onOpenInExcel ? onOpenInNumbers : onOpenInExcel
  const secondaryLabel = hasExcel && onOpenInExcel ? 'Open in Numbers' : 'Open in Excel'
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

        {/* Refresh button - only shows when file changed externally (same as DocumentHeader) */}
        {hasFileChanged && onRefresh && (
          <button
            className="refresh-button has-changes"
            onClick={onRefresh}
            disabled={refreshDisabled}
            aria-label="File changed on disk - click to refresh"
            title="File changed on disk - click to reload"
          >
            <RotateCw size={16} />
            <span className="refresh-text">Refresh</span>
            <span className="refresh-badge" />
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
              <ArrowUpRight size={16} />
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
                <ChevronDown size={14} />
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
                {secondaryLabel.includes('Excel') ? <Table2 size={14} /> : <Grid3X3 size={14} />}
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
          border-bottom: 1px solid var(--vscode-panel-border);
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
          color: var(--vscode-descriptionForeground);
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
          color: var(--vscode-foreground);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          background: var(--vscode-toolbar-hoverBackground);
        }

        .split-btn-primary:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
        }

        /* Dropdown toggle */
        .split-btn-dropdown {
          padding: 6px 6px;
          border-left: 1px solid var(--vscode-panel-border);
          border-radius: 0 6px 6px 0;
        }

        .split-btn-dropdown:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .split-btn-dropdown:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          color: var(--vscode-foreground);
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .refresh-button:hover:not(:disabled) {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .refresh-button.has-changes {
          color: var(--vscode-notificationsInfoIcon-foreground, #3794ff);
        }

        .refresh-text {
          display: inline;
        }

        @media (max-width: 500px) {
          .refresh-text { display: none; }
        }

        .refresh-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 8px;
          height: 8px;
          background: var(--vscode-notificationsInfoIcon-foreground, #3794ff);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </header>
  )
}
