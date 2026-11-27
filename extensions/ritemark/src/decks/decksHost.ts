/**
 * Decks (Sprint 157, experience 46), composed once at activation: the deck mode of the Ritemark editor. Later parts
 * of the sprint add the Slide library and the AI's deck tools here.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { DeckLibrary } from './DeckLibrary';
import { projectRelative, projectRoot, workspaceDeckFiles } from './deckDocuments';
import { DeckPages, SLIDE_LIBRARY_VIEW } from './deckPages';
import { ThemePages } from './themePages';
import { ThemeAi } from './themeAi';
import { SlideLibraryViewProvider } from './SlideLibraryViewProvider';
import { DeckPublisher } from './deckPublish';
import { DeckPdfSaver, PRINT_COMMAND } from './deckPdf';
import { loadPageAssets } from './page/pageAssets';
import { DeckPresenter } from './present/DeckPresenter';
import { setDeckToolHost } from '../runtime/ritemarkTools';
import { workspaceDeckPictures } from './workspaceDeckPictures';
import { copyEarlierDeck, earlierDecks, makeEmptyDeck } from './newDeck';
import { freshDeckMarks, sendDraft, type StartCardState } from './startCard';
import { folderOf, movedTarget, placeAfterMoves, rewriteDeckPictures, slidesOfText } from './deckLibraryFormat';
import { AI_NAMES, AI_ORDER } from '../guidance/readyRequest';
import { sheetAi } from '../guidance/GuidanceHost';
import type { AgentId } from '../agent/types';
import type { RuntimeAvailability } from '../runtime/availability';
import type { ChatStartRequest } from '../views/UnifiedViewProvider';
import { LIBRARY_FIELD_CONTEXT_KEY, LIBRARY_SEARCH_COMMAND } from './librarySearchRow';
import { DECK_GLOB, isDeckPath } from './deckFileName';
import { copyCreatedDeckPictures, followDeckMoves, trashDeckFolders, type CreatedDeckFiles, type DeletedDeck } from './deckFolderFollow';
import { copyDeckFolder } from './copyDeckFolder';
import * as fs from 'fs';
import * as path from 'path';

export interface DecksHost {
  pages: DeckPages;
  /** Sprint 162 PR 2: a theme file in its own tab. */
  themes: ThemePages;
  /** Publish on the deck's bar (Sprint 159 PR 4): connected to 2.2's Publish once that is composed. */
  publisher: DeckPublisher;
  /** The project's Slide library and decks, or null without a project folder on disk. */
  library: () => DeckLibrary | null;
  /** Sprint 162 PR 5: the AI's theme changes, for the chat's See what changed, Undo and Open the theme. */
  themeAi: ThemeAi;
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
  // Sprint 170 (#881): Save as PDF from Publish's menu, printed by the app's own print (patch 021)
  const pdf = new DeckPdfSaver(publisher, {
    // Unfiltered: the print is an internal command (its name starts with `_`), which `getCommands(true)` leaves out.
    hasPrint: async () => (await vscode.commands.getCommands(false)).includes(PRINT_COMMAND),
    assets: () => loadPageAssets(context.extensionPath),
    askTarget: async defaultPath => (await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath), filters: { PDF: ['pdf'] }, title: 'Save as PDF', saveLabel: 'Save' }))?.fsPath,
    print: async htmlPath => await vscode.commands.executeCommand<string>(PRINT_COMMAND, htmlPath),
    reveal: async file => { await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file)); },
  }, () => isEnabled('decks'));
  publisher.pdfKinds = () => pdf.kinds();
  pages.pdf = pdf;
  // Sprint 162 PR 2: the theme's tab, and the Theme menu's Edit <Name> and New theme… that open it
  const themes = new ThemePages(library, pages);
  pages.themeEditor = { open: (deck, themePath) => themes.open(deck, themePath), make: (deck, request) => themes.make(deck, request) };
  // Sprint 162 PR 5: the AI's theme tools and their change records; an Undo from anywhere takes every sheet's Undo away
  const themeAi = new ThemeAi(library, pages, themes);
  pages.themeChanges = { undo: id => themeAi.undo(id) };
  themes.ai = { checkColours: (document, fix) => themeAi.checkColoursInTab(document, fix), undo: id => themeAi.undo(id) };
  const undoneSheets = themeAi.onDidUndo(({ id }) => { pages.themeChangeUndone(id); themes.changeUndone(id); });
  // The handout's start card (16 November, frame 20) on the decks New made
  const fresh = freshDeckMarks(context.workspaceState, FRESH_DECKS, MAX_FRESH_DECKS);
  pages.startCard = startCardHost(pages, options, fresh);
  // Present (Sprint 159): the wall, a window of its own over the main window.
  const presenter = new DeckPresenter(context.extensionUri, context.globalState);
  pages.presenter = presenter;
  // Small details item 3: Q and "Show the page" put the published page's QR code on the wall.
  presenter.pageAddress = document => publisher.pageAddressOf(document);
  presenter.onPageChange = listener => publisher.onDidChangePage(() => listener());
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
    themes: themeAi,
  } : null));
  const view = new SlideLibraryViewProvider(context.extensionUri, pages, library);
  // #887: the shell draws the place's Search row as its field (patch 018) while Decks is on; a shell without it ignores
  // the key. With Decks off the row stays a plain row, which does nothing, as before.
  const setFieldKey = () => void vscode.commands.executeCommand('setContext', LIBRARY_FIELD_CONTEXT_KEY, isEnabled('decks'));
  setFieldKey();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (!event.affectsConfiguration('ritemark.features.decks')) return;
    if (!isEnabled('decks')) view.forgetSearch();
    setFieldKey();
  }));
  // Serialize the filesystem events so copy and delete see the previous event's completed folder changes.
  let following = Promise.resolve();
  const deletingDecks = new Map<string, DeletedDeck>();
  const follow = (operation: () => Promise<void>) => {
    if (isEnabled('decks')) following = following.then(operation)
      .catch(error => console.warn('[Decks] Could not follow a file change:', error));
  };
  context.subscriptions.push(
    publisher,
    pages,
    themes,
    themeAi,
    undoneSheets,
    presenter,
    view,
    vscode.window.registerWebviewViewProvider(SLIDE_LIBRARY_VIEW, view, { webviewOptions: { retainContextWhenHidden: false } }),
    // The place's head row (Search), from the frame's manifest: since #887 the shell's field in the row's place, whose
    // words and keys come here.
    vscode.commands.registerCommand(LIBRARY_SEARCH_COMMAND, (arg?: unknown) => (isEnabled('decks') ? view.searchRow(arg) : undefined)),
    // Sprint 159 (PR 7; since 16 November it opens the deck at once): New → Deck, only with the flag on
    vscode.commands.registerCommand('ritemark.decks.new', () => (isEnabled('decks') ? newDeck(pages, options, fresh) : undefined)),
    vscode.workspace.onWillDeleteFiles(event => {
      // Capture the deck's links before its file and open document can disappear.
      const paths = event.files.filter(file => file.scheme === 'file' && isDeckPath(file.fsPath)).map(file => rootless(file.fsPath));
      if (!paths.length) return;
      event.waitUntil(Promise.all(paths.map(async file => {
        deletingDecks.delete(file);
        if (!isEnabled('decks') || await deckFolderFiles.kind(file) !== 'file') return;
        const text = await deckFolderFiles.readDeck(file).catch(() => undefined);
        if (!event.token.isCancellationRequested) deletingDecks.set(file, { file, text });
      })));
    }),
    vscode.workspace.onDidDeleteFiles(event => {
      for (const file of event.files) void fresh.remove(markOf(file.fsPath));
      const deleted = event.files.filter(file => file.scheme === 'file').map(file => rootless(file.fsPath));
      const decks: DeletedDeck[] = [];
      for (const file of deleted) {
        const deck = deletingDecks.get(file);
        deletingDecks.delete(file);
        if (deck) decks.push(deck);
      }
      if (decks.length) follow(() => trashDeckFolders(decks, deleted, deckFolderFiles));
    }),
    vscode.workspace.onDidRenameFiles(event => {
      for (const file of event.files) void fresh.remove(markOf(file.oldUri.fsPath));
      follow(() => rebaseMovedDecks(event.files.filter(file => file.oldUri.scheme === 'file' && file.newUri.scheme === 'file')));
    }),
    vscode.workspace.onDidCreateFiles(event => {
      if (!isEnabled('decks')) return;
      // Start reading the saved copies as soon as the event arrives, before earlier folder operations finish.
      const created = Promise.all(event.files.filter(uri => uri.scheme === 'file' && isDeckPath(uri.fsPath))
        .map(async uri => {
          const deck = rootless(uri.fsPath);
          if (await deckFolderFiles.kind(deck) !== 'file') return null;
          const bytes = await deckFolderFiles.readBytes(deck).catch(() => null);
          return bytes && { uri, deck, bytes };
        }));
      follow(async () => {
        for (const file of await created) {
          if (!file) continue;
          const { uri, deck, bytes } = file;
          const document = await vscode.workspace.openTextDocument(uri);
          const text = document.getText();
          if (text !== bytes.toString('utf8').replace(/^\uFEFF/, '')) continue;
          const next = await copyCreatedDeckPictures(deck, text, deckFolderFiles, bytes);
          await replaceDeckText(document, text, next);
        }
      });
    }),
  );
  return { pages, themes, publisher, library, themeAi };
}

