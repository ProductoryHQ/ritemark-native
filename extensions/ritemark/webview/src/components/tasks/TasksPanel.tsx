/**
 * TasksPanel — the Tasks side bar (Sprint 130, design.md §3): the daily glance.
 * An add field, then Your calls as a panel of its own, then Doing, To do,
 * Ideas and Done. Clicking a card opens its page in the editor (design.md §5),
 * and the open card stays highlighted; the board tab is one click away.
 */

import { useEffect, useRef, useState } from 'react'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { notify, startBoard, useActivePage, useBoardSnapshot } from './boardClient'
import { act, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import { DeleteConfirm } from './DeleteConfirm'
import { CallActions, CardGlyph, GivePromptPanel, HeaderIconButton, INPUT, SECTION, toneClass, useNow, usePresenter } from './CardParts'
import { STAGE_NAMES, finishedRecently, waited } from './taskCopy'
import { Notice } from './Notice'
import { UnreadableCards } from './UnreadableCards'
import './tasks.css'

const DONE_SHOWN = 5

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 360)
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 360)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

export function TasksPanel() {
  const snapshot = useBoardSnapshot()
  useEffect(() => startBoard('sidebar'), [])
  if (!snapshot) return null
  if (snapshot.folder === null) {
    return (
      <div className="flex h-full flex-col font-ui text-ink-strong">
        <div className="px-4 py-6 text-center">
          <div className="text-[13px] font-semibold text-ink-strong">Open a folder to keep a task board</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">Tasks stay in the folder, so they travel with your project.</p>
          <div className="mt-3 flex justify-center">
            <Tooltip label="Choose a project folder">
              <Button type="button" size="sm" onClick={() => notify({ type: 'board/recover', action: 'open-folder' })}>
                <Icon name="folder-open" size={16} tone="inherit" />
                Open folder…
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    )
  }
  if (!snapshot.enabled) {
    return <p className="px-4 py-6 text-center font-ui text-xs leading-relaxed text-ink-muted">The task board is turned off.</p>
  }
  return <Board snapshot={snapshot} />
}

