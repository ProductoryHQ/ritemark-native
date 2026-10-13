/**
 * ArchiveView — the Archive tab (Sprint 130, D15): the cards the user took off
 * the board, the most recently archived first. Each can be restored to the
 * stage it was in, or deleted to the system trash. Clicking one opens its page.
 */

import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { act, useBoardUi } from './boardUi'
import { useNow, usePresenter } from './CardParts'
import { STAGE_NAMES } from './taskCopy'

export function ArchiveView({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const openCard = useBoardUi((state) => state.openCard)
  const askDelete = useBoardUi((state) => state.askDelete)
  if (!snapshot.archived.length) {
    return (
      <div className="tb-calls">
        <div className="tb-empty">
          <Icon name="archive" size={16} />
          Nothing archived. Archive a card from its … menu, or all done cards from the Done column.
        </div>
      </div>
    )
  }
  return (
    <div className="tb-calls">
      {snapshot.archived.map((card) => {
        const p = present(card)
        const stage = STAGE_NAMES[card.stage]
        return (
          <div key={card.id} className="tb-callcard">
            <div className="flex items-start gap-2.5">
              <span className="tone-faint inline-flex shrink-0">
                <Icon name="archive" size={16} tone="inherit" className="tb-glyph" />
              </span>
              <div className="min-w-0 flex-1">
                <Tooltip label="Open this task" className="min-w-0 max-w-full">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-full justify-start whitespace-normal p-0 text-left font-ui text-[13px] font-semibold text-ink-strong"
                    onClick={() => openCard(card.id)}
                  >
                    {card.title}
                  </Button>
                </Tooltip>
                <div className="tb-sub">
                  {p.row} · was in {stage}
                </div>
                <div className="tb-actions">
                  <Tooltip label={`Put it back in ${stage}`}>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/restore', cardId: card.id })}>
                      Restore
                    </Button>
                  </Tooltip>
                  <Tooltip label="Move the card's file to the system trash">
                    <Button type="button" size="sm" variant="ghost" onClick={() => askDelete(card.id)}>
                      Delete…
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
