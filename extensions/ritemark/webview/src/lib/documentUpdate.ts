/**
 * The smallest replacement that turns the editor's document into the host's
 * (Sprint 115's structural apply, Editor.tsx).
 *
 * `findDiffStart` scans from the front and `findDiffEnd` from the back, each on
 * its own, so when the change sits next to text that repeats, the two ranges
 * overlap: removing the paragraph "An agent added this paragraph." after "The
 * agent's last paragraph." finds a common end (" paragraph.") that reaches back
 * past the common start. The editor then called `tr.replace` with an end before
 * its start, and ProseMirror's fitting never finished: the editor froze at full
 * CPU (found in Sprint 137 while checking #512; on main too). The overlap is
 * moved past the start, as ProseMirror's own view does when it reads a DOM
 * change (prosemirror-view `findDiff`).
 */
import type { Node as PMNode, Slice } from '@tiptap/pm/model'

export interface DocumentReplacement {
  from: number
  to: number
  slice: Slice
}

/** The range of `current` to replace, and what from `next` replaces it; null when they are equal. */
export function documentReplacement(current: PMNode, next: PMNode): DocumentReplacement | null {
  const start = current.content.findDiffStart(next.content)
  if (start === null) return null
  const end = current.content.findDiffEnd(next.content)
  if (!end) throw new Error('Could not determine the document update range.')
  let endA = end.a
  let endB = end.b
  const overlap = start - Math.min(endA, endB)
  if (overlap > 0) {
    endA += overlap
    endB += overlap
  }
  return { from: start, to: endA, slice: next.slice(start, endB) }
}
