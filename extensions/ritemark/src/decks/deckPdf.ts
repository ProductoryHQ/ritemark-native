/**
 * Sprint 170 (#881; the decks README, "Save as PDF, from Publish"): Save as PDF from Publish's menu. The menu's item
 * names the kind the view would save (`pdfItemLabel`); the file is that kind, saved where the person says.
 *
 *  - **Slides and handout** (PR 1) is the published page's print, exactly: the page `buildDeckPage` makes, with its
 *    `PRINT_CSS` (A4 portrait), so skipped slides, comments and notes are never in it (`publicDeck`), Copy and ↗ aren't
 *    drawn, links and Buttons stay links.
 *  - **Slides** (PR 2, #885) is the same page with the slides' print rules (`SLIDES_PRINT_CSS`): one 16:9 page a
 *    slide, drawn by the wall's renderer on the theme's ground, every reveal shown, each tab as the slide holds it.
 *  - **Handout** (PR 3, #886) is the same A4 print with the text alone (`HANDOUT_PRINT_CSS`): no slide drawn, each
 *    part under its number and heading. Each view's item saves its own kind (`pdfKindFor`).
 *  - **The print** is the app's own, in the main process (patch 021, `_ritemark.printHtmlToPdf`): the page is written
 *    to a temporary folder of its own with its fonts, logo and pictures, printed there offline (nothing else loads),
 *    and the folder goes again. A shell without the patch has no command, and then no kind is offered.
 *  - **The file:** the system's save dialog first, starting in the deck's folder with the kind's name (`pdfFileName`);
 *    a file already there gets the system's own Replace question. Cancelling writes nothing and says nothing. The PDF
 *    is written under a hidden name beside its place and moved there in one step, so a half-written PDF is never what
 *    the person finds. Then the bar says "Saved as <name>.pdf" with Show in folder.
 *
 * The file system, the dialog, the print and the reveal are parameters (`PdfDeps`), so every rule here tests under Node.
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import type { DeckTheme } from './deckTheme';
import type { DeckHostMessage, DeckPdfKind } from './deckProtocol';
import { buildPrintPage, deckNameOf, type PageFile, type PageFontFile } from './page/pageFile';
import { handoutHasText, type PageAssets } from './page/pageHtml';
import { normalizeForCompare } from '../utils/pathIdentity';
import { pdfFileName } from './deckPdfKinds';

export { pdfFileName, pdfItemLabel, pdfKindFor, pdfKindOfView } from './deckPdfKinds';

/** Patch 021's command: a page's path in, its PDF's path out. */
export const PRINT_COMMAND = '_ritemark.printHtmlToPdf';

/** The kinds this app makes: each view's own (`pdfKindFor`). */
export const SAVED_KINDS: readonly DeckPdfKind[] = ['slides-and-handout', 'slides', 'handout'];

/** Why nothing was saved after the dialog: the PDF couldn't be made or written. */
export const PDF_NOT_SAVED = "The PDF couldn't be made, so nothing was saved.";

/** Why Save slides as PDF saved nothing: every slide is skipped, or there are none. */
export const PDF_NO_SLIDES = 'This deck has no slides to save, so nothing was saved.';

/** Why Save handout as PDF saved nothing: no part of the handout has text. */
export const PDF_NO_HANDOUT = 'This handout has no text to save, so nothing was saved.';

/** What Save as PDF prints (`DeckPublisher.pageInput`). */
export interface PrintInput {
  deckPath: string;
  text: string;
  theme: DeckTheme;
  steps: readonly number[];
  fonts: PageFontFile[];
  logo: PageFile | null;
}

export interface PdfDeps {
  /** Whether the app's print is there (patch 021's command). */
  hasPrint(): Promise<boolean>;
  /** The page's CSS and Sofia Sans (`loadPageAssets`). */
  assets(): Promise<PageAssets>;
  /** The system's save dialog, starting at this path: the file chosen, or undefined when cancelled. */
  askTarget(defaultPath: string): Promise<string | undefined>;
  /** The app's print: a page's path in a temporary folder, its PDF's path beside it. */
  print(htmlPath: string): Promise<string>;
  /** Show a file in the system's file manager. */
  reveal(file: string): Promise<void>;
  /** The folder the print's own folders are made in (the system's temporary folder). */
  tempRoot?: string;
}

/** Copy `from` over `target` in one step: a hidden copy beside the target, then a rename onto it. */
export async function writeOver(from: string, target: string): Promise<void> {
  const part = path.join(path.dirname(target), `.${path.basename(target)}.${randomBytes(6).toString('hex')}.part`);
  try {
    await fs.promises.copyFile(from, part, fs.constants.COPYFILE_EXCL);
    await fs.promises.rename(part, target);
  } catch (error) {
    await fs.promises.unlink(part).catch(() => undefined);
    throw error;
  }
}

