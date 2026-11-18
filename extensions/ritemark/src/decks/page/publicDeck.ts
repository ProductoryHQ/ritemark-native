/**
 * Sprint 159 (technical plan §2.1): the one place that decides what of a deck becomes public on its handout page.
 * Everything the page, its digest and the files Publish sends are made from comes out of `publicDeck`; nothing else
 * reads the deck's text for the page.
 *
 * The rule (the Experience lead, 15 November): **the page shows what the handout shows, minus what's private.**
 *
 * What goes:
 *  - the title slide's title, and the client line (the deck's folder name);
 *  - for each slide that isn't skipped: its kind, the words its layout draws, its picture's path and its handout;
 *  - the text before the first slide, because the deck view shows it at the top of the handout (the handout is the
 *    document editor holding the whole file, and nothing there hides the blocks before the first part).
 *
 * What never goes:
 *  - speaker notes: a slide's notes block, and every other ```` ```notes ```` fence anywhere in a handout, including a
 *    stray one the deck view keeps as a code block (and a ```` ```slide ```` fence inside a handout, which holds `id`
 *    and `from` lines);
 *  - skipped slides, with their words, their handout and their pictures;
 *  - comments: standalone `<!-- … -->` notes are removed whole, and anchored `<mark data-comment="…">` marks are
 *    unwrapped to their text;
 *  - the front matter (its theme path, its look), and each slide's `id`, `from`, `kept` and `skip` lines;
 *  - words a layout doesn't draw (the deck view's "kept for other layouts"), and the "From the library" line, which
 *    is the deck view's own and never in the file.
 *
 * The theme's colours and the look (Card or Borderless) go as the page's style, not as the front matter's lines.
 *
 * Pure: no `vscode`, no file system. The page is written from what this returns (`pageHtml.ts`), and its digest
 * (`deckDigest`) is a hash of it, so an edit to anything private never shows the page as changed.
 */
import { createHash } from 'node:crypto';
import { pictureBlockTokenizer } from '../../markdown/pictureLook';
import { Marked, marked, Tokenizer, type Token } from 'marked';
import { blockTitleOf, frontMatterField, frontMatterLook, isBlockSlide, isOpenInOff, isSlideKind, isTextHandout, parseDeck, slideDataOf, type SlideData, type SlideItem } from '../deckFormat';
import { BLOCK_MAX_STEP, isCoverSlide, sidePictureOf } from '../blocks/slideRenderer';
import { legacyDataToBlocks } from '../blocks/legacyToBlocks';
import { scanFencedDiv } from '../blocks/fencedDiv';
import { tabsetOf, tabsetStart } from '../blocks/tabset';
import type { DeckTheme } from '../deckTheme';
import { transitionOf, type DeckTransition } from '../present/deckTransition';
import { MAX_STEP } from '../../../webview/src/components/decks/slide/layoutSlide';

export interface PublicSlide {
  /**
   * One of the nine kinds, '' for a block slide (Sprint 161), or `other` for a kind this build doesn't draw (its title
   * alone, as on the stage).
   */
  kind: string;
  /** Only what the slide's layout draws: never its id, from, kept or skip lines, nor words kept for other layouts. */
  data: SlideData;
  /** The handout under it, as Markdown, with its notes fences and comments taken out. */
  handout: string;
  /** The deck view's fit for it (0–3), when the open view measured one. Not part of the digest. */
  step: number;
  /**
   * PR 2: a slide written as a Section slide, which goes out as blocks: its number ('' for none), so the page still
   * draws its part as a divider. Absent for every other slide.
   */
  section?: string;
}

