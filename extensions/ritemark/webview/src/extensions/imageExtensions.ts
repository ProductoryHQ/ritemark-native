/**
 * ResizableImageExtension
 *
 * Extends TipTap Image with custom NodeView that has resize handles.
 * Resizing permanently changes the image file (not just display size).
 *
 * @see Sprint 26: Image Resize
 */

import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ResizableImage } from '../components/ResizableImage'

export const ImageExtension = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage)
  },
}).configure({
  inline: false,  // Block-level so /image replaces empty paragraph instead of inserting into it
  allowBase64: true,
  HTMLAttributes: {
    class: 'tiptap-image',
    loading: 'lazy',
    decoding: 'async',
  },
})