/** The day a deck was last changed, as the start card shows it: "15 Nov 2026". */
function dayOf(modified: number): string {
  return new Date(modified).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A path from the file system's root, posix and without its leading slash (`Users/me/Project/a.png`, `C:/a.png`). */
function rootless(fsPath: string): string {
  const absolute = path.resolve(fsPath).split(path.sep).join('/');
  return absolute.startsWith('//') ? 'UNC/' + absolute.slice(2) : absolute.replace(/^\/+/, '');
}

/**
 * The decks a rename moved: a deck file (`.rtms` or `.deck.md`) renamed or moved, or each deck inside a folder that was. With where each
 * one was before. Only files Ritemark's rename named (or that are inside a folder it named) are read.
 */
async function movedDecks(files: ReadonlyArray<{ oldUri: vscode.Uri; newUri: vscode.Uri }>): Promise<Array<{ uri: vscode.Uri; before: string; inFolder: boolean }>> {
  const decks: Array<{ uri: vscode.Uri; before: string; inFolder: boolean }> = [];
  for (const { oldUri, newUri } of files) {
    if (newUri.scheme !== 'file') continue;
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(newUri.fsPath);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      if (isDeckPath(newUri.fsPath)) decks.push({ uri: newUri, before: oldUri.fsPath, inFolder: false });
      continue;
    }
    if (!stat.isDirectory()) continue;
    const inside = await vscode.workspace.findFiles(new vscode.RelativePattern(newUri, DECK_GLOB), null, 500);
    for (const uri of inside) decks.push({ uri, before: path.join(oldUri.fsPath, path.relative(newUri.fsPath, uri.fsPath)), inFolder: true });
  }
  return decks;
}

