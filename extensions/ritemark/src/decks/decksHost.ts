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
import { DeckPublisher } from './deckPublish';
import { DeckPresenter } from './present/DeckPresenter';
import { setDeckToolHost } from '../runtime/ritemarkTools';
import { copiedDeckText, copyFileName, emptyDeckText, emptyFileName, newDeckChoices, type NewDeckChoice } from './newDeck';
import { folderOf } from './deckLibraryFormat';
import * as fs from 'fs';
import * as path from 'path';

export interface DecksHost {
  pages: DeckPages;
  /** Publish on the deck's bar (Sprint 159 PR 4): connected to 2.2's Publish once that is composed. */
  publisher: DeckPublisher;
  /** The project's Slide library and decks, or null without a project folder on disk. */
  library: () => DeckLibrary | null;
}

export interface DecksHostOptions {
  /** The folder New makes a file in: the folder chosen in Documents, else the project's top (extension.ts). */
  newFileFolder: () => Promise<string>;
  /** A file New made, counted as made once first saved, as Text and Table are (Sprint 140, R15). */
  noteNewFile: (fsPath: string) => void;
}

export function registerDecks(context: vscode.ExtensionContext, options: DecksHostOptions): DecksHost {
  const library = () => {
    const root = projectRoot();
    return root ? new DeckLibrary(workspaceDeckFiles(root)) : null;
  };
  const publisher = new DeckPublisher(context.extensionPath);
  const pages = new DeckPages(library, publisher);
  // Present (Sprint 159): the wall, a window of its own over the main window.
  const presenter = new DeckPresenter(context.extensionUri);
  pages.presentHandler = (origin, request) => presenter.start(origin, request);
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
    publisher,
    pages,
    presenter,
    view,
    vscode.window.registerWebviewViewProvider(SLIDE_LIBRARY_VIEW, view, { webviewOptions: { retainContextWhenHidden: false } }),
    // The place's head row (Search), from the frame's manifest.
    vscode.commands.registerCommand('ritemark.slideLibrary.search', () => (isEnabled('decks') ? view.focusSearch() : undefined)),
    // Sprint 159 (PR 7): New → Deck, only with the flag on
    vscode.commands.registerCommand('ritemark.decks.new', () => (isEnabled('decks') ? newDeck(pages, options) : undefined)),
  );
  return { pages, publisher, library };
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
  // The folder New was opened from, as it is now (the folder chosen in Documents), before the quick pick takes the focus.
  // Decks live in the project's (first) folder: a folder chosen in another of the window's folders makes it at its top.
  const chosen = await options.newFileFolder();
  const chosenRelative = chosen === root ? '' : projectRelative(root, chosen);
  const folder = chosenRelative === null ? root : chosen;
  const toFolder = chosenRelative ?? '';
  const files = workspaceDeckFiles(root);
  const choices = newDeckChoices(await files.list(), path.basename(root), dayOf);
  const picked = await vscode.window.showQuickPick<vscode.QuickPickItem & { choice: NewDeckChoice }>(
    choices.map(choice => ({ label: choice.label, description: choice.description, choice })),
    { title: 'New deck', placeHolder: 'Start empty, or from a copy of an earlier deck', matchOnDescription: true },
  );
  if (!picked) return;
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
  // Never over an existing file, nor over a deck open in Ritemark whose file is gone: the create fails if the name was
  // taken meanwhile, and the next free one is tried
  const isOpen = (target: string) => vscode.workspace.textDocuments.some(document => document.uri.scheme === 'file' && path.normalize(document.uri.fsPath) === path.normalize(target));
  for (let attempt = 0; attempt < 20; attempt++) {
    const taken = (fileName: string) => fs.existsSync(path.join(folder, fileName)) || isOpen(path.join(folder, fileName));
    const fileName = source ? copyFileName(picked.choice.label, taken) : emptyFileName(taken);
    const relative = toFolder ? `${toFolder}/${fileName}` : fileName;
    try {
      await files.write(relative, text, { create: true });
    } catch (error) {
      if (taken(fileName)) continue;
      void vscode.window.showErrorMessage(`The deck could not be made: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const target = path.join(folder, fileName);
    options.noteNewFile(target);
    pages.selectTitleWhenShown(target);
    // As Text and Table open theirs: a tab of its own, not a preview the next file replaces
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(target), 'ritemark.editor', { preview: false, preserveFocus: false });
    return;
  }
  void vscode.window.showErrorMessage('The deck could not be made: every name tried was taken meanwhile.');
}
