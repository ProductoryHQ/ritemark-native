/**
 * Sprint 161: the one renderer of a block slide (format v2), Markdown to static HTML. The strip's thumbnails, the
 * stage while it is read-only, the wall, the presenter view, the Slide library panel and the published handout page
 * all draw a block slide with it, so they never disagree (sprint plan, decision 4). `slide/slide.css` draws it.
 *
 *  - A scoped `marked` v9 instance (`gfm`, `breaks`), never the global one and never the document editor's, with the
 *    `:::` tokenizer (`fencedDiv.ts`) for Columns, Boxes and Steps.
 *  - Raw HTML never draws: a comment, a `<mark>` and any tag are left out (their words stay, as text tokens around
 *    them). Links draw as their words; nothing on a slide navigates.
 *  - Pictures: a relative path is drawn through `pictureUrl` (the deck view's webview URI, the page's file beside
 *    it), or as an empty place; a web address is never loaded. A picture alone in a paragraph is a block of its own,
 *    as the editor's image node is (`preprocessImageHTML`), so the parity test sees the same outline.
 *
 * Pure: no DOM, no `vscode`. The host's page and the webview import this one file.
 */
import { Marked, Tokenizer, type Token, type Tokens } from 'marked';
import { EXERCISE_TAG, isBlockSlide, sidePictureOf, type SlideData } from '../deckFormat';
import { isRelativeTarget } from '../deckLibraryFormat';
import type { DeckTheme, LogoOn, LogoPlace } from '../deckTheme';
import { themeStyle } from '../../../webview/src/components/decks/theme/themeVars';
import { slideIcon } from '../../../webview/src/components/decks/slide/iconSet';
import { iconSvg, isPageIconName } from '../../../webview/src/components/decks/slide/pageIcons';
import { OWN_MARK_LOOKS, boxesDrawnAttributes, columnsDrawnAttributes, fencedDivStart, isRevealWrapperAttrs, revealsOne, scanFencedDiv, slideBlockClassOf, type FenceAttributes } from './fencedDiv';
import { tableHasWidths, widthsOf } from '../../markdown/tableWidths';
import { lookOf, pictureBlockTokenizer, pictureMarkup, readSideFocus, type ImageTokenWithLook } from '../../markdown/pictureLook';
import { agendaHtml, isAgendaClasses, type AgendaDrawing, type AgendaEntry } from './agenda';

export { sidePictureOf };

/** The slide's canvas, as the v1 slide's (`layoutSlide`). */
export const BLOCK_CANVAS_WIDTH = 960;
export const BLOCK_CANVAS_HEIGHT = 540;

/**
 * The fit (spike §5): every size on a block slide is an `em` of one `--fit`, stepped down while the words overflow,
 * 100 / 92 / 84 / 76 / 68 / 60 %. The step is measured where the slide is drawn and sent to the page at Publish.
 */
export const BLOCK_FIT_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6] as const;
export const BLOCK_MAX_STEP = BLOCK_FIT_STEPS.length - 1;

export function fitOf(step: number | undefined): number {
  const index = Math.max(0, Math.min(BLOCK_MAX_STEP, Math.round(step ?? 0)));
  return BLOCK_FIT_STEPS[index];
}

/** Escape text and attribute values: `&`, `<`, `>`, and both quotes. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

/** A picture's path as written in Markdown, its `%20`s read back, so the deck view and the page look it up one way. */
export function picturePathOf(href: string): string {
  try {
    return decodeURI(href.trim());
  } catch {
    return href.trim();
  }
}


interface SlideDivToken {
  type: 'slideDiv';
  raw: string;
  attrs: FenceAttributes;
  tokens: Token[];
}

/** The renderer's state while one slide is drawn: where pictures come from, and the Boxes look a box is under. */
interface RenderState {
  pictureUrl: (path: string) => string | null;
  /** 17 November: a picture whose file the host didn't find: drawn as missing, with its file's name. */
  missing: (path: string) => boolean;
  looks: string[];
  /** The decks README, small details 14: the deck's sections an Agenda block lists, and the slide's place for Present. */
  agenda: AgendaDrawing | null;
  at: number | null;
  /**
   * README item 18: the items of One by one blocks, numbered from 0 across the slide as they are drawn
   * (`data-reveal-item`); in Present, those from `shown` on are drawn hidden (`data-reveal-hidden`), each in its place.
   * `shown` null: every item shows (the editor, the strip, the handout, the page, print).
   */
  reveal: { next: number; shown: number | null };
  /** The `:::` blocks being drawn, innermost last: a box or a column is an item when its block reveals. */
  parents: Array<{ kind: string | null; reveal: boolean }>;
}

const freshState = (): RenderState => ({ pictureUrl: () => null, missing: () => false, looks: [], agenda: null, at: null, reveal: { next: 0, shown: null }, parents: [] });

