/**
 * The decks README, small details 14: the deck an Agenda block lists, for every slide drawn under it. The deck view
 * gives its sections with the editor's quiet line for a deck with none (the strip); the wall and the presenter view
 * give theirs without it. A slide drawn with no deck around it (the library, a theme's preview) draws an Agenda empty.
 */
import { createContext, useMemo } from 'react'
import type { AgendaDrawing } from '../../../../../src/decks/blocks/agenda'
import { agendaKey, agendaOf } from '../../../../../src/decks/blocks/slideRenderer'
import type { SlideData } from '../../../../../src/decks/deckFormat'

export const AgendaContext = createContext<AgendaDrawing | null>(null)

/** The deck's Agenda drawing from its slides, the same object while the list itself is the same. */
export function useAgendaDrawing(slides: ReadonlyArray<{ kind: string; data: SlideData; number?: number }>, hint: boolean): AgendaDrawing {
  const entries = agendaOf(slides)
  const key = agendaKey(entries)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ entries, hint }), [key, hint])
}
