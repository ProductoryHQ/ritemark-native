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
 *
 * Sprint 117 (D3) adds the stable-id carrier: a LEADING `{id:<id>}` token is
 * lifted out of the body into `data-comment-id`. A document written before that
 * simply has no token and loads exactly as it did (`id: null`), so opening an old
 * file never rewrites it.
 */
import { escapeHtmlAttr, escapeHtmlText, detectAgentAlias } from './commentModel'

interface CommentToken {
  type: 'ritemarkComment'
  raw: string
  /** Stable comment id carried by a leading `{id:…}` token, or null. */
  id: string | null
  body: string
}

const COMMENT_RULE = /^<!--([\s\S]*?)-->/

/**
 * The standalone note's stable-id carrier (Sprint 117 D3): `<!-- {id:<id>} body -->`.
 * Deliberately narrow — a UUID (36 chars of hex and dashes) or the
 * `c-<base36>-<base36>` fallback `newCommentId()` produces when `crypto.randomUUID`
 * is unavailable. Anything else (`{id:not-a-uuid}`, `{id: 3}`) is ordinary body
 * text, so a user who literally writes braces keeps them.
 */
const ID_TOKEN_RULE = /^\{id:([0-9a-fA-F-]{36}|c-[a-z0-9]+-[a-z0-9]+)\}[ \t]*/

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
        const raw = match[1].trim()
        const idMatch = ID_TOKEN_RULE.exec(raw)
        return {
          type: 'ritemarkComment',
          raw: match[0],
          id: idMatch ? idMatch[1] : null,
          // The id token is metadata, never part of the note the user reads or
          // the body assignment is derived from.
          body: (idMatch ? raw.slice(idMatch[0].length) : raw).trim(),
        }
      },
      renderer(token: CommentToken): string {
        const alias = detectAgentAlias(token.body)
        const agentAttr = alias ? ` data-agent="${escapeHtmlAttr(alias)}"` : ''
        const idAttr = token.id ? ` data-comment-id="${escapeHtmlAttr(token.id)}"` : ''
        // Note lives in the `data-note` attribute (source of truth), HTML-escaped
        // so it can't break out. An attribute preserves `\n`, so multi-line bodies
        // round-trip without whitespace collapse. The body is ALSO the element's
        // text content so Turndown doesn't treat the element as blank and drop it
        // before the comment rule runs — the rule reads the attribute, not the text.
        return `<ritemark-comment data-note="${escapeHtmlAttr(token.body)}"${idAttr}${agentAttr}>${escapeHtmlText(token.body)}</ritemark-comment>`
      },
    },
  ],
}
