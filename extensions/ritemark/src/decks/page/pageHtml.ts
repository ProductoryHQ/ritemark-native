/**
 * Sprint 159 (technical plan §2.3): the handout page as the learner page draws it (experience 46's `learner.html`),
 * without its look toggle, made from `publicDeck`'s output and nothing else. One HTML file carrying its CSS, its
 * fonts, its icons and its one script; pictures stay separate files at the deck's relative paths, and so do the
 * theme's fonts beyond Sofia Sans (`fonts/`, Sprint 162 PR 3), which 2.2's gather finds in the page and sends under its
 * own rules.
 *
 *  - Nothing of Ritemark on it: the client and the session at the top, how far along it is, and Contents.
 *  - On a computer the slide stays on the left, centred, with arrows under it, and the text scrolls on the right; on a
 *    phone (below 860 px) the slide stays at the top and the text scrolls under it (`PAGE_CSS`, `pageScript.ts`).
 *  - Every slide is drawn here once (`slideMarkup`, the deck view's own drawing), so the page's script only shows and
 *    hides them: it sets no `src` or `href` and writes no HTML (2.2's `scriptBuildsReferences` stays false).
 *  - The handout's Markdown goes through `marked` with raw HTML escaped (comments and `<mark>` tags taken out first,
 *    again, after `publicDeck`), web links kept as links, links to project files shown as plain names, and pictures
 *    as relative paths. Every code block is a prompt with Copy, then Open in Claude and Open in ChatGPT (links to a new
 *    tab, `openInAddresses`; none for a deck with `open-in: none`); an Exercise slide's numbered steps and every task list
 *    get ticks; a Section slide is the grey band with "Section N" over its title.
 *
 * The theme's logo is a file beside the page too (`logos/`, Sprint 162 PR 4), drawn as an `<img>`, never as markup.
 *
 * An Agenda block (the decks README, small details 14) lists the page's section slides, with no progress.
 *
 * **The page prints as a handout** (small details 13), by its print rules alone (`PRINT_CSS`, `printOrderCss`): each
 * part's slide above its text, in the theme's fonts and colours, a part kept off two pages where it fits, prompts in
 * their box, and none of the bar, the arrows, Contents, Copy or the Open in links; the page's address in the footer.
 * The slides are the same layers the screen shows one at a time; print lays them out between the parts, so nothing of
 * the page is drawn twice.
 *
 * Pure: the slide CSS and the fonts come in as `PageAssets` (the host reads them, `pageAssets.ts`), and whether a
 * picture is there comes in as `pictureUrl`. The same input always gives the same bytes.
 */
import { createHash } from 'node:crypto';
import { Marked, marked, type Tokens } from 'marked';
import { tableHasWidths, widthsOf } from '../../markdown/tableWidths';
import { columnFloors, floorCss } from '../../markdown/tableColumns';
import { exerciseTagOf, isBlockSlide, type SlideData } from '../deckFormat';
import { isLineBreakTag } from '../blocks/lineBreakTag';
import { agendaOf, blockRevealCount, blockSectionNumberOf, blockSlideMarkup, blockStepsLabelOf } from '../blocks/slideRenderer';
import { isRelativeTarget } from '../deckLibraryFormat';
import { slideMarkup, escapeHtml } from '../../../webview/src/components/decks/slide/slideMarkup';
import { mix, themeStyle, themeVars, wallGround } from '../../../webview/src/components/decks/theme/themeVars';
import { groundOf } from '../deckTheme';
import { iconSvg } from '../../../webview/src/components/decks/slide/pageIcons';
import { MARKED_OPTIONS, lexHandout, type HandoutTabsToken, type PublicDeck, type PublicSlide } from './publicDeck';
import { lookOf, pictureBlockTokenizer, pictureMarkup, type ImageTokenWithLook } from '../../markdown/pictureLook';
import { PAGE_SCRIPT } from './pageScript';
import { OPEN_IN_HOSTS, OPEN_IN_MAX_ADDRESS, openInAddresses } from '../blocks/codeTools';
import { buttonHtml, buttonParagraphOf } from '../blocks/buttonBlock';

export { lexHandout };

export interface PageFont {
  /** The woff2 file's bytes, base64. */
  base64: string;
  unicodeRange: string;
}

/** One part of a theme font the page names as a file beside it (Sprint 162 PR 3, `pageFile.themeFontFiles`). */
export interface PageThemeFont {
  /** The font's family, one of the six (`deckTheme.DECK_FONT_LIST`). */
  family: string;
  unicodeRange: string;
  /** Its address beside the page: `fonts/Inter-4.001-latin.woff2`. */
  address: string;
}

export interface PageAssets {
  /** `slide/slide.css`: the slide's own rules, the deck view's. */
  slideCss: string;
  /** Sofia Sans, as the app's own fonts: latin and latin-ext. */
  fonts: PageFont[];
  /** The theme's other fonts, as files beside the page; none when the theme draws in Sofia Sans only. */
  themeFonts?: readonly PageThemeFont[];
  /**
   * Sprint 162 PR 4: the theme's logo as a file beside the page (`logos/logo-<hash>.svg`, `pageFile.pageLogoFile`),
   * drawn as an `<img>` in its corner of the slides it is on. None: no logo, or its file is missing.
   */
  logo?: { address: string; aspect?: number | null } | null;
}

export interface PageOptions {
  /** The page's digest (`deckDigest`), written in its `ritemark-deck` meta. */
  digest: string;
  /**
   * A picture's address on the page, by the path the deck writes (relative to the deck's folder, where the page is) and
   * where it writes it (`pictureFile`): null when it isn't a picture that is there, and then the slide draws its empty
   * place, as the deck view does.
   */
  pictureUrl: PictureUrl;
  /**
   * Sprint 163 PR 4: the deck's file name without `.deck.md`, used only hashed, in the reader's storage key for a deck with
   * no title of its own (`pageHtml`). Never on the page.
   */
  name?: string;
  /**
   * Sprint 170 PR 2 (#885): what the page prints. Left out, the page's own print (`PRINT_CSS`, A4 portrait, each slide
   * with its text: Save slides and handout as PDF). `'slides'`: Save slides as PDF's page (`SLIDES_PRINT_CSS`), one
   * 16:9 page a slide on the theme's ground, as on the wall. `'handout'` (PR 3, #886): Save handout as PDF's page, the
   * A4 print with the slides left out and each part under its number (`HANDOUT_PRINT_CSS`). Only these rules differ
   * from the page's.
   */
  print?: 'slides' | 'handout';
}

/** Where a picture is named: a slide's `image:` line (a plain path) or a handout's Markdown (an address). */
export type PictureFrom = 'slide' | 'handout';
export type PictureUrl = (path: string, from: PictureFrom) => string | null;

/** The meta tags that mark a page Ritemark wrote from a deck (`pageFile.ts` reads them). */
export const GENERATOR_META = 'Ritemark';
export const DIGEST_META = 'ritemark-deck';

const esc = escapeHtml;

/**
 * The file a picture names, relative to the deck's folder, with `/` between folders. A slide's `image:` is a plain
 * path, as the deck view reads it; a handout's picture is a Markdown address, so its `?…` and `#…` are no part of the
 * file and each of its folders and name is decoded (`%20`, `%26`, `%23` alike).
 */
export function pictureFile(path: string, from: PictureFrom, platform: NodeJS.Platform = process.platform): string {
  const trimmed = path.trim();
  // The deck view reads a slide's path with the system's own rules: a backslash separates folders on Windows only.
  if (from === 'slide') return platform === 'win32' ? trimmed.replace(/\\/g, '/') : trimmed;
  // As a browser reads an address: a part decodes to its characters (`%2E%2E` to `..`, as the browser takes it), but
  // never into a folder separator, which an encoded `%2F` or `%5C` is not.
  return trimmed.split(/[?#]/)[0].split('/').map(part => {
    try {
      const decoded = decodeURIComponent(part);
      return /[\\/]/.test(decoded) ? part : decoded;
    } catch {
      return part;
    }
  }).join('/');
}

/** One key for a picture by its path as written and where it is named (the page's lookups all use it). */
export function pictureKey(path: string, from: PictureFrom): string {
  return `${from}\u0000${path.trim()}`;
}

/** A file's address on the page, beside the deck: each folder and the name encoded, so any character reads back. */
export function pictureAddress(file: string): string {
  return file.split('/').map(part => encodeURIComponent(part)).join('/');
}

const isWebAddress = (href: string) => /^(?:https?:\/\/|mailto:)/i.test(href.trim());
const PRIVATE_LANGS: ReadonlySet<string> = new Set(['notes', 'slide']);

/** Inline or block HTML in a handout: comments and `<mark>` tags out (their words stay), the rest shown as text. */
export function sanitizeHtml(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<\/?mark\b(?:"[^"]*"|'[^']*'|[^'">])*>?/gi, '');
  return esc(cleaned);
}

