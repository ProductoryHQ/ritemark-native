import React from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { VoiceDictationButton } from '../VoiceDictationButton'

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
  hasFileChanged?: boolean
  onRefresh?: () => void
  features: Features
}

export function DocumentHeader({
  onPropertiesClick,
  onExportClick,
  onContentsClick,
  contentsButtonRef,
  contentsActive = false,
  propertiesActive = false,
  hasFileChanged = false,
  onRefresh,
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
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: contextual actions */}
        <div className="flex items-center gap-1.5">
          {features.voiceDictation && <VoiceDictationButton />}

          {hasFileChanged && onRefresh && (
            <Button
              variant="toolbar"
              size="icon-sm"
              onClick={onRefresh}
              aria-label="File changed on disk - click to refresh"
              title="File changed on disk - click to reload"
              className="relative text-[var(--vscode-notificationsInfoIcon-foreground,#3794ff)]"
            >
              <Icon name="arrows-clockwise" size={14} tone="active" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--vscode-notificationsInfoIcon-foreground,#3794ff)] rounded-full animate-pulse" />
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
