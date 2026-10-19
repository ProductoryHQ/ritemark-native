/**
 * The foot of Ritemark Settings (Sprint 134, R23): Advanced settings, VS Code's
 * own settings page. ⌘, opens Ritemark Settings since Sprint 132, and the
 * feature switches, updates, excluded folders and the transcription export
 * folder live only on VS Code's page.
 */

import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'

export const ADVANCED_SETTINGS = {
  label: 'Advanced settings',
  tooltip: 'Feature switches, updates, excluded folders and every other setting',
  /** The host runs `workbench.action.openSettings` for it. */
  message: 'settings:openAdvanced',
} as const

export function AdvancedSettingsLink({ post }: { post: (type: string) => void }) {
  return (
    <footer className="mt-8 border-t border-hairline pt-4">
      <Tooltip label={ADVANCED_SETTINGS.tooltip} side="top">
        <Button variant="link" size="sm" className="px-0" onClick={() => post(ADVANCED_SETTINGS.message)}>
          {ADVANCED_SETTINGS.label}
        </Button>
      </Tooltip>
    </footer>
  )
}
