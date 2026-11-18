/**
 * The decks README, small details 14: the deck an Agenda block lists, for every slide drawn under it. The deck view
 * gives its sections with the editor's quiet line for a deck with none (the strip); the wall and the presenter view
 * give theirs without it. A view that draws only some of a deck's slides gets the deck's whole list from the host
 * (`agendaEntriesFrom`): a theme's preview, See what changed, and the library's tiles (a search sends only some). Copy
 * as picture is handed the deck view's. Every caller that draws a deck's slides gives its Agenda the list.
 */
import { createContext, useMemo } from 'react'
import type { AgendaDrawing, AgendaEntry } from '../../../../../src/decks/blocks/agenda'
import { agendaKey, agendaOf } from '../../../../../src/decks/blocks/slideRenderer'
import type { SlideData } from '../../../../../src/decks/deckFormat'

export const AgendaContext = createContext<AgendaDrawing | null>(null)

/** The deck's Agenda drawing from its slides, the same object while the list itself is the same. */
export function useAgendaDrawing(slides: ReadonlyArray<{ kind: string; data: SlideData; number?: number }>, hint: boolean): AgendaDrawing {
  return useAgendaMemo(agendaOf(slides), hint)
}

/** A list as a drawing, the same object while the list itself (and the hint) is the same. */
function useAgendaMemo(entries: readonly AgendaEntry[], hint: boolean): AgendaDrawing {
  const key = agendaKey(entries)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ entries, hint }), [key, hint])
}

/** A host's agenda list, checked entry by entry (a title and a whole slide number); [] for anything else. */
export function agendaEntriesFrom(value: unknown): AgendaEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is AgendaEntry => !!entry && typeof entry.title === 'string' && Number.isInteger(entry.number) && entry.number > 0)
    .map(entry => ({ title: entry.title, number: entry.number }))
}

/** A host-sent list as a drawing, the same object while the list itself is the same (no hint: not the editor's). */
export function useAgendaEntries(entries: readonly AgendaEntry[]): AgendaDrawing {
  return useAgendaMemo(entries, false)
}
