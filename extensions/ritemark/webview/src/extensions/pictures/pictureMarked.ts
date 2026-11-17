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
        // A picture without a block is drawn as marked draws it.
        if (!token.picture) return false
        const html = this.parser.renderer.image(token.href, token.title, token.text)
        return html.replace(/^<img\s/, `<img data-picture="${escapeAttribute(token.picture)}" `)
      },
    },
  ],
}
