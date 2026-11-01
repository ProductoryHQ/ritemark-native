/**
 * Sprint 148 (R2, A2): a PDF's text through pdf.js (`pdfjs-dist`, the webview's
 * version), with the PDF preview's own index (`buildPdfSearchIndex`), so the
 * text the list searches is made of the chunks the preview's find bar searches.
 *
 * pdf.js is inlined into the worker's bundle (A2): its legacy build loaded on the
 * first PDF, its "fake worker" (pdf.js's own parser, in this thread) found
 * through `globalThis.pdfjsWorker`, no canvas package. Its drawing code builds one
 * `DOMMatrix` when it loads; text extraction never draws, so a stub stands in.
 *
 * A passage is a run of lines of one page, broken where the lines leave a gap
 * (a paragraph) or past ~600 characters, and carries its page. The preview's
 * chunks keep no line ends, so they are read from the same text items here: a
 * word at the end of a line doesn't run into the first word of the next.
 * A PDF with less text than the preview's scanned threshold is found by name.
 */
import { buildPdfSearchIndex } from '../../../../webview/src/components/viewers/pdfSearchIndex';
import { PassageSink, type ReadOutcome } from './types';

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  height?: number;
}

interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
  cleanup(): void;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfJs {
  getDocument(source: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

const PASSAGE_CHARS = 600;

/** A stand-in for the one `DOMMatrix` pdf.js's drawing code builds at load. Drawing is never asked for. */
class DOMMatrixStub {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
}

let pdfjs: Promise<PdfJs> | null = null;

function loadPdfjs(): Promise<PdfJs> {
  pdfjs ??= (async () => {
    const scope = globalThis as unknown as { DOMMatrix?: unknown; pdfjsWorker?: unknown };
    scope.DOMMatrix ??= DOMMatrixStub;
    // pdf.js's parser, in this thread: getDocument finds it here instead of starting a worker of its own.
    scope.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJs;
  })();
  return pdfjs;
}

interface ChunkShape {
  endsLine: boolean;
  y: number;
  height: number;
}

/**
 * pdf.js transfers the bytes it is given, which detaches their buffer. A view that
 * shares its buffer (a pooled `Buffer`) is copied first, so nothing else is detached.
 */
function ownBuffer(bytes: Uint8Array): Uint8Array {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
}

/** Reads a PDF's text. `bytes` may be detached afterwards. */
export async function readPdf(bytes: Uint8Array, budget: number, pause: () => Promise<void>): Promise<ReadOutcome> {
  const library = await loadPdfjs();
  let doc: PdfDocument;
  try {
    doc = await library.getDocument({
      data: ownBuffer(bytes),
      verbosity: 0,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
      enableXfa: false,
      isOffscreenCanvasSupported: false,
    }).promise;
  } catch (error) {
    return { ok: false, reason: (error as { name?: string })?.name === 'PasswordException' ? 'protected' : 'unreadable' };
  }
  try {
    const shapes: ChunkShape[][] = [];
    let chars = 0;
    const proxy = {
      numPages: doc.numPages,
      getPage: async (pageNumber: number) => {
        await pause();
        const page: ChunkShape[] = [];
        shapes[pageNumber - 1] = page;
        if (chars >= budget) return { getTextContent: async () => ({ items: [] }) };
        const pdfPage = await doc.getPage(pageNumber);
        return {
          getTextContent: async () => {
            const content = await pdfPage.getTextContent();
            pdfPage.cleanup();
            const items = content.items;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (typeof item.str !== 'string' || item.str.length === 0) continue;
              const next = items[i + 1];
              const endsLine = item.hasEOL === true || (next !== undefined && next.str === '' && next.hasEOL === true);
              page.push({ endsLine, y: item.transform?.[5] ?? 0, height: item.height ?? 0 });
              chars += item.str.length;
            }
            return content as never;
          },
        };
      },
    };
    const index = await buildPdfSearchIndex(proxy as never);
    if (index.scanned) return { ok: false, reason: 'scanned' };

    const sink = new PassageSink(budget);
    let text = '';
    let page = 0;
    let lineY: number | null = null;
    let lineHeight = 0;
    let atLineStart = true;
    let shapeIndex = 0;
    const flush = () => {
      if (text) sink.add(text, { page });
      text = '';
    };
    index.chunks.forEach((chunk, i) => {
      const location = index.locations[i];
      if (location.page !== page) {
        flush();
        page = location.page;
        shapeIndex = 0;
        lineY = null;
        atLineStart = true;
      }
      const shape = shapes[page - 1]?.[shapeIndex++] ?? { endsLine: false, y: 0, height: 0 };
      if (atLineStart) {
        const gap = lineY === null ? 0 : lineY - shape.y;
        const height = Math.max(lineHeight, shape.height, 1);
        if (lineY !== null && (gap > height * 1.8 || gap < -height || text.length > PASSAGE_CHARS)) flush();
        else if (text && !/[\s-]$/.test(text)) text += ' ';
        lineY = shape.y;
        lineHeight = shape.height;
        atLineStart = false;
      }
      text += chunk.text;
      if (shape.endsLine) atLineStart = true;
    });
    flush();
    return { ok: true, passages: sink.passages, truncated: sink.truncated || chars >= budget };
  } catch {
    return { ok: false, reason: 'unreadable' };
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}
