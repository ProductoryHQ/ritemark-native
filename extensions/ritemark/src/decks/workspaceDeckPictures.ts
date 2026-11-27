import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPictureFile } from '../publish/fileKinds';
import { claimImageName } from '../utils/imageWriter';
import type { DeckPictureFiles } from './deckPictureCopy';

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function readPicture(file: string): Buffer {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Expected a picture file.');
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/** A picture with these bytes at the top of the deck's folder; `fonts/` and `logos/` below it are Publish's own. */
function samePicture(dir: string, bytes: Buffer): string | undefined {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (!entry.isFile() || !isPictureFile(file)) continue;
    try {
      if (fs.lstatSync(file).size === bytes.length && readPicture(file).equals(bytes)) return file;
    } catch {
      // A picture which cannot be read still reserves its name.
    }
  }
  return undefined;
}

/** Project-backed picture operations shared by the library and start card. */
export function workspaceDeckPictures(project: string): DeckPictureFiles {
  return {
    async copyPicture(source, folder) {
      const root = fs.realpathSync(project);
      const original = path.resolve(root, source);
      if (!inside(root, original)) throw new Error('Picture is outside the project.');
      const real = fs.realpathSync(original);
      if (!inside(root, real)) throw new Error('Picture is outside the project.');
      const bytes = readPicture(real);

      const destination = path.resolve(root, folder);
      if (!inside(root, destination)) throw new Error('Picture folder is outside the project.');
      // Never create through a symbolic link, including an alias of another deck's folder.
      let dir = root;
      for (const component of path.relative(root, destination).split(path.sep)) {
        dir = path.join(dir, component);
        try {
          fs.mkdirSync(dir);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
        if (!fs.lstatSync(dir).isDirectory()) throw new Error('Expected a picture folder.');
      }

      const existing = samePicture(destination, bytes);
      if (existing) return path.relative(root, existing).split(path.sep).join('/');

      // Create-only under a free name, as pasted pictures are written (imageWriter). A write that fails after
      // creating its file removes that file, which was this write's own.
      const name = claimImageName(path.posix.basename(source), name => {
        const file = path.join(destination, name);
        try {
          fs.writeFileSync(file, bytes, { flag: 'wx' });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') fs.rmSync(file, { force: true });
          throw error;
        }
      });
      return folder + '/' + name;
    },
  };
}
