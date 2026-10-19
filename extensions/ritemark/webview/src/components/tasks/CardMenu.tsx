/**
 * CardMenu — a card's More actions (…) menu on every surface (Sprint 130).
 * Give to…, Retry with…, Review with… and Move to… open in place inside the
 * menu instead of a side submenu, which would not fit the narrow side bar.
 * The items follow the card's state (design.md §11).
 */

import { useState } from 'react'
import type { AgentId } from '../../../../src/agent/types'
import type { BoardCardView, BoardSnapshot, CardStage } from '../../../../src/taskBoard/protocol'
import { CARD_STAGES } from '../../../../src/taskBoard/cardTypes'
import { cn } from '../../lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreActionsTrigger } from '../ui/dropdown-menu'
import { Icon, type PhosphorIconName } from '../ui/Icon'
import { act, giveCard, moveCard, useBoardUi } from './boardUi'
import { STAGE_NAMES, agentName, type CardPresentation } from './taskCopy'

const FULL_NAMES: Record<AgentId, string> = { 'claude-code': 'Claude Code', codex: 'ChatGPT', opencode: 'OpenCode' }
type Sub = 'give' | 'retry' | 'review' | 'move'

interface Item {
  label: string
  icon: PhosphorIconName
  run?: () => void
  sub?: Sub
  disabled?: boolean
  danger?: boolean
}

