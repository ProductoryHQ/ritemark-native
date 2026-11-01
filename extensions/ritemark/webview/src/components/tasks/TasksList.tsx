/**
 * TasksList — the Tasks side bar's list under the project's head (Sprint 134,
 * R16–R17; experience 6, frame 1).
 *
 * The head's two rows run here: New task shows the add field with the
 * keyboard in it, and Search a search field that filters the list by title
 * (`board/head`). The list runs in the order work moves: Ideas (folded),
 * To do, Doing, Done (folded, with Archived inside). A task that waits for the
 * person is first in its stage and marked Waiting for you (`taskList.ts`).
 * Clicking a task opens its page in the editor (design.md §5), and the open
 * task stays highlighted. With no task yet, it says nothing waits and offers
 * New task (experience 29, frame 2).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { notify, onHeadRow, useActivePage, useSavingStage } from './boardClient'
import { act, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import { DeleteConfirm } from './DeleteConfirm'
import { CallActions, CardGlyph, GivePromptPanel, HeaderIconButton, TitleField, toneClass, useNow, usePresenter } from './CardParts'
import { STAGE_NAMES, aiPeopleName, emptyTasksWords } from './taskCopy'
import { filterGroups, nextSearch, shownCards, taskGroups, type SearchEvent, type SearchState, type TaskGroup } from './taskList'
import { Notice } from './Notice'
import { UnreadableCards } from './UnreadableCards'

type Fold = 'idea' | 'done' | 'archived'

/** A narrow side bar: a review's Ask for changes becomes an icon, a failed task shows Retry alone (W15). */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 360)
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 360)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

