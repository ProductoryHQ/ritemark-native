/**
 * boardUi — what a board surface remembers while it is open (Sprint 130): an
 * open note box, the conflict / Doing-full choice a Give to produced, a delete
 * waiting for confirmation, a short notice. Plus the actions that send
 * requests and turn the host's answers into that state.
 *
 * One store per webview: the side bar, the board tab and each card page have
 * their own. Opening a card is the host's: its page opens in the editor.
 */

import { create } from 'zustand'
import type { AgentId } from '../../../../src/agent/types'
import type { BoardAnswer, CardStage } from '../../../../src/taskBoard/protocol'
import { beginMove, notify, request, settleMove, type BoardCall } from './boardClient'

export type NoteKind = 'changes' | 'answer'

/** A file the board couldn't read, while Try again or Remove runs, or after the trash refused it (#596). */
export type FileRowState =
  | { busy: 'retrying' | 'removing'; note?: undefined; sentence?: undefined }
  /** The trash refused: `note` replaces the row's own sentence while that is still `sentence`. */
  | { note: string; sentence: string; busy?: undefined }

export type GivePrompt =
  | { cardId: string; runtimeId: AgentId; kind: 'conflict'; withCardId: string; withTitle: string; file: string }
  | { cardId: string; runtimeId: AgentId; kind: 'doing-full'; count: number; limit: number }

interface BoardUiState {
  /** A note box open on a card; `where` keeps two copies of one card apart (row vs page). */
  note: { cardId: string; where: string; kind: NoteKind } | null
  prompt: GivePrompt | null
  confirmDeleteId: string | null
  /** A file the board couldn't read, waiting for the one question before Remove (#596). */
  confirmRemoveFile: string | null
  /** Files the board couldn't read whose row is busy or carries the trash's refusal, by file name. */
  files: Record<string, FileRowState>
  notice: string | null
  /** Cards with a request in flight: their agent buttons wait. */
  pending: Record<string, true>
  /** Open the card's page in the editor (design.md §5); `focus` moves the
   *  keyboard there (an open from the keyboard, W16). */
  openCard(cardId: string, focus?: boolean): void
  openNote(cardId: string, where: string, kind: NoteKind): void
  closeNote(): void
  clearPrompt(): void
  askDelete(cardId: string | null): void
  askRemoveFile(fileName: string | null): void
  showNotice(text: string | null): void
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null

export const useBoardUi = create<BoardUiState>((set) => ({
  note: null,
  prompt: null,
  confirmDeleteId: null,
  confirmRemoveFile: null,
  files: {},
  notice: null,
  pending: {},
  openCard: (cardId, focus) => notify({ type: 'board/open-card', cardId, ...(focus ? { focus: true } : {}) }),
  openNote: (cardId, where, kind) => set({ note: { cardId, where, kind } }),
  closeNote: () => set({ note: null }),
  clearPrompt: () => set({ prompt: null }),
  askDelete: (cardId) => set({ confirmDeleteId: cardId }),
  askRemoveFile: (fileName) => set({ confirmRemoveFile: fileName }),
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

/**
 * Move a card: drawn in its new place at once (Sprint 145, #597), then sent. The drop, Move to…, Reopen and the
 * card page's stage all come here; a refusal puts the card back and the notice says why.
 */
export async function moveCard(cardId: string, stage: CardStage, position: { beforeCardId?: string; atEnd?: boolean } = {}): Promise<void> {
  const token = beginMove(cardId, stage, position)
  const answer = await act({ type: 'board/move', cardId, stage, ...position })
  settleMove(token, answer.ok)
}

/** Mark done: the card goes to the top of Done at once, as the host puts it there (#597). */
export async function markCardDone(cardId: string): Promise<void> {
  const token = beginMove(cardId, 'done')
  const answer = await act({ type: 'board/mark-done', cardId })
  settleMove(token, answer.ok)
}

/**
 * Try again on a file the board couldn't read (Sprint 145, #596). While it reads, the row's buttons wait; if the
 * read works, the card is in the snapshot that comes before the answer and the row goes. A refusal (the file is
 * no longer one the board couldn't read) needs no notice: the next snapshot shows how things are.
 */
export async function retryFile(fileName: string): Promise<void> {
  setFileState(fileName, { busy: 'retrying' })
  try {
    await request({ type: 'board/retry-file', fileName })
  } finally {
    setFileState(fileName, null)
  }
}

/**
 * Remove, after the board's question: the file goes to the system trash. If the trash refuses, the row says so in
 * place of its own sentence (`sentence`), until the person acts on the row again or its own sentence changes. Any
 * other refusal is the board's usual notice.
 */
export async function removeFile(fileName: string, sentence: string): Promise<void> {
  setFileState(fileName, { busy: 'removing' })
  const answer = await request({ type: 'board/remove-file', fileName })
  if (!answer.ok && answer.code === 'write-failed') {
    setFileState(fileName, { note: answer.message, sentence })
    return
  }
  setFileState(fileName, null)
  if (!answer.ok && answer.code !== 'not-found') useBoardUi.getState().showNotice(answer.message)
}

/** Forget what the rows of files no longer listed carried (a refusal's sentence, a finished wait). */
export function forgetFileStates(listed: ReadonlySet<string>): void {
  const files = useBoardUi.getState().files
  if (Object.keys(files).every((name) => listed.has(name))) return
  useBoardUi.setState({ files: Object.fromEntries(Object.entries(files).filter(([name]) => listed.has(name))) })
}

function setFileState(fileName: string, state: FileRowState | null): void {
  useBoardUi.setState((current) => {
    const files = { ...current.files }
    if (state) files[fileName] = state
    else delete files[fileName]
    return { files }
  })
}

export async function sendNote(cardId: string, text: string, runtimeId?: AgentId): Promise<boolean> {
  const answer = await act({ type: 'board/follow-up', cardId, text, ...(runtimeId ? { runtimeId } : {}) })
  if (answer.ok) useBoardUi.getState().closeNote()
  return answer.ok
}
