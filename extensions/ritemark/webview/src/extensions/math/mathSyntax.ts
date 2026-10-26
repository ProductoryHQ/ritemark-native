/**
 * Sprint 138 (#481, R1): what counts as math in a Markdown file, in one place.
 *
 * The `marked` tokenizer (load), the input and paste rules (typing and pasting)
 * and the dollar escaper (save) all ask these functions, so they can never
 * disagree about whether `$…$` is an equation. The rules are Pandoc's
 * `tex_math_dollars`, which GitHub and Obsidian follow closely:
 *
 *  - inline `$…$`: a non-space character right after the opening `$`, a
 *    non-space character right before the closing `$`, no digit right after
 *    it, and no blank line between. So `costs $5 and $10` is prose.
 *  - display `$$…$$`: anything but a blank line between the delimiters, spaces
 *    and line breaks around the formula allowed.
 *  - ChatGPT's `\(…\)` (inline) and `\[…\]` (display), with no blank line inside.
 *  - a backslash-escaped delimiter (`\$`, `\\)`'s second half aside) never
 *    opens or closes.
 *
 * Pure functions, no DOM: the tests run them in Node.
 */

/** How an inline equation is written: its opening delimiter. */
export type MathDelimiter = '$' | '$$' | '\\(' | '\\['

export const CLOSING_DELIMITER: Record<MathDelimiter, string> = {
  '$': '$',
  '$$': '$$',
  '\\(': '\\)',
  '\\[': '\\]',
}

/** Whether a delimiter shows its equation in display style (centred, on its own line). */
export function isDisplayDelimiter(delimiter: MathDelimiter): boolean {
  return delimiter === '$$' || delimiter === '\\['
}

export interface InlineMathMatch {
  delimiter: MathDelimiter
  /** The LaTeX between the delimiters, exactly as written. */
  latex: string
  /** The whole equation as written, delimiters included. */
  raw: string
}

export interface BlockMathMatch {
  /** The opening delimiter, `$$` or `\[`. */
  open: string
  /** The closing delimiter, `$$` or `\]`. */
  close: string
  /** Everything between them, line breaks included, untrimmed. */
  latex: string
  /** The block as written, through the end of its closing line (newline excluded). */
  raw: string
}

const BLANK_LINE = /\n[ \t]*\n/

