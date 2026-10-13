/**
 * CardPage — a task card open as a page in the Ritemark editor (Sprint 130,
 * design.md §5). Opening a card shows the work, not a form.
 *
 * `CardStrip` takes the document header's place: Show board, the stage menu,
 * the card's state, the one action that moves the card, History, then the
 * editor's own tools and More actions. `CardHead` sits above the body inside the editor's
 * scroll: the title and Done when, edited in place; the state's block (the
 * result to review, a decision, why it waits…); the card's files; and the
 * history when it is shown. Below it the card's Markdown is a normal document,
 * saved by the editor; the board's front matter never reaches this view.
 */

import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { CARD_STAGES } from '../../../../src/taskBoard/cardTypes'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { AgentSplitButton } from './AgentSplitButton'
import { notify } from './boardClient'
import { act, giveCard, moveCard, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import { CallActions, CheckList, FileChip, GiveButton, GivePromptPanel, RetryButton, StateGlyph, toneClass, useNow, usePresenter } from './CardParts'
import { DeleteConfirm } from './DeleteConfirm'
import { NEEDS, STAGE_NAMES, VERDICTS, agentName, finishedLine, historyTime, presentCard, type CardPresentation } from './taskCopy'
import { Notice } from './Notice'
import './tasks.css'

/** The page's own view state: History shown under the files or not. */
const usePageUi = create<{ historyOpen: boolean; toggleHistory(): void }>((set) => ({
  historyOpen: false,
  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen })),
}))

/** Where a note box opened on the page lives (rows use 'side', calls 'calls'). */
const WHERE = 'page'

function actorName(by: string): string {
  if (by === 'claude') return 'Claude'
  if (by === 'codex') return 'Codex'
  if (by === 'opencode') return 'OpenCode'
  return 'The agent'
}

function ConversationLink({ card }: { card: BoardCardView }) {
  if (!card.handoff?.canOpen) return null
  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault()
        void act({ type: 'board/open-conversation', cardId: card.id })
      }}
    >
      Open conversation
    </a>
  )
}

