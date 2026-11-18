/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): the Button block's nodes, the same on a slide and in a Text
 * document (a deck's handout is one).
 *
 *  - `buttonBlock`: the block, `buttonWords buttonLabel`, with what the file wrote and the editor keeps as attributes
 *    (`buttonMarkdown.ts` reads and writes them): the address (`href`), the link's destination as written (`dest`), its
 *    title, its attribute block (`attrs`) and the separator (`sep`).
 *  - `buttonWords`: the words beside the button, typed in place, with the marks a paragraph has.
 *  - `buttonLabel`: the button's own words, plain text, after its icon (a page for a file, an arrow out otherwise).
 *
 * A decoration says which button is chosen (the accent ring) and which is alone (no words beside it), and gives the two
 * empty places their faint words. Enter, Backspace and Delete keep the block's two parts apart (`buttonCommands.ts`).
 */
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { BUTTON_ATTRIBUTES, BUTTON_WORDS, buttonIconOf, isButtonAddress } from '../../../../src/decks/blocks/buttonBlock'
import { iconSvg } from '../../components/decks/slide/pageIcons'
import { BUTTON_LABEL_NODE, BUTTON_NODE, BUTTON_WORDS_NODE, buttonAt, buttonBackspace, buttonDelete, buttonEnter } from './buttonCommands'

/** One attribute kept as written: read from and written back to its own `data-*` attribute. */
function data(key: string, name: string, fallback: string | null) {
  return {
    default: fallback,
    parseHTML: (element: HTMLElement) => element.getAttribute(name) ?? fallback,
    renderHTML: (attrs: Record<string, unknown>) => (attrs[key] === null || attrs[key] === undefined ? {} : { [name]: String(attrs[key]) }),
  }
}

export const ButtonBlock = Node.create({
  name: BUTTON_NODE,
  group: 'block',
  content: `${BUTTON_WORDS_NODE} ${BUTTON_LABEL_NODE}`,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      href: data('href', 'data-href', ''),
      dest: data('dest', 'data-dest', ''),
      title: data('title', 'data-title', null),
      attrs: data('attrs', 'data-attrs', BUTTON_ATTRIBUTES),
      sep: data('sep', 'data-sep', ' '),
      mdTight: data('mdTight', 'data-md-tight', null),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-button]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = String(node.attrs.href ?? '')
    return ['div', mergeAttributes({ 'data-button': '', class: 'blk-button', 'data-icon': href ? buttonIconOf(isButtonAddress(href) ? href : null) : 'file' }, HTMLAttributes), 0]
  },
})

/**
 * Its keys, before the slide's own (Enter, Backspace) and the editor's: they act only with the caret in a button. An
 * extension of their own: a node's priority would also put it first among the blocks, and an empty block (a new box)
 * would be filled with a button instead of an empty line.
 */
const ButtonKeys = Extension.create({
  name: 'buttonBlockKeys',
  priority: 1100,
  addKeyboardShortcuts() {
    const run = (make: typeof buttonEnter | typeof buttonBackspace) => () => {
      const result = make(this.editor.state)
      if (result === 'stop') return true
      if (!result) return false
      this.editor.view.dispatch(result)
      return true
    }
    return { Enter: run(buttonEnter), Backspace: run(buttonBackspace), Delete: run(buttonDelete) }
  },
})

export const ButtonWords = Node.create({
  name: BUTTON_WORDS_NODE,
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-button-words]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-button-words': '', class: 'blk-button-words' }, HTMLAttributes), 0]
  },
})

/** The icons a label draws; its block's `data-icon` shows one (`slide.css`, `buttonBlock.css`). */
const LABEL_ICONS = `<span class="is-file">${iconSvg('file-text', 16)}</span><span class="is-link">${iconSvg('arrow-up-right', 16)}</span>`

