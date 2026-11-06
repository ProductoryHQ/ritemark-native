/**
 * The pure parts of a Cloudflare publish (Sprint 149, W4): names, the manifest, the noindex header, the limits.
 * From the spike (`cf-publish-spike.mjs`, ritemark-dev `releases/v2.2.0/analysis/2026-10-29-spikes/`); what A4 still
 * has to measure is marked with its M number.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { UploadFile } from '../host';
import { PublishError } from '../host';
import { NAME_PATTERN } from '../sheetProtocol';
import { plainPart } from '../plainText';
import { MAX_FILE_BYTES, MAX_FILES } from '../types';

/** A Worker's name, and a workers.dev name: lowercase letters, digits and dashes, 1–63, no dash at either end. */
export const NAME_RE = NAME_PATTERN;

/** Every response carries noindex (R7); no robots.txt block, so a search engine can see it (M7). */
export const NOINDEX_HEADERS = '/*\n  X-Robots-Tag: noindex\n';

export const COMPATIBILITY_DATE = '2026-10-29';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json', txt: 'text/plain; charset=utf-8', xml: 'application/xml',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
};

function extensionOf(urlPath: string): string {
  const base = urlPath.slice(urlPath.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1) : '';
}

export function contentTypeFor(urlPath: string): string {
  return MIME[extensionOf(urlPath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * The asset's key in the upload session: sha256 of base64(content) + extension, 32 hex characters, as Cloudflare's
 * direct-upload sample does. Wrangler sends blake3 of the same input; M3 measures whether sha256 is accepted.
 */
export function assetHash(bytes: Uint8Array, urlPath: string): string {
  return createHash('sha256').update(Buffer.from(bytes).toString('base64') + extensionOf(urlPath)).digest('hex').slice(0, 32);
}

export interface ManifestEntry {
  urlPath: string;
  hash: string;
  size: number;
  contentType: string;
  bytes: Uint8Array;
}

/** The manifest, after the free plan's limits: over a limit, nothing is sent (R3, S15). */
export function buildManifest(assets: readonly UploadFile[]): { manifest: Record<string, { hash: string; size: number }>; entries: ManifestEntry[] } {
  if (assets.length === 0) throw new PublishError('failed', 'There is nothing to publish.');
  if (assets.length > MAX_FILES) throw new PublishError('too-many', `This page uses ${assets.length} files. Cloudflare's free plan takes ${MAX_FILES}.`);
  const manifest: Record<string, { hash: string; size: number }> = {};
  const entries: ManifestEntry[] = [];
  for (const asset of assets) {
    if (!asset.urlPath.startsWith('/') || asset.urlPath.includes('..') || manifest[asset.urlPath]) {
      throw new PublishError('failed', 'A file in this page has a path Ritemark could not publish.');
    }
    if (asset.bytes.byteLength > MAX_FILE_BYTES) {
      const name = asset.urlPath.slice(asset.urlPath.lastIndexOf('/') + 1);
      throw new PublishError('too-big', `${plainPart(name)} is larger than 25 MB, too big to publish.`);
    }
    const hash = assetHash(asset.bytes, asset.urlPath);
    manifest[asset.urlPath] = { hash, size: asset.bytes.byteLength };
    entries.push({ urlPath: asset.urlPath, hash, size: asset.bytes.byteLength, contentType: contentTypeFor(asset.urlPath), bytes: asset.bytes });
  }
  return { manifest, entries };
}

/** The URL path a page is served at under `html_handling: auto-trailing-slash`. */
export function pageUrlPath(key: string): string {
  if (key === '/index.html') return '/';
  if (key.endsWith('/index.html')) return key.slice(0, -'index.html'.length);
  return key.replace(/\.html?$/i, '');
}

/** A file's name made web-safe: `Harbour programme.html` → `harbour-programme`. */
export function slug(name: string, max = 40): string {
  const stem = name.replace(/\.[^.]*$/, '');
  const ascii = stem.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '') || 'page';
}

/** The page's part of the address, with the random part at its end (Jarmo, decision 3): `harbour-programme-7f3a2c`. */
export function siteNameFor(fileName: string, random: () => Buffer = () => randomBytes(3)): string {
  return `${slug(fileName, 50)}-${random().toString('hex').slice(0, 6)}`;
}

/** The first sheet's workers.dev name: "pages" and four digits, never the person's or company's name (answer 5). */
export function suggestSubdomain(random: () => number = Math.random): string {
  return `pages-${String(Math.floor(random() * 9000) + 1000)}`;
}

/** A name typed in the sheet, made web-safe as it is typed; null when nothing usable is left. */
export function cleanName(typed: string): string | null {
  const cleaned = typed.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
  return NAME_RE.test(cleaned) ? cleaned : null;
}

export function siteAddress(siteName: string, subdomain: string, pageKey = '/index.html'): string {
  return `https://${siteName}.${subdomain}.workers.dev${pageUrlPath(pageKey)}`;
}