let state: RenderState = freshState();

/** A picture's file name, from the path the slide names. */
export function pictureFileName(path: string): string {
  return path.replace(/[?#].*$/, '').split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** The missing picture's words: "Picture not found" over its file's name (escaped here). The stage draws the same. */
export function missingHtml(path: string): string {
  return `<span class="blk-missing"><span class="blk-missing-head">Picture not found</span><span class="blk-missing-name">${esc(pictureFileName(path))}</span></span>`;
}


/** The pill over a Steps block: its `tag`, "Exercise" when it has none, and no pill for an empty one (#752's rule). */
export function stepsTagOf(attrs: FenceAttributes): string {
  const tag = attrs.values.tag ?? EXERCISE_TAG;
  return tag.trim() ? tag : '';
}

/** Drawn attributes as HTML, escaped. */
function drawnAttributes(attributes: Record<string, string>): string {
  return Object.entries(attributes).map(([name, value]) => ` ${name}="${esc(value)}"`).join('');
}

/**
 * A Columns block's columns' attributes, for its grid (a column's `width`), or null when it holds anything drawn other
 * than columns (the widths would then fall on the wrong tracks; it is drawn even).
 */
function columnChildren(token: SlideDivToken): FenceAttributes[] | null {
  const columns: FenceAttributes[] = [];
  for (const child of token.tokens) {
    if (child.type === 'space' || isCommentBlock(child)) continue;
    const div = child as unknown as SlideDivToken;
    if (child.type !== 'slideDiv' || slideBlockClassOf(div.attrs) !== 'column') return null;
    columns.push(div.attrs);
  }
  return columns;
}

/** A list's reveal wrapper: `incremental` (or `reveal="one"`) around one list and nothing else drawn. */
export function isRevealListToken(token: { attrs: FenceAttributes; tokens: Token[] }): boolean {
  if (!isRevealWrapperAttrs(token.attrs)) return false;
  const drawn = token.tokens.filter(child => child.type !== 'space' && !isCommentBlock(child));
  // A bullet or numbered list, as the slide editor's bar reads it (`revealWrappedList`): never a task list.
  return drawn.length === 1 && drawn[0].type === 'list' && !(drawn[0] as Tokens.List).items.some(item => item.task);
}

/** The next item of a One by one block: its number, and hidden while Present hasn't shown it yet. */
function revealItemAttributes(): string {
  const index = state.reveal.next++;
  const hidden = state.reveal.shown !== null && index >= state.reveal.shown;
  return ` data-reveal-item="${index}"${hidden ? ' data-reveal-hidden=""' : ''}`;
}

/**
 * The items of the first list drawn in `html` (its own `<li>`s, never a nested list's), marked as a block's items; with
 * `only`, the first top-level list of that kind (a Steps block's steps are its numbered list, whatever stands before it).
 */
function markListItems(html: string, only?: 'ol'): string {
  let depth = 0;
  let marking = false;
  let done = false;
  // The renderer's own markup: every word in it is escaped, so a tag here is one it drew.
  return html.replace(/<(\/?)(ul|ol|li)\b([^>]*)>/g, (tag, close: string, name: string, rest: string) => {
    if (done) return tag;
    if (name === 'li') return marking && !close && depth === 1 ? `<li${revealItemAttributes()}${rest}>` : tag;
    if (close) {
      depth -= 1;
      if (marking && depth === 0) done = true;
    } else {
      if (depth === 0 && (!only || name === only)) marking = true;
      depth += 1;
    }
    return tag;
  });
}

function divHtml(token: SlideDivToken, inner: () => string): string {
  // The Agenda (small details 14): drawn from the deck, never from what the block holds (nothing, as `/Agenda` writes it).
  if (isAgendaClasses(token.attrs.classes)) return agendaHtml(state.agenda, state.at);
  const kind = slideBlockClassOf(token.attrs);
  const parent = state.parents[state.parents.length - 1];
  // README item 18: a block set to One by one, never one inside another such block (its items arrive whole).
  const insideReveal = state.parents.some(entry => entry.reveal);
  const listWrapper = !insideReveal && kind === null && isRevealListToken(token);
  const reveals = listWrapper || (!insideReveal && (kind === 'boxes' || kind === 'steps' || kind === 'columns') && revealsOne(token.attrs));
  const revealMark = reveals ? ' data-reveal="one"' : '';
  // A box of a revealing Boxes block and a column of a revealing Columns block are its items.
  const item = parent?.reveal && ((kind === 'box' && parent.kind === 'boxes') || (kind === 'column' && parent.kind === 'columns')) ? revealItemAttributes() : '';
  const within = () => {
    state.parents.push({ kind, reveal: reveals });
    try {
      return inner();
    } finally {
      state.parents.pop();
    }
  };
  switch (kind) {
    case 'columns':
      return `<div class="blk-columns"${drawnAttributes(columnsDrawnAttributes(token.attrs, columnChildren(token)))}${revealMark}>${within()}</div>\n`;
    case 'column':
      return `<div class="blk-${kind}"${item}>${within()}</div>\n`;
    case 'boxes': {
      const look = token.attrs.values.look ?? 'boxes';
      state.looks.push(look);
      try {
        const boxes = token.tokens.filter(child => child.type === 'slideDiv' && slideBlockClassOf((child as unknown as SlideDivToken).attrs) === 'box').length;
        return `<div class="blk-boxes" data-look="${esc(look)}"${drawnAttributes(boxesDrawnAttributes(token.attrs, boxes))}${revealMark}>${within()}</div>\n`;
      } finally {
        state.looks.pop();
      }
    }
    case 'box': {
      const look = state.looks[state.looks.length - 1] ?? 'boxes';
      let mark = '';
      if (look === 'arrows') mark = `<span class="blk-mark">${iconSvg('arrow-right', 20)}</span>`;
      else if (!OWN_MARK_LOOKS.has(look)) {
        const name = slideIcon(token.attrs.values.icon)?.phosphor;
        if (name && isPageIconName(name)) mark = `<span class="blk-icon">${iconSvg(name, 28)}</span>`;
      }
      return `<div class="blk-box"${item}>${mark}${within()}</div>\n`;
    }
    case 'steps': {
      const tag = stepsTagOf(token.attrs);
      const body = within();
      return `<div class="blk-steps"${revealMark}>${tag ? `<span class="blk-pill">${esc(tag)}</span>` : ''}${reveals ? markListItems(body, 'ol') : body}</div>\n`;
    }
    default: {
      const body = within();
      // A list's reveal wrapper is drawn as the list is: a plain block around it, of the list's own size (slide.css).
      return `<div class="blk-group"${revealMark}>${listWrapper ? markListItems(body) : body}</div>\n`;
    }
  }
}

/**
 * A picture: drawn from beside the deck, or its empty place. Never loaded from the web. Experience 49: its size, place
 * in the column, crop and caption from the block after it (`pictureLook.ts`), drawn as the editors draw them.
 */
function pictureHtml(href: string, text: string, block?: string): string {
  const path = picturePathOf(href);
  const relative = isRelativeTarget(path);
  const url = relative ? state.pictureUrl(path) : null;
  if (url) return pictureMarkup(`<img class="blk-pic" src="${esc(url)}" alt="${text}">`, lookOf(block), { frameClass: 'blk-pic', caption: text });
  // A picture whose file is gone says so, with its name, rather than leaving an empty place (17 November).
  if (relative && state.missing(path)) return `<span class="blk-pic empty is-missing">${missingHtml(path)}</span>`;
  return '<span class="blk-pic empty"></span>';
}

/** Build a renderer instance: the slide's scoped `marked` with the `:::` blocks and the slide's own rules. */
/**
 * marked's tokenizer, except that an inline `<code>`, `<pre>`, `<kbd>` or `<script>` never puts it in its raw mode,
 * where it hands the text after the tag on unescaped (the security review of #760: `<kbd> <img/src=x onerror=…>` drew a
 * live tag; the handout's `handoutTokenizer` has the same guard since Sprint 159's PR 3).
 */
function slideTokenizer(): Tokenizer {
  const tokenizer = new Tokenizer();
  const tag = tokenizer.tag;
  tokenizer.tag = function (this: Tokenizer, src: string) {
    const token = tag.call(this, src);
    this.lexer.state.inRawBlock = false;
    return token;
  };
  return tokenizer;
}

function createSlideMarked(): Marked {
  const instance = new Marked({ gfm: true, breaks: true, tokenizer: slideTokenizer() });
  instance.use({
    extensions: [{
      // Experience 48: a table with column widths (its delimiter row's dashes, `tableWidths.ts`) is drawn at the slide's
      // width with those shares; any other table exactly as marked draws it.
      name: 'table',
      renderer(this: { parser: { parseInline: (tokens: Token[]) => string; renderer: { tablecell: (content: string, flags: { header: boolean; align: 'center' | 'left' | 'right' | null }) => string; tablerow: (content: string) => string; table: (header: string, body: string) => string } } }, token) {
        const table = token as Tokens.Table;
        const parser = this.parser;
        let cells = '';
        for (let col = 0; col < table.header.length; col++) cells += parser.renderer.tablecell(parser.parseInline(table.header[col].tokens), { header: true, align: table.align[col] });
        const header = parser.renderer.tablerow(cells);
        let body = '';
        for (const row of table.rows) {
          cells = '';
          for (let col = 0; col < row.length; col++) cells += parser.renderer.tablecell(parser.parseInline(row[col].tokens), { header: false, align: table.align[col] });
          body += parser.renderer.tablerow(cells);
        }
        const html = parser.renderer.table(header, body);
        const delimiter = table.raw.split('\n')[1] ?? '';
        const widths = tableHasWidths(table.raw) ? widthsOf(delimiter, true, table.header.length) : null;
        if (!widths) return html;
        const group = `<colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup>`;
        return html.replace(/^<table>\n?/, `<table class="has-widths" style="width:100%">\n${group}\n`);
      },
    }, pictureBlockTokenizer, {
      // Experience 49: a picture with the attribute block after it is drawn with its look.
      name: 'image',
      renderer(token) {
        const image = token as unknown as ImageTokenWithLook;
        return pictureHtml(image.href, image.text, image.picture);
      },
    }, {
      // Experience 49: a picture alone in its paragraph (its attribute block beside it) is a block of its own, decided
      // from the tokens, so a look's markup never has to be read back (review of #774). Any other paragraph: as before.
      name: 'paragraph',
      renderer(this: { parser: { parseInline: (tokens: Token[]) => string } }, token) {
        const paragraph = token as Tokens.Paragraph;
        if (!isAlonePicture(paragraph)) return false;
        return `${this.parser.parseInline(paragraph.tokens ?? []).trim()}\n`;
      },
    }, {
      name: 'slideDiv',
      level: 'block',
      start: fencedDivStart,
      tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: Token[]) => Token[] } }, src: string) {
        const scan = scanFencedDiv(src);
        if (!scan) return undefined;
        // The Agenda draws from the deck: what someone wrote between its lines is kept in the file and never read, so no
        // picture or Steps block in it reaches the page (as the slide editor keeps it: `slideEditorMarkdown`).
        if (isAgendaClasses(scan.attrs.classes)) return { type: 'slideDiv', raw: scan.raw, attrs: scan.attrs, tokens: [] } as SlideDivToken;
        return { type: 'slideDiv', raw: scan.raw, attrs: scan.attrs, tokens: this.lexer.blockTokens(scan.inner.replace(/^\n+/, ''), []) } as SlideDivToken;
      },
      renderer(this: { parser: { parse: (tokens: Token[]) => string } }, token) {
        const div = token as unknown as SlideDivToken;
        return divHtml(div, () => this.parser.parse(div.tokens));
      },
      childTokens: ['tokens'],
    }],
    renderer: {
      // The slide draws no raw HTML: a comment, an anchored comment's `<mark>`, any tag. Their words are text tokens.
      html: () => '',
      // A second guard: a `<` that still came through raw never opens a tag. Entities stay as they are.
      text: (text: string) => text.replace(/</g, '&lt;'),
      link: (_href: string, _title: string | null | undefined, text: string) => `<span class="blk-link">${text}</span>`,
      image: (href: string, _title: string | null, text: string) => pictureHtml(href, text),
      paragraph: (text: string) => {
        // A picture alone in its paragraph is a block of its own, as the editor's image node is.
        if (/^\s*(?:<img class="blk-pic" [^>]*>|<span class="blk-pic empty"><\/span>|<span class="blk-pic empty is-missing"><span class="blk-missing">(?:<span class="blk-missing-(?:head|name)">[^<]*<\/span>){2}<\/span><\/span>)\s*$/.test(text)) return `${text.trim()}\n`;
        return `<p>${text}</p>\n`;
      },
    },
  });
  return instance;
}

