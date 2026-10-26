/**
 * Sprint 138 (#481, R8, R12): one inline layout for PDF text and math.
 *
 * pdfkit lays out plain strings; it cannot put a picture inside a line or mix
 * faces in a wrapped paragraph without losing track of the baseline. So a
 * paragraph's inline content becomes runs (text with bold, italic and code;
 * equations as pictures with their size and depth; line breaks), and this
 * module wraps them into lines itself:
 *
 *  - words wrap greedily at spaces; an inline equation is one unbreakable word;
 *  - each line is as tall as its tallest part above the baseline and its
 *    deepest part below it, so an equation sits on the text's baseline;
 *  - an inline equation wider than the line is scaled down to fit;
 *  - display math written inside a paragraph takes a line of its own, centred;
 *  - an equation that can't be typeset is its source in Courier.
 *
 * This replaces the exporter's flattening of every paragraph to plain text,
 * so bold, italic and code come back too (the help promised them).
 */
import { HTMLElement, TextNode, type Node as HtmlNode } from 'node-html-parser';

export type TextFace = 'regular' | 'bold' | 'italic' | 'boldItalic' | 'code';

export type InlineRun =
  | { kind: 'text'; text: string; face: TextFace }
  | { kind: 'math'; image: Buffer; width: number; height: number; depth: number; display: boolean }
  | { kind: 'break' };

/** What the layout needs from pdfkit; a test passes a fake. */
export interface PdfSurface {
  widthOf(text: string, font: string, size: number): number;
  /** Height above the baseline and depth below it for a font at a size, in pt. */
  ascent(font: string, size: number): number;
  descent(font: string, size: number): number;
  drawText(text: string, x: number, baseline: number, font: string, size: number, color: string): void;
  drawImage(image: Buffer, x: number, y: number, width: number, height: number): void;
  /** Called before a line is drawn; returns the y to draw it at (a new page starts at the top). */
  roomFor(height: number, y: number): number;
}

export interface FontSet {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
  code: string;
}

/** pdfkit's standard faces, as the export templates name them. */
export function standardFonts(bodyFont: string, codeFont: string): FontSet {
  const family = bodyFont.replace(/-(Bold|Oblique|BoldOblique)$/, '');
  return {
    regular: family,
    bold: `${family}-Bold`,
    italic: `${family}-Oblique`,
    boldItalic: `${family}-BoldOblique`,
    code: codeFont,
  };
}

