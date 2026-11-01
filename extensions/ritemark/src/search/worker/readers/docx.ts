/**
 * Sprint 148 (R2, A3): a Word document's body text, from `word/document.xml`
 * through the Office preview's own zip reader and its limits
 * (`officePreview/officePackageCheck.ts`). One passage per paragraph and per
 * table cell; a text box's paragraphs are passages of their own.
 *
 * Kept: runs (`w:t`), tabs and line breaks as spaces, inserted text. Left out:
 * deleted text (`w:delText`), field codes (`w:instrText`), and the parts outside
 * the body (headers, footers, footnotes, comments: not in Sprint 148).
 * A password-protected, damaged or legacy file is refused, and found by name.
 */
import { OFFICE_PREVIEW_LIMITS, checkOfficePackage, readZipDirectory, readZipEntry } from '../../../officePreview/officePackageCheck';
import { PassageSink, decodeEntities, type ReadOutcome } from './types';

const TAG = /<(\/?)([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)([^>]*?)(\/?)>/g;

interface Context {
  kind: 'paragraph' | 'cell';
  text: string;
}

/** The passages of `word/document.xml`. */
export function documentXmlPassages(xml: string, budget: number): ReadOutcome {
  const sink = new PassageSink(budget);
  const stack: Context[] = [];
  let block = 0;
  let inText = false;
  let last = 0;
  const append = (text: string) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === 'paragraph' || stack[i].kind === 'cell') {
        stack[i].text += text;
        return;
      }
    }
  };
  TAG.lastIndex = 0;
  for (let match = TAG.exec(xml); match && !sink.full; match = TAG.exec(xml)) {
    if (inText && match.index > last) append(decodeEntities(xml.slice(last, match.index)));
    last = TAG.lastIndex;
    const closing = match[1] === '/';
    const name = match[3];
    const selfClosing = match[5] === '/';
    switch (name) {
      case 't':
        inText = !closing && !selfClosing;
        break;
      case 'tab':
      case 'br':
      case 'cr':
        if (!closing) append(' ');
        break;
      case 'p':
        if (selfClosing) break;
        if (!closing) {
          stack.push({ kind: 'paragraph', text: '' });
        } else {
          const done = stack.pop();
          if (!done) break;
          const parentCell = stack.length > 0 && stack[stack.length - 1].kind === 'cell' ? stack[stack.length - 1] : null;
          if (parentCell) parentCell.text += (parentCell.text ? ' ' : '') + done.text;
          else sink.add(done.text, { block: block++ });
        }
        break;
      case 'tc':
        if (selfClosing) break;
        if (!closing) {
          stack.push({ kind: 'cell', text: '' });
        } else {
          const done = stack.pop();
          if (done) sink.add(done.text, { block: block++ });
        }
        break;
      default:
        // w:delText and w:instrText end a run of text without adding to it.
        if (name === 'delText' || name === 'instrText') inText = false;
    }
  }
  return { ok: true, passages: sink.passages, truncated: sink.truncated };
}

export async function readDocx(bytes: Uint8Array, budget: number): Promise<ReadOutcome> {
  const verdict = await checkOfficePackage(bytes, 'word/', OFFICE_PREVIEW_LIMITS);
  if (!verdict.ok) {
    if (verdict.reason === 'password-protected') return { ok: false, reason: 'protected' };
    if (verdict.reason === 'too-large') return { ok: false, reason: 'too-large' };
    return { ok: false, reason: 'unreadable' };
  }
  const entry = readZipDirectory(bytes)?.find((candidate) => candidate.name === 'word/document.xml');
  if (!entry) return { ok: false, reason: 'unreadable' };
  const data = await readZipEntry(bytes, entry);
  if (!data) return { ok: false, reason: 'unreadable' };
  const xml = new TextDecoder('utf-8').decode(data);
  return documentXmlPassages(xml, budget);
}