const slideMarked = createSlideMarked();

/** A block slide's Markdown as tokens, read the one way the renderer reads it. */
export function lexBlockSlide(markdown: string): Token[] {
  return slideMarked.lexer(markdown);
}

/**
 * An HTML block that holds only comments (and space): a standalone comment note, which the slide never draws. A slide
 * comment on a block or on the whole slide is one (Sprint 161, `slideComments.ts`).
 */
export function isCommentBlock(token: Token): boolean {
  return token.type === 'html' && /^\s*(?:<!--[\s\S]*?-->\s*)+$/.test(token.raw);
}

/**
 * The blocks a slide draws, at its top level: no blank space, and no comment note, so a comment never changes how a
 * slide is drawn (a title-only slide with a comment is still drawn big and low).
 */
function drawnBlocksOf(markdown: string): Token[] {
  return lexBlockSlide(markdown).filter(token => token.type !== 'space' && !isCommentBlock(token));
}

const picturePathsCache = new Map<string, string[]>();

/** The relative pictures a block slide's Markdown names, as the renderer asks `pictureUrl` for them. */
export function blockPicturePaths(markdown: string): string[] {
  const cached = picturePathsCache.get(markdown);
  if (cached) return cached;
  if (picturePathsCache.size > 500) picturePathsCache.clear();
  const found = new Set<string>();
  slideMarked.walkTokens(lexBlockSlide(markdown), token => {
    if (token.type === 'image') {
      const path = picturePathOf((token as Tokens.Image).href);
      if (isRelativeTarget(path)) found.add(path);
    }
  });
  const paths = [...found];
  picturePathsCache.set(markdown, paths);
  return paths;
}