function Board({ snapshot }: { snapshot: BoardSnapshot }) {
  const narrow = useNarrow()
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const [title, setTitle] = useState('')
  const [ideasOpen, setIdeasOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const callIds = new Set(snapshot.calls.map((call) => call.cardId))
  const byId = new Map(snapshot.cards.map((card) => [card.id, card]))
  const calls = snapshot.calls.map((call) => byId.get(call.cardId)).filter((card): card is BoardCardView => Boolean(card))
  const stage = (name: BoardCardView['stage']) => snapshot.cards.filter((card) => card.stage === name && !callIds.has(card.id))
  const ideas = snapshot.cards.filter((card) => card.stage === 'idea' && !card.dropped)
  // The last four weeks, as on the board (D15).
  const done = snapshot.cards.filter((card) => card.stage === 'done' && finishedRecently(card, now))
  const empty = snapshot.cards.length === 0
  const showCalls = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })

  const add = async () => {
    const text = title.trim()
    if (!text) return
    const answer = await act({ type: 'board/add', title: text, stage: 'todo' })
    if (answer.ok) setTitle('')
  }

  const row = (card: BoardCardView, inCalls: boolean) => <SideRow key={card.id} card={card} inCalls={inCalls} snapshot={snapshot} narrow={narrow} present={present} onShowCalls={showCalls} />

  const doingTip =
    (snapshot.doing.limit ? `Doing holds at most ${snapshot.doing.limit} tasks. ` : '') +
    `${calls.filter((card) => card.stage === 'doing').length} of the ${snapshot.doing.count} in Doing are in Your calls above`
  const doingCount = snapshot.doing.limit ? `${snapshot.doing.count}/${snapshot.doing.limit}` : `${snapshot.doing.count}`
  const doingTone = snapshot.doing.limit && snapshot.doing.count > snapshot.doing.limit ? 'tb-wiptext-over' : snapshot.doing.limit && snapshot.doing.count === snapshot.doing.limit ? 'tb-wiptext-full' : ''

  return (
    // The viewport's height, so the add field stays at the top and only the list scrolls.
    <div className="flex h-screen flex-col font-ui text-ink-strong">
      <div className="p-3 pb-2">
        <div className="flex gap-2">
          <input
            className={cn(INPUT, 'h-8 min-w-0 flex-1')}
            placeholder="Add a task…"
            aria-label="Add a task"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add()
            }}
          />
          <Tooltip label="Open the task board">
            <Button type="button" size="icon-sm" variant="outline" aria-label="Open the task board" onClick={() => notify({ type: 'board/open' })}>
              <Icon name="kanban" size={16} tone="inherit" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div ref={scroller} className="tb-scroll flex-1 pb-4">
        {empty ? (
          <p className="px-4 py-6 text-center text-xs leading-relaxed text-ink-muted">
            Tasks for this project live here.
            <br />
            Give any of them to an agent.
          </p>
        ) : (
          <>
            {calls.length ? (
              <div className="tb-callpanel">
                <div className={cn(SECTION, 'tb-callhead')}>
                  <span>Your calls</span>
                  <span className="font-semibold normal-case tracking-normal">· {calls.length}</span>
                  <Tooltip label={`The oldest one has waited ${waited(snapshot.attention.oldestSince, now)}`} className="ml-auto">
                    <span className="font-semibold normal-case tracking-normal">oldest {waited(snapshot.attention.oldestSince, now)}</span>
                  </Tooltip>
                </div>
                {snapshot.attention.blocked ? (
                  <div className="tb-blockline">
                    <Icon name="warning" size={12} tone="inherit" />
                    <span>
                      {snapshot.attention.blocked} agent{snapshot.attention.blocked > 1 ? 's' : ''} can’t continue until you answer
                    </span>
                  </div>
                ) : null}
                {calls.map((card) => row(card, true))}
              </div>
            ) : null}
            <div className="mb-1">
              <div className={SECTION}>
                <span>Doing</span>
                <Tooltip label={doingTip}>
                  <span className={cn('font-semibold normal-case tracking-normal', doingTone)}>· {doingCount}</span>
                </Tooltip>
              </div>
              {stage('doing').map((card) => row(card, false))}
            </div>
            <div className="mb-1">
              <div className={SECTION}>
                <span>To do</span>
                <span className="font-semibold normal-case tracking-normal">· {stage('todo').length}</span>
              </div>
              {stage('todo').map((card) => row(card, false))}
            </div>
            <Collapsible
              title="Ideas"
              count={ideas.length}
              open={ideasOpen}
              onToggle={() => setIdeasOpen(!ideasOpen)}
              what="ideas"
              onAdd={() => notify({ type: 'board/open', tab: 'ideas' })}
            >
              {ideas.filter((card) => !callIds.has(card.id)).map((card) => row(card, false))}
            </Collapsible>
            <Collapsible title="Done" count={done.length} open={doneOpen} onToggle={() => setDoneOpen(!doneOpen)} what="finished tasks">
              {done.slice(0, DONE_SHOWN).map((card) => row(card, false))}
              {done.length > DONE_SHOWN ? (
                <div className="px-4 pt-1">
                  <Tooltip label="Open the board to see every task finished in the last four weeks">
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0 text-[12px] font-semibold"
                      onClick={() => notify({ type: 'board/open', tab: 'board' })}
                    >
                      Show all {done.length}
                    </Button>
                  </Tooltip>
                </div>
              ) : null}
            </Collapsible>
            <UnreadableCards snapshot={snapshot} />
            {/* Out of the way on purpose (Jarmo, 2026-10-13): last, collapsed, and
                only when something is archived. Restore and Delete… are in each row's … menu. */}
            {snapshot.archived.length ? (
              <Collapsible title="Archived" count={snapshot.archived.length} open={archivedOpen} onToggle={() => setArchivedOpen(!archivedOpen)} what="archived tasks">
                {snapshot.archived.map((card) => row(card, false))}
              </Collapsible>
            ) : null}
          </>
        )}
      </div>
      <DeleteConfirm snapshot={snapshot} />
      <Notice />
    </div>
  )
}

