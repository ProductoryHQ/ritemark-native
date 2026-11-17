/**
 * The Text editor's image node: the one picture node both editors use (experience 49), drawn as a block of the
 * document, with its size, alignment, crop and caption kept beside its image line. A draw.io diagram opens its own
 * editor on a double click (Sprint 82).
 *
 * Sprint 26's resize rewrote the picture's file after a confirmation; experience 49 replaces it: the file is never
 * changed, and the size is kept in the document.
 */
import { sendToExtension } from '../bridge'
import { editorImageOptions } from '../utils/editorMarkdown'
import { PictureImage } from './pictures/PictureNode'

export const ImageExtension = PictureImage.configure({
  ...editorImageOptions,
  context: 'document',
  openDiagram: relativePath => sendToExtension('openDrawioDiagram', { relativePath }),
})
