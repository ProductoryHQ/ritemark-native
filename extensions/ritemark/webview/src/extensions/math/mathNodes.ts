/**
 * Sprint 138 (#481): the editor's math nodes, without their views.
 *
 *  - `mathInline`: an equation in a line. `$…$`, or display math written inside
 *    a paragraph (`$$…$$`, `\[…\]`), or ChatGPT's `\(…\)`.
 *  - `mathBlock`: an equation block on lines of its own (`$$` or `\[`).
 *  - `literalDollar`: a `\$` in the file, shown as `$` and saved as `\$`.
 *
 * The LaTeX and its exact delimiters live in attributes, as TipTap 3's own
 * Mathematics nodes keep them, so a save writes them back untouched and the
 * TipTap 3 upgrade (#243) keeps the model. Each node's text for the AI's
 * selection, a comment's captured text and the clipboard is the equation's
 * source with its delimiters (`leafText`, `renderText`).
 *
 * Pasted rendered math (KaTeX's HTML, or MathML with a TeX annotation, as
 * ChatGPT's and Claude's pages and Wikipedia carry) becomes these nodes too.
 *
 * The views (typesetting, editing) are added by the editor through
 * `EditorExtensionSlots`, as the code block's and the image's are.
 */
import { Node, mergeAttributes, type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CLOSING_DELIMITER, inlineMathSource, type MathDelimiter } from './mathSyntax'

const DELIMITERS: MathDelimiter[] = ['$', '$$', '\\(', '\\[']

function readDelimiter(value: string | null): MathDelimiter | null {
  return value !== null && (DELIMITERS as string[]).includes(value) ? (value as MathDelimiter) : null
}

/** The source of an inline math node, as the file has it. */
export function mathInlineSource(node: PMNode): string {
  return inlineMathSource(node.attrs.latex ?? '', (node.attrs.delimiter ?? '$') as MathDelimiter)
}

/** The source of a math block, as the file has it. */
export function mathBlockSource(node: PMNode): string {
  return `${node.attrs.open ?? '$$'}${node.attrs.latex ?? ''}${node.attrs.close ?? '$$'}`
}

/** The TeX a pasted KaTeX or MathML element carries, or null. */
export function texAnnotation(element: HTMLElement): string | null {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]')
  const tex = annotation?.textContent ?? element.querySelector('math')?.getAttribute('alttext') ?? (element.tagName.toLowerCase() === 'math' ? element.getAttribute('alttext') : null)
  if (tex === null || tex === undefined) return null
  // Wikipedia wraps its TeX in `{\displaystyle …}`; the braces are not part of the formula.
  const unwrapped = /^\{\\(?:displaystyle|textstyle)\s*([\s\S]*)\}$/.exec(tex.trim())
  const latex = (unwrapped ? unwrapped[1] : tex).trim()
  return latex ? latex : null
}

function isDisplayMathElement(element: HTMLElement): boolean {
  if (element.classList?.contains('katex-display')) return true
  const math = element.tagName.toLowerCase() === 'math' ? element : element.querySelector('math')
  return math?.getAttribute('display') === 'block'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** Insert an empty equation block at the selection, open for editing. */
      insertMathBlock: () => ReturnType
    }
  }
}

/** The storage both math nodes share with their views: which equation opens for editing next. */
export interface MathEditingStorage {
  /** The position of an equation a command or an input rule asked to open. */
  openAt: number | null
}

