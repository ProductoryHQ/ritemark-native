import type React from 'react'
import { useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { scrollToHeading, setHeadingLevel } from '../lib/headingUtils'
import type { Heading, HeadingLevel } from '../lib/headingUtils'
import { isMac } from '../hooks/usePlatform'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from './ui/context-menu'

export const INLINE_TOC_WIDTH = 232

interface Props {
  editor: Editor
  headings: Heading[]
  activeHeadingPos: number | null
}

/**
 * Ritemark 2.0: the outline is a quiet list on the desk, in the frame's own list language: rows 28
 * high with radius 6, inset 8 from the desk's edges, 12 more per heading level, the current heading
 * an indigo-soft fill (never a band, never a line), a soft hover. Colours from the theme's tokens.
 */
function indentForLevel(level: number): number {
  return 8 + Math.min(Math.max(level, 1) - 1, 3) * 12
}

const SHORTCUT_LABEL = isMac ? '⌥⌘' : 'Ctrl+Alt+'

export function InlineTableOfContents({ editor, headings, activeHeadingPos }: Props) {
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([])

  const handleHeadingLevel = useCallback(
    (pos: number, level: HeadingLevel) => {
      setHeadingLevel(editor, pos, level)
    },
    [editor]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, pos: number) => {
      // Sprint 72 R4/R5: Cmd/Ctrl+Alt+1-6 changes the heading level of the
      // focused TOC row without leaving the row.
      if (event.altKey && (isMac ? event.metaKey : event.ctrlKey)) {
        const digit = event.key
        if (digit >= '1' && digit <= '6') {
          event.preventDefault()
          const level = Number(digit) as HeadingLevel
          setHeadingLevel(editor, pos, level)
        }
      }
    },
    [editor]
  )

  if (headings.length < 2) return null

  return (
    <nav aria-label="Table of contents" className="inline-toc" style={{ width: INLINE_TOC_WIDTH }}>
      <style>{`
        .inline-toc {
          flex-shrink: 0;
          position: sticky;
          top: 0;
          align-self: flex-start;
          height: 100vh;
          overflow-y: auto;
          box-sizing: border-box;
          /* the outline hangs from its button in the document's bar: 8 below the bar, rows from the
             button's edge (4), text on the icon's edge (12) */
          padding: 8px 8px 16px 4px;
          background: transparent;
          font-family: var(--ritemark-ui-font-family);
        }
        .inline-toc-head {
          padding: 6px 8px 6px;
          font-size: 11px;
          line-height: 14px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--r-ink-muted);
        }
        .inline-toc-item {
          display: flex;
          align-items: center;
          width: 100%;
          height: 28px;
          margin: 1px 0;
          padding: 0 8px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          text-align: left;
          font: inherit;
          font-size: 13px;
          line-height: 28px;
          color: var(--r-ink-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          transition: background-color 0.1s, color 0.1s;
        }
        .inline-toc-item > span {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .inline-toc-item[data-level='1'] {
          color: var(--r-ink-strong);
          font-weight: 500;
        }
        .inline-toc-item:hover {
          background: rgba(15, 23, 42, 0.05);
          color: var(--r-ink-strong);
        }
        .inline-toc-item[aria-current='true'] {
          background: var(--r-accent-soft);
          color: var(--r-ink-strong);
          font-weight: 600;
        }
        :where(:root:not([data-input-mode="pointer"])) .inline-toc-item:focus-visible {
          outline: 2px solid var(--r-accent);
          outline-offset: -2px;
        }
        body.vscode-dark .inline-toc-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .inline-toc::-webkit-scrollbar {
          width: 8px;
        }
        .inline-toc::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
          transition: background-color 0.15s;
        }
        .inline-toc:hover::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, rgba(100, 100, 100, 0.4));
        }
        .inline-toc::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.6));
        }
        .inline-toc::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <div className="inline-toc-head">Contents</div>
      {headings.map((heading, i) => {
        const isActive = heading.pos === activeHeadingPos
        return (
          <ContextMenu key={`${heading.pos}-${i}`}>
            <ContextMenuTrigger asChild>
              <button
                ref={(el) => {
                  itemsRef.current[i] = el
                }}
                className="inline-toc-item"
                data-level={heading.level}
                aria-current={isActive ? 'true' : undefined}
                title={heading.text}
                onClick={() => scrollToHeading(editor, heading.pos)}
                onKeyDown={(event) => handleKeyDown(event, heading.pos)}
                style={{ paddingLeft: indentForLevel(heading.level) }}
              >
                <span>{heading.text}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel>Change heading level</ContextMenuLabel>
              <ContextMenuSeparator />
              {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((level) => {
                const isCurrent = heading.level === level
                return (
                  <ContextMenuItem
                    key={level}
                    disabled={isCurrent}
                    onSelect={() => handleHeadingLevel(heading.pos, level)}
                  >
                    <span>H{level}</span>
                    <ContextMenuShortcut>
                      {`${SHORTCUT_LABEL}${level}`}
                    </ContextMenuShortcut>
                  </ContextMenuItem>
                )
              })}
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </nav>
  )
}
