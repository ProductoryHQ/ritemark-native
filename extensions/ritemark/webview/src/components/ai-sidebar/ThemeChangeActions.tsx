/**
 * Sprint 162 PR 5 (step-3-themes.md; frame 13): under an AI's reply that changed a theme, the change's actions, the same
 * for every AI: See what changed (a sheet over the deck's stage, or the theme tab's preview), Undo, and Open the theme
 * (for a theme the AI made or changed; a colour check's draft is open already). After Undo, the line says what it did
 * ("Kept Fernhollow Bank: you changed it after I made it.") and the actions go.
 */
import { vscode } from '../../lib/vscode'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import type { ThemeChangeChipView } from './types'

export function ThemeChangeActions({ changes }: { changes?: ThemeChangeChipView[] }) {
  if (!changes?.length) return null
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {changes.map((change) => (
        <div key={change.id} className="flex flex-wrap items-center gap-1.5">
          {change.undone !== undefined ? (
            <span className="text-[12px] text-[var(--r-ink-muted)]">{change.undone}</span>
          ) : (
            <>
              <Tooltip label={change.kind === 'draft' ? `See ${change.themeName}'s slides before and after the colour check` : `See two slides before and after ${change.themeName}`}>
                <Button variant="outline" size="compact" onClick={() => vscode.postMessage({ type: 'theme-change/see', id: change.id })}>
                  <Icon name="arrows-left-right" size={14} tone="inherit" />
                  See what changed
                </Button>
              </Tooltip>
              <Tooltip label={change.kind === 'draft' ? `Put ${change.themeName}'s colours back as they were in the draft` : 'Put the deck back in the theme it had, and remove the new theme if no deck uses it'}>
                <Button variant="ghost" size="compact" onClick={() => vscode.postMessage({ type: 'theme-change/undo', id: change.id })}>
                  <Icon name="arrow-counter-clockwise" size={14} tone="inherit" />
                  Undo
                </Button>
              </Tooltip>
              {change.kind === 'theme' ? (
                <Tooltip label={`Open ${change.themeName} in its own tab`}>
                  <Button variant="secondary" size="compact" onClick={() => vscode.postMessage({ type: 'theme-change/open', id: change.id })}>
                    <Icon name="palette" size={14} tone="inherit" />
                    Open the theme
                  </Button>
                </Tooltip>
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
