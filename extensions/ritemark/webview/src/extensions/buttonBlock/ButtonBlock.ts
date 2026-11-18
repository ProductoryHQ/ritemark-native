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
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { BUTTON_ATTRIBUTES, BUTTON_ICONS, BUTTON_WORDS, buttonIconFor } from '../../../../src/decks/blocks/buttonBlock'
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
    // The renderer's own choice (`buttonIconFor`), so the stage and the strip draw the same icon.
    return ['div', mergeAttributes({ 'data-button': '', class: 'blk-button', 'data-icon': buttonIconFor(String(node.attrs.href ?? '')) }, HTMLAttributes), 0]
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
const LABEL_ICONS = `<span class="is-file">${BUTTON_ICONS.file}</span><span class="is-link">${BUTTON_ICONS.link}</span>`

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

/** The look's state: whether the editor has the focus, and the decorations (with how many buttons the document holds). */
interface LookState {
  focused: boolean
  buttons: number
  set: DecorationSet
}

const decorationsKey = new PluginKey<LookState>('buttonBlockLook')

/** The button's ring off: the focus left the editor from its address sheet (a press elsewhere). */
export function unchooseButton(view: { state: EditorState; dispatch: (tr: Transaction) => void }): void {
  view.dispatch(view.state.tr.setMeta(decorationsKey, false))
}

/** The chosen button's ring, the alone look and the faint words of the empty places, for `state`. */
function lookOf(state: EditorState, focused: boolean): LookState {
  const chosen = focused ? buttonAt(state) : null
  const decorations: Decoration[] = []
  let buttons = 0
  state.doc.descendants((node, pos) => {
    if (node.type.name !== BUTTON_NODE) return !node.isTextblock && !node.isAtom
    buttons++
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
  return { focused, buttons, set: decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty }
}

/** Does a transaction put a button in (a step's new content holds one)? */
function addsButton(tr: Transaction): boolean {
  return tr.steps.some(step => {
    const slice = (step as unknown as { slice?: { content: { descendants: (f: (node: PMNode) => boolean | void) => void } } }).slice
    let found = false
    slice?.content.descendants(node => {
      if (found) return false
      if (node.type.name === BUTTON_NODE) found = true
      return !found && !node.isTextblock
    })
    return found
  })
}

/**
 * The chosen button's ring (`is-chosen`, only while the editor, its bar or its sheet has the focus), a button with no
 * words beside it (`is-solo`), and the faint words of its two places while they are empty. The document is walked only
 * when it holds buttons or a change put one in: a Text document without any costs a step's slice per keystroke.
 */
const ButtonLook = Extension.create({
  name: 'buttonBlockLook',
  addProseMirrorPlugins() {
    return [new Plugin<LookState>({
      key: decorationsKey,
      state: {
        init: (_config, state) => lookOf(state, false),
        apply: (tr, previous, _old, state) => {
          const meta = tr.getMeta(decorationsKey) as boolean | undefined
          const focused = meta === undefined ? previous.focused : meta
          if (!tr.docChanged && !tr.selectionSet && focused === previous.focused) return previous
          if (previous.buttons === 0 && !(tr.docChanged && addsButton(tr))) return focused === previous.focused ? previous : { ...previous, focused }
          return lookOf(state, focused)
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
        decorations: state => decorationsKey.getState(state)?.set ?? null,
      },
    })]
  },
})

/** The Button block's extensions: its three nodes and its look. */
export const buttonBlockExtensions = [ButtonBlock, ButtonWords, ButtonLabel, ButtonLook, ButtonKeys]
