/**
 * Turndown rules — the save half of the comment round-trip. Re-emit the two
 * comment carriers back to their canonical Markdown storage forms:
 *
 *  - `<ritemark-comment>`      → `<!-- body -->`               (standalone note)
 *  - `<mark data-comment="…">` → `<mark data-comment="…">…</mark>` (anchored)
 *
 * Body text is the element's own text content / attribute (source of truth);
 * nothing is reconstructed from the derived `data-agent` alias.
 */
import type TurndownService from 'turndown'
import { escapeHtmlAttr } from './commentModel'

export function addCommentTurndownRules(service: TurndownService): void {
  // Standalone note → HTML comment. textContent is the verbatim body; the DOM
  // has already decoded the entities we escaped on the load side, so this
  // round-trips a body that contained `<`, `>`, or `&`.
  service.addRule('ritemarkComment', {
    filter: (node) => node.nodeName.toLowerCase() === 'ritemark-comment',
    replacement: (_content, node) => {
      // The note is the `data-note` attribute (source of truth); it keeps any
      // newlines, so a multi-line body round-trips intact.
      const body = ((node as HTMLElement).getAttribute('data-note') || '').trim()
      return `\n\n<!-- ${body} -->\n\n`
    },
  })

  // Anchored comment → keep the mark wrapper carrying the note in its attribute.
  // `content` is the turndown-processed inner text (so nested emphasis etc.
  // survives); the note + alias come from attributes.
  service.addRule('commentMark', {
    filter: (node) =>
      node.nodeName.toLowerCase() === 'mark' &&
      (node as HTMLElement).hasAttribute('data-comment'),
    replacement: (content, node) => {
      const el = node as HTMLElement
      const note = el.getAttribute('data-comment') || ''
      // An unfilled comment (empty note) is not a real comment — unwrap it so it
      // doesn't persist and force a compose bubble on every reload (audit M-A).
      if (!note.trim()) return content
      // Shared comment id (#150) — persist it so a multi-block comment reloads
      // as ONE comment instead of re-fragmenting into one per block.
      const id = el.getAttribute('data-comment-id')
      const idAttr = id ? ` data-comment-id="${escapeHtmlAttr(id)}"` : ''
      const agent = el.getAttribute('data-agent')
      const agentAttr = agent ? ` data-agent="${escapeHtmlAttr(agent)}"` : ''
      return `<mark data-comment="${escapeHtmlAttr(note)}"${idAttr}${agentAttr}>${content}</mark>`
    },
  })
}
