/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): a button that opens a full address in a new tab, with words
 * beside it when the person writes them. How a training hands out its material: a sample report, the emails, a form.
 *
 *  - **The file:** a paragraph whose link carries Pandoc's class attribute, the words beside the button before it:
 *    `No report of your own? Use the bank's report. [Open the sample](https://…){.button}`. Quarto makes buttons from
 *    links the same way, and any other Markdown tool shows an ordinary link and the attribute's words.
 *  - **The address** is a full https one, or the button opens nothing: never `javascript:`, `data:`, `file:` or `http:`,
 *    in the editor, on the wall, on the strip or on the page (`isButtonAddress`).
 *  - **The icon** follows the address: a file (PDF, Word, Excel, PowerPoint, a zip, a SharePoint file link) shows a page,
 *    any other address an arrow out (`buttonIconOf`).
 *
 * The one reading of a button paragraph (`buttonParagraphOf`) is shared by the slide renderer (the strip, the wall, the
 * presenter view and the page's slides), the page's text and the editors' load, so they never disagree.
 *
 * Pure: no DOM, no `vscode`. The host and the webview import this one file.
 */
import type { Token, Tokens } from 'marked';
import { parseFenceAttributes } from './fencedDiv';
import { iconSvg } from '../../../webview/src/components/decks/slide/pageIcons';

/** The class that makes a link a button (Pandoc's and Quarto's attribute: `{.button}`). */
export const BUTTON_CLASS = 'button';

/** A new button's attribute block, as the editor writes one. */
export const BUTTON_ATTRIBUTES = `{.${BUTTON_CLASS}}`;

/** The words the address sheet and the bar say (the decks README). */
export const BUTTON_WORDS = {
  sheetTitle: 'Address',
  hint: 'A full address, such as a SharePoint or Drive link. It opens in a new tab.',
  refused: 'Use a full address that starts with https://',
  placeholder: 'https://',
  done: 'Done',
  doneTip: "Keep this address and go on to the button's words",
  address: 'Address',
  addressTip: 'Change the address the button opens',
  open: 'Open',
  openTip: 'Open the address in your browser',
  openNone: 'Add a full address that starts with https:// first',
  deleteTip: 'Delete the button',
  wordsPlaceholder: 'Words beside it (optional)',
  labelPlaceholder: 'Button',
} as const;

/** The longest address a button keeps as one (a SharePoint link with its sharing token is a few hundred characters). */
export const BUTTON_MAX_ADDRESS = 2048;

/**
 * A full https address, the only kind a button opens: it starts with `https://`, names a host, carries no user name or
 * password, and has no space or control character in it. Anything else (`http:`, `javascript:`, `data:`, `file:`, a
 * relative path, `https:example.com`) is refused.
 */
export function isButtonAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > BUTTON_MAX_ADDRESS) return false;
  if (!/^https:\/\//i.test(value)) return false;
  // A space, a control character or a line break never belongs in an address (and would split it in the file).
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password;
}

/**
 * #930: a link in a slide's words that is a real link (Present, the published page, every PDF kind): a full `http:` or
 * `https:` address that names a host and carries no user name or password, or a `mailto:` one. No space or control
 * character in it. Anything else (`javascript:`, `data:`, `file:`, a relative path, `https:example.com`) stays plain
 * words wherever the slide is drawn: the page is public.
 */
export function isWordLinkAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > BUTTON_MAX_ADDRESS) return false;
  if (!/^(?:https?:\/\/|mailto:)/i.test(value)) return false;
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'mailto:') return url.pathname.length > 0;
  return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0 && !url.username && !url.password;
}

/** The address as typed into the sheet, trimmed; `null` when it isn't one a button can open. */
export function buttonAddressOf(typed: string): string | null {
  const address = typed.trim();
  return isButtonAddress(address) ? address : null;
}

/** The files a button's address can name by its ending: PDF, Word, Excel, PowerPoint and a zip. */
const FILE_ENDINGS = /\.(?:pdf|docx?|docm|xlsx?|xlsm|csv|pptx?|pptm|zip)$/i;

/**
 * SharePoint's and OneDrive's sharing links to a file: `/:w:/` (Word), `/:x:/` (Excel), `/:p:/` (PowerPoint), `/:b:/`
 * (a PDF), `/:u:/` (any other file). A folder's (`/:f:/`) is no file.
 */
