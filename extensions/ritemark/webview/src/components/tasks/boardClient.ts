/**
 * boardClient — the board webviews' line to the host (Sprint 130).
 *
 * The host pushes a whole snapshot whenever the board changes; components read
 * it through `useBoardSnapshot`. Requests carry a request id and resolve with
 * the host's answer, so a button can show what happened (or what to choose
 * next: the conflict guard, the Doing limit).
 *
 * A move is drawn at once (Sprint 145, #597): the surface that moves a card
 * keeps it as a pending move and shows the host's snapshot with its pending
 * moves applied, so a dropped card is in its new place in the same frame. The
 * host stays the authority: a refusal drops the move (the card goes back), and
 * a snapshot that shows the card where it was asked to go ends it. A snapshot
 * built before the move was written can't put the card back for a frame.
 */

import { useSyncExternalStore } from 'react'
import { vscode } from '../../lib/vscode'
import type { BoardAnswer, BoardCardView, BoardHeadRow, BoardHostMessage, BoardRequest, BoardSnapshot, BoardSurface, BoardTab, CardStage } from '../../../../src/taskBoard/protocol'
import { CARD_STAGES } from '../../../../src/taskBoard/cardTypes'

type WithRequestId = Extract<BoardRequest, { requestId: string }>
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type BoardCall = DistributiveOmit<WithRequestId, 'requestId'>
export type BoardNotice = Exclude<BoardRequest, { requestId: string } | { type: 'board/ready' }>

// ── Moves drawn before the host answers (Sprint 145, #597) ──────────────────

/** A move this surface asked for and the host has not yet shown back. */
export interface PendingMove {
  token: number
  cardId: string
  stage: CardStage
  /** Where in the stage: before this card, at its end, or (neither) at its top, as the host places it. */
  beforeCardId?: string
  atEnd?: boolean
  /** When it was asked for (ms). */
  since: number
  /** When the host said yes (ms); the move then waits for a snapshot that shows it. */
  answeredAt: number | null
  /** The host's yes came with the store's revision: the first snapshot at or after it ends the move. */
  confirmAt?: number
}

/** The quiet sign on a moving card shows only after this long (experience 41: below a second a move feels immediate). */
export const SAVING_SIGN_AFTER_MS = 1000
/** A yes without a revision (an older host): how long the move waits for a snapshot that shows it. */
export const CONFIRM_WAIT_MS = 2000

function stageIndex(stage: CardStage): number {
  return CARD_STAGES.indexOf(stage)
}

/** Where a card goes in the host's order (stage, then rank) when it is put at the top or the end of `stage`. */
function edgeOfStage(cards: BoardCardView[], stage: CardStage, edge: 'top' | 'end'): number {
  const order = stageIndex(stage)
  if (edge === 'top') {
    const index = cards.findIndex((card) => stageIndex(card.stage) >= order)
    return index < 0 ? cards.length : index
  }
  const index = cards.findIndex((card) => stageIndex(card.stage) > order)
  return index < 0 ? cards.length : index
}

/**
 * The snapshot with one move applied: the card in its new stage and place, and the counts with it. A card that
 * isn't on the board (gone, archived) leaves the snapshot as it is. Pure, for the tests.
 */
export function placeCard(source: BoardSnapshot, move: Pick<PendingMove, 'cardId' | 'stage' | 'beforeCardId' | 'atEnd'>, nowIso: string): BoardSnapshot {
  const card = source.cards.find((item) => item.id === move.cardId)
  if (!card) return source
  const others = source.cards.filter((item) => item.id !== move.cardId)
  let placed: BoardCardView = card.stage === move.stage ? card : { ...card, stage: move.stage }
  let calls = source.calls
  if (move.stage === 'done' && card.stage !== 'done') {
    // What the host writes when a card is marked done: the history line (the Done column's window reads it), no
    // question left open, and nobody's move. A blocked agent's card can't be moved, so its call never gets here.
    placed = { ...placed, updated: nowIso, ask: null, call: null, move: null, nextUp: false, history: [...card.history, { at: nowIso, by: 'you', what: 'Marked done' }] }
    calls = calls.filter((call) => call.cardId !== card.id)
  } else if (card.call === 'review' && card.stage === 'doing' && move.stage !== 'doing') {
    // A result waits for review only in Doing (deriveWho): out of Doing, the card no longer waits on you.
    placed = { ...placed, call: null, move: null }
    calls = calls.filter((call) => call.cardId !== card.id)
  }
  let index: number
  const before = move.beforeCardId ? others.findIndex((item) => item.id === move.beforeCardId && item.stage === move.stage) : -1
  if (before >= 0) index = before
  else index = edgeOfStage(others, move.stage, move.beforeCardId || move.atEnd ? 'end' : 'top')
  let cards = [...others.slice(0, index), placed, ...others.slice(index)]
  if (card.stage === 'todo' || move.stage === 'todo') {
    // Next up is the top To do card that nothing is working on or waiting for (the host's nextUpId).
    const nextUp = cards.find((item) => item.stage === 'todo' && item.archived === null && item.move !== 'agent' && item.call === null)?.id ?? null
    cards = cards.map((item) => (item.nextUp === (item.id === nextUp) ? item : { ...item, nextUp: item.id === nextUp }))
  }
  const doing = cards.filter((item) => item.stage === 'doing' && item.archived === null).length
  return {
    ...source,
    cards,
    calls,
    attention:
      calls === source.calls
        ? source.attention
        : {
            count: calls.length,
            blocked: calls.filter((call) => call.kind === 'needs-you').length,
            oldestSince: calls.reduce<string | null>((min, call) => (min === null || call.since < min ? call.since : min), null),
          },
    doing: { ...source.doing, count: doing },
  }
}

