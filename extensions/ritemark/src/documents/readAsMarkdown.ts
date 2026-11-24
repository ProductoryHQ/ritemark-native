import { SCANNED_PDF_TEXT_THRESHOLD } from '../../webview/src/conversion/pdfToMarkdown';
import { pdfPageContent, withPdf } from '../search/worker/readers/pdf';
import type { DocumentKind, DocumentReadRequest, DocumentReadResult } from './documentRead';
import { powerpointMarkdown, PowerPointXmlTooLarge } from './powerpointMarkdown';
import { wordMarkdown, WordXmlTooLarge } from './wordMarkdown';

export const DOCUMENT_TEXT_LIMIT = 400_000;

const units = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
const unreadable = (name: string, kind: DocumentKind) => ({
  kind,
  text: `Couldn't read ${name}. The file may be damaged. Try opening it in its usual app and saving a new copy.`,
});

export function documentTooLarge(name: string, kind: DocumentKind): DocumentReadResult {
  return { kind, text: `Couldn't read ${name}. It is too big (the limit is 50 MB). Open it in its usual app or save a smaller copy.` };
}

const kindLabel: Record<DocumentKind, string> = { word: 'Word', pdf: 'PDF', powerpoint: 'PowerPoint' };

function reading(name: string, kind: DocumentKind, total: string, status: string, text: string, cut?: string): DocumentReadResult {
  return {
    kind,
    text: `${name} · ${kindLabel[kind]} · ${total} · ${status}\n\n${text}${cut ? `\n\nText was ${cut}.` : ''}`,
  };
}

