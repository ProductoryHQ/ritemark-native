/**
 * boardUi — what the board's surfaces remember while they are open (Sprint
 * 130): the open card, an open note box, the conflict / Doing-full choice a
 * Give to produced, a delete waiting for confirmation, a short notice. Plus the
 * actions that send requests and turn the host's answers into that state.
 *
 * One store per webview; the side bar and the board tab each have their own.
 */

import { create } from 'zustand'
import type { AgentId } from '../../../../src/agent/types'
import type { BoardAnswer, CardStage } from '../../../../src/taskBoard/protocol'
import { request, type BoardCall } from './boardClient'

export type NoteKind = 'changes' | 'answer'

export type GivePrompt =
  | { cardId: string; runtimeId: AgentId; kind: 'conflict'; withCardId: string; withTitle: string; file: string }
  | { cardId: string; runtimeId: AgentId; kind: 'doing-full'; count: number; limit: number }

interface BoardUiState {
  openCardId: string | null
  /** A note box open on a card; `where` keeps two copies of one card apart (row vs dialog). */
  note: { cardId: string; where: string; kind: NoteKind } | null
  prompt: GivePrompt | null
  confirmDeleteId: string | null
  notice: string | null
  /** Cards with a request in flight: their agent buttons wait. */
  pending: Record<string, true>
  openCard(cardId: string | null): void
  openNote(cardId: string, where: string, kind: NoteKind): void
  closeNote(): void
  clearPrompt(): void
  askDelete(cardId: string | null): void
  showNotice(text: string | null): void
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null

export const useBoardUi = create<BoardUiState>((set) => ({
  openCardId: null,
  note: null,
  prompt: null,
  confirmDeleteId: null,
  notice: null,
  pending: {},
  openCard: (cardId) => set({ openCardId: cardId }),
  openNote: (cardId, where, kind) => set({ note: { cardId, where, kind } }),
  closeNote: () => set({ note: null }),
  clearPrompt: () => set({ prompt: null }),
  askDelete: (cardId) => set({ confirmDeleteId: cardId }),
  showNotice: (text) => {
    if (noticeTimer) clearTimeout(noticeTimer)
    set({ notice: text })
    if (text) noticeTimer = setTimeout(() => set({ notice: null }), 6000)
  },
}))

function setPending(cardId: string, on: boolean): void {
  useBoardUi.setState((state) => {
    const pending = { ...state.pending }
    if (on) pending[cardId] = true
    else delete pending[cardId]
    return { pending }
  })
}

/** Send a request about a card; a refusal shows as a notice. */
export async function act(call: BoardCall): Promise<BoardAnswer> {
  const cardId = 'cardId' in call ? call.cardId : null
  if (cardId) setPending(cardId, true)
  try {
    const answer = await request(call)
    if (!answer.ok && answer.code !== 'conflict' && answer.code !== 'doing-full') {
      useBoardUi.getState().showNotice(answer.message)
    }
    return answer
  } finally {
    if (cardId) setPending(cardId, false)
  }
}

/**
 * Give to {agent}. A conflict or a full Doing does not start anything: the
 * card shows the choice (Wait for it / Start now, Queue it / Start anyway).
 */
export async function giveCard(cardId: string, runtimeId: AgentId, options: { force?: boolean; overLimit?: boolean } = {}): Promise<void> {
  const ui = useBoardUi.getState()
  if (ui.prompt?.cardId === cardId) ui.clearPrompt()
  const answer = await act({ type: 'board/give', cardId, runtimeId, ...options })
  if (answer.ok) return
  if (answer.code === 'conflict') {
    useBoardUi.setState({
      prompt: { cardId, runtimeId, kind: 'conflict', withCardId: answer.withCardId, withTitle: answer.withTitle, file: answer.file },
    })
  } else if (answer.code === 'doing-full') {
    useBoardUi.setState({ prompt: { cardId, runtimeId, kind: 'doing-full', count: answer.count, limit: answer.limit } })
  }
}

export async function moveCard(cardId: string, stage: CardStage, position: { beforeCardId?: string; atEnd?: boolean } = {}): Promise<void> {
  await act({ type: 'board/move', cardId, stage, ...position })
}

export async function sendNote(cardId: string, text: string, runtimeId?: AgentId): Promise<boolean> {
  const answer = await act({ type: 'board/follow-up', cardId, text, ...(runtimeId ? { runtimeId } : {}) })
  if (answer.ok) useBoardUi.getState().closeNote()
  return answer.ok
}