export interface PublicDeck {
  /**
   * The session's title (Sprint 163 PR 4): the deck's own words, never its file's name: its front matter's `title:`,
   * else its title slide's title (a shown one); '' when it has neither, and the line shows the client alone.
   */
  title: string;
  /** The deck's folder name: the client, on the page's top line. */
  client: string;
  look: 'card' | 'borderless';
  theme: DeckTheme;
  /** The text before the first slide, as Markdown, cleaned as a handout is. */
  preamble: string;
  slides: PublicSlide[];
  /**
   * The deck's handout is written with its own headings (its front matter's `handout: text`, 16 November): a part
   * without one shows none, as in the deck view. Left out for a deck without the mark, whose parts without a heading
   * show their slides' titles. The mark itself never reaches the page: the front matter stays private.
   */
  textHandout?: true;
  /**
   * The deck turns off the page's "Open in Claude" and "Open in ChatGPT" links (its front matter's `open-in: none`):
   * its prompts keep Copy only. Left out for every other deck, whose prompts get both. The front matter stays private.
   */
  openInOff?: true;
  /**
   * Sprint 163 PR 4: the deck's transition (its front matter's `transition:`), which the page plays as the wall does.
   * Left out for Fade, the default, so a deck's digest stays as it was.
   */
  transition?: Exclude<DeckTransition, 'fade'>;
}

export interface PublicDeckOptions {
  /** The deck's folder's name (the client line). */
  folderName: string;
  /**
   * Not read since Sprint 163 PR 4 (the page's top bar showed the file's name in place of the session's title). Left
   * optional so the tests that pass it stay as they are; the page's storage key takes the name through `PageOptions.name`.
   */
  deckName?: string;
  /** The theme the deck names, read and parsed by the host (or the built-in theme). */
  theme: DeckTheme;
  /** The open deck view's fit steps, by the slide's place in the deck (skipped slides counted). */
  steps?: readonly number[];
}

// ---------------------------------------------------------------------------
// A slide's drawn words
// ---------------------------------------------------------------------------

function itemsOf(items: SlideItem[] | undefined, keys: ReadonlyArray<keyof SlideItem>, count?: number): SlideItem[] | undefined {
  if (!items) return undefined;
  return items.slice(0, count ?? items.length).map(item => {
    const kept: SlideItem = {};
    for (const key of keys) if (item[key] !== undefined) kept[key] = item[key];
    return kept;
  });
}

/**
 * What a slide's layout draws (`layoutSlide`), and nothing more: the deck view keeps words a layout can't show "for
 * other layouts" (a Title slide's items, a third column, an Exercise step's line), and those stay private.
 */
export function drawnData(kind: string, data: SlideData): SlideData {
  const out: SlideData = {};
  if (data.title !== undefined) out.title = data.title;
  if (!isSlideKind(kind)) return out;
  // A picture beside or behind the words, in every kind but Picture, which draws its own.
  if (kind === 'picture') {
    if (data.image !== undefined) out.image = data.image;
  } else if (data.picture === 'left' || data.picture === 'right' || data.picture === 'behind') {
    out.picture = data.picture;
    if (data.image !== undefined) out.image = data.image;
  }
  switch (kind) {
    case 'title':
    case 'statement':
    case 'picture':
      if (data.subtitle !== undefined) out.subtitle = data.subtitle;
      break;
    case 'section':
      if (data.number !== undefined) out.number = data.number;
      break;
    case 'points':
      out.items = itemsOf(data.items, ['heading', 'text']);
      break;
    case 'exercise':
      // The pill's words, or `tag: ""` for none; without the line the page draws the default, as the slide does.
      if (data.tag !== undefined) out.tag = data.tag;
      out.items = itemsOf(data.items, ['heading']);
      break;
    case 'columns':
      out.items = itemsOf(data.items, ['heading', 'text'], 2);
      break;
    case 'boxes': {
      if (data.look !== undefined) out.look = data.look;
      // Steps, Line and Arrows draw their own mark in place of a box's icon; any other look draws the icon, as
      // `layoutSlide` does (a look it doesn't know draws boxes).
      const ownMark = data.look === 'steps' || data.look === 'line' || data.look === 'arrows';
      out.items = itemsOf(data.items, ownMark ? ['heading', 'text'] : ['heading', 'text', 'icon']);
      break;
    }
    case 'table':
      if (data.rows !== undefined) out.rows = data.rows.map(row => [...row]);
      break;
  }
  if (out.items === undefined) delete out.items;
  return out;
}