/** Every picture a slide names: its `image:` line and, for a block slide, the pictures in its Markdown. */
export function slidePicturePaths(data: SlideData): string[] {
  const paths = data.markdown ? blockPicturePaths(data.markdown) : [];
  return data.image ? [data.image, ...paths] : paths;
}

/**
 * A slide that is only a title, with at most a line under it or a short line over it (a section's number), is drawn
 * big and low, as the old Title, Section and Statement slides are (README: "Title, Section and Statement keep their big
 * type as a title-only slide").
 */
const coverCache = new Map<string, boolean>();

export function isCoverSlide(markdown: string): boolean {
  const cached = coverCache.get(markdown);
  if (cached !== undefined) return cached;
  if (coverCache.size > 500) coverCache.clear();
  const cover = coverOf(markdown);
  coverCache.set(markdown, cover);
  return cover;
}

/** A paragraph that is one picture with a look (its attribute block, experience 49) and nothing else but space. */
function isAlonePicture(paragraph: Tokens.Paragraph): boolean {
  const parts = (paragraph.tokens ?? []).filter(token => !(token.type === 'text' && !token.raw.trim()) && token.type !== 'br');
  return parts.length === 2 && parts[0].type === 'image' && parts[1].type === 'pictureBlock';
}

/** A paragraph that holds only pictures (and space): the renderer draws it as a Picture block. */
function isPictureParagraph(paragraph: Tokens.Paragraph): boolean {
  // A picture's attribute block (experience 49) is the picture's own.
  const parts = (paragraph.tokens ?? []).filter(token => !(token.type === 'text' && !token.raw.trim()) && token.type !== 'br' && token.type !== 'pictureBlock');
  return parts.length > 0 && parts.every(token => token.type === 'image');
}