export interface LayoutOptions {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fonts: FontSet;
  color: string;
  lineGap: number;
  /** Draw nothing; only measure. */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Runs from HTML
// ---------------------------------------------------------------------------

interface FaceState {
  bold: boolean;
  italic: boolean;
  code: boolean;
}

function faceOf(state: FaceState): TextFace {
  if (state.code) return 'code';
  if (state.bold && state.italic) return 'boldItalic';
  if (state.bold) return 'bold';
  if (state.italic) return 'italic';
  return 'regular';
}

/** CSS px (what the webview measured) to PDF points. */
export const PT_PER_PX = 72 / 96;

const BLOCK_TAGS = new Set(['UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'HR']);

/**
 * The inline runs of an element: text with its faces, equations, line breaks.
 * Nested lists and other blocks are left to the caller. A paragraph inside
 * the element (a list item's, a cell's) is its text with a break between.
 */
export function collectRuns(node: HtmlNode, base: Partial<FaceState> = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  const walk = (current: HtmlNode, state: FaceState) => {
    if (current instanceof TextNode) {
      const text = current.text.replace(/ /g, ' ').replace(/\s+/g, ' ');
      if (text) runs.push({ kind: 'text', text, face: faceOf(state) });
      return;
    }
    if (!(current instanceof HTMLElement)) return;
    const tag = current.tagName;
    if (BLOCK_TAGS.has(tag)) return;
    if (tag === 'BR') {
      runs.push({ kind: 'break' });
      return;
    }
    const math = current.getAttribute('data-math');
    if (math === 'inline' || math === 'block') {
      runs.push(...mathRuns(current));
      return;
    }
    if (tag === 'P' && runs.length > 0) runs.push({ kind: 'break' });
    const next: FaceState = {
      bold: state.bold || tag === 'STRONG' || tag === 'B',
      italic: state.italic || tag === 'EM' || tag === 'I',
      code: state.code || tag === 'CODE',
    };
    current.childNodes.forEach(child => walk(child, next));
  };
  walk(node, { bold: !!base.bold, italic: !!base.italic, code: !!base.code });
  return runs;
}

/** An export equation element as runs: its picture, or its source in Courier. */
export function mathRuns(element: HTMLElement): InlineRun[] {
  const display = element.getAttribute('data-display') === 'true' || element.getAttribute('data-math') === 'block';
  const source = element.getAttribute('data-source') ?? element.getAttribute('data-latex') ?? '';
  const src = element.querySelector('img[data-math-image]')?.getAttribute('src') ?? '';
  const png = /^data:image\/png;base64,(.+)$/i.exec(src);
  const width = Number.parseFloat(element.getAttribute('data-width') ?? '');
  const height = Number.parseFloat(element.getAttribute('data-height') ?? '');
  const depth = Number.parseFloat(element.getAttribute('data-depth') ?? '');
  if (element.getAttribute('data-status') === 'ok' && png && width > 0 && height > 0) {
    return [{
      kind: 'math',
      image: Buffer.from(png[1], 'base64'),
      width: width * PT_PER_PX,
      height: height * PT_PER_PX,
      depth: (Number.isFinite(depth) ? depth : 0) * PT_PER_PX,
      display,
    }];
  }
  return [{ kind: 'text', text: source, face: 'code' }];
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface Piece {
  width: number;
  ascent: number;
  descent: number;
  space: boolean;
  draw(surface: PdfSurface, x: number, baseline: number): void;
}

interface Line {
  pieces: Piece[];
  centred: boolean;
}

function textPieces(run: Extract<InlineRun, { kind: 'text' }>, surface: PdfSurface, options: LayoutOptions): Piece[] {
  const font = options.fonts[run.face];
  const size = run.face === 'code' ? options.fontSize * 0.92 : options.fontSize;
  const ascent = surface.ascent(font, size);
  const descent = surface.descent(font, size);
  return run.text.split(/( +)/).filter(Boolean).map(word => ({
    width: surface.widthOf(word, font, size),
    ascent,
    descent,
    space: /^ +$/.test(word),
    draw: (target, x, baseline) => target.drawText(word, x, baseline, font, size, options.color),
  }));
}

function mathPiece(run: Extract<InlineRun, { kind: 'math' }>, maxWidth: number): Piece {
  const scale = run.width > maxWidth ? maxWidth / run.width : 1;
  const width = run.width * scale;
  const height = run.height * scale;
  const depth = run.depth * scale;
  return {
    width,
    ascent: height - depth,
    descent: depth,
    space: false,
    draw: (target, x, baseline) => target.drawImage(run.image, x, baseline - (height - depth), width, height),
  };
}

/** Break runs into lines no wider than `options.width`. */
export function breakLines(runs: InlineRun[], surface: PdfSurface, options: LayoutOptions): Line[] {
  const lines: Line[] = [];
  let current: Piece[] = [];
  let used = 0;
  const finish = (centred = false) => {
    while (current.length && current[current.length - 1].space) current.pop();
    lines.push({ pieces: current, centred });
    current = [];
    used = 0;
  };
  for (const run of runs) {
    if (run.kind === 'break') {
      finish();
      continue;
    }
    if (run.kind === 'math' && run.display) {
      if (current.length) finish();
      current = [mathPiece(run, options.width)];
      finish(true);
      continue;
    }
    const pieces = run.kind === 'math' ? [mathPiece(run, options.width)] : textPieces(run, surface, options);
    for (const piece of pieces) {
      if (piece.space && current.length === 0) continue;
      if (!piece.space && used + piece.width > options.width && current.length > 0) {
        finish();
      }
      current.push(piece);
      used += piece.width;
    }
  }
  if (current.length || lines.length === 0) finish();
  return lines;
}

/**
 * Lay out and draw runs; returns the y below the last line. With `dryRun`,
 * draws nothing and does not break pages: the height of a table cell or a
 * paragraph, measured.
 */
export function layoutRuns(runs: InlineRun[], surface: PdfSurface, options: LayoutOptions): number {
  const lines = breakLines(runs, surface, options);
  const textAscent = surface.ascent(options.fonts.regular, options.fontSize);
  const textDescent = surface.descent(options.fonts.regular, options.fontSize);
  let y = options.y;
  for (const line of lines) {
    const ascent = Math.max(textAscent, ...line.pieces.map(piece => piece.ascent));
    const descent = Math.max(textDescent, ...line.pieces.map(piece => piece.descent));
    const height = ascent + descent + options.lineGap;
    if (!options.dryRun) y = surface.roomFor(height, y);
    if (!options.dryRun) {
      const width = line.pieces.reduce((sum, piece) => sum + piece.width, 0);
      let x = line.centred ? options.x + (options.width - width) / 2 : options.x;
      for (const piece of line.pieces) {
        piece.draw(surface, x, y + ascent);
        x += piece.width;
      }
    }
    y += height;
  }
  return y;
}

/** The PDF surface over a pdfkit document. */
export function pdfkitSurface(
  doc: PDFKit.PDFDocument,
  pageBottom: () => number,
  pageTop: number,
): PdfSurface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = (font: string) => (doc.font(font) as any)._font as { ascender: number; descender: number };
  return {
    widthOf: (text, font, size) => doc.font(font).fontSize(size).widthOfString(text),
    ascent: (font, size) => (metrics(font).ascender / 1000) * size,
    descent: (font, size) => (-metrics(font).descender / 1000) * size,
    drawText: (text, x, baseline, font, size, color) => {
      doc.font(font).fontSize(size).fillColor(color).text(text, x, baseline, { lineBreak: false, baseline: 'alphabetic' });
    },
    drawImage: (image, x, y, width, height) => {
      doc.image(image, x, y, { width, height });
    },
    roomFor: (height, y) => {
      if (y + height > pageBottom()) {
        doc.addPage();
        return pageTop;
      }
      return y;
    },
  };
}