const SHAREPOINT_FILE = /^\/:[wxpbu]:\//i;

/** The button's icon: `file` (a page) for an address naming a file, `link` (an arrow out) for any other. */
export type ButtonIcon = 'file' | 'link';

export function buttonIconOf(address: string | null | undefined): ButtonIcon {
  if (!address) return 'link';
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return 'link';
  }
  if (SHAREPOINT_FILE.test(url.pathname) && /(?:^|\.)(?:sharepoint\.com|sharepoint\.[a-z]+|1drv\.ms|onedrive\.live\.com)$/i.test(url.hostname)) return 'file';
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // An address with a stray % keeps its path as written.
  }
  return FILE_ENDINGS.test(path) ? 'file' : 'link';
}

/** The Phosphor icon each kind draws: a page, or an arrow out. */
export const BUTTON_ICON_NAME: Readonly<Record<ButtonIcon, 'file-text' | 'arrow-up-right'>> = { file: 'file-text', link: 'arrow-up-right' };

/** The icons as inline SVG, in the button's own ink: the one set the renderer, the page and the editors draw. */
export const BUTTON_ICONS: Readonly<Record<ButtonIcon, string>> = { file: iconSvg('file-text', 16), link: iconSvg('arrow-up-right', 16) };

/**
 * The icon a button draws, the same in the editors and wherever the slide is drawn: a page while it has no address yet
 * (as drawn: the material it will hand out), the address's own for a full https one, an arrow out for any other.
 */
export function buttonIconFor(href: string | null | undefined): ButtonIcon {
  const address = (href ?? '').trim();
  if (!address) return 'file';
  return isButtonAddress(address) ? buttonIconOf(address) : 'link';
}

// ---------------------------------------------------------------------------
// Reading a button paragraph
// ---------------------------------------------------------------------------

/** An attribute block that makes a button: `{.button}`, with any other Pandoc attributes beside it. */
export function isButtonAttributes(text: string): boolean {
  const block = text.trim();
  if (!/^\{[^{}\n]*\}$/.test(block)) return false;
  const attrs = parseFenceAttributes(block);
  return !!attrs && attrs.classes.includes(BUTTON_CLASS);
}

/** A button paragraph, read from its tokens. */
export interface ButtonParagraph {
  /** The words beside the button: the paragraph's tokens before the separator. */
  words: Token[];
  /** What stands between the words and the button as written: a space, a line break or nothing; a button alone: ' '. */
  sep: string;
  /** The button's words, as plain text (escapes read). */
  label: string;
  /** The address as `marked` read it (its escapes read); '' for none. */
  href: string;
  /** The link's title, or null. */
  title: string | null;
  /** The link's destination as written between its parentheses (the address and any title), written back unchanged. */
  dest: string;
  /** The attribute block as written: `{.button}`. */
  attrs: string;
}

/** marked's own escaping of a text's words, read back. */
function unescapeHtml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_all, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name] as string);
}

/** A text token that holds only spaces and tabs. */
const isBlank = (token: Token) => token.type === 'text' && !/\S/.test((token as Tokens.Text).raw);

/**
 * A paragraph that ends with a button: a link written `[words](address)` whose words are plain text, followed straight
 * away by its `{.button}` block, with nothing after them. Its parts, or null for any other paragraph (whose link and
 * braces then stay what they are). The paragraph's words before the link are the words beside it.
 */
