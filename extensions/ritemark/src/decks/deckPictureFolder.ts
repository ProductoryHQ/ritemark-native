import { mkdir } from 'node:fs/promises';
import * as path from 'path';
import { ensureProjectSubfolder } from '../projects/projectFolderGuard';
import { deckPictureFolderName } from './deckFileName';

export class DeckPictureFolderTaken extends Error {
  constructor(folder: string) {
    super(`“${folder}” beside this deck is a file, not a folder, so pictures can't be saved. Rename it to add pictures.`);
  }
}

/** Create the deck's picture folder on demand, or reuse the folder already there. */
export async function ensureDeckPictureFolder(deckPath: string, onCreated?: () => void): Promise<string> {
  const name = deckPictureFolderName(deckPath);
  try {
    return await ensureProjectSubfolder(path.dirname(deckPath), name, onCreated && {
      mkdir: async target => {
        try {
          await mkdir(target);
          onCreated();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new DeckPictureFolderTaken(name);
    throw error;
  }
}
