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

export const INLINE_TOC_WIDTH = 220

interface Props {
  editor: Editor
  headings: Heading[]
  activeHeadingPos: number | null
}

const leftPaddingForLevel: Record<number, number> = {
  1: 12,
  2: 22,
  3: 32,
}

function getPaddingLeft(level: number): number {
  return leftPaddingForLevel[level] ?? 42
}

const ACTIVE_COLOR = 'var(--r-accent)'

function getItemStyle(
  heading: Heading,
  isActive: boolean
): React.CSSProperties {
  const paddingLeft = getPaddingLeft(heading.level)

  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    // Active item uses the sidebar background as a subtle highlight; the
    // panel itself stays transparent so only the active item and hover state
    // tint the item background.
    background: isActive ? 'var(--vscode-sideBar-background)' : 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--ritemark-ui-font-family)',
    paddingTop: 5,
    paddingBottom: 5,
    paddingRight: 10,
    paddingLeft,
    transition: 'background-color 0.1s, color 0.1s',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  if (heading.level === 1) {
    return {
      ...base,
      color: isActive ? ACTIVE_COLOR : 'var(--r-ink-strong)',
      fontWeight: isActive ? 600 : 500,
      fontSize: 13,
    }
  }

  if (heading.level === 2) {
    return {
      ...base,
      color: isActive ? ACTIVE_COLOR : 'var(--r-ink-muted)',
      fontWeight: isActive ? 600 : 400,
      fontSize: 12,
    }
  }

  if (heading.level === 3) {
    return {
      ...base,
      color: isActive ? ACTIVE_COLOR : 'var(--r-ink-muted)',
      fontWeight: isActive ? 500 : 400,
      fontSize: 12,
      fontStyle: 'italic',
      opacity: isActive ? 1 : 0.8,
    }
  }

  // H4+
  return {
    ...base,
    color: isActive ? ACTIVE_COLOR : 'var(--r-ink-muted)',
    fontWeight: isActive ? 500 : 400,
    fontSize: 11,
    fontStyle: 'italic',
    opacity: isActive ? 1 : 0.7,
  }
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
    <nav
      aria-label="Table of contents"
      className="inline-toc"
      style={{
        width: INLINE_TOC_WIDTH,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        overflowY: 'auto',
        background: 'transparent',
        paddingTop: 16,
        paddingBottom: 16,
      }}
    >
      <style>{`
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
      {headings.map((heading, i) => {
        const isActive = heading.pos === activeHeadingPos
        const restingBg = isActive ? 'var(--vscode-sideBar-background)' : 'transparent'
        return (
          <ContextMenu key={`${heading.pos}-${i}`}>
            <ContextMenuTrigger asChild>
              <button
                ref={(el) => {
                  itemsRef.current[i] = el
                }}
                aria-current={isActive ? 'true' : undefined}
                title={heading.text}
                onClick={() => scrollToHeading(editor, heading.pos)}
                onKeyDown={(event) => handleKeyDown(event, heading.pos)}
                style={getItemStyle(heading, isActive)}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    'var(--vscode-sideBar-background)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = restingBg
                }}
              >
                {heading.text}
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
