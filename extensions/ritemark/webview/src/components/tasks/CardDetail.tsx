/**
 * CardDetail — a card opened as a dialog (Sprint 130, design.md §5): its state
 * and what to do next, the result or decision, Done when, the description
 * (with working checkboxes), files, stage and history. Edits save on blur.
 * In the narrow side bar the dialog takes the whole height (dialog.tsx).
 */

import { useEffect, useRef, useState } from 'react'
import type { BoardCardView, BoardSnapshot, CardStage } from '../../../../src/taskBoard/protocol'
import { CARD_STAGES } from '../../../../src/taskBoard/cardTypes'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dialog, DialogButton, DialogContent, DialogFooter, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { Textarea } from '../ui/textarea'
import { Tooltip } from '../ui/tooltip'
import { AgentSplitButton } from './AgentSplitButton'
import { notify } from './boardClient'
import { act, giveCard, moveCard, useBoardUi } from './boardUi'
import { CardMenu } from './CardMenu'
import {
  AskForChangesButton,
  CallActions,
  CheckList,
  FileChip,
  GiveButton,
  GivePromptPanel,
  INPUT,
  MarkDoneButton,
  NoteBox,
  OpenConversationButton,
  RetryButton,
  StateGlyph,
  toneClass,
  usePresenter,
} from './CardParts'
import { NEEDS, STAGE_NAMES, VERDICTS, agentName, cardAgent, finishedLine, historyTime } from './taskCopy'

function Label({ children }: { children: React.ReactNode }) {
  return <div className="tb-label">{children}</div>
}

/** The description, read view: Markdown text with its `- [ ]` lines as real checkboxes. */
function Description({ card, onEdit }: { card: BoardCardView; onEdit: () => void }) {
  if (!card.description.trim()) {
    return (
      <button type="button" className="text-left text-[13px] text-ink-faint hover:text-ink-muted" onClick={onEdit}>
        No description. Click to add one.
      </button>
    )
  }
  const lines = card.description.replace(/\n+$/, '').split('\n')
  const toggle = (index: number) => {
    const next = [...card.description.split('\n')]
    next[index] = next[index].replace(/\[( |x|X)\]/, (_, mark: string) => (mark === ' ' ? '[x]' : '[ ]'))
    void act({ type: 'board/update', cardId: card.id, description: next.join('\n') })
  }
  return (
    <div className="tb-desc" onDoubleClick={onEdit}>
      {lines.map((line, index) => {
        const match = /^(\s*)[-*+]\s+\[([ xX])\]\s(.*)$/.exec(line)
        if (match) {
          const done = match[2] !== ' '
          return (
            <label key={index} className={cn('cb', done && 'done')}>
              <input type="checkbox" checked={done} onChange={() => toggle(index)} />
              <span>{match[3]}</span>
            </label>
          )
        }
        return <div key={index}>{line || ' '}</div>
      })}
      <Tooltip label="Edit the description">
        <button type="button" className="tb-linkbtn" onClick={onEdit}>
          Edit
        </button>
      </Tooltip>
    </div>
  )
}

export function CardDetail({ snapshot, narrow, onShowCalls }: { snapshot: BoardSnapshot; narrow: boolean; onShowCalls?: () => void }) {
  const openCardId = useBoardUi((state) => state.openCardId)
  const openCard = useBoardUi((state) => state.openCard)
  const card = snapshot.cards.find((item) => item.id === openCardId) ?? null
  useEffect(() => {
    if (openCardId && !card) openCard(null)
  }, [openCardId, card, openCard])
  if (!card) return null
  return (
    <Dialog open onOpenChange={(open) => !open && openCard(null)}>
      <DialogContent
        className="tb-dlg"
        aria-describedby={undefined}
        // Focus the dialog itself, not its first button: a focused More
        // actions button would pop its tooltip the moment the card opens.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <CardDetailBody key={card.id} card={card} snapshot={snapshot} narrow={narrow} onShowCalls={onShowCalls} />
      </DialogContent>
    </Dialog>
  )
}