export function CardStrip({
  card,
  snapshot,
  tools,
  alert,
}: {
  /** Null until the board has answered, or when the card left the board. */
  card: BoardCardView | null
  snapshot: BoardSnapshot | null
  /** The editor's own tools, Comments and Dictate; they give way first when the editor is narrow. */
  tools: React.ReactNode
  /** A save problem's button; always shown. */
  alert?: React.ReactNode
}) {
  const now = useNow()
  const historyOpen = usePageUi((state) => state.historyOpen)
  const toggleHistory = usePageUi((state) => state.toggleHistory)
  const prompt = useBoardUi((state) => state.prompt)
  const p = card && snapshot ? presentCard(card, { now, titleOf: (id) => snapshot.cards.find((item) => item.id === id)?.title ?? null }) : null

  let primary: React.ReactNode = null
  if (card && snapshot && p) {
    const h = card.handoff
    const waitingHere = h?.state === 'waiting' || (prompt && prompt.cardId === card.id)
    if (card.archived !== null) {
      primary = (
        <Tooltip label={`Put it back in ${STAGE_NAMES[card.stage]}`}>
          <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/restore', cardId: card.id })}>
            Restore
          </Button>
        </Tooltip>
      )
    } else if (card.stage === 'done') {
      primary = (
        <Tooltip label="Move this task back to To do">
          <Button type="button" size="sm" variant="outline" onClick={() => void moveCard(card.id, 'todo')}>
            Reopen
          </Button>
        </Tooltip>
      )
    } else if (card.stage === 'idea') {
      primary = (
        <AgentSplitButton
          verb={card.review || card.reviewFailure ? 'Review again with' : 'Review with'}
          variant="outline"
          runtimes={snapshot.runtimes}
          selected={card.reviewing?.runtimeId ?? snapshot.defaultRuntime}
          disabledReason={card.reviewing ? `${agentName(card.reviewing.runtimeId)} is already reviewing this` : undefined}
          onRun={(runtimeId) => void act({ type: 'board/review-idea', cardId: card.id, runtimeId })}
          tip={(name) => `${name} reads this idea and says whether it is worth doing`}
        />
      )
    } else if (waitingHere || p.call === 'needs-you' || p.call === 'decision' || p.call === 'review' || p.call === 'failed') {
      // The block under the title holds this state's buttons.
      primary = null
    } else if (p.busy && h?.state !== 'accepting') {
      primary = (
        <Tooltip label="Stop the agent. You can give the task again">
          <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/stop', cardId: card.id })}>
            Stop
          </Button>
        </Tooltip>
      )
    } else {
      primary = <GiveButton card={card} snapshot={snapshot} />
    }
  }

  const words = !card || !p ? '' : card.archived !== null || card.stage === 'done' || p.waiting ? p.row : p.full || (card.nextUp ? 'Next up' : '')
  const tone = card?.nextUp && !p?.full ? 'accent' : p?.tone === 'faint' ? 'muted' : p?.tone ?? 'muted'

  return (
    <header className="cp-strip sticky left-0 right-0 top-0 z-[60] h-10 border-b border-hairline bg-surface">
      <div className="flex h-full items-center gap-1.5 px-4">
        <Tooltip label="Show the task board">
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            className="cp-showboard"
            aria-label="Show board"
            onClick={() => notify({ type: 'board/open', tab: 'board' })}
          >
            <Icon name="kanban" size={14} tone="muted" />
            <span className="cp-showboard-label">Show board</span>
          </Button>
        </Tooltip>
        {card && snapshot && p ? (
          <>
            <StageMenu card={card} />
            {words ? (
              <span className={cn('cp-state', toneClass(tone))}>
                {p.plain ? null : <StateGlyph p={p} />}
                <span className="truncate">{words}</span>
              </span>
            ) : null}
          </>
        ) : null}
        <div className="min-w-2 flex-1" />
        <div className="flex shrink-0 items-center gap-1.5">
          {primary}
          {card ? (
            <Tooltip label={historyOpen ? 'Hide the history' : 'Show the history'}>
              <Button
                type="button"
                variant="toolbar"
                size="icon-sm"
                aria-label="History"
                aria-pressed={historyOpen}
                data-state={historyOpen ? 'active' : undefined}
                onClick={toggleHistory}
              >
                <Icon name="clock-counter-clockwise" size={14} tone={historyOpen ? 'active' : 'muted'} />
              </Button>
            </Tooltip>
          ) : null}
          <span className="cp-tools flex items-center gap-1.5">
            <span className="cp-sep" aria-hidden="true" />
            {tools}
          </span>
          {alert}
          {card && snapshot && p ? <CardMenu card={card} p={p} snapshot={snapshot} density="header" /> : null}
        </div>
      </div>
      {snapshot ? <DeleteConfirm snapshot={snapshot} /> : null}
      <Notice />
    </header>
  )
}

