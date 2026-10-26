/**
 * Ritemark export HTML → Google Docs API requests (Sprint 119, W4, R4).
 *
 * Phase 0 chose the native Docs API because it is the only path that keeps a
 * template and can refuse a stale write, and it measured best on structure.
 * Its cost is index arithmetic, and this file exists to keep that arithmetic
 * in one place with one discipline — the one the canary proved:
 *
 *   1. one `insertText` carrying the whole body, with a placeholder line where
 *      a table or an image belongs, and leading tabs only on list items;
 *   2. styling only — paragraph styles, text styles — none of which changes
 *      the document's length, so every offset from step 1 stays valid; then
 *      bullets, later lists first, because `createParagraphBullets` consumes
 *      the tabs and is the one request here that shifts later indices;
 *   3. tables and images, located by their placeholders in a fresh read and
 *      applied last-first;
 *   4. table cells, last cell first.
 *
 * Everything here is pure. The input is the HTML the editor already produces
 * for PDF/Word export, run through the same `buildNormalizedExportHtml`
 * chokepoint, so comments and unsafe markup are removed by the product's own
 * code before this file sees them.
 */

import { parse, type HTMLElement } from 'node-html-parser';
import { equationsShownAsSourceSentence } from '../export/v2/mathExportMessage';
import type { DocsDocument, DocsStructuralElement, DocsTabOutline } from './GoogleApiClient';

export interface Run {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  underline?: boolean;
  link?: string;
}

export type BlockKind = 'heading' | 'paragraph' | 'listItem' | 'code' | 'quote' | 'rule' | 'table' | 'image';

export interface Block {
  kind: BlockKind;
  text: string;
  runs: Run[];
  /** Heading level (1–6), list nesting depth (0-based), or quote depth (1-based). */
  level?: number;
  ordered?: boolean;
  checkbox?: 'none' | 'unchecked' | 'checked';
  rows?: string[][];
  /** Image source as the editor wrote it; `title` carries TipTap's original path. */
  src?: string;
  title?: string;
  alt?: string;
  /**
   * Sprint 138 (#481, R10): an equation's picture. Its size in points (the
   * text's size for an inline one), whether it is display math (a centred
   * paragraph of its own), and its source, which names it if it can't be placed.
   */
  math?: { source: string; width: number; height: number; display: boolean };
  /** Sprint 138: inline equation pictures in this block's text, each at its token. */
  inlineImages?: Placeholder[];
  /** Sprint 138: equations in this table, published as their source. */
  mathAsSource?: number;
  /** Sprint 138: equations Ritemark couldn't typeset, published as their source. */
  mathTypos?: number;
}

export const MONO_FONT = 'Roboto Mono';
const INDENT_PT = 18;
const HEADINGS = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'];
const VERTICAL_TAB = '\u000b';

// ---------------------------------------------------------------- HTML → blocks

/**
 * node-html-parser returns text with entities still encoded. The Word and PDF
 * exporters read it raw and publish `&amp;` literally (filed separately); this
 * path decodes explicitly.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

type Node = HTMLElement & { nodeType: number; rawText: string; rawTagName?: string };

const tagOf = (node: Node): string => (node.rawTagName || '').toLowerCase();

// ---- Sprint 138 (#481, R10): equations, as the webview's export pass wrote them ----

const PT_PER_PX = 72 / 96;
/** Tokens for inline equation pictures, unique within one conversion. */
let mathSequence = 0;

interface ExportMathElement {
  source: string;
  /** A picture to publish, or null: then the source goes as text. */
  picture: { src: string; width: number; height: number; display: boolean } | null;
  typo: boolean;
}

function readMath(node: Node): ExportMathElement | null {
  const kind = node.getAttribute?.('data-math');
  if (kind !== 'inline' && kind !== 'block') return null;
  const source = decodeEntities(node.getAttribute('data-source') ?? node.getAttribute('data-latex') ?? '');
  const ok = node.getAttribute('data-status') === 'ok';
  const src = (node.querySelector('img[data-math-image]') as Node | null)?.getAttribute('src') ?? '';
  const width = Number.parseFloat(node.getAttribute('data-width') ?? '');
  const height = Number.parseFloat(node.getAttribute('data-height') ?? '');
  const display = kind === 'block' || node.getAttribute('data-display') === 'true';
  return {
    source,
    picture: ok && src.startsWith('data:image/png') && width > 0 && height > 0
      ? { src, width: width * PT_PER_PX, height: height * PT_PER_PX, display }
      : null,
    typo: !ok,
  };
}