function Collapsible({
  title,
  count,
  open,
  onToggle,
  what,
  onAdd,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  what: string
  onAdd?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      <div className={SECTION}>
        <Tooltip label={`${open ? 'Hide' : 'Show'} the ${count} ${what}`}>
          <Button
            type="button"
            variant="ghost"
            className="tb-sec-btn h-auto gap-1.5 rounded-sm p-0 text-[10px] font-bold uppercase tracking-wider text-inherit hover:bg-transparent hover:text-[var(--r-ink-muted)] has-[>svg]:px-0"
            aria-expanded={open}
            onClick={onToggle}
          >
            <Icon name="caret-right" size={12} tone="inherit" className="size-3" />
            <span>{title}</span>
            <span className="font-semibold normal-case tracking-normal">· {count}</span>
          </Button>
        </Tooltip>
        {onAdd ? (
          <HeaderIconButton icon="plus" label="Add an idea" tip="Add an idea on the board" className="ml-auto" onClick={onAdd} />
        ) : null}
      </div>
      {open ? children : null}
    </div>
  )
}

function SideRow({
  card,
  inCalls,
  snapshot,
  narrow,
  present,
  onShowCalls,
}: {
  card: BoardCardView
  inCalls: boolean
  snapshot: BoardSnapshot
  narrow: boolean
  present: ReturnType<typeof usePresenter>
  onShowCalls: () => void
}) {
  const openCard = useBoardUi((state) => state.openCard)
  const activePage = useActivePage()
  const prompt = useBoardUi((state) => state.prompt)
  const p = present(card)
  const progress = card.checkboxes.total ? `${card.checkboxes.done}/${card.checkboxes.total}` : ''
  const sub = p.row ? (
    <div className={cn('mt-0.5 truncate text-[11px]', toneClass(p.tone === 'faint' ? 'muted' : p.tone))}>{p.row}</div>
  ) : card.nextUp || progress ? (
    <div className="mt-0.5 text-[11px] text-ink-muted">
      {card.nextUp ? <span className="tone-accent font-semibold">Next up</span> : null}
      {card.nextUp && progress ? ' · ' : ''}
      {progress}
    </div>
  ) : null
  return (
    <div className={cn('group relative flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-soft', activePage === card.id && 'tb-row-active')}>
      <button
        type="button"
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        aria-label={`${card.title}, ${p.row || STAGE_NAMES[card.stage]}`}
        onClick={() => openCard(card.id)}
      />
      <CardGlyph card={card} p={p} />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-[13px] font-medium text-ink-strong">{card.title}</div>
        {sub}
        {inCalls && p.call === 'review' && card.result ? <div className="tb-summary">{card.result.summary}</div> : null}
        {inCalls && p.call === 'decision' && card.ask ? (
          <div className="tb-summary" style={{ WebkitLineClamp: 4 }}>
            {card.ask.question}
          </div>
        ) : null}
        {prompt && prompt.cardId === card.id ? (
          <div className="pointer-events-auto relative z-10">
            <GivePromptPanel prompt={prompt} snapshot={snapshot} onShowCalls={onShowCalls} />
          </div>
        ) : null}
        {inCalls ? (
          <div className="pointer-events-auto">
            <CallActions card={card} p={p} snapshot={snapshot} where="side" narrow={narrow} stacked />
          </div>
        ) : null}
      </div>
      <CardMenu
        card={card}
        p={p}
        snapshot={snapshot}
        className="relative z-10 -mr-1.5 -mt-[2.25px] opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
      />
    </div>
  )
}
