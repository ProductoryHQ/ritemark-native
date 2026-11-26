/**
 * One picture editor (experience 49): the editors' load of a picture's attribute block (`{width=50% crop=16:9}`, see
 * `src/markdown/pictureLook.ts`). The block after an image is kept, as written, on the image's `data-picture`, which the
 * image node keeps as its `picture` attribute and the save writes back after the image line (`turndownService.ts`).
 *
 * Registered on the document editor's `marked` and on the slide editor's own, so a picture keeps its look in a Text
 * document, in a deck's handout and on a slide.
 */
import { pictureBlockTokenizer, type ImageTokenWithLook } from '../../../../src/markdown/pictureLook'

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Match the label of an already parsed inline image, including escaped or nested brackets.
const inlineImageLabel = /^!\[(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?\](?=\()/

interface ImageRendererContext {
  parser: { renderer: { image: (href: string, title: string | null, text: string) => string } }
}

/** The `marked` extension: the block's tokenizer, and the image drawn with the block on `data-picture`. */
export const pictureMarkedExtension = {
  extensions: [
    pictureBlockTokenizer,
    {
      name: 'image',
      renderer(this: ImageRendererContext, token: ImageTokenWithLook): string | false {
        const label = inlineImageLabel.exec(token.raw)?.[0]
        const html = this.parser.renderer.image(token.href, token.title, token.text)
        const written = label
          ? ` data-md-image-label="${escapeAttribute(label)}" data-md-image-target="${escapeAttribute(token.raw.slice(label.length))}"`
          : ''
        const look = token.picture ? ` data-picture="${escapeAttribute(token.picture)}"` : ''
        return html.replace(/^<img\s/, () => `<img${written}${look} `)
      },
    },
  ],
}
