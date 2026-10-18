/**
 * Start a new project (Sprint 133, R5): a name, an empty folder in
 * `<Documents>/Ritemark/`, or in a place the person picks. No `vscode`
 * import; the file system and the Windows registry reader are injected.
 * Reused by Sprint 134's Add a project….
 */

import * as path from 'path';

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** The longest name accepted: far below every system's limit, with room for the path. */
const MAX_NAME_LENGTH = 100;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/**
 * A project's name, checked before anything is written (R5, S19). The words
 * say what to do, in one sentence.
 */
export function checkProjectName(raw: string, platform: NodeJS.Platform): Checked<string> {
  const name = raw.trim();
  if (!name) return { ok: false, message: 'Give the project a name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, message: 'That name is too long. Use a shorter one.' };
  if (name === '.' || name === '..' || name.startsWith('.')) {
    return { ok: false, message: 'A project name can’t start with a dot.' };
  }
  // eslint-disable-next-line no-control-regex
  const forbidden = platform === 'win32' ? /[<>:"/\\|?*\u0000-\u001f]/ : /[/:\u0000]/;
  const bad = forbidden.exec(name);
  if (bad) {
    const shown = bad[0] < ' ' ? 'that character' : `“${bad[0]}”`;
    return { ok: false, message: `A project name can’t contain ${shown}.` };
  }
  if (platform === 'win32') {
    if (/[. ]$/.test(name)) return { ok: false, message: 'A project name can’t end with a dot or a space.' };
    if (WINDOWS_RESERVED.test(name)) return { ok: false, message: `Windows keeps the name “${name}” for itself. Choose another.` };
  }
  return { ok: true, value: name };
}

/** Where a new project goes unless the person picks another place. */
export function defaultProjectsParent(documentsFolder: string): string {
  return path.join(documentsFolder, 'Ritemark');
}

/**
 * The line under the name field: "In ~/Documents/Ritemark/Board report 2026"
 * on the Mac, "In Documents\Ritemark\Board report 2026" on Windows.
 */
export function placeLine(input: {
  parent: string;
  name: string;
  home: string;
  documentsFolder: string;
  platform: NodeJS.Platform;
}): string {
  const shownName = input.name.trim() || '…';
  const join = input.platform === 'win32' ? path.win32.join : path.posix.join;
  const full = join(input.parent, shownName);
  if (input.platform === 'win32') {
    const docs = input.documentsFolder.replace(/[\\/]+$/, '');
    if (full.toLowerCase().startsWith(`${docs.toLowerCase()}\\`)) return `In Documents\\${full.slice(docs.length + 1)}`;
    return `In ${full}`;
  }
  const home = input.home.replace(/\/+$/, '');
  if (full === home || full.startsWith(`${home}/`)) return `In ~${full.slice(home.length)}`;
  return `In ${full}`;
}

/** The file system the creation needs (Node's `fs.promises` in the host, a fake in tests). */
export interface ProjectFs {
  mkdir(target: string, options?: { recursive?: boolean }): Promise<unknown>;
  stat(target: string): Promise<unknown>;
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/**
 * Create the project's folder, empty (R5: About this project is not written
 * at creation). Never into an existing folder.
 */
export async function createProjectFolder(fs: ProjectFs, parent: string, rawName: string, platform: NodeJS.Platform): Promise<Checked<string>> {
  const name = checkProjectName(rawName, platform);
  if (!name.ok) return name;
  const target = path.join(parent, name.value);
  try {
    await fs.stat(target);
    return { ok: false, message: `A folder called “${name.value}” is already there. Choose another name.` };
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') return { ok: false, message: 'Ritemark couldn’t check that place. Choose another one.' };
  }
  try {
    await fs.mkdir(parent, { recursive: true });
    // Not recursive: if the folder appeared meanwhile, this fails instead of using it.
    await fs.mkdir(target);
    return { ok: true, value: target };
  } catch (error) {
    if (errorCode(error) === 'EEXIST') return { ok: false, message: `A folder called “${name.value}” is already there. Choose another name.` };
    if (errorCode(error) === 'EACCES' || errorCode(error) === 'EPERM') {
      return { ok: false, message: 'Ritemark isn’t allowed to make a folder there. Choose another place.' };
    }
    return { ok: false, message: 'Ritemark couldn’t make the folder. Choose another place or name.' };
  }
}

/**
 * The person's Documents folder. On Windows it is a known folder that
 * OneDrive (or the person) may have moved, so it is read from the registry,
 * not assumed; `readRegistryDocuments` returns the raw `Personal` value.
 */
export async function documentsFolder(input: {
  platform: NodeJS.Platform;
  home: string;
  env: NodeJS.ProcessEnv;
  readRegistryDocuments?: () => Promise<string | null>;
}): Promise<string> {
  const fallback = path.join(input.home, 'Documents');
  if (input.platform !== 'win32' || !input.readRegistryDocuments) return fallback;
  try {
    const raw = await input.readRegistryDocuments();
    if (!raw) return fallback;
    const expanded = raw.replace(/%([^%]+)%/g, (whole, name: string) => {
      const key = Object.keys(input.env).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? input.env[key] ?? whole : whole;
    });
    return /%[^%]+%/.test(expanded) ? fallback : expanded;
  } catch {
    return fallback;
  }
}

/** The `Personal` value from `reg query` output, or null. */
export function parseRegQueryPersonal(output: string): string | null {
  const match = /^\s*Personal\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/im.exec(output);
  return match ? match[1] : null;
}
