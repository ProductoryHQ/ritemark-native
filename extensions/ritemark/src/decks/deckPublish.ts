/**
 * Sprint 159 PR 4: Publish on the deck's bar. A deck is published as its handout page, a real file Ritemark writes
 * beside it (`<deck name>.html`, `page/pageFile.ts`), through 2.2's own Publish: the gather, the key scan, the sheet,
 * the upload and the records are 2.2's, unchanged.
 *
 *  - **Publish and Update the page** do the same three things: take the view's text, look and fit steps, write the page
 *    file, and run `ritemark.page.publish` on it, waited to its end (`PublishFeature.publishPage`). An update with the
 *    same pictures and nothing key-shaped goes straight up (2.2's `sheetNeeded`). One at a time per deck; the page is
 *    held while its file is written (`holdPage`), and never written while its sheet is open from elsewhere.
 *  - **The theme's fonts** beyond Sofia Sans are written beside the page first, in `fonts/` (Sprint 162 PR 3,
 *    `pageFile.writePageFonts`); a name there taken by another file stops Publish in one line, as the page's does. The
 *    theme's logo goes the same way, in `logos/` (Sprint 162 PR 4), when its file is there.
 *  - **A first Publish that sends nothing** takes its page back (and the fonts it wrote with it): when the flow is cancelled, refused, not reachable or
 *    stopped by an error, a page this Publish created, with no record, is removed while it is still exactly the page
 *    written. A failed one stays, so the failure's Try again finds it.
 *  - **The chip** reads 2.2's state for the page file (`_ritemark.publish.pageState`) and says "Published · changed"
 *    when 2.2 finds a change, or when the deck's digest is no longer the page's (an edit to notes or a skipped slide
 *    isn't one: `publicDeck`). Typing in the deck asks only the digest again; 2.2 is asked when its state changes.
 *  - **Copy link, See online and Unpublish** are 2.2's commands on the page file.
 *  - **The sheet's What goes and What stays rows** for a page made from a deck come from here (`pageRows`), wherever
 *    the page is published from, and only while they describe that page: its digest is the one written with them, or
 *    the deck's own now.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { openInIntegratedBrowser } from '../browser/IntegratedBrowser';
import type { PublishFeature } from '../publish/vscodePublish';
import { COPY_LINK_COMMAND, PAGE_STATE_COMMAND, UNPUBLISH_PAGE_COMMAND } from '../publish/vscodePublish';
import { PAGE_BEING_PUBLISHED, WORKERS_DEV_ADDRESS, type PageBarState, type PublishOutcome } from '../publish/PublishController';
import { splitFrontMatter } from '../editorSync/frontMatter';
import { normalizeForCompare, samePath } from '../utils/pathIdentity';
import { parseDeck, publishText } from './deckFormat';
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from './deckTheme';
import { deckThemeAndLogo } from './deckPages';
import type { DeckHostMessage, DeckPageState } from './deckProtocol';
import { loadPageAssets } from './page/pageAssets';
import { buildDeckPage, currentPageDigest, deckNameOf, LOGO_PLACE, nodeFontFs, nodePageFs, pageLogoFile, pagePathFor, readPageMeta, removeDeckPage, removePageFonts, themeFontFiles, writeDeckPage, writePageFonts, type PageFile, type PageFontFile } from './page/pageFile';
import { deckCounts, deckSheetRows, type DeckSheetRows } from './page/sheetRows';

/** How long after the deck stops changing the chip asks again whether the page has changed. */
const CHANGED_MS = 800;

/** Why Publish stopped before 2.2's Publish began: the page file couldn't be made or written. */
export const PAGE_NOT_WRITTEN = "Ritemark couldn't write the page beside this deck, so nothing was published.";
/** Publish stopped by an error of its own before anything was sent. */
export const PUBLISH_STOPPED = 'Publish stopped before anything was sent. Try again.';

/** One open deck view the bar's Publish speaks for, and 2.2's last answer for its page. */
interface DeckSeat {
  document: vscode.TextDocument;
  post: (message: DeckHostMessage) => Promise<boolean>;
  bar?: PageBarState;
}

