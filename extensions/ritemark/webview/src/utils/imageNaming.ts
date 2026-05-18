// Webview-side mirror of utils/imageWriter.ts in the extension. Sanitizing
// here keeps the markdown reference in lock-step with the on-disk filename.
// The sanitizer is idempotent, so the extension running it again is a no-op.

export function sanitizeImageBaseName(rawBaseName: string): string {
  return rawBaseName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// `<sanitized-source>--image-<index>.<ext>` — two different sources never
// collide; re-importing the same source overwrites previous images.
export function buildExtractedImageFilename(
  sourceBasename: string,
  index1Based: number,
  ext: string
): string {
  const cleanBase = sanitizeImageBaseName(sourceBasename) || 'document'
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'png'
  return `${cleanBase}--image-${index1Based}.${cleanExt}`
}

export function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export interface MimeMapping {
  ext: string
  recognized: boolean
}

/**
 * Map an image MIME type to a filename extension. `recognized: false` means
 * the bytes might not actually be PNG even though we'll save them with that
 * extension — callers should surface a warning so the user knows the .md
 * may reference a file the markdown viewer can't render (e.g. WMF/EMF in
 * legacy Word docs).
 */
export function mimeToExt(contentType: string): MimeMapping {
  const subtype = contentType.toLowerCase().replace(/^image\//, '').split(/[;+]/)[0].trim()
  switch (subtype) {
    case 'jpeg':
    case 'jpg':
      return { ext: 'jpg', recognized: true }
    case 'svg+xml':
    case 'svg':
      return { ext: 'svg', recognized: true }
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'tiff':
      return { ext: subtype, recognized: true }
    default:
      return { ext: 'png', recognized: false }
  }
}
