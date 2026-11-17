/**
 * Sprint 162 PR 2 (README "Themes", frame 11): the line under the theme's colours, which measures the text and the
 * headings against the background (WCAG's contrast ratio), against 4.5 to 1, the usual rule for text. A ratio is shown
 * cut to one decimal, never rounded up, so a pair just under the rule never reads as meeting it.
 */
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { contrast } from './themeVars'

/** The usual rule for text: 4.5 to 1. */
export const READABLE_RATIO = 4.5

/** A ratio in words: one decimal, cut, without a trailing ".0" (12.6, 15, 4.4). */
export function ratioWords(ratio: number): string {
  return (Math.floor(ratio * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')
}

export interface ContrastLine {
  ok: boolean
  text: number
  headings: number
  words: string
}

/** The line: "Easy to read: …" when both pairs meet the rule, else "Hard to read: …" naming the one that doesn't. */
export function contrastLine(theme: Pick<DeckTheme, 'bg' | 'head' | 'text'>): ContrastLine {
  const text = contrast(theme.text, theme.bg)
  const headings = contrast(theme.head, theme.bg)
  const ok = text >= READABLE_RATIO && headings >= READABLE_RATIO
  const words = ok
    ? `Easy to read: text ${ratioWords(text)} to 1, headings ${ratioWords(headings)} to 1 on the background.`
    : `Hard to read: ${text < READABLE_RATIO ? `text ${ratioWords(text)} to 1` : `headings ${ratioWords(headings)} to 1`} on the background. Aim for 4.5 to 1 or more.`
  return { ok, text, headings, words }
}
