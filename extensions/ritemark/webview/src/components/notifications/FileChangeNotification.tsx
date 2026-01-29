import React, { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'

interface FileChangeNotificationProps {
  isVisible: boolean
  filename: string
  isDirty: boolean
  onRefreshNow: () => void
  onDismiss: () => void
}

/**
 * File Change Notification Banner
 *
 * Appears at the top of the spreadsheet when file changes are detected externally.
 * Two variants based on dirty state:
 * 1. Not dirty: "File changed on disk. [Refresh Now] [Dismiss]" - auto-dismiss after 10s
 * 2. Dirty: "File changed on disk. You have unsaved changes. [Review]" - stays visible
 */
export function FileChangeNotification({
  isVisible,
  filename,
  isDirty,
  onRefreshNow,
  onDismiss,
}: FileChangeNotificationProps) {
  const [countdown, setCountdown] = useState(10)

  // Auto-dismiss after 10s if not dirty
  useEffect(() => {
    if (!isVisible || isDirty) {
      return
    }

    setCountdown(10)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onDismiss()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, isDirty, onDismiss])

  if (!isVisible) return null

  return (
    <div className="file-change-banner">
      <div className="banner-content">
        <FileText size={16} className="banner-icon" />
        <div className="banner-text">
          <strong>{filename}</strong> changed on disk.
          {isDirty && <span className="warning-text"> You have unsaved changes.</span>}
        </div>
      </div>

      <div className="banner-actions">
        {isDirty ? (
          <button className="btn-review" onClick={onRefreshNow}>
            Review
          </button>
        ) : (
          <>
            <button className="btn-refresh" onClick={onRefreshNow}>
              Refresh Now
            </button>
            <span className="countdown-text">({countdown}s)</span>
          </>
        )}
        <button className="btn-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>

      <style>{`
        /* Banner container - flex item at top of layout */
        .file-change-banner {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--vscode-editorInfo-background);
          border-bottom: 1px solid var(--vscode-editorInfo-border, var(--vscode-panel-border));
          z-index: 50;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Banner content (left side) */
        .banner-content {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .banner-icon {
          flex-shrink: 0;
          color: var(--vscode-editorInfo-foreground);
        }

        .banner-text {
          font-size: 13px;
          color: var(--vscode-editorInfo-foreground);
          line-height: 1.4;
        }

        .banner-text strong {
          font-weight: 600;
        }

        .warning-text {
          color: var(--vscode-editorWarning-foreground);
          font-weight: 500;
        }

        /* Banner actions (right side) */
        .banner-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Button base styles */
        .btn-refresh,
        .btn-review,
        .btn-dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        /* Refresh Now button */
        .btn-refresh {
          padding: 6px 12px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .btn-refresh:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .btn-refresh:active {
          opacity: 0.9;
        }

        /* Review button (for dirty state) */
        .btn-review {
          padding: 6px 12px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .btn-review:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .btn-review:active {
          opacity: 0.9;
        }

        /* Dismiss button */
        .btn-dismiss {
          padding: 4px;
          background: transparent;
          color: var(--vscode-editorInfo-foreground);
        }

        .btn-dismiss:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .btn-dismiss:active {
          opacity: 0.8;
        }

        /* Countdown text */
        .countdown-text {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          opacity: 0.7;
        }

        /* Focus styles for accessibility */
        .btn-refresh:focus-visible,
        .btn-review:focus-visible,
        .btn-dismiss:focus-visible {
          outline: 2px solid var(--vscode-focusBorder);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
