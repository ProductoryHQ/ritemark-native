/**
 * Where a block goes. Pure ProseMirror, with no import of a menu's items or of deck code, so the Text editor's modules
 * can use it too.
 *  - `placeBlock`: where a block chosen from a / menu goes, the one rule the slide editor (`slideCommands.insertSlideBlock`)
 *    and the Text editor's Button (`buttonBlock/buttonCommands.insertButton`) both use (Sprint 163 PR 3: one
 *    placement, never two copies).
 *  - `codeOutOfQuote` (Sprint 168 PR 2): on a slide, Code block on words in a quote puts them in a code block out of
 *    it (`SlideCodeBlock`, whose module the Text editor's code block shares).
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Transform, liftTarget } from '@tiptap/pm/transform'

/** Meta on a slide editor transaction that the stage writes to the deck as an undo step of its own. */
export const SLIDE_COMMAND = 'deckSlideCommand'

const isTablePart = (node: PMNode) => typeof node.type.spec.tableRole === 'string'

/**
 * Put `node` where the / was (`at`, after its text is taken out): in place of the empty line it stood on, else after
 * the block the caret is in, at the first level that can hold it. Nothing goes inside a table: a Markdown table's cell
 * holds one line, so the block goes after the table. Its place, or -1 when no level can hold it (nothing is changed).
 */
export function placeBlock(tr: Transaction, at: number, node: PMNode): number {
  const $pos = tr.doc.resolve(Math.max(0, Math.min(at, tr.doc.content.size)))
  // The shallowest table on the way down: the levels from there on can't hold a block.
  let tableDepth = -1
  for (let depth = 1; depth <= $pos.depth; depth++) {
    if (isTablePart($pos.node(depth))) { tableDepth = depth; break }
  }
  let placed = -1
  if (tableDepth < 0 && $pos.depth > 0 && $pos.parent.type.name === 'paragraph' && $pos.parent.content.size === 0) {
    const depth = $pos.depth
    const holder = $pos.node(depth - 1)
    const index = $pos.index(depth - 1)
    if (holder.canReplaceWith(index, index + 1, node.type)) {
      placed = $pos.before(depth)
      tr.replaceWith(placed, $pos.after(depth), node)
    }
  }
  if (placed < 0 && $pos.depth === 0 && tr.doc.canReplaceWith($pos.index(0), $pos.index(0), node.type)) {
    placed = $pos.pos
    tr.insert(placed, node)
  }
  for (let depth = (tableDepth < 0 ? $pos.depth : tableDepth) - 1; placed < 0 && depth >= 0; depth--) {
    // After the child that holds the caret at this level, where that level can hold the block.
    const index = $pos.index(depth) + 1
    if (!$pos.node(depth).canReplaceWith(index, index, node.type)) continue
    placed = $pos.after(depth + 1)
    tr.insert(placed, node)
  }
  return placed
}

// ---------------------------------------------------------------------------
// A prompt out of a quote (Sprint 168 PR 2)
// ---------------------------------------------------------------------------

/** Between two paragraphs' words in the code block: a blank line, as between paragraphs in the file. */
const PARAGRAPH_GAP = '\n\n'

/** The first and last of `parts` that has words (-1, -2 when none has): empty lines at either end aren't written. */
function wordedEnds(parts: string[]): [number, number] {
  let first = 0
  let last = parts.length - 1
  while (first <= last && parts[first] === '') first++
  while (last >= first && parts[last] === '') last--
  return first <= last ? [first, last] : [-1, -2]
}

/**
 * A block's blocks' words, one after another with `gap` between, empty lines at either end left out; null when one of
 * them has no words form.
 */
function joinedWords(node: PMNode, gap: string): string | null {
  const parts: string[] = []
  for (let index = 0; index < node.childCount; index++) {
    const words = codeWordsOf(node.child(index))
    if (words === null) return null
    parts.push(words)
  }
  const [first, last] = wordedEnds(parts)
  return parts.slice(first, last + 1).join(gap)
}

/**
 * A block's words as a code block holds them: a line's letters with its line breaks; a quote's blocks a blank line
 * apart; a list's items each on a line with its mark ("- ", "1. ", "- [x] "), their further lines under the words.
 * Null when it holds something a code block can't (a picture, math, a table, a box), so no picture or formula is lost.
 */
