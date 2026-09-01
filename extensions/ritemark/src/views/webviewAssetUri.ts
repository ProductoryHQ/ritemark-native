import * as fs from 'fs';

export type AssetMtimeReader = (fsPath: string) => number;

const readAssetMtime: AssetMtimeReader = (fsPath) => fs.statSync(fsPath).mtimeMs;

/**
 * Give a webview asset URL a content-changing cache key. Returning the base URL
 * on stat failure preserves exotic providers, while normal packaged/dev paths
 * always receive a stable integer mtime query.
 */
export function versionedWebviewAssetUri(
  baseUri: string,
  fsPath: string,
  readMtime: AssetMtimeReader = readAssetMtime,
): string {
  try {
    const hashIndex = baseUri.indexOf('#');
    const uri = hashIndex >= 0 ? baseUri.slice(0, hashIndex) : baseUri;
    const hash = hashIndex >= 0 ? baseUri.slice(hashIndex) : '';
    const separator = uri.includes('?') ? '&' : '?';
    return `${uri}${separator}v=${Math.round(readMtime(fsPath))}${hash}`;
  } catch {
    return baseUri;
  }
}
