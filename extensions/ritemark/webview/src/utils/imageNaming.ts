/**
 * Filename helpers for Save-as-Markdown image extraction.
 *
 * Mirrors the sanitization rules used by the extension-host `writeImageRelativeTo`
 * helper (extensions/ritemark/src/utils/imageWriter.ts). Running the sanitizer
 * on both sides is idempotent — the webview produces the canonical filename so
 * the markdown reference matches the on-disk filename exactly.
 */

export function sanitizeImageBaseName(rawBaseName: string): string {
  return rawBaseName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Build the canonical filename for an extracted image:
 * `<sanitized-source>--image-<index>.<ext>`
 *
 * Two different source files never collide; re-importing the same source
 * overwrites previous images (correct).
 */
export function buildExtractedImageFilename(
  sourceBasename: string,
  index1Based: number,
  ext: string
): string {
  const cleanBase = sanitizeImageBaseName(sourceBasename) || 'document'
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'png'
  return `${cleanBase}--image-${index1Based}.${cleanExt}`
}

/**
 * Map an image MIME type to a filename extension.
 */
export function mimeToExt(contentType: string): string {
  const subtype = contentType.toLowerCase().replace(/^image\//, '').split(/[;+]/)[0].trim()
  switch (subtype) {
    case 'jpeg':
    case 'jpg':
      return 'jpg'
    case 'svg+xml':
    case 'svg':
      return 'svg'
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'tiff':
      return subtype
    default:
      return 'png'
  }
}
