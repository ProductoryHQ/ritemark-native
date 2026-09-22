import * as path from 'path';

/**
 * Which local directories a document webview is allowed to load files from.
 *
 * A custom editor that sets `localResourceRoots` replaces VS Code's default
 * (the workspace folders plus the extension), so anything the list omits is
 * refused by the webview resource loader with HTTP 401. The Ritemark editor
 * used to list only the extension's `media/` folder and the document's own
 * directory, which silently broke every image kept outside that directory —
 * `![](../images/a.svg)`, a sibling `assets/` folder, anything at the
 * workspace root. The failure reached much further than the rendered page:
 * `inlineSvgImagesForExport` fetches SVGs through the same webview URI to
 * rasterize them, so PDF, Word and Google Docs publishing dropped those images
 * too (they arrive at the host still `.svg`, which the encoders can't decode).
 *
 * The fix widens the roots to the workspace folder holding the document, which
 * is what VS Code would have allowed by default. Two limits keep it from
 * becoming "the whole disk":
 *  - only the one folder VS Code reports as containing the document, not every
 *    folder of a multi-root workspace;
 *  - never the filesystem root or the user's home directory, which would
 *    expose every file the user owns to the webview.
 *
 * Pure module — no `vscode` import — so it can be unit-tested directly.
 */

export interface DocumentResourceRootsInput {
  /** The extension's bundled asset directory (`<extension>/media`). */
  mediaPath: string;
  /** Absolute path of the document being opened. */
  documentPath: string;
  /**
   * Absolute path of the workspace folder that contains the document, as
   * reported by `vscode.workspace.getWorkspaceFolder`, or `null` when the
   * document is outside every folder (a file opened on its own).
   */
  workspaceFolderPath: string | null;
  /** The user's home directory. */
  homeDir: string;
}

/** Windows path comparison ignores case; POSIX does not. */
function samePath(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

/**
 * A root so broad that allowing it would hand the webview the user's whole
 * disk: the filesystem root (`/`, `C:\`) or the home directory itself.
 */
export function isTooBroadResourceRoot(folderPath: string, homeDir: string): boolean {
  const resolved = path.resolve(folderPath);
  if (path.dirname(resolved) === resolved) {
    return true; // `/` on POSIX, `C:\` on Windows — dirname is its own parent.
  }
  return samePath(resolved, homeDir);
}

/**
 * The `localResourceRoots` for a document webview, widest-useful-but-no-wider.
 *
 * The document's own directory is always present, so a file opened outside any
 * workspace keeps working exactly as before.
 *
 * Roots are fixed when the webview is created. Adding or removing a workspace
 * folder afterwards does not re-open existing editors, so a document already on
 * screen keeps the roots it started with — reopen the editor to pick up the new
 * folder.
 */
export function resolveDocumentResourceRoots(input: DocumentResourceRootsInput): string[] {
  const docDir = path.dirname(input.documentPath);
  const documentRoot = resolveDocumentRoot(input);
  const roots = [input.mediaPath, docDir];
  if (!samePath(documentRoot, docDir)) {
    roots.push(documentRoot);
  }
  return roots;
}

/**
 * The widest root on the document's side of that list: the workspace folder
 * when it was accepted, otherwise the document's own directory.
 *
 * The live image-refresh watcher uses it, so its reach matches what the webview
 * is allowed to load — an image the editor can show is an image the editor can
 * also refresh in place.
 */
export function resolveDocumentRoot(input: Omit<DocumentResourceRootsInput, 'mediaPath'>): string {
  const { documentPath, workspaceFolderPath, homeDir } = input;
  if (workspaceFolderPath && !isTooBroadResourceRoot(workspaceFolderPath, homeDir)) {
    return path.resolve(workspaceFolderPath);
  }
  return path.dirname(documentPath);
}

/**
 * The path a Markdown image reference would use for `filePath`, seen from
 * `fromDir` — `./images/a.png` for something below the document, `../a.png`
 * for something beside or above it.
 *
 * The `./` prefix is added only where it belongs: a `../` path that gets one
 * anyway (`.././images/a.png`) no longer matches the document's own reference,
 * which is how the live image-refresh watcher used to miss every image outside
 * the document's directory.
 */
export function toMarkdownRelativePath(fromDir: string, filePath: string): string {
  const relative = path.relative(fromDir, filePath).split(path.sep).join('/');
  return relative.startsWith('../') ? relative : `./${relative}`;
}
