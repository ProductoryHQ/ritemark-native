import React from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { VoiceDictationButton } from '../VoiceDictationButton'
import type { DocumentSyncAction } from './DocumentSyncAction'

interface Features {
  voiceDictation: boolean
  markdownExport: boolean
}

interface DocumentHeaderProps {
  onPropertiesClick: () => void
  onExportClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onContentsClick?: () => void
  contentsButtonRef?: React.Ref<HTMLButtonElement>
  contentsActive?: boolean
  propertiesActive?: boolean
  agentActive?: boolean
  onAgentClick?: () => void
  syncAction?: DocumentSyncAction
  /** Sprint 105 (#164): document-level comments entry (button + overview). */
  commentsSlot?: React.ReactNode
  features: Features
}

export function DocumentHeader({
  onPropertiesClick,
  onExportClick,
  onContentsClick,
  contentsButtonRef,
  contentsActive = false,
  propertiesActive = false,
  agentActive = false,
  onAgentClick,
  syncAction,
  commentsSlot,
  features
}: DocumentHeaderProps) {
  return (
    <header className="sticky top-0 left-0 right-0 h-10 bg-surface border-b border-hairline z-[60]">
      <div className="flex items-center h-full px-4">
        {/* Left: toggle cluster */}
        <div className="flex items-center gap-1.5">
          {onContentsClick && (
            <Button
              ref={contentsButtonRef}
              variant="toolbar"
              size="icon-sm"
              data-state={contentsActive ? 'active' : undefined}
              aria-pressed={contentsActive}
              aria-label="Contents"
              onClick={onContentsClick}
              title={contentsActive ? 'Hide table of contents' : 'Contents'}
            >
              <Icon name="list" size={14} tone={contentsActive ? 'active' : 'muted'} />
            </Button>
          )}

          <Button
            variant="toolbar"
            size="icon-sm"
            data-state={propertiesActive ? 'active' : undefined}
            aria-pressed={propertiesActive}
            aria-label="Properties"
            onClick={onPropertiesClick}
            title={propertiesActive ? 'Hide properties' : 'Properties'}
          >
            <Icon name="info" size={14} tone={propertiesActive ? 'active' : 'muted'} />
          </Button>

          {commentsSlot}

          {onAgentClick && (
            <Button
              variant="toolbar"
              size="icon-sm"
              data-state={agentActive ? 'active' : undefined}
              aria-pressed={agentActive}
              aria-label="Agent settings"
              onClick={onAgentClick}
              title={agentActive ? 'Hide agent settings' : 'Agent settings'}
            >
              <Icon name="robot" size={14} tone={agentActive ? 'active' : 'muted'} />
            </Button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: contextual actions */}
        <div className="flex items-center gap-1.5">
          {features.voiceDictation && <VoiceDictationButton />}

          <span className="sr-only" role="status" aria-live="polite">
            {syncAction?.label ?? ''}
          </span>

          {syncAction && (
            <Button
              variant="toolbar"
              size="sm"
              onClick={syncAction.onClick}
              aria-label={syncAction.label}
              title={syncAction.title ?? syncAction.label}
              className={syncAction.kind === 'conflict'
                ? 'text-[var(--r-warning)] border-[var(--r-warning)]'
                : 'text-[var(--r-error)] border-[var(--r-error-soft)]'}
            >
              <Icon name={syncAction.kind === 'conflict' ? 'warning' : 'arrows-clockwise'} size={14} tone="active" />
              <span>{syncAction.label}</span>
            </Button>
          )}

          <Button
            variant="toolbar"
            size="icon-sm"
            onClick={(e) => onExportClick(e)}
            aria-label="Export document"
            title="Export"
          >
            <Icon name="download" size={14} tone="muted" />
          </Button>
        </div>
      </div>
    </header>
  )
}
