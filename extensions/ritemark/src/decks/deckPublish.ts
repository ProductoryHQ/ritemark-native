/**
 * Sprint 159 PR 4: Publish on the deck's bar. A deck is published as its handout page, a real file Ritemark writes
 * beside it (`<deck name>.html`, `page/pageFile.ts`), through 2.2's own Publish: the gather, the key scan, the sheet,
 * the upload and the records are 2.2's, unchanged.
 *
 *  - **Publish and Update the page** do the same three things: take the open view's fit steps, write the page file,
 *    and run `ritemark.page.publish` on it. An update with the same pictures and nothing key-shaped goes straight up
 *    (2.2's `sheetNeeded`).
 *  - **A first Publish that is cancelled** takes its page back: when the publish flow ends (`onDidEndPublishFlow`), a
 *    page this deck's Publish created, with no record and no failure line, is removed, unless it changed since. A failed
 *    one stays, so the failure's Try again finds it.
 *  - **The chip** reads 2.2's state for the page file (`_ritemark.publish.pageState`) and says "Published · changed"
 *    when 2.2 finds a change, or when the deck's digest is no longer the page's (an edit to notes or a skipped slide
 *    isn't one: `publicDeck`).
 *  - **Copy link, See online and Unpublish** are 2.2's commands on the page file.
 *  - **The sheet's What goes and What stays rows** for a page made from a deck come from here (`pageRows`), wherever
 *    the page is published from.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { openInIntegratedBrowser } from '../browser/IntegratedBrowser';
import type { PublishFeature } from '../publish/vscodePublish';
import { COPY_LINK_COMMAND, PAGE_STATE_COMMAND, UNPUBLISH_PAGE_COMMAND } from '../publish/vscodePublish';
import { PUBLISH_PAGE_COMMAND } from '../browser/pageCommands';
import type { PageBarState } from '../publish/PublishController';
import { parseDeck } from './deckFormat';
import { BUILT_IN_THEME, parseTheme, type DeckTheme } from './deckTheme';
import { readProjectTheme } from './deckPages';
import type { DeckHostMessage, DeckPageState } from './deckProtocol';
import { loadPageAssets } from './page/pageAssets';
import { buildDeckPage, currentPageDigest, deckNameOf, nodePageFs, pagePathFor, readPageMeta, removeDeckPage, writeDeckPage } from './page/pageFile';
import { deckCounts, deckSheetRows, type DeckSheetRows } from './page/sheetRows';

/** How long after the deck stops changing the chip asks again whether the page has changed. */
const CHANGED_MS = 800;

/** One open deck view the bar's Publish speaks for. */
interface DeckSeat {
  document: vscode.TextDocument;
  post: (message: DeckHostMessage) => Promise<boolean>;
}

/** The real path of a file, or the path as given when it isn't there (yet). */
async function realPathOf(file: string): Promise<string> {
  return fs.promises.realpath(file).catch(() => file);
}

const samePath = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

export class DeckPublisher implements vscode.Disposable {
  private readonly seats = new Set<DeckSeat>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<DeckSeat, ReturnType<typeof setTimeout>>();
  private feature: PublishFeature | null = null;