function coverOf(markdown: string): boolean {
  const blocks = drawnBlocksOf(markdown);
  const isTitle = (token: Token | undefined) => token?.type === 'heading' && (token as Tokens.Heading).depth === 1;
  // A picture alone in its paragraph is a Picture block, never a line: a title over a picture is no cover, so the
  // picture can't push the title up and off the slide (17 November, Jarmo's shot).
  const isLine = (token: Token | undefined) => (token?.type === 'paragraph' && !isPictureParagraph(token as Tokens.Paragraph)) || (token?.type === 'heading' && (token as Tokens.Heading).depth === 2);
  if (blocks.length === 1) return isTitle(blocks[0]);
  if (blocks.length === 2) return (isTitle(blocks[0]) && isLine(blocks[1])) || (blocks[0].type === 'paragraph' && !isPictureParagraph(blocks[0] as Tokens.Paragraph) && (blocks[0] as Tokens.Paragraph).text.length <= 12 && isTitle(blocks[1]));
  return false;
}

const sectionCache = new Map<string, string | null>();

/**
 * PR 2: a block slide drawn as a section, the way an old Section slide converts (`legacyToBlocks`): a short first line
 * (its number) over its title, and nothing else. Its number ('' for none), or null for any other slide. The page draws
 * such a slide's part as a divider, as it drew a Section slide's. Read once per Markdown (the Agenda asks for every slide).
 */
export function blockSectionNumberOf(markdown: string): string | null {
  if (sectionCache.has(markdown)) return sectionCache.get(markdown) ?? null;
  if (sectionCache.size > 500) sectionCache.clear();
  const number = sectionNumberOfBlocks(markdown);
  sectionCache.set(markdown, number);
  return number;
}

function sectionNumberOfBlocks(markdown: string): string | null {
  const blocks = drawnBlocksOf(markdown);
  if (blocks.length !== 2 || blocks[0].type !== 'paragraph' || blocks[1].type !== 'heading' || (blocks[1] as Tokens.Heading).depth !== 1) return null;
  const number = (blocks[0] as Tokens.Paragraph).text.replace(/\\(.)/g, '$1').trim();
  // A section's number: digits (1, 2.1), a letter or a Roman numeral, never a word over a title ("Productory").
  return /^(?:\d{1,3}(?:\.\d{1,3})*|[A-Za-z]|[IVXLC]{1,6})[.)]?$/.test(number) ? number : null;
}


const stepsCache = new Map<string, string | null>();

/**
 * The pill of a block slide's first Steps block ('' for none), or null when it has no Steps block: a slide with Steps
 * is an exercise on the page, as an Exercise slide is. Read once per Markdown.
 */
