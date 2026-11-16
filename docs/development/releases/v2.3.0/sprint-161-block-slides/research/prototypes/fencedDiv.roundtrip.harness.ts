/**
 * Sprint 161 spike: the editor's own load and save, with the `:::` prototype registered (shared by the spike tests).
 */
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { installTestDocument, editorHTML } from '../utils/markdownFidelity'
import { createEditorSchemaExtensions, editorMarked, editorTurndownService, editorHTMLToMarkdown, markdownToEditorHTML } from '../utils/editorMarkdown'
import { FencedDiv, addFencedDivTurndownRule, fencedDivMarkedExtension } from './fencedDiv'

installTestDocument()
editorMarked.use(fencedDivMarkedExtension as Parameters<typeof editorMarked.use>[0])
addFencedDivTurndownRule(editorTurndownService)
export const schema = getSchema(createEditorSchemaExtensions({ deck: [FencedDiv] }))

function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

export function load(markdown: string): PMNode {
  return PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(markdown)))
}
export function save(doc: PMNode): string {
  return editorHTMLToMarkdown(editorHTML(doc))
}