export const MathInline = Node.create<Record<string, never>, MathEditingStorage>({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addStorage() {
    return { openAt: null }
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex'),
        renderHTML: attributes => ({ 'data-latex': attributes.latex }),
      },
      delimiter: {
        default: '$',
        parseHTML: element => readDelimiter(element.getAttribute('data-delimiter')),
        renderHTML: attributes => ({ 'data-delimiter': attributes.delimiter }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-math="inline"]' },
      // Rendered math pasted from a page that uses KaTeX (ChatGPT, Claude) or
      // MathML with its TeX (Wikipedia). Display math becomes a block (below).
      {
        tag: 'span.katex',
        priority: 60,
        getAttrs: element => {
          const latex = texAnnotation(element as HTMLElement)
          return latex === null ? false : { latex, delimiter: '$' }
        },
      },
      {
        tag: 'math',
        priority: 60,
        getAttrs: element => {
          const el = element as HTMLElement
          if (isDisplayMathElement(el)) return false
          const latex = texAnnotation(el)
          return latex === null ? false : { latex, delimiter: '$' }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-math': 'inline' }, HTMLAttributes), mathInlineSource(node)]
  },

  renderText({ node }) {
    return mathInlineSource(node)
  },

  extendNodeSchema(extension) {
    return extension.name === 'mathInline' ? { leafText: (node: PMNode) => mathInlineSource(node) } : {}
  },
})

export const MathBlock = Node.create<Record<string, never>, MathEditingStorage>({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  defining: true,

  addStorage() {
    return { openAt: null }
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex'),
        renderHTML: attributes => ({ 'data-latex': attributes.latex }),
      },
      open: {
        default: '$$',
        parseHTML: element => element.getAttribute('data-open'),
        renderHTML: attributes => ({ 'data-open': attributes.open }),
      },
      close: {
        default: '$$',
        parseHTML: element => element.getAttribute('data-close'),
        renderHTML: attributes => ({ 'data-close': attributes.close }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-math="block"]' },
      {
        tag: 'span.katex-display',
        priority: 61,
        getAttrs: element => {
          const latex = texAnnotation(element as HTMLElement)
          return latex === null ? false : { latex: `\n${latex}\n`, open: '$$', close: '$$' }
        },
      },
      {
        tag: 'math',
        priority: 61,
        getAttrs: element => {
          const el = element as HTMLElement
          if (!isDisplayMathElement(el)) return false
          const latex = texAnnotation(el)
          return latex === null ? false : { latex: `\n${latex}\n`, open: '$$', close: '$$' }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-math': 'block' }, HTMLAttributes), mathBlockSource(node)]
  },

  renderText({ node }) {
    return mathBlockSource(node)
  },

  extendNodeSchema(extension) {
    return extension.name === 'mathBlock' ? { leafText: (node: PMNode) => mathBlockSource(node) } : {}
  },

  addCommands() {
    return {
      insertMathBlock:
        () =>
        ({ editor, tr, dispatch }) => {
          const { $from } = tr.selection
          if ($from.depth < 1) return false
          // A Markdown table cell holds one line; an equation block cannot live there.
          for (let depth = $from.depth; depth > 0; depth--) {
            const name = $from.node(depth).type.name
            if (name === 'tableCell' || name === 'tableHeader') return false
          }
          if (!dispatch) return true
          // A new block's source is empty; the view writes it on lines of its own.
          const node = this.type.create({ latex: '', open: '$$', close: '$$' })
          const paragraph = $from.parent
          const replaceEmpty = paragraph.type.name === 'paragraph' && paragraph.content.size === 0
          const at = replaceEmpty ? $from.before() : $from.after()
          if (replaceEmpty) tr.replaceWith(at, $from.after(), node)
          else tr.insert(at, node)
          const storage = (editor as Editor).storage.mathBlock as MathEditingStorage
          storage.openAt = at
          return true
        },
    }
  },
})

export const LiteralDollar = Node.create({
  name: 'literalDollar',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'span[data-literal-dollar]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-literal-dollar': '' }, HTMLAttributes), '$']
  },

  renderText() {
    return '$'
  },

  extendNodeSchema(extension) {
    return extension.name === 'literalDollar' ? { leafText: () => '$' } : {}
  },
})

/** Every math extension, in schema order. */
export const mathSchemaExtensions = [MathInline, MathBlock, LiteralDollar]

/** The closing delimiter for an inline delimiter (re-exported for the views). */
export { CLOSING_DELIMITER }