/** Whether the character at `index` is escaped: preceded by an odd run of backslashes. */
export function isEscapedAt(text: string, index: number): boolean {
  let backslashes = 0
  while (index - backslashes > 0 && text[index - backslashes - 1] === '\\') backslashes++
  return backslashes % 2 === 1
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

/** The first unescaped `needle` at or after `from`, or -1. */
function findUnescaped(text: string, needle: string, from: number): number {
  let index = text.indexOf(needle, from)
  while (index >= 0 && isEscapedAt(text, index)) index = text.indexOf(needle, index + 1)
  return index
}

/**
 * An inline equation starting exactly at `at` in `src`, or null.
 *
 * `src[at]` must be the opening delimiter itself; the caller decides whether
 * that position is escaped (a `marked` tokenizer sees the escape first).
 */
export function scanInlineMath(
  src: string,
  at = 0,
  opensLine = at === 0 || src[at - 1] === '\n',
): InlineMathMatch | null {
  if (src.startsWith('$$', at)) return scanDisplayDollars(src, at)
  if (src[at] === '$') return scanInlineDollar(src, at)
  if (src.startsWith('\\(', at)) return scanBackslash(src, at, '\\(', '\\)')
  if (src.startsWith('\\[', at)) return opensLine ? scanBracketDisplay(src, at) : null
  return null
}

/**
 * `\[…\]` is display math only on lines of its own: `\[` opening a line and
 * `\]` closing one, as ChatGPT writes it. In running text it is text, because
 * Ritemark 2.0.1 and earlier saved every literal bracket as `\[` and `\]`:
 * "See \[1\] and \[draft\]." is a sentence with two references, not math.
 */
function scanBracketDisplay(src: string, at: number): InlineMathMatch | null {
  const match = scanBackslash(src, at, '\\[', '\\]')
  if (!match) return null
  return /^[ \t]*(?:\n|$)/.test(src.slice(at + match.raw.length)) ? match : null
}

function scanInlineDollar(src: string, at: number): InlineMathMatch | null {
  const contentStart = at + 1
  if (isSpace(src[contentStart]) || src[contentStart] === '$') return null
  let close = findUnescaped(src, '$', contentStart)
  while (close >= 0) {
    const inside = src.slice(contentStart, close)
    if (BLANK_LINE.test(inside)) return null
    if (!isSpace(src[close - 1]) && !isDigit(src[close + 1]) && close > contentStart) {
      return { delimiter: '$', latex: inside, raw: src.slice(at, close + 1) }
    }
    close = findUnescaped(src, '$', close + 1)
  }
  return null
}

function scanDisplayDollars(src: string, at: number): InlineMathMatch | null {
  const contentStart = at + 2
  const close = findUnescaped(src, '$$', contentStart)
  if (close < 0) return null
  const latex = src.slice(contentStart, close)
  if (!latex.trim() || BLANK_LINE.test(latex)) return null
  return { delimiter: '$$', latex, raw: src.slice(at, close + 2) }
}

function scanBackslash(src: string, at: number, open: '\\(' | '\\[', close: string): InlineMathMatch | null {
  const contentStart = at + 2
  const end = findUnescaped(src, close, contentStart)
  if (end < 0) return null
  const latex = src.slice(contentStart, end)
  if (!latex.trim() || BLANK_LINE.test(latex)) return null
  return { delimiter: open, latex, raw: src.slice(at, end + close.length) }
}

/**
 * An equation block at the very start of `src`: `$$` or `\[` opening a line,
 * the matching delimiter closing a line (the same line or a later one), no
 * blank line inside, and nothing but spaces after the closing delimiter.
 *
 * The block must also end its paragraph: a blank line or the end of the text
 * after it. A `$$` group with text right after it stays inside its paragraph
 * as display math there, so a save writes it back without adding a blank line.
 */
export function scanBlockMath(src: string): BlockMathMatch | null {
  const open = src.startsWith('$$') ? '$$' : src.startsWith('\\[') ? '\\[' : null
  if (!open) return null
  const close = open === '$$' ? '$$' : '\\]'
  const end = findUnescaped(src, close, open.length)
  if (end < 0) return null
  const latex = src.slice(open.length, end)
  if (!latex.trim() || BLANK_LINE.test(latex)) return null
  const afterClose = end + close.length
  const lineEnd = src.indexOf('\n', afterClose)
  const restOfLine = src.slice(afterClose, lineEnd < 0 ? src.length : lineEnd)
  if (restOfLine.trim()) return null
  if (lineEnd >= 0) {
    const following = src.slice(lineEnd + 1)
    const nextLineEnd = following.indexOf('\n')
    const nextLine = nextLineEnd < 0 ? following : following.slice(0, nextLineEnd)
    if (nextLine.trim()) return null
  }
  return { open, close, latex, raw: src.slice(0, afterClose) }
}

/** Where the next possible math or escaped dollar starts in `src`, for `marked`'s `start()`. */
export function nextMathStart(src: string): number | undefined {
  const match = /\$|\\[$(\[]/.exec(src)
  return match ? match.index : undefined
}

export interface DelimiterSpan {
  /** Index of the delimiter in the text. */
  index: number
  /** Its length: 1 for `$`, 2 for `$$`. */
  length: number
}

/**
 * The literal dollars in a run of text that a reader would pair up as math:
 * both delimiters of every `$…$` and `$$…$$` that `scanInlineMath` finds,
 * scanning left to right as `marked` does. Backslash-escaped dollars are
 * already literal and are skipped. Used by the save path to escape exactly
 * these, so `$5`, `costs $5 and $10` and `$HOME` are written as they are.
 */
export function literalMathPairs(text: string): DelimiterSpan[] {
  const spans: DelimiterSpan[] = []
  let at = text.indexOf('$')
  while (at >= 0) {
    if (isEscapedAt(text, at)) {
      at = text.indexOf('$', at + 1)
      continue
    }
    const match = scanInlineMath(text, at)
    if (match && (match.delimiter === '$' || match.delimiter === '$$')) {
      const width = match.delimiter.length
      spans.push({ index: at, length: width })
      spans.push({ index: at + match.raw.length - width, length: width })
      at = text.indexOf('$', at + match.raw.length)
    } else {
      // `$$` that does not pair as display math is two single dollars to `marked`.
      at = text.indexOf('$', at + 1)
    }
  }
  return spans
}

/** Write `\$` for every dollar in `text` that would otherwise pair up as math on reopening. */
export function escapeLiteralDollars(text: string): string {
  const spans = literalMathPairs(text)
  if (spans.length === 0) return text
  let output = ''
  let cursor = 0
  for (const span of spans) {
    output += text.slice(cursor, span.index) + '\\$'.repeat(span.length)
    cursor = span.index + span.length
  }
  return output + text.slice(cursor)
}

/**
 * Inline LaTeX as an edit leaves it, before it is written between `$`: trimmed
 * of the spaces just inside the delimiters (`$ x $` would not read as math),
 * and with each bare `$` written `\$` so it cannot close the equation early.
 */
export function normalizeInlineLatex(latex: string, delimiter: MathDelimiter): string {
  if (delimiter !== '$') return latex
  const trimmed = latex.trim()
  let output = ''
  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index]
    output += char === '$' && !isEscapedAt(trimmed, index) ? '\\$' : char
  }
  return output
}

/** An equation's source as the file has it. */
export function inlineMathSource(latex: string, delimiter: MathDelimiter): string {
  return `${delimiter}${latex}${CLOSING_DELIMITER[delimiter]}`
}
