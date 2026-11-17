/**
 * Sprint 159 (technical plan §2.3): the handout page as the learner page draws it (experience 46's `learner.html`),
 * without its look toggle, made from `publicDeck`'s output and nothing else. One HTML file carrying its CSS, its
 * fonts, its icons and its one script; pictures stay separate files at the deck's relative paths, which 2.2's gather
 * finds in the page and sends under its own rules.
 *
 *  - Nothing of Ritemark on it: the client and the session at the top, how far along it is, and Contents.
 *  - On a computer the slide stays on the left, centred, with arrows under it, and the text scrolls on the right; on a
 *    phone (below 860 px) the slide stays at the top and the text scrolls under it (`PAGE_CSS`, `pageScript.ts`).
 *  - Every slide is drawn here once (`slideMarkup`, the deck view's own drawing), so the page's script only shows and
 *    hides them: it sets no `src` or `href` and writes no HTML (2.2's `scriptBuildsReferences` stays false).
 *  - The handout's Markdown goes through `marked` with raw HTML escaped (comments and `<mark>` tags taken out first,
 *    again, after `publicDeck`), web links kept as links, links to project files shown as plain names, and pictures
 *    as relative paths. Every code block is a prompt with Copy; an Exercise slide's numbered steps and every task list
 *    get ticks; a Section slide is the grey band with "Section N" over its title.
 *
 * Pure: the slide CSS and the fonts come in as `PageAssets` (the host reads them, `pageAssets.ts`), and whether a
 * picture is there comes in as `pictureUrl`. The same input always gives the same bytes.
 */
import { createHash } from 'node:crypto';
import { marked } from 'marked';
import { exerciseTagOf, isBlockSlide, type SlideData } from '../deckFormat';
import { blockSectionNumberOf, blockSlideMarkup, blockStepsTagOf } from '../blocks/slideRenderer';
import { isRelativeTarget } from '../deckLibraryFormat';
import { slideMarkup, escapeHtml } from '../../../webview/src/components/decks/slide/slideMarkup';
import { themeStyle, themeVars } from '../../../webview/src/components/decks/theme/themeVars';
import { iconSvg } from '../../../webview/src/components/decks/slide/pageIcons';
import { MARKED_OPTIONS, lexHandout, type PublicDeck, type PublicSlide } from './publicDeck';
import { PAGE_SCRIPT } from './pageScript';

export { lexHandout };

export interface PageFont {
  /** The woff2 file's bytes, base64. */
  base64: string;
  unicodeRange: string;
}

export interface PageAssets {
  /** `slide/slide.css`: the slide's own rules, the deck view's. */
  slideCss: string;
  /** Sofia Sans, as the app's own fonts: latin and latin-ext. */
  fonts: PageFont[];
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

/** The renderer for one part's handout: `partKey` makes its ticks' ids. */
class HandoutRenderer extends marked.Renderer {
  private readonly seen = new Map<string, number>();

  constructor(private readonly partKey: string, private readonly pictureUrl: PictureUrl) {
    super();
  }

