import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import type { Editor as TipTapEditor } from '@tiptap/react'

interface FindBarProps {
  editor: TipTapEditor
  onClose: () => void
}

interface SearchMatch {
  from: number
  to: number
}

function findAllMatches(editor: TipTapEditor, query: string): SearchMatch[] {
  if (!query) return []

  const matches: SearchMatch[] = []
  const doc = editor.state.doc
  const lowerQuery = query.toLowerCase()

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase()
      let index = 0
      while ((index = text.indexOf(lowerQuery, index)) !== -1) {
        matches.push({ from: pos + index, to: pos + index + query.length })
        index += 1
      }
    }
  })

  return matches
}

export function FindBar({ editor, onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search on query change
  useEffect(() => {
    const found = findAllMatches(editor, query)
    setMatches(found)
    setActiveIndex(found.length > 0 ? 0 : -1)
  }, [query, editor])

  // Apply decorations and scroll to active match
  useEffect(() => {
    // Clear existing decorations
    const existingMarks = document.querySelectorAll('.find-highlight, .find-highlight-active')
    existingMarks.forEach(el => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    if (matches.length === 0 || !query) return

    // Apply highlights using DOM manipulation on the ProseMirror view
    // We use decorations via the editor view's DOM
    const view = editor.view
    matches.forEach((match, i) => {
      try {
        const startCoords = view.coordsAtPos(match.from)
        const endCoords = view.coordsAtPos(match.to)

        // Find the DOM range for this match
        const domStart = view.domAtPos(match.from)
        const domEnd = view.domAtPos(match.to)

        if (domStart.node && domEnd.node) {
          const range = document.createRange()
          range.setStart(domStart.node, domStart.offset)
          range.setEnd(domEnd.node, domEnd.offset)

          const span = document.createElement('span')
          span.className = i === activeIndex ? 'find-highlight-active' : 'find-highlight'
          range.surroundContents(span)

          // Scroll active match into view
          if (i === activeIndex) {
            span.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      } catch {
        // Skip matches that can't be highlighted (e.g., spanning across nodes)
      }
    })

    return () => {
      // Cleanup on unmount
      const marks = document.querySelectorAll('.find-highlight, .find-highlight-active')
      marks.forEach(el => {
        const parent = el.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el)
          parent.normalize()
        }
      })
    }
  }, [matches, activeIndex, query, editor])

  const goToNext = useCallback(() => {
    if (matches.length === 0) return
    setActiveIndex((prev) => (prev + 1) % matches.length)
  }, [matches.length])

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return
    setActiveIndex((prev) => (prev - 1 + matches.length) % matches.length)
  }, [matches.length])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrev()
      } else {
        goToNext()
      }
    }
  }, [onClose, goToNext, goToPrev])

  return (
    <div className="find-bar" onKeyDown={handleKeyDown}>
      <div className="find-bar-inner">
        <Search size={14} className="find-bar-icon" />
        <input
          ref={inputRef}
          type="text"
          className="find-bar-input"
          placeholder="Find in document..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="find-bar-count">
          {query ? (matches.length > 0 ? `${activeIndex + 1} of ${matches.length}` : 'No results') : ''}
        </span>
        <button className="find-bar-btn" onClick={goToPrev} disabled={matches.length === 0} aria-label="Previous match" title="Previous (Shift+Enter)">
          <ChevronUp size={14} />
        </button>
        <button className="find-bar-btn" onClick={goToNext} disabled={matches.length === 0} aria-label="Next match" title="Next (Enter)">
          <ChevronDown size={14} />
        </button>
        <button className="find-bar-btn" onClick={onClose} aria-label="Close search" title="Close (Escape)">
          <X size={14} />
        </button>
      </div>

      <style>{`
        .find-bar {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 70;
          padding: 8px;
          animation: findBarSlideIn 0.15s ease-out;
        }

        @keyframes findBarSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-100%); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .find-bar-inner {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 320px;
          max-width: 400px;
        }

        .find-bar-icon {
          color: var(--vscode-descriptionForeground);
          flex-shrink: 0;
        }

        .find-bar-input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--vscode-foreground);
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          outline: none;
          min-width: 0;
          padding: 2px 4px;
        }

        .find-bar-input::placeholder {
          color: var(--vscode-descriptionForeground);
        }

        .find-bar-count {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          white-space: nowrap;
          flex-shrink: 0;
          min-width: 60px;
          text-align: center;
        }

        .find-bar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--vscode-foreground);
          cursor: pointer;
          flex-shrink: 0;
          transition: background-color 0.1s;
        }

        .find-bar-btn:hover:not(:disabled) {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .find-bar-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        /* Search highlight styles */
        .find-highlight {
          background: rgba(255, 200, 0, 0.25);
          border-radius: 2px;
        }

        .find-highlight-active {
          background: rgba(255, 180, 0, 0.55);
          border-radius: 2px;
        }
      `}</style>
    </div>
  )
}
