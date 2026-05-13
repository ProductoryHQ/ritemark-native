import * as fs from 'fs';
import * as path from 'path';

/**
 * Sanitize a filename base for safe use on disk.
 * Mirrors the rules used by the paste-flow saveImage handler:
 * NFD normalize → strip diacritics → non-[a-zA-Z0-9_-] → '-' → collapse → trim.
 */
export function sanitizeImageBaseName(rawBaseName: string): string {
  return rawBaseName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Write a base64-encoded image into `targetDir` with a sanitized filename.
 * The directory is created (recursively) if missing.
 *
 * @returns the final on-disk filename actually written (after sanitization
 *          and fallback to `image` when the base name sanitizes to empty)
 */
export function writeImageRelativeTo(
  targetDir: string,
  rawFilename: string,
  base64: string
): string {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(rawFilename);
  const rawBaseName = path.basename(rawFilename, ext);
  const sanitizedBaseName = sanitizeImageBaseName(rawBaseName);
  const finalFilename = `${sanitizedBaseName || 'image'}${ext}`;
  const imagePath = path.join(targetDir, finalFilename);

  fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
  return finalFilename;
}