function CardDetailBody({ card, snapshot, narrow, onShowCalls }: { card: BoardCardView; snapshot: BoardSnapshot; narrow: boolean; onShowCalls?: () => void }) {
  const openCard = useBoardUi((state) => state.openCard)
  const note = useBoardUi((state) => state.note)
  const prompt = useBoardUi((state) => state.prompt)
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(card.description)
  const [doneWhen, setDoneWhen] = useState(card.doneWhen ?? '')
  const [allHistory, setAllHistory] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const present = usePresenter(snapshot, new Date())
  const p = present(card)
  const agent = agentName(cardAgent(card, snapshot.defaultRuntime))
  const where = 'dialog'

  useEffect(() => setDoneWhen(card.doneWhen ?? ''), [card.doneWhen])
  useEffect(() => {
    if (!editing) setDescription(card.description)
  }, [card.description, editing])

  const saveTitle = () => {
    const text = titleRef.current?.textContent?.trim() ?? ''
    if (!text) {
      if (titleRef.current) titleRef.current.textContent = card.title
      return
    }
    if (text !== card.title) void act({ type: 'board/update', cardId: card.id, title: text })
  }
  const saveDoneWhen = () => {
    if (doneWhen.trim() !== (card.doneWhen ?? '')) void act({ type: 'board/update', cardId: card.id, doneWhen })
  }
  const saveDescription = () => {
    setEditing(false)
    if (description !== card.description) void act({ type: 'board/update', cardId: card.id, description })
  }

  const whose = p.waiting || p.busy ? (p.call === 'needs-you' ? 'Your move' : `${agent}’s move`) : card.move === 'you' || p.call ? 'Your move' : ''
  const handoff = card.handoff
  const conversationLink = handoff?.canOpen ? (
    <>
      {' · '}
      <a
        href="#"
        onClick={(event) => {
          event.preventDefault()
          void act({ type: 'board/open-conversation', cardId: card.id })
        }}
      >
        Open conversation
      </a>
    </>
  ) : null

  let sub: React.ReactNode = null
  if (p.call === 'needs-you') sub = NEEDS[handoff?.needs ?? 'approval'].sentence
  else if (p.busy && handoff?.canOpen) sub = <>In “{handoff.conversationTitle ?? card.title}”{conversationLink}</>
  else if (p.call === 'review') sub = <>{finishedLine(card)}{conversationLink}</>
  else if (p.call === 'failed') sub = 'Earlier work stays in the conversation.'
  else if (handoff?.state === 'cancelled') sub = <>Stopped by you{conversationLink}</>
  if (handoff?.state === 'waiting' && handoff.waitFor?.kind === 'conflict') sub = 'It starts by itself when that task finishes.'
  if (handoff?.state === 'waiting' && handoff.waitFor?.kind === 'slot') {
    sub = `Doing is full (${snapshot.doing.count} of ${snapshot.doing.limit ?? '–'}). It starts by itself with ${agentName(handoff.runtimeId)} when a task leaves Doing.`
  }
  if (handoff?.state === 'waiting' && handoff.waitFor?.kind === 'capacity') {
    sub = `Five conversations are working or waiting for you. It starts by itself with ${agentName(handoff.runtimeId)} when one finishes.`
  }
  const promptHere = prompt && prompt.cardId === card.id
  if (p.plain && !card.doneWhen && card.stage !== 'done' && card.stage !== 'idea' && !promptHere) {
    sub = 'Add what done looks like below. Agents finish better with it.'
  }

  let actions: React.ReactNode = null
  if (card.stage === 'done') {
    actions = (
      <Tooltip label="Move this task back to To do">
        <Button type="button" size="sm" variant="outline" onClick={() => void moveCard(card.id, 'todo')}>
          Reopen
        </Button>
      </Tooltip>
    )
  } else if (card.stage === 'idea') {
    actions = (
      <>
        {card.review ? (
          <Tooltip label="Move this idea to To do with the suggested title">
            <Button type="button" size="sm" onClick={() => void act({ type: 'board/accept-review', cardId: card.id })}>
              Make it a task
            </Button>
          </Tooltip>
        ) : null}
        <AgentSplitButton
          verb={card.review ? 'Review again with' : 'Review with'}
          variant="outline"
          runtimes={snapshot.runtimes}
          selected={snapshot.defaultRuntime}
          inDialog
          onRun={(runtimeId) => void act({ type: 'board/review-idea', cardId: card.id, runtimeId })}
          tip={(name) => `${name} reads this idea and says whether it is worth doing`}
        />
      </>
    )
  } else if (handoff?.state === 'waiting' && handoff.waitFor?.kind === 'slot') {
    actions = (
      <>
        <Tooltip label={`Start now. Doing goes to ${snapshot.doing.count + 1} of ${snapshot.doing.limit ?? '–'}`}>
          <Button type="button" size="sm" onClick={() => void giveCard(card.id, handoff.runtimeId, { overLimit: true })}>
            Start anyway
          </Button>
        </Tooltip>
        <Tooltip label="Keep it in To do without starting it">
          <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/unwait', cardId: card.id })}>
            Take out of the queue
          </Button>
        </Tooltip>
      </>
    )
  } else if (handoff?.state === 'waiting') {
    actions = (
      <>
        <Tooltip label="Start without waiting. Two agents may change the same file">
          <Button type="button" size="sm" onClick={() => void giveCard(card.id, handoff.runtimeId, { force: true })}>
            Start now
          </Button>
        </Tooltip>
        <Tooltip label="Keep the task in To do without starting it">
          <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/unwait', cardId: card.id })}>
            Don’t wait
          </Button>
        </Tooltip>
      </>
    )
  } else if (p.call === 'review') {
    actions = (
      <>
        <MarkDoneButton card={card} />
        <AskForChangesButton card={card} where={where} narrow={narrow} />
      </>
    )
  } else if (p.call === 'needs-you') {
    actions = <OpenConversationButton card={card} variant="default" />
  } else if (p.call === 'failed') {
    actions = <RetryButton card={card} snapshot={snapshot} inDialog />
  } else if (p.busy) {
    actions = (
      <Tooltip label="Stop the agent. You can give the task again">
        <Button type="button" size="sm" variant="outline" onClick={() => void act({ type: 'board/stop', cardId: card.id })}>
          Stop
        </Button>
      </Tooltip>
    )
  } else if (p.call !== 'decision') {
    actions = <GiveButton card={card} snapshot={snapshot} inDialog />
  }

  const history = [...card.history].reverse()
  const shownHistory = allHistory ? history : history.slice(0, 5)
  const now = new Date()

  return (
    <>
      <div className="tb-cardhead flex items-start justify-between gap-2 border-b border-hairline px-5 py-4">
        <div className="min-w-0 flex-1 pt-0.5">
          <DialogTitle asChild>
            <div
              ref={titleRef}
              className="tb-title-edit"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              role="textbox"
              aria-label="Title"
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  ;(event.target as HTMLElement).blur()
                }
              }}
            >
              {card.title}
            </div>
          </DialogTitle>
        </div>
        <div className="flex items-center gap-1">
          <CardMenu card={card} p={p} snapshot={snapshot} density="header" inDialog />
          <Tooltip label="Close">
            <button
              type="button"
              aria-label="Close dialog"
              className="flex h-7 w-7 items-center justify-center rounded-md border-none bg-transparent text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink-strong"
              onClick={() => openCard(null)}
            >
              <Icon name="x" size={16} tone="inherit" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div>
          {whose ? <div className="tb-whose">{whose}</div> : null}
          {p.dialog ? (
            <div className={cn('tb-state', toneClass(p.tone === 'faint' ? 'muted' : p.tone))}>
              <StateGlyph p={p} className="mt-[1.5px]" />
              <span>{p.dialog}</span>
            </div>
          ) : null}
          {sub ? <div className="tb-sub">{sub}</div> : null}
          {promptHere ? (
            <GivePromptPanel prompt={prompt} snapshot={snapshot} onShowCalls={onShowCalls} />
          ) : note && note.cardId === card.id && note.where === where ? (
            <NoteBox card={card} kind={note.kind} snapshot={snapshot} inDialog />
          ) : actions ? (
            <div className="tb-actions" style={{ marginTop: 12 }}>{actions}</div>
          ) : null}
        </div>

        {card.ask && !card.locked ? (
          <>
            <Label>Decision</Label>
            <div className="tb-result">
              <div className="text-[13px] text-ink-strong">
                {agent} asks: {card.ask.question}
              </div>
              <CallActions card={card} p={{ ...p, call: 'decision' }} snapshot={snapshot} where="ask" stacked inDialog />
            </div>
          </>
        ) : null}
        {card.result && !card.ask ? (
          <>
            <Label>Result</Label>
            <div className="tb-result">
              {card.result.summary}
              <CheckList card={card} />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
                {card.result.files.length
                  ? `Modified ${card.result.files.length} file${card.result.files.length === 1 ? '' : 's'}`
                  : 'No files changed'}
                {card.result.files.map((file) => (
                  <FileChip key={file} path={file} />
                ))}
              </div>
            </div>
          </>
        ) : null}
        {card.stage === 'idea' && card.review ? (
          <>
            <Label>Review</Label>
            <div className="tb-result">
              <div className={cn('tb-verdict', toneClass(VERDICTS[card.review.verdict].tone))}>
                <Icon name={VERDICTS[card.review.verdict].glyph} size={14} tone="inherit" />
                {VERDICTS[card.review.verdict].label}
              </div>
              <div className="mt-1">{card.review.why}</div>
              <div className="tb-suggest">
                <div className="text-[13px] font-medium text-ink-strong">{card.review.title}</div>
                {card.review.description ? <div className="tb-sub">{card.review.description}</div> : null}
                <div className="tb-sub">How big: {card.review.size}.</div>
              </div>
            </div>
          </>
        ) : null}

        <Label>Done when</Label>
        <input
          className={cn(INPUT, 'h-8')}
          value={doneWhen}
          placeholder="What does done look like? One line."
          aria-label="Done when"
          maxLength={200}
          onChange={(event) => setDoneWhen(event.target.value)}
          onBlur={saveDoneWhen}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          }}
        />

        <Label>Description</Label>
        {editing ? (
          <Textarea
            autoFocus
            rows={6}
            value={description}
            aria-label="Description"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={saveDescription}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setDescription(card.description)
                setEditing(false)
              }
            }}
          />
        ) : (
          <Description card={card} onEdit={() => setEditing(true)} />
        )}

        <Label>Files</Label>
        <div className="flex flex-wrap gap-1.5">
          {card.files.map((file) => (
            <FileChip key={file.path} path={file.path} exists={file.exists} />
          ))}
          <Tooltip label="Choose files in this folder for the agent to work on">
            <button
              type="button"
              className="tb-linkbtn inline-flex h-6 items-center gap-1"
              style={{ margin: 0 }}
              onClick={() => notify({ type: 'board/add-files', cardId: card.id })}
            >
              <Icon name="plus" size={12} tone="inherit" />
              Add files…
            </button>
          </Tooltip>
        </div>

        <Label>Stage</Label>
        <div>
          <select
            className="tb-select"
            aria-label="Stage"
            value={card.stage}
            disabled={card.locked}
            onChange={(event) => void moveCard(card.id, event.target.value as CardStage)}
          >
            {CARD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_NAMES[stage]}
              </option>
            ))}
          </select>
          {card.locked ? <div className="mt-1.5 text-[12px] text-ink-faint">The agent is still working, so the stage can’t change.</div> : null}
        </div>

        <Label>History</Label>
        <div className="tb-hist">
          {shownHistory.map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="contents">
              <span className="t">{historyTime(entry.at, now)}</span>
              <span>{entry.what}</span>
            </div>
          ))}
        </div>
        {history.length > 5 ? (
          <button type="button" className="tb-linkbtn" onClick={() => setAllHistory(!allHistory)}>
            {allHistory ? 'Show fewer' : `Show all ${history.length}`}
          </button>
        ) : null}
      </div>
    </>
  )
}

/** "Delete this task?" — the file goes to the system trash. */
export function DeleteConfirm({ snapshot }: { snapshot: BoardSnapshot }) {
  const cardId = useBoardUi((state) => state.confirmDeleteId)
  const askDelete = useBoardUi((state) => state.askDelete)
  const openCard = useBoardUi((state) => state.openCard)
  const card = snapshot.cards.find((item) => item.id === cardId)
  if (!card) return null
  return (
    <Dialog open onOpenChange={(open) => !open && askDelete(null)}>
      <DialogContent className="max-w-[400px]" aria-describedby={undefined} role="alertdialog">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <DialogTitle>Delete this task?</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-ink-muted">“{card.title}” moves to the system trash with its history. You can restore the file from there.</p>
        </div>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={() => askDelete(null)}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="danger"
            onClick={() => {
              askDelete(null)
              openCard(null)
              void act({ type: 'board/delete', cardId: card.id })
            }}
          >
            Delete
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