export function blockStepsTagOf(markdown: string): string | null {
  if (stepsCache.has(markdown)) return stepsCache.get(markdown) ?? null;
  if (stepsCache.size > 500) stepsCache.clear();
  let found: string | null = null;
  const visit = (tokens: Token[]) => {
    for (const token of tokens) {
      if (found !== null) return;
      if (token.type !== 'slideDiv') continue;
      const div = token as unknown as SlideDivToken;
      if (div.attrs.classes.includes('steps')) { found = stepsTagOf(div.attrs); return; }
      visit(div.tokens);
    }
  };
  visit(lexBlockSlide(markdown));
  stepsCache.set(markdown, found);
  return found;
}

const agendaCache = new Map<string, boolean>();

/** Does a block slide hold an Agenda block (at any level, outside code)? Read once per Markdown. */
export function blockHasAgenda(markdown: string): boolean {
  if (!markdown.includes(':::')) return false;
  const cached = agendaCache.get(markdown);
  if (cached !== undefined) return cached;
  if (agendaCache.size > 500) agendaCache.clear();
  let found = false;
  slideMarked.walkTokens(lexBlockSlide(markdown), token => {
    if (token.type === 'slideDiv' && isAgendaClasses((token as unknown as SlideDivToken).attrs.classes)) found = true;
  });
  agendaCache.set(markdown, found);
  return found;
}

/**
 * A section slide, as the page draws its band: an old Section slide, or a block slide whose header says
 * `section: true` or that is drawn as one (a short number over its title, `blockSectionNumberOf`).
 */
export function isSectionSlide(kind: string, data: SlideData): boolean {
  if (kind === 'section') return true;
  if (!isBlockSlide(kind)) return false;
  return data.section === true || blockSectionNumberOf(data.markdown ?? '') !== null;
}

/**
 * The Agenda's list (small details 14): the deck's section slides that aren't skipped, in order, by title (a section
 * with no title by its number, "Section 2"), each with its slide's place in the deck (from 1, skipped slides counted
 * unless `number` says otherwise). The deck view, the wall and the page each give it the slides they draw.
 */
export function agendaOf(slides: ReadonlyArray<{ kind: string; data: SlideData; number?: number }>): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  slides.forEach((slide, index) => {
    if (slide.data.skip === true || !isSectionSlide(slide.kind, slide.data)) return;
    const title = (slide.data.title ?? '').trim();
    const sectionNumber = isBlockSlide(slide.kind) ? blockSectionNumberOf(slide.data.markdown ?? '') : (slide.data.number ?? '').trim();
    entries.push({ title: title || `Section${sectionNumber ? ` ${sectionNumber}` : ''}`, number: slide.number ?? index + 1 });
  });
  return entries;
}

/** One key for an agenda's list, so a view draws again only when the list itself changes. */
export function agendaKey(entries: readonly AgendaEntry[]): string {
  return entries.map(entry => `${entry.number}\u0000${entry.title}`).join('\u0001');
}

/** What a block slide is drawn with besides its words: its pictures, and the deck around an Agenda block. */
export interface BlockDrawingContext {
  pictureUrl?: (path: string) => string | null;
  missing?: (path: string) => boolean;
  /** The deck's sections, for an Agenda block (none: an Agenda draws nothing). */
  agenda?: AgendaDrawing | null;
  /** The slide's place in the deck (from 1), in Present only: an Agenda marks the sections passed and the next one. */
  at?: number | null;
  /**
   * README item 18, in Present only: how many items of the slide's One by one blocks show (of `blockRevealCount`); the
   * rest are drawn hidden, in their places. Left out: every item shows.
   */
  reveal?: number | null;
}

/** A block slide's Markdown as the slide's inner HTML (the flow's children). */
export function blockSlideHtml(markdown: string, options: BlockDrawingContext = {}): string {
  const previous = state;
  const shown = typeof options.reveal === 'number' && Number.isFinite(options.reveal) ? Math.max(0, Math.floor(options.reveal)) : null;
  state = { ...freshState(), pictureUrl: options.pictureUrl ?? (() => null), missing: options.missing ?? (() => false), agenda: options.agenda ?? null, at: options.at ?? null, reveal: { next: 0, shown } };
  try {
    return slideMarked.parse(markdown, { async: false }) as string;
  } finally {
    state = previous;
  }
}

const revealCountCache = new Map<string, number>();

/**
 * README item 18: how many items a block slide's One by one blocks hold together (0: none, the slide shows whole), as
 * the renderer numbers them, so Present's steps and the drawing never disagree. Read once per Markdown.
 */
export function blockRevealCount(markdown: string): number {
  if (!markdown.includes(':::')) return 0;
  const cached = revealCountCache.get(markdown);
  if (cached !== undefined) return cached;
  if (revealCountCache.size > 500) revealCountCache.clear();
  const previous = state;
  state = freshState();
  let count = 0;
  try {
    slideMarked.parse(markdown, { async: false });
    count = state.reveal.next;
  } finally {
    state = previous;
  }
  revealCountCache.set(markdown, count);
  return count;
}

