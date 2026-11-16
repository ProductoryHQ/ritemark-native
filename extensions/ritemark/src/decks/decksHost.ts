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
import { copyEarlierDeck, earlierDecks, makeEmptyDeck } from './newDeck';
import { freshDeckMarks, sendDraft, type StartCardState } from './startCard';
import { AI_NAMES, AI_ORDER, cardAi, type AiState } from '../guidance/readyRequest';
import type { AgentId } from '../agent/types';
import type { RuntimeAvailability } from '../runtime/availability';
import type { ChatStartRequest } from '../views/UnifiedViewProvider';
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
  /**
   * The start card's Draft: the AI's sheet's own path for a visible chat with a request (Home's ready request, Sprint
   * 140 R5): the AI column opens if it is folded, and the words go as the person's first message, with the document in
   * front (this deck) attached as every message's is.
   */
  startChat: (request: ChatStartRequest) => Promise<void>;
  /** Is this AI signed in and usable (the AI's sheet's own check). */
  runtimeAvailability: (runtimeId: AgentId) => Promise<RuntimeAvailability>;
}

/** The window's decks New made whose start card hasn't gone yet (`startCard.ts`): workspace state, never the file. */
const FRESH_DECKS = 'ritemark.decks.freshDecks';
/** At most this many are kept: a deck New made and never opened again is forgotten in time. */
const MAX_FRESH_DECKS = 20;

export function registerDecks(context: vscode.ExtensionContext, options: DecksHostOptions): DecksHost {
  const library = () => {
    const root = projectRoot();
    return root ? new DeckLibrary(workspaceDeckFiles(root)) : null;
  };
  const publisher = new DeckPublisher(context.extensionPath);
  const pages = new DeckPages(library, publisher);
  // The handout's start card (16 November, frame 20) on the decks New made
  const fresh = freshDeckMarks(context.workspaceState, FRESH_DECKS, MAX_FRESH_DECKS);
  pages.startCard = startCardHost(pages, options, fresh);
  // Present (Sprint 159): the wall, a window of its own over the main window.
  const presenter = new DeckPresenter(context.extensionUri, context.globalState);
  pages.presenter = presenter;
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
    // Sprint 159 (PR 7; since 16 November it opens the deck at once): New → Deck, only with the flag on
    vscode.commands.registerCommand('ritemark.decks.new', () => (isEnabled('decks') ? newDeck(pages, options, fresh) : undefined)),
  );
  return { pages, publisher, library };
}

/** The day a deck was last changed, as the start card shows it: "15 Nov 2026". */
function dayOf(modified: number): string {
  return new Date(modified).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A deck's key among the fresh marks: its file path, as this host compares paths. */
function markOf(fsPath: string): string {
  return path.normalize(fsPath);
}

/** The AI the sheet uses for new chats, when one is chosen (as Home's card reads it). */
function sheetAi(): AgentId | undefined {
  const value = vscode.workspace.getConfiguration('ritemark.ai').get<string>('selectedAgent');
  return value === 'claude-code' || value === 'codex' || value === 'opencode' ? value : undefined;
}

/**
 * The AI Draft goes to, by Home's card's rule (`cardAi`): the sheet's AI when it is signed in, else the first signed-in
 * AI, Claude first. Null when none is: then the card has no Ask row.
 */
async function draftingAi(options: DecksHostOptions): Promise<{ id: AgentId; name: string } | null> {
  const states: Partial<Record<AgentId, AiState>> = {};
  await Promise.all(AI_ORDER.map(async id => {
    const availability = await options.runtimeAvailability(id).catch(() => null);
    if (availability?.usable) states[id] = 'ready';
  }));
  const chosen = cardAi({ chosen: undefined, sheetAi: sheetAi(), states, lastReady: undefined, canSignIn: {} });
  return chosen.ready ? { id: chosen.ai, name: AI_NAMES[chosen.ai] } : null;
}

type FreshMarks = ReturnType<typeof freshDeckMarks>;

/**
 * Sprint 159 (16 November, frame 20; Jarmo: "should open the Deck tab straight away, the same pattern as Text and
 * Table"): New → Deck makes "Untitled.deck.md" (or the next free "Untitled N") in the folder New was opened from and
 * opens it at once, its title slide's title selected and the handout's start card under its first part.
 */
async function newDeck(pages: DeckPages, options: DecksHostOptions, fresh: FreshMarks): Promise<void> {
  const root = projectRoot();
  if (!root) return;
  // The folder New was opened from (the folder chosen in Documents). Decks live in the project's (first) folder: a
  // folder chosen in another of the window's folders makes it at its top.
  const chosen = await options.newFileFolder();
  const chosenRelative = chosen === root ? '' : projectRelative(root, chosen);
  const folder = chosenRelative === null ? root : chosen;
  const files = workspaceDeckFiles(root);
  await makeEmptyDeck({
    toFolder: chosenRelative ?? '',
    // Never over an existing file, nor over a deck open in Ritemark whose file is gone
    taken: fileName => takenIn(folder, fileName),
    create: (relative, text) => files.write(relative, text, { create: true }),
    made: async fileName => {
      const target = path.join(folder, fileName);
      options.noteNewFile(target);
      pages.selectTitleWhenShown(target);
      await fresh.add(markOf(target));
      // As Text and Table open theirs: a tab of its own, not a preview the next file replaces
      await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(target), 'ritemark.editor', { preview: false, preserveFocus: false });
    },
    failed: message => void vscode.window.showErrorMessage(message),
  });
}

