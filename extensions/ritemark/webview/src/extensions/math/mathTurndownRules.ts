/**
 * Sprint 138 (#481, R2): the save half of the math round trip.
 *
 *  - An equation is written from its attributes: its delimiters and LaTeX
 *    exactly as they were, never escaped (a save used to double every
 *    backslash, drop `\{`, `\,` and `\%`'s, escape `_` and turn `\(x\)` into
 *    `(x)`).
 *  - An equation block sits on lines of its own, as blocks do.
 *  - A `\$` from the file is written `\$` again.
 *  - A `$` typed as text is written as it is, unless a reader would pair it
 *    up as math on reopening; then it is written `\$`. So `$5`, `costs $5 and
 *    $10` and `$HOME` stay as typed, and what the editor shows is what
 *    reopening shows.
 *
 * Pairing is a paragraph-wide question: `marked` sees a whole paragraph, so a
 * typed `$5 and ` before an equation's own `$x$` reads as one long equation.
 * Turndown's escaper only sees one text node, so the pairing is worked out
 * when Turndown first meets a text block (its rules' filters run before the
 * block's children are escaped): the dollars that would pair are swapped for
 * a private-use character, which the escaper then writes as `\$`.
 */
import type TurndownService from 'turndown'
import { CLOSING_DELIMITER, inlineMathSource, isEscapedAt, scanInlineMath, type MathDelimiter } from './mathSyntax'

/** Stands in for a typed `$` that has to be written `\$`. */
const PAIRING_DOLLAR = '\ue0d0'
const PAIRING_DOLLAR_PATTERN = /\ue0d0/g

/** The elements whose inline content `marked` reads as one run. */
const TEXT_BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'LI'])

/** Elements that start a block of their own inside a text block (a list item's paragraph, a nested list). */
const BLOCK_CHILDREN = new Set([
  'P', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
])

type Escape = (text: string) => string

interface ScanChar {
  char: string
  /** A typed `$` that may be escaped: the text node and which of its dollars it is. */
  literal?: { node: Text; ordinal: number }
  /** Set on an equation's first character: where the equation ends; `marked` reads it whole. */
  mathEnd?: number
}

/**
 * An equation element's source, from its attributes. Its text is the source
 * too, but Turndown collapses the whitespace in text before any rule runs,
 * and an equation's line breaks and spaces are part of what is written back.
 */
export function mathElementSource(element: Element): string | null {
  const kind = element.getAttribute('data-math')
  const latex = element.getAttribute('data-latex') ?? ''
  if (kind === 'inline') {
    const written = element.getAttribute('data-delimiter') ?? '$'
    const delimiter = (written in CLOSING_DELIMITER ? written : '$') as MathDelimiter
    return inlineMathSource(latex, delimiter)
  }
  if (kind === 'block') {
    return `${element.getAttribute('data-open') ?? '$$'}${latex}${element.getAttribute('data-close') ?? '$$'}`
  }
  return null
}

/**
 * The paragraph as `marked` will read it, character by character: text as
 * Turndown escapes it, equations and code as written, and the markup around
 * emphasis and links. Only dollars, backslashes, spaces and digits decide
 * where math starts and ends, so the markup's exact characters matter little.
 */
function collectScanChars(element: Element, escape: Escape, out: ScanChar[]): void {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      const node = child as Text
      let ordinal = 0
      for (const char of escape(node.nodeValue ?? '')) {
        out.push(char === '$' ? { char, literal: { node, ordinal: ordinal++ } } : { char })
      }
      continue
    }
    if (child.nodeType !== 1) continue
    const el = child as Element
    const tag = el.nodeName.toUpperCase()
    if (BLOCK_CHILDREN.has(tag)) continue
    if (el.hasAttribute('data-literal-dollar')) {
      out.push({ char: '\\' }, { char: '$' })
      continue
    }
    const source = mathElementSource(el)
    if (source !== null) {
      const start = out.length
      for (const char of source) out.push({ char })
      if (out.length > start) out[start].mathEnd = out.length
      continue
    }
    if (tag === 'BR') {
      out.push({ char: '\n' })
      continue
    }
    if (tag === 'CODE') {
      for (const char of `\`${el.textContent ?? ''}\``) out.push({ char })
      continue
    }
    if (tag === 'A') {
      out.push({ char: '[' })
      collectScanChars(el, escape, out)
      for (const char of `](${el.getAttribute('href') ?? ''})`) out.push({ char })
      continue
    }
    const wrap = tag === 'STRONG' || tag === 'B' ? '**'
      : tag === 'EM' || tag === 'I' ? '*'
        : tag === 'S' || tag === 'DEL' || tag === 'STRIKE' ? '~~'
          : ''
    for (const char of wrap) out.push({ char })
    collectScanChars(el, escape, out)
    for (const char of wrap) out.push({ char })
  }
}

