import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Sprint 126 (#332): `Shift+End` / `Shift+Home` must not escape the text block.
 *
 * Neither TipTap's core `Keymap` extension nor ProseMirror's `baseKeymap` binds
 * `Home`, `End`, `Shift-Home` or `Shift-End` — TipTap stops at `Mod-a` and the
 * macOS `Ctrl-a`/`Ctrl-e` pair. So all four reached Chrome's native
 * contenteditable handling untouched, and Chrome extended `Shift+End` to the end
 * of the *document*: the next Delete then wiped every block below the caret.
 * That is a data-loss bug, not a cosmetic one — see `docs/development/releases/
 * v1.12.0/sprint-126-editor-selection-keys/research/current-state-audit.md`.
 *
 * Plain `Home`/`End` are deliberately left alone. They already behave the way
 * the platform does (they move within the visual line), and rebinding them would
 * regress wrapped paragraphs for no gain.
 *
 * The approved behaviour (2026-09-22) is "whatever `End` does, but extending":
 *
 * 1. Let the browser compute the *visual* line boundary via
 *    `Selection.modify('extend', …, 'lineboundary')`. This is the only thing
 *    that knows where a wrapped line actually breaks, and it keeps Shift+End
 *    consistent with plain End on a paragraph that spans several lines.
 * 2. Clamp the result back into the current text block. This is the part that
 *    actually stops the data loss, and it holds even when step 1 is unavailable
 *    or returns something unusable.
 *
 * The clamp is a pure function over ProseMirror positions (`clampHeadToTextblock`)
 * so it is pinned by `selectionBoundary.test.ts` against a real document, with no
 * DOM in the loop.
 */

/** Where the current text block starts and ends, from any position inside it. */
export function textblockBounds(
  doc: PMNode,
  pos: number,
): { start: number; end: number } | null {
  const $pos = doc.resolve(pos)
  if (!$pos.parent.isTextblock) {
    return null
  }
  return { start: $pos.start(), end: $pos.end() }
}

/**
 * Clamp `proposedHead` into the text block that contains `anchor`.
 *
 * Returns `null` when the anchor is not inside a text block at all (an image
 * NodeSelection, say) — the caller then leaves the selection alone rather than
 * inventing one.
 */
export function clampHeadToTextblock(
  doc: PMNode,
  anchor: number,
  proposedHead: number,
): number | null {
  const bounds = textblockBounds(doc, anchor)
  if (!bounds) {
    return null
  }
  return Math.min(Math.max(proposedHead, bounds.start), bounds.end)
}

/**
 * The fallback head when the browser cannot tell us where the visual line ends:
 * the text block's own boundary in that direction. Same guarantee, coarser aim.
 */
export function textblockHead(
  doc: PMNode,
  anchor: number,
  direction: 'backward' | 'forward',
): number | null {
  const bounds = textblockBounds(doc, anchor)
  if (!bounds) {
    return null
  }
  return direction === 'backward' ? bounds.start : bounds.end
}

/**
 * Ask the browser to extend the DOM selection to the visual line boundary, then
 * report where its focus landed as a ProseMirror position.
 *
 * Returns `null` whenever that cannot be determined — no `Selection.modify` (it
 * is non-standard and absent outside Chromium/WebKit), no focus node, or a focus
 * node ProseMirror cannot map. Every one of those falls back to the text block
 * boundary, which is still correct, just less precise.
 */
function visualLineHead(view: EditorView, direction: 'backward' | 'forward'): number | null {
  const domSelection = view.dom.ownerDocument.defaultView?.getSelection()
  if (!domSelection || typeof domSelection.modify !== 'function') {
    return null
  }

  try {
    domSelection.modify('extend', direction, 'lineboundary')
  } catch {
    return null
  }

  const { focusNode, focusOffset } = domSelection
  if (!focusNode || !view.dom.contains(focusNode)) {
    return null
  }

  try {
    return view.posAtDOM(focusNode, focusOffset)
  } catch {
    return null
  }
}

function extendToLineBoundary(view: EditorView, direction: 'backward' | 'forward'): boolean {
  const { state } = view
  const { doc, selection } = state

  // The anchor is what "extend" means: it stays put while the head moves. Taking
  // it from ProseMirror rather than the DOM keeps a pre-existing selection intact.
  const { anchor } = selection

  if (!textblockBounds(doc, anchor)) {
    // Not inside a text block (a selected image, for example). Do nothing — but
    // report the key as handled, so Chrome's document-wide default cannot run.
    return true
  }

  const proposed = visualLineHead(view, direction)
  const head =
    proposed === null
      ? textblockHead(doc, anchor, direction)
      : clampHeadToTextblock(doc, anchor, proposed)

  if (head === null) {
    return true
  }

  view.dispatch(
    state.tr
      .setSelection(TextSelection.create(doc, anchor, head))
      .scrollIntoView(),
  )
  return true
}

export const SelectionBoundaryKeys = Extension.create({
  name: 'selectionBoundaryKeys',

  addKeyboardShortcuts() {
    return {
      'Shift-Home': () => extendToLineBoundary(this.editor.view, 'backward'),
      'Shift-End': () => extendToLineBoundary(this.editor.view, 'forward'),
    }
  },
})
