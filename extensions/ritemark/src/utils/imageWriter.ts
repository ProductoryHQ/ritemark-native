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
