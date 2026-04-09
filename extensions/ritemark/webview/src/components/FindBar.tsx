import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { searchPluginKey } from '../extensions/SearchExtension'

interface FindBarProps {
  editor: TipTapEditor
  onClose: () => void
}

export function FindBar({ editor, onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Push query changes into the editor plugin
  useEffect(() => {
    editor.commands.setSearchTerm(query)
  }, [query, editor])

  // Pull plugin state (match count + active index) back into UI state on every transaction
  useEffect(() => {
    const sync = () => {
      const state = searchPluginKey.getState(editor.state)
      if (state) {
        setMatchCount(state.results.length)
        setActiveIndex(state.activeIndex)
      }
    }
    sync()
    editor.on('transaction', sync)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])

  // Scroll the active match into view
  useEffect(() => {
    if (activeIndex < 0 || matchCount === 0) return
    const state = searchPluginKey.getState(editor.state)
    const match = state?.results[activeIndex]
    if (!match) return

    try {
      const coords = editor.view.coordsAtPos(match.from)
      const scrollContainer = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const targetTop = coords.top - containerRect.top + scrollContainer.scrollTop - 100
        scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
      }
    } catch {
      // position no longer in viewport-resolvable state; ignore
    }
  }, [activeIndex, matchCount, editor])

  // Clear search state when the find bar unmounts
  useEffect(() => {
    return () => {
      editor.commands.clearSearch()
    }
  }, [editor])

  const goToNext = useCallback(() => {
    editor.commands.nextSearchResult()
  }, [editor])

  const goToPrev = useCallback(() => {
    editor.commands.previousSearchResult()
  }, [editor])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          goToPrev()
        } else {
          goToNext()
        }
      }
    },
    [onClose, goToNext, goToPrev]
  )

  return (
    <div className="find-bar">
      <div className="find-bar-inner">
        <Search size={14} className="find-bar-icon" />
        <input
          ref={inputRef}
          type="text"
          className="find-bar-input"
          placeholder="Find in document..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="find-bar-count">
          {query
            ? matchCount > 0
              ? `${activeIndex + 1} of ${matchCount}`
              : 'No results'
            : ''}
        </span>
        <button
          className="find-bar-btn"
          onClick={goToPrev}
          disabled={matchCount === 0}
          aria-label="Previous match"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="find-bar-btn"
          onClick={goToNext}
          disabled={matchCount === 0}
          aria-label="Next match"
          title="Next (Enter)"
        >
          <ChevronDown size={14} />
        </button>
        <button
          className="find-bar-btn"
          onClick={onClose}
          aria-label="Close search"
          title="Close (Escape)"
        >
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
      `}</style>
    </div>
  )
}
