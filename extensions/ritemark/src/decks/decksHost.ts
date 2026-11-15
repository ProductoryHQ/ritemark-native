/**
 * Decks (Sprint 157, experience 46), composed once at activation: the deck mode of the Ritemark editor. Later parts
 * of the sprint add the Slide library and the AI's deck tools here.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { DeckLibrary } from './DeckLibrary';
import { projectRelative, projectRoot, workspaceDeckFiles } from './deckDocuments';
import { DeckPages, SLIDE_LIBRARY_VIEW } from './deckPages';
import { SlideLibraryViewProvider } from './SlideLibraryViewProvider';
import { setDeckToolHost } from '../runtime/ritemarkTools';
import { copiedDeckText, copyFileName, emptyDeckText, emptyFileName, newDeckChoices, type NewDeckChoice } from './newDeck';
import { folderOf } from './deckLibraryFormat';
import * as fs from 'fs';
import * as path from 'path';

export interface DecksHost {
  pages: DeckPages;
  /** The project's Slide library and decks, or null without a project folder on disk. */
  library: () => DeckLibrary | null;
}

export interface DecksHostOptions {
  /** The folder New makes a file in: the folder chosen in Documents, else the project's top (extension.ts). */
  newFileFolder: () => Promise<string>;
}

export function registerDecks(context: vscode.ExtensionContext, options: DecksHostOptions): DecksHost {
  const library = () => {
    const root = projectRoot();
    return root ? new DeckLibrary(workspaceDeckFiles(root)) : null;
  };
  const pages = new DeckPages(library);
  // The AI's deck tools (PR 5): the same library, and an open deck's view to insert through as one undo step.
  setDeckToolHost(() => (isEnabled('decks') ? {
    library,
    viewInsert: (deckPath: string) => {
      const root = projectRoot();
      const view = root ? pages.viewOf(path.join(root, ...deckPath.split('/'))) : null;
      return view ? (parts, afterIndex) => view.insert(parts, afterIndex) : undefined;
    },
    viewSetFrom: (deckPath: string) => {
      const root = projectRoot();
      const view = root ? pages.viewOf(path.join(root, ...deckPath.split('/'))) : null;
      return view ? (id, from) => view.setFrom(id, from) : undefined;
    },
  } : null));
  const view = new SlideLibraryViewProvider(context.extensionUri, pages, library);
  context.subscriptions.push(
    pages,
    view,
    vscode.window.registerWebviewViewProvider(SLIDE_LIBRARY_VIEW, view, { webviewOptions: { retainContextWhenHidden: false } }),
    // The place's head row (Search), from the frame's manifest.
    vscode.commands.registerCommand('ritemark.slideLibrary.search', () => (isEnabled('decks') ? view.focusSearch() : undefined)),
    // Sprint 159 (PR 7): New → Deck, only with the flag on
    vscode.commands.registerCommand('ritemark.decks.new', () => (isEnabled('decks') ? newDeck(pages, options) : undefined)),
  );
  return { pages, library };
}

/** The day a deck was last changed, as the quick pick shows it: "15 Nov 2026". */
function dayOf(modified: number): string {
  return new Date(modified).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Sprint 159 (PR 7, the Experience lead's quick pick): New → Deck. "Empty deck" or a copy of one of the project's earlier
 * decks, made in the folder New was opened from and opened as a deck with its title slide's title selected. A file is
 * never written over: the next free name is taken.
 */
async function newDeck(pages: DeckPages, options: DecksHostOptions): Promise<void> {
  const root = projectRoot();
  if (!root) return;
  // The folder New was opened from, as it is now (the folder chosen in Documents), before the quick pick takes the focus
  const folder = await options.newFileFolder();
  const files = workspaceDeckFiles(root);
  const choices = newDeckChoices(await files.list(), path.basename(root), dayOf);
  const picked = await vscode.window.showQuickPick<vscode.QuickPickItem & { choice: NewDeckChoice }>(
    choices.map(choice => ({ label: choice.label, description: choice.description, choice })),
    { title: 'New deck', placeHolder: 'Start empty, or from a copy of an earlier deck', matchOnDescription: true },
  );
  if (!picked) return;
  const toFolder = folder === root ? '' : projectRelative(root, folder);
  if (toFolder === null) return; // New in a project always has a folder inside it
  const source = picked.choice.source;
  let text = emptyDeckText();
  if (source) {
    const written = await files.read(source);
    if (written === null) {
      void vscode.window.showWarningMessage(`${picked.choice.label} is no longer there.`);
      return;
    }
    text = copiedDeckText(written, folderOf(source), toFolder);
  }
  // Never over an existing file: the create fails if the name was taken meanwhile, and the next free one is tried
  for (let attempt = 0; attempt < 20; attempt++) {
    const taken = (fileName: string) => fs.existsSync(path.join(folder, fileName));
    const fileName = source ? copyFileName(picked.choice.label, taken) : emptyFileName(taken);
    const relative = toFolder ? `${toFolder}/${fileName}` : fileName;
    try {
      await files.write(relative, text, { create: true });
    } catch (error) {
      if (fs.existsSync(path.join(folder, fileName))) continue;
      void vscode.window.showErrorMessage(`The deck could not be made: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const target = path.join(folder, fileName);
    pages.selectTitleWhenShown(target);
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(target), 'ritemark.editor');
    return;
  }
}
