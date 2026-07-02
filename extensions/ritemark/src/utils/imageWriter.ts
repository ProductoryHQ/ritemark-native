import * as fs from 'fs';
import * as path from 'path';

// Sanitization matches paste-flow saveImage: NFD → strip diacritics →
// non-[a-zA-Z0-9_-] → '-' → collapse → trim. Idempotent.
export function sanitizeImageBaseName(rawBaseName: string): string {
  return rawBaseName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// image/<subtype> → on-disk extension. Compound subtypes like `svg+xml` are the
// reason a naive `(\w+)` regex fails: it matches `svg` but chokes on `+xml`,
// so an SVG picked via the image picker was rejected as "Invalid image data URL"
// even though the picker offered .svg (issue: SVG insert, Sprint 90 R6).
const IMAGE_SUBTYPE_TO_EXT: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  bmp: 'bmp',
  tiff: 'tiff',
  'svg+xml': 'svg',
};

/**
 * Parse a base64 image data URL into a file extension + raw base64 payload.
 * Returns null for anything that is not a base64 `data:image/*` URL. Handles
 * compound subtypes (`svg+xml`) that map to a clean extension (`svg`).
 */
export function parseImageDataUrl(dataUrl: string): { extension: string; base64: string } | null {
  const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  const subtype = match[1].toLowerCase();
  const extension = IMAGE_SUBTYPE_TO_EXT[subtype] ?? subtype.replace(/[^a-z0-9]/g, '');
  return { extension, base64: match[2] };
}

export interface WriteImageOptions {
  // The save-as-markdown flow already builds canonical filenames via
  // buildExtractedImageFilename (webview) — `<sanitized-base>--image-N.<ext>`.
  // Re-running the sanitizer on that whole string collapses the `--` separator
  // and produces a name the .md no longer references. Trusted callers pass true.
  skipSanitize?: boolean;
}

/** Returns the final on-disk filename actually written. */
export function writeImageRelativeTo(
  targetDir: string,
  rawFilename: string,
  base64: string,
  options: WriteImageOptions = {}
): string {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let finalFilename: string;
  if (options.skipSanitize) {
    // Defense in depth: even when the caller asserts the filename is already
    // canonical, refuse anything that could escape targetDir on disk. The
    // sanitizer's char-replace step was incidentally providing this guard
    // before skipSanitize existed; without an explicit check a crafted
    // webview message could traverse via `../foo` or absolute paths.
    if (
      rawFilename.length === 0 ||
      /[/\\]/.test(rawFilename) ||
      rawFilename.startsWith('.')
    ) {
      throw new Error(`Refusing unsafe image filename: ${rawFilename}`);
    }
    finalFilename = rawFilename;
  } else {
    const ext = path.extname(rawFilename);
    const rawBaseName = path.basename(rawFilename, ext);
    const sanitizedBaseName = sanitizeImageBaseName(rawBaseName);
    finalFilename = `${sanitizedBaseName || 'image'}${ext}`;
  }
  const imagePath = path.join(targetDir, finalFilename);

  fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
  return finalFilename;
}
