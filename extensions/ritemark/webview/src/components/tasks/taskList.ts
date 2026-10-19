/**
 * taskList — the Tasks list in the left column, in the order work moves
 * (Sprint 134, R17; experience 6, frame 1; Jarmo, 15 October): Ideas
 * (folded), To do, Doing, Done (folded, with Archived inside it).
 *
 * A task that waits for the person (the board's calls: needs you, a decision,
 * a review, failed) is first in its stage, in the order of the snapshot's
 * calls, wherever it is; a folded stage still shows its waiting tasks, so no
 * call is hidden by the order. The list holds what the side bar listed before
 * 2.0, each task once: every idea not dropped, To do, Doing, what finished in
 * the last four weeks, the archived tasks, and every task that waits.
 *
 * Pure: no React, no host calls; tested in taskList.test.ts.
 */

import type { BoardCardView, BoardSnapshot, CardStage } from '../../../../src/taskBoard/protocol'
import { STAGE_NAMES, finishedRecently } from './taskCopy'

export interface TaskGroup {
  stage: CardStage
  /** "Ideas", "To do", "Doing", "Done". */
  label: string
  /** Ideas and Done are folded until the person opens them. */
  folds: boolean
  /** The stage's tasks: the ones that wait for the person first, then the rest in the board's order. */
  cards: BoardCardView[]
  /** The ids in `cards` that wait for the person. */
  waiting: ReadonlySet<string>
  /** Done only: the archived tasks, the most recently archived first. */
  archived: BoardCardView[]
}

export const LIST_ORDER: readonly CardStage[] = ['idea', 'todo', 'doing', 'done']

/** Done shows its five latest; the board's Done column has the rest (Show all). */
export const DONE_SHOWN = 5

type ListSnapshot = Pick<BoardSnapshot, 'cards' | 'archived' | 'calls'>

export function taskGroups(snapshot: ListSnapshot, now: Date): TaskGroup[] {
  const callRank = new Map(snapshot.calls.map((call, index) => [call.cardId, index]))
  const listed = (card: BoardCardView) =>
    callRank.has(card.id) || (card.stage === 'idea' ? !card.dropped : card.stage === 'done' ? finishedRecently(card, now) : true)
  return LIST_ORDER.map((stage) => {
    const inStage = snapshot.cards.filter((card) => card.stage === stage && listed(card))
    const waiting = inStage.filter((card) => callRank.has(card.id)).sort((a, b) => callRank.get(a.id)! - callRank.get(b.id)!)
    return {
      stage,
      label: STAGE_NAMES[stage],
      folds: stage === 'idea' || stage === 'done',
      cards: [...waiting, ...inStage.filter((card) => !callRank.has(card.id))],
      waiting: new Set(waiting.map((card) => card.id)),
      archived: stage === 'done' ? [...snapshot.archived] : [],
    }
  })
}

/**
 * The rows a stage shows. Folded, only its waiting tasks; open, all of them,
 * except that Done stops at its five latest (never before a waiting task)
 * unless `all` (a search shows every match). `more` is how many it left out.
 */
export function shownCards(group: TaskGroup, open: boolean, all = false): { cards: BoardCardView[]; more: number } {
  if (!open) return { cards: group.cards.filter((card) => group.waiting.has(card.id)), more: 0 }
  if (group.stage !== 'done' || all) return { cards: group.cards, more: 0 }
  const shown = group.cards.slice(0, Math.max(DONE_SHOWN, group.waiting.size))
  return { cards: shown, more: group.cards.length - shown.length }
}

/** A title holds every word typed, in any case and any order. */
export function matchesTitle(title: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = title.toLowerCase()
  return words.every((word) => text.includes(word))
}

/** The stages with the tasks whose title matches; stages with no match go. An empty query keeps all. */
export function filterGroups(groups: readonly TaskGroup[], query: string): TaskGroup[] {
  if (!query.trim()) return [...groups]
  return groups.flatMap((group) => {
    const cards = group.cards.filter((card) => matchesTitle(card.title, query))
    const archived = group.archived.filter((card) => matchesTitle(card.title, query))
    if (!cards.length && !archived.length) return []
    return [{ ...group, cards, archived, waiting: new Set(cards.filter((card) => group.waiting.has(card.id)).map((card) => card.id)) }]
  })
}

/** Search's field: Search shows it, typing filters, Escape clears it and hides it. */
export interface SearchState {
  open: boolean
  query: string
}

export type SearchEvent = { type: 'show' } | { type: 'type'; query: string } | { type: 'escape' } | { type: 'blur' }

export function nextSearch(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case 'show':
      return { ...state, open: true }
    case 'type':
      return { open: true, query: event.query }
    case 'escape':
      return { open: false, query: '' }
    case 'blur':
      // Leaving an empty field puts it away; a search in force stays on screen.
      return state.query.trim() ? state : { open: false, query: '' }
  }
}
