/**
 * Getting pictures into a Google Doc (Sprint 119, integration-decisions
 * § Images).
 *
 * Docs fetches every image itself, anonymously, from a URL of at most 2 KB, so
 * inline base64 only fits a thumbnail. The route Phase 0 measured and chose:
 * upload the image to the user's own Drive, make it link-readable for the few
 * seconds the insert needs, insert it, then revoke the sharing and delete the
 * copy. Google keeps its own copy of the bytes inside the document, verified
 * after deletion. Six images totalling 4 MB took about 7 seconds.
 *
 * An image that cannot be read or that Google cannot fetch is never dropped
 * silently: it is returned with a reason, and the user is told.
 */

import { tryLoadImageSource } from '../export/v2/imageSource';
import type { GoogleApiClient } from './GoogleApiClient';
import type { Block } from './mapper';

export interface StagedImage {
  fileId: string;
  permissionId: string | null;
}

export interface ResolvedImages {
  uris: Map<Block, string>;
  reasons: Map<Block, string>;
  staged: StagedImage[];
}

const MAX_PARALLEL_UPLOADS = 4;

function sniffMime(bytes: Buffer): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 6 && bytes.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'image/gif';
  return null;
}

/**
 * A webview resource URL (`https://file+.vscode-resource.vscode-cdn.net/…`)
 * looks remote but names a file on this machine; turn it back into a path.
 */
export function webviewResourcePath(source: string): string | null {
  try {
    const url = new URL(source);
    if (!/vscode-resource|vscode-cdn\.net|vscode-webview/i.test(url.host)) return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function isRemote(source: string): boolean {
  return /^https?:\/\//i.test(source) && webviewResourcePath(source) === null;
}

/** A remote image Docs can fetch directly, with no upload. */
function directlyFetchable(source: string): boolean {
  return /^https:\/\//i.test(source) && /\.(png|jpe?g|gif)(\?|#|$)/i.test(source);
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}

export async function resolveImages(
  images: Block[],
  documentPath: string,
  client: Pick<GoogleApiClient, 'uploadImage' | 'shareByLink'>,
): Promise<ResolvedImages> {
  const uris = new Map<Block, string>();
  const reasons = new Map<Block, string>();
  const staged: StagedImage[] = [];

  await inBatches(images, MAX_PARALLEL_UPLOADS, async (block) => {
    // TipTap keeps the original relative path in `title` and a webview URL in
    // `src`; a real image title falls through to `src`.
    const candidates = [block.title, block.src].filter((c): c is string => Boolean(c && c.trim()));
    let bytes: Buffer | null = null;
    for (const candidate of candidates) {
      if (isRemote(candidate)) continue;
      bytes = tryLoadImageSource(webviewResourcePath(candidate) ?? candidate, { fsPath: documentPath });
      if (bytes) break;
    }
    if (!bytes) {
      const remote = candidates.find(isRemote);
      if (remote && directlyFetchable(remote)) uris.set(block, remote);
      else reasons.set(block, remote ? 'Google Docs cannot fetch this image format' : 'the image file was not found, or is not a PNG or JPEG');
      return;
    }
    const mime = sniffMime(bytes);
    if (!mime) {
      reasons.set(block, 'the image is not a PNG, JPEG or GIF');
      return;
    }

    let fileId: string | null = null;
    try {
      fileId = await client.uploadImage(bytes, mime, `ritemark-publish-image.${mime.split('/')[1]}`);
      const permissionId = await client.shareByLink(fileId);
      staged.push({ fileId, permissionId });
      uris.set(block, `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`);
    } catch {
      if (fileId) staged.push({ fileId, permissionId: null });
      reasons.set(block, 'the image could not be uploaded to Google Drive');
    }
  });

  return { uris, reasons, staged };
}

/** Revoke the temporary sharing and delete every staged copy, best effort. */
export async function unstageImages(
  staged: StagedImage[],
  client: Pick<GoogleApiClient, 'unshare' | 'deleteFile'>,
): Promise<void> {
  await Promise.all(staged.map(async ({ fileId, permissionId }) => {
    try { if (permissionId) await client.unshare(fileId, permissionId); } catch { /* deleting removes it anyway */ }
    try { await client.deleteFile(fileId); } catch { /* reported in diagnostics only */ }
  }));
}
