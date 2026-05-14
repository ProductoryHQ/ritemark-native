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

/** Returns the final on-disk filename actually written. */
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