export interface BlockSlideMarkupOptions {
  theme: DeckTheme;
  borderless: boolean;
  /** The fit's step (0–5), as the drawing view measured it. */
  step?: number;
  /** A picture's address, by the path the slide names; null draws its empty place. */
  pictureUrl?: (path: string) => string | null;
  /** 17 November: a picture the host looked for and didn't find, drawn as missing with its name (the deck view only;
   *  the page never says so). */
  missing?: (path: string) => boolean;
  /** The slide's width: the slide gets its size and the canvas its scale. Without it the page scales the canvas. */
  width?: number;
  /** The theme's `--s-*` properties on the slide (the page sets them once for every slide). */
  inlineTheme?: boolean;
  /** Sprint 162 PR 4: the theme's logo; `blockSlideMarkup` takes it from the theme when it isn't given. */
  logo?: SlideLogo | null;
  /** Small details 14: the deck's sections, for an Agenda block, and the slide's place in Present. */
  agenda?: AgendaDrawing | null;
  at?: number | null;
}

const kebab = (key: string) => (key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));

function styleText(style: Record<string, string | number>): string {
  return Object.entries(style).map(([key, value]) => `${kebab(key)}:${typeof value === 'number' ? `${value}px` : value}`).join(';');
}


// ------------------------------------------------------------------ the theme's logo (Sprint 162 PR 4)

/** A theme's logo as a slide draws it: its address, its corner, and where it shows. */
export interface SlideLogo {
  url: string;
  place: LogoPlace;
  on: LogoOn;
  /** Its width on the 960 × 540 canvas: 26 px high, so 26 × its width to height, at most 190 (`LOGO_MAX_WIDTH`). */
  width: number;
}

/** The logo's height and widest on the canvas (the prototype's `.slogo`, `slide.css` `.slide-logo`). */
export const LOGO_HEIGHT = 26;
export const LOGO_MAX_WIDTH = 190;
/** The room kept between a top-right logo and a slide's first block (the Experience lead, 18 November). */
export const LOGO_CLEARANCE = 16;
/** How far the logo's right edge sits from the slide's (30 px) and the words' right edge sits from it (64 px). */
const LOGO_RIGHT = 30;
const FLOW_RIGHT = 64;

/**
 * The right margin a slide's first block gets beside a top-right logo, so a long title never runs under it (the
 * Experience lead, 18 November): the logo's width and 16 px, measured from the words' own right edge. The logo sits
 * in the slide's top margin (22 to 48 px), and a title's first line starts at 46 px, whose accents (Õ, Ä) reach above
 * it, so a title that ran to the right edge would touch it.
 */
export function logoTitleMargin(logo: Pick<SlideLogo, 'width'>): number {
  return Math.max(0, Math.ceil(logo.width + LOGO_CLEARANCE + LOGO_RIGHT - FLOW_RIGHT));
}

/** The room kept between a top-left or bottom-right logo and the words, beside its height (the Experience lead). */
export const LOGO_GAP = 12;
/** The words' top and bottom edges on the canvas (`slide.css` `.blk-flow`: 46 px from the top, 34 from the bottom). */
export const FLOW_TOP = 46;
export const FLOW_BOTTOM = 34;

/** How much lower a slide's words start beside a top-left logo, and how much higher they end above a bottom-right one. */
export function logoDrop(): number {
  return LOGO_HEIGHT + LOGO_GAP;
}

/**
 * The canvas's class and style for the room the logo keeps on this slide ("never touch", the Experience lead, step-3-themes.md,
 * 18 November), only on a slide that shows it; the fit then makes the room:
 *  - top right (`.logo-tr`): the first block ends the logo's width and 16 px short of it, on every slide but a title
 *    slide (its words sit low);
 *  - top left (`.logo-tl`): the words start lower by the logo's height and 12 px (38 px), so every line keeps its left edge;
 *  - bottom right (`.logo-br`): the words end higher by the same.
 */
export function logoCanvasMarks(logo: SlideLogo | null | undefined, cover: boolean): { cls: string; style: Record<string, string> } {
  if (!drawsLogo(logo, cover)) return { cls: '', style: {} };
  if (logo.place === 'top-right') return cover ? { cls: '', style: {} } : { cls: 'logo-tr', style: { '--logo-room': `${logoTitleMargin(logo)}px` } };
  return { cls: logo.place === 'top-left' ? 'logo-tl' : 'logo-br', style: { '--logo-drop': `${logoDrop()}px` } };
}