/** Is this file name taken in the folder: a file on disk, or a document open in Ritemark whose file is gone. */
function takenIn(folder: string, fileName: string): boolean {
  const target = path.normalize(path.join(folder, fileName));
  return fs.existsSync(target) || vscode.workspace.textDocuments.some(document => document.uri.scheme === 'file' && path.normalize(document.uri.fsPath) === target);
}

/** The handout's start card, for `DeckPages`: its state, its going, Draft and the copy of an earlier deck. */
function startCardHost(pages: DeckPages, options: DecksHostOptions, fresh: FreshMarks): NonNullable<DeckPages['startCard']> {
  return {
    state: async (document): Promise<StartCardState> => {
      const root = projectRoot();
      const deck = root ? projectRelative(root, document.uri.fsPath) : null;
      if (!root || !deck || !fresh.has(markOf(document.uri.fsPath))) return { fresh: false, ai: null, earlier: [] };
      const [ai, decks] = await Promise.all([draftingAi(options), workspaceDeckFiles(root).list()]);
      return { fresh: true, ai, earlier: earlierDecks(decks, path.basename(root), dayOf, deck) };
    },
    gone: document => fresh.remove(markOf(document.uri.fsPath)),
    draft: async (document, words, notice) => {
      await sendDraft(words, {
        ai: () => draftingAi(options),
        forget: () => fresh.remove(markOf(document.uri.fsPath)),
        // The AI reads the deck from its file: a title just typed is in it.
        save: async () => { if (document.isDirty) await document.save(); },
        startChat: request => options.startChat({ ...request, runtimeId: request.runtimeId as AgentId }),
        notice,
      });
    },
    copy: async (document, source, notice) => {
      const root = projectRoot();
      const deck = root ? projectRelative(root, document.uri.fsPath) : null;
      if (!root || !deck) return;
      const files = workspaceDeckFiles(root);
      const folder = path.dirname(document.uri.fsPath);
      await copyEarlierDeck(source, {
        deck,
        read: relative => files.read(relative),
        taken: fileName => takenIn(folder, fileName),
        replace: async text => {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
          if (!(await vscode.workspace.applyEdit(edit))) return false;
          await fresh.remove(markOf(document.uri.fsPath));
          return document.save();
        },
        // A workspace edit, so the deck's tab moves with its file (as the task board moves a card's page)
        rename: async fileName => {
          const edit = new vscode.WorkspaceEdit();
          edit.renameFile(document.uri, vscode.Uri.file(path.join(folder, fileName)), { overwrite: false });
          return vscode.workspace.applyEdit(edit);
        },
        notice: (text, fileName) => {
          // A renamed deck opens in a view of its own: the line waits for it
          if (fileName) pages.noticeWhenShown(path.join(folder, fileName), text);
          else notice(text);
        },
      });
    },
  };
}