/**
 * Mark the typed dollars in one text block that `marked` would open (or close)
 * an equation with. Scans left to right as `marked` does: an equation is read
 * whole; at a typed `$` that would start math, that `$` (and its partner, when
 * the partner is typed too) is marked, and scanning goes on right after it,
 * because what lay between them is now read as text again.
 */
export function markPairingDollars(element: Element, escape: Escape): void {
  const chars: ScanChar[] = []
  collectScanChars(element, escape, chars)
  if (!chars.some(entry => entry.literal)) return

  const marked = new Map<Text, Set<number>>()
  const mark = (entry: ScanChar | undefined): boolean => {
    if (!entry?.literal) return false
    const ordinals = marked.get(entry.literal.node) ?? new Set<number>()
    ordinals.add(entry.literal.ordinal)
    marked.set(entry.literal.node, ordinals)
    return true
  }
  /** Equation positions shift as backslashes go in; keep `mathEnd` pointing at the same character. */
  const insertBackslash = (at: number) => {
    chars.splice(at, 0, { char: '\\' })
    for (const entry of chars) if (entry.mathEnd !== undefined && entry.mathEnd > at) entry.mathEnd++
  }

  let index = 0
  while (index < chars.length) {
    const entry = chars[index]
    if (entry.mathEnd !== undefined) {
      index = entry.mathEnd
      continue
    }
    if (entry.char === '$' && entry.literal) {
      const text = chars.map(c => c.char).join('')
      const match = isEscapedAt(text, index) ? null : scanInlineMath(text, index)
      if (match && (match.delimiter === '$' || match.delimiter === '$$')) {
        const width = match.delimiter.length
        const closeAt = index + match.raw.length - width
        // The closer first, so the opener's indices stay put.
        for (let offset = width - 1; offset >= 0; offset--) {
          if (mark(chars[closeAt + offset])) insertBackslash(closeAt + offset)
        }
        // Then the opener's typed dollars. When its second `$` is an
        // equation's own, scanning resumes at that equation.
        let next = index
        for (let offset = 0; offset < width && chars[next]?.literal; offset++) {
          mark(chars[next])
          insertBackslash(next)
          next += 2
        }
        index = next
        continue
      }
    }
    index++
  }

  for (const [node, ordinals] of marked) {
    let ordinal = 0
    node.nodeValue = (node.nodeValue ?? '').replace(/\$/g, dollar => (ordinals.has(ordinal++) ? PAIRING_DOLLAR : dollar))
  }
}

/** Add the math rules to a Turndown service; its escaper writes pairing dollars as `\$`. */
export function addMathTurndownRules(service: TurndownService): void {
  const escapeBefore = service.escape.bind(service) as Escape
  service.escape = (text: string) => escapeBefore(text).replace(PAIRING_DOLLAR_PATTERN, '\\$')

  const judged = new WeakSet<object>()
  service.addRule('mathPairingDollars', {
    // Never claims a node. Turndown asks every rule's filter about an element
    // before it escapes that element's text: the moment to judge the dollars
    // of a whole paragraph.
    filter(node) {
      if (TEXT_BLOCKS.has(node.nodeName) && !judged.has(node)) {
        judged.add(node)
        markPairingDollars(node as unknown as Element, escapeBefore)
      }
      return false
    },
    replacement: content => content,
  })

  service.addRule('mathInline', {
    filter: node => node.nodeName === 'SPAN' && (node as HTMLElement).getAttribute('data-math') === 'inline',
    replacement: (_content, node) => mathElementSource(node as HTMLElement) ?? '',
  })

  service.addRule('mathBlock', {
    filter: node => node.nodeName === 'DIV' && (node as HTMLElement).getAttribute('data-math') === 'block',
    replacement: (_content, node) => {
      const element = node as HTMLElement
      // An equation emptied and left is gone from the file.
      if (!(element.getAttribute('data-latex') ?? '').trim()) return '\n\n'
      return `\n\n${mathElementSource(element)}\n\n`
    },
  })

  service.addRule('literalDollar', {
    filter: node => node.nodeName === 'SPAN' && (node as HTMLElement).hasAttribute('data-literal-dollar'),
    replacement: () => '\\$',
  })
}
