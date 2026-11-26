/**
 * Sprint 159 PR 4: Publish on the deck's bar. A deck is published as its handout page, a real file Ritemark writes
 * in its own folder (`<deck name> files/`, `page/pageFile.ts`). The hosted layout uses the former beside-the-deck
 * location and runs through Publish's gather, key scan, sheet, verified upload and records.
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
 *    Since Sprint 162 PR 6 the digest counts the theme the deck draws as its file on disk has it (its fields, fonts and
 *    logo, `pageReadsChanged`), and a theme or logo file written asks it again (`lookChanged`), so a theme's Save reads
 *    "Published · changed" at once and an Undo back reads "Published". The page keeps its theme until Update the page.
 *  - **Copy link, See online and Unpublish** are 2.2's commands on the page file.
 *  - **The sheet's What goes and What stays rows** for a page made from a deck come from here (`pageRows`), wherever
 *    the page is published from, and only while they describe that page: its digest is the one written with them, or
 *    the deck's own now.
 */
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { locatePage, isInside, isPagePath } from '../browser/localPage';
import { OUTSIDE_PROJECT_MESSAGE } from '../browser/pageCommands';
import { trackEvent } from '../analytics/posthog';
import { DeckLive, type LiveSaveReceipt } from './deckLive';
import { locateLiveIssues } from './deckLiveIssues';
import type { LiveResult } from '../publish/liveUpdate';
import type { LivePreference } from '../publish/publishRecords';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { openInIntegratedBrowser } from '../browser/IntegratedBrowser';
import type { PublishFeature } from '../publish/vscodePublish';
import { COPY_LINK_COMMAND, PAGE_STATE_COMMAND, UNPUBLISH_PAGE_COMMAND } from '../publish/vscodePublish';
import { PAGE_BEING_PUBLISHED, WORKERS_DEV_ADDRESS, type PageBarState, type PublishOutcome } from '../publish/PublishController';
import { splitFrontMatter } from '../editorSync/frontMatter';
import { readRitemarkSavedLogicalHash } from '../editorSync/saveReceipt';
import { normalizeLogicalText } from '../editorSync/state';
import { normalizeForCompare, samePath } from '../utils/pathIdentity';
import { frontMatterLook, parseDeck, publishText } from './deckFormat';
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from './deckTheme';
import { deckThemeAndLogo } from './deckPages';
import type { DeckHostMessage, DeckPageState, DeckPdfKind, DeckNoticeReporter } from './deckProtocol';
import { loadPageAssets } from './page/pageAssets';
import { buildDeckPage, deckNameOf, LOGO_PLACE, nodeFontFs, nodePageFs, pageLogoOf, pagePathFor, pageReadsChanged, readPageMeta, removeDeckPage, removePageFonts, themeFontFiles, writeDeckPage, writePageFonts, type DeckPageNow, type PageFile, type PageFontFile } from './page/pageFile';
import { deckCounts, deckSheetRows, type DeckSheetRows } from './page/sheetRows';
import { HostedDeckLayoutError, type HostedDeckPage } from '../publish/gather';
import { DeckPictureFolderTaken, ensureDeckPictureFolder } from './deckPictureFolder';
import { DECK_EXTENSION, LEGACY_DECK_EXTENSION, deckPictureFolderName } from './deckFileName';

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
  liveInput?: { text: string; look: 'card' | 'borderless'; steps: readonly number[] };
  watcher?: vscode.Disposable;
  owner?: vscode.Webview;
  /**
   * The seat's refreshes, one after another (the review of #791): a theme's Save and its Undo, or an AI's write and
   * the watcher's, each ask again, and an older answer must never be posted after a newer one, nor its 2.2 state kept.
   */
  queue?: Promise<void>;
}

/**
 * A page's path as 2.2 keys it (its real path), also before the file is there: the real path of its folder with its
 * name. Ritemark never writes the page as a link (`writeDeckPage` refuses one), so the two agree.
 */
async function pageKeyOf(pagePath: string): Promise<string> {
  const dir = path.dirname(pagePath);
  const folder = await fs.promises.realpath(dir).catch(async () =>
    path.join(await fs.promises.realpath(path.dirname(dir)).catch(() => path.dirname(dir)), path.basename(dir)));
  return path.join(folder, path.basename(pagePath));
}

function localPagePathFor(deckPath: string): string {
  return pagePathFor(deckPath, path.join(path.dirname(deckPath), deckPictureFolderName(deckPath)));
}

/** The real path of a file, or the path as given when it isn't there. */
async function realPathOf(file: string): Promise<string> {
  return fs.promises.realpath(file).catch(() => file);
}

/**
 * A page's address while it is online: published (an Update going up keeps it), and only an address Cloudflare gave
 * (`WORKERS_DEV_ADDRESS`, the one rule for opening one). Null otherwise.
 */
export function publishedAddress(bar: PageBarState | undefined): string | null {
  if (!bar || (bar.kind !== 'published' && bar.kind !== 'publishing')) return null;
  return bar.address && WORKERS_DEV_ADDRESS.test(bar.address) ? bar.address : null;
}

function liveSnapshot(text: string): string {
  return createHash('sha256').update(normalizeLogicalText(text)).digest('hex');
}

