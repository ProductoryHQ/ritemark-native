/**
 * Reusable Dialog Component
 *
 * Shared modal dialog with consistent styling across the app.
 * Used by: DictationSettingsModal, ResizableImage confirmation, etc.
 */

import React, { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number | string
}

export function Dialog({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  width = 400
}: DialogProps) {
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

  // Handle click outside modal
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="dialog-backdrop" onClick={handleBackdropClick}>
        {/* Modal container */}
        <div
          className="dialog-modal"
          style={{ width: typeof width === 'number' ? `${width}px` : width }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="dialog-header">
            <div className="dialog-header-left">
              {icon}
              <h2 className="dialog-title">{title}</h2>
            </div>
            <button
              className="dialog-close"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="dialog-content">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="dialog-footer">
              {footer}
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Backdrop */
        .dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: dialog-fade-in 150ms ease-out;
        }

        @keyframes dialog-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal */
        .dialog-modal {
          position: relative;
          max-width: 90vw;
          max-height: 80vh;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          animation: dialog-scale-in 150ms ease-out;
        }

        @keyframes dialog-scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Header */
        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .dialog-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--vscode-descriptionForeground);
        }

        .dialog-header-left svg {
          flex-shrink: 0;
          opacity: 0.6;
        }

        .dialog-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .dialog-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--vscode-descriptionForeground);
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
        }

        .dialog-close:hover {
          background: var(--vscode-toolbar-hoverBackground);
          color: var(--vscode-foreground);
        }

        /* Content */
        .dialog-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        /* Footer */
        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }

        /* Button styles for use in dialogs */
        .dialog-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dialog-btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .dialog-btn-primary:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .dialog-btn-secondary {
          background: var(--vscode-button-secondaryBackground, #3a3d41);
          color: var(--vscode-button-secondaryForeground, #fff);
        }

        .dialog-btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground, #45494e);
        }

        .dialog-btn-danger {
          background: var(--vscode-errorForeground, #ef4444);
          color: white;
        }

        .dialog-btn-danger:hover {
          opacity: 0.9;
        }
      `}</style>
    </>
  )
}

export default Dialog