/**
 * A page's path as 2.2 keys it (its real path), also before the file is there: the real path of its folder with its
 * name. Ritemark never writes the page as a link (`writeDeckPage` refuses one), so the two agree.
 */
async function pageKeyOf(pagePath: string): Promise<string> {
  const folder = await fs.promises.realpath(path.dirname(pagePath)).catch(() => path.dirname(pagePath));
  return path.join(folder, path.basename(pagePath));
}

/** The real path of a file, or the path as given when it isn't there. */
async function realPathOf(file: string): Promise<string> {
  return fs.promises.realpath(file).catch(() => file);
}

export class DeckPublisher implements vscode.Disposable {
  private readonly seats = new Set<DeckSeat>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<DeckSeat, ReturnType<typeof setTimeout>>();
  /** Decks whose Publish is running, by their path compared as the system compares it. */
  private readonly running = new Set<string>();
  /** The sheet's rows for each page this window wrote, with the digest written beside them, by the page's real path. */
  private readonly written = new Map<string, { digest: string; rows: DeckSheetRows }>();
  /** The app's own font files, read once per window (they never change while it runs). */
  private readonly fontBytes = new Map<string, Promise<Buffer>>();
  /** Font files beside a page that a Publish running in this window uses: never taken back by another's cancel. */
  private readonly fontsHeld = new Map<string, number>();
  private feature: PublishFeature | null = null;