/** Write the print's folder: the theme's font and logo files at their addresses, the pictures as `buildPrintPage` names them, then the page. */
async function writePrintFolder(folder: string, html: string, files: readonly PageFile[], pictures: ReadonlyArray<{ address: string; file: string }>): Promise<string> {
  const placed = (address: string) => {
    const target = path.resolve(folder, ...address.split('/'));
    if (path.relative(folder, target).startsWith('..') || path.isAbsolute(path.relative(folder, target))) throw new Error('An address outside the print folder');
    return target;
  };
  await Promise.all([
    ...files.map(async file => {
      const target = placed(file.address);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, file.bytes, { flag: 'wx' });
    }),
    ...pictures.map(async picture => {
      const target = placed(picture.address);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.copyFile(picture.file, target, fs.constants.COPYFILE_EXCL);
    }),
  ]);
  const page = path.join(folder, 'page.html');
  await fs.promises.writeFile(page, html, { encoding: 'utf8', flag: 'wx' });
  return page;
}

export class DeckPdfSaver {
  /** Decks whose Save as PDF is running, by their path compared as the system compares it. */
  private readonly running = new Set<string>();
  /** The PDF each deck's view saved last, for the bar's Show in folder. */
  private readonly saved = new Map<string, string>();
  /** The print was found: it stays for the window (registered as the window starts, before any extension). */
  private printFound = false;

  constructor(
    private readonly source: { pageInput(document: vscode.TextDocument, body: string, look: 'card' | 'borderless', steps: readonly number[]): Promise<PrintInput> },
    private readonly deps: PdfDeps,
    private readonly enabled: () => boolean,
  ) { }

  /** The kinds Publish's menu may offer: none with Decks off or without the app's print. */
  async kinds(): Promise<DeckPdfKind[]> {
    if (!this.enabled()) return [];
    // Only a yes is kept: a no (an older shell, or a lookup that failed) is asked again at the next state
    this.printFound ||= await this.deps.hasPrint().catch(() => false);
    return this.printFound ? [...SAVED_KINDS] : [];
  }

  /** Save as PDF: the dialog, then the print, then the file and the bar's note. */
  async save(document: vscode.TextDocument, kind: DeckPdfKind, body: string, look: 'card' | 'borderless', steps: readonly number[], post: (message: DeckHostMessage) => void): Promise<void> {
    if (!(await this.kinds()).includes(kind)) return;
    const deckPath = document.uri.fsPath;
    const key = normalizeForCompare(deckPath);
    if (this.running.has(key)) return; // a second press while the first is going: its dialog is open
    this.running.add(key);
    let folder: string | null = null;
    try {
      const target = await this.deps.askTarget(path.join(path.dirname(deckPath), pdfFileName(deckNameOf(deckPath), kind)));
      if (!target) return; // cancelled: nothing written, nothing said
      const name = path.basename(target);
      post({ type: 'deck/page-notice', text: `Saving ${name}…` });
      try {
        const input = await this.source.pageInput(document, body, look, steps);
        const assets = await this.deps.assets();
        const built = await buildPrintPage(
          { deckPath: input.deckPath, text: input.text, theme: input.theme, steps: input.steps, print: kind === 'slides-and-handout' ? undefined : kind },
          { ...assets, themeFonts: input.fonts, logo: input.logo ? { address: input.logo.address, aspect: input.logo.aspect } : null },
        );
        // A deck whose slides are all skipped has nothing to print as slides: say so rather than save a blank page.
        if (kind === 'slides' && built.deck.slides.length === 0) {
          post({ type: 'deck/page-notice', text: PDF_NO_SLIDES, kind: 'failure', operation: 'save-pdf' });
          return;
        }
        // Likewise a handout with no text: nothing to print but its footer.
        if (kind === 'handout' && !handoutHasText(built.deck)) {
          post({ type: 'deck/page-notice', text: PDF_NO_HANDOUT, kind: 'failure', operation: 'save-pdf' });
          return;
        }
        folder = await fs.promises.mkdtemp(path.join(this.deps.tempRoot ?? os.tmpdir(), 'ritemark-pdf-'));
        const page = await writePrintFolder(folder, built.html, [...input.fonts, ...(input.logo ? [input.logo] : [])], built.pictures);
        const pdf = await this.deps.print(page);
        // The print answers a PDF in its own folder; anything else is never copied.
        const there = typeof pdf === 'string' && path.extname(pdf) === '.pdf' && await fs.promises.realpath(path.dirname(pdf)).catch(() => null);
        if (!there || there !== await fs.promises.realpath(folder)) throw new Error('The print answered another file');
        await writeOver(pdf, target);
      } catch (error) {
        console.warn('[Decks] Save as PDF failed:', error);
        post({ type: 'deck/page-notice', text: PDF_NOT_SAVED, kind: 'failure', operation: 'save-pdf' });
        return;
      }
      this.saved.set(key, target);
      post({ type: 'deck/pdf-saved', name });
    } finally {
      this.running.delete(key);
      if (folder) await fs.promises.rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** The bar's Show in folder: the PDF this deck saved last, if it is still there. */
  async show(document: vscode.TextDocument): Promise<void> {
    const file = this.saved.get(normalizeForCompare(document.uri.fsPath));
    if (!file) return;
    if (!(await fs.promises.stat(file).then(info => info.isFile(), () => false))) return;
    await this.deps.reveal(file);
  }
}
