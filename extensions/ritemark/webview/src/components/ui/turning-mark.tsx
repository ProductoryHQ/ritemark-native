/**
 * The kit's turning mark (Sprint 152, PR 3, #639: the one loading look): 16, 1.5 of the strong hairline with its top in
 * ink, once a second, still under Reduce motion. The same mark the shell's loading look and the AI column draw
 * (`src/views/aiStartingMark.ts`), for a place inside a page. Lifted out of RuntimeNotice's chip, which uses it too.
 *
 * `WaitingMark` is the loading look's timing for a line whose answer is still coming (Sprint 147, PR 3; the
 * Experience lead's answer 9): nothing for a second, since most answers come within it, then the mark. Screen readers
 * hear its label from the start.
 */

import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

/** The loading look's second before the mark shows (patch 002's `RITEMARK_MARK_AFTER_MS`). */
export const MARK_AFTER_MS = 1000

export function TurningMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-turning-mark
      className={cn(
        'box-border inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-[1.5px] border-solid motion-reduce:animate-none [.vscode-reduce-motion_&]:animate-none',
        className,
      )}
      style={{ borderColor: 'var(--vscode-input-border)', borderTopColor: 'var(--vscode-foreground)' }}
    />
  )
}

/** An answer still coming: empty for `afterMs`, then the turning mark; `label` ("Checking Claude") for screen readers throughout. */
export function WaitingMark({ label, afterMs = MARK_AFTER_MS }: { label: string; afterMs?: number }) {
  const [shown, setShown] = useState(afterMs <= 0)
  useEffect(() => {
    if (shown) return
    const timer = setTimeout(() => setShown(true), afterMs)
    return () => clearTimeout(timer)
  }, [shown, afterMs])
  return (
    <span role="status" aria-label={label} data-waiting={shown ? 'mark' : 'empty'} className="flex h-[18px] items-center">
      {shown ? <TurningMark /> : null}
    </span>
  )
}
