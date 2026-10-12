/**
 * BoardColumns — the Board tab (Sprint 130, design.md §4): Ideas, To do, Doing
 * and Done side by side. Cards move by drag and drop (native HTML5, as the
 * flow node palette) or, from the keyboard, with More actions → Move to….
 * A card that waits on the user has an accent bar and a "Your move" tag (amber
 * when an agent is blocked). Doing's header carries the Doing limit.
 */

import { useState } from 'react'
import type { BoardCardView, BoardSnapshot, CardStage } from '../../../../src/taskBoard/protocol'
import { CARD_STAGES } from '../../../../src/taskBoard/cardTypes'
import { WIP_LIMIT_MAX } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { act, moveCard, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import { CardGlyph, GivePromptPanel, INPUT, StateGlyph, toneClass, useNow, usePresenter } from './CardParts'
import { STAGE_NAMES, type CardPresentation } from './taskCopy'
import { UnreadableCards } from './UnreadableCards'

const HINTS: Record<CardStage, string> = {
  idea: 'Ideas an agent can weigh up.',
  todo: 'Add a task.',
  doing: 'Tasks you give to an agent show up here.',
  done: 'Finished tasks collect here.',
}
const DONE_SHOWN = 10
const DRAG_TYPE = 'application/x-ritemark-card'

export function BoardColumns({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const [adding, setAdding] = useState<CardStage | null>(null)
  const [allDone, setAllDone] = useState(false)
  const [drop, setDrop] = useState<{ stage: CardStage; beforeId: string | null } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const column = (stage: CardStage) =>
    snapshot.cards.filter((card) => card.stage === stage && !(stage === 'idea' && card.dropped))

  const onDrop = (stage: CardStage) => {
    const id = dragging
    const target = drop
    setDrop(null)
    setDragging(null)
    if (!id || !target || target.stage !== stage) return
    if (target.beforeId === id) return
    void moveCard(id, stage, target.beforeId ? { beforeCardId: target.beforeId } : { atEnd: true })
  }

  return (
    <>
      <div className="tb-cols">
        {CARD_STAGES.map((stage) => {
          const all = column(stage)
          const cards = stage === 'done' && !allDone ? all.slice(0, DONE_SHOWN) : all
          return (
            <section
              key={stage}
              className={cn('tb-col', drop?.stage === stage && 'drop')}
              aria-label={STAGE_NAMES[stage]}
              onDragOver={(event) => {
                if (!dragging) return
                event.preventDefault()
                // The card under the pointer: drop before it, or at the end.
                const tiles = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-card]'))
                const before = tiles.find((tile) => {
                  const box = tile.getBoundingClientRect()
                  return event.clientY < box.top + box.height / 2
                })
                const beforeId = before?.dataset.card ?? null
                if (drop?.stage !== stage || drop.beforeId !== beforeId) setDrop({ stage, beforeId })
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                onDrop(stage)
              }}
            >
              <div className="tb-colhead">
                {STAGE_NAMES[stage]}{' '}
                {stage === 'doing' ? <DoingLimit snapshot={snapshot} /> : <span className="n">{all.length}</span>}
                {stage === 'idea' || stage === 'todo' ? (
                  <Tooltip label={stage === 'idea' ? 'Add an idea' : 'Add a task'} className="ml-auto">
                    <button type="button" className="tb-addsec" aria-label={stage === 'idea' ? 'Add an idea' : 'Add a task'} onClick={() => setAdding(stage)}>
                      <Icon name="plus" size={12} tone="inherit" />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
              {adding === stage ? <AddRow stage={stage} onDone={() => setAdding(null)} /> : null}
              {cards.length
                ? cards.map((card) => (
                    <div key={card.id}>
                      {drop?.stage === stage && drop.beforeId === card.id && dragging !== card.id ? <div className="tb-dropline" /> : null}
                      <Tile
                        card={card}
                        p={present(card)}
                        snapshot={snapshot}
                        dragging={dragging === card.id}
                        onDragStart={() => setDragging(card.id)}
                        onDragEnd={() => {
                          setDragging(null)
                          setDrop(null)
                        }}
                      />
                    </div>
                  ))
                : <div className="tb-colhint">{HINTS[stage]}</div>}
              {drop?.stage === stage && drop.beforeId === null && cards.length ? <div className="tb-dropline" /> : null}
              {stage === 'done' && all.length > DONE_SHOWN ? (
                <button type="button" className="tb-more" onClick={() => setAllDone(!allDone)}>
                  {allDone ? 'Show fewer' : `Show all ${all.length}`}
                </button>
              ) : null}
            </section>
          )
        })}
      </div>
      <div className="px-2">
        <UnreadableCards snapshot={snapshot} />
      </div>
      <div className="tb-foot">Tasks are saved in this folder, so they travel with it.</div>
    </>
  )
}

function AddRow({ stage, onDone }: { stage: CardStage; onDone: () => void }) {
  const [title, setTitle] = useState('')
  return (
    <div className="tb-addrow">
      <input
        autoFocus
        className={cn(INPUT, 'h-8')}
        placeholder={stage === 'idea' ? 'Write an idea…' : 'Add a task…'}
        aria-label="New card title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && onDone()}
        onKeyDown={async (event) => {
          if (event.key === 'Escape') onDone()
          if (event.key === 'Enter' && title.trim()) {
            const answer = await act({ type: 'board/add', title, stage })
            if (answer.ok) setTitle('')
          }
        }}
      />
    </div>
  )
}

/** "3/3 full ▾": Doing's count against its limit, and the menu to change it. */
function DoingLimit({ snapshot }: { snapshot: BoardSnapshot }) {
  const { count, limit } = snapshot.doing
  const state = limit === null ? '' : count > limit ? 'over' : count === limit ? 'full' : ''
  const tip = limit ? `Doing holds at most ${limit} tasks at once. Change the limit` : 'No limit on Doing. Set one'
  return (
    <DropdownMenu modal={false}>
      <Tooltip label={tip} className="ml-auto" >
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn('tb-wip', state)} aria-label="Doing limit" style={{ marginTop: -2, marginBottom: -2, marginRight: 3 }}>
            {limit === null ? `${count}` : `${count}/${limit}`}
            {state ? <span>{state}</span> : null}
            <Icon name="caret-down" size={12} tone="inherit" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <div className="px-2 pb-1.5 pt-1 text-[11px] text-ink-muted">At most this many tasks in Doing</div>
        {[...Array.from({ length: WIP_LIMIT_MAX }, (_, index) => index + 1), null].map((value) => (
          <DropdownMenuItem
            key={value ?? 'none'}
            role="menuitemradio"
            aria-checked={limit === value}
            onSelect={() => void act({ type: 'board/set-wip', limit: value })}
          >
            {limit === value ? <Icon name="check" size={14} tone="inherit" /> : <span className="w-[14px]" />}
            <span>{value ?? 'No limit'}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Tile({
  card,
  p,
  snapshot,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  card: BoardCardView
  p: CardPresentation
  snapshot: BoardSnapshot
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const openCard = useBoardUi((state) => state.openCard)
  const prompt = useBoardUi((state) => state.prompt)
  const mark = p.call === 'needs-you' ? 'tb-blocked' : p.call ? 'tb-you' : ''
  return (
    <div
      className={cn('tb-tile', mark, dragging && 'dragging')}
      data-card={card.id}
      // A working card can be dragged; the host refuses a move out of Doing
      // and the notice says why (S7a).
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, card.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-lg border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        aria-label={`${card.title}, ${p.row || STAGE_NAMES[card.stage]}`}
        onClick={() => openCard(card.id)}
      />
      <div className="pointer-events-none relative flex items-start gap-2 pr-5">
        {p.plain ? <CardGlyph card={card} p={p} /> : <StateGlyph p={p} />}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 break-words text-[13px] font-medium text-ink-strong">{card.title}</div>
          {p.row ? (
            <div className={cn('mt-0.5 truncate text-[11px]', toneClass(p.tone === 'faint' ? 'muted' : p.tone))}>
              {p.row.replace(/ · \d+ to check$/, '')}
            </div>
          ) : card.nextUp ? (
            <div className="tone-accent mt-0.5 text-[11px] font-semibold">Next up</div>
          ) : null}
          {p.call ? <div className="tb-yourmove">Your move</div> : null}
          {card.checkboxes.total || card.files.length ? (
            <div className="mt-1.5 flex items-center gap-3">
              {card.checkboxes.total ? (
                <span className="tb-progress">
                  <Icon name="list-checks" size={12} tone="inherit" />
                  {card.checkboxes.done}/{card.checkboxes.total}
                </span>
              ) : null}
              {card.files.length ? (
                <span className="tb-progress">
                  <Icon name="file-text" size={12} tone="inherit" />
                  {card.files.length}
                </span>
              ) : null}
            </div>
          ) : null}
          {prompt && prompt.cardId === card.id ? (
            <div className="pointer-events-auto relative z-10">
              <GivePromptPanel prompt={prompt} snapshot={snapshot} />
            </div>
          ) : null}
        </div>
      </div>
      <span className="mt">
        <CardMenu card={card} p={p} snapshot={snapshot} className="relative z-10" />
      </span>
    </div>
  )
}
