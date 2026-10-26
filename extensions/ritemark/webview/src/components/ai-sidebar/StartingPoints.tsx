/**
 * StartingPoints — the AI's empty sheet (Sprint 140, R8; experience 35, frames
 * 1, 3, 4 and 5): "What shall we work on?", the sentence about what the AI can
 * work across (D2), and at most three starting points chosen by what is open.
 * The same for Claude, ChatGPT and OpenCode; a click puts the words in the
 * message box and the person presses Send. While the box holds the person's
 * own words the points step aside, keeping their room so the box does not move
 * (D4). Replaces 2.0's three examples, which sent at once.
 */

import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import { useAISidebarStore } from './store'
import { startingPointsFor, startingSentence } from './startingPointWords'

export function StartingPoints({ aiName, notice, onPicked }: { aiName: string; notice?: ReactNode; onPicked?: () => void }) {
  const startingPlace = useAISidebarStore((s) => s.startingPlace)
  const composerEmpty = useAISidebarStore((s) => s.composerEmpty)
  const fillComposer = useAISidebarStore((s) => s.fillComposer)
  const points = startingPlace ? startingPointsFor(startingPlace.place, { hasAbout: startingPlace.hasAbout }) : []
  return (
    <div className="flex flex-1 flex-col justify-center overflow-y-auto px-4 py-6">
      {notice && <div className="mb-4 text-left">{notice}</div>}
      <h2 className="m-0 text-center text-[17px] font-semibold leading-6 text-[var(--r-ink-strong)]">What shall we work on?</h2>
      <p className="m-0 mt-2 text-center text-[13px] leading-5 text-[var(--r-ink-muted)]">{startingSentence(aiName)}</p>
      {points.length > 0 && (
        <ul
          className="m-0 mt-4 grid list-none gap-2 p-0"
          aria-label="Starting points"
          aria-hidden={!composerEmpty}
          style={{ visibility: composerEmpty ? 'visible' : 'hidden' }}
        >
          {points.map((point) => (
            <li key={point.label} className="min-w-0">
              <Tooltip label="Puts this in the message box, ready for Send" className="block w-full">
                <Button
                  type="button"
                  variant="ghost"
                  tabIndex={composerEmpty ? 0 : -1}
                  className="h-auto w-full justify-start whitespace-nowrap rounded-lg bg-[var(--r-surface)] px-3 py-2 text-left text-[13px] font-normal leading-5 text-[var(--r-ink-strong)] shadow-[0_0_0_1px_var(--r-hairline)] hover:bg-[var(--r-surface-soft)]"
                  onClick={() => {
                    onPicked?.()
                    fillComposer(point.text, point.cursor, { startingPoint: startingPlace!.place })
                  }}
                >
                  <span className="truncate">{point.label}</span>
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
