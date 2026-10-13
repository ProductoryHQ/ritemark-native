/**
 * CardParts — the pieces a card shows on every surface (Sprint 130): its glyph
 * (or the tick circle), the answer buttons of a call, the note box, Check
 * these, file chips, and the choice a Give to can produce (conflict guard,
 * Doing limit). Ported from the prototype; words from `taskCopy.ts`.
 */

import { useEffect, useRef, useState } from 'react'
import type { AgentId } from '../../../../src/agent/types'
import type { BoardCardView, BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { AgentSplitButton } from './AgentSplitButton'
import { notify } from './boardClient'
import { act, giveCard, sendNote, useBoardUi, type GivePrompt } from './boardUi'
import { agentName, cardAgent, presentCard, type CardPresentation, type Tone } from './taskCopy'

export const INPUT =
  'w-full px-3 py-1.5 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]'

/**
 * A new card's title, in a field of three lines that grows with the text, so
 * an idea or a task reads whole while it is written (Jarmo, 2026-10-13). A
 * title is one line: Enter adds it, and a pasted line break becomes a space.
 */
export function TitleField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  autoFocus,
  onBlur,
  onEscape,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  label: string
  autoFocus?: boolean
  onBlur?: () => void
  onEscape?: () => void
}) {
  return (
    <textarea
      autoFocus={autoFocus}
      rows={3}
      className={cn(INPUT, 'block max-h-[220px] min-h-[72px] resize-none leading-snug [field-sizing:content]')}
      placeholder={placeholder}
      aria-label={label}
      value={value}
      maxLength={200}
      onChange={(event) => onChange(event.target.value.replace(/\s*[\r\n]+\s*/g, ' '))}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onEscape?.()
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          if (value.trim()) onSubmit()
        }
      }}
    />
  )
}

export const SECTION ='flex items-center gap-1.5 px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint'