  constructor(private readonly extensionPath: string) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        for (const seat of this.seats) if (seat.document === event.document) this.refreshSoon(seat);
      }),
      // Decks turned off or on in Settings: the control hides or shows at once.
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('ritemark.features.decks')) this.refreshAll();
      }),
    );
  }

  /** 2.2's Publish, once it is composed (after Decks, at activation): its events reach the deck's bar from then on. */
  connect(feature: PublishFeature): void {
    this.feature = feature;
    feature.setPageRows(pagePath => this.pageRows(pagePath));
    this.disposables.push(
      { dispose: () => feature.setPageRows(null) },
      feature.onDidChangeReady(() => this.refreshAll()),
      feature.onDidChangePageState(pagePath => void this.refreshPage(pagePath)),
    );
    this.refreshAll();
  }

  /** An open deck view: its bar's chip is kept up to date until the returned disposable. */
  attach(document: vscode.TextDocument, post: DeckSeat['post']): vscode.Disposable {
    const seat: DeckSeat = { document, post };
    this.seats.add(seat);
    return { dispose: () => { this.seats.delete(seat); clearTimeout(this.timers.get(seat)); this.timers.delete(seat); } };
  }

  // ------------------------------------------------------------------ the chip

  private ready(): PublishFeature | null {
    const feature = this.feature;
    return feature && feature.isReady() && isEnabled('decks') ? feature : null;
  }

  /** The deck bar's Publish control: hidden until Publish can be reached; else the page's state. */
  async stateOf(document: vscode.TextDocument): Promise<DeckPageState> {
    return (await this.readState(document, true)).state;
  }

  /**
   * The state, with 2.2 asked again (`ask`) or its last answer (`last`) kept: a deck edit changes the deck's digest,
   * never the page file 2.2 compares.
   */
  private async readState(document: vscode.TextDocument, ask: boolean, last?: PageBarState): Promise<{ state: DeckPageState; bar?: PageBarState }> {
    if (!this.ready()) return { state: { ready: false, kind: 'unpublished', changed: false } };
    const pagePath = pagePathFor(document.uri.fsPath);
    let bar = last;
    if (ask || !bar) {
      try {
        bar = await vscode.commands.executeCommand<PageBarState | undefined>(PAGE_STATE_COMMAND, vscode.Uri.file(pagePath));
      } catch {
        bar = undefined;
      }
    }
    const kind = bar?.kind ?? 'unpublished';
    let changed = bar?.changed === true;
    if (kind === 'published' && !changed) changed = await this.deckChanged(document, pagePath);
    return { state: { ready: true, kind, changed }, bar };
  }

  /** Whether the deck's public content is no longer what its page was written from. */
  private async deckChanged(document: vscode.TextDocument, pagePath: string): Promise<boolean> {
    try {
      const written = readPageMeta(await readHead(pagePath)).digest;
      if (!written) return false;
      const { theme, logo } = await this.lookFor(document.uri.fsPath, document.getText());
      return written !== await currentPageDigest(document.uri.fsPath, document.getText(), theme, nodePageFs, [...await this.fontAddresses(theme), ...(logo ? [logo.address] : [])]);
    } catch {
      return false;
    }
  }

  private async refresh(seat: DeckSeat, ask = true): Promise<void> {
    const { state, bar } = await this.readState(seat.document, ask, seat.bar);
    seat.bar = bar;
    await seat.post({ type: 'deck/page-state', state });
  }

  private refreshAll(): void {
    for (const seat of this.seats) void this.refresh(seat);
  }

  private refreshSoon(seat: DeckSeat): void {
    clearTimeout(this.timers.get(seat));
    this.timers.set(seat, setTimeout(() => { this.timers.delete(seat); void this.refresh(seat, false); }, CHANGED_MS));
  }

  private async refreshPage(pagePath: string): Promise<void> {
    const changed = await pageKeyOf(pagePath);
    for (const seat of this.seats) {
      if (samePath(await pageKeyOf(pagePathFor(seat.document.uri.fsPath)), changed)) void this.refresh(seat);
    }
  }

  private refreshDocument(document: vscode.TextDocument): void {
    for (const seat of this.seats) if (seat.document === document) void this.refresh(seat);
  }

  // ------------------------------------------------------------------ Publish, Update the page

  /**
   * Publish or Update the page: write it beside the deck from the view's text (`body`, front matter left out), look and
   * fit steps, then 2.2's Publish on it.
   */
  async publish(document: vscode.TextDocument, body: string, look: 'card' | 'borderless', steps: readonly number[], notice: (text: string) => void): Promise<void> {
    const feature = this.ready();
    // Turned off since the control was drawn: it hides
    if (!feature) return this.refreshDocument(document);
    const deckPath = document.uri.fsPath;
    const key = normalizeForCompare(deckPath);
    if (this.running.has(key)) return; // a second press while the first is still going: its sheet is on its way
    this.running.add(key);
    // This Publish's font files, held while it runs (`holdFonts`), let go at its end at the latest.
    let unhold = () => {};
    try {
      const pagePath = pagePathFor(deckPath);
      const pageKey = await pageKeyOf(pagePath);
      const documentText = document.getText();
      // The view's words and look, with the document's front matter, where the editor read that front matter as
      // parseDeck does; else the document as saved (publishText), whose slides take the view's fit only while they are
      // as many
      const { text, fromView } = publishText(documentText, body, splitFrontMatter(documentText).content, look);
      const fit = fromView || parseDeck(text.replace(/^\uFEFF/, '')).slides.length === steps.length ? steps : [];
      let built: Awaited<ReturnType<typeof buildDeckPage>>;
      let theme: DeckTheme;
      // Sprint 162 PR 3: the theme's fonts beyond Sofia Sans go beside the page as files, written just before it; and
      // its logo (PR 4), when its file is there.
      let fontFiles: PageFontFile[];
      let logoFiles: PageFile[];
      try {
        const look = await this.lookFor(deckPath, text);
        theme = look.theme;
        logoFiles = look.logo ? [look.logo] : [];
        fontFiles = await this.fontFilesFor(theme);
        built = await buildDeckPage({ deckPath, text, theme, steps: fit }, { ...(await loadPageAssets(this.extensionPath)), themeFonts: fontFiles, logo: look.logo ? { address: look.logo.address, aspect: look.logo.aspect } : null });
      } catch (error) {
        console.warn('[Decks] Could not build the page:', error);
        notice(PAGE_NOT_WRITTEN);
        return;
      }
      // The page is held while its file is written, so no sheet gathers bytes that are about to change; one open on
      // it already (from the browser's bar), or the page going up, keeps the file as that flow read it
      const release = feature.controller.holdPage(pageKey);
      if (!release) {
        notice(PAGE_BEING_PUBLISHED);
        return;
      }
      let written: Awaited<ReturnType<typeof writeDeckPage>>;
      let fonts: { created: string[]; madeFolder: boolean } = { created: [], madeFolder: false };
      let logos: { created: string[]; madeFolder: boolean } = { created: [], madeFolder: false };
      let hadRecord: boolean;
      // This Publish's fonts are held until it ends, so another deck's cancelled Publish never takes them back.
      const fontTargets = [...fontFiles, ...logoFiles].map(file => path.join(path.dirname(deckPath), ...file.address.split('/')));
      unhold = this.holdFonts(fontTargets);
      // Fonts this Publish wrote go again with a page it couldn't write or takes back (unless another Publish here
      // holds them, or another page of Ritemark's names them).
      const takeBackFonts = async () => {
        unhold();
        await removePageFonts(nodeFontFs, deckPath, fonts, fontFiles, target => this.fontsHeld.has(target)).catch(() => undefined);
        await removePageFonts(nodeFontFs, deckPath, logos, logoFiles, target => this.fontsHeld.has(target), LOGO_PLACE).catch(() => undefined);
      };
      try {
        hadRecord = Boolean(await feature.controller.recordFor(pageKey));
        // The fonts first, so the page never names a font that isn't beside it yet.
        const fontsWritten = await writePageFonts(nodeFontFs, deckPath, fontFiles);
        if (fontsWritten.kind === 'refused') {
          written = { kind: 'refused', pagePath, line: fontsWritten.line };
        } else {
          // Kept before the logo is written, so a logo that can't be written takes the fonts back with it (the review of #785).
          fonts = fontsWritten;
          const logoWritten = await writePageFonts(nodeFontFs, deckPath, logoFiles, LOGO_PLACE);
          if (logoWritten.kind === 'refused') {
            written = { kind: 'refused', pagePath, line: logoWritten.line };
          } else {
            logos = logoWritten;
            written = await writeDeckPage(nodePageFs, deckPath, built.html);
          }
        }
      } catch (error) {
        console.warn('[Decks] Could not write the page:', error);
        await takeBackFonts();
        notice(PAGE_NOT_WRITTEN);
        return;
      } finally {
        release();
      }
      if (written.kind === 'refused') {
        await takeBackFonts();
        notice(written.line);
        return;
      }
      this.written.set(normalizeForCompare(pageKey), { digest: built.digest, rows: deckSheetRows(deckCounts(text, theme, fontFiles, logoFiles.length > 0)) });
      let outcome: PublishOutcome | undefined | 'stopped';
      try {
        outcome = await feature.publishPage(vscode.Uri.file(pagePath));
      } catch (error) {
        // An error past the controller's own handling, before anything was sent (an upload's errors are its failures)
        console.warn('[Decks] Publish stopped:', error);
        notice(PUBLISH_STOPPED);
        outcome = 'stopped';
      }
      if (outcome === 'busy') notice(PAGE_BEING_PUBLISHED);
      // A page made for this Publish goes again when nothing was published and nothing failed: cancelled in the sheet,
      // refused before any flow began (the command said why), Publish not reachable, or stopped by an error. A failed
      // one stays for Try again, and a busy one belongs to the flow that took it.
      const takeBack = outcome === 'cancelled' || outcome === 'not-ready' || outcome === undefined || outcome === 'stopped';
      if (takeBack && written.created && !hadRecord && !(await feature.controller.recordFor(pageKey))) {
        if (await removeDeckPage(nodePageFs, pagePath, built.html).catch(() => false)) {
          this.written.delete(normalizeForCompare(pageKey));
          await takeBackFonts();
        }
      }
    } finally {
      unhold();
      this.running.delete(key);
      this.refreshDocument(document);
    }
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
        if (record && WORKERS_DEV_ADDRESS.test(record.address)) await openInIntegratedBrowser(record.address);
        return;
      }
      case 'unpublish':
        await vscode.commands.executeCommand(UNPUBLISH_PAGE_COMMAND, page);
        return;
    }
  }

  // ------------------------------------------------------------------ the sheet's rows

  /**
   * What goes and What stays for a page Ritemark made from the deck beside it; undefined for any other page, and for a
   * deck's page the deck no longer makes (it changed since and the page wasn't written again), whose rows would
   * describe other words than the ones going up. 2.2's own rows show then.
   */
  async pageRows(pagePath: string): Promise<DeckSheetRows | undefined> {
    // Only `<deck name>.html` beside its `<deck name>.deck.md`, holding Ritemark's marks, is a deck's page.
    if (!isEnabled('decks') || !/\.html$/.test(pagePath)) return undefined;
    const besidePath = path.join(path.dirname(pagePath), `${path.basename(pagePath, '.html')}.deck.md`);
    if (deckNameOf(besidePath) === '') return undefined;
    try {
      const meta = readPageMeta(await readHead(pagePath));
      if (!meta.ritemark || !meta.digest) return undefined;
      const registered = this.written.get(normalizeForCompare(pagePath));
      if (registered?.digest === meta.digest) return registered.rows;
      const open = await this.openDocumentAt(besidePath);
      const deckPath = open ? open.uri.fsPath : besidePath;
      const text = open ? open.getText() : await fs.promises.readFile(deckPath, 'utf8');
      const { theme, logo } = await this.lookFor(deckPath, text);
      const fontFiles = await this.fontFilesFor(theme);
      if (await currentPageDigest(deckPath, text, theme, nodePageFs, [...fontFiles.map(file => file.address), ...(logo ? [logo.address] : [])]) !== meta.digest) return undefined;
      return deckSheetRows(deckCounts(text, theme, fontFiles, !!logo));
    } catch {
      return undefined;
    }
  }

  /** The deck at `deckPath` if it is open (by real path, so a link or another spelling of its folder finds it). */
  private async openDocumentAt(deckPath: string): Promise<vscode.TextDocument | undefined> {
    const name = path.basename(deckPath).toLowerCase();
    const real = await realPathOf(deckPath);
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file' || path.basename(doc.uri.fsPath).toLowerCase() !== name) continue;
      if (samePath(doc.uri.fsPath, deckPath) || samePath(await realPathOf(doc.uri.fsPath), real)) return doc;
    }
    return undefined;
  }

  // ------------------------------------------------------------------ the theme

  /** The theme's font files the page carries (`themeFontFiles`), read from the app's `media/fonts/` once per window. */
  private fontFilesFor(theme: DeckTheme): Promise<PageFontFile[]> {
    return themeFontFiles(this.extensionPath, theme, file => {
      let bytes = this.fontBytes.get(file);
      if (!bytes) {
        bytes = fs.promises.readFile(file);
        this.fontBytes.set(file, bytes);
        // A failed read is tried again next time, not remembered.
        bytes.catch(() => this.fontBytes.delete(file));
      }
      return bytes;
    });
  }

  private async fontAddresses(theme: DeckTheme): Promise<string[]> {
    return (await this.fontFilesFor(theme)).map(file => file.address);
  }

  /** Hold font files beside a page while a Publish uses them; the returned function lets go, once. */
  private holdFonts(targets: readonly string[]): () => void {
    for (const target of targets) this.fontsHeld.set(target, (this.fontsHeld.get(target) ?? 0) + 1);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      for (const target of targets) {
        const left = (this.fontsHeld.get(target) ?? 1) - 1;
        if (left > 0) this.fontsHeld.set(target, left);
        else this.fontsHeld.delete(target);
      }
    };
  }

  /**
   * The theme the deck names, read as the deck view reads it (`deckThemeAndLogo`), or the built-in one; and its logo as
   * the page's file (Sprint 162 PR 4), only when the theme has one and its file is there and can go.
   */
  private async lookFor(deckPath: string, text: string): Promise<{ theme: DeckTheme; logo: PageFile | null }> {
    const named = parseDeck(text.replace(/^\uFEFF/, '')).theme;
    const read = await deckThemeAndLogo(deckPath, themePathOf(named));
    const theme = read.text === null ? BUILT_IN_THEME : parseTheme(read.text);
    return { theme, logo: theme.logo && read.logo.state === 'found' ? pageLogoFile(read.logo.bytes, read.logo.kind) : null };
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.disposables.forEach(disposable => disposable.dispose());
    this.seats.clear();
    this.written.clear();
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
