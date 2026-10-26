import { Button } from '../ui/button'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { SplitButton } from '../ui/split-button'
import { Tooltip } from '../ui/tooltip'
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
          <Tooltip label={syncAction.title ?? syncAction.label}>
            <button
              className={`refresh-button ${syncAction.kind}`}
              onClick={syncAction.onClick}
              aria-label={syncAction.label}
            >
              <Icon name={syncAction.kind === 'conflict' ? 'warning' : 'arrow-clockwise'} size={16} />
              <span className="refresh-text">{syncAction.label}</span>
            </button>
          </Tooltip>
        )}

        {/* Right side: Open in Excel (or the Mac's spreadsheet app), with the other app behind its caret. Sprint 142
            (R5d, #557): one button, in one tone (framework §3), with Ritemark's tooltips, not native ones. */}
        {hasSecondary ? (
          <SplitButton
            tone="quiet"
            className="spreadsheet-open"
            main={{
              label: <span className="split-btn-text">{primaryLabel}</span>,
              icon: <Icon name="arrow-up-right" size={16} tone="inherit" />,
              tooltip: `${primaryLabel}, to edit it there`,
              ariaLabel: primaryLabel,
              onClick: () => primaryAction?.(),
            }}
            menu={{
              label: 'Open in another app',
              tooltip: 'Open in another app',
              content: (
                <DropdownMenuItem onSelect={() => secondaryAction?.()}>
                  {/* Table for Excel, a grid for Numbers */}
                  {secondaryLabel.includes('Excel') ? <Icon name="table" size={14} tone="inherit" /> : <Icon name="grid-nine" size={14} tone="inherit" />}
                  <span>{secondaryLabel}</span>
                </DropdownMenuItem>
              ),
            }}
          />
        ) : (
          <Tooltip label={`${primaryLabel}, to edit it there`}>
            <Button type="button" variant="ghost" size="sm" className="spreadsheet-open" aria-label={primaryLabel} onClick={() => primaryAction?.()}>
              <Icon name="arrow-up-right" size={16} tone="inherit" />
              <span className="split-btn-text">{primaryLabel}</span>
            </Button>
          </Tooltip>
        )}
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
          z-index: 60; /* Ritemark 2.0: no line under the table's own bar */
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
