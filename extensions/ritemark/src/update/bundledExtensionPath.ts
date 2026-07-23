/**
 * Bundled Extension Path
 *
 * Resolves the built-in (bundled) copy of the Ritemark extension — the one that
 * ships inside the app bundle. The seamless updater clones this copy and overlays
 * the downloaded delta on top of it, so that an update can never produce a
 * partial extension directory (incident v1.8.3-ext.1, issue #142).
 *
 * IMPORTANT: do NOT use `vscode.extensions.getExtension('ritemark.ritemark').extensionPath`
 * for this. That returns whichever copy the scanner actually LOADED, which after any
 * successful update is the user copy in ~/.ritemark/extensions/. Cloning from there
 * would perpetuate a broken tree instead of repairing it.
 *
 * Resolution is anchored on `vscode.env.appRoot`, which is host-provided and
 * independent of how the extension host bundle is built (no __dirname-depth math —
 * see .claude/skills/vscode-development/SKILL.md ## Extension host build).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Directory name of the built-in extension inside `<appRoot>/extensions/`. */
const BUNDLED_EXTENSION_DIR_NAME = 'ritemark';

/**
 * Resolve the bundled extension directory.
 *
 * @param appRootOverride Test-only escape hatch. Production code passes nothing
 * and resolves against `vscode.env.appRoot`.
 * @returns Absolute path to the bundled extension directory, or `null` when it
 * cannot be found or does not look like an extension. Callers MUST fail closed on
 * `null` — installing a bare delta is exactly the failure this module prevents.
 */
export function findBundledExtensionDir(appRootOverride?: string): string | null {
  const appRoot = appRootOverride ?? safeAppRoot();
  if (!appRoot) {
    return null;
  }

  const candidate = path.join(appRoot, 'extensions', BUNDLED_EXTENSION_DIR_NAME);
  return isExtensionDir(candidate) ? candidate : null;
}

/**
 * A directory counts as the bundled extension only if it carries a readable
 * package.json. This rejects a leftover empty directory, which would otherwise
 * clone into an equally broken install.
 */
function isExtensionDir(dirPath: string): boolean {
  try {
    if (!fs.statSync(dirPath).isDirectory()) {
      return false;
    }
    const manifestPath = path.join(dirPath, 'package.json');
    JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

/**
 * `vscode.env.appRoot` throws in some non-host contexts (unit tests without a
 * stubbed vscode module). Treat that as "unknown" rather than propagating.
 */
function safeAppRoot(): string | undefined {
  try {
    return vscode.env.appRoot;
  } catch {
    return undefined;
  }
}