/** Reading mode, independent of the passages and cache used by search. */
export async function readAsMarkdown(
  bytes: Uint8Array,
  name: string,
  kind: DocumentKind,
  range: Pick<DocumentReadRequest, 'from' | 'to'>,
  pause: () => Promise<void>,
  limit = DOCUMENT_TEXT_LIMIT,
): Promise<DocumentReadResult> {
  // Keep the header a single line even for unusual filenames.
  name = name.replace(/[\r\n\u2028\u2029]/g, ' ');
  try {
    if (kind === 'word') {
      const word = await wordMarkdown(bytes, limit);
      if (!word.ok) {
        if (word.reason === 'password-protected') {
          return { kind, text: `Couldn't read ${name}: it has a password. Open it in Word, or save a copy without the password.` };
        }
        if (word.reason === 'too-large') return documentTooLarge(name, kind);
        if (word.reason === 'legacy-format') {
          return { kind, text: `${name} is an older Word format. Open it in Word and save a .docx copy.` };
        }
        if (word.reason === 'too-complex') {
          return { kind, text: `Couldn't read ${name}. Its contents are too large or complex. Open it in Word or save a smaller copy.` };
        }
        return unreadable(name, kind);
      }

      let text = '';
      let count = 0;
      let cut: string | undefined;
      let previousWasList = false;
      for (const block of word.blocks) {
        count++;
        if (cut) continue;
        const separator = text ? (previousWasList && block.list ? '\n' : '\n\n') : '';
        previousWasList = block.list === true;
        if (text.length + separator.length + block.text.length <= limit) text += separator + block.text;
        else if (text) cut = `cut after block ${count - 1}`;
        else {
          text = block.text.slice(0, limit);
          cut = 'cut in block 1';
        }
      }
      if (!count) return { kind, text: `${name} has no readable text in its body. Open it in Word to see the document.` };
      if (cut) cut += ` of ${count}`;
      return reading(name, kind, units(count, 'block'), cut ?? 'whole text', text, cut);
    }

    if (kind === 'powerpoint') {
      const deck = await powerpointMarkdown(bytes);
      if (!deck.ok) {
        if (deck.reason === 'password-protected') {
          return { kind, text: `Couldn't read ${name}: it has a password. Open it in PowerPoint, or save a copy without the password.` };
        }
        if (deck.reason === 'too-large') return documentTooLarge(name, kind);
        if (deck.reason === 'legacy-format') {
          return { kind, text: `${name} is an older PowerPoint format. Open it in PowerPoint and save a .pptx copy.` };
        }
        if (deck.reason === 'too-complex') {
          return { kind, text: `Couldn't read ${name}. Its contents are too large or complex. Open it in PowerPoint or save a smaller copy.` };
        }
        return unreadable(name, kind);
      }

      const { total } = deck;
      const from = range.from ?? 1;
      const to = range.to ?? total;
      if (!total && range.from === undefined && range.to === undefined) {
        return reading(name, kind, units(total, 'slide'), 'whole text', 'This presentation has no slides.');
      }
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > to || to > total) {
        return { kind, text: `${name} has ${units(total, 'slide')}.${total ? ` Choose a slide range within 1 to ${total}.` : ''}`, isError: true };
      }
      let text = '';
      let cut: string | undefined;
      for (let slide = from; slide <= to; slide++) {
        await pause();
        const { body, notes } = await deck.slide(slide);
        const chunk = `${text ? '\n\n' : ''}## Slide ${slide}\n\n${body || 'No extractable text on this slide.'}\n\n${notes ? `Notes:\n\n${notes}` : 'Notes: none'}`;
        if (text.length + chunk.length <= limit) text += chunk;
        else {
          if (text) cut = `cut after slide ${slide - 1} of ${total}`;
          else {
            text = chunk.slice(0, limit);
            cut = `cut in slide ${slide} of ${total}`;
          }
          break;
        }
      }
      const status = from === 1 && to === total ? 'whole text' : from === to ? `slide ${from}` : `slides ${from}–${to}`;
      return reading(name, kind, units(total, 'slide'), cut ? `${status === 'whole text' ? '' : status + ', '}${cut}` : status, text, cut);
    }

    const result = await withPdf(bytes, async (doc) => {
      const total = doc.numPages;
      const from = range.from ?? 1;
      const to = range.to ?? total;
      if (from > total || to > total || from > to) {
        return { kind, text: `${name} has ${units(total, 'page')}. Choose a page range within 1 to ${total}.`, isError: true };
      }

      let text = '';
      let chars = 0;
      let cut: string | undefined;
      for (let page = from; page <= to; page++) {
        await pause();
        const { items } = await pdfPageContent(doc, page);
        const heading = `## Page ${page}\n\n`;
        let body = '';
        let overflow = false;
        for (const item of items) {
          if (typeof item.str !== 'string') continue;
          chars += item.str.length;
          if (cut || overflow) continue;
          const room = limit - body.length;
          body += item.str.slice(0, room);
          if (item.str.length > room) overflow = true;
          else if (item.hasEOL && body.length < limit) body += '\n';
        }
        if (!cut) {
          const chunk = (text ? '\n\n' : '') + heading + (body.trim() || 'No extractable text on this page.');
          if (!overflow && text.length + chunk.length <= limit) text += chunk;
          else if (text) cut = `cut after page ${page - 1} of ${total}`;
          else {
            text = chunk.slice(0, limit);
            cut = `cut in page ${page} of ${total}`;
          }
        }
        if (cut && chars >= SCANNED_PDF_TEXT_THRESHOLD) break;
      }

      // A short or blank selection can come from a text PDF. Apply search's
      // scan threshold to the document, including pages outside the selection.
      for (let page = 1; page <= total && chars < SCANNED_PDF_TEXT_THRESHOLD; page++) {
        if (page >= from && page <= to) continue;
        await pause();
        const { items } = await pdfPageContent(doc, page);
        for (const item of items) chars += item.str?.length ?? 0;
      }
      if (chars < SCANNED_PDF_TEXT_THRESHOLD) {
        return { kind, text: `${name} is a scan with no text (${units(total, 'page')}). Open it in the PDF viewer or use a copy with searchable text.` };
      }
      const status = from === 1 && to === total ? 'whole text' : from === to ? `page ${from}` : `pages ${from}–${to}`;
      return reading(name, kind, units(total, 'page'), cut ? `${status === 'whole text' ? '' : status + ', '}${cut}` : status, text, cut);
    });
    if ('reason' in result) {
      return result.reason === 'protected'
        ? { kind, text: `Couldn't read ${name}: it has a password. Open it in a PDF viewer or save a copy without the password.` }
        : unreadable(name, kind);
    }
    return result;
  } catch (error) {
    if (error instanceof PowerPointXmlTooLarge) {
      return { kind, text: `Couldn't read ${name}. Its PowerPoint text or formatting data is too large. Open it in PowerPoint or save a smaller copy.` };
    }
    if (error instanceof WordXmlTooLarge) {
      return { kind, text: `Couldn't read ${name}. Its Word text or formatting data is too large. Open it in Word or save a smaller copy.` };
    }
    return unreadable(name, kind);
  }
}
