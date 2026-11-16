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
import { EXERCISE_TAG, sidePictureOf, type SlideData } from '../deckFormat';
import { isRelativeTarget } from '../deckLibraryFormat';
import type { DeckTheme } from '../deckTheme';
import { themeStyle } from '../../../webview/src/components/decks/theme/themeVars';
import { slideIcon } from '../../../webview/src/components/decks/slide/iconSet';
import { iconSvg, isPageIconName } from '../../../webview/src/components/decks/slide/pageIcons';
import { OWN_MARK_LOOKS, fencedDivStart, scanFencedDiv, slideBlockClassOf, type FenceAttributes } from './fencedDiv';

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
  looks: string[];
}

let state: RenderState = { pictureUrl: () => null, looks: [] };


/** The pill over a Steps block: its `tag`, "Exercise" when it has none, and no pill for an empty one (#752's rule). */
export function stepsTagOf(attrs: FenceAttributes): string {
  const tag = attrs.values.tag ?? EXERCISE_TAG;
  return tag.trim() ? tag : '';
}

function divHtml(token: SlideDivToken, inner: () => string): string {
  const kind = slideBlockClassOf(token.attrs);
  switch (kind) {
    case 'columns':
    case 'column':
      return `<div class="blk-${kind}">${inner()}</div>\n`;
    case 'boxes': {
      const look = token.attrs.values.look ?? 'boxes';
      state.looks.push(look);
      try {
        return `<div class="blk-boxes" data-look="${esc(look)}">${inner()}</div>\n`;
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
      return `<div class="blk-box">${mark}${inner()}</div>\n`;
    }
    case 'steps': {
      const tag = stepsTagOf(token.attrs);
      return `<div class="blk-steps">${tag ? `<span class="blk-pill">${esc(tag)}</span>` : ''}${inner()}</div>\n`;
    }
    default:
      return `<div class="blk-group">${inner()}</div>\n`;
  }
}

/** A picture: drawn from beside the deck, or its empty place. Never loaded from the web. */
function pictureHtml(href: string, text: string): string {
  const path = picturePathOf(href);
  const url = isRelativeTarget(path) ? state.pictureUrl(path) : null;
  return url ? `<img class="blk-pic" src="${esc(url)}" alt="${text}">` : '<span class="blk-pic empty"></span>';
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
      name: 'slideDiv',
      level: 'block',
      start: fencedDivStart,
      tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: Token[]) => Token[] } }, src: string) {
        const scan = scanFencedDiv(src);
        if (!scan) return undefined;
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
        if (/^\s*(?:<img class="blk-pic" [^>]*>|<span class="blk-pic empty"><\/span>)\s*$/.test(text)) return `${text.trim()}\n`;
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

function coverOf(markdown: string): boolean {
  const blocks = lexBlockSlide(markdown).filter(token => token.type !== 'space');
  const isTitle = (token: Token | undefined) => token?.type === 'heading' && (token as Tokens.Heading).depth === 1;
  const isLine = (token: Token | undefined) => token?.type === 'paragraph' || (token?.type === 'heading' && (token as Tokens.Heading).depth === 2);
  if (blocks.length === 1) return isTitle(blocks[0]);
  if (blocks.length === 2) return (isTitle(blocks[0]) && isLine(blocks[1])) || (blocks[0].type === 'paragraph' && (blocks[0] as Tokens.Paragraph).text.length <= 12 && isTitle(blocks[1]));
  return false;
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

/** A block slide's Markdown as the slide's inner HTML (the flow's children). */
export function blockSlideHtml(markdown: string, options: { pictureUrl?: (path: string) => string | null } = {}): string {
  const previous = state;
  state = { pictureUrl: options.pictureUrl ?? (() => null), looks: [] };
  try {
    return slideMarked.parse(markdown, { async: false }) as string;
  } finally {
    state = previous;
  }
}

export interface BlockSlideMarkupOptions {
  theme: DeckTheme;
  borderless: boolean;
  /** The fit's step (0–5), as the drawing view measured it. */
  step?: number;
  /** A picture's address, by the path the slide names; null draws its empty place. */
  pictureUrl?: (path: string) => string | null;
  /** The slide's width: the slide gets its size and the canvas its scale. Without it the page scales the canvas. */
  width?: number;
  /** The theme's `--s-*` properties on the slide (the page sets them once for every slide). */
  inlineTheme?: boolean;
}

const kebab = (key: string) => (key.startsWith('--') ? key : key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));

function styleText(style: Record<string, string | number>): string {
  return Object.entries(style).map(([key, value]) => `${kebab(key)}:${typeof value === 'number' ? `${value}px` : value}`).join(';');
}


/**
 * A block slide's canvas (its `.deck-sl`, 960 × 540, scaled to `width` when given): the picture beside or behind, and
 * the flow of its blocks at the fit's step. The deck view's `BlockSlideCanvas` puts it in its own `.deck-slide`.
 */
export function blockCanvasMarkup(data: SlideData, options: Pick<BlockSlideMarkupOptions, 'step' | 'pictureUrl' | 'width'>): string {
  const pictureUrl = options.pictureUrl ?? (() => null);
  const markdown = data.markdown ?? '';
  const side = sidePictureOf(data);
  const inner: Record<string, string | number> = {};
  if (options.width !== undefined) inner.transform = `scale(${options.width / BLOCK_CANVAS_WIDTH})`;
  let photo = '';
  if (side) {
    const url = data.image ? pictureUrl(data.image.trim()) : null;
    const background = url ? ` style="background-image:url(&quot;${esc(url.replace(/"/g, '%22'))}&quot;)"` : '';
    photo = `<div class="photo${url ? '' : ' empty'}"${background}></div>${side === 'behind' ? '<div class="veil"></div>' : ''}`;
  }
  const classes = ['deck-sl', 'is-blocks', side ? `pic-${side}` : '', isCoverSlide(markdown) ? 'is-cover' : ''].filter(Boolean).join(' ');
  const innerStyle = styleText(inner);
  return `<div class="${classes}"${innerStyle ? ` style="${esc(innerStyle)}"` : ''} aria-hidden="true">${photo}`
    + `<div class="blk-flow" style="--fit:${fitOf(options.step)}">${blockSlideHtml(markdown, { pictureUrl })}</div></div>`;
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
    + blockCanvasMarkup(data, options) + '</div>';
}
