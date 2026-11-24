import { foldCase } from '../../webview/src/utils/textSearch';
import type { SourcePassage } from '../../webview/src/utils/sourcePassage';
import { readDocx } from '../search/worker/readers/docx';
import { readMarkdown } from '../search/worker/readers/markdown';
import { pdfPageContent, withPdf } from '../search/worker/readers/pdf';
import { decodeText } from '../search/worker/readers/types';
import type { SourceLocation } from './documentRead';

const TEXT_BUDGET = 400_000;
const normalize = (text: string) => foldCase(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');

/** Return the document's literal words so the existing find bar can match them. */
function quoteRange(block: string, quote: string): [start: number, end: number] | undefined {
  const at = normalize(block).indexOf(quote);
  if (at < 0) return;
  // Map across runs of whitespace only, since case and quote folding preserve offsets.
  let start = at;
  let end = at + quote.length;
  let extra = 0;
  for (const match of block.matchAll(/\s{2,}/g)) {
    const normalizedOffset = match.index - extra;
    const removed = match[0].length - 1;
    if (normalizedOffset < at) start += removed;
    if (normalizedOffset >= at + quote.length) break;
    end += removed;
    extra += removed;
  }
  return [start, end];
}

export async function locateSourcePassage(
  bytes: Uint8Array,
  extension: string,
  { text, page }: SourcePassage,
  pause: () => Promise<void>,
): Promise<SourceLocation | undefined> {
  if (extension === '.pdf') {
    const result = await withPdf(bytes, async (doc): Promise<SourceLocation | undefined> => {
      if (page !== undefined && page > doc.numPages) return;
      if (!text) return page ? { page } : undefined;

      const quote = normalize(text);
      const matchOn = async (number: number) => {
        await pause();
        const { items } = await pdfPageContent(doc, number);
        // The reading tool treats line endings as whitespace. The preview joins
        // the same items directly, so strip any synthetic spaces from the match.
        let block = '';
        const lineSpaces: number[] = [];
        for (const item of items) {
          block += item.str ?? '';
          if (item.hasEOL && block && !/\s$/.test(block)) {
            lineSpaces.push(block.length);
            block += ' ';
          }
        }
        const range = quoteRange(block, quote);
        if (!range) return;
        const [start, end] = range;
        let literal = '';
        let offset = start;
        for (const space of lineSpaces) {
          if (space < start) continue;
          if (space >= end) break;
          literal += block.slice(offset, space);
          offset = space + 1;
        }
        // The occurrence is relative to this page, as counted by the preview.
        literal += block.slice(offset, end);
        const prior = foldCase(items.map((item) => item.str ?? '').join(''));
        const needle = foldCase(literal);
        const literalStart = start - lineSpaces.filter((space) => space < start).length;
        let occurrence = 0;
        for (let at = prior.indexOf(needle); at >= 0 && at < literalStart; at = prior.indexOf(needle, at + needle.length)) occurrence++;
        return { text: literal, occurrence };
      };

      if (page !== undefined) {
        const match = await matchOn(page);
        if (match) return { ...match, page };
      }
      for (let number = 1; number <= doc.numPages; number++) {
        if (number === page) continue;
        const match = await matchOn(number);
        if (match) return page ? { page } : { ...match, page: number };
      }
    });
    return result && !('reason' in result) ? result : undefined;
  }

  if (!text) return;
  const read = extension === '.docx' ? await readDocx(bytes, TEXT_BUDGET, true)
    : readMarkdown(decodeText(bytes), TEXT_BUDGET, { preserveSpacing: true });
  if (!read.ok) return;
  const quote = normalize(text);
  for (const { text: block } of read.passages) {
    const range = quoteRange(block, quote);
    if (range) return { text: block.slice(...range), occurrence: 0 };
  }
}
