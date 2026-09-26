/**
 * Sprint 124 (#284) — working with the document docx-preview has drawn.
 * DOM helpers: page elements, page numbers, text for search.
 */
import { NUMPAGES_FIELD_MARK, PAGE_FIELD_MARK, weightFontFaces, type AnchorAxis, type PageAnchor } from './docxXml';
import {
  BLOCK_MARKER,
  CARRIER_MARKER,
  CONTINUED_MARKER,
  EMPTY_MARKER,
  SPLIT_MARKER,
  type BlockMarker,
  type BorderSpaces,
  type Line,
  type MeasuredBlock,
  type MeasuredPage,
} from './pagination';
import type { TextChunk } from '../documentSearch';

/** The rendered pages, in order. */
export function renderedPages(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.docx-wrapper > section.docx'));
}

const px = (value: string) => parseFloat(value) || 0;
const PLAN_MARGIN_PX = 2;
const PX_PER_PT = 96 / 72;

/** Position of `el` from the page's top-left, in layout px: offsets ignore the zoom transform. */
function offsetWithin(el: HTMLElement, page: HTMLElement): { top: number; left: number } {
  let top = 0;
  let left = 0;
  for (let n: HTMLElement | null = el; n && n !== page; n = n.offsetParent as HTMLElement | null) {
    top += n.offsetTop;
    left += n.offsetLeft;
  }
  return { top, left };
}

/**
 * The lines of a drawn paragraph: where each starts in its text and where it
 * sits, px from the page's top. Only when the drawn text is exactly the text a
 * split counts in (`expected` characters); otherwise null, and the paragraph
 * moves whole. Line starts are found by bisection over character boxes, so a
 * paragraph costs a few dozen measurements, not one per character.
 */
function paragraphLines(p: HTMLElement, page: HTMLElement, expected: number): Line[] | null {
  const nodes: Text[] = [];
  const starts: number[] = [];
  let total = 0;
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!text.length) continue;
    nodes.push(text);
    starts.push(total);
    total += text.length;
  }
  if (total !== expected || total < 2) return null;
  const pageTop = page.getBoundingClientRect().top;
  const range = document.createRange();
  const boxes = new Map<number, { top: number; bottom: number } | null>();
  const boxAt = (offset: number): { top: number; bottom: number } | null => {
    if (boxes.has(offset)) return boxes.get(offset)!;
    let box: { top: number; bottom: number } | null = null;
    // A collapsed space has no box; take the next character that has one.
    for (let at = offset; at < total && !box; at++) {
      let node = starts.length - 1;
      while (starts[node] > at) node--;
      range.setStart(nodes[node], at - starts[node]);
      range.setEnd(nodes[node], at - starts[node] + 1);
      const rect = range.getClientRects()[0];
      if (rect && rect.height > 0) box = { top: rect.top - pageTop, bottom: rect.bottom - pageTop };
    }
    boxes.set(offset, box);
    return box;
  };
  // Two characters are on different lines when their boxes don't overlap
  // vertically; characters of different sizes on one line always do.
  const lineStarts: number[] = [0];
  const scan = (lo: number, hi: number) => {
    const a = boxAt(lo);
    const b = boxAt(hi);
    if (!a || !b || b.top < a.bottom - 1) return;
    if (hi - lo === 1) {
      lineStarts.push(hi);
      return;
    }
    const mid = (lo + hi) >> 1;
    scan(lo, mid);
    scan(mid, hi);
  };
  scan(0, total - 1);
  const first = boxAt(0);
  if (!first) return null;
  const pBottom = offsetWithin(p, page).top + p.offsetHeight;
  const tops = lineStarts.map((offset) => boxAt(offset)?.top ?? first.top);
  return lineStarts.map((offset, i) => ({
    offset,
    top: tops[i],
    bottom: i + 1 < lineStarts.length ? tops[i + 1] : pBottom,
  }));
}

/**
 * The column widths (px) the browser gave each automatically laid out top-level
 * table, by its first row's marker — to pin for the next drawing (`pinTableGrids`).
 * A table whose every column can't be measured on its own is left to the browser.
 */
