/**
 * Sprint 140 (R8; experience 35): the AI's empty sheet offers at most three
 * starting points, chosen by what is open, in the same words for every AI. A
 * click puts its words in the message box; the person presses Send. Pure.
 */

import type { StartingPlace } from '../../../../src/guidance/startingPlace'

export interface StartingPoint {
  /** What the card says. */
  label: string
  /** What goes in the box: the words, with "…" left out. */
  text: string
  /** Where the cursor waits: where the "…" was, else the end. */
  cursor: number
}

const WRITE_ABOUT = 'Write About this project'

const POINTS: Record<StartingPlace, readonly string[]> = {
  project: ['What is here?', 'Find what I wrote about…', WRITE_ABOUT],
  empty_project: ['This project is for…', 'Plan a first document with me'],
  word_or_pdf: ['Summarise this in five points', 'Turn this into a one-page brief', 'What does this say about…?'],
  short_text: ['Fill in the outline', 'Write a first draft from my notes'],
  long_text: ['Tighten this for a client', 'What is missing?', 'Add a summary at the top'],
  table: ['What stands out here?', 'Write a short summary of this table'],
  sample: ['Draft Module 4 from the brief', 'Summarise the call with the HR lead', 'What is here?'],
}

/** A label's fill: "Find what I wrote about…" → "Find what I wrote about " with the cursor at its end. */
export function fillOf(label: string): { text: string; cursor: number } {
  const at = label.indexOf('…')
  if (at < 0) return { text: label, cursor: label.length }
  return { text: `${label.slice(0, at)} ${label.slice(at + 1)}`, cursor: at + 1 }
}

/** At most three; "Write About this project" only while the project has none. */
export function startingPointsFor(place: StartingPlace, options: { hasAbout: boolean }): StartingPoint[] {
  return POINTS[place]
    .filter((label) => !(label === WRITE_ABOUT && options.hasAbout))
    .slice(0, 3)
    .map((label) => ({ label, ...fillOf(label) }))
}

/** The sentence above them (D2), as long as it is true of that AI. */
export function startingSentence(aiName: string): string {
  return `${aiName} can work across your open documents and the whole project.`
}