function codeWordsOf(node: PMNode): string | null {
  if (node.isTextblock) {
    // A code block's words are its own; its language is carried by `codeOutOfQuote`.
    let words = ''
    let whole = true
    node.forEach(child => {
      if (child.isText) words += child.text
      else if (child.type.name === 'hardBreak') words += '\n'
      else whole = false
    })
    return whole ? words : null
  }
  const name = node.type.name
  if (name === 'blockquote') return joinedWords(node, PARAGRAPH_GAP)
  if (name !== 'bulletList' && name !== 'orderedList' && name !== 'taskList') return null
  const start = Number(node.attrs.start)
  const words: string[] = []
  for (let index = 0; index < node.childCount; index++) {
    const item = joinedWords(node.child(index), '\n')
    if (item === null) return null
    words.push(item)
  }
  // An empty item at the list's start or end (Enter after the last one) isn't written: no mark without words.
  const [first, last] = wordedEnds(words)
  const items: string[] = []
  for (let index = Math.max(first, 0); index <= last; index++) {
    const checked = !!node.child(index).attrs.checked
    const mark = name === 'orderedList' ? `${(Number.isFinite(start) ? start : 1) + index}. ` : name === 'taskList' ? `- [${checked ? 'x' : ' '}] ` : '- '
    const under = ' '.repeat(mark.length)
    items.push(words[index].split('\n').map((line, at) => (at === 0 ? mark + line : line ? under + line : line)).join('\n'))
  }
  return items.join('\n')
}

/** Are a block's children from `from` to `to` all empty lines (no letter, no picture)? */
function emptyLines(node: PMNode, from: number, to: number): boolean {
  for (let index = from; index < to; index++) {
    const child = node.child(index)
    if (!child.isTextblock || child.content.size > 0) return false
  }
  return true
}

/**
 * The first words' start and the last words' end inside a block at `pos` (a line's own): empty lines at its start and
 * end aren't counted, so a selection that looks whole is whole. -1 when it has no line.
 */
function wordsSpan(node: PMNode, pos: number): { start: number; end: number } {
  if (node.isTextblock) return { start: pos + 1, end: pos + node.nodeSize - 1 }
  const lines: Array<{ start: number; end: number; empty: boolean }> = []
  node.descendants((child, offset) => {
    if (!child.isTextblock) return true
    const at = pos + 1 + offset
    lines.push({ start: at + 1, end: at + child.nodeSize - 1, empty: child.content.size === 0 })
    return false
  })
  const worded = lines.filter(line => !line.empty)
  const span = worded.length ? worded : lines
  return span.length ? { start: span[0].start, end: span[span.length - 1].end } : { start: -1, end: -1 }
}

/** A quote's attribution line: a paragraph that starts with a dash and a space, "— Name" or "– Name" (the spec's R1). */
const isAttribution = (node: PMNode) => node.type.name === 'paragraph' && /^[\u2014\u2013][ \u00a0]/.test(node.textContent)

/** An empty line: a line with nothing in it. */
const isEmptyLine = (node: PMNode) => node.isTextblock && node.content.size === 0

/**
 * Sprint 168 PR 2 (the decks README, "Quotes, prompts and heading levels on a slide", item 2; Jarmo's quote held a
 * prompt): on a slide, Code block on words inside a quote takes them out of it. The quote's blocks the selection is in
 * become one code block in their place, with Copy and ↗, a paragraph's words a blank line from the next one's; what is
 * left of the quote above and below stays a quote, split around it, and a part of it left with no words goes, so a quote
 * left empty goes. An attribution stays with the quote's words (the Experience lead, 19 November): when the part after
 * the code block holds only it ("— Name"), it joins the part before; with no words before, it stays a one-line quote.
 * It leaves every quote around them (a quote in a quote) but never a box, a column, a list or a tab's pane, and it is
 * one transaction marked `SLIDE_COMMAND`, so one Undo gives the quote back as it was. The words keep their letters and
 * line breaks, empty lines at the ends aside, and a chosen code block's language stays (two different ones: none);
 * their marks (bold, a link's address, a comment's highlight) go, as in any code block.
 *
 * Nothing changes, and false is returned, when the selection isn't inside one quote; when it is all in code blocks
 * already (Code block then toggles them back); when it takes only part of a list or of a quote in the quote (the rest
 * of it would go with it); or when a chosen block holds what a code block can't (a picture, math, a table). Code block
 * then does what it does everywhere. With `dispatch` false it only says whether it would (TipTap's `can()`).
 */
