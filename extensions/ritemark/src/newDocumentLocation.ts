/**
 * Where Text and Table make their file (Sprint 132 closeout; the + and New say "A new document in this project", S24).
 *
 * With a project open, the file goes in the folder chosen in the tree (the shell's `_ritemark.files.chosenFolder`,
 * New File's own rule), else the project's root. With no project open it goes in the drafts folder, as in 1.x.
 * Either way it is "Untitled.<ext>", then "Untitled 2.<ext>" and so on, never over an existing file.
 */

import * as path from 'path';

/** "Untitled.md", then "Untitled 2.md", and so on. */
export function untitledName(index: number, extension: string): string {
  return index === 1 ? `Untitled.${extension}` : `Untitled ${index}.${extension}`;
}

/** The first Untitled name in the folder that no file has yet. */
export function nextUntitledPath(folder: string, extension: string, exists: (filePath: string) => boolean): string {
  for (let index = 1; ; index++) {
    const filePath = path.join(folder, untitledName(index, extension));
    if (!exists(filePath)) {
      return filePath;
    }
  }
}

/**
 * The folder a new document goes in: the chosen folder when it lies inside one of the project's folders, else the
 * project's root; undefined with no project open (the caller then uses the drafts folder).
 */
export function newDocumentFolder(projectRoots: readonly string[], chosen: string | undefined): string | undefined {
  if (projectRoots.length === 0) {
    return undefined;
  }
  if (chosen && projectRoots.some(root => isInside(root, chosen))) {
    return chosen;
  }
  return projectRoots[0];
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
