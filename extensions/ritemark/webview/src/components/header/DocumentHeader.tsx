import React from 'react'
import { FileText, Download } from 'lucide-react'
import { VoiceDictationButton } from '../VoiceDictationButton'

interface DocumentHeaderProps {
  onPropertiesClick: () => void
  onExportClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Sticky header at the top of the editor with Properties, Voice Dictation, and Export buttons
 *
 * Positioning: Sticky at top, z-index 60 (below bubble menus, above editor content)
 * Theme: Integrated with VS Code theme using CSS variables
 * Style: Ghost buttons (transparent, hover shows background)
 */
export function DocumentHeader({ onPropertiesClick, onExportClick }: DocumentHeaderProps) {
  return (
    <header className="document-header">
      <div className="header-content">
        {/* Properties button */}
        <button
          className="header-btn"
          onClick={onPropertiesClick}
          aria-label="Open properties"
          title="Properties"
        >
          <FileText size={16} />
          <span className="header-btn-text">Properties</span>
        </button>

        {/* Spacer to push Voice Dictation and Export to the right */}
        <div className="flex-1" />

        {/* Voice Dictation button */}
        <VoiceDictationButton />

        {/* Export button */}
        <button
          className="header-btn"
          onClick={(e) => onExportClick(e)}
          aria-label="Export document"
          title="Export"
        >
          <Download size={16} />
          <span className="header-btn-text">Export</span>
        </button>
      </div>

      <style>{`
        /* Document Header - Sticky at top */
        .document-header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: var(--vscode-editor-background);
          border-bottom: 1px solid var(--vscode-panel-border);
          z-index: 60;
        }

        .header-content {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 16px;
        }

        /* Ghost button style */
        .header-btn {
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

        .header-btn:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .header-btn:active {
          background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
        }

        /* Button text - hidden on narrow viewports */
        .header-btn-text {
          display: inline;
        }

        /* Responsive: hide text on narrow screens */
        @media (max-width: 500px) {
          .header-btn-text {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
