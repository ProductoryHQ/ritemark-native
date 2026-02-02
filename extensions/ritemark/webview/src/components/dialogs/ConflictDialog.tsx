import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConflictDialogProps {
  isOpen: boolean
  filename: string
  onDiscard: () => void
  onCancel: () => void
  isDiskConflict?: boolean
}

/**
 * Conflict Dialog - Warn user about unsaved changes before refresh
 *
 * Two variants:
 * 1. True conflict (isDiskConflict=true): Both local and disk changes
 * 2. Simple discard (isDiskConflict=false): Only local changes
 */
export function ConflictDialog({
  isOpen,
  filename,
  onDiscard,
  onCancel,
  isDiskConflict = false,
}: ConflictDialogProps) {
  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="conflict-overlay">
      <div className="conflict-dialog">
        {/* Header with warning icon */}
        <div className="conflict-header">
          <AlertTriangle
            size={24}
            className="conflict-icon"
            style={{ color: 'var(--vscode-editorWarning-foreground)' }}
          />
          <h2 className="conflict-title">
            {isDiskConflict ? 'Unsaved Changes Conflict' : 'Unsaved Changes'}
          </h2>
        </div>

        {/* Message content */}
        <div className="conflict-body">
          {isDiskConflict ? (
            <>
              <p>You have unsaved edits in Ritemark.</p>
              <p>
                The file <strong>{filename}</strong> has also been modified on disk by
                another program.
              </p>
              <p>Refreshing will discard your changes and load the version from disk.</p>
            </>
          ) : (
            <>
              <p>You have unsaved changes.</p>
              <p>Refreshing will discard them.</p>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="conflict-actions">
          <button className="btn-destructive" onClick={onDiscard}>
            {isDiskConflict ? 'Discard My Changes' : 'Discard & Refresh'}
          </button>
          <button className="btn-secondary" onClick={onCancel}>
            {isDiskConflict ? 'Keep Editing' : 'Cancel'}
          </button>
        </div>
      </div>

      <style>{`
        /* Modal overlay with blur */
        .conflict-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Dialog card */
        .conflict-dialog {
          background: var(--vscode-editorWidget-background);
          border: 1px solid var(--vscode-editorWidget-border);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          max-width: 480px;
          width: 90%;
          padding: 24px;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Header */
        .conflict-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .conflict-icon {
          flex-shrink: 0;
        }

        .conflict-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin: 0;
        }

        /* Body */
        .conflict-body {
          margin-bottom: 24px;
          color: var(--vscode-descriptionForeground);
          font-size: 14px;
          line-height: 1.6;
        }

        .conflict-body p {
          margin: 0 0 12px 0;
        }

        .conflict-body p:last-child {
          margin-bottom: 0;
        }

        .conflict-body strong {
          color: var(--vscode-foreground);
          font-weight: 600;
        }

        /* Actions */
        .conflict-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        /* Button base styles */
        .btn-destructive,
        .btn-secondary {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }

        /* Destructive button (Discard) */
        .btn-destructive {
          background: var(--vscode-inputValidation-errorBackground);
          color: var(--vscode-inputValidation-errorForeground);
        }

        .btn-destructive:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-destructive:active {
          transform: translateY(0);
        }

        /* Secondary button (Cancel) */
        .btn-secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-secondary:active {
          opacity: 0.9;
        }

        /* Focus styles for accessibility */
        .btn-destructive:focus-visible,
        .btn-secondary:focus-visible {
          outline: 2px solid var(--vscode-focusBorder);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
