import React from 'react'
import type { DocumentSyncState } from '../../../../src/editorSync/protocol'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { VoiceDictationButton } from '../VoiceDictationButton'
import { documentBarStatus, type DocumentSyncAction } from './DocumentSyncAction'
import { SHARE_BUTTON_ATTRIBUTE } from './shareMenu'

interface Features {
  voiceDictation: boolean
  markdownExport: boolean
}

interface DocumentHeaderProps {
  onPropertiesClick: () => void
  /** Opens or closes the Share menu (1.x's Export menu). */
  onExportClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onContentsClick?: () => void
  contentsButtonRef?: React.Ref<HTMLButtonElement>
  contentsActive?: boolean
  propertiesActive?: boolean
  agentActive?: boolean
  onAgentClick?: () => void
  syncAction?: DocumentSyncAction
  /** The host's `document:sync-state` (Sprint 134, R12): Saved shows while it is `synced`. */
  syncState?: DocumentSyncState
  /** Whether the Share menu is open: the button then takes the chosen fill (experience 26, frame 1). */
  shareOpen?: boolean
  /** Sprint 105 (#164): document-level comments entry (button + overview). */
  commentsSlot?: React.ReactNode
  features: Features
}

/**
 * The document's own bar (Ritemark 2.0; `comparison/after-write.png`):
 * Contents, Properties, comments and Agent on the left; dictation, Saved (or a
 * save problem's action in its place) and Share on the right.
 */
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
  syncState,
  shareOpen,
  commentsSlot,
  features
}: DocumentHeaderProps) {
  const status = documentBarStatus(syncState, syncAction)
  const shareButtonAttribute = { [SHARE_BUTTON_ATTRIBUTE]: '' } // File ▸ Share opens the menu under this button

  return (
    <header className="sticky top-0 left-0 right-0 h-10 bg-surface z-[60]" /* Ritemark 2.0: no line under the document's own bar */>
      <div className="flex items-center h-full pl-1 pr-3" /* Ritemark 2.0: the left buttons inset 4 (10, the desk's corner, − 4 = 6, their radius, so the corners nest), their icons 12 in. Share 12 in from the desk's right edge, mirroring the ⓘ and as the PDF and Word bars end (the 2.1.0 join pass) */>
        {/* Left: toggle cluster (the kit's docbar: 4 between buttons) */}
        <div className="flex items-center gap-1">
          {onContentsClick && (
            <Tooltip label={contentsActive ? 'Hide table of contents' : 'Contents'}>
              <Button
                ref={contentsButtonRef}
                variant="toolbar"
                size="icon-sm"
                data-state={contentsActive ? 'active' : undefined}
                aria-pressed={contentsActive}
                aria-label="Contents"
                onClick={onContentsClick}
              >
                <Icon name="list" size={14} tone={contentsActive ? 'inherit' : 'muted'} />
              </Button>
            </Tooltip>
          )}

          <Tooltip label={propertiesActive ? 'Hide properties' : 'Properties'}>
            <Button
              variant="toolbar"
              size="icon-sm"
              data-state={propertiesActive ? 'active' : undefined}
              aria-pressed={propertiesActive}
              aria-label="Properties"
              onClick={onPropertiesClick}
            >
              <Icon name="info" size={14} tone={propertiesActive ? 'inherit' : 'muted'} />
            </Button>
          </Tooltip>

          {commentsSlot}

          {onAgentClick && (
            <Tooltip label={agentActive ? 'Hide agent settings' : 'Agent settings'}>
              <Button
                variant="toolbar"
                size="icon-sm"
                data-state={agentActive ? 'active' : undefined}
                aria-pressed={agentActive}
                aria-label="Agent settings"
                onClick={onAgentClick}
              >
                <Icon name="robot" size={14} tone={agentActive ? 'inherit' : 'muted'} />
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: dictation | Saved, Share */}
        <div className="flex items-center gap-1">
          {features.voiceDictation && (
            <>
              <VoiceDictationButton />
              <span aria-hidden="true" className="mx-1.5 h-4 w-px shrink-0 bg-hairline" /* the kit's docbar .sep */ />
            </>
          )}

          <span className="sr-only" role="status" aria-live="polite">
            {syncAction?.label ?? ''}
          </span>

          {status === 'action' && syncAction ? (
            <SyncActionButton action={syncAction} />
          ) : (
            // Kept in the row while hidden, so dictation does not shift each time an edit is written.
            <span className={`mr-1 shrink-0 whitespace-nowrap font-ui text-[12px] leading-7 text-ink-muted${status === 'saved' ? '' : ' invisible'}`}>
              Saved
            </span>
          )}

          <Tooltip label="Send a copy: PDF, Word, Google Docs or Markdown">
            <Button
              {...shareButtonAttribute}
              variant="outline"
              size="sm"
              aria-haspopup="menu"
              aria-expanded={shareOpen}
              data-state={shareOpen ? 'open' : undefined}
              onClick={(e) => onExportClick(e)}
              className="h-7 shrink-0 rounded-md bg-surface px-2.5 font-ui text-[13px] font-medium text-ink-strong shadow-none data-[state=open]:border-transparent data-[state=open]:bg-accent-soft"
            >
              Share
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}

/**
 * A save problem's button (conflict or failed sync); also on a task card's strip. Sprint 145 (#588, experience
 * 44): a conflict is a question, not an alarm: ink with a hairline and two arrows parting, for every conflict. It
 * never takes the focus by itself.
 */
export function SyncActionButton({ action }: { action: DocumentSyncAction }) {
  return (
    <Tooltip label={action.title ?? action.label}>
      <Button
        variant="toolbar"
        size="sm"
        onClick={action.onClick}
        aria-label={action.label}
        className={action.kind === 'conflict'
          ? 'text-ink-strong border-[var(--r-hairline-strong)]'
          : 'text-[var(--r-error)] border-[var(--r-error-soft)]'}
      >
        <Icon name={action.kind === 'conflict' ? 'arrows-split' : 'arrows-clockwise'} size={14} tone="active" />
        <span>{action.label}</span>
      </Button>
    </Tooltip>
  )
}
