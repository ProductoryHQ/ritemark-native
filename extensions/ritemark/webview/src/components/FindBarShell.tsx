/**
 * The floating find bar — one look and one behaviour for every surface that
 * searches a document: the Markdown editor (FindBar.tsx drives it with TipTap)
 * and the Word preview (Sprint 124). Opened with Cmd/Ctrl+F; Enter and
 * Shift+Enter move between matches; Escape closes it.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from 'react'
import { Button } from './ui/button'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/tooltip'

export interface FindBarShellProps {
  query: string
  onQueryChange: (query: string) => void
  /** "3 of 12", "No matches", or '' for an empty query. */
  countLabel: string
  hasMatches: boolean
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
  placeholder?: string
}

export interface FindBarShellHandle {
  focus: () => void
}

export const FindBarShell = forwardRef<FindBarShellHandle, FindBarShellProps>(function FindBarShell(
  { query, onQueryChange, countLabel, hasMatches, onNext, onPrevious, onClose, placeholder = 'Find in document…' },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    },
  }))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (hasMatches) (event.shiftKey ? onPrevious : onNext)()
    }
  }

  return (
    <div className="find-bar" data-find-bar>
      <div className="find-bar-inner">
        <Icon name="magnifying-glass" size={14} className="find-bar-icon" />
        <input
          ref={inputRef}
          type="text"
          className="find-bar-input"
          placeholder={placeholder}
          aria-label="Find in document"
          spellCheck={false}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="find-bar-count" role="status" aria-live="polite">
          {countLabel}
        </span>
        <Tooltip label="Previous match (Shift+Enter)">
          <Button type="button" variant="ghost" size="icon-sm" className="size-6 rounded text-ink-strong" aria-label="Previous match" disabled={!hasMatches} onClick={onPrevious}>
            <Icon name="caret-up" size={14} tone="inherit" />
          </Button>
        </Tooltip>
        <Tooltip label="Next match (Enter)">
          <Button type="button" variant="ghost" size="icon-sm" className="size-6 rounded text-ink-strong" aria-label="Next match" disabled={!hasMatches} onClick={onNext}>
            <Icon name="caret-down" size={14} tone="inherit" />
          </Button>
        </Tooltip>
        <Tooltip label="Close (Escape)">
          <Button type="button" variant="ghost" size="icon-sm" className="size-6 rounded text-ink-strong" aria-label="Close find" onClick={onClose}>
            <Icon name="x" size={14} tone="inherit" />
          </Button>
        </Tooltip>
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
          border: 1px solid var(--r-hairline);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 320px;
          max-width: 400px;
        }

        .find-bar-icon {
          color: var(--r-ink-muted);
          flex-shrink: 0;
        }

        .find-bar-input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--r-ink-strong);
          font-size: 13px;
          font-family: var(--ritemark-ui-font-family);
          outline: none;
          min-width: 0;
          padding: 2px 4px;
        }

        .find-bar-input::placeholder {
          color: var(--r-ink-muted);
        }

        .find-bar-count {
          font-size: 11px;
          color: var(--r-ink-muted);
          white-space: nowrap;
          flex-shrink: 0;
          min-width: 60px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  )
})
