import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Icon } from '../components/ui/Icon'
import type { WorkspaceFileLinkResult } from '../lib/workspaceFileSearch'

export interface FileLinkSuggestionItem extends Partial<WorkspaceFileLinkResult> {
  disabled?: boolean
  message?: string
}

interface FileLinkSuggestionListProps {
  items: FileLinkSuggestionItem[]
  command: (item: FileLinkSuggestionItem) => void
}

function iconForKind(kind: WorkspaceFileLinkResult['kind'] | undefined) {
  if (kind === 'markdown' || kind === 'document') return 'file-text'
  if (kind === 'data') return 'table'
  if (kind === 'image') return 'file-image'
  return 'file'
}

export const FileLinkSuggestionList = forwardRef((props: FileLinkSuggestionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const actionableItems = props.items.filter(item => !item.disabled)

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (actionableItems.length === 0) {
        return false
      }

      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + actionableItems.length - 1) % actionableItems.length)
        return true
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % actionableItems.length)
        return true
      }

      if (event.key === 'Enter') {
        const selectedItem = actionableItems[selectedIndex]
        if (selectedItem) {
          props.command(selectedItem)
        }
        return true
      }

      return false
    },
  }))

  return (
    <div
      className="rounded-lg border shadow-lg p-1 min-w-[320px] max-h-[360px] overflow-y-auto"
      style={{
        background: 'var(--vscode-editor-background, #ffffff)',
        color: 'var(--vscode-editor-foreground, #333333)',
        borderColor: 'var(--vscode-panel-border, #e0e0e0)',
      }}
    >
      {props.items.length > 0 ? (
        props.items.map((item, index) => {
          const actionableIndex = actionableItems.indexOf(item)
          const isSelected = actionableIndex === selectedIndex
          return (
            <button
              key={`${item.workspacePath ?? item.message ?? 'item'}-${index}`}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md transition-colors border-none text-left"
              disabled={item.disabled}
              style={{
                background: isSelected
                  ? 'var(--vscode-list-activeSelectionBackground, #e8e8e8)'
                  : 'transparent',
                color: item.disabled
                  ? 'var(--vscode-descriptionForeground, #666666)'
                  : isSelected
                    ? 'var(--vscode-list-activeSelectionForeground, #000000)'
                    : 'inherit',
                cursor: item.disabled ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled && !isSelected) {
                  e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #f0f0f0)'
                }
              }}
              onMouseLeave={(e) => {
                if (!item.disabled && !isSelected) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
              onClick={() => {
                if (!item.disabled) props.command(item)
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span
                className="flex items-center justify-center w-8 h-8"
                style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
              >
                <Icon name={iconForKind(item.kind)} size={20} />
              </span>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <div className="font-medium truncate w-full">
                  {item.disabled ? item.message : item.label}
                </div>
                {!item.disabled && (
                  <div
                    className="text-xs truncate w-full"
                    style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
                  >
                    {item.directory || item.relativePath}
                  </div>
                )}
              </div>
              {!item.disabled && item.extension && (
                <span
                  className="text-[11px] uppercase"
                  style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
                >
                  {item.extension}
                </span>
              )}
            </button>
          )
        })
      ) : (
        <div
          className="px-3 py-6 text-center text-sm"
          style={{ color: 'var(--vscode-descriptionForeground, #666666)' }}
        >
          No matching files
        </div>
      )}
    </div>
  )
})

FileLinkSuggestionList.displayName = 'FileLinkSuggestionList'