/** Convert the common rootless paths back to file URIs (a drive is already absolute). */
function fileUri(file: string): vscode.Uri {
  if (process.platform !== 'win32') return vscode.Uri.file('/' + file);
  if (file.startsWith('UNC/')) return vscode.Uri.file('//' + file.slice(4));
  return vscode.Uri.file(/^[a-z]:$/i.test(file) ? file + '/' : file);
}

const deckFolderFiles: CreatedDeckFiles = {
  async kind(file) {
    try {
      const stat = await fs.promises.lstat(fileUri(file).fsPath);
      return stat.isDirectory() ? 'folder' : stat.isFile() ? 'file' : 'other';
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' ? undefined : 'other';
    }
  },
  async siblingDecks(dir) {
    const entries = await fs.promises.readdir(fileUri(dir).fsPath, { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && isDeckPath(entry.name))
      .map(entry => dir ? dir + '/' + entry.name : entry.name);
  },
  async readDeck(file) {
    const uri = fileUri(file);
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
    return open?.getText() ?? fs.promises.readFile(uri.fsPath, 'utf8');
  },
  async *listFolder(folder) {
    if (await deckFolderFiles.kind(folder) !== 'folder') throw new Error('Expected a plain deck folder');
    const dir = await fs.promises.opendir(fileUri(folder).fsPath);
    for await (const { name } of dir) {
      const file = folder + '/' + name;
      const kind = await deckFolderFiles.kind(file);
      if (kind === 'file') await fs.promises.access(fileUri(file).fsPath, fs.constants.R_OK);
      yield { name, kind: kind ?? 'other' };
    }
  },
  async readPage(file) {
    const page = await fs.promises.open(fileUri(file).fsPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      return await page.readFile('utf8');
    } finally {
      await page.close();
    }
  },
  async findFiles(glob, limit) {
    const files = await vscode.workspace.findFiles(glob, null, limit);
    return files.filter(uri => uri.scheme === 'file').map(uri => rootless(uri.fsPath));
  },
  readBytes(file) {
    return fs.promises.readFile(fileUri(file).fsPath);
  },
  async resolves(file) {
    return fs.promises.stat(fileUri(file).fsPath).then(() => true, error => {
      const code = (error as NodeJS.ErrnoException).code;
      return code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'ELOOP';
    });
  },
  log(message) { console.warn('[Decks]', message); },
  async sameFolder(from, to) {
    if (from.toLowerCase() !== to.toLowerCase()) return false;
    try {
      const [old, next] = await Promise.all([fs.promises.lstat(fileUri(from).fsPath), fs.promises.lstat(fileUri(to).fsPath)]);
      return old.isDirectory() && next.isDirectory() && old.dev === next.dev && old.ino === next.ino;
    } catch {
      return false;
    }
  },
  async rename(from, to) {
    await vscode.workspace.fs.rename(fileUri(from), fileUri(to), { overwrite: false });
  },
  async trash(folder) {
    await vscode.workspace.fs.delete(fileUri(folder), { recursive: true, useTrash: true });
  },
  async copy(from, to) {
    if (await deckFolderFiles.kind(from) !== 'folder') return false;
    // Create-only, entry by entry into the reserved name (copyDeckFolder: Electron's fs.cp refuses an existing target).
    return copyDeckFolder(fileUri(from).fsPath, fileUri(to).fsPath);
  },
  notice(message, level) {
    if (level === 'information') void vscode.window.showInformationMessage(message);
    else void vscode.window.showWarningMessage(message);
  },
};

/** Rebase the moved decks after the folders have followed, including moves named by Documents itself. */
async function rebaseMovedDecks(files: ReadonlyArray<{ oldUri: vscode.Uri; newUri: vscode.Uri }>): Promise<void> {
  const moves = files.map(file => ({ from: rootless(file.oldUri.fsPath), to: rootless(file.newUri.fsPath) }));
  const decks = await movedDecks(files);
  const direct = decks.filter(deck => !deck.inFolder).map(deck => ({ from: rootless(deck.before), to: rootless(deck.uri.fsPath) }));
  const after = placeAfterMoves(await followDeckMoves(moves, direct, deckFolderFiles));
  for (const deck of decks) {
    const oldFolder = folderOf(rootless(deck.before));
    const newFolder = folderOf(rootless(deck.uri.fsPath));
    const rebase = (text: string) => rewriteDeckPictures(text, target => movedTarget(target, oldFolder, newFolder, after), true);
    // A moved folder's decks stay closed unless their links need an edit.
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === deck.uri.toString());
    if (!open && deck.inFolder) {
      const onDisk = await fs.promises.readFile(deck.uri.fsPath, 'utf8').catch(() => undefined);
      if (onDisk === undefined || rebase(onDisk) === onDisk) continue;
    }
    const document = open ?? await vscode.workspace.openTextDocument(deck.uri);
    const text = document.getText();
    await replaceDeckText(document, text, rebase(text));
  }
}

