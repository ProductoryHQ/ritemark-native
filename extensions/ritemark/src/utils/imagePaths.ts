/**
 * Markdown image paths that point at a file beside the document.
 *
 * Shared by the host (which maps them to webview URIs for display) and the
 * webview (which writes the original path back on save). Both sides must
 * agree: a path the host maps but the webview does not restore is saved as
 * the webview URI, which breaks the image outside Ritemark.
 *
 * Pure module — no `vscode` import — so the webview bundle can use it.
 */

/** `./a.png`, `../a.png` and the common bare form `img/a.png`. */
export function isRelativeImagePath(value: string): boolean {
  const path = value.trim();
  if (!path) return false;
  // Any scheme (http:, data:, file:, vscode-resource:) or a Windows drive (C:).
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return !path.startsWith('/') && !path.startsWith('\\') && !path.startsWith('#');
}

/** A URI the webview can load only because the host mapped a local file to it. */
export function isWebviewResourceUri(src: string): boolean {
  return /^(vscode-webview|vscode-resource):/i.test(src)
    || /^https?:\/\/[^/]*vscode-(resource|cdn)/i.test(src);
}

/** Compare two relative image paths, ignoring a leading `./`. */
export function sameRelativeImagePath(a: string, b: string): boolean {
  const normal = (p: string) => p.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  return normal(a) === normal(b);
}