/**
 * Sprint 161: the one place that decides what of a slide the room and the page see, for the wall (`presentProtocol`)
 * and the page (`publicDeck`). A v1 slide: its kind and what its layout draws (`drawnData`). A block slide: its title,
 * its Markdown with comments, `<mark>` tags and private fences taken out (`publicMarkdown`), and a picture beside or
 * behind it; never its header's id, from, kept or skip. A kind this build doesn't know: `other`, its title alone.
 *
 * PR 2 (decision 8 of the approved plan): a v1 slide of the nine kinds goes out as the block slide `legacyToBlocks`
 * draws it, as the deck view draws it and its first edit writes it. The words its layout keeps hidden are the
 * conversion's comment, never its Markdown, so they stay private (`drawnData`'s rule, kept).
 */
export function publicSlide(kind: string, data: SlideData): { kind: string; data: SlideData } {
  if (isSlideKind(kind)) {
    const blocks = legacyDataToBlocks(kind, drawnData(kind, data));
    return publicSlide('', { ...blocks.header, markdown: blocks.markdown });
  }
  if (isBlockSlide(kind)) {
    const markdown = publicMarkdown(data.markdown ?? '');
    const out: SlideData = { markdown };
    // The title from what goes public, never from the slide as written (a heading in a comment stays private).
    const title = blockTitleOf(markdown);
    if (title) out.title = title;
    if (sidePictureOf(data)) {
      out.picture = data.picture;
      if (data.image !== undefined) out.image = data.image;
      // Experience 49: what stays in view of it (its description is no part of the drawing: the slide is aria-hidden).
      if (data.image !== undefined && data.focus !== undefined) out.focus = data.focus;
    }
    // A section (PR 3: the header's mark, no words): the page keeps its band, with or without a number.
    if (data.section === true) out.section = true;
    return { kind: '', data: out };
  }
  // A kind this build doesn't know (the nine kinds went out as blocks above): its title alone.
  return { kind: 'other', data: drawnData(kind, data) };
}

export const MARKED_OPTIONS = { gfm: true, breaks: false, headerIds: false, mangle: false, smartypants: false } as const;

/**
 * The handout's tokenizer: marked's own, except that an inline `<code>`, `<pre>`, `<kbd>` or `<script>` never puts it
 * in its raw mode, where it hands the text after the tag on unescaped (the security review of PR 3: `See <code>
 * <svg/onload=…>` reached the page as a live tag). The tag itself is a handout's raw HTML, which `sanitizeHtml`
 * shows as words.
 */
function handoutTokenizer(): Tokenizer {
  const tokenizer = new Tokenizer();
  const tag = tokenizer.tag;
  tokenizer.tag = function (this: Tokenizer, src: string) {
    const token = tag.call(this, src);
    this.lexer.state.inRawBlock = false;
    return token;
  };
  return tokenizer;
}

/** A handout's Markdown as tokens, read the one way the page reads it (`pageFile.ts` finds its pictures with it too). */
export function lexHandout(markdown: string): ReturnType<typeof marked.lexer> {
  return marked.lexer(markdown, { ...MARKED_OPTIONS, tokenizer: handoutTokenizer(), extensions: HANDOUT_EXTENSIONS });
}

/**
 * Sprint 163: a Tabs block in the handout (`::: {.panel-tabset}`, `tabset.ts`), each tab's pane read as blocks. Its
 * `tokens` are every pane's, so whatever walks the tokens (the private notes' check, the pictures) reaches them.
 */
export interface HandoutTabsToken {
  type: 'handoutTabs';
  raw: string;
  tabs: Array<{ name: string; tokens: Token[] }>;
  tokens: Token[];
}

