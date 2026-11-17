/**
 * Sprint 161: the `:::` blocks of a block slide (Columns, Boxes, Steps) as text: Pandoc's fenced divs, the syntax
 * Quarto's slides use, so any AI can read and write them.
 *
 *   :::: columns              ::: {.steps tag="Harjutus"}
 *   ::: column                1. Open the file
 *   ### Copilot               :::
 *   Documents and mail
 *   :::
 *   ::::
 *
 * An opening line is three or more colons and a word or a `{…}` attribute block (trailing colons allowed); a closing
 * line is colons alone. The innermost open div closes first, as in Pandoc, so equal colon counts nest too. Code fences
 * inside are skipped. An unclosed div, a stray `:::` or an attribute block this reader can't read is text.
 *
 * Pure and dependency-free: the slide renderer (host and webview) and the slide editor's own scoped `marked` read the
 * same lines with it. It is never registered on the document editor, so a Text document's `:::` lines stay text.
 */

/** An opening fence: 3+ colons, then a bare word or a `{…}` attribute block, then optional trailing colons. */
export const OPEN_FENCE = /^ {0,3}(:{3,})[ \t]*(\{[^}\n]*\}|[A-Za-z][\w-]*)[ \t]*:*[ \t]*$/;
/** A closing fence: 3+ colons and nothing else. */
export const CLOSE_FENCE = /^ {0,3}(:{3,})[ \t]*$/;
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** A div's attributes: its classes, its id and its `key="value"` pairs. */
export interface FenceAttributes {
  classes: string[];
  id: string | null;
  values: Record<string, string>;
}

/** `columns`, `{.box icon="x"}`, `{.column width=40%}`, `{#id .a .b key='v'}`; null for an attribute block it can't read. */
export function parseFenceAttributes(spec: string): FenceAttributes | null {
  if (!spec.startsWith('{')) return { classes: [spec], id: null, values: {} };
  const body = spec.slice(1, -1).trim();
  const out: FenceAttributes = { classes: [], id: null, values: {} };
  const part = /\s*(?:\.([\w-]+)|#([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))/y;
  let at = 0;
  while (at < body.length) {
    part.lastIndex = at;
    const match = part.exec(body);
    if (!match) return null;
    if (match[1]) out.classes.push(match[1]);
    else if (match[2]) out.id = match[2];
    else out.values[match[3]] = match[4] ?? match[5] ?? match[6] ?? '';
    at = part.lastIndex;
    while (at < body.length && /\s/.test(body[at])) at += 1;
  }
  return out;
}

/** One fenced div at the start of a text, as written. */
export interface FenceScan {
  /** The div's text, from its opening line through its closing line and the line break after it. */
  raw: string;
  openLine: string;
  closeLine: string;
  /** The lines between them. */
  inner: string;
  /** A blank line follows the opening line / precedes the closing line. */
  gapOpen: boolean;
  gapClose: boolean;
  attrs: FenceAttributes;
}

/** A fenced div at the start of `src`, to its matching close (the innermost open closes first), or null. */
export function scanFencedDiv(src: string): FenceScan | null {
  const lines = src.split('\n');
  const first = OPEN_FENCE.exec(lines[0]);
  if (!first) return null;
  const attrs = parseFenceAttributes(first[2]);
  if (!attrs) return null;
  let depth = 1;
  let code: { char: string; size: number } | null = null;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (code) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === code.char && close[1].length >= code.size) code = null;
      continue;
    }
    const fence = CODE_FENCE.exec(line);
    if (fence) {
      code = { char: fence[1][0], size: fence[1].length };
      continue;
    }
    const open = OPEN_FENCE.exec(line);
    if (open && parseFenceAttributes(open[2])) {
      depth += 1;
      continue;
    }
    if (CLOSE_FENCE.test(line)) {
      depth -= 1;
      if (depth === 0) {
        const innerLines = lines.slice(1, index);
        const consumed = lines.slice(0, index + 1).join('\n');
        const raw = src.length > consumed.length && src[consumed.length] === '\n' ? `${consumed}\n` : consumed;
        return {
          raw,
          openLine: lines[0],
          closeLine: line,
          inner: innerLines.join('\n'),
          gapOpen: innerLines.length > 0 && innerLines[0].trim() === '',
          gapClose: innerLines.length > 1 && innerLines[innerLines.length - 1].trim() === '',
          attrs,
        };
      }
    }
  }
  return null;
}