function StageMenu({ card }: { card: BoardCardView }) {
  const fixed = card.locked || card.archived !== null
  const trigger = (
    <Button type="button" variant="toolbar" size="sm" className="cp-stage" disabled={fixed} aria-label={`Stage: ${STAGE_NAMES[card.stage]}`}>
      {STAGE_NAMES[card.stage]}
      <Icon name="caret-down" size={12} tone="inherit" />
    </Button>
  )
  if (fixed) {
    return (
      <Tooltip label={card.archived !== null ? 'The card is archived. Restore it to move it' : 'The agent is still working, so the stage can’t change'}>
        <span className="inline-flex">{trigger}</span>
      </Tooltip>
    )
  }
  return (
    <DropdownMenu modal={false}>
      <Tooltip label="Move this task to another stage">
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        {CARD_STAGES.map((stage) => (
          <DropdownMenuItem
            key={stage}
            role="menuitemradio"
            aria-checked={card.stage === stage}
            disabled={card.stage === stage}
            onSelect={() => void moveCard(card.id, stage)}
          >
            {card.stage === stage ? <Icon name="check" size={14} tone="inherit" /> : <span className="w-[14px]" />}
            <span>{STAGE_NAMES[stage]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Title, Done when, the state's block, files and history, above the body. */
export function CardHead({ card, snapshot }: { card: BoardCardView; snapshot: BoardSnapshot }) {
  const now = useNow()
  const present = usePresenter(snapshot, now)
  const p = present(card)
  const historyOpen = usePageUi((state) => state.historyOpen)
  return (
    <div className="cp-head font-ui">
      <EditableLine
        key={`title-${card.id}-${card.title}`}
        className="cp-title"
        value={card.title}
        label="Title"
        placeholder="Name this task"
        onSave={(title) => {
          if (!title) return false
          if (title !== card.title) void act({ type: 'board/update', cardId: card.id, title })
          return true
        }}
      />
      <div className="cp-donewhen">
        <b>Done when</b>
        <EditableLine
          key={`done-${card.id}-${card.doneWhen ?? ''}`}
          className="cp-donewhen-text"
          value={card.doneWhen ?? ''}
          label="Done when"
          placeholder="What does done look like? One line. Agents finish better with it."
          onSave={(doneWhen) => {
            if (doneWhen !== (card.doneWhen ?? '')) void act({ type: 'board/update', cardId: card.id, doneWhen })
            return true
          }}
        />
      </div>
      <CardBlock card={card} snapshot={snapshot} p={p} />
      <div className="cp-files">
        <span className="cp-label">Files</span>
        {card.files.map((file) => (
          <FileChip key={file.path} path={file.path} exists={file.exists} />
        ))}
        <Tooltip label="Choose files in this folder for the agent to work on">
          <button type="button" className="tb-linkbtn cp-addfiles" onClick={() => notify({ type: 'board/add-files', cardId: card.id })}>
            <Icon name="plus" size={12} tone="inherit" />
            Add files…
          </button>
        </Tooltip>
      </div>
      {historyOpen ? (
        <div className="cp-history">
          <div className="cp-label">History</div>
          <div className="tb-hist">
            {[...card.history].reverse().map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="contents">
                <span className="t">{historyTime(entry.at, now)}</span>
                <span>{entry.what}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * One line of text edited in place. Enter or leaving it saves; Escape puts
 * the saved text back. `onSave` returns false to refuse (an empty title).
 */
function EditableLine({
  value,
  label,
  placeholder,
  className,
  onSave,
}: {
  value: string
  label: string
  placeholder: string
  className: string
  onSave: (text: string) => boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value
  }, [value])
  const save = () => {
    const element = ref.current
    if (!element) return
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!onSave(text)) element.textContent = value
  }
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={label}
      data-ph={placeholder}
      onBlur={save}
      onPaste={(event) => {
        // Plain text only, on one line.
        event.preventDefault()
        const text = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ')
        document.execCommand('insertText', false, text)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLElement).blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          if (ref.current) ref.current.textContent = value
          ;(event.target as HTMLElement).blur()
        }
      }}
    >
      {value}
    </div>
  )
}

/** What the card needs from the user now, or what the agent is doing: at most one block. */
function CardBlock({ card, snapshot, p }: { card: BoardCardView; snapshot: BoardSnapshot; p: CardPresentation }) {
  const prompt = useBoardUi((state) => state.prompt)
  const h = card.handoff

  if (card.archived !== null) {
    return (
      <div className="cp-line tone-muted">
        <Icon name="archive" size={16} tone="inherit" />
        <span>{p.full}. It is off the board; Restore puts it back in {STAGE_NAMES[card.stage]}.</span>
      </div>
    )
  }

  if (prompt && prompt.cardId === card.id) {
    return (
      <div className="cp-gap">
        <GivePromptPanel prompt={prompt} snapshot={snapshot} />
      </div>
    )
  }

  if (card.stage === 'idea') {
    // While an agent reviews, the strip's "Reviewing · {Agent}" says it all.
    if (card.reviewing) return null
    if (card.reviewFailure && !card.review) {
      return (
        <div className="cp-block">
          <div className="cp-block-h">
            <StateGlyph p={p} />
            <span className="tone-red">{p.full}</span>
          </div>
          <div className="cp-say">{card.reviewFailure}</div>
        </div>
      )
    }
    if (!card.review) return null
    const verdict = VERDICTS[card.review.verdict]
    return (
      <div className={cn('cp-block', card.review.verdict === 'ready' && 'you')}>
        {card.reviewFailure ? <div className="cp-say tone-red" style={{ marginTop: 0, marginBottom: 8 }}>{card.reviewFailure}</div> : null}
        <div className="cp-block-h">
          <span className={cn('inline-flex items-center gap-1.5', toneClass(verdict.tone))}>
            <Icon name={verdict.glyph} size={16} tone="inherit" />
            {verdict.label}
          </span>
          <span className="m">· reviewed by {actorName(card.review.by)}</span>
        </div>
        <div className="cp-say">{card.review.why}</div>
        <div className="tb-suggest">
          <div className="tb-label" style={{ margin: '0 0 4px' }}>
            Suggested task
          </div>
          <div className="text-[14px] font-medium text-ink-strong">{card.review.title}</div>
          {card.review.description ? <div className="tb-sub">{card.review.description}</div> : null}
          <div className="tb-sub">How big: {card.review.size}.</div>
        </div>
        <div className="tb-actions" style={{ marginTop: 12 }}>
          <Tooltip label="Move this idea to To do with the suggested title">
            <Button type="button" size="sm" variant={card.review.verdict === 'ready' ? 'default' : 'outline'} onClick={() => void act({ type: 'board/accept-review', cardId: card.id })}>
              Make it a task
            </Button>
          </Tooltip>
          <Tooltip label="Hide this idea. You can bring it back from Dropped">
            <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/drop', cardId: card.id })}>
              Drop
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }

  if (h?.state === 'waiting') {
    const agent = agentName(h.runtimeId)
    if (h.waitFor?.kind === 'conflict') {
      return (
        <div className="cp-block">
          <div className="cp-block-h">
            <StateGlyph p={p} />
            {p.full}
          </div>
          <div className="cp-say small">It starts by itself with {agent} when that task finishes.</div>
          <div className="tb-actions" style={{ marginTop: 12 }}>
            <Tooltip label="Start without waiting. Two agents may change the same file">
              <Button type="button" size="sm" onClick={() => void giveCard(card.id, h.runtimeId, { force: true })}>
                Start now
              </Button>
            </Tooltip>
            <Tooltip label="Keep the task in To do without starting it">
              <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/unwait', cardId: card.id })}>
                Don’t wait
              </Button>
            </Tooltip>
          </div>
        </div>
      )
    }
    const capacity = h.waitFor?.kind === 'capacity'
    return (
      <div className="cp-block">
        <div className="cp-block-h">
          <StateGlyph p={p} />
          {p.full}
        </div>
        <div className="cp-say small">
          {capacity
            ? `Five conversations are working or waiting for you. It starts by itself with ${agent} when one finishes.`
            : `Doing is full (${snapshot.doing.count} of ${snapshot.doing.limit ?? '–'}). It starts by itself with ${agent} when a task leaves Doing.`}
        </div>
        <div className="tb-actions" style={{ marginTop: 12 }}>
          {capacity ? null : (
            <Tooltip label={`Start now. Doing goes to ${snapshot.doing.count + 1} of ${snapshot.doing.limit ?? '–'}`}>
              <Button type="button" size="sm" onClick={() => void giveCard(card.id, h.runtimeId, { overLimit: true })}>
                Start anyway
              </Button>
            </Tooltip>
          )}
          <Tooltip label="Keep it in To do without starting it">
            <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/unwait', cardId: card.id })}>
              Take out of the queue
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }

  if (card.ask && !card.locked) {
    return (
      <div className="cp-block you">
        <div className="cp-block-h">
          <span className="tone-accent inline-flex">
            <Icon name="question" size={16} tone="inherit" />
          </span>
          Decision for you
          <span className="m">· {actorName(card.ask.by)} asked</span>
        </div>
        <div className="cp-say">{card.ask.question}</div>
        <CallActions card={card} p={{ ...p, call: 'decision' }} snapshot={snapshot} where={WHERE} />
      </div>
    )
  }

  if (p.call === 'review' && card.result) {
    const finished = finishedLine(card)
    return (
      <div className="cp-block you">
        <div className="cp-block-h">
          <span className="tone-accent inline-flex">
            <Icon name="eye" size={16} tone="inherit" />
          </span>
          Ready to review
          {finished ? <span className="m">· {finished}</span> : null}
          {card.handoff?.canOpen ? (
            <>
              <span className="m">·</span>
              <ConversationLink card={card} />
            </>
          ) : null}
        </div>
        <div className="cp-say">{card.result.summary}</div>
        {/* Only Claude reports the files a turn changed; an empty list is
            "not known", never "nothing changed". */}
        {card.result.files.length ? (
          <div className="cp-changed">
            Changed
            {card.result.files.map((file) => (
              <FileChip key={file} path={file} />
            ))}
          </div>
        ) : null}
        <CheckList card={card} />
        <CallActions card={card} p={p} snapshot={snapshot} where={WHERE} />
      </div>
    )
  }

  if (p.call === 'needs-you') {
    return (
      <div className="cp-block blocked">
        <div className="cp-block-h">
          <StateGlyph p={p} />
          {p.full}
          {h ? <span className="m">· {agentName(h.runtimeId)}</span> : null}
        </div>
        <div className="cp-say small">{NEEDS[h?.needs ?? 'approval'].sentence} Answer it in the conversation and the work goes on.</div>
        <CallActions card={card} p={p} snapshot={snapshot} where={WHERE} />
      </div>
    )
  }

  if (h && (h.state === 'failed' || h.state === 'interrupted' || h.state === 'conversation-gone')) {
    return (
      <div className="cp-block">
        <div className={cn('cp-block-h', toneClass(p.tone))}>
          <StateGlyph p={p} />
          {p.full}
        </div>
        <div className="cp-say small">
          {h.state === 'conversation-gone' ? 'Retry starts a new conversation.' : 'Earlier work stays in the conversation.'}{' '}
          <ConversationLink card={card} />
        </div>
        <div className="tb-actions" style={{ marginTop: 12 }}>
          <RetryButton card={card} snapshot={snapshot} />
        </div>
      </div>
    )
  }

  if (p.busy) {
    return (
      <div className={cn('cp-line', toneClass(p.tone === 'faint' ? 'muted' : p.tone))}>
        <StateGlyph p={p} />
        <span>{p.full}</span>
        {card.handoff?.canOpen ? (
          <>
            <span className="text-ink-faint">·</span>
            <ConversationLink card={card} />
          </>
        ) : null}
      </div>
    )
  }

  if (h?.state === 'cancelled') {
    return (
      <div className="cp-line tone-muted">
        <Icon name="x" size={16} tone="inherit" />
        <span>Stopped by you</span>
        {card.handoff?.canOpen ? (
          <>
            <span className="text-ink-faint">·</span>
            <ConversationLink card={card} />
          </>
        ) : null}
      </div>
    )
  }

  if (card.stage === 'done' && card.result) {
    return (
      <div className="cp-block quiet">
        <div className="cp-block-h">
          <span className="tone-muted inline-flex">
            <Icon name="check-circle" size={16} tone="inherit" />
          </span>
          {p.full}
          <span className="m">· {actorName(card.result.by)}’s result</span>
          {card.handoff?.canOpen ? (
            <>
              <span className="m">·</span>
              <ConversationLink card={card} />
            </>
          ) : null}
        </div>
        <div className="cp-say small">{card.result.summary}</div>
      </div>
    )
  }

  return null
}