const handoutTabsTokenizer = {
  name: 'handoutTabs',
  level: 'block' as const,
  start: tabsetStart,
  tokenizer(this: { lexer: { blockTokens: (src: string, tokens?: Token[]) => Token[] } }, src: string): HandoutTabsToken | undefined {
    const scan = scanFencedDiv(src);
    const tabset = scan ? tabsetOf(scan) : null;
    if (!scan || !tabset?.tabs.length) return undefined;
    const tabs = tabset.tabs.map(tab => ({ name: tab.name, tokens: this.lexer.blockTokens(tab.markdown, []) }));
    return { type: 'handoutTabs', raw: scan.raw, tabs, tokens: tabs.flatMap(tab => tab.tokens) } as HandoutTabsToken;
  },
};

/**
 * Experience 49: a picture's attribute block (`{width=50% crop=16:9}`, `pictureLook.ts`) is read as the picture's, so it
 * never shows on the page as words; the page draws the picture with its look (`pageHtml.ts`).
 */
export const PICTURE_EXTENSIONS = new Marked().use({ extensions: [pictureBlockTokenizer] }).defaults.extensions;

/** The handout's own blocks: a picture's look, and a Tabs block (Sprint 163). */
const HANDOUT_EXTENSIONS = new Marked().use({ extensions: [pictureBlockTokenizer, handoutTabsTokenizer] }).defaults.extensions;

// ---------------------------------------------------------------------------
// A handout's Markdown
// ---------------------------------------------------------------------------

const FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})(.*)$/;

/** A line's indentation in columns (a tab to the next stop of four, as Markdown counts it). */
function columnsOf(indent: string): number {
  let columns = 0;
  for (const char of indent) columns = char === '\t' ? columns + 4 - (columns % 4) : columns + 1;
  return columns;
}

/** A fence that never goes: speaker notes, or a slide's block (its id and from lines) inside a handout. */
function isPrivateFence(info: string): boolean {
  const word = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return word === 'notes' || word === 'slide';
}

/** The end of an HTML tag that starts at `from` (`<mark …>`), quotes respected; -1 when it never closes. */
function tagEnd(text: string, from: number): number {
  let quote: string | null = null;
  for (let index = from; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '>') return index;
  }
  return -1;
}

/**
 * A handout's Markdown as it may go public: every ```` ```notes ```` (and ```` ```slide ````) fence taken out whole,
 * every HTML comment removed (a standalone comment note, or one inside a paragraph), and every `<mark …>` and
 * `</mark>` tag dropped, so an anchored comment's words stay and its note goes. Fenced code and code spans are left as
 * written: what a prompt shows is the prompt. A comment that opens outside code runs to its `-->`, through a fence if
 * need be, as Markdown reads it.
 *
 * Where this scanner and Markdown could read the text differently, it fails closed, toward privacy, and never the
 * other way: it never ends a private fence before Markdown would (only a closing line at most three columns deeper
 * than the opening one closes it), so taking out a fence's first line always takes out all of it; a fence at any
 * indentation counts as one; a code span only closes on its own line (a span that runs on, or into a fence, is text
 * here, so a fence after it is still seen); an indented code block (four spaces, which the editor never writes: it
 * writes fences) is text here, so a comment in one goes; and an unclosed comment or tag removes everything after it.
 *
 * A private fence inside a quote or a list item (`> ```notes`, `- ```notes`) is found by Markdown's own reading
 * (`lexHandout`), and the whole quote or list holding it goes (Codex on #729: its notes otherwise stayed in the
 * digest). The page's renderer (`pageHtml.ts`) filters once more, with the same reading.
 */
export function publicMarkdown(markdown: string): string {
  return withoutPrivateContainers(scanPrivate(markdown));
}

