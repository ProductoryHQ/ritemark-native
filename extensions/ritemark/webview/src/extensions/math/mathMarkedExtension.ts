/**
 * Sprint 138 (#481, R1): the load half of the math round trip, as `marked`
 * tokenizers on the editor's scoped instance.
 *
 *  - `mathBlock` (block level, no `start()`): tried only where a block begins,
 *    so it never cuts a paragraph. A `$$` group right after a paragraph line
 *    stays in that paragraph, as display math there.
 *  - `mathInline`: `$…$`, `$$…$$`, `\(…\)` and `\[…\]` inside a paragraph,
 *    heading, list item, quote or table cell. `marked` tries extensions before
 *    its own tokenizers, so `\(` is ours before the escape tokenizer turns it
 *    into `(`, and a code span's backticks are consumed before its dollars are
 *    seen.
 *  - `literalDollar`: `\$`, kept as its own node so a save writes `\$` again.
 *
 * Each renders an element whose attributes carry the LaTeX and the exact
 * delimiters, and whose text is the source as written, so anything that does
 * not know math still shows the source.
 */
import { escapeHtmlAttr, escapeHtmlText } from '../comment/commentModel'
import { isEscapedAt, nextMathStart, scanBlockMath, scanInlineMath, type MathDelimiter } from './mathSyntax'

interface MathInlineToken {
  type: 'mathInline'
  raw: string
  delimiter: MathDelimiter
  latex: string
}

interface MathBlockToken {
  type: 'mathBlock'
  raw: string
  open: string
  close: string
  latex: string
}

interface LiteralDollarToken {
  type: 'literalDollar'
  raw: string
}

export const mathMarkedExtension = {
  extensions: [
    {
      name: 'mathBlock',
      level: 'block' as const,
      tokenizer(src: string): MathBlockToken | undefined {
        const match = scanBlockMath(src)
        if (!match) return undefined
        // Consume the closing line's newline too, as `marked`'s own block
        // tokenizers do; the blank line after it is the `space` token's.
        const raw = src.startsWith('\n', match.raw.length) ? `${match.raw}\n` : match.raw
        return { type: 'mathBlock', raw, open: match.open, close: match.close, latex: match.latex }
      },
      renderer(token: MathBlockToken): string {
        const source = `${token.open}${token.latex}${token.close}`
        return `<div data-math="block" data-open="${escapeHtmlAttr(token.open)}" data-close="${escapeHtmlAttr(token.close)}" data-latex="${escapeHtmlAttr(token.latex)}">${escapeHtmlText(source)}</div>\n`
      },
    },
    {
      name: 'literalDollar',
      level: 'inline' as const,
      start(src: string) {
        return nextMathStart(src)
      },
      tokenizer(src: string): LiteralDollarToken | undefined {
        return src.startsWith('\\$') ? { type: 'literalDollar', raw: '\\$' } : undefined
      },
      renderer(): string {
        return '<span data-literal-dollar="">$</span>'
      },
    },
    {
      name: 'mathInline',
      level: 'inline' as const,
      start(src: string) {
        return nextMathStart(src)
      },
      tokenizer(src: string): MathInlineToken | undefined {
        // `src` starts where `marked` stands; a backslash before it was
        // already consumed as an escape, so position 0 is never escaped.
        if (isEscapedAt(src, 0)) return undefined
        const match = scanInlineMath(src, 0)
        if (!match) return undefined
        return { type: 'mathInline', raw: match.raw, delimiter: match.delimiter, latex: match.latex }
      },
      renderer(token: MathInlineToken): string {
        return `<span data-math="inline" data-delimiter="${escapeHtmlAttr(token.delimiter)}" data-latex="${escapeHtmlAttr(token.latex)}">${escapeHtmlText(token.raw)}</span>`
      },
    },
  ],
}
