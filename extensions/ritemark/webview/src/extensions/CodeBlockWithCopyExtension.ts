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

export default CodeBlockWithCopyExtension