export function codeOutOfQuote(tr: Transaction, attributes?: Record<string, unknown> | null, dispatch = true): boolean {
  const doc = tr.doc
  const { schema } = doc.type
  const quote = schema.nodes.blockquote
  const code = schema.nodes.codeBlock
  if (!quote || !code) return false
  const selection = tr.selection
  const { from, to, empty } = selection
  // A quote chosen whole (its block bar) counts as all of its words chosen.
  const whole = selection instanceof NodeSelection && selection.node.type === quote
  const $from = whole ? doc.resolve(from + 1) : selection.$from
  const $to = whole ? doc.resolve(to - 1) : selection.$to
  // The innermost quote holding the whole selection, and its blocks the selection is in.
  const range = $from.blockRange($to, node => node.type === quote)
  if (!range) return false
  // All code already: Code block toggles it back, as it does everywhere. A chosen code block's language stays (a
  // ```text prompt, a diagram); of two different ones neither can.
  let lines = 0
  let codeLines = 0
  const languages = new Set<string>()
  doc.nodesBetween(from, to, node => {
    if (!node.isTextblock) return true
    lines++
    if (node.type === code) {
      codeLines++
      if (node.attrs.language) languages.add(String(node.attrs.language))
    }
    return false
  })
  if (lines > 0 && codeLines === lines) return false
  const chosen: PMNode[] = []
  const at: number[] = []
  for (let index = range.startIndex, pos = range.start; index < range.endIndex; index++) {
    const node = range.parent.child(index)
    // A list or a quote in the quote goes whole or not at all: never with words of it the selection left out.
    if (!node.isTextblock) {
      const span = wordsSpan(node, pos)
      if (span.start < 0 || from > span.start || to < span.end) return false
    }
    chosen.push(node)
    at.push(pos)
    pos += node.nodeSize
  }
  const parts = chosen.map(codeWordsOf)
  if (parts.some(part => part === null)) return false
  // Empty lines at the ends of the chosen ones aren't written.
  const [firstWords, lastWords] = wordedEnds(parts as string[])
  const words = (parts as string[]).slice(firstWords, lastWords + 1).join(PARAGRAPH_GAP)
  const language = attributes?.language ?? (languages.size === 1 ? [...languages][0] : null)

  // On a scratch copy first: the steps are taken only when the code block got out of at least one quote.
  const step = new Transform(doc)
  step.replaceWith(range.start, range.end, code.create({ ...attributes, language }, words ? schema.text(words) : null))
  let place = range.start
  let lifted = 0
  for (;;) {
    const $place = step.doc.resolve(place)
    const holder = $place.parent
    if (holder.type !== quote) break
    const size = step.doc.nodeAt(place)!.nodeSize
    const out = $place.blockRange(step.doc.resolve(place + size))
    // Only out into the quote's own place (a box, a column, a pane, the slide), never further.
    if (!out || liftTarget(out) !== out.depth - 1) break
    const index = $place.index()
    // A part of the quote with no words in it goes, after the code block first, then before it.
    if (index + 1 < holder.childCount && emptyLines(holder, index + 1, holder.childCount)) step.delete(place + size, $place.end())
    if (index > 0 && emptyLines(holder, 0, index)) {
      step.delete($place.start(), place)
      place = $place.start()
    }
    // The attribution stays with the words above the code block: a part after it that holds only "— Name" (empty lines
    // aside) joins the part before, right under its words. With no words before, it stays where it is, a one-line quote.
    const $now = step.doc.resolve(place)
    const rest = $now.parent
    const here = $now.index()
    const after: PMNode[] = []
    for (let index = here + 1; index < rest.childCount; index++) if (!isEmptyLine(rest.child(index))) after.push(rest.child(index))
    if (here > 0 && after.length === 1 && isAttribution(after[0])) {
      let kept = here
      while (kept > 0 && isEmptyLine(rest.child(kept - 1))) kept--
      const under = $now.posAtIndex(kept)
      step.delete(place + size, $now.end())
      step.delete(under, place)
      step.insert(under, after[0])
      place = under + after[0].nodeSize
    }
    const lift = step.doc.resolve(place).blockRange(step.doc.resolve(place + size))!
    const before = step.steps.length
    step.lift(lift, lift.depth - 1)
    place = step.mapping.slice(before).map(place + 1) - 1
    lifted++
  }
  if (!lifted) return false
  if (!dispatch) return true

  // The offset in the code block's words of a place in the chosen blocks: in a line, the same letter; in a list or a
  // quote (chosen whole), its start or its end.
  // Empty lines left out at the ends stand at the words' start or end.
  const starts: number[] = []
  let offset = 0
  parts.forEach((part, index) => {
    if (index < firstWords) starts.push(0)
    else if (index > lastWords) starts.push(words.length)
    else {
      starts.push(offset)
      offset += part!.length + PARAGRAPH_GAP.length
    }
  })
  const clamp = (offset: number) => Math.max(0, Math.min(offset, words.length))
  const wordAt = (pos: number, atEnd: boolean) => {
    for (let index = 0; index < chosen.length; index++) {
      const node = chosen[index]
      if (pos <= at[index] || pos >= at[index] + node.nodeSize) continue
      if (node.isTextblock) return clamp(starts[index] + pos - at[index] - 1)
      return clamp(atEnd ? starts[index] + parts[index]!.length : starts[index])
    }
    return atEnd ? words.length : 0
  }
  for (const each of step.steps) tr.step(each)
  const inside = place + 1
  const start = inside + (empty ? wordAt(from, true) : wordAt(from, false))
  const end = empty ? start : inside + wordAt(to, true)
  // A selection made backwards stays backwards, so Shift and an arrow go on from the same end.
  const backwards = selection.head < selection.anchor
  tr.setSelection(TextSelection.create(tr.doc, backwards ? end : start, backwards ? start : end)).setMeta(SLIDE_COMMAND, true)
  return true
}