function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Words without tags, for a tick's id. */
const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Whether a list's own items (not those of a list inside one of them) are ticks. The body is this renderer's own
 * markup (a handout's raw HTML is escaped), so its `<li>` tags are the items'.
 */
function ownItemsAreSteps(body: string): boolean {
  let depth = 0;
  for (const tag of body.matchAll(/<li\b[^>]*>|<\/li>/g)) {
    if (tag[0] === '</li>') { depth--; continue; }
    if (depth === 0 && tag[0] === '<li class="step">') return true;
    depth++;
  }
  return false;
}

// Decks README item 10: a prompt opens in Claude or ChatGPT with its words already in the box. The links are built in
// one place for the handout's prompts and the slides' code blocks (Sprint 163 PR 1, `codeTools.ts`).
export { OPEN_IN_HOSTS, OPEN_IN_MAX_ADDRESS, openInAddresses };

/** The renderer for one part's handout: `partKey` makes its ticks' ids. */
class HandoutRenderer extends marked.Renderer {
  private readonly seen = new Map<string, number>();

  constructor(private readonly partKey: string, private readonly pictureUrl: PictureUrl, private readonly openIn = true) {
    super();
  }

  code(code: string, infostring: string | undefined): string {
    const lang = (infostring ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (PRIVATE_LANGS.has(lang)) return '';
    const words = code.replace(/\n$/, '');
    // Copy first, then the "Open in" links (left out for a deck with `open-in: none`, or a prompt too long for an address).
    const links = this.openIn && words.trim() ? openInAddresses(words) : [];
    const open = links.map(link => `<a class="open" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open in ${link.label}, in a new tab">Open in ${link.label}</a>`).join('');
    return `<div class="prompt${links.length ? ' ai' : ''}"><pre><code>${esc(words)}</code></pre>`
      + `<button class="copy" type="button" aria-label="Copy the prompt"><span class="c1">${iconSvg('copy', 14)}Copy</span><span class="c2">${iconSvg('check', 14)}Copied</span></button>${open}</div>\n`;
  }

  html(html: string, block?: boolean): string {
    // An inline line break is written `<br>` in a heading (#923: `\` and a newline would end it): drawn as a break, as
    // the slide renderer draws it. One on a line of its own is a block of raw HTML, shown as its words like any other.
    if (!block && isLineBreakTag(html)) return '<br>';
    return sanitizeHtml(html);
  }

  // Text arrives escaped (`handoutTokenizer` keeps marked out of its raw mode); a `<` that still came through raw
  // is escaped here, so no handout text can open a tag on the page. Entities stay as they are.
  text(text: string): string {
    return text.replace(/</g, '&lt;');
  }

  /** The handout's own opening heading (an H1 or H2 as its first block) is the part's heading, its h2. */
  partHeading = false;

  heading(text: string, level: number): string {
    if (this.partHeading) {
      this.partHeading = false;
      return `<h2>${text}</h2>\n`;
    }
    // The part's own heading is its h2 (its title, or its handout's own); the handout's headings sit under it.
    const tag = level <= 2 ? 'h3' : level === 3 ? 'h4' : 'h5';
    return `<${tag}>${text}</${tag}>\n`;
  }

  link(href: string | null, _title: string | null, text: string): string {
    const target = (href ?? '').trim();
    if (isWebAddress(target)) return `<a href="${esc(target)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    if (isRelativeTarget(target)) {
      // A file or folder of the project: named where it is, never linked (it doesn't go), and its path never shown.
      const folder = /\/$/.test(target.split(/[?#]/)[0]) || !/\.[a-z0-9]{1,8}$/i.test(target.split(/[?#]/)[0]);
      return `<span class="file">${iconSvg(folder ? 'folder' : 'file-text', 16)}${text}</span>`;
    }
    return text;
  }

  image(href: string | null, _title: string | null, text: string): string {
    const target = (href ?? '').trim();
    if (isRelativeTarget(target)) {
      const url = this.pictureUrl(target, 'handout');
      // `marked` hands a picture's words over escaped already.
      return url ? `<img src="${esc(url)}" alt="${text}" loading="lazy">` : (text ? `<span class="nopic">${text}</span>` : '');
    }
    // A picture on the web is a link to it: the page loads nothing from elsewhere.
    if (/^https?:\/\//i.test(target)) return `<a href="${esc(target)}" target="_blank" rel="noopener noreferrer">${text || 'Picture'}</a>`;
    return text;
  }

  checkbox(): string {
    return '';
  }

  listitem(text: string, task: boolean, checked: boolean): string {
    if (!task) return `<li>${text}</li>\n`;
    const words = plain(text);
    const occurrence = (this.seen.get(words) ?? 0) + 1;
    this.seen.set(words, occurrence);
    const id = shortHash(`${this.partKey}\u0000${words}\u0000${occurrence}`);
    return `<li class="step"><label><input type="checkbox" data-tick="${id}"${checked ? ' checked' : ''}><span>${text.trim()}</span></label></li>\n`;
  }

  list(body: string, ordered: boolean, start: number | ''): string {
    const tag = ordered ? 'ol' : 'ul';
    const steps = ownItemsAreSteps(body) ? ' class="steps"' : '';
    const from = ordered && start !== '' && start !== 1 ? ` start="${Number(start)}"` : '';
    return `<${tag}${steps}${from}>\n${body}</${tag}>\n`;
  }

  table(header: string, body: string): string {
    return `<div class="tw"><table>\n<thead>\n${header}</thead>\n${body ? `<tbody>${body}</tbody>` : ''}</table></div>\n`;
  }
}

/**
 * A cell's words as a reader sees them, without its marks: the text of its inline tokens (a picture's words left out),
 * each character reference one character (marked hands text over escaped, `&amp;` for `&`), as the editor's
 * `textContent` reads the same cell.
 */
function cellText(tokens: Token[] | undefined): string {
  return (tokens ?? []).map(token => {
    if (token.type === 'image') return '';
    if ('tokens' in token && Array.isArray(token.tokens)) return cellText(token.tokens as Token[]);
    return 'text' in token && typeof token.text === 'string' ? token.text.replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, '_') : '';
  }).join('');
}

type TableParser = { parseInline: (tokens: Token[]) => string; renderer: InstanceType<typeof marked.Renderer> };

/**
 * A handout's table, drawn as the deck view's handout draws it:
 *  - a table with widths (#772's dash-count form, `tableWidths.ts`) at the text's width with those shares, as the
 *    editor and the slide renderer draw it;
 *  - a wide table's columns keep sensible widths (the Experience lead on #780, `tableColumns.ts`): each text column's
 *    floor as a spacer at the end of its header cell (`.fl`). The editor sets the floor as the `<col>`'s `min-width`,
 *    which only Chromium keeps; a block's width is part of its cell's least width in every browser, so the page, read
 *    in any browser, keeps the same floor. Its `cqw` counts against the table's scrolling frame (`.tw`), and the cell's
 *    20 px of padding comes off.
 */
export function handoutTableHtml(parser: TableParser, table: Tokens.Table): string {
  const columns = table.header.length;
  const delimiter = table.raw.split('\n')[1] ?? '';
  const widths = tableHasWidths(table.raw) ? widthsOf(delimiter, true, columns) : null;
  const floors = columnFloors(table.rows.map(row => row.map(cell => cellText(cell.tokens))), columns, widths);
  let cells = '';
  for (let col = 0; col < columns; col++) {
    const cell = parser.renderer.tablecell(parser.parseInline(table.header[col].tokens as Token[]), { header: true, align: table.align[col] });
    const floor = floors[col];
    cells += floor ? cell.replace(/<\/th>\n?$/, `<i class="fl" style="width:calc(${floorCss(floor)} - 20px)"></i></th>\n`) : cell;
  }
  const header = parser.renderer.tablerow(cells);
  let body = '';
  for (const row of table.rows) {
    cells = '';
    for (let col = 0; col < row.length; col++) cells += parser.renderer.tablecell(parser.parseInline(row[col].tokens as Token[]), { header: false, align: table.align[col] });
    body += parser.renderer.tablerow(cells);
  }
  const html = parser.renderer.table(header, body);
  if (!widths) return html;
  const group = `<colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup>`;
  return html.replace('<table>\n', `<table class="has-widths" style="width:100%">\n${group}\n`);
}

/** The handout's pictures with their looks: the renderer's own picture, then its size, crop and caption around it. */
const handoutPictureExtensions = new Marked().use({
  extensions: [{
    name: 'table',
    renderer(this: { parser: TableParser }, token) {
      return handoutTableHtml(this.parser, token as Tokens.Table);
    },
  }, {
    // Sprint 163 PR 3: a Button block, wherever a paragraph stands (in a quote, a list): its words beside it, and a real
    // link to its full https address in a new tab (any other address draws an inert button). Files stay where they
    // are: Publish carries none.
    name: 'paragraph',
    renderer(this: { parser: { parseInline: (tokens: Token[]) => string } }, token) {
      const button = buttonParagraphOf((token as Tokens.Paragraph).tokens);
      if (!button) return false;
      return buttonHtml({ wordsHtml: this.parser.parseInline(button.words), label: button.label, href: button.href, mode: 'link', className: 'pbutton' });
    },
  }, pictureBlockTokenizer, {
    name: 'image',
    renderer(this: { parser: { renderer: InstanceType<typeof marked.Renderer> } }, token) {
      const image = token as unknown as ImageTokenWithLook;
      const html = this.parser.renderer.image(image.href, image.title, image.text);
      return image.picture ? pictureMarkup(html, lookOf(image.picture), { caption: image.text }) : html;
    },
  }],
}).defaults.extensions;

/** A label over a prompt: a short paragraph in capitals ("TRY IT", "PROMPT") just before a code block. */
const PROMPT_LABEL = /^[A-Z0-9][A-Z0-9 .,'’&:!?-]{0,28}$/;

type Token = ReturnType<typeof marked.lexer>[number];

/** One part's handout as HTML. In an Exercise, a numbered list at the top level is its steps, each with a tick. */
export function handoutHtml(markdown: string, options: { partKey: string; exercise: boolean; pictureUrl: PictureUrl; openIn?: boolean }): string {
  return handoutParts(markdown, options).html;
}

/**
 * A part's handout as HTML, and whether it opens with its own heading (an H1 or H2 as its first block: 16 November,
 * the part's heading is the handout's), which is then the part's h2.
 */
function handoutParts(markdown: string, options: { partKey: string; exercise: boolean; pictureUrl: PictureUrl; partHeading?: boolean; openIn?: boolean }): { html: string; ownHeading: boolean } {
  if (!markdown.trim()) return { html: '', ownHeading: false };
  const renderer = new HandoutRenderer(options.partKey, options.pictureUrl, options.openIn !== false);
  const tokens = lexHandout(markdown);
  const first = tokens.find((token: Token) => token.type !== 'space');
  const ownHeading = first?.type === 'heading' && (first as { depth: number }).depth <= 2;
  renderer.partHeading = ownHeading && options.partHeading === true;
  // The parser only renders tokens; the lexer above is where the handout is read, and the one place raw mode is kept out.
  // Experience 49: a picture drawn with its look (size, alignment, crop, caption), its block never as words.
  const parser = new marked.Parser({ ...MARKED_OPTIONS, renderer, extensions: handoutPictureExtensions });
  const blocks = (list: Token[], exercise: boolean): string => {
    let out = '';
    list.forEach((token: Token, index: number) => { out += block(token, index, list, exercise); });
    return out;
  };
  const block = (token: Token, index: number, tokens: Token[], exercise: boolean): string => {
    let out = '';
    // Sprint 163: a Tabs block shows every tab, one after another, each under its name (the page's player brings the
    // tabs themselves, PR 4). A tab's steps are never an exercise's ticks: those are the part's own numbered list.
    if (token.type === 'handoutTabs') {
      const tabs = (token as unknown as HandoutTabsToken).tabs;
      return `<div class="tabset">${tabs.map(tab => `<section class="tabsec"><div class="tabname">${esc(tab.name)}</div>${blocks(tab.tokens as Token[], false)}</section>`).join('')}</div>\n`;
    }
    if (token.type === 'list' && token.ordered && exercise) {
      for (const item of token.items) {
        item.task = true;
        item.checked = false;
      }
    }
    if (token.type === 'html') {
      // A block of raw HTML is shown as its words, a paragraph of its own; a comment alone leaves nothing.
      const words = sanitizeHtml(token.text).trim();
      if (words) out += `<p>${words}</p>\n`;
      return out;
    }
    if (token.type === 'paragraph' && PROMPT_LABEL.test(token.text.trim())) {
      const next = tokens.slice(index + 1).find(entry => entry.type !== 'space');
      if (next?.type === 'code') {
        out += `<div class="k">${parser.parseInline(token.tokens ?? [])}</div>\n`;
        return out;
      }
    }
    out += parser.parse([token] as Parameters<typeof parser.parse>[0]);
    return out;
  };
  return { html: blocks(tokens, options.exercise), ownHeading };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * Sprint 163 PR 4 (the decks README, "The page and Present are one player"): the page's own look. The slide fills the
 * window as on the wall: its ground runs to the window's edges (`.ground`, the wall's `wallGround`) and its content keeps
 * the 16:9 area, centred (`.frame`, sized by the script as the wall's `wallSlideSize`), one slide at a time. The page's
 * own controls are one quiet line on the ground at the foot (`.line`): the client and the session, More, ‹ 7 / 12 ›,
 * Contents, and a 2 px line in the accent for how far along it is. More opens the slide's text beside it (`.side`), on
 * the same ground. Below 860 px the slide's blocks stack in one column at reading size and the page scrolls (`@media`).
 *
 * The handout's rules (`.part`, `.prompt`, `.steps`, `.tw`, …) are the text's, now in More, in the theme's colours on its
 * ground (`pageColours`).
 */
export const PAGE_CSS = `
:root { color-scheme: light; --line-h: 44px; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: var(--gs); color: var(--text); font: 400 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
button, a, label, [data-go], [role="tab"], [role="checkbox"] { cursor: pointer; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; }
[hidden] { display: none !important; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
svg { flex: none; }
/* The ground: the theme's, to the window's edges (white on Borderless), as on the wall. */
.ground { position: fixed; inset: 0; z-index: 0; background: var(--ground); pointer-events: none; }
.wrap { position: relative; z-index: 1; }
.view { position: fixed; left: 0; top: 0; right: 0; bottom: var(--line-h); z-index: 1; }
.frame { position: absolute; left: 0; top: 0; width: 960px; height: 540px; }
.layer { position: absolute; inset: 0; }
/* A slide not shown is out of the page, not only invisible: a tab's pane shows itself (visibility: visible). */
.layer:not(.on):not(.leaving) { display: none; }
.layer.leaving { pointer-events: none; z-index: 0; }
.layer.on { z-index: 1; }
.layer:focus { outline: none; }
.layer > .deck-slide { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.layer .deck-sl { transform: scale(var(--k, .6)); background: transparent; }
/* A picture Behind, Left or Right runs past the 16:9 area to the window's edges on its side, as on the wall (wall.css). */
.layer .deck-slide:has(> .deck-sl.is-blocks), .layer .deck-sl.is-blocks { overflow: visible; }
.layer .deck-sl.is-blocks .photo { top: calc(-1 * var(--bleed-y, 0px)); bottom: calc(-1 * var(--bleed-y, 0px)); }
.layer .deck-sl.is-blocks.pic-left .photo { left: calc(-1 * var(--bleed-x, 0px)); width: calc(384px + var(--bleed-x, 0px)); }
.layer .deck-sl.is-blocks.pic-right .photo { right: calc(-1 * var(--bleed-x, 0px)); width: calc(384px + var(--bleed-x, 0px)); }
.layer .deck-sl.is-blocks.pic-behind .photo { left: calc(-1 * var(--bleed-x, 0px)); right: calc(-1 * var(--bleed-x, 0px)); }
.layer .deck-sl.is-blocks.pic-behind .veil { inset: calc(-1 * var(--bleed-y, 0px)) calc(-1 * var(--bleed-x, 0px)); }
/* The quiet line (the decks README, "The slide fills the window"): on the slide's ground at the foot. */
.line { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; height: var(--line-h); padding: 0 10px 0 20px; display: flex; align-items: center; gap: 4px; font: 500 13.5px/1 'Sofia Sans', sans-serif; color: var(--lmuted); }
.line .who { min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.line .who b { color: var(--lstrong); font-weight: 700; }
.line .who span::before { content: ' \\00b7  '; }
.line .who b:empty + span::before { content: none; }
.fb { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 10px; border-radius: 8px; color: var(--lbtn); font: 600 13.5px/32px 'Sofia Sans', sans-serif; white-space: nowrap; transition: background-color .12s, color .12s; }
.fb:hover { background: var(--lhover); color: var(--lstrong); }
.fb:active { background: var(--lpress); }
.fb[aria-expanded="true"] { background: var(--lpress); color: var(--lstrong); }
.fb[disabled] { opacity: .32; pointer-events: none; }
.fb.ic { width: 32px; padding: 0; justify-content: center; }
.fb:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* Every button says what it does (the page's own tooltip, above the line; never the browser's). */
.fb[data-tip]:focus-visible::after, .tick[data-tip]:focus-visible::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; z-index: 40; padding: 5px 9px; border-radius: 7px; background: #1E1B4B; color: #fff; font: 600 12.5px/16px 'Sofia Sans', sans-serif; white-space: nowrap; pointer-events: none; box-shadow: 0 8px 20px -8px rgba(0,0,0,.5); }
@media (hover: hover) { .fb[data-tip]:hover::after, .tick[data-tip]:hover::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 8px); right: 0; z-index: 40; padding: 5px 9px; border-radius: 7px; background: #1E1B4B; color: #fff; font: 600 12.5px/16px 'Sofia Sans', sans-serif; white-space: nowrap; pointer-events: none; box-shadow: 0 8px 20px -8px rgba(0,0,0,.5); } }
.tick[data-tip]::after { left: 0; right: auto !important; letter-spacing: 0; animation: tip-in .12s ease .6s both; }
@keyframes tip-in { from { opacity: 0; } to { opacity: 1; } }
.fb[aria-expanded="true"]::after { display: none; }
.line .pos { min-width: 54px; text-align: center; font: 600 13.5px/1 'Sofia Sans', sans-serif; color: var(--lbtn); font-variant-numeric: tabular-nums; white-space: nowrap; }
.line .sep { width: 1px; height: 18px; margin: 0 6px; background: var(--lsep); }
.prog { position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; height: 2px; pointer-events: none; }
.prog i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .3s ease; }
/* Contents opens upward from the line, in white as a menu is. */
.toc { position: fixed; z-index: 30; bottom: calc(var(--line-h) + 8px); right: 10px; width: min(360px, calc(100vw - 32px)); max-height: min(70vh, 560px); overflow: auto; padding: 8px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px #E7E8F2, 0 18px 40px -12px rgba(8,9,30,.6); }
.toc .hd { padding: 8px 10px 6px; font: 700 11.5px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: #6B6F94; }
.toc button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 6px 10px; border-radius: 8px; text-align: left; font: 500 14.5px/20px var(--fh); color: #1C1F4A; }
.toc button:hover { background: #F4F4FA; }
.toc button:active { background: #E9E9F5; }
.toc button.on { background: #FFF5DE; }
.toc .n { width: 22px; flex: none; text-align: right; font-weight: 700; color: #6B6F94; font-variant-numeric: tabular-nums; }
.toc .sec { font-weight: 700; }
.toc .tag { min-width: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; padding: 1px 8px; border-radius: 10px; background: #FFF0CC; color: #8A5A00; font: 700 11px/18px 'Sofia Sans', sans-serif; letter-spacing: .4px; text-transform: uppercase; }
.toc .tag { margin-left: auto; }
.toc .done { margin-left: auto; color: #B07A12; display: none; }
.toc button.finished .done { display: inline-flex; }
.toc button.finished .tag { display: none; }
/* More: the slide's text beside the slide, on the same ground; the slide makes room (the script sizes it). */
.side { position: fixed; top: 0; right: 0; bottom: var(--line-h); z-index: 2; width: var(--sw, 420px); overflow: auto; padding: 30px 30px 24px 28px; background: var(--sidebg); box-shadow: inset 1px 0 0 var(--lsep); color: var(--text); font-family: var(--fb); scrollbar-width: thin; }
.side .sclose { position: absolute; top: 22px; right: 18px; }
.side .sclose[data-tip]:hover::after, .side .sclose[data-tip]:focus-visible::after { bottom: auto; top: calc(100% + 6px); }
.side > .part, .side > .pre { display: none; }
.side > .on { display: block; }
.side .part h2:first-child { margin-right: 40px; }
.pre h1, .pre h2, .pre h3, .pre h4, .pre h5 { font-family: var(--fh); color: var(--ink); }
.pre { padding: 0 0 18px; }
.part { padding: 0; }
.part h2 { margin: 0 0 12px; font: 700 22px/1.25 var(--fh); color: var(--ink); text-wrap: balance; }
.part h3 { margin: 18px 0 8px; font: 700 18px/1.3 var(--fh); color: var(--ink); }
.part h4, .part h5 { margin: 16px 0 6px; font: 700 16px/1.35 var(--fh); color: var(--ink); }
.part p, .pre p { margin: 0 0 14px; }
.part ol, .part ul, .pre ol, .pre ul { margin: 0 0 14px; padding-left: 24px; }
.part li { margin-bottom: 6px; }
.part li > p { margin: 0 0 6px; }
.part a, .pre a { color: var(--link); text-decoration-color: var(--accent); text-underline-offset: 3px; }
.part a:hover, .pre a:hover { color: var(--ink); }
/* Sprint 163 PR 3: a Button block in the text: the words beside it and the button in the theme's accent; alone, the button. */
.pbutton { display: flex; align-items: center; gap: 16px; margin: 0 0 14px; padding: 10px 12px 10px 18px; border-radius: 12px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
.pbutton.is-solo { padding: 0; background: none; box-shadow: none; }
.pbutton .blk-button-words { flex: 1; min-width: 0; margin: 0; }
.part .pbutton .blk-btn, .pre .pbutton .blk-btn { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: 999px; background: var(--accent); color: var(--onacc); font: 700 15px/40px var(--fb); text-decoration: none; white-space: nowrap; }
.pbutton a.blk-btn:hover { filter: brightness(1.06); }
.pbutton a.blk-btn:active { filter: brightness(.94); }
.pbutton .blk-btn svg { width: 16px; height: 16px; fill: currentColor; }
.pbutton .blk-btn.is-unset { opacity: .55; }
@media (max-width: 859px) { .pbutton:not(.is-solo) { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px 16px; } .pbutton:not(.is-solo) .blk-btn { justify-content: center; } }
.part img, .pre img { display: block; max-width: 100%; height: auto; margin: 4px 0 14px; border-radius: 8px; }
/* Experience 49: a picture's look (pictureLook.ts): its frame crops it in its box and holds its caption. */
.part .pic, .pre .pic { margin: 4px 0 14px; }
.part .pic img, .pre .pic img { margin: 0; border-radius: 0; }
.pic-box { border-radius: 8px; }
.deck-sl .pic-box { border-radius: var(--s-r2, 10px); }
.pic-cap { display: block; margin-top: 6px; font-size: .88em; line-height: 1.4; opacity: .75; }
/* A click on a picture opens it full size (always on the page, never in the editor). */
.part img, .pre img, .layer .deck-sl .blk-pic, .layer .deck-sl .pic img, .layer .deck-sl .photo:not(.empty) { cursor: zoom-in; }
.zoom { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(10, 11, 30, .86); cursor: zoom-out; }
.zoom:focus { outline: none; }
/* A picture Behind the words: a click on the slide reaches it through the veil and the words (none of them a link). */
.layer .deck-sl.pic-behind .veil, .layer .deck-sl.pic-behind .blk-flow { pointer-events: none; }
.layer .deck-sl.pic-behind .blk-flow :is(img, button, a, .cb-tools, .tick) { pointer-events: auto; }
.zoom-pic { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.zoom-pic > img { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; margin: 0; border-radius: 8px; box-shadow: 0 18px 60px rgba(0, 0, 0, .45); object-fit: contain; }
/* The way out: an × at the top right, 44 px to tap (a click or a tap anywhere closes it too, and Esc). */
.zoom-x { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 22px; background: rgba(255, 255, 255, .16); color: #fff; cursor: pointer; }
.zoom-x:hover { background: rgba(255, 255, 255, .26); }
.zoom-pic > .zoom-photo { width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat; background-position: center; }
.part blockquote, .pre blockquote { margin: 0 0 14px; padding: 2px 0 2px 14px; border-left: 3px solid var(--line); color: var(--muted); }
.part hr, .pre hr { border: 0; border-top: 1px solid var(--line); margin: 18px 0; }
.part code, .pre code { font: 400 .9em/1.5 ui-monospace, Menlo, Consolas, monospace; background: var(--soft); padding: 1px 5px; border-radius: 5px; }
.tw { overflow-x: auto; margin: 0 0 14px; scrollbar-width: thin; scrollbar-color: rgba(127, 127, 160, .4) transparent; container-type: inline-size; } /* the thumb only, no track behind it (Jarmo: "system scrollbaridel ei tohi olla tausta"); the frame a column's stored share counts against (handoutTableHtml) */
.tw .fl { display: block; height: 0; } /* a text column's floor (handoutTableHtml): a width, no height */
.tw.is-scrollable-left, .tw.is-scrollable-right { --fade-l: #000; --fade-r: #000; -webkit-mask: linear-gradient(to right, var(--fade-l), #000 24px, #000 calc(100% - 24px), var(--fade-r)), linear-gradient(#000 0 0) bottom / 100% var(--rm-fade-bar, 0px) no-repeat; mask: linear-gradient(to right, var(--fade-l), #000 24px, #000 calc(100% - 24px), var(--fade-r)), linear-gradient(#000 0 0) bottom / 100% var(--rm-fade-bar, 0px) no-repeat; } /* a soft 24 px edge on the side with more to scroll to, as in the handout (PAGE_EDGE_RULE sets the classes); the second layer keeps a classic scrollbar whole */
.tw.is-scrollable-left { --fade-l: transparent; }
.tw.is-scrollable-right { --fade-r: transparent; }
.tw table { border-collapse: collapse; font-size: 14.5px; }
.tw th, .tw td { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.tw th { color: var(--ink); font-weight: 700; }
.file { display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px 1px 6px; border-radius: 7px; background: var(--soft); color: var(--ink); font-weight: 500; }
.nopic { color: var(--muted); font-style: italic; }
.k { margin: 6px 0 8px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--label); }
.prompt { position: relative; margin: 0 0 16px; }
/* Sprint 163: a Tabs block in the text shows every tab, one after another, each under its name (the player's tabs come
   with PR 4). */
.tabset { margin: 0 0 16px; }
.tabsec { margin: 0 0 14px; padding: 0 0 0 14px; box-shadow: inset 2px 0 0 var(--line); }
.tabname { margin: 0 0 6px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--label); }
.prompt pre { margin: 0; padding: 14px 16px; padding-right: 104px; border-radius: 12px; background: var(--soft); white-space: pre-wrap; overflow-wrap: anywhere; }
.prompt pre code { font: 400 14px/1.6 ui-monospace, Menlo, Consolas, monospace; color: var(--ink); background: none; padding: 0; }
.copy { position: absolute; right: 10px; top: 10px; display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 999px; background: var(--soft2); color: var(--ink); font: 700 12.5px/30px 'Sofia Sans', sans-serif; white-space: nowrap; }
.copy:hover { background: var(--lpress); }
.copy > span { display: inline-flex; align-items: center; gap: 6px; }
.copy .c2 { display: none; }
.copy.ok { background: #16A34A; color: #fff; }
.copy.ok .c1 { display: none; }
.copy.ok .c2 { display: inline-flex; }
.copy:active { transform: translateY(1px); }
.prompt.ai { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; padding: 10px 10px 0; border-radius: 12px; background: var(--soft); } /* Copy, then Open in Claude and Open in ChatGPT, in a row over the prompt (Decks README item 10) */
.prompt.ai pre { order: 1; flex: 1 0 100%; padding: 4px 6px 14px; border-radius: 0; background: none; }
.prompt.ai .copy { position: static; }
.prompt .open { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 999px; background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); font: 700 12.5px/30px 'Sofia Sans', sans-serif; white-space: nowrap; text-decoration: none; }
.prompt .open:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.prompt .open:active { transform: translateY(1px); }
.sect { margin: 0 0 8px; padding: 0; }
.sect .eyebrow { margin-bottom: 4px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); }
.sect h2 { font-size: 26px; }
.steps { list-style: none; padding: 0 !important; margin: 0 0 16px !important; display: grid; gap: 8px; }
.steps li { margin: 0; }
.steps label { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--stepbg); box-shadow: inset 0 0 0 1px var(--stepline); }
.steps label:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.steps label > span { min-width: 0; flex: 1 1 auto; } /* the step's whole width: a table's frame in a step is a query container, so it takes no width from its table */
.steps label p { margin: 0; }
.steps input { -webkit-appearance: none; appearance: none; flex: none; width: 22px; height: 22px; margin: 1px 0 0; border-radius: 6px; box-shadow: inset 0 0 0 2px var(--accent); background: transparent; display: grid; place-items: center; }
.steps input:checked { background: var(--accent); box-shadow: none; }
.steps input:checked::after { content: ''; width: 6px; height: 11px; border: solid var(--s-tagfg, #1C1F4A); border-width: 0 2.5px 2.5px 0; transform: rotate(45deg) translate(-1px, -1px); }
.steps input:checked + span { color: var(--muted); }
/* The ticks (the decks README, "The ticks stay"; the Experience lead's workbook-ticks.png): on the page only, a step's
   number is a checkbox. 38 x 38 on the 960 slide with a 9 radius; under the pointer an inset accent ring, pressed a
   stronger fill, the keyboard's 2 px accent ring; ticked, a check on the accent and the step's words go quiet. */
.layer .deck-sl.is-blocks .blk-steps ol > li:has(> .tick)::before { content: none; }
.layer .deck-sl.is-blocks .blk-steps .tick { position: absolute; left: 0; top: -.111em; width: 2.111em; height: 2.111em; display: grid; place-items: center; border-radius: .5em; background: var(--s-accs, rgba(242,181,68,.16)); color: var(--s-acct, #F2B544); font: 700 .75em/1 var(--s-fh, 'Sofia Sans'), sans-serif; transition: background-color .12s, color .12s, box-shadow .12s; }
.layer .deck-sl.is-blocks .blk-steps .tick svg { display: none; width: 1.111em; height: 1.111em; }
.layer .deck-sl.is-blocks .blk-steps .tick:hover { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--s-acc, #F2B544) 65%, transparent); }
.layer .deck-sl.is-blocks .blk-steps .tick:active { background: color-mix(in srgb, var(--s-acc, #F2B544) 32%, transparent); }
.layer .deck-sl.is-blocks .blk-steps .tick:focus-visible { outline: 2px solid var(--s-acc, #F2B544); outline-offset: 2px; }
.layer .deck-sl.is-blocks .blk-steps .tick[aria-checked="true"] { background: var(--s-acc, #F2B544); color: var(--s-tagfg, #1C1F4A); }
.layer .deck-sl.is-blocks .blk-steps .tick[aria-checked="true"]:hover { box-shadow: inset 0 0 0 1.5px rgba(28,31,74,.35); }
.layer .deck-sl.is-blocks .blk-steps .tick[aria-checked="true"] .tick-n { display: none; }
.layer .deck-sl.is-blocks .blk-steps .tick[aria-checked="true"] svg { display: block; }
.layer .deck-sl.is-blocks .blk-steps ol > li.done, .layer .deck-sl.is-blocks .blk-steps ol > li.done > :not(.tick) { color: var(--quiet); }
/* A Tabs block's tabs are the reader's to choose (Sprint 163 PR 2; the decks README, "Tabs are a block of their own"):
   the others brighter under the pointer, a soft fill when pressed, the keyboard's accent ring. */
.layer .deck-sl.is-blocks .blk-tab:not(.is-active):hover { color: var(--s-hd, #fff); background: color-mix(in srgb, var(--s-hd, #fff) 5%, transparent); }
.layer .deck-sl.is-blocks .blk-tab:not(.is-active):active { background: color-mix(in srgb, var(--s-hd, #fff) 9%, transparent); }
.layer .deck-sl.is-blocks .blk-tab:focus-visible { outline: 2px solid var(--s-acc, #F2B544); outline-offset: -2px; }
.foot { display: none; }
.empty { position: fixed; inset: 0 0 var(--line-h); display: grid; place-items: center; margin: 0; color: var(--lmuted); }
.toast, .restart { position: fixed; left: 50%; bottom: calc(var(--line-h) + 12px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 40; max-width: calc(100vw - 32px); padding: 10px 14px; border-radius: 10px; background: #fff; color: #1C1F4A; font: 600 13.5px/18px 'Sofia Sans', sans-serif; box-shadow: 0 0 0 1px rgba(28,31,74,.08), 0 12px 30px -10px rgba(8,9,30,.6); }
/* Small details 7: a quiet way back to the start when the page returns to a reader's place, for 5 s. */
.restart { height: 36px; padding: 0 16px; border-radius: 999px; line-height: 36px; white-space: nowrap; animation: restart-in .3s ease; }
.restart:hover { background: #F4F4FA; }
@keyframes restart-in { from { opacity: 0; } to { opacity: 1; } }
/* A narrow window (half a laptop, a phone): the slide's blocks in one column at reading size, on the same ground; the
   page scrolls when a slide is taller than the window, and the text follows under it. */
@media screen and (max-width: 860px) {
  body { overflow: auto; }
  .ground { position: fixed; }
  .view { position: relative; inset: auto; padding: 16px 16px calc(var(--line-h) + 12px); min-height: 100vh; }
  .wrap.more-open .view { min-height: 0; padding-bottom: 8px; --behind-foot: -8px; }
  .frame { position: relative; left: auto !important; top: auto !important; width: auto !important; height: auto !important; }
  .layer { position: relative; inset: auto; display: none; }
  .layer.on { display: block; }
  .layer.leaving { display: none; }
  .layer:not(.flow) { aspect-ratio: 16 / 9; }
  .layer.flow > .deck-slide { position: relative; inset: auto; width: auto; height: auto; overflow: visible; }
  .layer.flow .deck-sl { position: relative; width: auto; height: auto; transform: none; overflow: visible; }
  .layer.flow .deck-sl.is-blocks .blk-flow { position: relative; inset: auto; top: auto; left: auto; right: auto; bottom: auto; --fit: 1 !important; font-size: 16.5px; overflow: visible; }
  .layer.flow .deck-sl.is-blocks.logo-tl .blk-flow, .layer.flow .deck-sl.is-blocks.logo-br .blk-flow, .layer.flow .deck-sl.is-blocks.logo-bl .blk-flow { top: auto; bottom: auto; }
  .layer.flow .deck-sl.is-blocks.logo-tr .blk-flow > :first-child { margin-right: 0; }
  .layer.flow .deck-sl.is-blocks h1 { font-size: 1.55em; }
  .layer.flow .deck-sl.is-blocks.is-cover h1 { font-size: 1.95em; }
  .layer.flow .deck-sl.is-blocks.is-cover .blk-flow { padding: 18vh 0 0; }
  /* Sprint 167 PR 3: in one column a slide has no free height, so Top, Middle and Bottom read alike; only a title
     slide's low start follows its place: none at Top, as every other slide starts, and half of it at Middle. */
  .layer.flow .deck-sl.is-blocks.is-cover.va-top .blk-flow { padding-top: 0; }
  .layer.flow .deck-sl.is-blocks.is-cover.va-middle .blk-flow { padding-top: 9vh; }
  .layer.flow .deck-sl .slide-logo { position: static; display: block; margin: 0 0 14px; }
  .layer.flow .deck-sl.is-blocks .photo { position: relative; inset: auto !important; width: auto !important; height: 34vw; max-height: 220px; margin: 0 0 16px; border-radius: 10px; }
  /* #905 (the Experience lead, 20 November): a picture Behind runs the full height of the slide as drawn here, words and
     the view's 16 px edge round them, as its veil does, cover-cropped round its focus (the slide's background-position);
     it never ends partway down the words. A top pulled up by 16 px with the slide's own height ended 16 px short. With
     More open the view keeps 8 px under the slide (--behind-foot), so neither the picture nor its veil runs under the text. */
  .layer.flow .deck-sl.is-blocks.pic-behind .photo { position: absolute; inset: -16px -16px var(--behind-foot, -16px) !important; height: auto; max-height: none; margin: 0; border-radius: 0; }
  .layer.flow .deck-sl.is-blocks.pic-behind .veil { position: absolute; inset: -16px -16px var(--behind-foot, -16px) !important; }
  .layer.flow .deck-sl.is-blocks.pic-behind .blk-flow { z-index: 1; }
  .layer.flow .deck-sl.is-blocks .blk-columns { display: block; }
  .layer.flow .deck-sl.is-blocks .blk-column { padding: 0 0 .8em; }
  .layer.flow .deck-sl.is-blocks .blk-boxes { display: grid; grid-template-columns: minmax(0, 1fr) !important; grid-auto-flow: row !important; gap: 10px; }
  .layer.flow .deck-sl.is-blocks .blk-box { padding: 14px 16px; }
  /* A slide's table hugs its columns (#828): its frame (the table's own box, with its border) is the table's width up to
     the column's, and only then scrolls inside, the side with more to scroll to fading as the handout's .tw does. */
  .layer.flow .deck-sl.is-blocks table { display: block; overflow-x: auto; width: fit-content; max-width: 100%; scrollbar-width: thin; scrollbar-color: rgba(127, 127, 160, .4) transparent; }
  .layer.flow .deck-sl.is-blocks table:is(.is-scrollable-left, .is-scrollable-right) { --fade-l: #000; --fade-r: #000; -webkit-mask: linear-gradient(to right, var(--fade-l), #000 24px, #000 calc(100% - 24px), var(--fade-r)), linear-gradient(#000 0 0) bottom / 100% var(--rm-fade-bar, 0px) no-repeat; mask: linear-gradient(to right, var(--fade-l), #000 24px, #000 calc(100% - 24px), var(--fade-r)), linear-gradient(#000 0 0) bottom / 100% var(--rm-fade-bar, 0px) no-repeat; }
  .layer.flow .deck-sl.is-blocks table.is-scrollable-left { --fade-l: transparent; }
  .layer.flow .deck-sl.is-blocks table.is-scrollable-right { --fade-r: transparent; }
  .layer.flow .deck-sl.is-blocks .blk-pic { max-height: 60vh; }
  .layer.flow .deck-sl.is-blocks .blk-steps ol > li { padding-left: 46px; min-height: 32px; margin-bottom: .7em; }
  .layer.flow .deck-sl.is-blocks .blk-steps .tick { width: 32px; height: 32px; top: -3px; border-radius: 8px; font-size: 16px; }
  .layer.flow .deck-sl.is-blocks .blk-steps .tick svg { width: 17px; height: 17px; }
  /* Every block at reading size, the Tabs block too (the Experience lead on #807; workbook.html's one column): tab names
     14 px on a 36 px tab with 13 px sides, pane words 15 px at 1.5, code 13.5 px on a 21 px line, Copy 28 px at 13 px, the
     arrow's circle 28 px. The band scrolls sideways when the tabs don't fit, as on a slide. */
  .layer.flow .deck-sl.is-blocks .blk-tabs > .blk-tabbar > .blk-tab { height: 36px !important; padding: 0 13px !important; font-size: 14px !important; line-height: 36px; }
  .layer.flow .deck-sl.is-blocks .blk-tabpane { padding: 14px; font-size: 15px; line-height: 1.5; }
  .layer.flow .deck-sl.is-blocks pre.cb { font-size: 13.5px; line-height: 21px; }
  .layer.flow .deck-sl.is-blocks .cb-copy { height: 28px; padding: 0 11px; font-size: 13px; }
  .layer.flow .deck-sl.is-blocks .cb-open { width: 28px; height: 28px; padding: 0; }
  .layer.flow .deck-sl.is-blocks .cb-tools svg { width: 15px; height: 15px; }
  /* An exercise's column (Sprint 163 PR 5) draws its steps smaller to fit a third of the slide; in one column they read at
     the column's size, as every other block does. */
  .layer.flow .deck-sl.is-blocks .blk-column > h1:first-child + .blk-steps { font-size: 1em; }
  .side { position: relative; inset: auto; z-index: 1; width: auto; padding: 4px 16px calc(var(--line-h) + 16px); background: none; box-shadow: none; overflow: visible; }
  .side .sclose { display: none; }
  .line { background: var(--lbar); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 -1px 0 var(--lsep); padding-left: 16px; }
  .line .who span { display: none; }
}
@media screen and (max-width: 599px) {
  .line .who { visibility: hidden; }
  #morebtn .lbl { display: none; }
  #morebtn { width: 32px; padding: 0; justify-content: center; }
}
@media screen and (max-width: 479px) {
  #tocbtn .lbl { display: none; }
  #tocbtn { width: 32px; padding: 0; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .prog i, .fb, .restart, .layer .deck-sl.is-blocks .blk-steps .tick { transition: none; animation: none; }
}
`;

/**
 * The decks README, small details 13: **the page prints as a handout**. Print rules only, after the page's own and the
 * slide's (so they win):
 *
 *  - The quiet line, Contents, More's ×, the toast, the picture view, Copy, the Open in links and the ticks' rings are left
 *    out. Each slide (its layer, shown one at a time on screen) is laid out above its part's text (More's, on screen),
 *    at 576 × 324 (about 152 mm, inside A4's and Letter's printed width at these margins), in the theme's fonts and
 *    colours: the slide alone may print its colours exactly (`print-color-adjust`), the rest prints as the browser sets
 *    it, on white.
 *  - A slide stays with its text (`break-after: avoid`), and a part is kept off two pages where it fits
 *    (`break-inside: avoid`; a part longer than a page breaks as it must).
 *  - A prompt keeps its box as a line around it (backgrounds may not print); a step's tick box likewise.
 *  - The page's address (`#paddr`, written by the script) goes in the handout's footer, beside the client and the session.
 *  - **A section** (18 November) starts a new page and prints as its band ("SECTION 2" over its title), not as a slide
 *    picture, so its words aren't printed twice; the next part follows on the same page, so no page holds a section alone.
 *
 * The order (`printOrderCss`): the view, its frame and More give their children to the page's one column, and each
 * slide and part is given its place there: slide 1, part 1, slide 2, part 2, then the foot.
 */
export const PRINT_CSS = `
.paddr, .foot.addr-only { display: none; }
@media print {
  @page { margin: 14mm 15mm; }
  html, body { height: auto; overflow: visible; background: #FFFFFF; }
  body { font-size: 10.5pt; line-height: 1.5; color: #33365A; --ink: #1C1F4A; --text: #33365A; --muted: #6B6F94; --label: #8A5A00; --line: #DADCE4; --soft: #F4F4FA; --link: #1C1F4A; }
  .ground, .line, .prog, .toc, .toast, .zoom, .restart, .sclose, .copy, .prompt .open, .cb-tools, .empty { display: none !important; }
  /* 1 px inside the paper's right margin (Sprint 170 PR 3): a box as wide as the column (a Button's row, a prompt) had
     its right line at the page's clip edge, and the print drew it half or not at all. */
  .wrap { display: flex; flex-direction: column; align-items: flex-start; max-width: none; margin: 0; padding: 0 1px 0 0; gap: 0; }
  .view, .frame, .side { display: contents !important; }
  .wrap > *, .layer, .part, .pre, .foot { flex: none; width: 100%; }
  .layer { position: relative; inset: auto; display: block; width: 576px; height: 324px; margin: 0 0 4mm; visibility: visible; border-radius: 8px; overflow: hidden; background: var(--slidebg); break-inside: avoid; break-after: avoid; page-break-inside: avoid; page-break-after: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; aspect-ratio: auto; }
  .layer:not(.on):not(.leaving) { display: block; }
  body.bl .layer { border-radius: 0; background: transparent; box-shadow: inset 0 0 0 1px #E7E8F2; }
  /* In the flow and zoomed, not scaled: a transformed 960 x 540 canvas keeps its full height in the layout, and a page
     break below a slide drew a sliver of it at the foot of the page. */
  .layer > .deck-slide { position: relative; inset: auto; display: block; width: 576px; height: 324px; overflow: hidden; }
  .layer .deck-sl { position: absolute; transform: none !important; zoom: 0.6; width: 960px; height: 540px; overflow: hidden; }
  .layer .deck-sl [data-reveal-hidden] { visibility: visible; }
  .layer .deck-sl.is-blocks .photo { top: 0; bottom: 0; }
  .layer .deck-sl.is-blocks.pic-left .photo { left: 0; width: 384px; }
  .layer .deck-sl.is-blocks.pic-right .photo { right: 0; width: 384px; }
  .layer .deck-sl.is-blocks.pic-behind .photo { left: 0; right: 0; }
  .layer .deck-sl.is-blocks.pic-behind .veil { inset: 0; }
  .layer .deck-sl.is-blocks .blk-steps .tick { box-shadow: none; }
  .side > .part, .side > .pre { display: block; }
  .side > .part.only { display: none; }
  .part { padding: 0 0 7mm; margin: 0; border-top: 0; break-inside: avoid; page-break-inside: avoid; }
  .sect { margin: 0 0 6mm; padding: 0 0 4mm; border-radius: 0; background: none; border-bottom: 1.5px solid #DADCE4; break-after: avoid; page-break-after: avoid; }
  .part h2 { font-size: 15pt; margin-right: 0 !important; }
  .sect h2 { font-size: 17pt; }
  .part img, .pre img, .part .pic, .tw { break-inside: avoid; page-break-inside: avoid; }
  /* A table prints whole: no sideways scroll, and no edge fade (#795), which on paper would hide its last columns. */
  .tw, .tw.is-scrollable-left, .tw.is-scrollable-right { overflow: visible; -webkit-mask: none; mask: none; }
  .prompt, .prompt.ai { display: block; margin: 0 0 4mm; padding: 0; border-radius: 0; background: none; break-inside: avoid; page-break-inside: avoid; }
  .prompt pre, .prompt.ai pre { padding: 3mm 4mm; border: 1px solid #C9CBD6; border-radius: 8px; background: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .steps label { background: none; box-shadow: none; border: 1px solid #DADCE4; break-inside: avoid; page-break-inside: avoid; }
  .steps input { box-shadow: none; border: 1.5px solid #8A8DA3; }
  /* A Button on paper keeps its own width beside its words, as on a wide page, not the phone's full-width row (the
     printed column is under the page's 860 px; the Experience lead on Sprint 170 PR 3). */
  .pbutton:not(.is-solo) { flex-direction: row; align-items: center; gap: 16px; padding: 10px 12px 10px 18px; }
  .pbutton:not(.is-solo) .blk-btn { justify-content: flex-start; }
  .foot { display: block; order: 2147483647; margin-top: 0; padding-top: 3mm; border-top: 1px solid #DADCE4; font: 400 9pt/1.4 'Sofia Sans', sans-serif; color: #6B6F94; break-before: avoid; page-break-before: avoid; break-inside: avoid; page-break-inside: avoid; }
  .foot.addr-only { display: block; border-top: 0; }
  .foot.addr-only:has(> .paddr:empty) { display: none; }
  .paddr { display: inline; overflow-wrap: anywhere; }
  .foot > span + .paddr::before { content: ' \\00b7  '; }
  .paddr:empty { display: none; }
  /* Sprint 163: a slide with tabs prints every tab, one after another, each under its name: the slide grows down to
     hold them, and nothing scrolls or fades on paper. */
  .layer:has(.blk-tabs), .layer:has(.blk-tabs) > .deck-slide { height: auto; }
  .layer:has(.blk-tabs) .deck-sl { position: relative; height: auto; min-height: 540px; }
  .layer:has(.blk-tabs) .deck-sl.is-blocks .blk-flow { position: relative; inset: auto; display: block; margin: 46px 64px 34px; overflow: visible; }
  .layer:has(.blk-tabs) .deck-sl.is-blocks.pic-left .blk-flow { margin-left: 432px; }
  .layer:has(.blk-tabs) .deck-sl.is-blocks.pic-right .blk-flow { margin-right: 432px; }
  .layer .deck-sl.is-blocks .blk-tabbar { display: none; }
  .layer .deck-sl.is-blocks .blk-tabpanes { display: block; }
  .layer .deck-sl.is-blocks .blk-tabpane { display: block; visibility: visible; overflow: visible; }
  .layer .deck-sl.is-blocks .blk-tabpane + .blk-tabpane { border-top: 1px solid var(--s-boxl, rgba(255,255,255,.12)); }
  .layer .deck-sl.is-blocks .blk-tabname { display: block; margin: 0 0 .4em; font-weight: 700; color: var(--s-hd, #fff); }
  .layer .deck-sl.is-blocks :is(.blk-tabpane, .blk-column) { overflow: visible; animation: none; -webkit-mask-image: none; mask-image: none; }
  .tabsec { break-inside: avoid; page-break-inside: avoid; }
}
`;

/**
 * Sprint 170 PR 2 (#885; the decks README, "Save as PDF, from Publish"): Save slides as PDF's page. One 16:9 page a
 * slide, drawn as on the wall: the wall's renderer at its own 960 × 540 layout, unscaled, on the theme's ground and glow
 * (`--ground`, the wall's `wallGround`; white on Borderless), with every reveal shown and each tab as the slide holds it
 * (the chosen tab). A section is drawn as its slide, as on the wall. The text, the page's line and its controls are not
 * drawn; Copy and ↗ aren't drawn, and Buttons stay links. Skipped slides, comments and notes are never on the page
 * (`publicDeck`).
 *
 * These rules hold on screen too, not only in print: this page is only ever printed (patch 021's hidden window), and
 * with every slide laid out on screen the page's script fits every slide's Tabs band (`PAGE_TABS_FIT` measures only a
 * band that has a width), not only the first slide's. The page's own position and scale, set by its script for the
 * window, give way to the paper's. Each slide after the first starts a page, so the last leaves no blank one.
 */
export const SLIDES_PRINT_CSS = `
@page { size: 960px 540px; margin: 0; }
html, body { width: 960px; height: auto; margin: 0; overflow: visible; background: var(--ground); }
.ground, .line, .prog, .toc, .toast, .zoom, .restart, .side, .foot, .empty, .prefetch, .copy, .prompt .open, .cb-tools { display: none !important; }
.wrap, .view, .frame { position: static !important; display: block !important; inset: auto !important; width: 960px !important; height: auto !important; margin: 0; padding: 0; transform: none !important; }
.layer, .layer:not(.on):not(.leaving) { position: relative !important; inset: auto !important; display: block !important; width: 960px; height: 540px; margin: 0; overflow: hidden; visibility: visible; opacity: 1 !important; animation: none !important; background: var(--ground); break-inside: avoid; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.layer + .layer { break-before: page; page-break-before: always; }
.layer > .deck-slide { position: absolute; inset: 0; width: 960px; height: 540px; overflow: hidden; }
.layer .deck-sl { transform: none !important; width: 960px; height: 540px; }
.layer .deck-sl [data-reveal-hidden] { visibility: visible; }
.layer .deck-sl.is-blocks .photo { top: 0; bottom: 0; }
.layer .deck-sl.is-blocks.pic-left .photo { left: 0; width: 384px; }
.layer .deck-sl.is-blocks.pic-right .photo { right: 0; width: 384px; }
.layer .deck-sl.is-blocks.pic-behind .photo { left: 0; right: 0; }
.layer .deck-sl.is-blocks.pic-behind .veil { inset: 0; }
`;

/**
 * Sprint 170 PR 3 (#886; the decks README, "Save as PDF, from Publish"): Save handout as PDF's page. The page's own A4
 * print (`PRINT_CSS` and its order, after which these come, so they win), with the text alone: no slide is drawn, so no
 * slide picture either, and each part starts under its number and heading. The number counts the shown slides, as the
 * page and Present do (a skipped slide is never on the page, so after one it differs from the editor's rail), in the
 * left margin beside the part's first line, muted and bold (`handoutNumbersCss` gives each part its own). A section keeps
 * its band ("SECTION 2" over its title) and starts a page, as in the page's print, even with no text of its own
 * (`partHtml`). Any other slide whose part has no text has nothing here.
 */
export const HANDOUT_PRINT_CSS = `
@media print {
  .layer, .prefetch { display: none !important; }
  .part:not(.sect):not(.only) { position: relative; padding-left: 10mm; }
  .pre { padding-left: 10mm; }
  .part:not(.sect):not(.only)::before { position: absolute; left: 0; top: 0; width: 8mm; font: 700 10pt/18.75pt 'Sofia Sans', sans-serif; color: var(--muted); font-variant-numeric: tabular-nums; }
  .sect { width: calc(100% - 10mm); margin-left: 10mm; }
}
`;

/** Each printed part's number in Save handout as PDF (`HANDOUT_PRINT_CSS`): part n (`#t<n>`) shows n; a section shows its band instead. Only numbers reach it. */
export function handoutNumbersCss(count: number): string {
  const rules: string[] = [];
  for (let number = 1; number <= count; number++) rules.push(`#t${number}:not(.sect)::before{content:"${number}"}`);
  return rules.length ? `@media print{${rules.join('')}}` : '';
}

/**
 * Whether Save handout as PDF has anything to print: the text before the first slide, or a part with text (a slide whose
 * part is empty prints nothing there, `isSlideOnly`).
 */
export function handoutHasText(deck: Pick<PublicDeck, 'preamble' | 'slides' | 'textHandout'>): boolean {
  if (showsAnything(handoutHtml(deck.preamble, { partKey: 'preamble', exercise: false, pictureUrl: () => 'picture' }))) return true;
  return deck.slides.some(slide => !isSlideOnly(slide, deck.textHandout === true));
}

/**
 * Each slide and part's place in the printed column (`PRINT_CSS`): slide n (`#s<n>`) before part n (`#t<n>`), after the
 * preamble. A section (its place in `sections`) prints as its band alone: its slide is left out and its part starts a
 * page. Only numbers reach it.
 */
export function printOrderCss(count: number, sections: ReadonlySet<number> = new Set()): string {
  const rules: string[] = [];
  for (let index = 0; index < count; index++) {
    const layer = `#s${index + 1}`;
    const part = `#t${index + 1}`;
    rules.push(sections.has(index)
      ? `${layer}{display:none!important}${part}{order:${index * 2 + 2};break-before:page;page-break-before:always}`
      : `${layer}{order:${index * 2 + 1}}${part}{order:${index * 2 + 2}}`);
  }
  return rules.length ? `@media print{.pre{order:0}${rules.join('')}}` : '';
}

/**
 * The page's colours (Sprint 163 PR 4): the slide's ground to the window's edges (the wall's `wallGround`), and the
 * line, More and the text in the theme's own colours on that ground, its Borderless look on white. Ritemark's nowhere.
 */
function pageColours(deck: PublicDeck): string {
  const borderless = deck.look === 'borderless';
  const on = themeVars(deck.theme, borderless);
  const dark = !borderless && groundOf(deck.theme.bg) === 'dark';
  const solid = borderless ? '#FFFFFF' : deck.theme.bg;
  const vars: Record<string, string> = {
    ground: wallGround(deck.theme, borderless),
    gs: solid,
    ink: on.hd,
    text: on.tx,
    muted: on.sub,
    label: on.acct,
    link: dark ? mix(deck.theme.accent, '#FFFFFF', 0.35) : on.hd,
    // Sprint 163 PR 3: the words on a button in the accent (the Steps pill's ink).
    onacc: on.tagfg,
    accent: deck.theme.accent,
    line: on.boxl,
    soft: on.box,
    soft2: on.boxl,
    band: on.box,
    hl: on.thbg,
    stepbg: on.box,
    stepline: on.boxl,
    quiet: dark ? 'rgba(255,255,255,.5)' : 'rgba(28,31,74,.42)',
    slidebg: borderless ? 'transparent' : deck.theme.bg,
    // The quiet line: its words and buttons on the ground (the theme's ink, softened), as Productory's web decks have it.
    lstrong: on.hd,
    lbtn: dark ? 'rgba(255,255,255,.78)' : 'rgba(28,31,74,.74)',
    lmuted: dark ? 'rgba(255,255,255,.6)' : 'rgba(28,31,74,.58)',
    lhover: dark ? 'rgba(255,255,255,.07)' : 'rgba(28,31,74,.06)',
    lpress: dark ? 'rgba(255,255,255,.13)' : 'rgba(28,31,74,.11)',
    lsep: dark ? 'rgba(255,255,255,.12)' : 'rgba(28,31,74,.12)',
    lbar: dark ? `${solid}EB` : 'rgba(255,255,255,.92)',
    sidebg: dark ? 'rgba(8,9,30,.34)' : 'rgba(28,31,74,.035)',
    // Sprint 162 PR 3 (step-3-themes.md, 16 November): the content wears the theme's fonts; the page's own controls
    // keep Sofia Sans (their rules name it).
    fh: on.fh,
    fb: on.fb,
  };
  const page = Object.entries(vars).map(([key, value]) => `--${key}:${value}`).join(';');
  const slide = Object.entries(themeStyle(deck.theme, borderless)).map(([key, value]) => `${key}:${value}`).join(';');
  // Theme values are colours and font names from a fixed list (deckTheme.ts, themeVars.ts); `<` can't close the style.
  // The slide's own properties are the page's too, so the line's tick and accent read the same values the slide does.
  return `:root{${page};${slide}}\n.deck-slide{${slide}}`.replace(/</g, '\\3c ');
}

function fontFaces(fonts: PageFont[], themeFonts: readonly PageThemeFont[] = []): string {
  const sofia = fonts.map(font => `@font-face{font-family:'Sofia Sans';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font.base64}) format('woff2');unicode-range:${font.unicodeRange};}`);
  // The theme's own fonts, as files beside the page (relative addresses only: a font is never loaded from elsewhere).
  const theme = themeFonts
    .filter(font => /^fonts\/[A-Za-z0-9.-]+\.woff2$/.test(font.address) && /^[A-Za-z0-9 ]+$/.test(font.family))
    .map(font => `@font-face{font-family:'${font.family}';font-style:normal;font-weight:100 900;font-display:swap;src:url(${font.address}) format('woff2');unicode-range:${font.unicodeRange};}`);
  return [...sofia, ...theme].join('\n');
}

const titleOf = (slide: PublicSlide) => (slide.data.title ?? '').trim();

/**
 * A block slide's Steps (Sprint 161): its Label's words ('' for none; Sprint 164 PR 3, the Label that was its pill), or
 * null when it has no Steps block. A slide with Steps is an exercise on the page, as an Exercise slide is.
 */
function blockStepsTag(slide: PublicSlide): string | null {
  return isBlockSlide(slide.kind) ? blockStepsLabelOf(slide.data.markdown ?? '') : null;
}

/**
 * A section: an old Section slide, or a block slide drawn as one (its number over its title, PR 2; or its header's
 * `section: true`, PR 3: how a Section slide converts). Its number ('' for none), or null for any other slide.
 */
function sectionNumberOf(slide: PublicSlide): string | null {
  if (slide.section !== undefined) return slide.section;
  if (slide.kind === 'section') return (slide.data.number ?? '').trim();
  if (!isBlockSlide(slide.kind)) return null;
  const number = blockSectionNumberOf(slide.data.markdown ?? '');
  // PR 3: a header that says `section: true` is a section with or without a number over its title.
  return slide.data.section === true ? number ?? '' : number;
}

/** An Exercise slide, or a block slide with Steps: its steps get ticks, and Contents ticks it when done. */
function isExercise(slide: PublicSlide): boolean {
  return slide.kind === 'exercise' || blockStepsTag(slide) !== null;
}

/** An exercise's pill beside its label and in Contents: the slide's own words (`tag:`, a block slide's Label), the default, or none. */
function pillHtml(slide: PublicSlide): string {
  const words = slide.kind === 'exercise' ? exerciseTagOf(slide.data) : blockStepsTag(slide) ?? '';
  return words ? `<span class="tag">${esc(words)}</span>` : '';
}

/** Words or a picture, a table, a code block or a line: anything a viewer would see of a handout drawn as HTML. */
function showsAnything(html: string): boolean {
  if (/<(img|table|pre|hr|svg|iframe|video|audio)\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;| /g, ' ').trim() !== '';
}

/**
 * A slide with no handout (Jarmo, 17 November: "Kui teeme Publish siis ärme näita seda vaatajale"): its part has no
 * heading and no text, so More isn't offered on it and print shows only its slide. A part of a deck written before 16
 * November shows its slide's title as its heading until the first edit (no `handout: text` mark), so it is one only when
 * its slide has no title either: a part is slide-only once the person has emptied it.
 */
export function isSlideOnly(slide: Pick<PublicSlide, 'handout' | 'data'>, textHandout: boolean): boolean {
  const { html } = handoutParts(slide.handout, { partKey: 'slide-only', exercise: false, pictureUrl: () => 'picture', partHeading: true });
  if (showsAnything(html)) return false;
  return textHandout || titleOf(slide as PublicSlide) === '';
}

/** More's part for one shown slide: its text, under its heading. */
function partHtml(slide: PublicSlide, index: number, options: PageOptions, partKey: string, textHandout: boolean, slideOnly: boolean, openIn: boolean): string {
  const number = index + 1;
  // A slide with no handout: its place only, with nothing in it (More isn't offered on it).
  // Save handout as PDF (Sprint 170 PR 3) draws no slide, so a section prints as its band there even with no text, its
  // slide's title as its heading when the part has none: the handout keeps its sections.
  const handoutSection = options.print === 'handout' && sectionNumberOf(slide) !== null;
  if (slideOnly && !handoutSection) return `<div class="part only" data-i="${index}" id="t${number}" aria-hidden="true"></div>`;
  // A part's heading is its handout's own (16 November). A part without one shows its slide's title, as the deck view
  // draws it until the first edit writes it, unless the deck is marked `handout: text`: then it shows none.
  const exerciseSlide = isExercise(slide);
  const { html: body, ownHeading } = handoutParts(slide.handout, { partKey, exercise: exerciseSlide, pictureUrl: options.pictureUrl, partHeading: true, openIn });
  const title = ownHeading || (textHandout && !handoutSection) ? '' : titleOf(slide);
  const section = sectionNumberOf(slide);
  if (section !== null) {
    const label = `Section${section ? ` ${section}` : ''}`;
    return `<section class="part sect" data-i="${index}" id="t${number}"><div class="eyebrow">${esc(label)}</div>${title ? `<h2>${esc(title)}</h2>` : ''}\n${body}</section>`;
  }
  return `<article class="part" data-i="${index}" id="t${number}">${title ? `<h2>${esc(title)}</h2>` : ''}\n${body}</article>`;
}

/** Contents: every slide by its title; an exercise shows its tag, and a check in its place once its steps are done. */
function contentsHtml(slides: PublicSlide[]): string {
  const rows = slides.map((slide, index) => {
    const title = titleOf(slide) || `Slide ${index + 1}`;
    const mark = isExercise(slide)
      ? `${pillHtml(slide)}<span class="done" aria-label="Done">${iconSvg('check', 16)}</span>`
      : '';
    return `<button type="button" role="menuitem" data-go="${index}"><span class="n">${index + 1}</span><span class="${sectionNumberOf(slide) !== null ? 'sec' : ''}">${esc(title)}</span>${mark}</button>`;
  });
  return `<div class="toc" id="toc" role="menu" aria-label="Contents" hidden><div class="hd">Contents</div>${rows.join('')}</div>`;
}

/** The script element's text, exactly: what the page's Content Security Policy hashes. */
const SCRIPT_TEXT = `\n${PAGE_SCRIPT}\n`;

/**
 * The page's Content Security Policy: its one script by its hash, so nothing else runs (no inline handler, no other
 * script); styles its own (inline), fonts its own (inline, and the theme's beside it); pictures from beside it (and from
 * disk when the file is opened there, as in the room without a network); and nothing loaded from anywhere else. It goes
 * first in the head.
 */
export const PAGE_CSP = [
  "default-src 'none'",
  `script-src 'sha256-${createHash('sha256').update(SCRIPT_TEXT).digest('base64')}'`,
  "style-src 'unsafe-inline'",
  // Sofia Sans inline, and the theme's fonts from beside the page (`'self'` online, `file:` when opened from disk).
  "font-src 'self' data: file:",
  "img-src 'self' data: file:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * The page's place for a slide in the reader's storage: its title, and which slide of that title it is, never its place
 * in the deck, so a slide added before an exercise keeps its ticks, and two exercises with one title keep theirs apart.
 */
function slideKeys(slides: readonly PublicSlide[]): string[] {
  const titles = new Map<string, number>();
  return slides.map(slide => {
    const title = titleOf(slide);
    const nth = (titles.get(title) ?? 0) + 1;
    titles.set(title, nth);
    return `part\u0000${title}\u0000${nth}`;
  });
}

/** The page: one HTML file, the same bytes for the same deck. */
export function pageHtml(deck: PublicDeck, assets: PageAssets, options: PageOptions): string {
  const borderless = deck.look === 'borderless';
  // The logo's address is the file beside the page; a theme whose logo isn't there draws none (Sprint 162 PR 4).
  // It is the one file its slides draw (`pageFile.pageLogoOf`, the second version too), so the page's theme names that
  // file as its only logo: no second version is chosen again here (the review of #798).
  const theme = deck.theme.logo && assets.logo
    ? { ...deck.theme, logo: { file: deck.theme.logo.file, place: deck.theme.logo.place, on: deck.theme.logo.on }, logoUrl: assets.logo.address, ...(assets.logo.aspect ? { logoAspect: assets.logo.aspect } : {}) }
    : deck.theme;
  const count = deck.slides.length;
  // Small details 14: an Agenda lists the page's sections as they are, with no progress and no hint when there are none.
  const agenda = { entries: agendaOf(deck.slides.map((slide, index) => ({ kind: slide.kind, data: slide.data, number: index + 1 }))), hint: false };
  // A deck's `open-in: none` leaves out the prompts' "Open in" links, on its slides and in its text; every other deck has them.
  const openIn = deck.openInOff !== true;
  const keys = slideKeys(deck.slides);
  const layers = deck.slides.map((slide, index) => {
    const drawing = {
      theme,
      borderless,
      step: slide.step,
      pictureUrl: (picture: string) => options.pictureUrl(picture, 'slide'),
      agenda,
      openIn,
      // The page only: the steps' ticks, and the slide read as the page's text.
      ticks: true,
      readable: true,
      // Sprint 163 PR 3: a button on a slide is a real link to its full https address, in a new tab.
      buttonLinks: true,
    };
    // A block slide through the one block renderer (Sprint 161), a v1 slide through its layout, as the deck view draws them.
    const block = isBlockSlide(slide.kind);
    const markup = block ? blockSlideMarkup(slide.data, drawing) : slideMarkup(slide.kind, slide.data as SlideData, drawing);
    const items = block ? blockRevealCount(slide.data.markdown ?? '') : 0;
    const title = titleOf(slide);
    const label = `Slide ${index + 1} of ${count}${title ? `: ${title}` : ''}`;
    const marks = [
      `class="layer${block ? ' flow' : ''}${index === 0 ? ' on' : ''}"`,
      `id="s${index + 1}"`,
      `data-i="${index}"`,
      `data-key="${shortHash(keys[index])}"`,
      items > 0 ? `data-items="${items}"` : '',
      isExercise(slide) ? 'data-exercise=""' : '',
      'role="group"',
      'tabindex="-1"',
      'aria-roledescription="slide"',
      `aria-label="${esc(label)}"`,
      index === 0 ? '' : 'aria-hidden="true"',
    ].filter(Boolean).join(' ');
    return `<section ${marks}>${markup}</section>`;
  });
  // The pictures a slide draws as its ground (on the side, Behind), once more as hidden pictures (the smoke run of 19
  // November): a slide not yet shown is hidden, so its ground would be fetched only as it prints, and a first print could
  // miss it. Hidden, they all come once the page has loaded, and print finds them in (`pageScript`: ⌘P waits for them).
  const grounds = [...new Set(layers.flatMap(layer => Array.from(layer.matchAll(/background-image:url\(&quot;(.*?)&quot;\)/g), found => found[1])))];
  // Lazy, so they never compete with the page's first paint: the script fetches them once the page has loaded.
  const prefetch = grounds.length ? `<div class="prefetch" hidden aria-hidden="true">${grounds.map(url => `<img src="${url}" alt="" loading="lazy">`).join('')}</div>` : '';
  const preamble = handoutHtml(deck.preamble, { partKey: 'preamble', exercise: false, pictureUrl: options.pictureUrl, openIn });
  // Which slides have no handout: read once, for More and for print.
  const slideOnly = deck.slides.map(slide => isSlideOnly(slide, deck.textHandout === true));
  // Small details 13 (18 November): the sections printed as their bands (a section whose part shows nothing keeps its slide).
  const printedSections = new Set(deck.slides.flatMap((slide, index) => (sectionNumberOf(slide) !== null && (!slideOnly[index] || options.print === 'handout') ? [index] : [])));
  const parts = deck.slides.map((slide, index) => partHtml(slide, index, options, keys[index], deck.textHandout === true, slideOnly[index], openIn));
  // The reader's storage is the page's own: its client and session, or, for a deck with no title of its own, its file's
  // name, hashed (never on the page), so two such decks in one folder keep their ticks and places apart. It is the key
  // such a page had before Sprint 163 PR 4, when its title was the file's name.
  const pageKey = shortHash(`${deck.client}\u0000${deck.title || options.name || ''}`);
  const who = `<div class="who"><b>${esc(deck.client)}</b>${deck.title ? `<span>${esc(deck.title)}</span>` : ''}</div>`;
  const foot = [deck.client, deck.title].filter(Boolean).map(esc).join(' · ');
  // Small details 13: the printed handout's footer carries the page's address (the script writes it; never on screen).
  const footer = `<div class="foot${foot ? '' : ' addr-only'}">${foot ? `<span>${foot}</span>` : ''}<span class="paddr" id="paddr"></span></div>`;
  const tip = (words: string) => `data-tip="${esc(words)}"`;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta name="generator" content="${GENERATOR_META}">`,
    `<meta name="${DIGEST_META}" content="${esc(options.digest)}">`,
    `<title>${esc(deck.title || deck.client || 'Slides')}</title>`,
    `<style>\n${fontFaces(assets.fonts, assets.themeFonts)}\n${PAGE_CSS}\n${assets.slideCss.replace(/<\/style/gi, '<\\/style')}\n${pageColours(deck)}\n${options.print === 'slides' ? SLIDES_PRINT_CSS : `${PRINT_CSS}\n${printOrderCss(count, printedSections)}${options.print === 'handout' ? `\n${HANDOUT_PRINT_CSS}\n${handoutNumbersCss(count)}` : ''}`}\n</style>`,
    '</head>',
    // The ticks' and the reader's place in this browser's storage: the same for every version of the page that keeps its
    // client and title. The deck's transition, as the wall plays it.
    `<body class="${borderless ? 'bl' : 'card'}" data-store="ritemark-ticks-${pageKey}" data-place="ritemark-place-${pageKey}" data-transition="${esc(deck.transition ?? 'fade')}">`,
    '<div class="ground" aria-hidden="true"></div>',
    '<div class="wrap" id="wrap">',
    `<main class="view" id="view" aria-label="Slides"><div class="frame" id="frame">\n${layers.join('\n')}\n</div></main>`,
    prefetch,
    `<aside class="side" id="side" aria-label="The text for this slide" hidden><button class="fb ic sclose" id="sclose" type="button" aria-label="Hide the text" ${tip('Hide the text')}>${iconSvg('x', 16)}</button>`,
    preamble ? `<div class="pre" data-i="0">\n${preamble}</div>` : '',
    parts.join('\n'),
    '</aside>',
    footer,
    '</div>',
    count ? '' : '<p class="empty">This deck has no slides to show.</p>',
    `<footer class="line" id="line">${who}`
      + `<button class="fb" id="morebtn" type="button" aria-expanded="false" aria-controls="side" ${tip('The text for this slide')} hidden>${iconSvg('notebook', 16)}<span class="lbl">More</span></button>`
      + '<span class="sep" id="moresep" hidden></span>'
      + `<button class="fb ic" id="prev" type="button" aria-label="Previous slide" ${tip('Previous slide')} disabled>${iconSvg('caret-left', 16)}</button>`
      + `<span class="pos" id="pos" aria-live="polite">${count ? `1 / ${count}` : ''}</span>`
      + `<button class="fb ic" id="next" type="button" aria-label="Next slide" ${tip('Next slide')}${count > 1 ? '' : ' disabled'}>${iconSvg('caret-right', 16)}</button>`
      + '<span class="sep"></span>'
      + `<button class="fb" id="tocbtn" type="button" aria-expanded="false" aria-controls="toc" ${tip('Every slide, to jump to one')}>${iconSvg('list', 16)}<span class="lbl">Contents</span></button></footer>`,
    `<div class="prog" aria-hidden="true"><i id="bar" style="width:${count ? (100 / count).toFixed(4) : 0}%"></i></div>`,
    contentsHtml(deck.slides),
    // "Start from the beginning" (small details 7): shown by the script for 5 s when the page returns to a reader's place.
    '<button class="restart" id="restart" type="button" hidden>Start from the beginning</button>',
    '<div class="toast" id="toast" role="status" hidden></div>',
    // Experience 49: the full-size view of a picture; the page's script puts a copy of the clicked picture in it.
    '<div class="zoom" id="zoom" role="dialog" aria-modal="true" aria-label="The picture, full size" tabindex="-1" hidden>'
      + `<button class="zoom-x" type="button" aria-label="Close">${iconSvg('x', 20)}</button>`
      + '<div class="zoom-pic"></div></div>',
    `<script>${SCRIPT_TEXT}</script>`,
    '</body>',
    '</html>',
  ].filter(line => line !== '').join('\n') + '\n';
}