export function buttonParagraphOf(tokens: readonly Token[] | undefined): ButtonParagraph | null {
  if (!tokens || tokens.length < 2) return null;
  let end = tokens.length;
  // Spaces after the block are the paragraph's, not the button's: marked keeps them in the block's own text token (or
  // one of their own), and the editor never writes a line's trailing spaces.
  while (end > 0 && isBlank(tokens[end - 1])) end -= 1;
  if (end < 2) return null;
  const tail = tokens[end - 1];
  const link = tokens[end - 2];
  if (tail.type !== 'text' || link.type !== 'link') return null;
  // Written straight after the link, as Pandoc reads it: `[x](y) {.button}` is a link and its words.
  const attrs = (tail as Tokens.Text).raw.replace(/[ \t]+$/, '');
  if (!isButtonAttributes(attrs) || attrs !== attrs.trim()) return null;
  const linkToken = link as Tokens.Link;
  // Only `[words](address)`: a reference link (`[words][ref]`) or an autolink is no button.
  const inner = linkToken.tokens ?? [];
  if (!inner.every(token => token.type === 'text' || token.type === 'escape')) return null;
  const labelRaw = inner.map(token => token.raw).join('');
  const opening = `[${labelRaw}](`;
  if (!linkToken.raw.startsWith(opening) || !linkToken.raw.endsWith(')')) return null;
  const dest = linkToken.raw.slice(opening.length, -1);
  // marked hands a text's and an escape's words over HTML-escaped (`&amp;`): the label is the words themselves.
  const label = unescapeHtml(inner.map(token => (token as Tokens.Text).text).join(''));
  // The words beside it, without the space or line break that parts them from the button.
  const words = tokens.slice(0, end - 2).map(token => token);
  let sep = '';
  while (words.length) {
    const last = words[words.length - 1];
    if (last.type === 'br') {
      sep = last.raw + sep;
      words.pop();
      continue;
    }
    if (last.type === 'text') {
      const raw = (last as Tokens.Text).raw;
      const trimmed = raw.replace(/[ \t\n]+$/, '');
      if (trimmed.length === raw.length) break;
      sep = raw.slice(trimmed.length) + sep;
      if (!trimmed) {
        words.pop();
        continue;
      }
      // A copy, so the token the lexer made (and others may read) keeps its words.
      const text = (last as Tokens.Text).text.replace(/[ \t\n]+$/, '');
      words[words.length - 1] = { ...last, raw: trimmed, text } as Token;
    }
    break;
  }
  // A button alone: the separator a person's first words beside it will take.
  if (!words.length) sep = ' ';
  return { words, sep, label, href: (linkToken.href ?? '').trim(), title: linkToken.title ?? null, dest, attrs };
}

/** A new address in a link's parentheses: `<…>` around one with a space, `<`, `>` or a parenthesis escaped. */
export function buttonDestination(href: string, title: string | null = null): string {
  const escaped = href.replace(/([<>()\\])/g, '\\$1');
  const written = /\s/.test(escaped) ? `<${escaped}>` : escaped;
  return title ? `${written} "${title.replace(/(["\\])/g, '\\$1')}"` : written;
}

// ---------------------------------------------------------------------------
// Drawing a button (the slide renderer and the page)
// ---------------------------------------------------------------------------

/** Escape text and attribute values: `&`, `<`, `>`, and both quotes. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

export interface ButtonDrawing {
  /** The words beside it, as HTML the caller drew (its own inline rules); '' for none. */
  wordsHtml: string;
  label: string;
  href: string;
  /**
   * `link`: a real `<a target="_blank">` (the published page); `data`: the address on the button for the host to open
   * (the wall, the presenter view), never followed by the window itself.
   */
  mode: 'link' | 'data';
  /** Extra classes on the button's box (the page's text uses its own). */
  className?: string;
  /** The keyboard's order: the slide is a picture to a screen reader wherever it is drawn (`-1`); the page's text: 0. */
  tabindex?: number;
}

/**
 * A button as every view but the editors draws it: its box with the words beside it (none: the button alone), and the
 * button with its icon. Only an address `isButtonAddress` accepts is put on it; any other draws an inert button.
 */
export function buttonHtml(drawing: ButtonDrawing): string {
  const ok = isButtonAddress(drawing.href);
  const icon = BUTTON_ICONS[buttonIconFor(drawing.href)];
  const solo = !drawing.wordsHtml.trim();
  const box = ['blk-button', solo ? 'is-solo' : '', drawing.className ?? ''].filter(Boolean).join(' ');
  const label = `<span class="blk-btn-icon">${icon}</span><span class="blk-btn-text">${esc(drawing.label)}</span>`;
  const tab = drawing.tabindex === undefined ? '' : ` tabindex="${drawing.tabindex}"`;
  let button: string;
  if (!ok) button = `<span class="blk-btn is-unset">${label}</span>`;
  else if (drawing.mode === 'link') button = `<a class="blk-btn" href="${esc(drawing.href)}" target="_blank" rel="noopener noreferrer"${tab}>${label}</a>`;
  else button = `<span class="blk-btn" role="link" data-href="${esc(drawing.href)}"${tab}>${label}</span>`;
  return `<div class="${box}">${solo ? '' : `<p class="blk-button-words">${drawing.wordsHtml}</p>`}${button}</div>\n`;
}