/** Every top-level quote or list that holds a private fence, as Markdown reads it, taken out whole. */
function withoutPrivateContainers(text: string): string {
  if (!/```|~~~/.test(text)) return text;
  const tokens = lexHandout(text);
  const holdsPrivate = (token: unknown): boolean => {
    let found = false;
    marked.walkTokens([token as Token], entry => {
      if (entry.type === 'code' && isPrivateFence(String((entry as { lang?: string }).lang ?? ''))) found = true;
    });
    return found;
  };
  if (!tokens.some(holdsPrivate)) return text;
  return tokens.map(token => (holdsPrivate(token) ? '\n' : token.raw)).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function scanPrivate(markdown: string): string {
  const text = markdown.replace(/\r\n?/g, '\n');
  let out = '';
  let index = 0;
  let lineStart = true;
  while (index < text.length) {
    if (lineStart) {
      const lineEnd = text.indexOf('\n', index);
      const line = text.slice(index, lineEnd < 0 ? text.length : lineEnd);
      const open = FENCE_OPEN.exec(line);
      if (open && !(open[2][0] === '`' && open[3].includes('`'))) {
        // A fenced block, to its closing fence (or the end): kept as written, or dropped whole when private. Only a
        // closing line at most three columns deeper than the opening one closes it, as in Markdown: never earlier.
        const char = open[2][0];
        const size = open[2].length;
        const deepest = columnsOf(open[1]) + 3;
        let end = lineEnd < 0 ? text.length : lineEnd + 1;
        while (end < text.length) {
          const next = text.indexOf('\n', end);
          const body = text.slice(end, next < 0 ? text.length : next);
          end = next < 0 ? text.length : next + 1;
          const close = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(body);
          if (close && close[2][0] === char && close[2].length >= size && columnsOf(close[1]) <= deepest) break;
        }
        if (!isPrivateFence(open[3])) out += text.slice(index, end);
        index = end;
        lineStart = true;
        continue;
      }
    }
    const char = text[index];
    if (char === '`') {
      // A code span: from a run of backticks to the next run of the same length on the same line.
      let run = index;
      while (text[run] === '`') run++;
      const size = run - index;
      const paragraphEnd = (() => { const end = text.indexOf('\n', run); return end < 0 ? text.length : end; })();
      let search = run;
      let close = -1;
      while (search < paragraphEnd) {
        const at = text.indexOf('`'.repeat(size), search);
        if (at < 0 || at >= paragraphEnd) break;
        let after = at + size;
        if (text[at - 1] !== '`' && text[after] !== '`') { close = at; break; }
        while (text[after] === '`') after++;
        search = after;
      }
      const end = close < 0 ? run : close + size;
      out += text.slice(index, end);
      lineStart = false;
      index = end;
      continue;
    }
    if (text.startsWith('<!--', index)) {
      const close = text.indexOf('-->', index + 4);
      index = close < 0 ? text.length : close + 3;
      continue;
    }
    if (/^<\/?mark(?=[\s>/])/i.test(text.slice(index, index + 7))) {
      const end = tagEnd(text, index);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (char === '\n') {
      // A removed block leaves its blank lines behind: outside code, no more than one blank line in a row, so taking a
      // comment out reads as it did before the comment was added. A line of spaces alone is a blank line.
      if (/(?:^|\n)[ \t]+$/.test(out)) out = out.replace(/[ \t]+$/, '');
      if (out === '' || out.endsWith('\n\n')) { index++; lineStart = true; continue; }
    }
    out += char;
    lineStart = char === '\n';
    index++;
  }
  return out.trim();
}

// ---------------------------------------------------------------------------
// The deck
// ---------------------------------------------------------------------------

function stepOf(steps: readonly number[] | undefined, index: number, max: number): number {
  const value = steps?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
}

