/**
 * Sprint 163 PR 1 (the decks README, "A prompt is a code block, and Copy is the code block's"): what a code block on a
 * slide carries, the one way the slide editor, the strip, the wall, the presenter view and the published page draw it.
 *
 *  - **Copy** at the block's top right, the words flowing around it; it takes the whole block.
 *  - **↗ Open in…** beside it: a two-item menu, Open in Claude and Open in ChatGPT, each a link with the block's words
 *    already in the box (`openInAddresses`). A deck with `open-in: none` in its front matter has none, and nor has a
 *    block too long for an address (Copy stays).
 *  - **Places to fill in**, `[like this]`, are marked in a prompt's words (`fillPlaces`): in a block with no language
 *    or a language of words (`text`, `markdown`, `prompt`), never in a program's code, where `a[0]` is code.
 *
 * The links are built here and nowhere else (the page's handout prompts use them too, `pageHtml.ts`). They are links
 * the reader chooses to follow; nothing is fetched from these hosts, so the page's Content Security Policy is the same.
 *
 * Pure: no DOM, no `vscode`. The host and the webview import this one file.
 */

/** The two hosts, each address the prompt's words after `q=`. */
export const OPEN_IN_HOSTS = [
  { id: 'claude', label: 'Claude', base: 'https://claude.ai/new?q=' },
  { id: 'chatgpt', label: 'ChatGPT', base: 'https://chatgpt.com/?q=' },
] as const;

export type OpenInHost = (typeof OPEN_IN_HOSTS)[number]['id'];

/** Longer addresses than this are left out (Copy stays): browsers and the two hosts cut or refuse long ones. */
export const OPEN_IN_MAX_ADDRESS = 8000;

/** The prompt's "Open in" addresses, or none when either would be longer than `OPEN_IN_MAX_ADDRESS`. */
export function openInAddresses(prompt: string): Array<{ id: OpenInHost; label: string; href: string }> {
  let words: string;
  // A lone surrogate can't be encoded: that prompt keeps Copy only.
  try { words = encodeURIComponent(prompt); } catch { return []; }
  const links = OPEN_IN_HOSTS.map(host => ({ id: host.id, label: host.label, href: host.base + words }));
  return links.some(link => link.href.length > OPEN_IN_MAX_ADDRESS) ? [] : links;
}

/**
 * Is this an address `openInAddresses` makes: one of the two hosts' bases, then only what `encodeURIComponent`
 * writes, within the cap? The host opens nothing else for a slide's ↗ (the wall's and the editor's requests).
 */
export function isOpenInAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > OPEN_IN_MAX_ADDRESS) return false;
  const host = OPEN_IN_HOSTS.find(candidate => value.startsWith(candidate.base));
  return !!host && /^[A-Za-z0-9\-_.!~*'()%]*$/.test(value.slice(host.base.length));
}

/**
 * What the host hands the person's browser for a slide's ↗ request: the address itself, as the string it is (never
 * written out again, so a prompt's own `&` or `#` stays the prompt's), or null for anything `openInAddresses` doesn't
 * make.
 */
export function openInTarget(value: unknown): string | null {
  return isOpenInAddress(value) ? value : null;
}

/** The words the controls say: Copy and Copied, the ↗'s tooltip and its two items. */
export const CODE_TOOLS_WORDS = {
  copy: 'Copy',
  copied: 'Copied',
  copyTip: 'Copy the whole block',
  openIn: 'Open in…',
  item: (label: string) => `Open in ${label}`,
} as const;

/** The longest text a slide's Copy hands the host (the wall's request); a slide holds far less. */
export const COPY_MAX_TEXT = 200_000;

// ---------------------------------------------------------------------------
// Places to fill in
// ---------------------------------------------------------------------------

/** A place to fill in: `[` and `]` around words on one line, with no bracket inside. */
const FILL_PLACE = /\[[^[\]\n]+\]/g;

/** The languages whose blocks are words, not a program: their `[places]` are marked. */
const WORD_LANGUAGES: ReadonlySet<string> = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'prompt', 'markdown', 'md']);

/** Does a code block in this language mark its places to fill in (no language, or a language of words)? */
export function marksFillPlaces(language: string | null | undefined): boolean {
  return WORD_LANGUAGES.has((language ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '');
}

/** The places to fill in in a block's words, as `[from, to)` offsets into them. */
export function fillPlaces(text: string): Array<{ from: number; to: number }> {
  const places: Array<{ from: number; to: number }> = [];
  for (const match of text.matchAll(FILL_PLACE)) places.push({ from: match.index, to: match.index + match[0].length });
  return places;
}

// ---------------------------------------------------------------------------
// The static drawing (the strip, the wall, the presenter view and the page)
// ---------------------------------------------------------------------------

/** Escape text and attribute values: `&`, `<`, `>`, and both quotes. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

/** A block's words, escaped, with its places to fill in marked when its language is words. */
export function codeWordsHtml(text: string, language: string | null | undefined): string {
  if (!marksFillPlaces(language)) return esc(text);
  let html = '';
  let at = 0;
  for (const place of fillPlaces(text)) {
    html += esc(text.slice(at, place.from)) + `<mark class="cb-fill">${esc(text.slice(place.from, place.to))}</mark>`;
    at = place.to;
  }
  return html + esc(text.slice(at));
}

export interface CodeToolsIcons {
  copy: string;
  check: string;
  openIn: string;
}

/**
 * A code block as every view but the slide editor draws it: Copy, the ↗ and its menu (hidden until the ↗ is pressed),
 * then the words. The controls are out of the keyboard's order (`tabindex="-1"`): the slide they sit on is a picture to
 * a screen reader (`aria-hidden`) wherever it is drawn, and the page's text column keeps each prompt's own Copy.
 */
export function codeBlockHtml(code: string, language: string | null | undefined, options: { openIn: boolean; icons: CodeToolsIcons }): string {
  const words = code.replace(/\n$/, '');
  const links = options.openIn && words.trim() ? openInAddresses(words) : [];
  const lang = (language ?? '').trim().split(/\s+/)[0] ?? '';
  const copy = `<button type="button" class="cb-copy" tabindex="-1" aria-label="${esc(CODE_TOOLS_WORDS.copyTip)}">`
    + `<span class="cb-w1">${options.icons.copy}${CODE_TOOLS_WORDS.copy}</span><span class="cb-w2">${options.icons.check}${CODE_TOOLS_WORDS.copied}</span></button>`;
  const open = links.length
    ? `<button type="button" class="cb-open" tabindex="-1" aria-label="${esc(CODE_TOOLS_WORDS.openIn)}" aria-haspopup="menu" aria-expanded="false" data-tip="${esc(CODE_TOOLS_WORDS.openIn)}">${options.icons.openIn}</button>`
      + `<span class="cb-menu" role="menu" hidden>${links.map(link => `<a class="cb-item" role="menuitem" tabindex="-1" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-host="${link.id}">${esc(CODE_TOOLS_WORDS.item(link.label))}</a>`).join('')}</span>`
    : '';
  return `<pre class="cb"${lang ? ` data-lang="${esc(lang)}"` : ''}><span class="cb-tools">${copy}${open}</span><code>${codeWordsHtml(words, language)}</code></pre>\n`;
}
