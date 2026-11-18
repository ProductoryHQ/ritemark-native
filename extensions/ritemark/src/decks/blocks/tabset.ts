/**
 * Sprint 163 (PR 2; decks README "Tabs in the editor", "Tabs are a block of their own", "A tab's pane is ordinary
 * Markdown"): the Tabs block as text. Quarto's tabset, the same `:::` family as Columns, Boxes and Steps:
 *
 *   ::: {.panel-tabset}
 *   ## 1 · Plan
 *
 *   Change the parts in square brackets before you send it.
 *
 *   ## 2 · Collect
 *
 *   ```
 *   Go through the chapters on our plan.
 *   ```
 *
 *   :::
 *
 * Each tab is an ATX heading at the level of the first one (`##` as Ritemark writes it), outside code and outside any
 * `:::` block inside; what follows it, up to the next such heading, is its pane: ordinary Markdown. Opened in another
 * tool it reads as a heading per tab and its content, and Pandoc, Quarto and other AIs know it.
 *
 * A div that isn't one this reader reads as tabs (no heading, or words before the first one) is left as it was: the
 * slide draws it as a plain group, and a Text document keeps its lines as text. Inside the block, a tab's heading is
 * never a heading of the slide, the part, the deck's sections or the page (`blockTitleOf` skips it, and the editors
 * keep it as the tab's name, not as a heading node).
 *
 * Pure and dependency-free apart from the `:::` scanner, so the slide renderer, the page, the slide editor's and the
 * Text editor's own `marked` read the same lines with it, and the save writes them back byte for byte.
 */
import { CLOSE_FENCE, OPEN_FENCE, parseFenceAttributes, scanFencedDiv, type FenceAttributes, type FenceScan } from './fencedDiv';

/** The class that makes a `:::` block a Tabs block (Quarto's). */
export const TABSET_CLASS = 'panel-tabset';
/** A new Tabs block's lines, as Ritemark writes them. */
export const TABSET_OPEN = '::: {.panel-tabset}';
export const TABSET_CLOSE = ':::';
/** The heading level a new block's tabs are written at (`##`, Quarto's own). */
export const TAB_LEVEL = 2;
/** A new block's two tabs, and the name a new tab takes ("Tab 3"). */
export const NEW_TAB_PREFIX = 'Tab';
export const newTabName = (index: number) => `${NEW_TAB_PREFIX} ${index + 1}`;
/** The pane's placeholder while it is empty (README "Adding it"). */
export const PANE_PLACEHOLDER = 'Type, or / for a code block, picture or list';

/** Is this `:::` block's opening line a Tabs block's? */
export function isTabsetAttrs(attrs: FenceAttributes): boolean {
  return attrs.classes.includes(TABSET_CLASS);
}

/** One tab, as written. */
export interface TabsetTab {
  /** Its heading line as written (`## 1 · Plan`). */
  line: string;
  /** Its name as a person reads it: the heading's words without their marks or a trailing `{#id}` block. */
  name: string;
  /** Its pane's Markdown, without the blank lines around it. */
  markdown: string;
  /** A blank line follows its heading. */
  gap: boolean;
  /** No blank line comes before its heading (the tab before it ends right above it). Never for the first tab. */
  tight: boolean;
}

/** A Tabs block's tabs and their heading level. */
export interface Tabset {
  level: number;
  tabs: TabsetTab[];
}

/** An ATX heading line: its level and its words. */
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const CODE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const CODE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** Pandoc's attribute block at a heading's end (`## Plan {#plan}`): not part of its name. */
const HEADING_ATTRIBUTES = /[ \t]+\{[^{}]*\}[ \t]*$/;

