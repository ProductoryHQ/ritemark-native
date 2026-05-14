import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'

/**
 * Create a fresh TurndownService configured with Ritemark's canonical
 * HTML → Markdown rules. Use this for any HTML-to-MD conversion (paste-flow
 * "Copy as Markdown", DOCX-preview Save as Markdown, etc.) so output style
 * stays consistent across surfaces.
 *
 * Includes:
 *  - ATX headings, fenced code blocks, `-` bullet, `*` italic, `**` bold
 *  - GFM tables + task list items
 *  - Pipe-escape rule for table cells (the GFM plugin doesn't escape `|`
 *    inside cell content by default and that breaks tables containing code)
 *
 * TipTap-specific rules (`tiptapTaskItem`, `tiptapTaskList`,
 * `imageWithRelativePath`) live in `components/Editor.tsx` and are layered
 * on top of this base when the editor module is loaded.
 */
export function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  })

  service.use(tables)
  service.use(taskListItems)

  // Escape pipes inside table cells so cell content containing `|` does not
  // break the surrounding GFM table structure.
  service.addRule('tableCellWithPipeEscape', {
    filter: ['th', 'td'],
    replacement(content, node) {
      const escapedContent = content.replace(/\|/g, '\\|')
      const index = node.parentNode
        ? Array.prototype.indexOf.call(node.parentNode.childNodes, node)
        : 0
      const prefix = index === 0 ? '| ' : ' '
      return prefix + escapedContent + ' |'
    },
  })

  return service
}
