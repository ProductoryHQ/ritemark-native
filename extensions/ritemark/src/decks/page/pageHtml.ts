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
import { agendaOf, blockSectionNumberOf, blockSlideMarkup, blockStepsTagOf } from '../blocks/slideRenderer';
import { isRelativeTarget } from '../deckLibraryFormat';
import { slideMarkup, escapeHtml } from '../../../webview/src/components/decks/slide/slideMarkup';
import { themeStyle, themeVars } from '../../../webview/src/components/decks/theme/themeVars';
import { iconSvg } from '../../../webview/src/components/decks/slide/pageIcons';
import { MARKED_OPTIONS, lexHandout, type PublicDeck, type PublicSlide } from './publicDeck';
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

  html(html: string): string {
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
/** A button's icons in the page's text (Sprint 163 PR 3): a page for a file, an arrow out for any other address. */
const PAGE_BUTTON_ICONS = { file: iconSvg('file-text', 16), link: iconSvg('arrow-up-right', 16) };

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
  let out = '';
  tokens.forEach((token: Token, index: number) => {
    if (token.type === 'list' && token.ordered && options.exercise) {
      for (const item of token.items) {
        item.task = true;
        item.checked = false;
      }
    }
    if (token.type === 'html') {
      // A block of raw HTML is shown as its words, a paragraph of its own; a comment alone leaves nothing.
      const words = sanitizeHtml(token.text).trim();
      if (words) out += `<p>${words}</p>\n`;
      return;
    }
    // Sprint 163 PR 3: a Button block: its words beside it, and a real link to its full https address in a new tab
    // (any other address draws an inert button). Files stay where they are: Publish carries none.
    const button = token.type === 'paragraph' ? buttonParagraphOf(token.tokens) : null;
    if (button) {
      out += buttonHtml({ wordsHtml: parser.parseInline(button.words), label: button.label, href: button.href, icons: PAGE_BUTTON_ICONS, mode: 'link', className: 'pbutton' });
      return;
    }
    if (token.type === 'paragraph' && PROMPT_LABEL.test(token.text.trim())) {
      const next = tokens.slice(index + 1).find(entry => entry.type !== 'space');
      if (next?.type === 'code') {
        out += `<div class="k">${parser.parseInline(token.tokens ?? [])}</div>\n`;
        return;
      }
    }
    out += parser.parse([token] as Parameters<typeof parser.parse>[0]);
  });
  return { html: out, ownHeading };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** The page's own look, the learner page's (experience 46), its colours from the deck's theme on white. */
export const PAGE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: #FFFFFF; color: var(--text); font: 400 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
button, a, label, [data-go] { cursor: pointer; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 4px; }
svg { flex: none; }
.top { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,.94); -webkit-backdrop-filter: saturate(1.4) blur(8px); backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--line); }
.top .in { max-width: 1320px; margin: 0 auto; padding: 0 24px; height: 56px; display: flex; align-items: center; gap: 14px; }
.top .who { min-width: 0; display: flex; align-items: baseline; gap: 10px; font-family: 'Sofia Sans', sans-serif; }
.top .who b { font: 700 15px/1.2 'Sofia Sans', sans-serif; color: var(--ink); white-space: nowrap; }
.top .who span { font: 400 14.5px/1.2 var(--fh); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top .grow { flex: 1; }
.top .pos { font: 600 13px/1 'Sofia Sans', sans-serif; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Small details 7: a quiet way back to the top when the page returns to a reader's place, for 5 s. */
.restart { height: 30px; padding: 0 10px; border-radius: 8px; color: var(--muted); font: 600 13px/30px 'Sofia Sans', sans-serif; white-space: nowrap; animation: restart-in .3s ease; }
.restart:hover { background: var(--soft); color: var(--ink); }
.restart[hidden] { display: none; }
@keyframes restart-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .restart { animation: none; } }
.cbtn { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 9px; background: var(--soft); color: var(--ink); font: 600 13.5px/34px 'Sofia Sans', sans-serif; white-space: nowrap; }
.cbtn:hover { background: var(--soft2); }
.bar { height: 3px; background: var(--line); }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .3s ease; }
.toc { position: fixed; z-index: 30; top: 64px; right: max(16px, calc((100vw - 1320px) / 2 + 24px)); width: min(360px, calc(100vw - 32px)); max-height: min(70vh, 560px); overflow: auto; padding: 8px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px var(--line), 0 18px 40px -12px rgba(28,31,74,.3); }
.toc[hidden] { display: none; }
.toc .hd { padding: 8px 10px 6px; font: 700 11.5px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); }
.toc button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 6px 10px; border-radius: 8px; text-align: left; font: 500 14.5px/20px var(--fh); color: var(--ink); }
.toc button:hover { background: var(--soft); }
.toc button.on { background: var(--hl); }
.toc .n { width: 22px; flex: none; text-align: right; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.toc .sec { font-weight: 700; }
.toc .tag, .part .lab .tag { min-width: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; padding: 1px 8px; border-radius: 10px; background: var(--hl); color: var(--label); font: 700 11px/18px 'Sofia Sans', sans-serif; letter-spacing: .4px; text-transform: uppercase; }
.toc .tag { margin-left: auto; }
.toc .done { margin-left: auto; color: #16A34A; display: none; }
.toc button.finished .done { display: inline-flex; }
.toc button.finished .tag { display: none; }
.wrap { max-width: 1320px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 48px; }
.stage { position: sticky; top: 59px; height: calc(100vh - 59px); display: flex; flex-direction: column; justify-content: center; }
.slidebox { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 44px -18px rgba(28,31,74,.5); background: var(--slidebg); }
.layer { position: absolute; inset: 0; opacity: 0; visibility: hidden; transition: opacity .45s ease, visibility 0s linear .45s; }
.layer.on { opacity: 1; visibility: visible; transition: opacity .45s ease, visibility 0s; }
.layer > .deck-slide { position: absolute; inset: 0; width: 100%; height: 100%; }
.layer .deck-sl { transform: scale(var(--k, .6)); }
.under { margin-top: 12px; display: flex; align-items: center; gap: 10px; font: 500 13px/18px 'Sofia Sans', sans-serif; color: var(--muted); }
.under .t { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav { display: flex; gap: 6px; }
.nav button { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; background: var(--soft); color: var(--ink); }
.nav button:hover { background: var(--soft2); }
.nav button[disabled] { opacity: .35; pointer-events: none; }
.text { padding: 28px 0 55vh; min-width: 0; font-family: var(--fb); }
.pre h1, .pre h2, .pre h3, .pre h4, .pre h5 { font-family: var(--fh); }
.pre { padding: 0 0 18px; }
.part { padding: 26px 0 18px; border-top: 1px solid var(--line); scroll-margin-top: 80px; transition: opacity .3s; }
.text > .part:first-child, .pre + .part { border-top: 0; padding-top: 8px; }
/* A slide with no handout (17 November): nothing of it in the text, only its place, so scrolling past the gap between
   its neighbours still brings its slide up for a moment, as when presenting. */
.part.only { height: 0; padding: 0; border-top: 0; overflow: hidden; }
.text > .part.only:first-child + .part, .pre + .part.only + .part { border-top: 0; padding-top: 8px; }
.part.dim { opacity: .5; }
/* A section that isn't the current part keeps its grey band; its words dim as every other part's text does. */
.sect.dim { opacity: 1; }
.sect > * { transition: opacity .3s; }
.sect.dim > * { opacity: .5; }
.part .lab { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--label); }
.part h2 { margin: 0 0 10px; font: 700 25px/1.25 var(--fh); color: var(--ink); text-wrap: balance; }
.part h3 { margin: 18px 0 8px; font: 700 19px/1.3 var(--fh); color: var(--ink); }
.part h4, .part h5 { margin: 16px 0 6px; font: 700 16.5px/1.35 var(--fh); color: var(--ink); }
.part p, .pre p { margin: 0 0 14px; }
.part ol, .part ul, .pre ol, .pre ul { margin: 0 0 14px; padding-left: 24px; }
.part li { margin-bottom: 6px; }
.part li > p { margin: 0 0 6px; }
.part a, .pre a { color: var(--ink); text-decoration-color: var(--accent); text-underline-offset: 2px; }
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
.part img, .pre img, .stage .deck-sl .blk-pic, .stage .deck-sl .pic img, .stage .deck-sl .photo:not(.empty) { cursor: zoom-in; }
.zoom { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(10, 11, 30, .86); cursor: zoom-out; }
.zoom[hidden] { display: none; }
.zoom:focus { outline: none; }
/* A picture Behind the words: a click on the slide reaches it through the veil and the words (none of them a link). */
.stage .deck-sl.pic-behind .veil, .stage .deck-sl.pic-behind .blk-flow { pointer-events: none; }
.stage .deck-sl.pic-behind .blk-flow img { pointer-events: auto; }
.zoom-pic { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.zoom-pic > img { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; margin: 0; border-radius: 8px; box-shadow: 0 18px 60px rgba(0, 0, 0, .45); object-fit: contain; }
/* The way out: an × at the top right, 44 px to tap (a click or a tap anywhere closes it too, and Esc). */
.zoom-x { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 22px; background: rgba(255, 255, 255, .16); color: #fff; cursor: pointer; }
.zoom-x:hover { background: rgba(255, 255, 255, .26); }
.zoom-pic > .zoom-photo { width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat; background-position: center; }
.part blockquote, .pre blockquote { margin: 0 0 14px; padding: 2px 0 2px 14px; border-left: 3px solid var(--line); color: var(--muted); }
.part hr, .pre hr { border: 0; border-top: 1px solid var(--line); margin: 18px 0; }
.part code, .pre code { font: 400 .9em/1.5 ui-monospace, Menlo, Consolas, monospace; background: var(--soft); padding: 1px 5px; border-radius: 5px; }
.tw { overflow-x: auto; margin: 0 0 14px; scrollbar-width: thin; scrollbar-color: rgba(30, 27, 75, .3) transparent; container-type: inline-size; } /* the thumb only, no track behind it (Jarmo: "system scrollbaridel ei tohi olla tausta"); the frame a column's stored share counts against (handoutTableHtml) */
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
.prompt pre { margin: 0; padding: 14px 16px; padding-right: 104px; border-radius: 12px; background: var(--soft); white-space: pre-wrap; overflow-wrap: anywhere; }
.prompt pre code { font: 400 14px/1.6 ui-monospace, Menlo, Consolas, monospace; color: var(--ink); background: none; padding: 0; }
.copy { position: absolute; right: 10px; top: 10px; display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 8px; background: var(--ink); color: #fff; font: 700 12.5px/30px 'Sofia Sans', sans-serif; white-space: nowrap; }
.copy > span { display: inline-flex; align-items: center; gap: 6px; }
.copy .c2 { display: none; }
.copy.ok { background: #16A34A; }
.copy.ok .c1 { display: none; }
.copy.ok .c2 { display: inline-flex; }
.copy:active { transform: translateY(1px); }
.prompt.ai { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; padding: 10px 10px 0; border-radius: 12px; background: var(--soft); } /* Copy, then Open in Claude and Open in ChatGPT, in a row over the prompt (Decks README item 10) */
.prompt.ai pre { order: 1; flex: 1 0 100%; padding: 4px 6px 14px; border-radius: 0; background: none; }
.prompt.ai .copy { position: static; }
.prompt .open { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 8px; background: #fff; color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); font: 700 12.5px/30px 'Sofia Sans', sans-serif; white-space: nowrap; text-decoration: none; }
.prompt .open:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.prompt .open:active { transform: translateY(1px); }
.sect { margin: 18px -16px 8px; padding: 18px 16px 10px; border: 0; border-radius: 12px; background: var(--band); }
.sect + .part { border-top: 0; }
.sect .eyebrow { margin-bottom: 4px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); }
.sect h2 { font-size: 28px; }
.steps { list-style: none; padding: 0 !important; margin: 0 0 16px !important; display: grid; gap: 8px; }
.steps li { margin: 0; }
.steps label { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--stepbg); box-shadow: inset 0 0 0 1px var(--stepline); }
.steps label:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.steps label > span { min-width: 0; flex: 1 1 auto; } /* the step's whole width: a table's frame in a step is a query container, so it takes no width from its table */
.steps label p { margin: 0; }
.steps input { -webkit-appearance: none; appearance: none; flex: none; width: 22px; height: 22px; margin: 1px 0 0; border-radius: 6px; box-shadow: inset 0 0 0 2px var(--accent); background: #fff; display: grid; place-items: center; }
.steps input:checked { background: #16A34A; box-shadow: none; }
.steps input:checked::after { content: ''; width: 6px; height: 11px; border: solid #fff; border-width: 0 2.5px 2.5px 0; transform: rotate(45deg) translate(-1px, -1px); }
.steps input:checked + span { color: var(--muted); text-decoration: line-through; text-decoration-color: rgba(107,111,148,.5); }
.foot { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--line); font: 400 13px/20px 'Sofia Sans', sans-serif; color: var(--muted); }
.empty { padding: 40px 0; color: var(--muted); }
.toast { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 40; padding: 10px 14px; border-radius: 10px; background: var(--ink); color: #fff; font: 600 13.5px/18px 'Sofia Sans', sans-serif; box-shadow: 0 12px 30px -10px rgba(28,31,74,.5); }
.toast[hidden] { display: none; }
body.bl .slidebox { border-radius: 0; box-shadow: none; background: transparent; }
body.bl .layer { transition: opacity .4s ease, visibility 0s linear .4s; }
body.bl .layer.on { transition: opacity .55s ease, visibility 0s; }
body.bl .stage { border-right: 1px solid var(--line); padding-right: 40px; }
@media (max-width: 860px) {
  .top .in { padding: 0 16px; height: 52px; gap: 10px; }
  .top .who span { display: none; }
  .top .pos { display: none; }
  .top .who { overflow: hidden; }
  .top .who b { overflow: hidden; text-overflow: ellipsis; }
  .restart { flex: none; padding: 0 6px; }
  .wrap { display: block; padding: 0 16px; }
  .stage { top: 55px; height: auto; z-index: 10; padding: 10px 16px 8px; margin: 0 -16px; background: #fff; box-shadow: 0 10px 14px -14px rgba(28,31,74,.45); }
  .slidebox { border-radius: 9px; box-shadow: none; }
  .under { margin-top: 8px; }
  .nav button { width: 30px; height: 30px; }
  .text { padding-top: 12px; }
  .part h2 { font-size: 21px; }
  .prompt pre { font-size: 13px; padding-right: 16px; padding-top: 48px; }
  .sect { margin-left: -8px; margin-right: -8px; padding-left: 8px; padding-right: 8px; }
  .sect h2 { font-size: 24px; }
  .toc { top: 60px; }
  body.bl .stage { border-right: 0; padding-right: 16px; }
}
/* On a phone (the decks README, small details 7): the notice leaves the bar, so the client's name stays whole, and is a
   small pill at the bottom centre, above the safe area. Same 5 s, same hold. */
@media (max-width: 599px) {
  /* The bar's blur would hold a fixed child inside the bar; under it on a phone is the slide's white band anyway. */
  .top { -webkit-backdrop-filter: none; backdrop-filter: none; background: #fff; }
  .restart { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 35; height: 36px; padding: 0 16px; border-radius: 999px; background: #1E1B4B; color: #fff; font: 600 13.5px/36px 'Sofia Sans', sans-serif; box-shadow: 0 0 0 1px var(--line), 0 10px 26px -10px rgba(28,31,74,.45); } /* the page's ink with white words, like a phone toast (the Experience lead) */
  .restart:hover { background: #1E1B4B; color: #fff; }
}
@media (prefers-reduced-motion: reduce) {
  .layer, .layer.on, body.bl .layer, body.bl .layer.on, .bar i, .part, .sect > * { transition: none; }
}
`;

/**
 * The decks README, small details 13: **the page prints as a handout**. Print rules only, after the page's own and the
 * slide's (so they win):
 *
 *  - The page's bar, Contents, the arrows under the slide, Copy, the Open in links, the toast and the picture view are
 *    left out. Each slide (its layer, shown one at a time on screen) is laid out above its part's text, at 576 × 324
 *    (about 152 mm, inside A4's and Letter's printed width at these margins, two to a page where their text is short), in the theme's fonts and colours: the
 *    slide alone may print its colours exactly (`print-color-adjust`), the rest prints as the browser sets it.
 *  - A slide stays with its text (`break-after: avoid`), and a part is kept off two pages where it fits
 *    (`break-inside: avoid`; a part longer than a page breaks as it must).
 *  - A prompt keeps its box as a line around it (backgrounds may not print); a step's tick box likewise.
 *  - The page's address (`#paddr`, written by the script) goes in the handout's footer, beside the client and the session.
 *  - **A section** (18 November) starts a new page and prints as its band ("SECTION 2" over its title), not as a slide
 *    picture, so its words aren't printed twice; the next part follows on the same page, so no page holds a section alone.
 *
 * The order (`printOrderCss`): the stage, its slide box and the text column give their children to the page's one
 * column, and each slide and part is given its place there: slide 1, part 1, slide 2, part 2, then the foot.
 */
export const PRINT_CSS = `
.paddr, .foot.addr-only { display: none; }
@media print {
  @page { margin: 14mm 15mm; }
  html, body { background: #FFFFFF; }
  body { font-size: 10.5pt; line-height: 1.5; }
  .top, .toc, .under, .toast, .zoom, .restart, .copy, .prompt .open, .cb-tools { display: none !important; }
  .wrap { display: flex; flex-direction: column; align-items: flex-start; max-width: none; margin: 0; padding: 0; gap: 0; }
  .stage, .slidebox, .text { display: contents; }
  .wrap > *, .layer, .part, .pre, .foot { flex: none; width: 100%; }
  .layer { position: relative; inset: auto; width: 576px; height: 324px; margin: 0 0 4mm; opacity: 1; visibility: visible; transition: none; border-radius: 8px; overflow: hidden; background: var(--slidebg); break-inside: avoid; break-after: avoid; page-break-inside: avoid; page-break-after: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.bl .layer { border-radius: 0; background: transparent; }
  /* In the flow and zoomed, not scaled: a transformed 960 x 540 canvas keeps its full height in the layout, and a page
     break below a slide drew a sliver of it at the foot of the page. */
  .layer > .deck-slide { position: relative; inset: auto; display: block; width: 576px; height: 324px; }
  .layer .deck-sl { transform: none; zoom: 0.6; }
  .part, .part.dim, .sect.dim > * { opacity: 1; transition: none; }
  .part { padding: 0 0 7mm; margin: 0; border-top: 0; break-inside: avoid; page-break-inside: avoid; }
  .part.only { height: auto; padding: 0 0 4mm; }
  .sect { margin: 0 0 6mm; padding: 0 0 4mm; border-radius: 0; background: none; border-bottom: 1.5px solid #DADCE4; break-after: avoid; page-break-after: avoid; }
  .part h2 { font-size: 15pt; }
  .sect h2 { font-size: 17pt; }
  .part img, .pre img, .part .pic, .tw { break-inside: avoid; page-break-inside: avoid; }
  /* A table prints whole: no sideways scroll, and no edge fade (#795), which on paper would hide its last columns. */
  .tw, .tw.is-scrollable-left, .tw.is-scrollable-right { overflow: visible; -webkit-mask: none; mask: none; }
  .prompt, .prompt.ai { display: block; margin: 0 0 4mm; padding: 0; border-radius: 0; background: none; break-inside: avoid; page-break-inside: avoid; }
  .prompt pre, .prompt.ai pre { padding: 3mm 4mm; border: 1px solid #C9CBD6; border-radius: 8px; background: none; white-space: pre-wrap; overflow-wrap: anywhere; }
  .steps label { background: none; box-shadow: none; border: 1px solid #DADCE4; break-inside: avoid; page-break-inside: avoid; }
  .steps input { box-shadow: none; border: 1.5px solid #8A8DA3; }
  .foot { order: 2147483647; margin-top: 0; padding-top: 3mm; break-before: avoid; page-break-before: avoid; break-inside: avoid; page-break-inside: avoid; }
  .foot.addr-only { display: block; border-top: 0; }
  .foot.addr-only:has(> .paddr:empty) { display: none; }
  .paddr { display: inline; overflow-wrap: anywhere; }
  .foot > span + .paddr::before { content: ' · '; }
  .paddr:empty { display: none; }
}
`;

/**
 * Each slide and part's place in the printed column (`PRINT_CSS`): slide n before part n (`#s<n>`), after the
 * preamble. A section (its place in `sections`) prints as its band alone: its slide is left out and its part starts a
 * page. Only numbers reach it.
 */
export function printOrderCss(count: number, sections: ReadonlySet<number> = new Set()): string {
  const rules: string[] = [];
  for (let index = 0; index < count; index++) {
    const layer = `.slidebox>.layer:nth-child(${index + 1})`;
    const part = `#s${index + 1}`;
    rules.push(sections.has(index)
      ? `${layer}{display:none}${part}{order:${index * 2 + 2};break-before:page;page-break-before:always}`
      : `${layer}{order:${index * 2 + 1}}${part}{order:${index * 2 + 2}}`);
  }
  return rules.length ? `@media print{${rules.join('')}}` : '';
}

/** The page's colours: the theme's words and accent as they read on white (its Borderless look), Ritemark's nowhere. */
function pageColours(deck: PublicDeck): string {
  const onWhite = themeVars(deck.theme, true);
  const vars: Record<string, string> = {
    ink: onWhite.hd,
    text: onWhite.tx,
    // Sprint 163 PR 3: the words on a button in the accent (the Steps pill's ink).
    onacc: onWhite.tagfg,
    muted: onWhite.sub,
    label: onWhite.acct,
    accent: deck.theme.accent,
    line: onWhite.boxl,
    soft: onWhite.box,
    soft2: onWhite.boxl,
    band: onWhite.box,
    hl: onWhite.thbg,
    stepbg: '#FFFBF0',
    stepline: onWhite.thbg,
    slidebg: deck.look === 'borderless' ? 'transparent' : deck.theme.bg,
    // Sprint 162 PR 3 (step-3-themes.md, 16 November): the content wears the theme's fonts; the page's own controls
    // keep Sofia Sans (their rules name it).
    fh: onWhite.fh,
    fb: onWhite.fb,
  };
  const page = Object.entries(vars).map(([key, value]) => `--${key}:${value}`).join(';');
  const slide = Object.entries(themeStyle(deck.theme, deck.look === 'borderless')).map(([key, value]) => `${key}:${value}`).join(';');
  // Theme values are colours and font names from a fixed list (deckTheme.ts, themeVars.ts); `<` can't close the style.
  return `:root{${page}}\n.deck-slide{${slide}}`.replace(/</g, '\\3c ');
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
 * A block slide's Steps (Sprint 161): the pill of its first Steps block ('' for none), or null when it has no Steps
 * block. A slide with Steps is an exercise on the page, as an Exercise slide is.
 */
function blockStepsTag(slide: PublicSlide): string | null {
  return isBlockSlide(slide.kind) ? blockStepsTagOf(slide.data.markdown ?? '') : null;
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

/** An Exercise slide, or a block slide with Steps: its numbered steps get ticks, and Contents ticks it when done. */
function isExercise(slide: PublicSlide): boolean {
  return slide.kind === 'exercise' || blockStepsTag(slide) !== null;
}

/** An exercise's pill beside its label and in Contents: the slide's own words (`tag:`), the default, or none. */
function pillHtml(slide: PublicSlide): string {
  const words = slide.kind === 'exercise' ? exerciseTagOf(slide.data) : blockStepsTag(slide) ?? '';
  return words ? `<span class="tag">${esc(words)}</span>` : '';
}

/** Words or a picture, a table, a code block or a line: anything a viewer would see of a handout drawn as HTML. */
function showsAnything(html: string): boolean {
  if (/<(img|table|pre|hr|svg|iframe|video|audio)\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|\u00a0/g, ' ').trim() !== '';
}

/**
 * A slide with no handout (Jarmo, 17 November: "Kui teeme Publish siis ärme näita seda vaatajale"): its part has no
 * heading and no text, so the page shows nothing of it in the text and Contents leaves it out; the slide keeps its
 * place in the slide order. A part of a deck written before 16 November shows its slide's title as its heading until
 * the first edit (no `handout: text` mark), so it is one only when its slide has no title either: a part is
 * slide-only once the person has emptied it.
 */
export function isSlideOnly(slide: Pick<PublicSlide, 'handout' | 'data'>, textHandout: boolean): boolean {
  const { html } = handoutParts(slide.handout, { partKey: 'slide-only', exercise: false, pictureUrl: () => 'picture', partHeading: true });
  if (showsAnything(html)) return false;
  return textHandout || titleOf(slide as PublicSlide) === '';
}

/** The text column's part for one shown slide. */
function partHtml(slide: PublicSlide, index: number, options: PageOptions, partKey: string, textHandout: boolean, slideOnly: boolean, openIn: boolean): string {
  const number = index + 1;
  // A slide with no handout: its place only, with nothing in it (the page's script still finds it in the slide order).
  if (slideOnly) return `<div class="part only" data-i="${index}" id="s${number}" aria-hidden="true"></div>`;
  // A part's heading is its handout's own (16 November). A part without one shows its slide's title, as the deck view
  // draws it until the first edit writes it, unless the deck is marked `handout: text`: then it shows none.
  const exerciseSlide = isExercise(slide);
  const { html: body, ownHeading } = handoutParts(slide.handout, { partKey, exercise: exerciseSlide, pictureUrl: options.pictureUrl, partHeading: true, openIn });
  const title = ownHeading || textHandout ? '' : titleOf(slide);
  const section = sectionNumberOf(slide);
  if (section !== null) {
    const label = `Section${section ? ` ${section}` : ''}`;
    return `<section class="part sect" data-i="${index}" id="s${number}"><div class="eyebrow">${esc(label)}</div>${title ? `<h2>${esc(title)}</h2>` : ''}\n${body}</section>`;
  }
  // An exercise is marked for the page's script (Contents ticks it once its steps are done) whether or not it has a pill.
  const exercise = exerciseSlide ? ' data-exercise=""' : '';
  return `<article class="part"${exercise} data-i="${index}" id="s${number}"><div class="lab">Slide ${number}${pillHtml(slide)}</div>${title ? `<h2>${esc(title)}</h2>` : ''}\n${body}</article>`;
}

function contentsHtml(slides: PublicSlide[], slideOnly: readonly boolean[]): string {
  const rows = slides.map((slide, index) => {
    // A slide with no handout has no entry: Contents lists the text's parts.
    if (slideOnly[index]) return '';
    const title = titleOf(slide) || `Slide ${index + 1}`;
    const mark = isExercise(slide)
      ? `${pillHtml(slide)}<span class="done" aria-label="Done">${iconSvg('check-circle', 18)}</span>`
      : '';
    return `<button type="button" role="menuitem" data-go="${index}"><span class="n">${index + 1}</span><span class="${sectionNumberOf(slide) !== null ? 'sec' : ''}">${esc(title)}</span>${mark}</button>`;
  });
  return `<div class="toc" id="toc" role="menu" aria-label="Contents" hidden><div class="hd">Contents</div>${rows.join('')}</div>`;
}

/** The script element's text, exactly: what the page's Content Security Policy hashes. */
const SCRIPT_TEXT = `\n${PAGE_SCRIPT}\n`;

/**
 * The page's Content Security Policy: its one script by its hash, so nothing else runs (no inline handler, no other
 * script); styles its own (inline), fonts its own (inline, and the theme's beside it); pictures from beside it (and from disk when the file is opened
 * there, as in the room without a network); and nothing loaded from anywhere else. It goes first in the head.
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
  const layers = deck.slides.map((slide, index) => {
    const drawing = {
      theme,
      borderless,
      step: slide.step,
      pictureUrl: (picture: string) => options.pictureUrl(picture, 'slide'),
      agenda,
      openIn,
      // Sprint 163 PR 3: a button on a slide is a real link to its full https address, in a new tab.
      buttonLinks: true,
    };
    // A block slide through the one block renderer (Sprint 161), a v1 slide through its layout, as the deck view draws them.
    const markup = isBlockSlide(slide.kind) ? blockSlideMarkup(slide.data, drawing) : slideMarkup(slide.kind, slide.data as SlideData, drawing);
    return `<div class="layer${index === 0 ? ' on' : ''}" data-title="${esc(titleOf(slide))}">${markup}</div>`;
  });
  const first = deck.slides[0];
  const preamble = handoutHtml(deck.preamble, { partKey: 'preamble', exercise: false, pictureUrl: options.pictureUrl, openIn });
  // A tick's id is its part's title (with which part of that title it is) and the step's words, never the part's place:
  // a slide added before an exercise keeps its ticks, and two exercises with one title keep theirs apart.
  const titles = new Map<string, number>();
  // Which slides have no handout: read once, for the text and for Contents.
  const slideOnly = deck.slides.map(slide => isSlideOnly(slide, deck.textHandout === true));
  // Small details 13 (18 November): the sections printed as their bands (a section whose part shows nothing keeps its slide).
  const printedSections = new Set(deck.slides.flatMap((slide, index) => (sectionNumberOf(slide) !== null && !slideOnly[index] ? [index] : [])));
  const parts = deck.slides.map((slide, index) => {
    const title = titleOf(slide);
    const nth = (titles.get(title) ?? 0) + 1;
    titles.set(title, nth);
    return partHtml(slide, index, options, `part\u0000${title}\u0000${nth}`, deck.textHandout === true, slideOnly[index], openIn);
  });
  const pageKey = shortHash(`${deck.client}\u0000${deck.title}`);
  const who = `<div class="who"><b>${esc(deck.client)}</b><span>${esc(deck.title)}</span></div>`;
  const foot = [deck.client, deck.title].filter(Boolean).map(esc).join(' · ');
  // Small details 13: the printed handout's footer carries the page's address (the script writes it; never on screen).
  const footer = `<div class="foot${foot ? '' : ' addr-only'}">${foot ? `<span>${foot}</span>` : ''}<span class="paddr" id="paddr"></span></div>`;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta name="generator" content="${GENERATOR_META}">`,
    `<meta name="${DIGEST_META}" content="${esc(options.digest)}">`,
    `<title>${esc(deck.title)}</title>`,
    `<style>\n${fontFaces(assets.fonts, assets.themeFonts)}\n${PAGE_CSS}\n${assets.slideCss.replace(/<\/style/gi, '<\\/style')}\n${pageColours(deck)}\n${PRINT_CSS}\n${printOrderCss(count, printedSections)}\n</style>`,
    '</head>',
    `<body class="${borderless ? 'bl' : 'card'}">`,
    // "Start from the beginning" (small details 7): shown by the script for 5 s when the page returns to a reader's place.
    `<header class="top"><div class="in">${who}<span class="grow"></span><button class="restart" id="restart" type="button" hidden>Start from the beginning</button><span class="pos" id="pos">${count ? `1 / ${count}` : ''}</span>`
      + `<button class="cbtn" id="tocbtn" type="button" aria-expanded="false" aria-controls="toc">${iconSvg('list', 16)}Contents</button></div>`
      + `<div class="bar"><i id="bar" style="width:${count ? (100 / count).toFixed(4) : 0}%"></i></div></header>`,
    contentsHtml(deck.slides, slideOnly),
    '<main class="wrap">',
    `<aside class="stage" aria-label="The slide"><div class="slidebox" id="slidebox">\n${layers.join('\n')}\n</div>`
      + `<div class="under"><span class="t" id="stitle">${first ? esc(`1 · ${titleOf(first)}`) : ''}</span><span class="nav">`
      + `<button id="prev" type="button" aria-label="Previous slide" disabled>${iconSvg('caret-up', 16)}</button>`
      + `<button id="next" type="button" aria-label="Next slide"${count > 1 ? '' : ' disabled'}>${iconSvg('caret-down', 16)}</button></span></div></aside>`,
    // The ticks' and the reader's place in this browser's storage: the same for every version of the page that keeps
    // its client and title.
    `<section class="text" id="text" data-store="ritemark-ticks-${pageKey}" data-place="ritemark-place-${pageKey}">`,
    preamble ? `<div class="pre">\n${preamble}</div>` : '',
    count ? parts.join('\n') : '<p class="empty">This deck has no slides to show.</p>',
    footer,
    '</section>',
    '</main>',
    '<div class="toast" id="toast" role="status" hidden></div>',
    // Experience 49: the full-size view of a picture; the page's script puts a copy of the clicked picture in it.
    '<div class="zoom" id="zoom" role="dialog" aria-modal="true" aria-label="The picture, full size" tabindex="-1" hidden>'
      + '<button class="zoom-x" type="button" aria-label="Close"><svg width="20" height="20" viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg></button>'
      + '<div class="zoom-pic"></div></div>',
    `<script>${SCRIPT_TEXT}</script>`,
    '</body>',
    '</html>',
  ].filter(line => line !== '').join('\n') + '\n';
}