export class DeckPublisher implements vscode.Disposable {
  private readonly seats = new Set<DeckSeat>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<DeckSeat, ReturnType<typeof setTimeout>>();
  /** Decks whose Publish is running, by their path compared as the system compares it. */
  private readonly running = new Map<string, Promise<void>>();
  /** The sheet's rows for each page this window wrote, with the digest written beside them, by the page's real path. */
  private readonly written = new Map<string, {
    digest: string; rows: DeckSheetRows; localSha: string; hostedDeck?: HostedDeckPage;
  }>();
  /** The app's own font files, read once per window (they never change while it runs). */
  private readonly fontBytes = new Map<string, Promise<Buffer>>();
  /** A page's state changed in Publish (by its real path): Present asks again whether the deck is published. */
  private readonly pageChanged = new vscode.EventEmitter<string>();
  readonly onDidChangePage = this.pageChanged.event;
  private readonly liveSaved = new vscode.EventEmitter<LiveSaveReceipt>();
  readonly onDidSaveLive = this.liveSaved.event;
  private readonly liveChanged = new vscode.EventEmitter<{ pagePath: string; result: LiveResult; receipt?: LiveSaveReceipt }>();
  readonly onDidUpdateLive = this.liveChanged.event;
  private readonly liveUsage = new Set<string>();
  private readonly live = new DeckLive((pagePath, result, receipt) => {
    if (result?.kind === 'updated' || result?.kind === 'paused') {
      this.liveChanged.fire({ pagePath, result, ...(receipt && !receipt.superseded ? { receipt } : {}) });
    }
    if (result?.kind === 'updated' && !this.liveUsage.has(pagePath)) {
      this.liveUsage.add(pagePath);
      void trackEvent('feature_used', { feature: 'live_deck_update', source: 'deck' });
    }
    void this.refreshPage(pagePath);
  });
  /** Font files beside a page that a Publish running in this window uses: never taken back by another's cancel. */
  private readonly fontsHeld = new Map<string, number>();
  private feature: PublishFeature | null = null;
  /** Sprint 170: the PDF kinds Save as PDF can make here (`DeckPdfSaver.kinds`), set at activation; none until then. */
  pdfKinds: () => Promise<DeckPdfKind[]> = async () => [];