function mathImageBlock(math: ExportMathElement, picture: NonNullable<ExportMathElement['picture']>): Block {
  return {
    kind: 'image',
    text: '',
    runs: [],
    src: picture.src,
    alt: 'Equation',
    math: { source: math.source, width: picture.width, height: picture.height, display: picture.display },
  };
}

/** A cell's text: a table cell is filled with text, so its equations go as their source. */
function cellText(node: Node, counts: { math: number; typos: number }): string {
  let text = '';
  for (const child of (node.childNodes ?? []) as Node[]) {
    if (child.nodeType === 3) { text += decodeEntities(child.rawText ?? ''); continue; }
    const math = readMath(child);
    if (math) {
      text += math.source;
      counts.math++;
      if (math.typo) counts.typos++;
      continue;
    }
    text += cellText(child, counts);
  }
  return text;
}

interface InlineOut { text: string; runs: Run[]; images?: Placeholder[]; typos?: number }

function inlineRuns(node: Node, out: InlineOut, inherited: Partial<Run> = {}): void {
  for (const child of (node.childNodes ?? []) as Node[]) {
    if (child.nodeType === 3) {
      const text = decodeEntities(child.rawText ?? '');
      if (!text) continue;
      const start = out.text.length;
      out.text += text;
      if (Object.keys(inherited).length) out.runs.push({ start, end: out.text.length, ...inherited });
      continue;
    }
    const tag = tagOf(child);
    if (tag === 'br') { out.text += VERTICAL_TAB; continue; }
    // Sprint 138 (#481, R10): an inline equation is a picture in its sentence,
    // placed later at its token; one that can't be is its source in code style.
    const math = readMath(child);
    if (math) {
      if (math.picture) {
        const token = `⁣RITEMARK_MATH_${mathSequence++}⁣`;
        out.text += token;
        (out.images ??= []).push({ token, block: mathImageBlock(math, math.picture) });
      } else {
        const start = out.text.length;
        out.text += math.source;
        out.runs.push({ start, end: out.text.length, ...inherited, code: true });
        if (math.typo) out.typos = (out.typos ?? 0) + 1;
      }
      continue;
    }
    if (tag === 'img') continue;             // images inside prose are lifted out as their own block
    if (tag === 'p' && out.text) out.text += VERTICAL_TAB;   // two paragraphs in one list item
    const next: Partial<Run> = { ...inherited };
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italic = true;
    if (tag === 'code') next.code = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') next.strike = true;
    if (tag === 'u') next.underline = true;
    if (tag === 'a') {
      const href = child.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(href)) next.link = href;
    }
    inlineRuns(child, out, next);
  }
}

function imageBlock(img: Node): Block {
  return {
    kind: 'image',
    text: '',
    runs: [],
    src: img.getAttribute('src') ?? '',
    title: img.getAttribute('title') ?? undefined,
    alt: img.getAttribute('alt') ?? '',
  };
}

function trimRuns(text: string, runs: Run[]): { text: string; runs: Run[] } {
  const lead = text.length - text.trimStart().length;
  const trimmed = text.trim();
  return {
    text: trimmed,
    runs: runs
      .map((r) => ({ ...r, start: Math.max(0, r.start - lead), end: Math.min(trimmed.length, r.end - lead) }))
      .filter((r) => r.end > r.start),
  };
}

/** Sprint 138: a block's inline equation pictures and typos, when it has any. */
function mathExtras(acc: InlineOut): Pick<Block, 'inlineImages' | 'mathTypos'> {
  return {
    ...(acc.images?.length ? { inlineImages: acc.images } : {}),
    ...(acc.typos ? { mathTypos: acc.typos } : {}),
  };
}

