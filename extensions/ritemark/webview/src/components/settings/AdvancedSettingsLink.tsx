/**
 * Settings ▸ Advanced's More tools (Sprint 134, R23; Sprint 147, experience 15 frame 3): All settings, VS Code's own
 * settings page. ⌘, opens Ritemark Settings since Sprint 132, and the feature switches, updates, excluded folders and
 * the transcription export folder live only on VS Code's page.
 */

import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import { SettingsNote } from './SettingsRow'

export const ADVANCED_SETTINGS = {
  label: 'All settings',
  tooltip: 'Feature switches, updates, excluded folders and every other setting',
  /** The host runs `workbench.action.openSettings` for it. */
  message: 'settings:openAdvanced',
} as const

export function AdvancedSettingsLink({ post }: { post: (type: string) => void }) {
  return (
    <SettingsNote icon="wrench" row="I60">
      More tools:{' '}
      <Tooltip label={ADVANCED_SETTINGS.tooltip} side="top">
        <Button variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={() => post(ADVANCED_SETTINGS.message)}>
          {ADVANCED_SETTINGS.label}
        </Button>
      </Tooltip>
      , every setting as one long list.
    </SettingsNote>
  )
}
