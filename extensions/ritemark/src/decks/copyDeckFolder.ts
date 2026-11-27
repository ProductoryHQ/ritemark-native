import * as fs from 'fs';
import * as path from 'path';

/**
 * Copy a deck's folder to a new name, create-only. The destination is reserved first (mkdir fails if anything has the
 * name), then each entry is copied into it. Electron's Node 24 `fs.cp` refuses a destination folder that already
 * exists (ERR_FS_CP_EEXIST), so the copy never targets the reserved folder itself (Sprint 178 PR 4, the app run).
 * A copy that fails part way removes only the folder this call created, and reports false.
 */
export async function copyDeckFolder(source: string, destination: string): Promise<boolean> {
  try {
    await fs.promises.mkdir(destination);
  } catch {
    return false;
  }
  try {
    for (const entry of await fs.promises.readdir(source)) {
      await fs.promises.cp(path.join(source, entry), path.join(destination, entry), {
        recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true,
      });
    }
    return true;
  } catch {
    await fs.promises.rm(destination, { recursive: true, force: true }).catch(() => undefined);
    return false;
  }
}