function blocksFrom(node: Node, depth = 0): Block[] {
  const tag = tagOf(node);
  const collect = () => {
    const acc: InlineOut = { text: '', runs: [] };
    inlineRuns(node, acc);
    return { ...trimRuns(acc.text, acc.runs), ...mathExtras(acc) };
  };
  // Images that sit inside a paragraph or heading become blocks of their own,
  // directly after it, instead of vanishing (the Word exporter drops an image
  // wrapped in <p>; this path must not). An equation's picture stays in its sentence.
  const liftedImages = (): Block[] =>
    (node.querySelectorAll?.('img') ?? [])
      .filter((img) => !(img as Node).hasAttribute?.('data-math-image'))
      .map((img) => imageBlock(img as Node));

  // Sprint 138 (#481, R10): an equation block is a centred picture of its own;
  // one Ritemark can't typeset is its source in the code style.
  const blockMath = tag === 'div' ? readMath(node) : null;
  if (blockMath) {
    if (blockMath.picture) return [mathImageBlock(blockMath, blockMath.picture)];
    return blockMath.source.split('\n').map((line, index) => ({
      kind: 'code' as const,
      text: line,
      runs: [],
      ...(index === 0 && blockMath.typo ? { mathTypos: 1 } : {}),
    }));
  }

  if (/^h[1-6]$/.test(tag)) {
    const { text, runs, ...extras } = collect();
    return [...(text ? [{ kind: 'heading' as const, level: Number(tag[1]), text, runs, ...extras }] : []), ...liftedImages()];
  }
  if (tag === 'p') {
    const { text, runs, ...extras } = collect();
    return [...(text ? [{ kind: 'paragraph' as const, text, runs, ...extras }] : []), ...liftedImages()];
  }
  if (tag === 'img') return [imageBlock(node)];
  if (tag === 'pre') {
    // <pre> is a raw-text element to node-html-parser: querySelector finds no
    // <code> child and textContent still carries the tag. Strip it, or the
    // tag itself is published (found by the Phase 0 mapper run).
    const raw = (node.textContent ?? '').replace(/^\s*<code[^>]*>/i, '').replace(/<\/code>\s*$/i, '');
    const lines = decodeEntities(raw).replace(/\n+$/, '').split('\n');
    return lines.map((line) => ({ kind: 'code' as const, text: line.replace(/\t/g, '    '), runs: [] }));
  }
  if (tag === 'blockquote') {
    const out: Block[] = [];
    for (const child of (node.childNodes ?? []) as Node[]) {
      for (const b of blocksFrom(child, depth + 1)) {
        out.push(b.kind === 'image' ? b : { ...b, kind: 'quote', level: b.kind === 'quote' ? b.level : depth + 1 });
      }
    }
    return out;
  }
  if (tag === 'hr') return [{ kind: 'rule', text: '', runs: [] }];
  if (tag === 'ul' || tag === 'ol') {
    const taskList = node.getAttribute('data-type') === 'taskList';
    const out: Block[] = [];
    for (const li of (node.childNodes ?? []) as Node[]) {
      if (tagOf(li) !== 'li') continue;
      const own: InlineOut = { text: '', runs: [] };
      let checkbox: Block['checkbox'] = 'none';
      const dataChecked = li.getAttribute('data-checked');
      if (taskList || li.getAttribute('data-type') === 'taskItem') checkbox = dataChecked === 'true' ? 'checked' : 'unchecked';
      const nested: Node[] = [];
      for (const child of (li.childNodes ?? []) as Node[]) {
        const childTag = tagOf(child);
        if (childTag === 'ul' || childTag === 'ol') { nested.push(child); continue; }
        if (childTag === 'input') {
          checkbox = child.getAttribute('checked') !== undefined && child.getAttribute('checked') !== null ? 'checked' : 'unchecked';
          continue;
        }
        if (childTag === 'label') continue;   // TipTap's checkbox wrapper
        inlineRuns({ childNodes: [child] } as unknown as Node, own);
      }
      const { text, runs } = trimRuns(own.text, own.runs);
      const extras = mathExtras(own);
      if (checkbox === 'none' && /^\[[ xX]\]\s/.test(text)) {
        checkbox = /^\[[xX]\]/.test(text) ? 'checked' : 'unchecked';
        const cut = text.indexOf(']') + 2;
        out.push({ kind: 'listItem', level: depth, ordered: tag === 'ol', checkbox, text: text.slice(cut), runs: runs.map((r) => ({ ...r, start: Math.max(0, r.start - cut), end: r.end - cut })).filter((r) => r.end > r.start), ...extras });
      } else {
        out.push({ kind: 'listItem', level: depth, ordered: tag === 'ol', checkbox, text, runs, ...extras });
      }
      for (const list of nested) out.push(...blocksFrom(list, depth + 1));
    }
    return out;
  }
  if (tag === 'table') {
    const rows: string[][] = [];
    const counts = { math: 0, typos: 0 };
    for (const tr of node.querySelectorAll('tr') as Node[]) {
      rows.push((tr.querySelectorAll('th,td') as Node[]).map((cell) => cellText(cell, counts).replace(/\s+/g, ' ').trim()));
    }
    const width = Math.max(0, ...rows.map((r) => r.length));
    if (!rows.length || !width) return [];
    return [{
      kind: 'table',
      text: '',
      runs: [],
      rows: rows.map((r) => [...r, ...Array(width - r.length).fill('')]),
      ...(counts.math ? { mathAsSource: counts.math } : {}),
      ...(counts.typos ? { mathTypos: counts.typos } : {}),
    }];
  }
  const out: Block[] = [];
  for (const child of (node.childNodes ?? []) as Node[]) {
    if (child.nodeType === 3) {
      const text = decodeEntities(child.rawText ?? '').trim();
      if (text) out.push({ kind: 'paragraph', text, runs: [] });
      continue;
    }
    out.push(...blocksFrom(child, depth));
  }
  return out;
}