/**
 * Where a fenced div may start in `src`, for `marked`'s `start()`: a line of three or more colons. A fence line may
 * interrupt a paragraph (`Text\n::: column`), as the spike's tokenizer let it: an AI writes it that way, and it reads
 * back the same.
 */
export function fencedDivStart(src: string): number | undefined {
  const match = /(^|\n) {0,3}:{3,}/.exec(src);
  return match ? match.index + match[1].length : undefined;
}

/**
 * An attribute value in a `{…}` block, which has no escapes: in double quotes, or in single quotes when it holds a
 * double quote; a value with both keeps its words with a typographic quote. A line break is a space.
 */
export function fenceAttributeValue(value: string): string {
  // A brace would end the {…} block early and the block would read as text (security review of #769): a full-width one.
  const words = value.replace(/[\r\n]+/g, ' ').replace(/}/g, '\uff5d').replace(/{/g, '\uff5b');
  if (!words.includes('"')) return `"${words}"`;
  if (!words.includes("'")) return `'${words}'`;
  return `"${words.replace(/"/g, '”')}"`;
}

/**
 * Sprint 161 (PR 3): an opening line with one value set (`icon`, `tag`) or taken out (null), as the box's icon picker
 * and the Steps pill write it. Only this line changes: its indent and colon count stay, its id, classes and other values
 * stay in their order, and it is written in the canonical form (`::: {.box icon="x"}`); a line left with one class and
 * nothing else goes back to the bare form (`::: box`). Null for a line that isn't an opening line this reader reads.
 */
export function withFenceValue(openLine: string, key: string, value: string | null): string | null {
  const open = OPEN_FENCE.exec(openLine);
  const attrs = open ? parseFenceAttributes(open[2]) : null;
  if (!open || !attrs) return null;
  const current = attrs.values[key];
  if (value === null ? current === undefined : current === value) return openLine;
  const indent = /^ */.exec(openLine)?.[0] ?? '';
  const values = { ...attrs.values };
  if (value === null) delete values[key];
  else values[key] = value;
  const entries = Object.entries(values);
  if (!attrs.id && attrs.classes.length === 1 && entries.length === 0) return `${indent}${open[1]} ${attrs.classes[0]}`;
  const parts = [...(attrs.id ? [`#${attrs.id}`] : []), ...attrs.classes.map(name => `.${name}`), ...entries.map(([name, text]) => `${name}=${fenceAttributeValue(text)}`)];
  return `${indent}${open[1]} {${parts.join(' ')}}`;
}

/** The Boxes looks that draw their own mark (a number, a dot, an arrow) where a box's icon would go. */
export const OWN_MARK_LOOKS: ReadonlySet<string> = new Set(['steps', 'line', 'arrows']);

/** The block classes a slide draws. Any other class is drawn as a plain group of its blocks. */
export const SLIDE_BLOCK_CLASSES = ['columns', 'column', 'boxes', 'box', 'steps'] as const;
export type SlideBlockClass = (typeof SLIDE_BLOCK_CLASSES)[number];

/** The first slide class of a div, or null. */
export function slideBlockClassOf(attrs: FenceAttributes): SlideBlockClass | null {
  for (const name of SLIDE_BLOCK_CLASSES) if (attrs.classes.includes(name)) return name;
  return null;
}

// ---------------------------------------------------------------------------
// The block bar's values (experience 46, 17 November: "The block's bar has one shape for every block", "How wide a
// box is"). Each is one value on the block's own opening line, in the attribute style above; a missing value is the
// default, so an untouched block's line never changes. The renderer and the stage read them with these, and anything
// they can't read is the default (never an error, and never written into the page as typed).
// ---------------------------------------------------------------------------