export function measureAutoTables(root: ParentNode, markers: ReadonlyMap<string, BlockMarker>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const span of root.querySelectorAll<HTMLElement>(`article span[id^="${BLOCK_MARKER}"]`)) {
    const info = markers.get(span.id);
    if (info?.kind !== 'row' || info.index !== 0) continue;
    const table = span.closest('table');
    if (!table || getComputedStyle(table).tableLayout === 'fixed') continue;
    const columns = table.querySelectorAll(':scope > colgroup > col').length;
    if (!columns) continue;
    const widths = new Array<number>(columns).fill(0);
    for (const row of Array.from(table.rows)) {
      if (row.closest('table') !== table) continue;
      let column = 0;
      for (const cell of Array.from(row.cells)) {
        const span = cell.colSpan || 1;
        if (span === 1 && column < columns) widths[column] = Math.max(widths[column], cell.getBoundingClientRect().width);
        column += span;
      }
    }
    if (widths.every((w) => w > 0)) out.set(span.id, widths);
  }
  return out;
}

/** A split paragraph's first part ends mid-sentence: its last line is justified like the others. */
export function justifySplitParagraphs(root: ParentNode): void {
  for (const span of root.querySelectorAll<HTMLElement>(`span[id^="${SPLIT_MARKER}"]`)) {
    const p = span.closest<HTMLElement>('p');
    if (p && getComputedStyle(p).textAlign === 'justify') p.style.textAlignLast = 'justify';
  }
}

/**
 * v1.12.0 RC fix: measure the pages that are taller than their paper — where
 * every marked block and table row sits — for `planPageBreaks`. With `notes`,
 * a page's footnotes are taken off its body (they move with their text after a
 * break, so the first pass leaves them out). A page may run over its paper by
 * `slack` (a share of its height) before it counts: Word's own pages, drawn
 * with other fonts, run a line or two long, and breaking them would add pages
 * Word doesn't have.
 */
export function measureOverfullPages(
  root: ParentNode,
  markers: ReadonlyMap<string, BlockMarker>,
  notes: boolean,
  slack = 0,
): MeasuredPage[] {
  const measured: MeasuredPage[] = [];
  for (const page of renderedPages(root)) {
    const style = getComputedStyle(page);
    const pageHeight = px(style.minHeight);
    if (!pageHeight || page.offsetHeight <= pageHeight * (1 + slack) + 1) continue;
    const articles = Array.from(page.querySelectorAll<HTMLElement>(':scope > article'));
    // Pages in columns fill across, not down; this layout doesn't paginate them.
    if (!articles.length || articles.some((a) => (parseInt(getComputedStyle(a).columnCount, 10) || 1) > 1)) continue;
    const footer = page.querySelector<HTMLElement>(':scope > footer');
    const footerOverlap = footer ? Math.max(0, footer.offsetHeight - px(getComputedStyle(footer).minHeight)) : 0;
    // A couple of pixels in hand: the next drawing differs by fractions of a
    // pixel (a table's border redrawn at a page top, subpixel text), and a plan
    // made to the pixel would push a line over and leave a near-empty page.
    const bodyBottom = pageHeight - px(style.paddingBottom) - footerOverlap - PLAN_MARGIN_PX;
    const footnotes = notes ? page.querySelector<HTMLElement>(':scope > ol')?.offsetHeight ?? 0 : 0;

    const blocks: MeasuredBlock[] = [];
    let table: Element | null = null;
    let tableBlock: MeasuredBlock | null = null;
    for (const span of page.querySelectorAll<HTMLElement>(`article span[id^="${BLOCK_MARKER}"]`)) {
      const info = markers.get(span.id);
      if (!info) continue;
      if (info.kind === 'p') {
        const p = span.closest<HTMLElement>('p');
        if (!p) continue;
        const { top } = offsetWithin(p, page);
        const splitText = info.splitText;
        let lines: Line[] | null | undefined;
        blocks.push({
          marker: span.id,
          top,
          bottom: top + p.offsetHeight,
          marginTop: px(getComputedStyle(p).marginTop),
          keepNext: info.keepNext,
          widowControl: info.widowControl,
          lines: splitText === null ? undefined : () => (lines === undefined ? (lines = paragraphLines(p, page, splitText)) : lines),
        });
        table = null;
        continue;
      }
      const t = span.closest<HTMLElement>('table');
      const tr = span.closest<HTMLElement>('tr');
      if (!t || !tr) continue;
      if (t !== table || !tableBlock) {
        table = t;
        const { top } = offsetWithin(t, page);
        tableBlock = { marker: span.id, top, bottom: top + t.offsetHeight, marginTop: px(getComputedStyle(t).marginTop), keepNext: false, rows: [] };
        blocks.push(tableBlock);
      }
      const { top } = offsetWithin(tr, page);
      tableBlock.rows!.push({ marker: span.id, top, bottom: top + tr.offsetHeight, header: info.header });
    }
    for (const block of blocks) {
      const rows = block.rows;
      if (!rows?.length) continue;
      const firstBody = rows.findIndex((r) => !r.header);
      // Header rows a continuation repeats: this table's own, or — for a
      // continuation drawn already — the unmarked copies above its first row.
      block.headerHeight = rows[0].header
        ? firstBody < 0 ? 0 : rows[firstBody].top - rows[0].top
        : Math.max(0, rows[0].top - block.top);
    }
    measured.push({
      contentTop: articles[0].offsetTop,
      contentBottom: bodyBottom - footnotes,
      nextContentTop: px(style.paddingTop),
      nextContentBottom: bodyBottom,
      blocks,
    });
  }
  return measured;
}