/** A small icon button in a section or column header (+, Archive all done). */
export function HeaderIconButton({
  icon,
  label,
  tip,
  onClick,
  className,
}: {
  icon: 'plus' | 'archive'
  label: string
  tip: string
  onClick: () => void
  className?: string
}) {
  return (
    <Tooltip label={tip} className={cn('inline-flex', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className="size-[18px] rounded-[4px] text-ink-muted hover:bg-accent-soft hover:text-accent"
        onClick={onClick}
      >
        <Icon name={icon} size={12} tone="inherit" />
      </Button>
    </Tooltip>
  )
}

/** Re-render once a minute, so wait times stay true. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function usePresenter(snapshot: BoardSnapshot, now: Date): (card: BoardCardView) => CardPresentation {
  const titles = new Map(snapshot.cards.map((card) => [card.id, card.title]))
  return (card) => presentCard(card, { now, titleOf: (id) => titles.get(id) ?? null })
}

export function toneClass(tone: Tone): string {
  return `tone-${tone}`
}

/** The state glyph, coloured by its tone. */
export function StateGlyph({ p, className }: { p: CardPresentation; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0', toneClass(p.tone), className)}>
      <Icon name={p.glyph} size={16} tone="inherit" className={cn('tb-glyph', p.spin && 'tb-spin')} />
    </span>
  )
}

/** A plain card's tick circle (click = Mark done); otherwise its state glyph. */
export function CardGlyph({ card, p }: { card: BoardCardView; p: CardPresentation }) {
  if (p.plain && card.stage !== 'done' && card.stage !== 'idea') {
    return (
      // pointer-events-auto: on a board tile the circle sits in the layer that
      // lets clicks fall through to the tile's open-the-card button.
      <Tooltip label={`Mark “${card.title}” done`} className="pointer-events-auto relative z-10">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="tb-tick mt-[0.75px] size-5 rounded-full p-0 text-[var(--r-ink-faint)] hover:bg-transparent hover:text-[var(--r-accent)]"
          aria-label={`Mark ${card.title} done`}
          onClick={(event) => {
            event.stopPropagation()
            void act({ type: 'board/mark-done', cardId: card.id })
          }}
        >
          <Icon name="circle" size={16} tone="inherit" className="off size-4" />
          <Icon name="check-circle" size={16} tone="inherit" className="on size-4" />
        </Button>
      </Tooltip>
    )
  }
  return <StateGlyph p={p} />
}

export function CheckList({ card }: { card: BoardCardView }) {
  if (!card.result?.check.length) return null
  return (
    <div className="tb-check">
      <div className="tb-check-h">
        <Icon name="list-checks" size={14} tone="inherit" />
        Check these
      </div>
      <ul>
        {card.result.check.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function FileChip({ path, exists = true }: { path: string; exists?: boolean }) {
  return (
    <Tooltip label={exists ? path : `${path} is no longer in the project`} className="min-w-0 max-w-full">
      <Button
        type="button"
        variant="outline"
        className={cn(
          'tb-file h-auto shrink justify-start gap-1 rounded-[6px] border-[var(--r-hairline)] bg-[var(--r-surface)] px-2 py-0.5 text-[12px] font-normal text-[var(--r-ink-body)] shadow-none hover:border-[var(--r-hairline-strong)] hover:bg-[var(--r-surface)] hover:text-[var(--r-ink-strong)] has-[>svg]:px-2',
          !exists && 'missing text-[var(--r-ink-faint)]',
        )}
        onClick={(event) => {
          event.stopPropagation()
          notify({ type: 'board/open-file', path })
        }}
      >
        <Icon name="file-text" size={12} tone="inherit" className="size-3" />
        <span>{path.split('/').pop()}</span>
      </Button>
    </Tooltip>
  )
}

/** The in-place reply box: Ask for changes…, or Something else… for a decision. */
export function NoteBox({
  card,
  kind,
  snapshot,
}: {
  card: BoardCardView
  kind: 'changes' | 'answer'
  snapshot: BoardSnapshot
}) {
  const [text, setText] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const closeNote = useBoardUi((state) => state.closeNote)
  const pending = useBoardUi((state) => Boolean(state.pending[card.id]))
  useEffect(() => area.current?.focus(), [])
  const runtime = cardAgent(card, snapshot.defaultRuntime)
  const send = (runtimeId: AgentId) => {
    if (!text.trim()) return
    void sendNote(card.id, text, runtimeId)
  }
  return (
    <div className="tb-note pointer-events-auto relative z-10" onClick={(event) => event.stopPropagation()}>
      <label htmlFor={`note-${card.id}`}>{kind === 'changes' ? 'What should change?' : 'Your answer'}</label>
      <textarea
        id={`note-${card.id}`}
        ref={area}
        rows={3}
        className={cn(INPUT, 'resize-y')}
        value={text}
        placeholder={kind === 'changes' ? 'For example: shorter, and keep the numbers' : 'In your own words'}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') closeNote()
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send(runtime)
        }}
      />
      {/* The row wraps inside the panel: at side-bar width Cancel goes under
          Send to instead of past the panel's edge. */}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        <AgentSplitButton
          className="min-w-0 max-w-full"
          verb="Send to"
          runtimes={snapshot.runtimes}
          selected={runtime}
          onRun={send}
          disabled={pending || !text.trim()}
          tip={(agent) => `Send this to ${agent} in the same conversation`}
        />
        <Tooltip label="Close without sending">
          <Button type="button" size="sm" variant="ghost" onClick={closeNote}>
            Cancel
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

/** Give to {agent}, Retry with {agent}: the card's agent work buttons. */
export function GiveButton({ card, snapshot }: { card: BoardCardView; snapshot: BoardSnapshot }) {
  const pending = useBoardUi((state) => Boolean(state.pending[card.id]))
  const sending = card.handoff?.state === 'accepting'
  const again = Boolean(card.handoff?.canOpen)
  const runtime = snapshot.defaultRuntime
  return (
    <AgentSplitButton
      verb="Give to"
      label={sending ? `Sending to ${agentName(card.handoff!.runtimeId)}…` : undefined}
      runtimes={snapshot.runtimes}
      selected={runtime}
      disabled={pending || sending}
      onRun={(runtimeId) => void giveCard(card.id, runtimeId)}
      tip={(agent) =>
        again ? `Continue this task’s conversation with ${agent}` : `Start a new conversation about this task in the AI sidebar, with ${agent}`
      }
    />
  )
}

export function RetryButton({ card, snapshot }: { card: BoardCardView; snapshot: BoardSnapshot }) {
  const pending = useBoardUi((state) => Boolean(state.pending[card.id]))
  return (
    <AgentSplitButton
      verb="Retry with"
      runtimes={snapshot.runtimes}
      selected={cardAgent(card, snapshot.defaultRuntime)}
      disabled={pending}
      onRun={(runtimeId) => void act({ type: 'board/retry', cardId: card.id, runtimeId })}
      tip={(agent) => `Try this task again with ${agent}, in the same conversation`}
    />
  )
}

export function OpenConversationButton({ card, variant = 'outline' }: { card: BoardCardView; variant?: 'default' | 'outline' }) {
  const canOpen = Boolean(card.handoff?.canOpen)
  return (
    <Tooltip label={canOpen ? 'Open this task’s conversation in the AI sidebar' : 'This task’s conversation is not on this computer'}>
      <Button type="button" size="sm" variant={variant} disabled={!canOpen} onClick={() => void act({ type: 'board/open-conversation', cardId: card.id })}>
        Open conversation
      </Button>
    </Tooltip>
  )
}

export function MarkDoneButton({ card }: { card: BoardCardView }) {
  return (
    <Tooltip label="Move this task to Done">
      <Button type="button" size="sm" onClick={() => void act({ type: 'board/mark-done', cardId: card.id })}>
        Mark done
      </Button>
    </Tooltip>
  )
}

export function AskForChangesButton({ card, where, narrow = false }: { card: BoardCardView; where: string; narrow?: boolean }) {
  const openNote = useBoardUi((state) => state.openNote)
  if (narrow) {
    return (
      <Tooltip label="Ask for changes. It goes to the same conversation">
        <Button type="button" size="icon-sm" variant="outline" aria-label="Ask for changes" onClick={() => openNote(card.id, where, 'changes')}>
          <Icon name="pencil-simple" size={16} tone="inherit" />
        </Button>
      </Tooltip>
    )
  }
  return (
    <Tooltip label="Say what to change. It goes to the same conversation">
      <Button type="button" size="sm" variant="outline" onClick={() => openNote(card.id, where, 'changes')}>
        Ask for changes…
      </Button>
    </Tooltip>
  )
}

/** The buttons that answer a call, in a row, a call card or the card page. */
export function CallActions({
  card,
  p,
  snapshot,
  where,
  narrow = false,
  stacked = false,
}: {
  card: BoardCardView
  p: CardPresentation
  snapshot: BoardSnapshot
  where: string
  narrow?: boolean
  stacked?: boolean
}) {
  const note = useBoardUi((state) => state.note)
  const openNote = useBoardUi((state) => state.openNote)
  if (note && note.cardId === card.id && note.where === where) {
    return <NoteBox card={card} kind={note.kind} snapshot={snapshot} />
  }
  const agent = agentName(cardAgent(card, snapshot.defaultRuntime))
  switch (p.call) {
    case 'review':
      return (
        <div className="tb-actions">
          <MarkDoneButton card={card} />
          <AskForChangesButton card={card} where={where} narrow={narrow} />
        </div>
      )
    case 'decision':
      if (!card.ask) return null
      return (
        <div className={cn('tb-actions', stacked ? 'stack' : 'flex-wrap')}>
          {card.ask.options.map((option, index) => (
            <Tooltip key={option} label={`Answer “${option}”. ${agent} continues right away`} className={cn(stacked && 'w-full')}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(stacked && 'w-full tb-opt')}
                onClick={() => void act({ type: 'board/answer', cardId: card.id, optionIndex: index })}
              >
                <span className="truncate">{option}</span>
              </Button>
            </Tooltip>
          ))}
          <Tooltip label="Answer in your own words" className={cn(stacked && 'w-full')}>
            <Button type="button" size="sm" variant="outline" className={cn(stacked && 'w-full tb-opt')} onClick={() => openNote(card.id, where, 'answer')}>
              <span className="truncate">Something else…</span>
            </Button>
          </Tooltip>
        </div>
      )
    case 'needs-you':
      return (
        <div className="tb-actions">
          <OpenConversationButton card={card} />
        </div>
      )
    case 'failed':
      return (
        <div className="tb-actions">
          <RetryButton card={card} snapshot={snapshot} />
          {narrow ? null : <OpenConversationButton card={card} />}
        </div>
      )
    default:
      return null
  }
}

/** Conflict guard (Wait for it / Start now) or a full Doing (Queue it / Start anyway). */
export function GivePromptPanel({
  prompt,
  snapshot,
  onShowCalls,
}: {
  prompt: GivePrompt
  snapshot: BoardSnapshot
  /** Where "See what waits on you" goes on this surface. */
  onShowCalls?: () => void
}) {
  const clearPrompt = useBoardUi((state) => state.clearPrompt)
  const agent = agentName(prompt.runtimeId)
  if (prompt.kind === 'conflict') {
    return (
      <div className="tb-conflict" role="alert">
        <div className="flex items-start gap-2">
          <span className="tone-amber inline-flex shrink-0"><Icon name="warning" size={16} tone="inherit" /></span>
          <div>
            <b>“{prompt.withTitle}”</b> is working on <b>{prompt.file.split('/').pop()}</b> right now. Two agents changing the same file can overwrite each other’s work.
          </div>
        </div>
        <div className="tb-actions" style={{ marginTop: 10 }}>
          <Tooltip label={`Start ${agent} on this task by itself when “${prompt.withTitle}” finishes`}>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                clearPrompt()
                void act({ type: 'board/wait', cardId: prompt.cardId, runtimeId: prompt.runtimeId })
              }}
            >
              Wait for it
            </Button>
          </Tooltip>
          <Tooltip label="Start anyway. Both agents may change the same file">
            <Button type="button" size="sm" variant="outline" onClick={() => void giveCard(prompt.cardId, prompt.runtimeId, { force: true })}>
              Start now
            </Button>
          </Tooltip>
          <Tooltip label="Cancel">
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={clearPrompt}>
              <Icon name="x" size={16} tone="inherit" />
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }
  return (
    <div className="tb-conflict tb-slot" role="status">
      <div className="flex items-start gap-2">
        <span className="tone-accent inline-flex shrink-0"><Icon name="clock" size={16} tone="inherit" /></span>
        <div>
          <b>Doing is full: {prompt.count} of {prompt.limit}.</b> Review or decide what waits on you, and this task starts by itself when there’s room.
          {snapshot.attention.count > 0 && onShowCalls ? (
            <>
              {' '}
              <a
                href="#"
                className="tb-inlink"
                onClick={(event) => {
                  event.preventDefault()
                  onShowCalls()
                }}
              >
                See what waits on you
              </a>
            </>
          ) : null}
        </div>
      </div>
      <div className="tb-actions" style={{ marginTop: 10 }}>
        <Tooltip label={`${agent} starts on it by itself when a task leaves Doing`}>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              clearPrompt()
              void act({ type: 'board/queue', cardId: prompt.cardId, runtimeId: prompt.runtimeId })
            }}
          >
            Queue it
          </Button>
        </Tooltip>
        <Tooltip label={`Start now. Doing goes to ${prompt.count + 1} of ${prompt.limit}`}>
          <Button type="button" size="sm" variant="outline" onClick={() => void giveCard(prompt.cardId, prompt.runtimeId, { overLimit: true })}>
            Start anyway
          </Button>
        </Tooltip>
        <Tooltip label="Cancel">
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={clearPrompt}>
            <Icon name="x" size={16} tone="inherit" />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
