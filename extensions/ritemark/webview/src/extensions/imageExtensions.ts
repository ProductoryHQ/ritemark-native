import Image from '@tiptap/extension-image'

export const ImageExtension = Image.configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: {
    class: 'tiptap-image',
    loading: 'lazy',
    decoding: 'async',
  },
})
