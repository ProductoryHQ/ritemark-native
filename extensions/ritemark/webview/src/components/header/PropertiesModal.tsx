import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { PropertiesPanel, type DocumentProperties } from '../properties'

interface PropertiesModalProps {
  isOpen: boolean
  onClose: () => void
  properties: DocumentProperties
  onPropertiesChange: (properties: DocumentProperties) => void
}

/**
 * Modal overlay for document properties
 *
 * Features:
 * - Center positioning with backdrop
 * - ESC key closes modal
 * - Click outside closes modal
 * - X button in header closes modal
 * - Contains PropertiesPanel component
 *
 * Z-index: 1000 (modal), 999 (backdrop)
 */
export function PropertiesModal({
  isOpen,
  onClose,
  properties,
  onPropertiesChange,
}: PropertiesModalProps) {
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
      // Only close if clicking the backdrop itself, not modal content
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
      <div className="properties-modal-backdrop" onClick={handleBackdropClick}>
        {/* Modal container */}
        <div className="properties-modal" onClick={(e) => e.stopPropagation()}>
          {/* Modal header */}
          <div className="properties-modal-header">
            <h2 className="properties-modal-title">Properties</h2>
            <button
              className="properties-modal-close"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal content - PropertiesPanel */}
          <div className="properties-modal-content">
            <PropertiesPanel
              properties={properties}
              hasProperties={Object.keys(properties).length > 0}
              onChange={onPropertiesChange}
            />
          </div>
        </div>
      </div>

      <style>{`
        /* Backdrop - covers entire viewport */
        .properties-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: modal-fade-in 150ms ease-out;
        }

        @keyframes modal-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Modal container */
        .properties-modal {
          position: relative;
          width: 400px;
          max-width: 90vw;
          max-height: 80vh;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modal-scale-in 150ms ease-out;
        }

        @keyframes modal-scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Modal header */
        .properties-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
          flex-shrink: 0;
        }

        .properties-modal-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin: 0;
        }

        .properties-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--vscode-foreground);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .properties-modal-close:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .properties-modal-close:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
        }

        /* Modal content - scrollable */
        .properties-modal-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Responsive adjustments */
        @media (max-width: 500px) {
          .properties-modal {
            width: 90vw;
            max-height: 90vh;
          }
        }
      `}</style>
    </>
  )
}
