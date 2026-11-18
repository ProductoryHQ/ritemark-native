/**
 * Shared visual component for slash commands and block menu.
 * Renders a list of block items with icons, keyboard navigation, and selection.
 */

import { Fragment, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Icon } from '../components/ui/Icon'
import type { BlockItemDef } from './blockItems'

interface CommandsListProps {
  items: BlockItemDef[]
  command: (item: BlockItemDef) => void
}

export const CommandsList = forwardRef((props: CommandsListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  // The chosen item stays in view as the arrows move through a menu taller than its box (Sprint 161: the slide's).
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected]')?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (props.items.length === 0) {
        return false
      }

      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
        return true
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
        return true
      }

      if (event.key === 'Enter') {
        const selectedItem = props.items[selectedIndex]
        if (selectedItem) {
          props.command(selectedItem)
        }
        return true
      }

      return false
    },
  }))

  // Experience 22: a search puts name matches first, which can split a group; its heading is then left out rather
  // than shown twice.
  const groupRuns = props.items.filter((item, index) => item.group && item.group !== props.items[index - 1]?.group).map(item => item.group)
  const showGroups = new Set(groupRuns).size === groupRuns.length

  return (
    <div ref={listRef}
      className="slash-command-menu rounded-lg border shadow-lg p-1 min-w-[320px] max-h-[400px] overflow-y-auto"
      style={{
        background: 'var(--vscode-editor-background, #ffffff)',
        color: 'var(--vscode-editor-foreground, #333333)',
        borderColor: 'var(--vscode-panel-border, #e0e0e0)',
      }}
    >
      {props.items.length > 0 ? (
        props.items.map((item, index) => (
          <Fragment key={index}>
          {/* Sprint 161 (PR 3): the slide's / menu stands in groups (frame 22); the Text editor's items have none. */}
          {showGroups && item.group && item.group !== props.items[index - 1]?.group ? (
            <div
              className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide${index > 0 ? ' mt-1 pt-2 border-t' : ' pt-1'}`}
              style={{ color: 'var(--vscode-descriptionForeground, #666666)', borderColor: 'var(--vscode-panel-border, #e0e0e0)' }}
              role="presentation"
            >
              {item.group}
            </div>
          ) : null}
          <button
            data-selected={index === selectedIndex ? '' : undefined}
            className={`flex items-center gap-3 w-full px-3 ${item.group ? 'py-1.5' : 'py-2'} text-sm rounded-md transition-colors cursor-pointer border-none`}
            style={{
              background: index === selectedIndex
                ? 'var(--vscode-list-activeSelectionBackground, #e8e8e8)'
                : 'transparent',
              color: index === selectedIndex
                ? 'var(--vscode-list-activeSelectionForeground, #000000)'
                : 'inherit',
            }}
            onMouseEnter={(e) => {
              if (index !== selectedIndex) {
                e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #f0f0f0)'
              }
            }}
            onMouseLeave={(e) => {
              if (index !== selectedIndex) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
            onClick={() => props.command(item)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span
              className={`flex items-center justify-center ${item.group ? 'w-5 h-5' : 'w-8 h-8'}`}
              style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
            >
              <Icon name={item.icon} size={item.group ? 16 : 20} />
            </span>
            <div className="flex flex-col items-start flex-1 min-w-0">
              <div className={item.group ? 'whitespace-nowrap' : 'font-medium'}>{item.title}</div>
              {item.description ? (
                <div
                  className="text-xs"
                  style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
                >
                  {item.description}
                </div>
              ) : null}
            </div>
            {item.shortcut ? (
              <kbd
                className="font-mono text-xs"
                style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
              >
                {item.shortcut}
              </kbd>
            ) : null}
          </button>
          </Fragment>
        ))
      ) : (
        <div
          className="px-3 py-6 text-center text-sm"
          style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
        >
          No commands found
        </div>
      )}
    </div>
  )
})

CommandsList.displayName = 'CommandsList'
