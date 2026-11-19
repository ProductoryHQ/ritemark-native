/**
 * Sprint 157: the project's deck files for `DeckLibrary`, through VS Code. A deck that is open is read from its
 * document (the person's unsaved changes included) and written with a `WorkspaceEdit`, saved when it was clean, as
 * the task board's `CardDocuments` does; a closed one is read and written on disk, a new file only by exclusive create.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { DeckFiles } from './DeckLibrary';

/** Folders a deck is never looked for in. */
const SKIPPED = '**/{node_modules,.git,.ritemark}/**';
const MAX_DECKS = 2000;

function openDocument(absolute: string): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find(document => document.uri.scheme === 'file' && path.normalize(document.uri.fsPath) === path.normalize(absolute));
}

/** The project folder a deck path is relative to: the window's first folder on disk. */
export function projectRoot(): string | null {
  const folder = vscode.workspace.workspaceFolders?.find(entry => entry.uri.scheme === 'file');
  return folder ? folder.uri.fsPath : null;
}

/** A file's project-relative path with `/`, or null when it is outside the project. */
export function projectRelative(root: string, absolute: string): string | null {
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

/**
 * The file, or the nearest folder of it that exists, is inside the project once links are followed: a linked folder
 * in a project from someone else never takes a write outside it.
 */
async function insideOnDisk(root: string, target: string): Promise<boolean> {
  let probe = target;
  for (;;) {
    try {
      const [realRoot, real] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(probe)]);
      return real === realRoot || projectRelative(realRoot, real) !== null;
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return false;
      probe = parent;
    }
  }
}

export function workspaceDeckFiles(root: string): DeckFiles {
  const absolute = async (relative: string) => {
    const target = path.resolve(root, ...relative.split('/'));
    if (projectRelative(root, target) === null || !(await insideOnDisk(root, target))) throw new Error(`${relative} is outside the project.`);
    return target;
  };
  return {
    async list() {
      const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(root, '**/*.deck.md'), SKIPPED, MAX_DECKS);
      const found: Array<{ path: string; modified: number }> = [];
      for (const uri of uris) {
        const relative = projectRelative(root, uri.fsPath);
        if (!relative) continue;
        let modified = 0;
        try {
          modified = (await fs.promises.stat(uri.fsPath)).mtimeMs;
        } catch {
          continue;
        }
        found.push({ path: relative, modified });
      }
      return found;
    },
    async read(relative) {
      let target: string;
      try {
        target = await absolute(relative);
      } catch {
        return null;
      }
      const document = openDocument(target);
      if (document) return document.getText();
      try {
        return await fs.promises.readFile(target, 'utf8');
      } catch {
        return null;
      }
    },
    async write(relative, text, options) {
      const target = await absolute(relative);
      const document = openDocument(target);
      if (document) {
        if (options?.create) throw new Error(`${relative} already exists.`);
        const wasDirty = document.isDirty;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
        if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`${relative} could not be changed.`);
        if (!wasDirty) await document.save();
        return;
      }
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      if (options?.create) {
        await fs.promises.writeFile(target, text, { encoding: 'utf8', flag: 'wx' });
        return;
      }
      // A whole file at once: written beside, then moved over it.
      const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(temporary, text, 'utf8');
      await fs.promises.rename(temporary, target);
    },
    // Sprint 165 PR 4: the Undo of a topic a library write made. To the Trash, never deleted outright; the folders the
    // write made for it (`Slide library`, `Themes`) go too while they are empty, so the project is as it was.
    async remove(relative) {
      const target = await absolute(relative);
      await vscode.workspace.fs.delete(vscode.Uri.file(target), { useTrash: true });
      for (let folder = path.dirname(target); projectRelative(root, folder) !== null; folder = path.dirname(folder)) {
        try {
          await fs.promises.rmdir(folder);
        } catch {
          // Not empty (or not there): it stays, and so does every folder above it.
          break;
        }
      }
    },
  };
}