export function htmlToBlocks(html: string): Block[] {
  mathSequence = 0;
  const root = parse(html, { blockTextElements: { pre: true, script: false, style: false, noscript: false } }) as unknown as Node;
  const body = (root.querySelector('body') as Node | null) ?? root;
  return blocksFrom(body).filter((b) => b.text.trim() || b.kind === 'table' || b.kind === 'image' || b.kind === 'rule');
}

/**
 * Sprint 138 (#481, R10, decision 5): what the publish result says about
 * equations: those in tables go as their source (Docs fills cells with
 * text), and those Ritemark couldn't typeset are counted.
 */
export function mathNotes(blocks: Block[]): string[] {
  const inTables = blocks.reduce((sum, b) => sum + (b.mathAsSource ?? 0), 0);
  const typos = blocks.reduce((sum, b) => sum + (b.mathTypos ?? 0), 0);
  const notes: string[] = [];
  if (inTables) {
    notes.push(inTables === 1
      ? 'The equation in a table is published as its source, because Google Docs fills table cells with text.'
      : `${inTables} equations in tables are published as their source, because Google Docs fills table cells with text.`);
  }
  if (typos) notes.push(equationsShownAsSourceSentence(typos));
  return notes;
}

/**
 * The HTML the unchanged-source check hashes: the document's equations by
 * their source, without the bytes of their pictures or their measured sizes,
 * which can differ from one rendering to the next (R10).
 */
export function hashableExportHtml(html: string): string {
  return html
    .replace(/<img data-math-image=""[^>]*>/g, '')
    .replace(/\sdata-(?:width|height|depth|mathml)="[^"]*"/g, '');
}

// ---------------------------------------------------------------- blocks → requests

export interface Placeholder {
  token: string;
  block: Block;
}

export interface PublishPlan {
  text: string;
  /** Batch 1: insert, length-neutral styling, then bullets (later lists first). */
  requests: unknown[];
  placeholders: Placeholder[];
  tables: string[][][];
  images: Block[];
}

/**
 * An OptionalColor — `{ color: { rgbColor } }` — which is what TextStyle's
 * backgroundColor, ParagraphStyle's shading and ParagraphBorder's color all
 * take. The Phase 0 run failed a whole batch by passing the inner Color where
 * an OptionalColor belonged, so every colour here goes through this helper.
 */
const grey = (v: number) => ({ color: { rgbColor: { red: v, green: v, blue: Math.min(1, v + 0.02) } } });

