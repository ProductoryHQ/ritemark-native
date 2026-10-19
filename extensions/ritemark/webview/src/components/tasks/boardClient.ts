/**
 * boardClient — the board webviews' line to the host (Sprint 130).
 *
 * The host pushes a whole snapshot whenever the board changes; components read
 * it through `useBoardSnapshot`. Requests carry a request id and resolve with
 * the host's answer, so a button can show what happened (or what to choose
 * next: the conflict guard, the Doing limit).
 */

import { useSyncExternalStore } from 'react'
import { vscode } from '../../lib/vscode'
import type { BoardAnswer, BoardHeadRow, BoardHostMessage, BoardRequest, BoardSnapshot, BoardSurface, BoardTab } from '../../../../src/taskBoard/protocol'

type WithRequestId = Extract<BoardRequest, { requestId: string }>
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type BoardCall = DistributiveOmit<WithRequestId, 'requestId'>
export type BoardNotice = Exclude<BoardRequest, { requestId: string } | { type: 'board/ready' }>

let snapshot: BoardSnapshot | null = null
const listeners = new Set<() => void>()
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
      snapshot = message.snapshot
      for (const listener of listeners) listener()
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
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
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