/** The theme's logo to draw, or null: a theme with no logo, or whose picture has no address (a missing file). */
export function themeSlideLogo(theme: Pick<DeckTheme, 'logo' | 'logoUrl' | 'logoAspect'> | null | undefined): SlideLogo | null {
  if (!theme?.logo || !theme.logoUrl) return null;
  const aspect = theme.logoAspect;
  const width = aspect && aspect > 0 ? Math.min(LOGO_MAX_WIDTH, LOGO_HEIGHT * aspect) : LOGO_MAX_WIDTH;
  return { url: theme.logoUrl, place: theme.logo.place, on: theme.logo.on, width: Math.round(width * 100) / 100 };
}

/**
 * Does this slide draw the logo? Every slide, or with "the title slides only" a title slide: one drawn big and low,
 * its title alone (`isCoverSlide`; an old Title or Section slide is one).
 */
export function drawsLogo(logo: SlideLogo | null | undefined, cover: boolean): logo is SlideLogo {
  return !!logo && (logo.on === 'every-slide' || cover);
}

/**
 * The logo's markup, in its corner of the slide's 960 × 540 canvas (the 16:9 area, so the wall keeps it there, #779).
 * Always an `<img>`: an SVG logo is never put into the page as markup, so nothing in it runs or loads (`slide.css`
 * `.slide-logo`).
 */
export function slideLogoHtml(logo: SlideLogo | null | undefined, cover: boolean): string {
  if (!drawsLogo(logo, cover)) return '';
  return `<img class="slide-logo is-${logo.place}" src="${esc(logo.url)}" alt="" draggable="false">`;
}

/**
 * A block slide's canvas (its `.deck-sl`, 960 × 540, scaled to `width` when given): the picture beside or behind, and
 * the flow of its blocks at the fit's step. The deck view's `BlockSlideCanvas` puts it in its own `.deck-slide`.
 */
export function blockCanvasMarkup(data: SlideData, options: Pick<BlockSlideMarkupOptions, 'step' | 'pictureUrl' | 'missing' | 'width' | 'logo' | 'agenda' | 'at'> & { reveal?: number | null }): string {
  const pictureUrl = options.pictureUrl ?? (() => null);
  const missing = options.missing ?? (() => false);
  const markdown = data.markdown ?? '';
  const side = sidePictureOf(data);
  const inner: Record<string, string | number> = {};
  if (options.width !== undefined) inner.transform = `scale(${options.width / BLOCK_CANVAS_WIDTH})`;
  let photo = '';
  if (side) {
    const path = data.image?.trim();
    const url = path ? pictureUrl(path) : null;
    // Experience 49: the side picture fills its place around its focus point (`focus: x,y`), the middle by default.
    const focus = readSideFocus(data.focus);
    const position = focus ? `;background-position:${focus.x}% ${focus.y}%` : '';
    const background = url ? ` style="background-image:url(&quot;${esc(url.replace(/"/g, '%22'))}&quot;)${position}"` : '';
    const gone = !url && !!path && missing(path);
    photo = `<div class="photo${url ? '' : ' empty'}${gone ? ' is-missing' : ''}"${background}>${gone ? missingHtml(path) : ''}</div>${side === 'behind' ? '<div class="veil"></div>' : ''}`;
  }
  const cover = isCoverSlide(markdown);
  const marks = logoCanvasMarks(options.logo, cover);
  Object.assign(inner, marks.style);
  const classes = ['deck-sl', 'is-blocks', side ? `pic-${side}` : '', cover ? 'is-cover' : '', marks.cls].filter(Boolean).join(' ');
  const innerStyle = styleText(inner);
  return `<div class="${classes}"${innerStyle ? ` style="${esc(innerStyle)}"` : ''} aria-hidden="true">${photo}`
    + `<div class="blk-flow" style="--fit:${fitOf(options.step)}">${blockSlideHtml(markdown, { pictureUrl, missing, agenda: options.agenda, at: options.at, reveal: options.reveal })}</div>`
    + `${slideLogoHtml(options.logo, cover)}</div>`;
}

/** One block slide, as every view draws it: the page puts this markup in; the deck view draws the same canvas. */
export function blockSlideMarkup(data: SlideData, options: BlockSlideMarkupOptions): string {
  const outer: Record<string, string | number> = {};
  if (options.width !== undefined) {
    outer.width = options.width;
    outer.height = Math.round(options.width * BLOCK_CANVAS_HEIGHT / BLOCK_CANVAS_WIDTH);
  }
  if (options.inlineTheme) Object.assign(outer, themeStyle(options.theme, options.borderless));
  const outerStyle = styleText(outer);
  return `<div class="deck-slide${options.borderless ? ' is-borderless' : ''}"${outerStyle ? ` style="${esc(outerStyle)}"` : ''}>`
    + blockCanvasMarkup(data, { ...options, logo: options.logo === undefined ? themeSlideLogo(options.theme) : options.logo }) + '</div>';
}
