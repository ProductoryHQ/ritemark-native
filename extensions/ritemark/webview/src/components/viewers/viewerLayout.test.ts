/**
 * Sprint 124 (#284) R4 — zoom, fit, page position and document search.
 * Run: npx tsx webview/src/components/viewers/viewerLayout.test.ts
 */
import assert from 'node:assert/strict';
import { findDocumentMatches, type TextChunk } from './documentSearch';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  fitPageZoom,
  fitWidthZoom,
  pageAtScroll,
  pageLabel,
  stepZoom,
  zoomLabel,
} from './viewerLayout';

// zoom ladder
assert.equal(stepZoom(1, 1), 1.1);
assert.equal(stepZoom(1, -1), 0.9);
assert.equal(stepZoom(0.83, 1), 0.9, 'from between steps, up goes to the next step');
assert.equal(stepZoom(0.83, -1), 0.75);
assert.equal(stepZoom(MAX_ZOOM, 1), MAX_ZOOM);
assert.equal(stepZoom(MIN_ZOOM, -1), MIN_ZOOM);
assert.equal(zoomLabel(0.875), '88%');

// fit: an A4 page (794 × 1123 px at 96 dpi)
assert.equal(fitWidthZoom(794, 842, 24), 1);
assert.ok(Math.abs(fitWidthZoom(794, 1636, 24) - 2) < 1e-9);
assert.equal(fitWidthZoom(794, 100000), MAX_ZOOM, 'clamped');
assert.equal(fitWidthZoom(0, 800), 1, 'unmeasured page');
const fp = fitPageZoom(794, 1123, 1600, 800, 24);
assert.ok(Math.abs(fp - (800 - 48) / 1123) < 1e-9, 'a short, wide viewport is limited by height');
assert.equal(fitPageZoom(794, 1123, 400, 4000, 24), fitWidthZoom(794, 400, 24), 'a narrow, tall one by width');

// page position: tops relative to the viewport; the reading line is a third down
assert.equal(pageAtScroll([0, 1150, 2300], 900), 0);
assert.equal(pageAtScroll([-1000, 350, 1500], 900), 0, 'the next page starts below the line (300 px)');
assert.equal(pageAtScroll([-1000, 310, 1460], 900), 0);
assert.equal(pageAtScroll([-1000, 290, 1440], 900), 1, 'past the line: page 2');
assert.equal(pageAtScroll([-3000, -1800, -600], 900), 2);
assert.equal(pageAtScroll([], 900), 0);
assert.equal(pageLabel(2, 12), '3 / 12');
assert.equal(pageLabel(0, 0), '…');

// search across text nodes
const chunks: TextChunk[] = [
  { text: 'The harbour ', newBlock: true },
  { text: 'off', newBlock: false },
  { text: 'ice opens at seven.', newBlock: false },
  { text: 'Office hours', newBlock: true },
  { text: '', newBlock: false },
  { text: 'OFFICE', newBlock: true },
];
const office = findDocumentMatches(chunks, 'office');
assert.equal(office.length, 3);
assert.deepEqual(office[0], { start: { chunk: 1, offset: 0 }, end: { chunk: 2, offset: 3 } }, 'a match split by formatting');
assert.deepEqual(office[1], { start: { chunk: 3, offset: 0 }, end: { chunk: 3, offset: 6 } });
assert.deepEqual(office[2], { start: { chunk: 5, offset: 0 }, end: { chunk: 5, offset: 6 } }, 'an empty chunk is skipped');
assert.equal(findDocumentMatches(chunks, 'seven.Office').length, 0, 'no match across paragraphs');
assert.equal(findDocumentMatches(chunks, '  ').length, 0, 'blank query');
assert.equal(findDocumentMatches([], 'x').length, 0);
const end = findDocumentMatches([{ text: 'abc', newBlock: true }, { text: 'def', newBlock: false }], 'bc');
assert.deepEqual(end[0].end, { chunk: 0, offset: 3 }, 'an end at a node boundary stays in the first node');
assert.equal(findDocumentMatches([{ text: 'Õun ja ÕUN', newBlock: true }], 'õun').length, 2);

console.log('viewerLayout.test.ts: all passed');
