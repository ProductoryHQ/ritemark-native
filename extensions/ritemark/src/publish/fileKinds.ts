/**
 * A file's kind by its extension, for Publish (`gather.ts`) and for the lists
 * that leave a deck's own pictures out (`decks/deckFolderListing.ts`). It has
 * no imports beyond `node:path`, so the search worker can load it without
 * Publish's gathering code.
 */
import * as path from 'node:path';
import type { FileKind } from './types';

export const KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  '.png': 'picture', '.jpg': 'picture', '.jpeg': 'picture', '.gif': 'picture', '.webp': 'picture', '.avif': 'picture',
  '.heic': 'picture', '.heif': 'picture', '.jxl': 'picture', '.svgz': 'picture',
  '.svg': 'picture', '.ico': 'picture', '.bmp': 'picture', '.apng': 'picture', '.tif': 'picture', '.tiff': 'picture',
  '.css': 'style',
  '.js': 'script', '.mjs': 'script', '.cjs': 'script',
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font', '.eot': 'font',
};

export function isPictureFile(p: string): boolean {
  return KIND_BY_EXTENSION[path.extname(p).toLowerCase()] === 'picture';
}
