/**
 * Issue #344 — PDF search index: text items -> searchable chunks -> match locations.
 * Run: npx tsx webview/src/components/viewers/pdfSearchIndex.test.ts
 */
import assert from 'node:assert/strict';
import { buildPdfSearchIndex, findDocumentMatches, resolvePdfMatch } from './pdfSearchIndex';

// A tiny fake pdf.js document: two pages, each a list of text items (some
// empty — pdf.js emits those but they never get a DOM span). Cast rather than
// match pdfjs-dist's full TextItem/TextMarkedContent shape, same as the
// `pdfjs as unknown as ...` casts already used where this codebase talks to
// pdf.js (PDFViewer.tsx, conversion/pdfToMarkdown.ts).
function fakeDoc(pages: Array<Array<{ str: string } | { type: 'beginMarkedContent' }>>) {
  return {
    numPages: pages.length,
    getPage: async (n: number) => ({
      getTextContent: async () => ({ items: pages[n - 1] }),
    }),
  } as unknown as Parameters<typeof buildPdfSearchIndex>[0];
}

async function main() {
  const doc = fakeDoc([
    [{ str: 'The harbour ' }, { str: '' }, { str: 'office opens at seven.' }],
    [{ str: 'Office hours ' }, { type: 'beginMarkedContent' }, { str: 'vary.' }],
  ]);

  const index = await buildPdfSearchIndex(doc);

  // Empty-string items and marked-content markers are dropped from both the
  // chunk list and the location list — they never produce a DOM span.
  assert.equal(index.chunks.length, 4);
  assert.deepEqual(index.locations, [
    { page: 1, itemIndex: 0 },
    { page: 1, itemIndex: 1 },
    { page: 2, itemIndex: 0 },
    { page: 2, itemIndex: 1 },
  ]);
  assert.equal(index.scanned, false);

  // Page boundaries are block boundaries: a match can't span two pages.
  assert.equal(findDocumentMatches(index.chunks, 'seven.Office').length, 0);

  const matches = findDocumentMatches(index.chunks, 'office');
  assert.equal(matches.length, 2, 'case-insensitive, once per page');

  const first = resolvePdfMatch(index, matches[0]);
  assert.deepEqual(first.start, { page: 1, itemIndex: 1, offset: 0 });
  assert.deepEqual(first.end, { page: 1, itemIndex: 1, offset: 6 });

  const second = resolvePdfMatch(index, matches[1]);
  assert.deepEqual(second.start, { page: 2, itemIndex: 0, offset: 0 });
  assert.deepEqual(second.end, { page: 2, itemIndex: 0, offset: 6 });

  // Scanned PDF: total extractable text stays under the threshold shared
  // with conversion/pdfToMarkdown.ts.
  const scannedDoc = fakeDoc([[{ str: 'x' }], [{ str: '' }]]);
  const scannedIndex = await buildPdfSearchIndex(scannedDoc);
  assert.equal(scannedIndex.scanned, true);
  assert.equal(scannedIndex.chunks.length, 1);

  console.log('pdfSearchIndex.test.ts: all passed');
}

void main();
