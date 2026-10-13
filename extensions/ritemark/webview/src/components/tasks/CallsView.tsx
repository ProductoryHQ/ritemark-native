/**
 * CallsView — the Your calls tab (Sprint 130, design.md §7): everything that
 * waits on the user, blocked agents first, then decisions, results to review
 * and failures, longest-waiting first within each. Each call is answered with
 * a button.
 */

import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Icon } from '../ui/Icon'
import { useBoardUi } from './boardUi'
import { Tooltip } from '../ui/tooltip'
import { CallActions, CheckList, StateGlyph, toneClass, useNow, usePresenter } from './CardParts'
import { NEEDS, agentName, cardAgent, finishedLine, modifiedLine } from './taskCopy'

export function CallsView({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const openCard = useBoardUi((state) => state.openCard)
  const byId = new Map(snapshot.cards.map((card) => [card.id, card]))
  const calls = snapshot.calls.map((call) => byId.get(call.cardId)).filter((card): card is BoardCardView => Boolean(card))
  if (!calls.length) {
    return (
      <div className="tb-calls">
        <div className="tb-empty">
          <Icon name="check-circle" size={16} />
          Nothing waits on you.
        </div>
      </div>
    )
  }
  return (
    <div className="tb-calls">
      {calls.map((card) => {
        const p = present(card)
        const agent = agentName(cardAgent(card, snapshot.defaultRuntime))
        let detail: React.ReactNode = null
        if (p.call === 'review' && card.result) {
          detail = (
            <>
              <div className="tb-sub">
                {finishedLine(card)}.{card.result.files.length ? ` ${modifiedLine(card.result.files)}` : ''}
              </div>
              <div className="tb-summary" style={{ fontSize: 13 }}>
                {card.result.summary}
              </div>
              <CheckList card={card} />
            </>
          )
        } else if (p.call === 'decision' && card.ask) {
          detail = (
            <div className="tb-sub">
              {agent} asks: {card.ask.question}
            </div>
          )
        } else if (p.call === 'needs-you') {
          detail = <div className="tb-sub">{NEEDS[card.handoff?.needs ?? 'approval'].sentence}</div>
        }
        return (
          <div key={card.id} className="tb-callcard">
            <div className="flex items-start gap-2.5">
              <StateGlyph p={p} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <Tooltip label="Open this task as a page" className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="w-full border-0 bg-transparent p-0 text-left font-ui text-[13px] font-semibold text-ink-strong hover:underline"
                      onClick={(event) => openCard(card.id, event.detail === 0)}
                    >
                      {card.title}
                    </button>
                  </Tooltip>
                  <span className={cn('shrink-0 text-[11px]', toneClass(p.tone))}>{p.row}</span>
                </div>
                {detail}
                <CallActions card={card} p={p} snapshot={snapshot} where="calls" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