/**
 * v1.12.0 RC fix: Word drops the space after the last paragraph on a page;
 * CSS keeps it, so a full page grew past its paper by that much.
 */
export function trimPageEndSpacing(root: ParentNode): void {
  for (const page of renderedPages(root)) {
    const articles = page.querySelectorAll<HTMLElement>(':scope > article');
    const last = articles[articles.length - 1]?.lastElementChild;
    if (last instanceof HTMLElement) last.style.marginBottom = '0px';
  }
}

/** Remove the paragraphs that only carried a page break before a table. */
export function removeCarrierParagraphs(root: ParentNode): void {
  for (const span of root.querySelectorAll<HTMLElement>(`span[id^="${CARRIER_MARKER}"]`)) {
    span.closest('p')?.remove();
  }
}

const EMU_PER_PX = 9525;

/** The drawing docx-preview rendered for the run right after a marker bookmark. */
function drawingAfter(marker: Element): HTMLElement | null {
  for (let n = marker.nextElementSibling; n; n = n.nextElementSibling) {
    const drawing = n.tagName === 'DIV' ? n : n.querySelector('div');
    if (drawing instanceof HTMLElement) return drawing;
  }
  return null;
}

function place(axis: AnchorAxis, [start, end]: [number, number], size: number): number {
  if (axis.offsetEmu !== undefined) return start + axis.offsetEmu / EMU_PER_PX;
  switch (axis.align) {
    case 'center':
      return start + (end - start - size) / 2;
    case 'right':
    case 'bottom':
    case 'outside':
      return end - size;
    default:
      return start;
  }
}

/**
 * v1.12.0 RC fix, part 2 of 2 (see `markPageAnchors`): move each picture drawn
 * in front of or behind the text to where Word draws it — from the page, a
 * margin, the column, or the top of its paragraph, as the document says. The
 * page is the containing block, so every position is taken from its edges; a
 * picture behind the body text is drawn behind it, one in front stays in front.
 */
export function positionPageAnchors(root: ParentNode, anchors: ReadonlyMap<string, PageAnchor>): void {
  if (!anchors.size) return;
  for (const marker of root.querySelectorAll<HTMLElement>('span[id^="_rma"]')) {
    const anchor = anchors.get(marker.id);
    const page = marker.closest<HTMLElement>('section.docx');
    const drawing = drawingAfter(marker);
    if (!anchor || !page || !drawing) continue;
    const content = drawing.firstElementChild as HTMLElement | null;
    const width = content?.offsetWidth ?? 0;
    const height = content?.offsetHeight ?? 0;
    const style = getComputedStyle(page);
    const W = page.offsetWidth;
    const H = px(style.minHeight) || page.offsetHeight;
    const [L, R, T, B] = [px(style.paddingLeft), px(style.paddingRight), px(style.paddingTop), px(style.paddingBottom)];
    const paragraph = marker.closest<HTMLElement>('p');
    const at = paragraph ? offsetWithin(paragraph, page) : { top: T, left: L };
    const horizontal: Record<string, [number, number]> = {
      page: [0, W], margin: [L, W - R], column: [L, W - R],
      leftMargin: [0, L], insideMargin: [0, L], rightMargin: [W - R, W], outsideMargin: [W - R, W],
    };
    const vertical: Record<string, [number, number]> = {
      page: [0, H], margin: [T, H - B], topMargin: [0, T], insideMargin: [0, T], bottomMargin: [H - B, H], outsideMargin: [H - B, H],
    };
    const x = place(anchor.h, horizontal[anchor.h.relativeFrom] ?? [at.left, at.left + (paragraph?.offsetWidth ?? W - L - R)], width);
    const y = place(anchor.v, vertical[anchor.v.relativeFrom] ?? [at.top, at.top + (paragraph?.offsetHeight ?? 0)], height);
    drawing.style.position = 'absolute';
    drawing.style.left = `${x}px`;
    drawing.style.top = `${y}px`;
    // In the body: behind or in front of the text, as Word draws it. In a
    // header or footer the whole layer is already behind the body.
    if (marker.closest('article')) drawing.style.zIndex = anchor.behindDoc ? '-1' : '2';
  }
}