/** A heading's words as plain text: its emphasis, code marks, escapes and link targets taken out. */
export function plainTabName(words: string): string {
  return words
    .replace(HEADING_ATTRIBUTES, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // The marks that wrap words first (`*plan*`, `**plan**`, `` `code` ``, `~~old~~`, `_plan_` never inside a word, so
    // `app_config.py` and `~/setup` keep theirs), then the escapes: an escaped `\*` is a star of the name.
    .replace(/(^|[^\\])(\*\*|\*|~~|`+)(?=\S)([^]*?\S)\2/g, '$1$3')
    .replace(/(^|[^\w\\])(__|_)(?=\S)([^]*?\S)\2(?!\w)/g, '$1$3')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|<&$])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A tab heading's level and name, or null for a line that isn't an ATX heading. */
export function tabHeadingOf(line: string): { level: number; name: string } | null {
  const atx = ATX.exec(line.replace(/\r$/, ''));
  return atx ? { level: atx[1].length, name: plainTabName(atx[2] ?? '') } : null;
}

/** A tab's name as Markdown, at `level`: the characters that would read as marks are escaped, so it reads back the same. */
export function tabHeadingLine(level: number, name: string): string {
  const words = name.replace(/[\r\n]+/g, ' ').trim()
    .replace(/[\\`*_[\]<>{}]/g, '\\$&')
    .replace(/(\s)#+$|^#+$/, match => match.replace(/#/g, '\\#'));
  return `${'#'.repeat(Math.max(1, Math.min(6, level)))} ${words}`;
}

/**
 * A tab's heading line renamed: the same level, and a Pandoc attribute block it carried (`{#plan}`) kept; a name that
 * reads the same keeps the line as written.
 */
export function renamedTabLine(line: string, name: string): string {
  const heading = tabHeadingOf(line);
  const level = heading?.level ?? TAB_LEVEL;
  if (heading && heading.name === name.replace(/\s+/g, ' ').trim()) return line;
  const attributes = HEADING_ATTRIBUTES.exec(line.replace(/\r$/, ''))?.[0] ?? '';
  return `${tabHeadingLine(level, name)}${attributes}`;
}

const isBlank = (line: string) => line.trim() === '';

/**
 * The tabs of a `:::` block, when it is a Tabs block this reader reads: `{.panel-tabset}`, and its first line that
 * isn't blank an ATX heading. Null otherwise (it stays as written).
 */
export function tabsetOf(scan: Pick<FenceScan, 'attrs' | 'inner'>): Tabset | null {
  if (!isTabsetAttrs(scan.attrs)) return null;
  return tabsetOfInner(scan.inner);
}

/** The tabs of a Tabs block's inner lines (between its opening and closing lines), or null. */
export function tabsetOfInner(inner: string): Tabset | null {
  const lines = inner.split('\n');
  let first = 0;
  while (first < lines.length && isBlank(lines[first])) first += 1;
  const head = first < lines.length ? tabHeadingOf(lines[first]) : null;
  if (!head) return null;
  const level = head.level;
  // Where each tab's heading is: at the block's own level, outside code and outside a `:::` block inside it.
  const starts: number[] = [];
  let code: { char: string; size: number } | null = null;
  let depth = 0;
  for (let index = first; index < lines.length; index += 1) {
    const line = lines[index];
    if (code) {
      const close = CODE_CLOSE.exec(line);
      if (close && close[1][0] === code.char && close[1].length >= code.size) code = null;
      continue;
    }
    const fence = CODE_OPEN.exec(line);
    if (fence) {
      code = { char: fence[1][0], size: fence[1].length };
      continue;
    }
    const open = OPEN_FENCE.exec(line);
    if (open && parseFenceAttributes(open[2])) {
      depth += 1;
      continue;
    }
    if (depth > 0 && CLOSE_FENCE.test(line)) {
      depth -= 1;
      continue;
    }
    if (depth > 0) continue;
    const heading = tabHeadingOf(line);
    if (heading && heading.level === level) starts.push(index);
  }
  const tabs: TabsetTab[] = starts.map((start, at) => {
    const end = at + 1 < starts.length ? starts[at + 1] : lines.length;
    const body = lines.slice(start + 1, end);
    let from = 0;
    while (from < body.length && isBlank(body[from])) from += 1;
    let to = body.length;
    while (to > from && isBlank(body[to - 1])) to -= 1;
    const line = lines[start];
    return {
      line,
      name: tabHeadingOf(line)?.name ?? '',
      markdown: body.slice(from, to).join('\n'),
      gap: body.length > 0 && isBlank(body[0]),
      tight: at > 0 && !isBlank(lines[start - 1]),
    };
  });
  return { level, tabs };
}

/**
 * Where a Tabs block starts in `src`, for `marked`'s `start()`: the first line after a line break that opens a Tabs block
 * this reader reads, and nothing else. `marked` cuts a paragraph where `start` points, so a `:::` line that isn't a Tabs
 * block must never be pointed at: in a Text document it is a paragraph's text (the fidelity corpus's `pandoc-divs.md`).
 * `marked` hands it the text after its first character, so a match at 0 would be in the middle of a line.
 */
export function tabsetStart(src: string): number | undefined {
  const line = /\n {0,3}:{3,}[ \t]*(?:\{[^}\n]*\.panel-tabset\b|panel-tabset\b)/g;
  for (let match = line.exec(src); match; match = line.exec(src)) {
    const at = match.index + 1;
    const scan = scanFencedDiv(src.slice(at));
    if (scan && tabsetOf(scan)?.tabs.length) return at;
  }
  return undefined;
}

/** A Tabs block's lines, as `tabsetOf` reads them, for the save and the tests. */
export interface TabsetLines {
  open: string;
  close: string;
  /** A blank line follows the opening line / precedes the closing one. */
  gapOpen: boolean;
  gapClose: boolean;
  tabs: Array<Pick<TabsetTab, 'line' | 'markdown' | 'gap' | 'tight'>>;
}

/**
 * One tab as Markdown: its heading, then its pane after a blank line when it had one. What separates it from the tab
 * before it is the caller's (`tight`).
 */
export function tabMarkdown(tab: Pick<TabsetTab, 'line' | 'markdown' | 'gap'>): string {
  const pane = tab.markdown.replace(/^\n+/, '').replace(/\n+$/, '');
  return pane ? `${tab.line}\n${tab.gap ? '\n' : ''}${pane}` : tab.line;
}

/** A Tabs block as Markdown, written back as `tabsetOf` read it (byte for byte for a block nobody changed). */
export function tabsetMarkdown(block: TabsetLines): string {
  let inside = '';
  block.tabs.forEach((tab, index) => {
    if (index > 0) inside += tab.tight ? '\n' : '\n\n';
    inside += tabMarkdown(tab);
  });
  if (!inside) return `${block.open}\n${block.gapOpen ? '\n' : ''}${block.close}`;
  return `${block.open}\n${block.gapOpen ? '\n' : ''}${inside}\n${block.gapClose ? '\n' : ''}${block.close}`;
}

/** A new Tabs block with `names` (two by default, "Tab 1" and "Tab 2"), its panes empty. */
export function newTabsetMarkdown(names: readonly string[] = [newTabName(0), newTabName(1)]): string {
  return tabsetMarkdown({ open: TABSET_OPEN, close: TABSET_CLOSE, gapOpen: false, gapClose: true, tabs: names.map((name, index) => ({ line: tabHeadingLine(TAB_LEVEL, name), markdown: '', gap: true, tight: index === 0 })) });
}

/**
 * For the readers that look for headings line by line (a slide's title): fed every line in order, it says whether the
 * line is inside a Tabs block (its opening and closing lines included), so a tab's heading is never one of theirs.
 * Code fences outside a Tabs block are the caller's to skip.
 */
export function tabsetDepthTracker(): { line: (line: string) => boolean } {
  // A stack of the open `:::` blocks: true for a Tabs block. Code inside one is skipped whole.
  const stack: boolean[] = [];
  let code: { char: string; size: number } | null = null;
  return {
    line(line: string): boolean {
      const inside = stack.includes(true);
      if (code) {
        const close = CODE_CLOSE.exec(line);
        if (close && close[1][0] === code.char && close[1].length >= code.size) code = null;
        return true;
      }
      if (inside) {
        const fence = CODE_OPEN.exec(line);
        if (fence) {
          code = { char: fence[1][0], size: fence[1].length };
          return true;
        }
      }
      const open = OPEN_FENCE.exec(line);
      const attrs = open ? parseFenceAttributes(open[2]) : null;
      if (attrs) {
        stack.push(isTabsetAttrs(attrs));
        return inside || isTabsetAttrs(attrs);
      }
      if (stack.length && CLOSE_FENCE.test(line)) {
        stack.pop();
        // The closing line is the block's own.
        return inside;
      }
      return inside;
    },
  };
}
