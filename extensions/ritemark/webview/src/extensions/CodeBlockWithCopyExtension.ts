/**
 * CodeBlockWithCopyExtension
 *
 * Extends CodeBlockLowlight to use a custom React NodeView with copy button.
 *
 * @see Sprint 14: Block Interactions
 */

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import type { RawCommands } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockWithCopy } from '../components/CodeBlockWithCopy'
import { codeOutOfQuote } from '../components/decks/blocks/slideCommands'

export const CodeBlockWithCopyExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithCopy)
  },
})

/**
 * Sprint 163 PR 1: the same code block on a slide, where Copy always shows and its ↗ Open in… sits beside it
 * (`CodeBlockWithCopy`, `surface: 'slide'`).
 *
 * Sprint 168 PR 2: its Code block (the bubble's `toggleCodeBlock`, the / menu's `setCodeBlock`, ⌘⌥C) on words inside a
 * quote takes them out of the quote as one code block (`codeOutOfQuote`); anywhere else it does what it does in a Text
 * document. The Text editor's code block keeps its own commands.
 */
export const SlideCodeBlock = CodeBlockWithCopyExtension.extend({
  addOptions() {
    return { ...this.parent?.(), surface: 'slide' }
  },
  addCommands() {
    const parent: Partial<RawCommands> = this.parent?.() ?? {}
    return {
      ...parent,
      setCodeBlock: attributes => props => codeOutOfQuote(props.tr, attributes, !!props.dispatch) || !!parent.setCodeBlock?.(attributes)(props),
      toggleCodeBlock: attributes => props => codeOutOfQuote(props.tr, attributes, !!props.dispatch) || !!parent.toggleCodeBlock?.(attributes)(props),
    }
  },
})

export default CodeBlockWithCopyExtension
