/**
 * The note at the top of About this project (Sprint 134, R8; S44).
 *
 * Shown when the project's own CLAUDE.md has no `@AGENTS.md` line: Claude reads
 * CLAUDE.md, not AGENTS.md, so the note offers to add the line. Add the line
 * asks the host to write it; Not now hides the note for this page and writes
 * nothing. Nothing else in Ritemark asks about it.
 */

import { Button } from './ui/button'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/tooltip'

export function AboutProjectNote({ onAddLine, onNotNow, busy }: { onAddLine: () => void; onNotNow: () => void; busy: boolean }) {
  return (
    <div className="rm-about-note mx-auto max-w-[900px] pl-16 pr-8 pt-6 font-ui">
      <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-3.5 py-2.5 text-[13px] leading-[1.4] text-[var(--r-ink-body)]">
        <Icon name="info" size={16} className="shrink-0" />
        <span className="min-w-[200px] flex-1">Claude reads this project's CLAUDE.md. Add one line to it so Claude reads this page too.</span>
        <span className="flex shrink-0 gap-2">
          <Tooltip label="Write @AGENTS.md as the first line of CLAUDE.md; the rest stays as it is">
            <Button size="sm" onClick={onAddLine} disabled={busy}>Add the line</Button>
          </Tooltip>
          <Tooltip label="Leave CLAUDE.md as it is">
            <Button size="sm" variant="ghost" onClick={onNotNow} disabled={busy}>Not now</Button>
          </Tooltip>
        </span>
      </div>
    </div>
  )
}
