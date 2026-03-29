import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'

interface Heading {
  level: number
  text: string
  pos: number
}

interface TableOfContentsProps {
  editor: TipTapEditor
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

function getHeadings(editor: TipTapEditor): Heading[] {
  const headings: Heading[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      })
    }
  })
  return headings
}

export function TableOfContents({ editor, anchorRef, onClose }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>(() => getHeadings(editor))
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Update headings on editor changes (debounced)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        setHeadings(getHeadings(editor))
      }, 300)
    }
    editor.on('update', update)
    return () => {
      clearTimeout(timeout)
      editor.off('update', update)
    }
  }, [editor])

  // Position the dropdown below the anchor button
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
  }, [anchorRef])

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, anchorRef])

  const handleHeadingClick = useCallback((pos: number) => {
    editor.chain().focus().setTextSelection(pos).run()

    // Scroll the heading into view
    const view = editor.view
    try {
      const coords = view.coordsAtPos(pos)
      const editorScrollContainer = view.dom.closest('.overflow-y-auto')
      if (editorScrollContainer) {
        const containerRect = editorScrollContainer.getBoundingClientRect()
        const scrollTop = editorScrollContainer.scrollTop
        const targetTop = coords.top - containerRect.top + scrollTop - 80 // offset for header
        editorScrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
      }
    } catch {
      // Fallback
      const domAtPos = view.domAtPos(pos)
      if (domAtPos.node instanceof HTMLElement) {
        domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    onClose()
  }, [editor, onClose])

  return (
    <div
      ref={panelRef}
      className="toc-dropdown"
      style={{ top: position.top, left: position.left }}
    >
      {headings.length === 0 ? (
        <div className="toc-empty">
          No headings yet. Start a line with # to create one.
        </div>
      ) : (
        <div className="toc-list">
          {headings.map((heading, i) => (
            <button
              key={`${heading.pos}-${i}`}
              className={`toc-item toc-item-h${heading.level}`}
              onClick={() => handleHeadingClick(heading.pos)}
              title={heading.text}
            >
              <span className="toc-item-text">{heading.text}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .toc-dropdown {
          position: fixed;
          z-index: 70;
          width: 260px;
          max-height: 320px;
          overflow-y: auto;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          padding: 4px;
          animation: tocFadeIn 0.15s ease-out;
        }

        @keyframes tocFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .toc-empty {
          padding: 16px 12px;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          text-align: center;
          font-style: italic;
        }

        .toc-list {
          display: flex;
          flex-direction: column;
        }

        .toc-item {
          display: block;
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.1s;
          font-family: var(--ritemark-ui-font-family);
        }

        .toc-item:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .toc-item-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* H1 - prominent */
        .toc-item-h1 {
          color: var(--vscode-foreground);
          font-weight: 500;
          font-size: 13px;
          padding-left: 10px;
        }

        /* H2 - muted, indented */
        .toc-item-h2 {
          color: var(--vscode-descriptionForeground);
          font-weight: 400;
          font-size: 12px;
          padding-left: 22px;
        }

        /* H3 - more muted, more indented, italic */
        .toc-item-h3 {
          color: var(--vscode-descriptionForeground);
          font-weight: 400;
          font-size: 12px;
          font-style: italic;
          padding-left: 34px;
          opacity: 0.8;
        }

        /* H4-H6 - deepest indent */
        .toc-item-h4, .toc-item-h5, .toc-item-h6 {
          color: var(--vscode-descriptionForeground);
          font-weight: 400;
          font-size: 11px;
          font-style: italic;
          padding-left: 46px;
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