export interface PlanOptions {
  /** Add paragraph spacing when no template governs the document's styles. */
  spacing: boolean;
}

export function buildPublishPlan(blocks: Block[], options: PlanOptions): PublishPlan {
  let text = '';
  const placed: { block: Block; start: number; end: number }[] = [];
  const placeholders: Placeholder[] = [];
  let seq = 0;

  for (const block of blocks) {
    const start = 1 + text.length;
    if (block.kind === 'table' || block.kind === 'image') {
      // Invisible separators make the token impossible to collide with prose.
      const token = `\u2063RITEMARK_${block.kind.toUpperCase()}_${seq++}\u2063`;
      text += `${token}\n`;
      placeholders.push({ token, block });
      placed.push({ block, start, end: 1 + text.length - 1 });
      continue;
    }
    const prefix = block.kind === 'listItem' ? '\t'.repeat(block.level ?? 0) : '';
    const body = block.kind === 'rule' ? '' : block.text;
    text += `${prefix}${body}\n`;
    placed.push({ block, start, end: 1 + text.length - 1 });
    // Sprint 138 (#481, R10): inline equation pictures, already at their tokens in the text.
    if (block.inlineImages?.length) placeholders.push(...block.inlineImages);
  }

  const requests: unknown[] = text ? [{ insertText: { location: { index: 1 }, text } }] : [];
  const listRuns: { start: number; end: number; preset: string; lastIndex: number }[] = [];

  placed.forEach(({ block, start, end }, index) => {
    const range = { startIndex: start, endIndex: Math.max(end, start + 1) };
    switch (block.kind) {
      case 'heading':
        requests.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: HEADINGS[(block.level ?? 1) - 1] }, fields: 'namedStyleType' } });
        break;
      case 'code':
        requests.push({
          updateParagraphStyle: {
            range,
            paragraphStyle: {
              shading: { backgroundColor: grey(0.96) },
              indentStart: { magnitude: INDENT_PT, unit: 'PT' },
              spaceAbove: { magnitude: 0, unit: 'PT' },
              spaceBelow: { magnitude: 0, unit: 'PT' },
            },
            fields: 'shading,indentStart,spaceAbove,spaceBelow',
          },
        });
        if (end > start) {
          requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: end }, textStyle: { weightedFontFamily: { fontFamily: MONO_FONT }, fontSize: { magnitude: 10, unit: 'PT' } }, fields: 'weightedFontFamily,fontSize' } });
        }
        break;
      case 'quote':
        // #408 (Sprint 138, R11): every line starts at the quote's indent, the
        // first included (a Doc's own first-line indent otherwise wins), and
        // the bar is a thin line, not a 3 pt block.
        requests.push({
          updateParagraphStyle: {
            range,
            paragraphStyle: {
              indentStart: { magnitude: INDENT_PT * (block.level ?? 1), unit: 'PT' },
              indentFirstLine: { magnitude: INDENT_PT * (block.level ?? 1), unit: 'PT' },
              borderLeft: { color: grey(0.8), width: { magnitude: 0.5, unit: 'PT' }, padding: { magnitude: 6, unit: 'PT' }, dashStyle: 'SOLID' },
            },
            fields: 'indentStart,indentFirstLine,borderLeft',
          },
        });
        if (end > start) requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: end }, textStyle: { italic: true }, fields: 'italic' } });
        break;
      case 'image':
        // Sprint 138 (#481, R10): an equation block's picture is centred on its line.
        if (block.math?.display) {
          requests.push({ updateParagraphStyle: { range, paragraphStyle: { alignment: 'CENTER' }, fields: 'alignment' } });
        }
        break;
      case 'rule':
        requests.push({
          updateParagraphStyle: {
            range,
            paragraphStyle: { borderBottom: { color: grey(0.75), width: { magnitude: 1, unit: 'PT' }, padding: { magnitude: 1, unit: 'PT' }, dashStyle: 'SOLID' } },
            fields: 'borderBottom',
          },
        });
        break;
      case 'listItem': {
        const preset = block.checkbox && block.checkbox !== 'none' ? 'BULLET_CHECKBOX'
          : block.ordered ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE';
        // One request per contiguous list: nesting comes from the tabs, and a
        // Docs list has one preset. A nested item always continues the list
        // above it; a top-level item only continues one with the same preset.
        const open = listRuns[listRuns.length - 1];
        const continues = Boolean(open && open.lastIndex === index - 1 && ((block.level ?? 0) > 0 || open.preset === preset));
        if (continues && open) { open.end = end; open.lastIndex = index; }
        else listRuns.push({ start, end, preset, lastIndex: index });
        break;
      }
      default:
        break;
    }

    if (options.spacing && (block.kind === 'paragraph' || block.kind === 'heading')) {
      requests.push({ updateParagraphStyle: { range, paragraphStyle: { spaceBelow: { magnitude: block.kind === 'heading' ? 4 : 8, unit: 'PT' } }, fields: 'spaceBelow' } });
    }

    const prefixLen = block.kind === 'listItem' ? (block.level ?? 0) : 0;
    for (const run of block.runs) {
      const s = start + prefixLen + run.start;
      const e = start + prefixLen + run.end;
      if (e <= s) continue;
      const textStyle: Record<string, unknown> = {};
      const fields: string[] = [];
      if (run.bold) { textStyle.bold = true; fields.push('bold'); }
      if (run.italic) { textStyle.italic = true; fields.push('italic'); }
      if (run.strike) { textStyle.strikethrough = true; fields.push('strikethrough'); }
      if (run.underline) { textStyle.underline = true; fields.push('underline'); }
      if (run.code) {
        textStyle.weightedFontFamily = { fontFamily: MONO_FONT };
        textStyle.backgroundColor = grey(0.95);
        fields.push('weightedFontFamily', 'backgroundColor');
      }
      if (run.link) { textStyle.link = { url: run.link }; fields.push('link'); }
      if (fields.length) requests.push({ updateTextStyle: { range: { startIndex: s, endIndex: e }, textStyle, fields: fields.join(',') } });
    }
  });

  // Bullets last, later lists first: each one eats its list's tabs and shifts
  // everything after it, and nothing after it in this batch depends on that.
  for (const run of listRuns.slice().reverse()) {
    requests.push({ createParagraphBullets: { range: { startIndex: run.start, endIndex: run.end }, bulletPreset: run.preset } });
  }

  return {
    text,
    requests,
    placeholders,
    tables: placeholders.filter((p) => p.block.kind === 'table').map((p) => p.block.rows ?? []),
    images: placeholders.filter((p) => p.block.kind === 'image').map((p) => p.block),
  };
}