/** The list under the head, for a board that exists. */
export function TasksList({ snapshot }: { snapshot: BoardSnapshot }) {
  const now = useNow()
  const narrow = useNarrow()
  const present = usePresenter(snapshot, now)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [search, setSearch] = useState<SearchState>({ open: false, query: '' })
  const [opened, setOpened] = useState<Record<Fold, boolean>>({ idea: false, done: false, archived: false })
  // Bumped to put the keyboard in a field once it is on screen.
  const [addFocus, setAddFocus] = useState(0)
  const [searchFocus, setSearchFocus] = useState(0)
  const addBox = useRef<HTMLDivElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const newTask = () => {
    setAdding(true)
    setAddFocus((count) => count + 1)
  }
  const searchTo = (event: SearchEvent) => setSearch((state) => nextSearch(state, event))

  // The project's head on Tasks (R17): its rows run in the shell, the host passes them on.
  useEffect(
    () =>
      onHeadRow((row) => {
        // The view has the keyboard; the page in its frame may not yet.
        window.focus()
        if (row === 'new-task') {
          newTask()
        } else {
          searchTo({ type: 'show' })
          setSearchFocus((count) => count + 1)
        }
      }),
    [],
  )
  useEffect(() => {
    if (addFocus) addBox.current?.querySelector('textarea')?.focus()
  }, [addFocus])
  useEffect(() => {
    if (!searchFocus) return
    searchField.current?.focus()
    searchField.current?.select()
  }, [searchFocus])

  const add = async () => {
    const text = title.trim()
    if (!text) return
    const answer = await act({ type: 'board/add', title: text, stage: 'todo' })
    if (answer.ok) setTitle('')
  }

  const groups = useMemo(() => taskGroups(snapshot, now), [snapshot, now])
  const query = search.query.trim()
  const shown = filterGroups(groups, query)
  const empty = snapshot.cards.length === 0 && snapshot.archived.length === 0 && snapshot.unreadable.length === 0
  // "See what waits on you" in a Doing-full prompt: the first task that waits.
  const showWaiting = () => scroller.current?.querySelector('[data-waiting]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const toggle = (fold: Fold) => setOpened((state) => ({ ...state, [fold]: !state[fold] }))

  return (
    // The viewport's height, so the fields stay at the top and only the list scrolls.
    <div className="flex h-screen flex-col font-ui text-ink-strong">
      {search.open || adding ? (
        <div className="flex flex-col gap-2 px-2 pb-1 pt-1">
          {search.open ? (
            <div className="tb-search">
              <Icon name="magnifying-glass" size={14} tone="inherit" />
              <input
                ref={searchField}
                type="search"
                placeholder="Search tasks"
                aria-label="Search tasks by title"
                value={search.query}
                onChange={(event) => searchTo({ type: 'type', query: event.target.value })}
                onBlur={() => searchTo({ type: 'blur' })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    searchTo({ type: 'escape' })
                  }
                }}
              />
              <Tooltip label="Clear the search (Esc)">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear the search"
                  className="size-6 rounded-[4px] text-[var(--r-ink-body)] hover:text-[var(--r-ink-strong)]"
                  // Keep the field from losing the keyboard before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => searchTo({ type: 'escape' })}
                >
                  <Icon name="x" size={14} tone="inherit" />
                </Button>
              </Tooltip>
            </div>
          ) : null}
          {adding ? (
            <div ref={addBox}>
              <TitleField
                compact
                placeholder="Add a task…"
                label="Add a task"
                submitLabel="Add the task to To do"
                value={title}
                onChange={setTitle}
                onSubmit={add}
                onEscape={() => {
                  setAdding(false)
                  setTitle('')
                }}
                // Leaving an empty field puts it away; New task brings it back.
                onBlur={() => {
                  if (!title.trim()) setAdding(false)
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div ref={scroller} className="tb-scroll tb-list flex-1">
        {empty ? (
          // Sprint 140 (R9; experience 29, frame 2): each stage says it is empty; New task is on the bar.
          <>
            <div className="tb-group" role="heading" aria-level={2}><span>{STAGE_NAMES.todo}</span></div>
            <p className="tb-none-line">{emptyTasksWords(aiPeopleName(snapshot.defaultRuntime)).todo}</p>
            <div className="tb-group" role="heading" aria-level={2}><span>{STAGE_NAMES.doing}</span></div>
            <p className="tb-none-line">{emptyTasksWords(aiPeopleName(snapshot.defaultRuntime)).doing}</p>
          </>
        ) : query && shown.length === 0 ? (
          <p className="tb-none">No task has “{query}” in its title.</p>
        ) : (
          <>
            {shown.map((group) => (
              <Stage
                key={group.stage}
                group={group}
                snapshot={snapshot}
                searching={Boolean(query)}
                open={group.stage === 'idea' ? opened.idea : group.stage === 'done' ? opened.done : true}
                archivedOpen={opened.archived}
                onToggle={() => toggle(group.stage === 'idea' ? 'idea' : 'done')}
                onToggleArchived={() => toggle('archived')}
                row={(card, waiting) => (
                  <SideRow key={card.id} card={card} waiting={waiting} snapshot={snapshot} narrow={narrow} present={present} onShowWaiting={showWaiting} />
                )}
              />
            ))}
            {query ? null : (
              <div className="-mx-2">
                <UnreadableCards snapshot={snapshot} />
              </div>
            )}
          </>
        )}
      </div>
      <DeleteConfirm snapshot={snapshot} />
      <Notice />
    </div>
  )
}

const FOLD_WHAT = { idea: 'ideas', done: 'tasks finished in the last four weeks' } as const

/** One stage of the list: To do and Doing under a group label; Ideas and Done as a folding row. */
function Stage({
  group,
  snapshot,
  searching,
  open,
  archivedOpen,
  onToggle,
  onToggleArchived,
  row,
}: {
  group: TaskGroup
  snapshot: BoardSnapshot
  /** A search shows every match, folded stages too. */
  searching: boolean
  open: boolean
  archivedOpen: boolean
  onToggle: () => void
  onToggleArchived: () => void
  row: (card: BoardCardView, waiting: boolean) => React.ReactNode
}) {
  const rows = (cards: BoardCardView[]) => cards.map((card) => row(card, group.waiting.has(card.id)))

  if (!group.folds) {
    const doing = group.stage === 'doing'
    const { count, limit } = snapshot.doing
    // The count, as drawn; Doing's limit shows once it is reached.
    const atLimit = doing && limit !== null && count >= limit
    const waits = group.waiting.size
    const tip = doing
      ? `${count} in Doing${limit ? `. Doing holds at most ${limit} tasks` : ''}${waits ? `. ${waits} ${waits === 1 ? 'waits' : 'wait'} for you` : ''}`
      : ''
    const number = searching ? group.cards.length : doing ? count : group.cards.length
    return (
      <>
        <div className="tb-group" role="heading" aria-level={2}>
          <span>{group.label}</span>
          {doing && !searching ? (
            <Tooltip label={tip}>
              <span className={cn('tb-group-n', atLimit && (count > (limit ?? 0) ? 'tb-wiptext-over' : 'tb-wiptext-full'))}>
                {atLimit ? `${count}/${limit}` : count}
              </span>
            </Tooltip>
          ) : (
            <span className="tb-group-n">{number}</span>
          )}
        </div>
        {group.cards.length ? rows(group.cards) : <p className="tb-none-line">{doing ? emptyTasksWords(aiPeopleName(snapshot.defaultRuntime)).doing : emptyTasksWords('').todo}</p>}
      </>
    )
  }

  const unfolded = open || searching
  const { cards, more } = shownCards(group, unfolded, searching)
  const what = FOLD_WHAT[group.stage === 'idea' ? 'idea' : 'done']
  const count = group.cards.length
  return (
    <>
      <FoldRow
        label={group.label}
        count={count}
        open={unfolded}
        disabled={searching}
        tip={`${unfolded ? 'Hide' : 'Show'} ${count ? `the ${count} ` : 'the '}${what}`}
        onToggle={onToggle}
        add={
          group.stage === 'idea' ? (
            <HeaderIconButton icon="plus" label="Add an idea" tip="Add an idea on the board" className="tb-fold-add" onClick={() => notify({ type: 'board/open', tab: 'ideas' })} />
          ) : null
        }
      />
      {rows(cards)}
      {more ? (
        <div className="tb-more">
          <Tooltip label="Open the board to see every task finished in the last four weeks">
            <Button type="button" variant="link" className="h-auto p-0 text-[12px] font-semibold" onClick={() => notify({ type: 'board/open', tab: 'board' })}>
              Show all {count}
            </Button>
          </Tooltip>
        </div>
      ) : null}
      {/* Archived is part of Done (experience 6; Jarmo, 19 October): inside it, folded.
          Restore and Delete… are in each archived task's … menu. */}
      {unfolded && group.archived.length ? (
        <>
          <FoldRow
            inner
            label="Archived"
            count={group.archived.length}
            open={archivedOpen || searching}
            disabled={searching}
            tip={`${archivedOpen || searching ? 'Hide' : 'Show'} the ${group.archived.length} archived tasks`}
            onToggle={onToggleArchived}
          />
          {archivedOpen || searching ? rows(group.archived) : null}
        </>
      ) : null}
    </>
  )
}

/** A folded stage, as drawn: the caret, then its name and count in muted ink ("Ideas · 1"). */
function FoldRow({
  label,
  count,
  open,
  tip,
  onToggle,
  disabled,
  inner,
  add,
}: {
  label: string
  count: number
  open: boolean
  tip: string
  onToggle: () => void
  /** While a search is on, every stage shows its matches. */
  disabled?: boolean
  /** Archived, inside Done. */
  inner?: boolean
  add?: React.ReactNode
}) {
  return (
    <div className={cn('tb-fold', inner && 'tb-fold-inner')}>
      <Tooltip label={disabled ? 'A search shows every match' : tip} className="flex min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'tb-fold-btn h-8 w-full justify-start gap-2.5 rounded-[4px] px-2 py-0 text-[13px] font-normal leading-[18px] text-[var(--r-ink-muted)] hover:bg-transparent hover:text-[var(--r-ink-body)] has-[>svg]:px-2 disabled:opacity-100',
            inner && 'has-[>svg]:pl-[30px]',
          )}
          onClick={onToggle}
        >
          <Icon name="caret-right" size={12} tone="inherit" className="size-3" />
          <span className="truncate">
            {label} · {count}
          </span>
        </Button>
      </Tooltip>
      {add}
    </div>
  )
}

function SideRow({
  card,
  waiting,
  snapshot,
  narrow,
  present,
  onShowWaiting,
}: {
  card: BoardCardView
  /** It waits for the person (a call): marked, first in its stage, with its answers under its words. */
  waiting: boolean
  snapshot: BoardSnapshot
  narrow: boolean
  present: ReturnType<typeof usePresenter>
  onShowWaiting: () => void
}) {
  const openCard = useBoardUi((state) => state.openCard)
  const activePage = useActivePage()
  const prompt = useBoardUi((state) => state.prompt)
  const p = present(card)
  const saving = useSavingStage(card.id)
  const active = activePage === card.id
  const progress = card.checkboxes.total ? `${card.checkboxes.done}/${card.checkboxes.total}` : ''
  // The state's words wrap rather than cut ("Ready to revie…", QA 19 October): they say what to do
  const words = <span className={cn('min-w-0 [overflow-wrap:anywhere]', toneClass(p.tone === 'faint' ? 'muted' : p.tone))}>{p.row}</span>
  const sub = waiting ? (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
      <span className="tb-wfy">Waiting for you</span>
      {p.row ? words : null}
    </div>
  ) : p.row ? (
    <div className="mt-0.5 flex min-w-0 text-[11px]">{words}</div>
  ) : card.nextUp || progress ? (
    <div className="mt-0.5 text-[11px] text-ink-muted">
      {card.nextUp ? <span className="tone-accent font-semibold">Next up</span> : null}
      {card.nextUp && progress ? ' · ' : ''}
      {progress}
    </div>
  ) : null
  return (
    <div data-waiting={waiting ? '' : undefined} className={cn('tb-row group', active && 'tb-row-active')}>
      <Tooltip label="Open this task’s page" className="absolute inset-0">
        <Button
          variant="ghost"
          className="absolute inset-0 h-auto w-full rounded-[4px] p-0 hover:bg-transparent active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          aria-label={`${card.title}, ${waiting ? 'waiting for you, ' : ''}${p.row || STAGE_NAMES[card.stage]}`}
          // Enter or Space (a click with no pointer, detail 0) takes the keyboard to the page (W16).
          onClick={(event) => openCard(card.id, event.detail === 0)}
        />
      </Tooltip>
      {waiting ? <span className={cn('tb-wait', active && 'on')} aria-hidden="true" /> : <CardGlyph card={card} p={p} />}
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="tb-row-title line-clamp-2 break-words">{card.title}</div>
        {sub}
        {/* What a decision asks and what a review hands back, short: the answers below need it. */}
        {waiting && p.call === 'decision' && card.ask ? (
          <div className="tb-summary" style={{ WebkitLineClamp: 2 }}>
            {card.ask.question}
          </div>
        ) : null}
        {waiting && p.call === 'review' && card.result ? (
          <div className="tb-summary" style={{ WebkitLineClamp: 2 }}>
            {card.result.summary}
          </div>
        ) : null}
        {/* The answers the old Your calls rows had, with the same messages to the host (R17: every action on a row stays). */}
        {waiting ? (
          <div className="tb-side-actions pointer-events-auto">
            <CallActions card={card} p={p} snapshot={snapshot} where="side" narrow={narrow} stacked />
          </div>
        ) : null}
        {prompt && prompt.cardId === card.id ? (
          <div className="pointer-events-auto relative z-10">
            <GivePromptPanel prompt={prompt} snapshot={snapshot} onShowCalls={onShowWaiting} />
          </div>
        ) : null}
      </div>
      {saving ? (
        // Sprint 145 (#597): a move made here and still being saved after a second, in the menu's place.
        <span className="tb-saving-row" role="status" aria-label={`Saving the move to ${STAGE_NAMES[saving]}`}>
          <Icon name="circle-notch" size={12} tone="inherit" className="tb-spin size-3" />
        </span>
      ) : (
        <CardMenu
          card={card}
          p={p}
          snapshot={snapshot}
          className="relative z-10 -mr-1.5 -mt-[3px] opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        />
      )}
    </div>
  )
}