  constructor(private readonly extensionPath: string) {
    this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
      for (const seat of this.seats) if (seat.document === event.document) this.refreshSoon(seat);
    }));
  }

  /** 2.2's Publish, once it is composed (after Decks, at activation): its events reach the deck's bar from then on. */
  connect(feature: PublishFeature): void {
    this.feature = feature;
    feature.setPageRows(pagePath => this.pageRows(pagePath));
    this.disposables.push(
      { dispose: () => feature.setPageRows(null) },
      feature.onDidChangeReady(() => { for (const seat of this.seats) void this.refresh(seat); }),
      feature.onDidChangePageState(pagePath => void this.refreshPage(pagePath)),
    );
    for (const seat of this.seats) void this.refresh(seat);
  }

  /** An open deck view: its bar's chip is kept up to date until the returned disposable. */
  attach(document: vscode.TextDocument, post: DeckSeat['post']): vscode.Disposable {
    const seat: DeckSeat = { document, post };
    this.seats.add(seat);
    return { dispose: () => { this.seats.delete(seat); clearTimeout(this.timers.get(seat)); this.timers.delete(seat); } };
  }

  // ------------------------------------------------------------------ the chip

  /** The deck bar's Publish control: hidden until Publish can be reached; else the page's state. */
  async stateOf(document: vscode.TextDocument): Promise<DeckPageState> {
    const feature = this.feature;
    if (!feature || !feature.isReady() || !isEnabled('decks')) return { ready: false, kind: 'unpublished', changed: false };
    const pagePath = pagePathFor(document.uri.fsPath);
    let bar: PageBarState | undefined;
    try {
      bar = await vscode.commands.executeCommand<PageBarState | undefined>(PAGE_STATE_COMMAND, vscode.Uri.file(pagePath));
    } catch {
      bar = undefined;
    }
    const kind = bar?.kind ?? 'unpublished';
    let changed = bar?.changed === true;
    if (kind === 'published' && !changed) changed = await this.deckChanged(document, pagePath);
    return { ready: true, kind, changed };
  }

  /** Whether the deck's public content is no longer what its page was written from. */
  private async deckChanged(document: vscode.TextDocument, pagePath: string): Promise<boolean> {
    try {
      const head = await readHead(pagePath);
      const written = readPageMeta(head).digest;
      if (!written) return false;
      return written !== await currentPageDigest(document.uri.fsPath, document.getText(), await this.themeOf(document));
    } catch {
      return false;
    }
  }

  private async refresh(seat: DeckSeat): Promise<void> {
    await seat.post({ type: 'deck/page-state', state: await this.stateOf(seat.document) });
  }

  private refreshSoon(seat: DeckSeat): void {
    clearTimeout(this.timers.get(seat));
    this.timers.set(seat, setTimeout(() => { this.timers.delete(seat); void this.refresh(seat); }, CHANGED_MS));
  }

  private async refreshPage(pagePath: string): Promise<void> {
    for (const seat of this.seats) {
      if (samePath(await realPathOf(pagePathFor(seat.document.uri.fsPath)), pagePath)) void this.refresh(seat);
    }
  }

  // ------------------------------------------------------------------ Publish, Update the page

  /** Publish or Update the page: write it beside the deck from the open text, then 2.2's Publish on it. */
  async publish(document: vscode.TextDocument, steps: readonly number[], notice: (text: string) => void): Promise<void> {
    const feature = this.feature;
    if (!feature || !feature.isReady() || !isEnabled('decks')) return;
    const deckPath = document.uri.fsPath;
    const pagePath = pagePathFor(deckPath);
    const built = await buildDeckPage({ deckPath, text: document.getText(), theme: await this.themeOf(document), steps }, await loadPageAssets(this.extensionPath));
    const hadRecord = Boolean(await feature.controller.recordFor(await realPathOf(pagePath)));
    const written = await writeDeckPage(nodePageFs, deckPath, built.html);
    if (written.kind === 'refused') {
      notice(written.line);
      void vscode.window.showWarningMessage(written.line);
      return;
    }
    // A page made for a first Publish goes again if that Publish is cancelled.
    const takeBack = written.created && !hadRecord;
    const realPage = await realPathOf(pagePath);
    let ended: () => void = () => undefined;
    const flowEnded = new Promise<void>(resolve => { ended = resolve; });
    const listener = feature.onDidEndPublishFlow(endedPath => { if (samePath(endedPath, realPage)) ended(); });
    try {
      const location = await vscode.commands.executeCommand(PUBLISH_PAGE_COMMAND, vscode.Uri.file(pagePath));
      // Refused before any flow began (the command said why): nothing will end
      if (location) await flowEnded;
    } finally {
      listener.dispose();
    }
    if (takeBack) await this.takeBackIfCancelled(feature, pagePath, realPage, built.html);
    const seat = [...this.seats].find(entry => entry.document === document);
    if (seat) void this.refresh(seat);
  }

  /** After a first Publish's flow: no record and no failure line is a cancel, and the page it wrote goes again. */
  private async takeBackIfCancelled(feature: PublishFeature, pagePath: string, realPage: string, html: string): Promise<void> {
    if (await feature.controller.recordFor(realPage)) return;
    const state = await feature.controller.pageState(realPage);
    if (state.kind !== 'unpublished' || state.line) return;
    await removeDeckPage(nodePageFs, pagePath, html).catch(() => false);
  }

  // ------------------------------------------------------------------ Copy link, See online, Unpublish

  async pageAction(document: vscode.TextDocument, action: 'copy-link' | 'see-online' | 'unpublish', notice: (text: string) => void): Promise<void> {
    const feature = this.feature;
    if (!feature) return;
    const page = vscode.Uri.file(pagePathFor(document.uri.fsPath));
    switch (action) {
      case 'copy-link':
        await vscode.commands.executeCommand(COPY_LINK_COMMAND, page);
        if (await feature.controller.recordFor(await realPathOf(page.fsPath))) notice('The link is copied.');
        return;
      case 'see-online': {
        const record = await feature.controller.recordFor(await realPathOf(page.fsPath));
        if (record && /^https:\/\/[a-z0-9.-]+\.workers\.dev\//.test(record.address)) await openInIntegratedBrowser(record.address);
        return;
      }
      case 'unpublish':
        await vscode.commands.executeCommand(UNPUBLISH_PAGE_COMMAND, page);
        return;
    }
  }

  // ------------------------------------------------------------------ the sheet's rows

  /** What goes and What stays for a page Ritemark made from the deck beside it; undefined for any other page. */
  async pageRows(pagePath: string): Promise<DeckSheetRows | undefined> {
    // Only `<deck name>.html` beside its `<deck name>.deck.md`, holding Ritemark's marks, is a deck's page.
    if (!isEnabled('decks') || !/\.html$/.test(pagePath)) return undefined;
    const deckPath = path.join(path.dirname(pagePath), `${path.basename(pagePath, '.html')}.deck.md`);
    if (deckNameOf(deckPath) === '') return undefined;
    try {
      if (!readPageMeta(await readHead(pagePath)).ritemark) return undefined;
      const open = vscode.workspace.textDocuments.find(doc => doc.uri.scheme === 'file' && samePath(doc.uri.fsPath, deckPath));
      const text = open ? open.getText() : await fs.promises.readFile(deckPath, 'utf8');
      return deckSheetRows(deckCounts(text, await this.themeFor(deckPath, text)));
    } catch {
      return undefined;
    }
  }

  // ------------------------------------------------------------------ the theme

  private themeOf(document: vscode.TextDocument): Promise<DeckTheme> {
    return this.themeFor(document.uri.fsPath, document.getText());
  }

  /** The theme the deck names, read from its project (as the deck view reads it), or the built-in one. */
  private async themeFor(deckPath: string, text: string): Promise<DeckTheme> {
    const named = parseDeck(text.replace(/^﻿/, '')).theme;
    if (!named) return BUILT_IN_THEME;
    const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(deckPath))?.uri.fsPath ?? path.dirname(deckPath);
    const themeText = await readProjectTheme(root, named);
    return themeText === null ? BUILT_IN_THEME : parseTheme(themeText);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.disposables.forEach(disposable => disposable.dispose());
    this.seats.clear();
  }
}

/** A page's first 4 KB: where its metas are. */
async function readHead(pagePath: string): Promise<string> {
  const handle = await fs.promises.open(pagePath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}
