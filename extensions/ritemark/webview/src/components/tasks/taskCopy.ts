/**
 * taskCopy — the words, glyph and tone for every card state (Sprint 130,
 * design.md §10), shared by the Tasks side bar, the board and the card dialog.
 *
 * A card's state follows its conversation, so these words come from the AI
 * sidebar's own vocabulary (Working, Needs you, Interrupted, Sending…, Queued
 * for …). Pure: no React, no host calls; tested in taskCopy.test.ts.
 */

import type { AgentId } from '../../../../src/agent/types'
import { RUNTIME_LABELS } from '../../../../src/runtime/availability'
import type { BoardCardView, CallKind, NeedsKind } from '../../../../src/taskBoard/protocol'
import type { PhosphorIconName } from '../ui/Icon'

export type Tone = 'accent' | 'amber' | 'red' | 'muted' | 'faint'

export interface CardPresentation {
  glyph: PhosphorIconName
  tone: Tone
  spin: boolean
  /** Rows and tiles; empty for a plain card. */
  row: string
  /** The card dialog's state line. */
  dialog: string
  call: CallKind | null
  /** The agent is in flight or blocked mid-turn. */
  busy: boolean
  /** Waiting to start by itself. */
  waiting: boolean
  /** Nothing in flight, nothing waiting on the user: the tick circle. */
  plain: boolean
}

export const NEEDS: Record<NeedsKind, { glyph: PhosphorIconName; word: string; dialog: string; sentence: string }> = {
  approval: { glyph: 'shield-check', word: 'approval', dialog: 'Waiting for approval', sentence: 'The agent is waiting for your approval.' },
  question: { glyph: 'question', word: 'question', dialog: 'Needs your answer', sentence: 'The agent asked you a question.' },
  plan: { glyph: 'clipboard-text', word: 'plan review', dialog: 'Waiting for your review', sentence: 'The agent wrote a plan for you to review.' },
}

export const VERDICTS = {
  ready: { label: 'Good to go', glyph: 'check', tone: 'accent' },
  unclear: { label: 'Needs detail', glyph: 'pencil-simple', tone: 'muted' },
  'already-on-board': { label: 'Already on the board', glyph: 'copy', tone: 'muted' },
  'not-a-task': { label: 'Not a task', glyph: 'note-pencil', tone: 'muted' },
} as const satisfies Record<string, { label: string; glyph: PhosphorIconName; tone: Tone }>

export const STAGE_NAMES = { idea: 'Ideas', todo: 'To do', doing: 'Doing', done: 'Done' } as const

export function agentName(id: AgentId): string {
  return RUNTIME_LABELS[id]
}