/** A Boxes block's Width: S, M or L, about 180, 260 and 400 px on the 960 slide, the same for every box. None is Auto. */
export type BoxWidth = 's' | 'm' | 'l';
export const BOX_WIDTH_PX: Readonly<Record<BoxWidth, number>> = { s: 180, m: 260, l: 400 };
/** Auto keeps one row while every box can be at least this wide; otherwise two even rows. */
export const BOX_AUTO_MIN = 180;
/** The gap between boxes (slide.css's `.blk-boxes` gap). */
export const BOX_GAP = 16;

/** A Boxes block's own look: its Width (`width`), Style (`fill`) and text alignment (`align`); null is the default. */
export interface BoxesLook {
  width: BoxWidth | null;
  /** Filled or Outline; null is the theme's own (the theme's `boxes:`). */
  fill: 'filled' | 'outline' | null;
  /** Centred text; null is left, as the slide's text. */
  align: 'center' | null;
}

export function boxesLookOf(attrs: FenceAttributes): BoxesLook {
  const width = attrs.values.width?.trim().toLowerCase();
  const fill = attrs.values.fill?.trim().toLowerCase();
  const align = attrs.values.align?.trim().toLowerCase();
  return {
    width: width === 's' || width === 'm' || width === 'l' ? width : null,
    fill: fill === 'filled' || fill === 'outline' ? fill : null,
    align: align === 'center' || align === 'centre' ? 'center' : null,
  };
}

/** A Columns block's vertical alignment (`valign`): middle or bottom; null is top. */
export type ColumnsAlign = 'middle' | 'bottom';

export function columnsAlignOf(attrs: FenceAttributes): ColumnsAlign | null {
  const value = attrs.values.valign?.trim().toLowerCase();
  if (value === 'middle' || value === 'center' || value === 'centre') return 'middle';
  return value === 'bottom' ? 'bottom' : null;
}

/**
 * A column's share of its Columns block, in percent (`::: {.column width="33%"}`, Pandoc's and Quarto's own form; a
 * fraction such as `0.4` reads as 40 %). Null for none, and for anything else.
 */
export function columnWidthOf(attrs: FenceAttributes): number | null {
  const value = attrs.values.width?.trim();
  if (!value) return null;
  const percent = /^(\d{1,3}(?:\.\d{1,2})?)\s*%$/.exec(value);
  const share = percent ? Number(percent[1]) : /^0?\.\d{1,4}$/.test(value) ? Number(value) * 100 : NaN;
  return Number.isFinite(share) && share > 0 && share <= 100 ? share : null;
}

/**
 * The columns' grid when any of them has a width: each column's share as an `fr` (a column without one takes an even
 * share, 100 / n), so the shares never have to add up. Null when none has a width: the even split slide.css draws.
 * Only numbers reach the style, never the words written.
 */
export function columnTemplateOf(widths: ReadonlyArray<number | null>): string | null {
  if (!widths.length || widths.every(width => width === null)) return null;
  const even = 100 / widths.length;
  const tracks = widths.map(width => `minmax(0, ${Math.round((width ?? even) * 100) / 100}fr)`);
  return `grid-template-columns: ${tracks.join(' ')}; grid-auto-flow: row`;
}

/**
 * The attributes a Boxes block is drawn with, the renderer's and the stage's alike: its look, how many boxes it holds
 * (Auto's rows, slide.css) and its own values. Only fixed words reach them.
 */
export function boxesDrawnAttributes(attrs: FenceAttributes, count: number): Record<string, string> {
  const look = boxesLookOf(attrs);
  const out: Record<string, string> = { 'data-count': String(Math.max(0, Math.min(99, Math.floor(count)))) };
  if (look.width) out['data-width'] = look.width;
  if (look.fill) out['data-fill'] = look.fill;
  if (look.align) out['data-align'] = look.align;
  return out;
}

/** The attributes a Columns block is drawn with: its vertical alignment, and its grid when a column has a width. */
export function columnsDrawnAttributes(attrs: FenceAttributes, columns: ReadonlyArray<FenceAttributes> | null): Record<string, string> {
  const out: Record<string, string> = {};
  const align = columnsAlignOf(attrs);
  if (align) out['data-valign'] = align;
  const template = columns ? columnTemplateOf(columns.map(columnWidthOf)) : null;
  if (template) out.style = template;
  return out;
}
