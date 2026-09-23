/**
 * Sprint 122 (#282) — what a local path in a chat reply points at, and what
 * Ritemark may do with it.
 *
 * Chat content is model-authored, so a path in a reply is never trusted: it is
 * resolved here, on the host, with `realpath` (a symlink inside the project
 * that leads outside counts as outside), and every action the webview asks for
 * is checked against the kind found *now*, not the kind the webview was told a
 * moment ago. Only a file inside the project is ever opened; anything outside
 * is at most revealed in Finder or copied.
 *
 * No `vscode` import, so it is unit-testable with a fake filesystem.
 */
import * as nodePath from 'path';

export type ChatLocalTargetKind =
  | 'project-file'
  | 'project-folder'
  | 'outside-file'
  | 'outside-folder'
  | 'missing'
  | 'inaccessible'
  | 'needs-folder';

export interface ChatLocalTarget {
  kind: ChatLocalTargetKind;
  /** The resolved path, when there is one to act on or name. */
  fsPath?: string;
}

export type ChatLinkAction = 'open' | 'reveal-in-project' | 'locate' | 'copy';

export interface ChatLinkFs {
  /** Throws (with a Node error code) when the path cannot be resolved. */
  realpath(path: string): string;
  isDirectory(path: string): boolean;
}

type PathApi = Pick<typeof nodePath, 'isAbsolute' | 'join' | 'sep'>;

const NOT_FOUND = new Set(['ENOENT', 'ENOTDIR']);

function failureKind(error: unknown): 'missing' | 'inaccessible' {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && !NOT_FOUND.has(code) ? 'inaccessible' : 'missing';
}

export function resolveChatLocalTarget(
  rawPath: string,
  workspaceRoot: string | undefined,
  fs: ChatLinkFs,
  path: PathApi = nodePath,
): ChatLocalTarget {
  const trimmed = rawPath.trim();
  if (!trimmed) return { kind: 'missing' };
  const absolute = path.isAbsolute(trimmed);
  if (!absolute && !workspaceRoot) return { kind: 'needs-folder' };

  const resolved = absolute ? trimmed : path.join(workspaceRoot as string, trimmed);
  let real: string;
  let isFolder: boolean;
  try {
    real = fs.realpath(resolved);
    isFolder = fs.isDirectory(real);
  } catch (error) {
    return { kind: failureKind(error), fsPath: resolved };
  }

  let inside = false;
  if (workspaceRoot) {
    try {
      const realRoot = fs.realpath(workspaceRoot);
      inside = real === realRoot || real.startsWith(realRoot + path.sep);
    } catch {
      inside = false;
    }
  }

  if (inside) return { kind: isFolder ? 'project-folder' : 'project-file', fsPath: real };
  return { kind: isFolder ? 'outside-folder' : 'outside-file', fsPath: real };
}

/** What an ordinary click does. `null` means: say why, do nothing. */
export function clickActionFor(kind: ChatLocalTargetKind): Exclude<ChatLinkAction, 'copy'> | null {
  switch (kind) {
    case 'project-file':
      return 'open';
    case 'project-folder':
      return 'reveal-in-project';
    case 'outside-file':
    case 'outside-folder':
      return 'locate';
    default:
      return null;
  }
}

/**
 * The only gate between a webview request and the filesystem. Checked against
 * the kind resolved at the moment of the action.
 */
export function isChatLinkActionAllowed(action: ChatLinkAction, kind: ChatLocalTargetKind): boolean {
  switch (action) {
    case 'open':
      return kind === 'project-file';
    case 'reveal-in-project':
      return kind === 'project-file' || kind === 'project-folder';
    case 'locate':
      return kind === 'project-file' || kind === 'project-folder' || kind === 'outside-file' || kind === 'outside-folder';
    case 'copy':
      return true;
  }
}

/** The message for a click that cannot do anything; `null` when it can. */
export function chatLinkMessage(kind: ChatLocalTargetKind, rawPath: string): string | null {
  switch (kind) {
    case 'missing':
      return `File not found: ${rawPath}`;
    case 'inaccessible':
      return `Ritemark can't read ${rawPath}. Check that you have permission to open it.`;
    case 'needs-folder':
      return 'Open a folder to follow file links from chat.';
    default:
      return null;
  }
}

/** Said when a chat link uses a scheme Ritemark does not open (mailto:, vscode:, …). */
export function unsupportedSchemeMessage(scheme: string): string {
  if (!/^[a-z][a-z0-9+.-]{0,31}$/i.test(scheme)) return "Ritemark doesn't open this kind of link from chat.";
  return `Ritemark doesn't open ${scheme.toLowerCase()}: links from chat.`;
}
