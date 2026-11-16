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
import { slidesOfText } from './deckLibraryFormat';
import { AI_NAMES, AI_ORDER } from '../guidance/readyRequest';
import { sheetAi } from '../guidance/GuidanceHost';
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
    // A deck deleted or renamed in Ritemark takes its card's mark with it
    vscode.workspace.onDidDeleteFiles(event => { for (const file of event.files) void fresh.remove(markOf(file.fsPath)); }),
    vscode.workspace.onDidRenameFiles(event => { for (const file of event.files) void fresh.remove(markOf(file.oldUri.fsPath)); }),
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

/**
 * The AI Draft goes to, by Home's card's rule (`cardAi`, with no AI chosen on the card): the sheet's AI when it is signed
 * in, else the first signed-in AI, Claude first. Asked one at a time, stopping at the first that is. Null when none is:
 * then the card has no Ask row.
 */
async function draftingAi(options: DecksHostOptions): Promise<{ id: AgentId; name: string } | null> {
  const sheet = sheetAi();
  for (const id of sheet ? [sheet, ...AI_ORDER.filter(other => other !== sheet)] : AI_ORDER) {
    const availability = await options.runtimeAvailability(id).catch(() => null);
    if (availability?.usable) return { id, name: AI_NAMES[id] };
  }
  return null;
}

/**
 * Is the deck still as New made it, as far as the card is concerned: at most one slide, a title slide, and no handout
 * text (`deckStarted`'s rule, read from the file). The host's own check before a copy writes over the deck.
 */
function deckUntouched(text: string): boolean {
  const slides = slidesOfText(text);
  return slides.length <= 1 && slides.every(slide => slide.kind === 'title' && !slide.handout.trim());
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
  /**
   * The deck still has its card: New made it, its card hasn't gone, and the file is still as New made it (a mark left
   * by a file deleted outside Ritemark never puts a card on another deck of the same name). A mark whose deck has
   * moved on is dropped.
   */
  const isFresh = async (document: vscode.TextDocument): Promise<boolean> => {
    const mark = markOf(document.uri.fsPath);
    if (!fresh.has(mark)) return false;
    if (deckUntouched(document.getText())) return true;
    await fresh.remove(mark);
    return false;
  };
  return {
    state: async (document): Promise<StartCardState> => {
      const root = projectRoot();
      const deck = root ? projectRelative(root, document.uri.fsPath) : null;
      if (!root || !deck || !(await isFresh(document))) return { fresh: false, ai: null, earlier: [] };
      const [ai, decks] = await Promise.all([draftingAi(options), workspaceDeckFiles(root).list()]);
      // Another deck New made that still has its card is empty: nothing to copy
      const started = decks.filter(entry => !fresh.has(markOf(path.join(root, ...entry.path.split('/')))));
      return { fresh: true, ai, earlier: earlierDecks(started, path.basename(root), dayOf, deck) };
    },
    gone: document => fresh.remove(markOf(document.uri.fsPath)),
    draft: async (document, words, notice) => {
      // Only from a card that is still there (another view of the deck may have started it meanwhile)
      if (!(await isFresh(document))) return true;
      return sendDraft(words, {
        ai: () => draftingAi(options),
        // The AI reads the deck from its file, so what the document holds is saved first
        save: async () => !document.isDirty || document.save(),
        startChat: request => options.startChat({ ...request, runtimeId: request.runtimeId as AgentId }),
        forget: () => fresh.remove(markOf(document.uri.fsPath)),
        notice,
      });
    },
    copy: async (document, source, notice) => {
      const root = projectRoot();
      const deck = root ? projectRelative(root, document.uri.fsPath) : null;
      // Never over a deck that was started: the copy takes the whole file's place
      if (!root || !deck || !(await isFresh(document))) return true;
      const files = workspaceDeckFiles(root);
      const folder = path.dirname(document.uri.fsPath);
      const result = await copyEarlierDeck(source, {
        deck,
        read: relative => files.read(relative),
        taken: fileName => takenIn(folder, fileName),
        replace: async text => {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
          if (!(await vscode.workspace.applyEdit(edit))) return false;
          // The deck is the copy now, saved or not: a save refused leaves it unsaved, as any change, and the rename
          // carries it along
          await fresh.remove(markOf(document.uri.fsPath));
          await document.save();
          return true;
        },
        // A workspace edit, so the deck's tab moves with its file (as the task board moves a card's page). The renamed
        // deck opens in a view of its own: its line waits for it, set before the rename so that view can't miss it.
        rename: async (fileName, line) => {
          const target = path.join(folder, fileName);
          pages.noticeWhenShown(target, line);
          const edit = new vscode.WorkspaceEdit();
          edit.renameFile(document.uri, vscode.Uri.file(target), { overwrite: false });
          const renamed = await vscode.workspace.applyEdit(edit).then(ok => ok, () => false);
          if (!renamed) pages.dropNotice(target);
          return renamed;
        },
        notice,
      });
      return result !== null;
    },
  };
}