  code(code: string, infostring: string | undefined): string {
    const lang = (infostring ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (PRIVATE_LANGS.has(lang)) return '';
    return `<div class="prompt"><pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`
      + `<button class="copy" type="button" aria-label="Copy the prompt"><span class="c1">${iconSvg('copy', 14)}Copy</span><span class="c2">${iconSvg('check', 14)}Copied</span></button></div>\n`;
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

/** A label over a prompt: a short paragraph in capitals ("TRY IT", "PROMPT") just before a code block. */
const PROMPT_LABEL = /^[A-Z0-9][A-Z0-9 .,'’&:!?-]{0,28}$/;

type Token = ReturnType<typeof marked.lexer>[number];

/** One part's handout as HTML. In an Exercise, a numbered list at the top level is its steps, each with a tick. */
export function handoutHtml(markdown: string, options: { partKey: string; exercise: boolean; pictureUrl: PictureUrl }): string {
  return handoutParts(markdown, options).html;
}

/**
 * A part's handout as HTML, and whether it opens with its own heading (an H1 or H2 as its first block: 16 November,
 * the part's heading is the handout's), which is then the part's h2.
 */
function handoutParts(markdown: string, options: { partKey: string; exercise: boolean; pictureUrl: PictureUrl; partHeading?: boolean }): { html: string; ownHeading: boolean } {
  if (!markdown.trim()) return { html: '', ownHeading: false };
  const renderer = new HandoutRenderer(options.partKey, options.pictureUrl);
  const tokens = lexHandout(markdown);
  const first = tokens.find((token: Token) => token.type !== 'space');
  const ownHeading = first?.type === 'heading' && (first as { depth: number }).depth <= 2;
  renderer.partHeading = ownHeading && options.partHeading === true;
  // The parser only renders tokens; the lexer above is where the handout is read, and the one place raw mode is kept out.
  const parser = new marked.Parser({ ...MARKED_OPTIONS, renderer });
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
.top .who span { font: 400 14.5px/1.2 'Sofia Sans', sans-serif; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top .grow { flex: 1; }
.top .pos { font: 600 13px/1 'Sofia Sans', sans-serif; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cbtn { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 9px; background: var(--soft); color: var(--ink); font: 600 13.5px/34px 'Sofia Sans', sans-serif; white-space: nowrap; }
.cbtn:hover { background: var(--soft2); }
.bar { height: 3px; background: var(--line); }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .3s ease; }
.toc { position: fixed; z-index: 30; top: 64px; right: max(16px, calc((100vw - 1320px) / 2 + 24px)); width: min(360px, calc(100vw - 32px)); max-height: min(70vh, 560px); overflow: auto; padding: 8px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px var(--line), 0 18px 40px -12px rgba(28,31,74,.3); }
.toc[hidden] { display: none; }
.toc .hd { padding: 8px 10px 6px; font: 700 11.5px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); }
.toc button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; padding: 6px 10px; border-radius: 8px; text-align: left; font: 500 14.5px/20px 'Sofia Sans', sans-serif; color: var(--ink); }
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
.text { padding: 28px 0 55vh; min-width: 0; }
.pre { padding: 0 0 18px; }
.part { padding: 26px 0 18px; border-top: 1px solid var(--line); scroll-margin-top: 80px; transition: opacity .3s; }
.text > .part:first-child, .pre + .part { border-top: 0; padding-top: 8px; }
.part.dim { opacity: .5; }
/* A section that isn't the current part keeps its grey band; its words dim as every other part's text does. */
.sect.dim { opacity: 1; }
.sect > * { transition: opacity .3s; }
.sect.dim > * { opacity: .5; }
.part .lab { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--label); }
.part h2 { margin: 0 0 10px; font: 700 25px/1.25 'Sofia Sans', sans-serif; color: var(--ink); text-wrap: balance; }
.part h3 { margin: 18px 0 8px; font: 700 19px/1.3 'Sofia Sans', sans-serif; color: var(--ink); }
.part h4, .part h5 { margin: 16px 0 6px; font: 700 16.5px/1.35 'Sofia Sans', sans-serif; color: var(--ink); }
.part p, .pre p { margin: 0 0 14px; }
.part ol, .part ul, .pre ol, .pre ul { margin: 0 0 14px; padding-left: 24px; }
.part li { margin-bottom: 6px; }
.part li > p { margin: 0 0 6px; }
.part a, .pre a { color: var(--ink); text-decoration-color: var(--accent); text-underline-offset: 2px; }
.part img, .pre img { display: block; max-width: 100%; height: auto; margin: 4px 0 14px; border-radius: 8px; }
.part blockquote, .pre blockquote { margin: 0 0 14px; padding: 2px 0 2px 14px; border-left: 3px solid var(--line); color: var(--muted); }
.part hr, .pre hr { border: 0; border-top: 1px solid var(--line); margin: 18px 0; }
.part code, .pre code { font: 400 .9em/1.5 ui-monospace, Menlo, Consolas, monospace; background: var(--soft); padding: 1px 5px; border-radius: 5px; }
.tw { overflow-x: auto; margin: 0 0 14px; }
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
.sect { margin: 18px -16px 8px; padding: 18px 16px 10px; border: 0; border-radius: 12px; background: var(--band); }
.sect + .part { border-top: 0; }
.sect .eyebrow { margin-bottom: 4px; font: 700 12px/16px 'Sofia Sans', sans-serif; letter-spacing: .7px; text-transform: uppercase; color: var(--muted); }
.sect h2 { font-size: 28px; }
.steps { list-style: none; padding: 0 !important; margin: 0 0 16px !important; display: grid; gap: 8px; }
.steps li { margin: 0; }
.steps label { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--stepbg); box-shadow: inset 0 0 0 1px var(--stepline); }
.steps label:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.steps label > span { min-width: 0; }
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
@media (prefers-reduced-motion: reduce) {
  .layer, .layer.on, body.bl .layer, body.bl .layer.on, .bar i, .part, .sect > * { transition: none; }
}
`;

/** The page's colours: the theme's words and accent as they read on white (its Borderless look), Ritemark's nowhere. */
function pageColours(deck: PublicDeck): string {
  const onWhite = themeVars(deck.theme, true);
  const vars: Record<string, string> = {
    ink: onWhite.hd,
    text: onWhite.tx,
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
  };
  const page = Object.entries(vars).map(([key, value]) => `--${key}:${value}`).join(';');
  const slide = Object.entries(themeStyle(deck.theme, deck.look === 'borderless')).map(([key, value]) => `${key}:${value}`).join(';');
  // Theme values are colours and font names from a fixed list (deckTheme.ts, themeVars.ts); `<` can't close the style.
  return `:root{${page}}\n.deck-slide{${slide}}`.replace(/</g, '\\3c ');
}

function fontFaces(fonts: PageFont[]): string {
  return fonts.map(font => `@font-face{font-family:'Sofia Sans';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font.base64}) format('woff2');unicode-range:${font.unicodeRange};}`).join('\n');
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

/** The text column's part for one shown slide. */
function partHtml(slide: PublicSlide, index: number, options: PageOptions, partKey: string, textHandout: boolean): string {
  const number = index + 1;
  // A part's heading is its handout's own (16 November). A part without one shows its slide's title, as the deck view
  // draws it until the first edit writes it, unless the deck is marked `handout: text`: then it shows none.
  const exerciseSlide = isExercise(slide);
  const { html: body, ownHeading } = handoutParts(slide.handout, { partKey, exercise: exerciseSlide, pictureUrl: options.pictureUrl, partHeading: true });
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

function contentsHtml(slides: PublicSlide[]): string {
  const rows = slides.map((slide, index) => {
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
 * script); styles and fonts its own (inline, data:); pictures from beside it (and from disk when the file is opened
 * there, as in the room without a network); and nothing loaded from anywhere else. It goes first in the head.
 */
export const PAGE_CSP = [
  "default-src 'none'",
  `script-src 'sha256-${createHash('sha256').update(SCRIPT_TEXT).digest('base64')}'`,
  "style-src 'unsafe-inline'",
  'font-src data:',
  "img-src 'self' data: file:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** The page: one HTML file, the same bytes for the same deck. */
export function pageHtml(deck: PublicDeck, assets: PageAssets, options: PageOptions): string {
  const borderless = deck.look === 'borderless';
  const count = deck.slides.length;
  const layers = deck.slides.map((slide, index) => {
    const drawing = {
      theme: deck.theme,
      borderless,
      step: slide.step,
      pictureUrl: (picture: string) => options.pictureUrl(picture, 'slide'),
    };
    // A block slide through the one block renderer (Sprint 161), a v1 slide through its layout, as the deck view draws them.
    const markup = isBlockSlide(slide.kind) ? blockSlideMarkup(slide.data, drawing) : slideMarkup(slide.kind, slide.data as SlideData, drawing);
    return `<div class="layer${index === 0 ? ' on' : ''}" data-title="${esc(titleOf(slide))}">${markup}</div>`;
  });
  const first = deck.slides[0];
  const preamble = handoutHtml(deck.preamble, { partKey: 'preamble', exercise: false, pictureUrl: options.pictureUrl });
  // A tick's id is its part's title (with which part of that title it is) and the step's words, never the part's place:
  // a slide added before an exercise keeps its ticks, and two exercises with one title keep theirs apart.
  const titles = new Map<string, number>();
  const parts = deck.slides.map((slide, index) => {
    const title = titleOf(slide);
    const nth = (titles.get(title) ?? 0) + 1;
    titles.set(title, nth);
    return partHtml(slide, index, options, `part\u0000${title}\u0000${nth}`, deck.textHandout === true);
  });
  const who = `<div class="who"><b>${esc(deck.client)}</b><span>${esc(deck.title)}</span></div>`;
  const foot = [deck.client, deck.title].filter(Boolean).map(esc).join(' · ');
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
    `<style>\n${fontFaces(assets.fonts)}\n${PAGE_CSS}\n${assets.slideCss.replace(/<\/style/gi, '<\\/style')}\n${pageColours(deck)}\n</style>`,
    '</head>',
    `<body class="${borderless ? 'bl' : 'card'}">`,
    `<header class="top"><div class="in">${who}<span class="grow"></span><span class="pos" id="pos">${count ? `1 / ${count}` : ''}</span>`
      + `<button class="cbtn" id="tocbtn" type="button" aria-expanded="false" aria-controls="toc">${iconSvg('list', 16)}Contents</button></div>`
      + `<div class="bar"><i id="bar" style="width:${count ? (100 / count).toFixed(4) : 0}%"></i></div></header>`,
    contentsHtml(deck.slides),
    '<main class="wrap">',
    `<aside class="stage" aria-label="The slide"><div class="slidebox" id="slidebox">\n${layers.join('\n')}\n</div>`
      + `<div class="under"><span class="t" id="stitle">${first ? esc(`1 · ${titleOf(first)}`) : ''}</span><span class="nav">`
      + `<button id="prev" type="button" aria-label="Previous slide" disabled>${iconSvg('caret-up', 16)}</button>`
      + `<button id="next" type="button" aria-label="Next slide"${count > 1 ? '' : ' disabled'}>${iconSvg('caret-down', 16)}</button></span></div></aside>`,
    // The ticks' place in this browser's storage: the same for every version of the page that keeps its client and title.
    `<section class="text" id="text" data-store="ritemark-ticks-${shortHash(`${deck.client}\u0000${deck.title}`)}">`,
    preamble ? `<div class="pre">\n${preamble}</div>` : '',
    count ? parts.join('\n') : '<p class="empty">This deck has no slides to show.</p>',
    foot ? `<div class="foot">${foot}</div>` : '',
    '</section>',
    '</main>',
    '<div class="toast" id="toast" role="status" hidden></div>',
    `<script>${SCRIPT_TEXT}</script>`,
    '</body>',
    '</html>',
  ].filter(line => line !== '').join('\n') + '\n';
}
