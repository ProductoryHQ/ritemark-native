import { posix } from 'node:path';
import { isPictureFile } from '../publish/fileKinds';
import { ownDeckFolder } from './deckFolderFollow';
import { folderOf, projectPath, rebasePath, rebaseSlide, rewriteSlideTargets } from './deckLibraryFormat';

export interface DeckPictureFiles {
  /** Copy a project-relative picture by exclusive create, or return an existing picture with identical bytes. */
  copyPicture(source: string, folder: string): Promise<string>;
}

/** Build a path rewrite for a transfer, with each picture in place before its link can be written. */
export async function copyPictureTargets(
  source: string, target: string, files: DeckPictureFiles | undefined,
  visit: (rewrite: (value: string) => string) => void,
): Promise<(value: string) => string> {
  const from = folderOf(source);
  const to = folderOf(target);
  const folder = ownDeckFolder(target);
  const copies = new Map<string, string>();
  // A receiving deck nested inside the source's picture folder must leave that folder alone.
  if (files && source !== target && !folder.startsWith(ownDeckFolder(source) + '/')) {
    const candidates = new Set<string>();
    visit(value => {
      const file = projectPath(value, from);
      if (file && isPictureFile(file) && !file.startsWith(folder + '/')) candidates.add(file);
      return value;
    });
    for (const file of candidates) {
      try {
        copies.set(file, await files.copyPicture(file, folder));
      } catch {
        // A missing or unreadable picture, or a refused write, keeps its original link.
      }
    }
  }
  return value => {
    const file = projectPath(value, from);
    const copy = file && copies.get(file);
    if (!copy) return from === to ? value : rebasePath(value, from, to);
    const address = value.split(/[?#]/, 1)[0];
    const relative = posix.relative(to || '.', copy);
    return (/%[0-9a-f]{2}/i.test(address) ? encodeURI(relative) : relative) + value.slice(address.length);
  };
}

export async function transferSlide(
  body: string, handout: string, kind: string, source: string, target: string, files?: DeckPictureFiles,
): Promise<{ body: string; handout: string }> {
  if (!files || source === target) return rebaseSlide(body, handout, folderOf(source), folderOf(target), kind);
  const rewrite = await copyPictureTargets(source, target, files, visit => {
    rewriteSlideTargets(body, handout, kind, visit);
  });
  const from = folderOf(source);
  const to = folderOf(target);
  return rewriteSlideTargets(body, handout, kind, rewrite, value => from === to ? value : rebasePath(value, from, to));
}
