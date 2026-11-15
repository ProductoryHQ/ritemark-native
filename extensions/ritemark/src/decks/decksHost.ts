/**
 * Decks (Sprint 157, experience 46), composed once at activation: the deck mode of the Ritemark editor. Later parts
 * of the sprint add the Slide library and the AI's deck tools here.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { DeckLibrary } from './DeckLibrary';
import { projectRoot, workspaceDeckFiles } from './deckDocuments';
import { DeckPages, SLIDE_LIBRARY_VIEW } from './deckPages';
import { SlideLibraryViewProvider } from './SlideLibraryViewProvider';
import { DeckPresenter } from './present/DeckPresenter';
import { setDeckToolHost } from '../runtime/ritemarkTools';
import * as path from 'path';

export interface DecksHost {
  pages: DeckPages;
  /** The project's Slide library and decks, or null without a project folder on disk. */
  library: () => DeckLibrary | null;
}

export function registerDecks(context: vscode.ExtensionContext): DecksHost {
  const library = () => {
    const root = projectRoot();
    return root ? new DeckLibrary(workspaceDeckFiles(root)) : null;
  };
  const pages = new DeckPages(library);
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
    pages,
    presenter,
    view,
    vscode.window.registerWebviewViewProvider(SLIDE_LIBRARY_VIEW, view, { webviewOptions: { retainContextWhenHidden: false } }),
    // The place's head row (Search), from the frame's manifest.
    vscode.commands.registerCommand('ritemark.slideLibrary.search', () => (isEnabled('decks') ? view.focusSearch() : undefined)),
  );
  return { pages, library };
}