// ---------------------------------------------------------------- reading the document back

function walkParagraphRuns(content: DocsStructuralElement[], visit: (text: string, startIndex: number) => void): void {
  for (const el of content) {
    for (const run of el.paragraph?.elements ?? []) {
      const text = run.textRun?.content;
      if (text && typeof run.startIndex === 'number') visit(text, run.startIndex);
    }
  }
}

export interface LocatedPlaceholder {
  at: number;
  endAt: number;
  placeholder: Placeholder;
}

export function locatePlaceholders(doc: DocsDocument, placeholders: Placeholder[]): LocatedPlaceholder[] {
  const found: LocatedPlaceholder[] = [];
  walkParagraphRuns(doc.body.content, (text, startIndex) => {
    for (const placeholder of placeholders) {
      const offset = text.indexOf(placeholder.token);
      if (offset >= 0) found.push({ at: startIndex + offset, endAt: startIndex + offset + placeholder.token.length, placeholder });
    }
  });
  return found;
}

/**
 * How an image is named to the user when it could not be published: its file
 * path when there is one (TipTap keeps it in `title`), never a multi-megabyte
 * `data:` URI, and the alt text only as a last resort.
 */
export function imageLabel(block: Block): string {
  if (block.math) return `the equation ${block.math.source}`;
  if (block.title) return block.title;
  if (block.src && !block.src.startsWith('data:') && !/vscode-resource|vscode-cdn\.net/.test(block.src)) return block.src;
  if (block.src?.startsWith('data:')) return block.alt ? `${block.alt} (diagram)` : 'a diagram';
  return block.alt || 'an image';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface PlaceholderBatch {
  requests: unknown[];
  /** Images that could not be placed, named for the user (never silently lost). */
  skipped: { source: string; reason: string }[];
}

/**
 * Replace every placeholder with its table or image, last-first. An image is
 * placed only if the caller supplied a URI Google can fetch for it; otherwise
 * the placeholder is removed and the image is reported.
 */
export function placeholderRequests(located: LocatedPlaceholder[], imageUris: Map<Block, string>, reasons: Map<Block, string>): PlaceholderBatch {
  const requests: unknown[] = [];
  const skipped: PlaceholderBatch['skipped'] = [];
  for (const { at, endAt, placeholder } of located.slice().sort((a, b) => b.at - a.at)) {
    requests.push({ deleteContentRange: { range: { startIndex: at, endIndex: endAt } } });
    const block = placeholder.block;
    if (block.kind === 'table' && block.rows?.length) {
      requests.push({ insertTable: { rows: block.rows.length, columns: block.rows[0].length, location: { index: at } } });
    } else if (block.kind === 'image') {
      const uri = imageUris.get(block);
      if (uri) {
        // Sprint 138 (#481, R10): an equation's picture at the size it was typeset
        // for (the text's size), not its 4× pixels.
        const objectSize = block.math
          ? { objectSize: { width: { magnitude: round2(block.math.width), unit: 'PT' }, height: { magnitude: round2(block.math.height), unit: 'PT' } } }
          : {};
        requests.push({ insertInlineImage: { uri, location: { index: at }, ...objectSize } });
      } else skipped.push({ source: imageLabel(block), reason: reasons.get(block) ?? 'could not be read' });
    }
  }
  return { requests, skipped };
}

/** Fill table cells from a fresh read, last table, last row, last cell first. */
export function tableCellRequests(doc: DocsDocument, tables: string[][][]): unknown[] {
  const docTables = doc.body.content.filter((el) => el.table);
  const requests: unknown[] = [];
  for (let t = docTables.length - 1; t >= 0; t--) {
    const rows = tables[t];
    if (!rows) continue;
    const tableRows = docTables[t].table?.tableRows ?? [];
    for (let r = tableRows.length - 1; r >= 0; r--) {
      const cells = tableRows[r].tableCells ?? [];
      for (let c = cells.length - 1; c >= 0; c--) {
        const value = rows[r]?.[c];
        const at = cells[c].content?.[0]?.startIndex;
        if (!value || typeof at !== 'number') continue;
        requests.push({ insertText: { location: { index: at }, text: value } });
        if (r === 0) requests.push({ updateTextStyle: { range: { startIndex: at, endIndex: at + value.length }, textStyle: { bold: true }, fields: 'bold' } });
      }
    }
  }
  return requests;
}

/**
 * A template copy keeps only its first tab — the one Ritemark writes into and
 * Sync replaces — renamed after the new Doc, with the template's icon cleared.
 * Any other tab would carry the template's own content into every Doc created
 * from it. Deleting a tab deletes its children, so only the first tab's
 * children and the other top-level tabs are named.
 */
export function singleTabRequests(tabs: DocsTabOutline[], title: string): unknown[] {
  const [first, ...rest] = tabs;
  const firstId = first?.tabProperties?.tabId;
  if (!firstId) return [];
  const requests: unknown[] = [];
  for (const tab of [...(first.childTabs ?? []), ...rest]) {
    const tabId = tab.tabProperties?.tabId;
    if (tabId) requests.push({ deleteTab: { tabId } });
  }
  const name = title.trim().slice(0, 100);
  if (requests.length || (name && first.tabProperties?.title !== name)) {
    requests.push({ updateDocumentTabProperties: { tabProperties: { tabId: firstId, title: name || 'Tab 1' }, fields: 'title,iconEmoji' } });
  }
  return requests;
}

/**
 * The range holding the body's content, for Sync and for a template copy. The
 * last newline of a document can never be deleted, so the range ends one short.
 */
export function bodyClearRange(doc: DocsDocument): { startIndex: number; endIndex: number } | null {
  const content = doc.body.content;
  const last = content[content.length - 1];
  const endIndex = (last?.endIndex ?? 1) - 1;
  return endIndex > 1 ? { startIndex: 1, endIndex } : null;
}
