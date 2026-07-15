/**
 * `marked` extension that turns a standalone HTML comment `<!-- ... -->` into a
 * stable `<ritemark-comment>` element during tokenization — the load half of the
 * round-trip Sprint 72 could not solve with a `parseHTML` rule alone (ProseMirror
 * cannot select raw DOM Comment nodes).
 *
 * Because this is a block-level tokenizer running inside `marked`'s own pass, a
 * fenced code block is consumed by the fence tokenizer first and its contents
 * never reach here — so `<!-- not a comment -->` inside a fence stays intact.
 *
 * Only STANDALONE (own-block) comments use this path; anchored comments are a
 * `<mark data-comment>` element that `marked` already passes through untouched.
 *
 * The element's text content is the full, verbatim body (source of truth); the
 * derived `data-agent` alias is a render hint only.
 */
import { escapeHtmlAttr, escapeHtmlText, parseCommentBody } from './commentModel'

interface CommentToken {
  type: 'ritemarkComment'
  raw: string
  body: string
}

const COMMENT_RULE = /^<!--([\s\S]*?)-->/

export const commentMarkedExtension = {
  extensions: [
    {
      name: 'ritemarkComment',
      level: 'block' as const,
      start(src: string) {
        const i = src.indexOf('<!--')
        return i < 0 ? undefined : i
      },
      tokenizer(src: string): CommentToken | undefined {
        const match = COMMENT_RULE.exec(src)
        if (!match) return undefined
        return {
          type: 'ritemarkComment',
          raw: match[0],
          body: match[1].trim(),
        }
      },
      renderer(token: CommentToken): string {
        const { alias } = parseCommentBody(token.body)
        const agentAttr = alias ? ` data-agent="${escapeHtmlAttr(alias)}"` : ''
        // Note lives in the `data-note` attribute (source of truth), HTML-escaped
        // so it can't break out. An attribute preserves `\n`, so multi-line bodies
        // round-trip without whitespace collapse. The body is ALSO the element's
        // text content so Turndown doesn't treat the element as blank and drop it
        // before the comment rule runs — the rule reads the attribute, not the text.
        return `<ritemark-comment data-note="${escapeHtmlAttr(token.body)}"${agentAttr}>${escapeHtmlText(token.body)}</ritemark-comment>`
      },
    },
  ],
}
