/**
 * IdeasView — the Ideas tab (Sprint 130, design.md §8): one-line capture, a
 * review on request (an agent says whether it is worth doing and suggests a
 * task), Make it a task, Drop and Bring back.
 */

import { useState } from 'react'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { FilterChip } from '../ui/filter-chip'
import { Tooltip } from '../ui/tooltip'
import { AgentSplitButton } from './AgentSplitButton'
import { act, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import { INPUT, StateGlyph, toneClass, useNow, usePresenter } from './CardParts'
import { VERDICTS, agentName, ago } from './taskCopy'
import type { AgentId } from '../../../../src/agent/types'

export function IdeasView({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const [chip, setChip] = useState<'open' | 'dropped'>('open')
  const [title, setTitle] = useState('')
  const ideas = snapshot.cards.filter((card) => card.stage === 'idea')
  const open = ideas.filter((card) => !card.dropped)
  const dropped = ideas.filter((card) => card.dropped)
  const list = chip === 'open' ? open : dropped
  return (
    <div className="tb-ideas">
      <input
        className={cn(INPUT, 'h-9')}
        placeholder="Write an idea…"
        aria-label="Write an idea"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={async (event) => {
          if (event.key === 'Enter' && title.trim()) {
            const answer = await act({ type: 'board/add', title, stage: 'idea' })
            if (answer.ok) setTitle('')
          }
        }}
      />
      <div className="tb-chips">
        <FilterChip selected={chip === 'open'} onClick={() => setChip('open')}>
          To decide {open.length}
        </FilterChip>
        <FilterChip selected={chip === 'dropped'} onClick={() => setChip('dropped')}>
          Dropped {dropped.length}
        </FilterChip>
      </div>
      {list.length ? (
        list.map((card) => <IdeaCard key={card.id} card={card} snapshot={snapshot} p={present(card)} now={now} />)
      ) : (
        <div className="tb-empty">{chip === 'open' ? 'Write one line. An agent can say whether it is worth doing.' : 'No dropped ideas.'}</div>
      )}
    </div>
  )
}

function IdeaCard({ card, snapshot, p, now }: { card: BoardCardView; snapshot: BoardSnapshot; p: ReturnType<ReturnType<typeof usePresenter>>; now: Date }) {
  const openCard = useBoardUi((state) => state.openCard)
  const pending = useBoardUi((state) => Boolean(state.pending[card.id]))
  const review = card.review
  const reviewButton = (again: boolean) => (
    <AgentSplitButton
      verb={again ? 'Review again with' : 'Review with'}
      variant="outline"
      runtimes={snapshot.runtimes}
      selected={snapshot.defaultRuntime}
      disabled={pending}
      onRun={(runtimeId) => void act({ type: 'board/review-idea', cardId: card.id, runtimeId })}
      tip={(name) => `${name} reads this idea and says whether it is worth doing`}
    />
  )
  const failure = card.reviewFailure ? <div className="tb-sub tone-red">{card.reviewFailure}</div> : null
  let body: React.ReactNode
  if (card.reviewing) {
    // "Reviewing · {Agent}" on the status line is the whole card until it answers.
    body = null
  } else if (card.dropped) {
    body = (
      <div className="tb-actions">
        <Tooltip label="Show this idea again">
          <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/bring-back', cardId: card.id })}>
            Bring back
          </Button>
        </Tooltip>
      </div>
    )
  } else if (review) {
    body = (
      <>
        {failure}
        <div className="tb-summary" style={{ WebkitLineClamp: 6, fontSize: 13, marginTop: 8 }}>
          {review.why}
        </div>
        <div className="tb-suggest">
          <div className="tb-label" style={{ margin: '0 0 4px' }}>Suggested task</div>
          <div className="text-[13px] font-medium text-ink-strong">{review.title}</div>
          {review.description ? <div className="tb-sub">{review.description}</div> : null}
          <div className="tb-sub">How big: {review.size}.</div>
        </div>
        <div className="tb-actions">
          <Tooltip label="Move this idea to To do with the suggested title">
            <Button type="button" size="sm" variant={review.verdict === 'ready' ? 'default' : 'outline'} onClick={() => void act({ type: 'board/accept-review', cardId: card.id })}>
              Make it a task
            </Button>
          </Tooltip>
          <Tooltip label="Hide this idea. You can bring it back from Dropped">
            <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/drop', cardId: card.id })}>
              Drop
            </Button>
          </Tooltip>
          {reviewButton(true)}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {failure}
        <div className="tb-actions">{reviewButton(Boolean(card.reviewFailure))}</div>
      </>
    )
  }
  const by: AgentId = review?.by === 'codex' ? 'codex' : review?.by === 'opencode' ? 'opencode' : 'claude-code'
  const status =
    card.dropped || card.reviewing || card.reviewFailure || !review
      ? p.row
      : `${VERDICTS[review.verdict].label} · reviewed by ${agentName(by)} ${ago(review.at, now)}`
  return (
    <div className="tb-callcard">
      <div className="flex items-start gap-2.5">
        <StateGlyph p={p} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <Tooltip label="Open this idea as a page" className="min-w-0 flex-1">
              <button
                type="button"
                className="w-full border-0 bg-transparent p-0 text-left font-ui text-[13px] font-semibold text-ink-strong hover:underline"
                onClick={(event) => openCard(card.id, event.detail === 0)}
              >
                {card.title}
              </button>
            </Tooltip>
            <CardMenu card={card} p={p} snapshot={snapshot} />
          </div>
          <div className={cn('mt-0.5 text-[11px]', toneClass(card.dropped ? 'faint' : p.tone === 'faint' ? 'muted' : p.tone))}>{status}</div>
          {body}
        </div>
      </div>
    </div>
  )
}