/** What of this deck goes public on its handout page. */
export function publicDeck(input: string, options: PublicDeckOptions): PublicDeck {
  // A file saved with a byte-order mark: the front matter is still the front matter. An empty front matter (`---` twice)
  // holds nothing, and is no part of the text before the first slide.
  const text = input.replace(/^\uFEFF/, '').replace(/^---[ \t]*\r?\n---[ \t]*(?:\r?\n|$)/, '');
  const parsed = parseDeck(text);
  const slides: PublicSlide[] = [];
  // The kind each shown slide was written as: a v1 Title slide goes out as blocks (PR 2), and still names the page.
  const writtenKinds: string[] = [];
  parsed.slides.forEach((block, index) => {
    const data = slideDataOf(block.kind, block.body);
    if (data.skip) return;
    const shown = publicSlide(block.kind, data);
    writtenKinds.push(block.kind);
    slides.push({
      ...(block.kind === 'section' ? { section: (data.number ?? '').trim() } : {}),
      kind: shown.kind,
      data: shown.data,
      handout: publicMarkdown(text.slice(block.handoutStart, block.handoutEnd)),
      // A v1 slide of the nine kinds is drawn as blocks too (PR 2), so its fit is the block fit's.
      step: stepOf(options.steps, index, isBlockSlide(block.kind) || isSlideKind(block.kind) ? BLOCK_MAX_STEP : MAX_STEP),
    });
  });
  const first = parsed.slides[0];
  // A file that opens a front matter it never closes: everything before the first slide may be front matter, so none
  // of it goes (fail closed).
  const unclosedFrontMatter = parsed.bodyStart === 0 && /^---[ \t]*\r?\n/.test(text);
  const preamble = unclosedFrontMatter ? '' : publicMarkdown(text.slice(parsed.bodyStart, first ? first.start : text.length));
  // The title slide's title; in a deck of block slides, a first slide that is only a title (the cover look).
  const titleSlide = slides.find((slide, index) => (slide.kind === 'title' || writtenKinds[index] === 'title') && (slide.data.title ?? '').trim())
    ?? (slides[0] && isBlockSlide(writtenKinds[0] ?? slides[0].kind) && isCoverSlide(slides[0].data.markdown ?? '') && (slides[0].data.title ?? '').trim() ? slides[0] : undefined);
  const transition = transitionOf(frontMatterField(text.replace(/^\uFEFF/, ''), 'transition'));
  return {
    title: sessionTitleOf(text, titleSlide),
    client: options.folderName.trim(),
    // Card or Borderless as the deck view draws it; the rest of the front matter is private.
    look: frontMatterLook(text),
    theme: options.theme,
    preamble,
    slides,
    ...(isTextHandout(text) ? { textHandout: true as const } : {}),
    ...(isOpenInOff(text) ? { openInOff: true as const } : {}),
    ...(transition !== 'fade' ? { transition } : {}),
  };
}

/**
 * The session's title, from the deck's own words only (Sprint 163 PR 4: the page's top bar showed the deck's file name):
 * the front matter's `title:` when it has words, else the shown title slide's title, else ''.
 */
export function sessionTitleOf(text: string, slide: { data: SlideData } | undefined): string {
  const written = (frontMatterField(text.replace(/^\uFEFF/, ''), 'title') ?? '').trim();
  if (written) return written;
  return (slide?.data.title ?? '').trim();
}

/** The quiet line's words for a deck (the page's, and the wall's): the client and the session. */
export function sessionLineOf(text: string, folderName: string, theme: DeckTheme): { client: string; session: string } {
  // The front matter's title is the session's without reading the slides; only a deck without one takes the public pass.
  const written = (frontMatterField(text.replace(/^\uFEFF/, ''), 'title') ?? '').trim();
  if (written) return { client: folderName.trim(), session: written };
  const deck = publicDeck(text, { folderName, theme });
  return { client: deck.client, session: deck.title };
}

/** Keys in a fixed order, so the same deck always hashes the same. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

/**
 * The page's digest: a sha256 of what `publicDeck` returns, without the fit steps (a measurement, not the deck). It
 * changes with a public edit and never with an edit to notes, a comment or a skipped slide.
 */
export function deckDigest(deck: PublicDeck): string {
  const withoutSteps = { ...deck, slides: deck.slides.map(({ step: _step, ...slide }) => slide) };
  return createHash('sha256').update(JSON.stringify(canonical(withoutSteps))).digest('hex');
}