/** The host's snapshot with this surface's pending moves applied, oldest first. */
export function applyPendingMoves(source: BoardSnapshot, moves: Iterable<PendingMove>, nowIso: string): BoardSnapshot {
  let out = source
  for (const move of [...moves].sort((a, b) => a.token - b.token)) out = placeCard(out, move, nowIso)
  return out
}

/** The snapshot shows the card where the move put it: its stage, and its place (top, end, or before that card). */
export function confirmsMove(source: BoardSnapshot, move: Pick<PendingMove, 'cardId' | 'stage' | 'beforeCardId' | 'atEnd'>): boolean {
  const inStage = source.cards.filter((card) => card.stage === move.stage)
  const index = inStage.findIndex((card) => card.id === move.cardId)
  if (index < 0) return false
  if (move.beforeCardId) return inStage[index + 1]?.id === move.beforeCardId
  if (move.atEnd) return index === inStage.length - 1
  return index === 0
}

let snapshot: BoardSnapshot | null = null
/** What the components read: the host's snapshot with this surface's pending moves applied. */
let view: BoardSnapshot | null = null
const pendingMoves = new Map<string, PendingMove>()
/** Cards whose move has been pending a second: they show the quiet sign. */
const savingCards = new Set<string>()
let moveTokens = 0
const listeners = new Set<() => void>()
/** The cards' quiet signs listen apart: a sign appearing redraws its card, not the board. */
const savingListeners = new Set<() => void>()

function publish(): void {
  view = snapshot && pendingMoves.size ? applyPendingMoves(snapshot, pendingMoves.values(), new Date().toISOString()) : snapshot
  for (const listener of listeners) listener()
  for (const listener of savingListeners) listener()
}

function endMove(cardId: string): void {
  pendingMoves.delete(cardId)
  savingCards.delete(cardId)
}

/**
 * A snapshot came. One built before a snapshot this surface already has is dropped (refreshes can finish out of
 * order); a new store (the extension host started again) starts the count over. Then the moves it shows are done:
 * it shows the card where the move put it, or it is at or after the move's own revision.
 */
function takeSnapshot(next: BoardSnapshot): boolean {
  if (snapshot && next.boardId === snapshot.boardId && next.revision !== undefined && snapshot.revision !== undefined && next.revision < snapshot.revision) {
    return false
  }
  if (snapshot && next.boardId !== snapshot.boardId) {
    pendingMoves.clear()
    savingCards.clear()
  }
  snapshot = next
  const now = Date.now()
  for (const [cardId, move] of pendingMoves) {
    const reached = move.confirmAt !== undefined && next.revision !== undefined && next.revision >= move.confirmAt
    const waitedOut = move.confirmAt === undefined && move.answeredAt !== null && now - move.answeredAt >= CONFIRM_WAIT_MS
    if (confirmsMove(next, move) || reached || waitedOut) endMove(cardId)
  }
  return true
}

/**
 * Draw a move now. Returns its token for `settleMove`, or null when nothing is drawn: a card an agent is working
 * on can't leave its stage (the host refuses and its notice says why), so it isn't moved for a frame and back.
 */
export function beginMove(cardId: string, stage: CardStage, position: { beforeCardId?: string; atEnd?: boolean } = {}): number | null {
  const card = (view ?? snapshot)?.cards.find((item) => item.id === cardId)
  if (!card || (card.locked && card.stage !== stage)) return null
  moveTokens += 1
  const token = moveTokens
  pendingMoves.set(cardId, { token, cardId, stage, ...position, since: Date.now(), answeredAt: null })
  savingCards.delete(cardId)
  // The quiet sign appears if the move is still pending after a second.
  setTimeout(() => {
    if (pendingMoves.get(cardId)?.token !== token) return
    savingCards.add(cardId)
    for (const listener of savingListeners) listener()
  }, SAVING_SIGN_AFTER_MS)
  publish()
  return token
}

/**
 * The host answered a move. A refusal puts the card back. A yes keeps it where it was drawn until a snapshot shows
 * it: one at or after the answer's revision (however long the host's next snapshot takes), or, from an older host
 * that sends none, one that shows the card there or a short wait.
 */