/** How long something has waited: "just now", "12 min", "2h", "3d". */
export function waited(sinceIso: string | null | undefined, now: Date): string {
  if (!sinceIso) return 'just now'
  const minutes = Math.floor((now.getTime() - Date.parse(sinceIso)) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** A turn's length: "52s", "4m 12s". */
export function duration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  if (whole < 60) return `${whole}s`
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, '0')}s`
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** A day for rows: "Today", "Yesterday", "Tue" within a week, else "12 Oct". */
export function shortDay(iso: string, now: Date): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return DAY[date.getDay()]
  return `${date.getDate()} ${MONTH[date.getMonth()]}`
}

/** A day heading in the Log: "Today", "Yesterday", "Tuesday", "12 Oct". */
export function logDay(iso: string, now: Date): string {
  const label = shortDay(iso, now)
  const index = DAY.indexOf(label)
  return index >= 0 ? DAY_LONG[index] : label
}

/** A history time: "Today 10:31", "Tue 14:05", "12 Oct 09:02". */
export function historyTime(iso: string, now: Date): string {
  if (Number.isNaN(Date.parse(iso))) return iso
  return `${shortDay(iso, now)} ${clock(new Date(iso))}`
}

export function timeOfDay(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? '' : clock(new Date(iso))
}

/** "Draft the steering…" for tight places: cut at a word, as the host's history lines are. */
export function shortTitle(title: string, max = 26): string {
  if (title.length <= max) return title
  const cut = title.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function doneAt(card: BoardCardView): string | null {
  for (let index = card.history.length - 1; index >= 0; index -= 1) {
    if (card.history[index].what === 'Marked done') return card.history[index].at
  }
  return card.updated
}

/**
 * The state of one card. `titleOf` names another card (Starts after "…"),
 * `call` comes from the snapshot (who moves next is derived on the host).
 */
export function presentCard(card: BoardCardView, context: { now: Date; titleOf: (cardId: string) => string | null }): CardPresentation {
  const base = { spin: false, call: card.call, busy: false, waiting: false, plain: false }
  const h = card.handoff
  const since = (iso: string | null | undefined) => waited(iso, context.now)

  if (card.stage === 'done') {
    const at = doneAt(card)
    const day = at ? shortDay(at, context.now) : 'Today'
    return { ...base, glyph: 'check-circle', tone: 'muted', row: `Done · ${day}`, dialog: at ? `Done · ${day} ${timeOfDay(at)}` : 'Done', call: null }
  }
  if (card.stage === 'idea' && !h) {
    if (card.dropped) return { ...base, glyph: 'eye-slash', tone: 'faint', row: 'Dropped', dialog: 'Dropped', call: null }
    if (card.review) {
      const verdict = VERDICTS[card.review.verdict]
      return { ...base, glyph: verdict.glyph, tone: verdict.tone, row: verdict.label, dialog: verdict.label }
    }
    return { ...base, glyph: 'lightbulb', tone: 'faint', row: 'Not reviewed', dialog: 'Not reviewed' }
  }

  if (h?.state === 'waiting') {
    const waitFor = h.waitFor
    if (waitFor?.kind === 'conflict') {
      const title = context.titleOf(waitFor.cardId) ?? 'another task'
      return { ...base, glyph: 'clock', tone: 'muted', row: `Starts after “${shortTitle(title)}”`, dialog: `Starts when “${title}” finishes`, waiting: true }
    }
    const words = waitFor?.kind === 'capacity' ? 'Starts when the AI sidebar has room' : 'Starts when Doing has room'
    return { ...base, glyph: 'clock', tone: 'muted', row: words, dialog: words, waiting: true }
  }

  if (h) {
    const agent = agentName(h.runtimeId)
    switch (h.state) {
      case 'accepting':
        return { ...base, glyph: 'circle-notch', spin: true, tone: 'accent', row: `Sending to ${agent}…`, dialog: `Sending to ${agent}…`, busy: true }
      case 'queued':
        return { ...base, glyph: 'clock', tone: 'muted', row: `Queued for ${agent}`, dialog: `Queued for ${agent}`, busy: true }
      case 'running':
        return { ...base, glyph: 'circle-notch', spin: true, tone: 'accent', row: `Working · ${agent}`, dialog: `Working · ${agent}`, busy: true }
      case 'needs-user': {
        const needs = NEEDS[h.needs ?? 'approval']
        return { ...base, glyph: needs.glyph, tone: 'amber', row: `Needs you · ${needs.word} · ${since(h.since)}`, dialog: needs.dialog, busy: true }
      }
      default:
        break
    }
  }

  if (card.ask) {
    return { ...base, glyph: 'question', tone: 'accent', row: `Decision for you · ${since(card.ask.at)}`, dialog: 'Decision for you' }
  }
  if (h?.state === 'failed') {
    const reason = h.failure ?? 'something went wrong'
    return { ...base, glyph: 'x-circle', tone: 'red', row: `Failed · ${reason} · ${since(h.since)}`, dialog: `Failed · ${reason}` }
  }
  if (h?.state === 'interrupted') {
    return { ...base, glyph: 'warning', tone: 'muted', row: `Interrupted · ${since(h.since)}`, dialog: 'Interrupted when Ritemark closed' }
  }
  if (h?.state === 'conversation-gone') {
    return { ...base, glyph: 'warning', tone: 'muted', row: 'Conversation no longer available', dialog: 'Conversation no longer available' }
  }
  if (card.call === 'review' && card.result) {
    const check = card.result.check.length
    return {
      ...base,
      glyph: 'eye',
      tone: 'accent',
      row: `Ready to review · ${since(card.result.at)}${check ? ` · ${check} to check` : ''}`,
      dialog: 'Ready to review',
    }
  }
  if (h?.state === 'cancelled') {
    return { ...base, glyph: 'x', tone: 'faint', row: 'Stopped', dialog: 'Stopped' }
  }
  return { ...base, glyph: 'circle', tone: 'faint', row: '', dialog: '', plain: true }
}

/** "Claude finished in 4m 12s" for a result, when the turn's length is known. */
export function finishedLine(card: BoardCardView): string | null {
  if (!card.result) return null
  const by = card.result.by
  const agent = by === 'claude' ? 'Claude' : by === 'codex' ? 'Codex' : by === 'opencode' ? 'OpenCode' : 'The agent'
  return card.result.seconds !== undefined ? `${agent} finished in ${duration(card.result.seconds)}` : `${agent} finished`
}

/** The agent a card's actions name: its conversation's, else the board's default. */
export function cardAgent(card: BoardCardView, fallback: AgentId): AgentId {
  return card.handoff?.runtimeId ?? fallback
}

/** "Modified 2 files: plan.md, notes.md". */
export function modifiedLine(files: string[]): string {
  if (files.length === 0) return 'No files changed'
  const names = files.map((file) => file.split('/').pop() ?? file)
  return `Modified ${files.length} file${files.length === 1 ? '' : 's'}: ${names.join(', ')}`
}
