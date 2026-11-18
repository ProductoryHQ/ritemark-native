/**
 * CodeBlockWithCopyExtension
 *
 * Extends CodeBlockLowlight to use a custom React NodeView with copy button.
 *
 * @see Sprint 14: Block Interactions
 */

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeBlockWithCopy } from '../components/CodeBlockWithCopy'

export const CodeBlockWithCopyExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithCopy)
  },
})

/**
 * Sprint 163 PR 1: the same code block on a slide, where Copy always shows and its ↗ Open in… sits beside it
 * (`CodeBlockWithCopy`, `surface: 'slide'`).
 */
export const SlideCodeBlock = CodeBlockWithCopyExtension.extend({
  addOptions() {
    return { ...this.parent?.(), surface: 'slide' }
  },
})

export default CodeBlockWithCopyExtension