/** Give docx-preview's embedded variable font faces the weight their family names name (`weightFontFaces`). */
export function weightEmbeddedFonts(styleRoot: ParentNode, variableFamilies: ReadonlySet<string>): void {
  if (!variableFamilies.size) return;
  for (const style of styleRoot.querySelectorAll('style')) {
    const css = style.textContent ?? '';
    if (!css.includes('@font-face')) continue;
    const weighted = weightFontFaces(css, variableFamilies);
    if (weighted !== css) style.textContent = weighted;
  }
}

/** The paragraph's first piece of visible text. */
function firstText(p: HTMLElement): Text | null {
  const walker = p.ownerDocument.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  return walker.nextNode() as Text | null;
}

/**
 * v1.12.0 RC fix — a paragraph in its own font. docx-preview sets the
 * document's fonts on the runs and leaves the paragraph in the webview's 13 px
 * font, which still counts: every line is at least that font's line height, a
 * list number or bullet is drawn in it, and an empty paragraph is one line of
 * it. So lines of small text drew too tall, numbers in the wrong size, and an
 * empty paragraph — a 1 pt spacer as much as a blank 12 pt line — 13 px tall.
 * Word uses the paragraph mark's font for all three: a paragraph now takes its
 * first run's font (the mark's, as a rule), and an empty one its mark's size
 * (from `markEmptyParagraphs`), one line tall.
 */
export function alignParagraphFonts(root: ParentNode): void {
  for (const p of root.querySelectorAll<HTMLElement>('section.docx p')) {
    const text = firstText(p);
    if (text) {
      const style = getComputedStyle(text.parentElement ?? p);
      p.style.fontSize = style.fontSize;
      p.style.fontFamily = style.fontFamily;
      continue;
    }
    const empty = p.querySelector<HTMLElement>(`span[id^="${EMPTY_MARKER}"]`);
    const size = empty ? Number(/s(\d+)$/.exec(empty.id)?.[1]) : 0;
    if (!size || p.querySelector('img, svg, canvas, table')) continue;
    p.style.fontSize = `${size / 2}pt`;
    p.style.boxSizing = 'content-box';
    p.style.minHeight = '1lh';
  }
}

/**
 * v1.12.0 RC fix: give each list item's marker the width of its hanging
 * indent (docxPreview.css draws the marker that wide), so the first line's text
 * starts where the item's other lines do, as Word's tab after the number puts it.
 */
export function alignListMarkers(root: ParentNode): void {
  for (const p of root.querySelectorAll<HTMLElement>('section.docx p[class*="docx-num-"]')) {
    const indent = px(getComputedStyle(p).textIndent);
    if (indent < 0) p.style.setProperty('--ritemark-hanging', `${-indent}px`);
  }
}

function sameBorder(a: CSSStyleDeclaration, b: CSSStyleDeclaration, side: 'Left' | 'Right'): boolean {
  const style = a[`border${side}Style`];
  return (
    style !== 'none' &&
    px(a[`border${side}Width`]) > 0 &&
    style === b[`border${side}Style`] &&
    a[`border${side}Width`] === b[`border${side}Width`] &&
    a[`border${side}Color`] === b[`border${side}Color`]
  );
}

/**
 * v1.12.0 RC fix — paragraph borders drawn as Word draws them:
 * - a paragraph with a hanging indent (a numbered or bulleted item) has its
 *   left border to the left of the number, not through the first line's text;
 * - the text stays at its indent and each border sits the border's own spacing
 *   (`w:space`) outside it, reaching into the margin (docx-preview drew the
 *   border at the indent and the text against it);
 * - consecutive paragraphs with the same border are one bordered block: the
 *   side bars run on through the space between them, a box has no border
 *   between them, and the top and bottom spacing is kept at the block's ends.
 * Runs on every drawing, before it is measured: the spacing moves lines.
 */
