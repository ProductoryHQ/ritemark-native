import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'
import { isRelativeImagePath, isWebviewResourceUri } from '../../../src/utils/imagePaths'

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
 *  - Image rule preferring `title="./..."` over DOM-resolved `src` (used for
 *    both paste-flow and Save-as-Markdown image references)
 *
 * TipTap-specific task-list rules live in `taskListRoundTrip.ts` and are
 * layered on top by `components/Editor.tsx` when the editor loads.
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

  // Image rule: the title holds the canonical relative path whenever the src
  // is only a display URI — set by the host's image mapping (./a.png,
  // ../a.png, img/a.png) or by paste-flow's saveImage and mammoth's
  // convertImage (always ./). A title on a remote image is the author's own
  // caption and never replaces its src.
  service.addRule('imageWithRelativePath', {
    filter: 'img',
    replacement(_content, node) {
      const el = node as HTMLImageElement
      const alt = el.alt || ''
      const title = el.getAttribute('title') || ''
      const displaySrc = el.getAttribute('src') || el.src
      const src = title.startsWith('./') || (isRelativeImagePath(title) && isWebviewResourceUri(displaySrc))
        ? title
        : displaySrc
      return `![${alt}](${src})`
    },
  })

  return service
}