async function replaceDeckText(document: vscode.TextDocument, text: string, next: string): Promise<void> {
  if (next === text || document.getText() !== text) return;
  // Replace only the changed stretch, preserving the editor's state around it.
  let start = 0;
  while (start < text.length && start < next.length && text[start] === next[start]) start++;
  let end = 0;
  while (end < text.length - start && end < next.length - start && text[text.length - 1 - end] === next[next.length - 1 - end]) end++;
  const wasDirty = document.isDirty;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(text.length - end)), next.slice(start, next.length - end));
  if (await vscode.workspace.applyEdit(edit) && !wasDirty) await document.save();
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
 * Table"): New → Deck makes "Untitled.rtms" (or the next free "Untitled N") in the folder New was opened from and
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
        pictures: workspaceDeckPictures(root),
        updateCopy: async (relative, before, after) => {
          const uri = vscode.Uri.file(path.join(root, relative));
          const copy = await vscode.workspace.openTextDocument(uri);
          const current = copy.getText();
          const normalize = (text: string) => text.replace(/\r\n/g, '\n');
          if (normalize(current) === normalize(before)) {
            const next = normalize(after);
            await replaceDeckText(copy, current, copy.eol === vscode.EndOfLine.CRLF ? next.replace(/\n/g, '\r\n') : next);
          }
        },
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