export function CardMenu({
  card,
  p,
  snapshot,
  density = 'row',
  className,
}: {
  card: BoardCardView
  p: CardPresentation
  snapshot: BoardSnapshot
  density?: 'row' | 'header'
  className?: string
}) {
  const [open, setOpen] = useState<Sub | null>(null)
  const askDelete = useBoardUi((state) => state.askDelete)
  const busy = card.locked
  const canOpen = Boolean(card.handoff?.canOpen)
  const conversation: Item = { label: 'Open conversation', icon: 'chat-circle', run: () => void act({ type: 'board/open-conversation', cardId: card.id }) }
  const move: Item = { label: 'Move to…', icon: 'arrows-down-up', sub: 'move' }

  const items: Item[] = []
  if (card.archived !== null) {
    // An archived card (D15): put it back, or delete it.
    items.push({ label: 'Restore', icon: 'arrow-counter-clockwise', run: () => void act({ type: 'board/restore', cardId: card.id }) })
    if (canOpen) items.push(conversation)
  } else if (card.stage === 'idea') {
    const reviewing = card.reviewing ? agentName(card.reviewing.runtimeId) : null
    items.push(
      reviewing
        ? { label: `Review with… (${reviewing} is reviewing)`, icon: 'sparkle', disabled: true }
        : { label: 'Review with…', icon: 'sparkle', sub: 'review' },
      reviewing
        ? { label: `Make it a task (${reviewing} is reviewing)`, icon: 'arrow-up-right', disabled: true }
        : {
            label: 'Make it a task',
            icon: 'arrow-up-right',
            run: () => void (card.review ? act({ type: 'board/accept-review', cardId: card.id }) : moveCard(card.id, 'todo')),
          },
      card.dropped
        ? { label: 'Bring back', icon: 'eye', run: () => void act({ type: 'board/bring-back', cardId: card.id }) }
        : { label: 'Drop', icon: 'eye-slash', run: () => void act({ type: 'board/drop', cardId: card.id }) },
    )
  } else if (card.stage === 'done') {
    items.push({ label: 'Reopen', icon: 'arrow-counter-clockwise', run: () => void moveCard(card.id, 'todo') })
    if (canOpen) items.push(conversation)
  } else if (busy && p.call !== 'needs-you') {
    items.push(conversation, { label: 'Stop', icon: 'x-circle', run: () => void act({ type: 'board/stop', cardId: card.id }) })
  } else if (p.call === 'needs-you') {
    items.push(
      conversation,
      { label: 'Mark done (the agent is still working)', icon: 'check', disabled: true },
      { label: 'Move to… (the agent is still working)', icon: 'arrows-down-up', disabled: true },
    )
  } else if (p.call === 'decision' || p.call === 'review') {
    if (canOpen) items.push(conversation)
    items.push({ label: 'Mark done', icon: 'check', run: () => void act({ type: 'board/mark-done', cardId: card.id }) }, move)
  } else if (p.call === 'failed') {
    items.push({ label: 'Retry with…', icon: 'arrow-counter-clockwise', sub: 'retry' })
    if (canOpen) items.push(conversation)
    items.push(move)
  } else {
    items.push({ label: 'Give to…', icon: 'sparkle', sub: 'give' }, move)
    if (canOpen) items.push(conversation)
  }

  const runAgent = (sub: Sub, runtimeId: AgentId) => {
    if (sub === 'give') void giveCard(card.id, runtimeId)
    else if (sub === 'retry') void act({ type: 'board/retry', cardId: card.id, runtimeId })
    else if (sub === 'review') void act({ type: 'board/review-idea', cardId: card.id, runtimeId })
  }

  const subRows = (sub: Sub) => {
    if (sub === 'move') {
      return CARD_STAGES.map((stage: CardStage) => (
        <DropdownMenuItem
          key={stage}
          role="menuitemradio"
          aria-checked={card.stage === stage}
          disabled={card.stage === stage}
          className="pl-[30px]"
          onSelect={() => void moveCard(card.id, stage)}
        >
          <span>{STAGE_NAMES[stage]}</span>
          {card.stage === stage ? <span className="ml-auto"><Icon name="check" size={14} tone="inherit" /></span> : null}
        </DropdownMenuItem>
      ))
    }
    const selected = sub === 'give' ? snapshot.defaultRuntime : card.handoff?.runtimeId ?? snapshot.defaultRuntime
    return snapshot.runtimes.map((runtime) => (
      <DropdownMenuItem
        key={runtime.id}
        role="menuitemradio"
        aria-checked={runtime.id === selected}
        disabled={!runtime.usable}
        className="pl-[30px]"
        onSelect={() => runAgent(sub, runtime.id)}
      >
        <span>
          {FULL_NAMES[runtime.id]}
          {runtime.usable ? '' : ' · not ready'}
        </span>
        {runtime.id === selected ? <span className="ml-auto"><Icon name="check" size={14} tone="inherit" /></span> : null}
      </DropdownMenuItem>
    ))
  }

  return (
    <DropdownMenu modal={false} onOpenChange={(next) => !next && setOpen(null)}>
      <MoreActionsTrigger label={`More actions for ${card.title}`} density={density} className={className} />
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {items.map((item) => (
          <div key={item.label}>
            <DropdownMenuItem
              disabled={item.disabled}
              aria-expanded={item.sub ? open === item.sub : undefined}
              className={cn(item.sub && open === item.sub && 'bg-surface-soft')}
              onSelect={(event) => {
                if (item.sub) {
                  event.preventDefault()
                  setOpen(open === item.sub ? null : item.sub)
                } else {
                  item.run?.()
                }
              }}
            >
              <Icon name={item.icon} size={14} tone="inherit" />
              <span>{item.label}</span>
              {item.sub ? (
                <span className="ml-auto">
                  <Icon name={open === item.sub ? 'caret-down' : 'caret-right'} size={12} tone="inherit" />
                </span>
              ) : null}
            </DropdownMenuItem>
            {item.sub && open === item.sub ? subRows(item.sub) : null}
          </div>
        ))}
        <DropdownMenuSeparator />
        {card.archived === null ? (
          <DropdownMenuItem disabled={busy} onSelect={() => void act({ type: 'board/archive', cardId: card.id })}>
            <Icon name="archive" size={14} tone="inherit" />
            <span>{busy ? 'Archive (stop the agent first)' : 'Archive'}</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem tone="danger" disabled={busy} onSelect={() => askDelete(card.id)}>
          <Icon name="trash" size={14} tone="inherit" />
          <span>{busy ? 'Delete… (stop the agent first)' : 'Delete…'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