export const ButtonLabel = Node.create({
  name: BUTTON_LABEL_NODE,
  content: 'text*',
  marks: '',
  defining: true,
  parseHTML() {
    return [{ tag: 'span[data-button-label]', contentElement: (element: HTMLElement) => element.querySelector<HTMLElement>('.blk-btn-text') ?? element }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-button-label': '', class: 'blk-btn' }, HTMLAttributes), ['span', { class: 'blk-btn-icon', contenteditable: 'false' }], ['span', { class: 'blk-btn-text' }, 0]]
  },
  addNodeView() {
    return () => {
      const dom = document.createElement('span')
      dom.className = 'blk-btn'
      dom.setAttribute('data-button-label', '')
      const icon = document.createElement('span')
      icon.className = 'blk-btn-icon'
      icon.contentEditable = 'false'
      icon.innerHTML = LABEL_ICONS
      const text = document.createElement('span')
      text.className = 'blk-btn-text'
      dom.append(icon, text)
      return {
        dom,
        contentDOM: text,
        ignoreMutation: (mutation: { type: string; target: globalThis.Node }) => mutation.type !== 'selection' && icon.contains(mutation.target),
      }
    }
  },
})

const decorationsKey = new PluginKey<boolean>('buttonBlockLook')

/** The button's ring off: the focus left the editor from its address sheet (a press elsewhere). */
export function unchooseButton(view: { state: import('@tiptap/pm/state').EditorState; dispatch: (tr: import('@tiptap/pm/state').Transaction) => void }): void {
  view.dispatch(view.state.tr.setMeta(decorationsKey, false))
}

/**
 * The chosen button's ring (`is-chosen`), a button with no words beside it (`is-solo`), and the faint words of its two
 * places while they are empty.
 */
const ButtonLook = Extension.create({
  name: 'buttonBlockLook',
  addProseMirrorPlugins() {
    return [new Plugin<boolean>({
      key: decorationsKey,
      // Whether the editor has the focus: a button is chosen (its ring) only then, never while the person writes elsewhere.
      state: {
        init: () => false,
        apply: (tr, focused) => {
          const meta = tr.getMeta(decorationsKey) as boolean | undefined
          return meta === undefined ? focused : meta
        },
      },
      props: {
        handleDOMEvents: {
          focus: view => { view.dispatch(view.state.tr.setMeta(decorationsKey, true)); return false },
          // Into the button's own bar or address sheet, the button stays chosen.
          blur: (view, event) => {
            const to = (event as FocusEvent).relatedTarget as Element | null
            if (to && typeof to.closest === 'function' && to.closest('.btn-block-bar, .btn-block-sheet')) return false
            view.dispatch(view.state.tr.setMeta(decorationsKey, false))
            return false
          },
        },
        decorations(state) {
          if (!state.schema.nodes[BUTTON_NODE]) return null
          const chosen = decorationsKey.getState(state) ? buttonAt(state) : null
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name !== BUTTON_NODE) return !node.isTextblock && !node.isAtom
            const words = node.child(0)
            const label = node.child(1)
            const classes = [words.content.size === 0 ? 'is-solo' : '', chosen?.pos === pos ? 'is-chosen' : ''].filter(Boolean).join(' ')
            if (classes) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: classes }))
            if (words.content.size === 0) decorations.push(Decoration.node(pos + 1, pos + 1 + words.nodeSize, { 'data-empty': '', 'data-button-placeholder': BUTTON_WORDS.wordsPlaceholder }))
            if (label.content.size === 0) {
              const from = pos + 1 + words.nodeSize
              decorations.push(Decoration.node(from, from + label.nodeSize, { 'data-empty': '' }))
            }
            return false
          })
          return decorations.length ? DecorationSet.create(state.doc, decorations) : null
        },
      },
    })]
  },
})

/** The Button block's extensions: its three nodes and its look. */
export const buttonBlockExtensions = [ButtonBlock, ButtonWords, ButtonLabel, ButtonLook, ButtonKeys]