export function tidyParagraphBorders(root: ParentNode, markers?: ReadonlyMap<string, BlockMarker>): void {
  const paragraphs = Array.from(root.querySelectorAll<HTMLElement>('section.docx p'));
  // Word's border spacing, known for the paragraphs the layout marked.
  const spaces = new Map<HTMLElement, BorderSpaces>();
  if (markers) {
    for (const p of paragraphs) {
      // A later part of a paragraph split across pages names its block after its own marker.
      const marker = p.querySelector<HTMLElement>(`span[id^="${BLOCK_MARKER}"], span[id^="${CONTINUED_MARKER}"]`)?.id;
      const block = marker?.startsWith(CONTINUED_MARKER) ? marker.slice(marker.indexOf(BLOCK_MARKER)) : marker;
      const info = block ? markers.get(block) : undefined;
      if (info?.kind === 'p' && info.borders) spaces.set(p, info.borders);
    }
  }
  for (const p of paragraphs) {
    const style = getComputedStyle(p);
    const space = spaces.get(p);
    const leftWidth = style.borderLeftStyle === 'none' ? 0 : px(style.borderLeftWidth);
    const rightWidth = style.borderRightStyle === 'none' ? 0 : px(style.borderRightWidth);
    if (leftWidth > 0) {
      let margin = px(style.marginLeft);
      let padding = px(style.paddingLeft);
      const indent = px(style.textIndent);
      if (indent < 0) {
        // A hanging indent: the border goes left of the number, not through the first line.
        margin += indent;
        padding -= indent;
      }
      const known = space?.left !== undefined;
      if (known) {
        // The text stays at its indent; the border sits `space` further out, as in Word.
        margin -= space!.left! * PX_PER_PT + leftWidth;
        padding += space!.left! * PX_PER_PT;
      }
      if (indent < 0 || known) {
        p.style.setProperty('margin-inline-start', `${margin}px`);
        p.style.setProperty('padding-inline-start', `${padding}px`);
      }
    }
    if (rightWidth > 0 && space?.right !== undefined) {
      p.style.setProperty('margin-inline-end', `${px(style.marginRight) - space.right * PX_PER_PT - rightWidth}px`);
      p.style.setProperty('padding-inline-end', `${px(style.paddingRight) + space.right * PX_PER_PT}px`);
    }
  }
  const joinedAbove = new Set<HTMLElement>();
  const joinedBelow = new Set<HTMLElement>();
  for (const p of paragraphs) {
    const next = p.nextElementSibling;
    if (!(next instanceof HTMLElement) || next.tagName !== 'P') continue;
    const a = getComputedStyle(p);
    const b = getComputedStyle(next);
    if (!sameBorder(a, b, 'Left') && !sameBorder(a, b, 'Right')) continue;
    if (Math.abs(p.offsetLeft - next.offsetLeft) > 0.5 || Math.abs(p.offsetWidth - next.offsetWidth) > 0.5) continue;
    const gap = next.offsetTop - (p.offsetTop + p.offsetHeight);
    p.style.marginBottom = '0px';
    next.style.marginTop = '0px';
    p.style.paddingBottom = `${px(a.paddingBottom) + Math.max(0, gap)}px`;
    if (a.borderBottomStyle !== 'none' && b.borderTopStyle !== 'none') {
      p.style.borderBottomStyle = 'none';
      next.style.borderTopStyle = 'none';
    }
    joinedBelow.add(p);
    joinedAbove.add(next);
  }
  // Top and bottom spacing belong to the outside of a bordered block, not between its paragraphs.
  for (const [p, space] of spaces) {
    const style = getComputedStyle(p);
    if (space.top && !joinedAbove.has(p) && style.borderTopStyle !== 'none') {
      p.style.paddingTop = `${px(style.paddingTop) + space.top * PX_PER_PT}px`;
    }
    if (space.bottom && !joinedBelow.has(p) && style.borderBottomStyle !== 'none') {
      p.style.paddingBottom = `${px(style.paddingBottom) + space.bottom * PX_PER_PT}px`;
    }
  }
}

/** Defect 3: write each page's own number, and the page count, over the field marks. */
export function fillPageNumbers(root: ParentNode): number {
  const pages = renderedPages(root);
  const total = String(pages.length);
  pages.forEach((page, index) => {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? '';
      if (text.includes('')) {
        node.nodeValue = text.split(PAGE_FIELD_MARK).join(String(index + 1)).split(NUMPAGES_FIELD_MARK).join(total);
      }
    }
  });
  return pages.length;
}

const BLOCK = 'p, td, th, li, h1, h2, h3, h4, h5, h6, header, footer, article, section';

/** The document's text nodes and their text, marking where a new paragraph or cell begins. */
export function textChunks(root: ParentNode): { nodes: Text[]; chunks: TextChunk[] } {
  const nodes: Text[] = [];
  const chunks: TextChunk[] = [];
  let previousBlock: Element | null = null;
  for (const page of renderedPages(root)) {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = node.parentElement?.closest(BLOCK) ?? null;
      nodes.push(node as Text);
      chunks.push({ text: node.nodeValue ?? '', newBlock: block !== previousBlock });
      previousBlock = block;
    }
  }
  return { nodes, chunks };
}