export function settleMove(token: number | null, ok: boolean, revision?: number): void {
  if (token === null) return
  const entry = [...pendingMoves.values()].find((move) => move.token === token)
  if (!entry) return
  const reached = revision !== undefined && snapshot?.revision !== undefined && snapshot.revision >= revision
  if (!ok || reached || (snapshot && confirmsMove(snapshot, entry))) {
    endMove(entry.cardId)
    publish()
    return
  }
  entry.answeredAt = Date.now()
  if (revision !== undefined) {
    entry.confirmAt = revision
    return
  }
  setTimeout(() => {
    if (pendingMoves.get(entry.cardId)?.token !== token) return
    endMove(entry.cardId)
    publish()
  }, CONFIRM_WAIT_MS)
}

/** The stage a card is being moved to, while that move has been pending a second or longer; else null. */
export function savingStage(cardId: string): CardStage | null {
  return savingCards.has(cardId) ? (pendingMoves.get(cardId)?.stage ?? null) : null
}

function subscribeSaving(listener: () => void): () => void {
  savingListeners.add(listener)
  return () => savingListeners.delete(listener)
}

export function useSavingStage(cardId: string): CardStage | null {
  return useSyncExternalStore(subscribeSaving, () => savingStage(cardId), () => savingStage(cardId))
}
const pending = new Map<string, (answer: BoardAnswer) => void>()
const focusListeners = new Set<(target: { tab?: BoardTab }) => void>()
const headRowListeners = new Set<(row: BoardHeadRow) => void>()
/** A head row that came before the list was drawn; the list takes it when it starts listening. */
let pendingHeadRow: BoardHeadRow | null = null
/** The card whose page is the active editor tab (the side bar highlights it). */
let activePage: string | null = null
const activeListeners = new Set<() => void>()
let installed = false
let counter = 0
let surfaceKind: BoardSurface | null = null

function install(): void {
  if (installed) return
  installed = true
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as BoardHostMessage | undefined
    if (!message || typeof message !== 'object') return
    if (message.type === 'board/state') {
      if (takeSnapshot(message.snapshot)) publish()
    } else if (message.type === 'board/result') {
      const resolve = pending.get(message.requestId)
      if (resolve) {
        pending.delete(message.requestId)
        resolve(message.answer)
      }
    } else if (message.type === 'board/focus') {
      // A card page asked to take the keyboard (W16): the editor holds the
      // focus, but it can stop at the webview's frame, short of this page.
      if (surfaceKind === 'page') window.focus()
      for (const listener of focusListeners) listener({ tab: message.tab })
    } else if (message.type === 'board/active-page') {
      activePage = message.cardId
      for (const listener of activeListeners) listener()
    } else if (message.type === 'board/head') {
      if (headRowListeners.size === 0) pendingHeadRow = message.row
      for (const listener of headRowListeners) listener(message.row)
    }
  })
}

/** Tell the host this surface is up; it answers with a snapshot. */
export function startBoard(surface: BoardSurface): void {
  surfaceKind = surface
  install()
  vscode.postMessage({ type: 'board/ready', surface })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBoardSnapshot(): BoardSnapshot | null {
  // The third reads the same value when the list is rendered to markup (tests).
  return useSyncExternalStore(subscribe, () => view, () => view)
}

function subscribeActive(listener: () => void): () => void {
  activeListeners.add(listener)
  return () => activeListeners.delete(listener)
}

/** The card whose page is the active editor tab; null when none. */
export function useActivePage(): string | null {
  return useSyncExternalStore(subscribeActive, () => activePage, () => activePage)
}

/** A request the host answers. Resolves with a refusal if no answer comes in 30 s. */
export function request(message: BoardCall): Promise<BoardAnswer> {
  install()
  counter += 1
  const requestId = `b${Date.now().toString(36)}${counter}`
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.delete(requestId)) return
      resolve({ ok: false, code: 'sidebar-unreachable', message: 'Ritemark did not answer. Try again.' })
    }, 30_000)
    pending.set(requestId, (answer) => {
      clearTimeout(timer)
      resolve(answer)
    })
    vscode.postMessage({ ...message, requestId })
  })
}

/** A request that needs no answer (open a file, open the board, recover). */
export function notify(message: BoardNotice): void {
  install()
  vscode.postMessage(message)
}

/** The host asks this surface to show a view (the board, opened from the side bar). */
export function onFocus(listener: (target: { tab?: BoardTab }) => void): () => void {
  install()
  focusListeners.add(listener)
  return () => focusListeners.delete(listener)
}

/** The project head's rows on Tasks (Sprint 134, R17): New task and Search, run from the shell. */
export function onHeadRow(listener: (row: BoardHeadRow) => void): () => void {
  install()
  headRowListeners.add(listener)
  if (pendingHeadRow) {
    const row = pendingHeadRow
    pendingHeadRow = null
    listener(row)
  }
  return () => headRowListeners.delete(listener)
}