  constructor(private readonly extensionPath: string) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        for (const seat of this.seats) if (seat.document === event.document) this.refreshSoon(seat);
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        const seat = [...this.seats].find(item => item.document === document);
        if (seat) this.savedForLive(seat, readRitemarkSavedLogicalHash(document));
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
    feature.setHostedDeckPage(pagePath => this.hostedPageForBrowser(pagePath), file => this.fontsHeld.has(normalizeForCompare(file)));
    this.disposables.push(
      { dispose: () => feature.setPageRows(null) },
      { dispose: () => feature.setHostedDeckPage(null) },
      feature.onDidChangeReady(() => this.refreshAll()),
      feature.onDidChangePageState(pagePath => { void this.refreshPage(pagePath); this.pageChanged.fire(pagePath); }),
    );
    this.refreshAll();
  }

  private async recordedPage(deckPath: string): Promise<string> {
    const local = await pageKeyOf(localPagePathFor(deckPath));
    if (await this.feature?.controller.recordFor(local)) return local;
    const legacy = await pageKeyOf(pagePathFor(deckPath));
    return await this.feature?.controller.legacyDeckRecord(legacy) ? legacy : local;
  }

  /** An open deck view: its bar's chip is kept up to date until the returned disposable. */
  attach(document: vscode.TextDocument, post: DeckSeat['post'], owner?: vscode.Webview): vscode.Disposable {
    const seat: DeckSeat = { document, post, owner };
    this.seats.add(seat);
    if (document.uri.scheme === 'file') {
      const file = document.uri.fsPath;
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(file), path.basename(file)), false, false, true);
      const saved = (uri: vscode.Uri) => {
        if (samePath(uri.fsPath, file)) this.savedForLive(seat);
      };
      watcher.onDidChange(saved);
      watcher.onDidCreate(saved);
      seat.watcher = watcher;
    }
    return { dispose: () => {
      seat.watcher?.dispose();
      this.seats.delete(seat);
      clearTimeout(this.timers.get(seat));
      this.timers.delete(seat);
      void pageKeyOf(localPagePathFor(document.uri.fsPath)).then(page => {
        if (![...this.seats].some(item => samePath(item.document.uri.fsPath, document.uri.fsPath))) this.live.stop(normalizeForCompare(page));
      });
    } };
  }

  /** Input from the connected deck view. Capturing fit never starts a publish. */
  rememberLiveInput(document: vscode.TextDocument, owner: vscode.Webview | undefined, input: NonNullable<DeckSeat['liveInput']>): void {
    for (const seat of this.seats) {
      if (seat.document === document && (!owner || seat.owner === owner)) seat.liveInput = input;
    }
  }

  async liveAction(document: vscode.TextDocument, action: 'on' | 'off' | 'resume', owner?: vscode.Webview): Promise<void> {
    const seat = [...this.seats].find(item => item.document === document && (!owner || item.owner === owner));
    const controller = (action === 'off' ? this.feature : this.ready())?.controller;
    if (!seat || !controller || document.uri.scheme !== 'file') return;
    const pagePath = await this.recordedPage(document.uri.fsPath);
    if (!this.seats.has(seat)) return;
    if (action === 'off') {
      if (await controller.setLive(pagePath, false)) this.live.stop(normalizeForCompare(await pageKeyOf(localPagePathFor(document.uri.fsPath))));
      return;
    }
    if (action === 'on' && !await controller.setLive(pagePath, true)) return;
    if (action === 'resume') {
      const record = await controller.recordFor(pagePath);
      if (!record?.live?.pause) return;
    }
    await this.requestLive(seat, action === 'resume');
  }

  private savedForLive(seat: DeckSeat, savedHash?: string): void {
    if (!this.ready() || seat.document.uri.scheme !== 'file') return;
    const file = seat.document.uri.fsPath;
    const snapshot = savedHash
      ? Promise.resolve(savedHash)
      : fs.promises.readFile(file, 'utf8').then(liveSnapshot, () => undefined);
    let settle!: () => void;
    const settled = new Promise<void>(resolve => { settle = resolve; });
    const receipt: LiveSaveReceipt = { file, settled, settle };
    this.liveSaved.fire(receipt);
    void this.requestLive(seat, false, receipt, snapshot).catch(settle);
  }

  private async requestLive(
    seat: DeckSeat, resume = false, receipt?: LiveSaveReceipt, snapshot?: Promise<string | undefined>,
  ): Promise<void> {
    const feature = this.ready();
    const file = seat.document.uri.fsPath;
    if (!feature || seat.document.uri.scheme !== 'file' || !this.seats.has(seat)) {
      receipt?.settle();
      return;
    }
    const page = await this.recordedPage(file);
    const record = await feature.controller.recordFor(page);
    if (!record?.live?.on || !this.seats.has(seat)) {
      receipt?.settle();
      return;
    }
    const pageId = normalizeForCompare(await pageKeyOf(localPagePathFor(file)));
    if (record.live.pause && !resume && !this.live.hasPendingResume(pageId)) {
      receipt?.settle();
      void this.refreshDocument(seat.document);
      return;
    }
    const preference = record.live;
    const openSeats = [...this.seats].filter(item => samePath(item.document.uri.fsPath, file));
    const open = () => Boolean(this.ready()) && openSeats.some(item => this.seats.has(item));
    if (!open()) {
      receipt?.settle();
      return;
    }
    await this.live.request(pageId, async (goOn, sending) => {
      const currentPage = await this.recordedPage(file);
      const current = await feature.controller.recordFor(currentPage);
      if (!open() || current?.live?.id !== preference.id || (current.live.pause && !goOn)) return { kind: 'stopped' };
      const realFile = await fs.promises.realpath(file);
      const roots = await projectRoots();
      const project = roots.find(root => isInside(currentPage, root));
      if (!project || !isInside(realFile, project) || !samePath(await pageKeyOf(pagePathFor(realFile)), await pageKeyOf(pagePathFor(file)))) {
        const release = feature.controller.holdPage(currentPage);
        if (!release) return { kind: 'busy' };
        try {
          return await feature.controller.pauseLivePage(currentPage, { preference: current.live, resume: goOn, active: open }, OUTSIDE_PROJECT_MESSAGE);
        } finally {
          release();
        }
      }
      const saved = await fs.promises.readFile(realFile, 'utf8');
      // The queue reads the latest bytes. Credit only the snapshot observed
      // by this save, even when another write raced its live update.
      if (receipt && snapshot && await snapshot !== liveSnapshot(saved)) {
        receipt.superseded = true;
        receipt.settle();
      }
      const body = splitFrontMatter(saved).content;
      const look = frontMatterLook(saved);
      const matches = (item: DeckSeat) => item.liveInput?.text === body && item.liveInput.look === look;
      const input = (matches(seat) ? seat : [...this.seats].find(item => samePath(item.document.uri.fsPath, file) && matches(item)))?.liveInput;
      // The fit belongs to this saved body. For an external save, use the existing textAndFit fallback.
      const savedDocument = { uri: seat.document.uri, getText: () => saved };
      const result = await this.publishDeck(savedDocument, body, look, input?.steps ?? [], () => {}, {
        preference: current.live, resume: goOn, active: open, sending, roots,
      });
      if (goOn && open() && result.kind === 'paused' && result.pause.kind === 'connection') {
        await feature.controller.startTokenEntry();
      }
      return result;
    }, resume, receipt);
  }

  // ------------------------------------------------------------------ the chip

  private ready(): PublishFeature | null {
    const feature = this.feature;
    return feature && feature.isReady() && isEnabled('decks') ? feature : null;
  }

  async requestPageState(document: vscode.TextDocument, owner: vscode.Webview): Promise<void> {
    const seat = [...this.seats].find(item => item.document === document && item.owner === owner);
    if (seat) await this.refresh(seat);
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
    // Publish not reachable: Save as PDF keeps its place, a local file (the Experience lead, 20 November)
    if (!this.ready()) return { state: { ready: false, kind: 'unpublished', changed: false, pdf: await this.pdfKinds() } };
    const pagePath = await this.recordedPage(document.uri.fsPath);
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
    const pageKey = await pageKeyOf(pagePath);
    const preference = (kind === 'published' || kind === 'publishing')
      ? (await this.feature?.controller.recordFor(pageKey))?.live : undefined;
    const live = preference && this.live.state(normalizeForCompare(await pageKeyOf(localPagePathFor(document.uri.fsPath))), preference);
    if (live?.state === 'paused' && live.pause?.kind === 'key') {
      if (live.pause.location) {
        // Stored scan coordinates include front matter. The deck editor holds just the body.
        const fullText = document.getText();
        const body = splitFrontMatter(fullText).content;
        const headLines = fullText.slice(0, fullText.length - body.length).split('\n').length - 1;
        live.pause = { ...live.pause, location: { ...live.pause.location, line: live.pause.location.line - headLines } };
      }
      live.resumeBlocked = await this.stillHasKey(document, pagePath) ? 'Take the key out first.' : undefined;
    }
    const address = publishedAddress(bar);
    return { state: { ready: true, kind, changed, pdf: await this.pdfKinds(), ...(address && { address }), ...(live && { live }) }, bar };
  }

  /**
   * Small details item 3: the deck's published page, by its address, for Present's QR code; null while it isn't
   * published (or Publish can't be reached). Publish's own record, read now (never the chip's last answer), without
   * the gather the chip's "changed" needs, so a Q on the wall answers at once.
   */
  async pageAddressOf(document: vscode.TextDocument): Promise<string | null> {
    const feature = this.ready();
    if (!feature) return null;
    try {
      return publishedAddress(await feature.controller.pageState(await this.recordedPage(document.uri.fsPath)));
    } catch {
      return null;
    }
  }

  /**
   * Whether the deck's public content, or its theme with its fonts and logo (Sprint 162 PR 6), is no longer what its
   * page was written from (`pageReadsChanged`).
   */
  private async deckChanged(document: vscode.TextDocument, pagePath: string): Promise<boolean> {
    try {
      // A page without Ritemark's digest is never "changed": known before the theme and its files are read.
      const written = readPageMeta(await readHead(pagePath)).digest;
      if (!written) return false;
      return await pageReadsChanged(written, await this.pageNow(document.uri.fsPath, document.getText()));
    } catch {
      return false;
    }
  }

  private refresh(seat: DeckSeat, ask = true): Promise<void> {
    const run = async () => {
      // Read when its turn comes, so a refresh that doesn't ask 2.2 keeps the newest answer an earlier one got.
      const { state, bar } = await this.readState(seat.document, ask, seat.bar);
      seat.bar = bar;
      await seat.post({ type: 'deck/page-state', state });
    };
    const next = (seat.queue ?? Promise.resolve()).then(run, run);
    seat.queue = next.catch(() => undefined);
    return next;
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
      if (samePath(await pageKeyOf(pagePathFor(seat.document.uri.fsPath)), changed)
        || samePath(await pageKeyOf(localPagePathFor(seat.document.uri.fsPath)), changed)) void this.refresh(seat);
    }
  }

  private refreshDocument(document: Pick<vscode.TextDocument, 'uri'>): void {
    for (const seat of this.seats) if (samePath(seat.document.uri.fsPath, document.uri.fsPath)) void this.refresh(seat);
  }

  /**
   * Sprint 162 PR 6: the theme this deck draws was saved, its logo's file changed, or another program wrote either: the
   * chip asks the digest again (the page file 2.2 compares didn't change), so it says "Published · changed" at once, and
   * "Published" again once the theme is back as the page has it. The page itself is left as it is until Update the page.
   */
  lookChanged(document: vscode.TextDocument): void {
    for (const seat of this.seats) if (seat.document === document) void this.refresh(seat, false);
  }

  // ------------------------------------------------------------------ Publish, Update the page

  /**
   * Publish or Update the page: write it in the deck’s folder from the view's text (`body`, front matter left out), look and
   * fit steps, then 2.2's Publish on it.
   */
  async publish(document: vscode.TextDocument, body: string, look: 'card' | 'borderless', steps: readonly number[], notice: DeckNoticeReporter): Promise<void> {
    this.rememberLiveInput(document, undefined, { text: body, look, steps });
    if (!this.ready()) return this.refreshDocument(document);
    await this.publishDeck(document, body, look, steps, notice);
  }

  private async publishDeck(
    document: Pick<vscode.TextDocument, 'uri' | 'getText'>, body: string, look: 'card' | 'borderless',
    steps: readonly number[], notice: DeckNoticeReporter,
    live?: { preference: LivePreference; resume: boolean; active: () => boolean; sending: () => void; roots: string[] },
  ): Promise<LiveResult> {
    const stopped: LiveResult = { kind: 'stopped' };
    const offline = (detail: string): LiveResult => ({ kind: 'offline', detail });
    const feature = this.ready();
    // Turned off since the control was drawn: it hides
    if (!feature) return stopped;
    const deckPath = document.uri.fsPath;
    const key = normalizeForCompare(deckPath);
    const running = this.running.get(key);
    if (running) return { kind: 'busy', until: running };
    let finish!: () => void;
    this.running.set(key, new Promise<void>(resolve => { finish = resolve; }));
    // This Publish's font files, held while it runs (`holdFonts`), let go at its end at the latest.
    let unhold = () => {};
    let releasePage: (() => void) | undefined;
    try {
      const legacyPath = pagePathFor(deckPath);
      const legacyKey = await pageKeyOf(legacyPath);
      const localPath = localPagePathFor(deckPath);
      const localKey = await pageKeyOf(localPath);
      const pagePath = live && samePath(await this.recordedPage(deckPath), legacyKey) ? legacyPath : localPath;
      const pageKey = pagePath === legacyPath ? legacyKey : localKey;
      const moved = pagePath === localPath;
      const legacyStopped = async (): Promise<LiveResult> => {
        if (!moved && live?.active() && (await feature.controller.recordFor(localKey))?.live?.id === live.preference.id) {
          return { kind: 'busy' };
        }
        return stopped;
      };
      const releaseLegacy = moved && !live ? feature.controller.holdPage(legacyKey) : undefined;
      if (moved && !live && !releaseLegacy) {
        notice(PAGE_BEING_PUBLISHED);
        return { kind: 'busy' };
      }
      releasePage = releaseLegacy ?? undefined;
      // The page is held while its file is written, so no sheet gathers bytes that are about to change; one open on
      // it already (from the browser's bar), or the page going up, keeps the file as that flow read it
      const release = feature.controller.holdPage(pageKey);
      if (!release) {
        notice(PAGE_BEING_PUBLISHED);
        return { kind: 'busy' };
      }
      releasePage = () => { release(); releaseLegacy?.(); };
      // The view's words and look (`pageInput`, which Save as PDF reads too)
      const { text } = this.textAndFit(document, body, look, steps);
      let built: Awaited<ReturnType<typeof this.buildPage>>;
      try {
        built = await this.buildPage(document, body, look, steps, pagePath);
      } catch (error) {
        const line = error instanceof HostedDeckLayoutError ? error.message : PAGE_NOT_WRITTEN;
        if (live) return await feature.controller.pauseLivePage(pageKey, live, line);
        console.warn('[Decks] Could not build the page:', error);
        notice(line, 'failure');
        return stopped;
      }
      const { theme, fontFiles, logoFiles } = built;
      let hostedDeck = moved ? this.hostedDeck(legacyKey, built) : undefined;
      const assetAnchor = moved ? pagePath : deckPath;
      let written: Awaited<ReturnType<typeof writeDeckPage>> | undefined;
      let fonts: { created: string[]; madeFolder: boolean } = { created: [], madeFolder: false };
      let logos: { created: string[]; madeFolder: boolean } = { created: [], madeFolder: false };
      let hadRecord = false;
      let madeFolder = false;
      let legacyDigest: string | undefined;
      let livePageSha: string | undefined;
      let reusePublishedHtml = false;
      // This Publish's fonts are held until it ends, so another deck's cancelled Publish never takes them back.
      const fontTargets = [...fontFiles, ...logoFiles].map(file => path.join(path.dirname(assetAnchor), ...file.address.split('/')));
      unhold = this.holdFonts(fontTargets);
      // Fonts this Publish wrote go again with a page it couldn't write or takes back (unless another Publish here
      // holds them, or another page of Ritemark's names them).
      const takeBackAssets = async () => {
        unhold();
        await removePageFonts(nodeFontFs, assetAnchor, fonts, fontFiles, target => this.fontsHeld.has(normalizeForCompare(target))).catch(() => undefined);
        await removePageFonts(nodeFontFs, assetAnchor, logos, logoFiles, target => this.fontsHeld.has(normalizeForCompare(target)), LOGO_PLACE).catch(() => undefined);
        if (madeFolder) await fs.promises.rmdir(path.dirname(pagePath)).catch(() => undefined);
      };
      try {
        const write = async (): Promise<void> => {
          const record = await feature.controller.recordFor(pageKey);
          hadRecord = Boolean(record);
          if (moved) {
            const folder = await ensureDeckPictureFolder(deckPath, () => { madeFolder = true; });
            const info = await fs.promises.lstat(folder);
            if (!info.isDirectory() || info.isSymbolicLink()) throw new DeckPictureFolderTaken(path.basename(folder));
          }
          if (live && moved && !built.fit.length && record?.deckFit?.length && record.deckDigest === built.digest) {
            const fitted = await this.buildPage(document, body, look, record.deckFit, pagePath);
            const publishedSha = record.files.find(file => isPagePath(file.path))?.sha256;
            if (createHash('sha256').update(fitted.hostedHtml).digest('hex') === publishedSha) {
              built = fitted;
              hostedDeck = this.hostedDeck(legacyKey, fitted);
            }
          }
          if (live && !moved && record && (!record.deckDigest || record.deckDigest === built.digest)) {
            const existing = await locatePage(pageKey, live.roots);
            const bytes = existing.kind === 'project' && samePath(existing.realPath, pageKey)
              ? await fs.promises.readFile(pageKey).catch(() => undefined) : undefined;
            const existingSha = bytes && createHash('sha256').update(bytes).digest('hex');
            if (existing.kind === 'project' && bytes && record.files.some(file => path.basename(file.path) === path.basename(pageKey) && file.sha256 === existingSha)) {
              legacyDigest = readPageMeta(bytes.subarray(0, 4096).toString('utf8')).digest ?? undefined;
              if (legacyDigest === built.digest && existingSha) {
                // A timetable-only save can arrive before the view measures fit again. Keep the checked published
                // HTML in place, but still gather its assets so changes to a picture's bytes can go.
                reusePublishedHtml = await feature.controller.matchesPublishedBytes(existing, record.contentHash).catch(() => false);
                if (reusePublishedHtml) livePageSha = existingSha;
              }
            }
          }
          // The fonts first, so the page never names a font that isn't beside it yet.
          const fontsWritten = await writePageFonts(nodeFontFs, assetAnchor, fontFiles);
          if (fontsWritten.kind === 'refused') {
            written = { kind: 'refused', pagePath, line: fontsWritten.line };
          } else {
            // Kept before the logo is written, so a logo that can't be written takes the fonts back with it (the review of #785).
            fonts = fontsWritten;
            const logoWritten = await writePageFonts(nodeFontFs, assetAnchor, logoFiles, LOGO_PLACE);
            if (logoWritten.kind === 'refused') {
              written = { kind: 'refused', pagePath, line: logoWritten.line };
            } else {
              logos = logoWritten;
              written = reusePublishedHtml
                ? { kind: 'written', pagePath, created: false, unchanged: true }
                : await writeDeckPage(nodePageFs, deckPath, built.html, pagePath);
            }
          }
        };
        if (live && !moved) {
          if (!await feature.controller.writeLegacyDeckPage(pageKey, write)) return await legacyStopped();
        } else {
          await write();
        }
      } catch (error) {
        const line = error instanceof DeckPictureFolderTaken ? error.message : PAGE_NOT_WRITTEN;
        if (live) {
          await takeBackAssets();
          return error instanceof DeckPictureFolderTaken
            ? await feature.controller.pauseLivePage(pageKey, live, line) : offline(line);
        }
        console.warn('[Decks] Could not write the page:', error);
        await takeBackAssets();
        notice(line, 'failure');
        return stopped;
      }
      if (!written) return stopped;
      if (written.kind === 'refused') {
        await takeBackAssets();
        if (live) return await feature.controller.pauseLivePage(pageKey, live, written.line);
        notice(written.line, 'failure');
        return stopped;
      }
      this.written.set(normalizeForCompare(pageKey), {
        digest: built.digest, rows: deckSheetRows(deckCounts(text, theme, fontFiles, logoFiles.length > 0)),
        localSha: createHash('sha256').update(built.html).digest('hex'), hostedDeck,
      });
      if (live) {
        const location = await locatePage(pagePath, live.roots);
        if (location.kind !== 'project' || !samePath(location.realPath, pageKey)) {
          const result = await feature.controller.pauseLivePage(pageKey, live, OUTSIDE_PROJECT_MESSAGE);
          return result.kind === 'stopped' ? await legacyStopped() : result;
        }
        const describe = await locateLiveIssues(deckPath, text, built);
        const result = await feature.controller.updateLive({ ...location, hostedDeck }, {
          ...live, digest: built.digest, legacyDigest, describe,
          pageSha: livePageSha ?? createHash('sha256').update(built.hostedHtml).digest('hex'),
        });
        return result.kind === 'stopped' ? await legacyStopped() : result;
      }
      release();
      let outcome: PublishOutcome | undefined | 'stopped';
      try {
        outcome = await feature.publishPage(vscode.Uri.file(pagePath), hostedDeck);
      } catch (error) {
        // An error past the controller's own handling, before anything was sent (an upload's errors are its failures)
        console.warn('[Decks] Publish stopped:', error);
        notice(PUBLISH_STOPPED, 'failure');
        outcome = 'stopped';
      }
      if (outcome === 'busy') notice(PAGE_BEING_PUBLISHED);
      if (outcome === 'published') notice('', 'success');
      // A page made for this Publish goes again when nothing was published and nothing failed: cancelled in the sheet,
      // refused before any flow began (the command said why), Publish not reachable, or stopped by an error. A failed
      // one stays for Try again, and a busy one belongs to the flow that took it.
      const takeBack = outcome === 'cancelled' || outcome === 'not-ready' || outcome === undefined || outcome === 'stopped';
      if (takeBack && written.created && !hadRecord && !(await feature.controller.recordFor(pageKey))) {
        if (await removeDeckPage(nodePageFs, pagePath, built.html).catch(() => false)) {
          this.written.delete(normalizeForCompare(pageKey));
          await takeBackAssets();
        }
      }
      return stopped;
    } finally {
      releasePage?.();
      unhold();
      this.running.delete(key);
      finish();
      this.refreshDocument(document);
    }
  }

  /** Read-only preview for the paused menu. Go on always runs the complete guard again. */
  private async stillHasKey(document: vscode.TextDocument, pagePath: string): Promise<boolean> {
    try {
      const realPath = await pageKeyOf(pagePath);
      const projectFolder = (await projectRoots()).find(root => isInside(realPath, root));
      const realDeck = await fs.promises.realpath(document.uri.fsPath);
      if (!projectFolder || !samePath(await pageKeyOf(pagePathFor(realDeck)), await pageKeyOf(pagePathFor(document.uri.fsPath)))) return true;
      const saved = await fs.promises.readFile(realDeck, 'utf8');
      const source = { uri: document.uri, getText: () => saved };
      const built = await this.buildPage(source, splitFrontMatter(saved).content, frontMatterLook(saved), [], pagePath);
      const legacy = await pageKeyOf(pagePathFor(realDeck));
      const hostedDeck = samePath(realPath, legacy) ? undefined : this.hostedDeck(legacy, built);
      return await this.feature!.controller.hasLiveKey({ realPath, projectFolder, hostedDeck }, built.html);
    } catch {
      return true;
    }
  }

  /** The same render, including its fitted steps, for manual and live updates. */
  private async buildPage(
    document: Pick<vscode.TextDocument, 'uri' | 'getText'>,
    body: string, look: 'card' | 'borderless', steps: readonly number[], pagePath: string,
  ) {
    const input = await this.pageInput(document, body, look, steps);
    const assets = await loadPageAssets(this.extensionPath);
    const logo = input.logo ? { address: input.logo.address, aspect: input.logo.aspect } : null;
    const pageAssets = { ...assets, themeFonts: input.fonts, logo };
    const moved = pagePath !== pagePathFor(input.deckPath);
    const assetPaths = new Set([...input.fonts, ...(logo ? [logo] : [])]
      .map(file => normalizeForCompare(path.resolve(path.dirname(input.deckPath), file.address))));
    const hosted = await buildDeckPage({ ...input, onPicture: file => {
      if (moved && assetPaths.has(normalizeForCompare(file))) {
        throw new HostedDeckLayoutError('A picture and a theme file would publish at the same address. Nothing was sent.');
      }
    } }, pageAssets);
    const local = moved ? await buildDeckPage({ ...input, pagePath }, pageAssets) : hosted;
    return { ...local, fit: input.steps, hostedHtml: hosted.html, theme: input.theme, fontFiles: input.fonts, logoFiles: input.logo ? [input.logo] : [] };
  }

  private hostedDeck(besideDeckPath: string, built: Awaited<ReturnType<DeckPublisher['buildPage']>>): HostedDeckPage {
    return { besideDeckPath, html: built.hostedHtml, fit: built.fit, assetAddresses: [...built.fontFiles, ...built.logoFiles].map(file => file.address) };
  }

  /** The browser can publish the local handout when the hosted render of those same bytes is available. */
  private async hostedPageForBrowser(pagePath: string): Promise<HostedDeckPage | undefined> {
    const folder = path.dirname(pagePath);
    const name = path.basename(pagePath, '.html');
    if (path.basename(folder) !== `${name} files`) return undefined;
    const bytes = await fs.promises.readFile(pagePath);
    const cached = this.written.get(normalizeForCompare(pagePath));
    if (cached?.hostedDeck && cached.localSha === createHash('sha256').update(bytes).digest('hex')) return cached.hostedDeck;
    const record = await this.feature?.controller.recordFor(pagePath);
    if (!record?.deckFolder && !readPageMeta(bytes.subarray(0, 4096).toString('utf8')).ritemark) return undefined;
    const beside = path.join(path.dirname(folder), name);
    for (const extension of [DECK_EXTENSION, LEGACY_DECK_EXTENSION]) {
      const deckPath = beside + extension;
      const saved = await fs.promises.readFile(deckPath, 'utf8').catch(() => undefined);
      if (saved === undefined) continue;
      const source = { uri: vscode.Uri.file(deckPath), getText: () => saved };
      const measured = this.savedFit(deckPath, saved);
      const fits = [measured, record?.deckFit].filter((fit): fit is readonly number[] => Boolean(fit?.length));
      for (const steps of [...fits, []]) {
        const built = await this.buildPage(source, splitFrontMatter(saved).content, frontMatterLook(saved), steps, pagePath);
        if (bytes.equals(Buffer.from(built.html))) return this.hostedDeck(`${beside}.html`, built);
      }
    }
    throw new HostedDeckLayoutError('Open the deck and choose Publish to update this page.');
  }

  // ------------------------------------------------------------------ Save as PDF (Sprint 170)

  /**
   * The view's words and look, with the document's front matter, where the editor read that front matter as parseDeck
   * does; else the document as saved (publishText), whose slides take the view's fit only while they are as many.
   */
  private textAndFit(document: Pick<vscode.TextDocument, 'getText'>, body: string, look: 'card' | 'borderless', steps: readonly number[]): { text: string; steps: readonly number[] } {
    const documentText = document.getText();
    const { text, fromView } = publishText(documentText, body, splitFrontMatter(documentText).content, look);
    return { text, steps: fromView || parseDeck(text.replace(/^\uFEFF/, '')).slides.length === steps.length ? steps : [] };
  }

  /**
   * What the page is made from, for Publish and for Save as PDF alike (Sprint 170), so the PDF is the page: the view's
   * words and fit (`textAndFit`), the theme as its file on disk has it, its font files and its logo. Writes nothing.
   */
  async pageInput(document: Pick<vscode.TextDocument, 'uri' | 'getText'>, body: string, look: 'card' | 'borderless', steps: readonly number[]): Promise<{ deckPath: string; text: string; theme: DeckTheme; steps: readonly number[]; fonts: PageFontFile[]; logo: PageFile | null }> {
    const deckPath = document.uri.fsPath;
    const { text, steps: fit } = this.textAndFit(document, body, look, steps);
    return { ...await this.savedPageInput(deckPath, text, false), steps: fit };
  }

  /** Resolve the saved deck's look and local assets without opening a document. */
  async savedPageInput(deckPath: string, text: string, fresh = true) {
    const { theme, logo, themeBytes, themeFiles } = await this.lookFor(deckPath, text, fresh);
    const measured = fresh ? this.savedFit(deckPath, text) : undefined;
    return { deckPath, text, theme, themeBytes, themeFiles, steps: measured ?? [], measureFit: fresh && !measured, fonts: await this.fontFilesFor(theme), logo };
  }

  private savedFit(deckPath: string, text: string): readonly number[] | undefined {
    const body = splitFrontMatter(text).content;
    const look = frontMatterLook(text);
    const count = parseDeck(text.replace(/^\uFEFF/, '')).slides.length;
    const input = [...this.seats].find(seat =>
      samePath(seat.document.uri.fsPath, deckPath) && seat.liveInput?.text === body
      && seat.liveInput.look === look && seat.liveInput.steps.length === count)?.liveInput;
    return input && [...input.steps];
  }

  // ------------------------------------------------------------------ Copy link, See online, Unpublish

  async pageAction(document: vscode.TextDocument, action: 'copy-link' | 'see-online' | 'unpublish', notice: DeckNoticeReporter): Promise<void> {
    const feature = this.feature;
    if (!feature) return;
    const page = vscode.Uri.file(await this.recordedPage(document.uri.fsPath));
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
    // Only `<deck name>.html` beside its `<deck name>.rtms` (or, for a deck made before, `<deck name>.deck.md`),
    // holding Ritemark's marks, is a deck's page.
    if (!isEnabled('decks') || !/\.html$/.test(pagePath)) return undefined;
    const name = path.basename(pagePath, '.html');
    if (name === '') return undefined;
    try {
      const meta = readPageMeta(await readHead(pagePath));
      if (!meta.ritemark || !meta.digest) return undefined;
      const registered = this.written.get(normalizeForCompare(pagePath));
      if (registered?.digest === meta.digest) return registered.rows;
      // Sprint 172: the deck beside is `<name>.rtms` or an older `<name>.deck.md`; should both be there, the one this
      // page reads as made from (review of #949).
      const folder = path.dirname(pagePath);
      const base = path.join(path.basename(folder) === `${name} files` ? path.dirname(folder) : folder, name);
      for (const besidePath of [`${base}${DECK_EXTENSION}`, `${base}${LEGACY_DECK_EXTENSION}`]) {
        const open = await this.openDocumentAt(besidePath);
        const text = open ? open.getText() : await fs.promises.readFile(besidePath, 'utf8').catch(() => null);
        if (text === null) continue;
        const now = await this.pageNow(open ? open.uri.fsPath : besidePath, text);
        if (!(await pageReadsChanged(meta.digest, now))) return deckSheetRows(deckCounts(text, now.theme, now.fonts, !!now.logo));
      }
      return undefined;
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

  /** What the deck would put on its page now (`DeckPageNow`): its text, its theme as the file on disk has it, and the theme's files. */
  private async pageNow(deckPath: string, text: string): Promise<DeckPageNow & { fonts: PageFontFile[] }> {
    const { theme, logo } = await this.lookFor(deckPath, text);
    return { deckPath, text, theme, fonts: await this.fontFilesFor(theme), logo };
  }

  /** Hold font files beside a page while a Publish uses them; the returned function lets go, once. */
  private holdFonts(targets: readonly string[]): () => void {
    const keys = targets.map(file => normalizeForCompare(file));
    for (const target of keys) this.fontsHeld.set(target, (this.fontsHeld.get(target) ?? 0) + 1);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      for (const target of keys) {
        const left = (this.fontsHeld.get(target) ?? 1) - 1;
        if (left > 0) this.fontsHeld.set(target, left);
        else this.fontsHeld.delete(target);
      }
    };
  }

  /**
   * The theme the deck names, read as the deck view reads it (`deckThemeAndLogo`), or the built-in one; and its logo as
   * the page's file (Sprint 162 PR 4), only when the theme has one and its file is there and can go. The page carries
   * the one logo its slides draw (18 November, `pageLogoOf`): the second version only when the deck's look uses it.
   */
  private async lookFor(deckPath: string, text: string, fresh = false): Promise<{ theme: DeckTheme; logo: PageFile | null; themeBytes: Buffer | null; themeFiles: string[] }> {
    const named = parseDeck(text.replace(/^\uFEFF/, '')).theme;
    const read = await deckThemeAndLogo(deckPath, themePathOf(named), fresh);
    const theme = read.text === null ? BUILT_IN_THEME : parseTheme(read.text);
    return { theme, themeBytes: read.bytes, themeFiles: read.files, logo: pageLogoOf(theme, frontMatterLook(text) === 'borderless', read.logo, read.secondLogo) };
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.disposables.forEach(disposable => disposable.dispose());
    this.pageChanged.dispose();
    this.liveSaved.dispose();
    this.liveChanged.dispose();
    this.live.dispose();
    for (const seat of this.seats) seat.watcher?.dispose();
    this.seats.clear();
    this.written.clear();
  }
}

async function projectRoots(): Promise<string[]> {
  const folders = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file');
  const roots = await Promise.all(folders.map(folder => fs.promises.realpath(folder.uri.fsPath).catch(() => null)));
  return roots.filter((root): root is string => root !== null);
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
