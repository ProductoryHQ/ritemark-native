/**
 * Where Ritemark's own pickers start (Sprint 143, #510, R9).
 *
 * A picker with no starting folder, or with one that no longer exists (the
 * main process drops a missing `defaultPath`), is left to the operating
 * system's own choice. On a Windows PC whose Desktop folder is missing
 * (moved by OneDrive or by the PC's owner) that choice was a folder that
 * isn't there, and the picker stopped opening. Every Ritemark picker
 * therefore starts in a folder that exists: the first candidate that is a
 * folder now, else the person's home.
 *
 * No `vscode` import: the call sites wrap the result in `vscode.Uri.file`.
 */

import * as fs from 'fs';
import * as os from 'os';

export interface PickerFolderDeps {
  isFolder: (fsPath: string) => boolean;
  home: () => string;
}

const nodeDeps: PickerFolderDeps = {
  isFolder: (fsPath) => {
    try {
      return fs.statSync(fsPath).isDirectory();
    } catch {
      return false;
    }
  },
  home: () => os.homedir(),
};

/** The first candidate that is a folder now, else the person's home. Never empty. */
export function pickerFolder(candidates: Array<string | null | undefined>, deps: PickerFolderDeps = nodeDeps): string {
  for (const candidate of candidates) {
    if (candidate && deps.isFolder(candidate)) return candidate;
  }
  return deps.home();
}
