/**
 * LogView — the Log tab (Sprint 130, design.md §9): what happened on the board,
 * day by day, newest first, each entry linking to its card. Built from the
 * cards' own history, so it travels with the folder.
 */

import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { useBoardUi } from './boardUi'
import { Tooltip } from '../ui/tooltip'
import { useNow } from './CardParts'
import { logDay, timeOfDay } from './taskCopy'

interface Event {
  at: string
  what: string
  cardId: string
  title: string
}

/** The rail dot's colour: done is ink (green is only the ready dot, Sprint 145, #578), results and answers accent, the rest faint. */
function kindColour(what: string): string {
  if (what === 'Marked done') return 'var(--r-ink-strong)'
  if (/^(Finished|You chose|Reviewed)/.test(what)) return 'var(--r-accent)'
  if (/^(Gave it to|Started|Retried|Asked for changes)/.test(what)) return 'var(--r-accent-fainter)'
  return 'var(--r-ink-faint)'
}

export function LogView({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const openCard = useBoardUi((state) => state.openCard)
  const events: Event[] = []
  // Archived cards' history stays in the Log (D15).
  for (const card of [...snapshot.cards, ...snapshot.archived]) {
    for (const entry of card.history) {
      if (Number.isNaN(Date.parse(entry.at))) continue
      events.push({ at: entry.at, what: entry.what, cardId: card.id, title: card.title })
    }
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  if (!events.length) {
    return (
      <div className="tb-log">
        <div className="tb-empty">Nothing has happened on this board yet.</div>
      </div>
    )
  }
  const days: Array<{ label: string; events: Event[] }> = []
  for (const event of events) {
    const label = logDay(event.at, now)
    const last = days[days.length - 1]
    if (last && last.label === label) last.events.push(event)
    else days.push({ label, events: [event] })
  }
  return (
    <div className="tb-log">
      {days.map((day) => (
        <div key={day.label} className="tb-day">
          <h3>{day.label}</h3>
          <div className="tb-rail">
            {day.events.map((event, index) => {
              const [head, ...rest] = event.what.split(': ')
              const quoted = rest.length > 0 && /^(Finished|Asked for changes|You chose)$/.test(head)
              return (
                <div key={`${event.cardId}-${event.at}-${index}`} className="tb-ev" style={{ ['--kind' as string]: kindColour(event.what) }}>
                  <span className="w">{timeOfDay(event.at)}</span>
                  <span className="what">{quoted ? head : event.what}</span>
                  <Tooltip label="Open this task as a page">
                    <button type="button" className="card" onClick={(click) => openCard(event.cardId, click.detail === 0)}>
                      {event.title}
                    </button>
                  </Tooltip>
                  {quoted ? <div className="quote">“{rest.join(': ')}”</div> : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
