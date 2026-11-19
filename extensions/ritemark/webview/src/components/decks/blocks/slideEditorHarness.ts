/**
 * Sprint 161: the slide editor's load and save without a browser, for the tests (domino as the DOM, as the corpus and
 * deck round-trip tests use it). Test support only: no product code imports it.
 */
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { editorHTML, installTestDocument } from '../../../utils/markdownFidelity'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { SlideAgenda, SlideDiv, ensureSlideCommentPipeline, markdownToSlideEditorHTML, slideEditorHTMLToMarkdown } from './slideEditorMarkdown'
import { SlideLabel } from './slideLabel'

installTestDocument()

export const slideSchema = getSchema(createEditorSchemaExtensions({ deck: [SlideDiv, SlideAgenda, SlideLabel] }))

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

/** A block slide's Markdown as the slide editor's document. */
export function loadSlide(markdown: string): PMNode {
  return PMDOMParser.fromSchema(slideSchema).parse(elementFromString(markdownToSlideEditorHTML(markdown)))
}

/** The slide editor's document as Markdown. */
export function saveSlide(doc: PMNode): string {
  return slideEditorHTMLToMarkdown(editorHTML(doc))
}

/** Sprint 161: the slide editor's schema with the comment flag on (the comment mark and note), as the stage has it. */
export const slideCommentSchema = getSchema(createEditorSchemaExtensions({ deck: [SlideDiv, SlideAgenda, SlideLabel], commentCallouts: true }))

/**
 * A block slide's Markdown as the slide editor's document with comments on (`ensureSlideCommentPipeline` first: the
 * comment tokenizer then stays on the shared slide `marked` for the rest of the run, as it does in the app).
 */
export function loadSlideWithComments(markdown: string): PMNode {
  ensureSlideCommentPipeline()
  return PMDOMParser.fromSchema(slideCommentSchema).parse(elementFromString(markdownToSlideEditorHTML(markdown)))
}
