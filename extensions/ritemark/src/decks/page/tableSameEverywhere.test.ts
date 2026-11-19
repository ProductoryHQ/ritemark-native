/**
 * Sprint 166 PR 3: a table looks the same in the editor, on the wall and on the page (#827, #828).
 *
 * #827: the stage's cell holds its words in a paragraph (the editor's schema), the renderer's drawing holds them bare,
 * so a row on the stage is as tall as on the wall only when that paragraph takes no margin. The row's height is
 * computed from the sheets the stage draws with (slide.css, then decks.css and the document editor's index.css) at two
 * fit levels: padding above and under, one line, the row's 1 px line, and the paragraph's margins on the stage.
 *
 * #828: on the page's one-column reading (≤ 860 px) a slide's table is its own scrolling frame. The frame's width is
 * computed from the page's rule for it: `width: auto` on a block box takes the column's width (the bug: the border
 * spans the column, the rows stop at a quarter), `fit-content` takes the table's own, both capped by `max-width`.
 * The page's script watches those frames for the edge fade.
 *
 * Run: npx tsx src/decks/page/tableSameEverywhere.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PAGE_CSS } from './pageHtml';
import { PAGE_SCRIPT } from './pageScript';

const webview = path.resolve(__dirname, '..', '..', '..', 'webview', 'src');
const flat = (file: string) => fs.readFileSync(path.join(webview, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const slide = flat('components/decks/slide/slide.css');
const decks = flat('components/decks/decks.css');
const index = flat('index.css');

/** Every declaration of every rule whose selector list is exactly `selector`, later ones winning. */
function rule(sheet: string, selector: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].trim() !== selector) continue;
    for (const part of match[2].split(';')) {
      const at = part.indexOf(':');
      if (at > 0) found[part.slice(0, at).trim()] = part.slice(at + 1).trim();
    }
  }
  return found;
}

function px(value: string, fit: number): number {
  const v = value.trim();
  if (v === '0') return 0;
  let m = /^calc\((-?[\d.]+)px \* var\(--fit, 1\)\)$/.exec(v);
  if (m) return Number(m[1]) * fit;
  m = /^(-?[\d.]+)px$/.exec(v);
  if (m) return Number(m[1]);
  throw new Error(`not a slide-px length: ${v}`);
}
function box(value: string, fit: number): [number, number, number, number] {
  const n = (value.match(/calc\([^)]*\)\)|[^ ]+/g) ?? []).map(part => px(part, fit));
  const [t, r = t, b = t, l = r] = n;
  return [t, r, b, l];
}

const B = '.deck-sl.is-blocks';
const LINE = 21; // one line of a cell's words; the same on both, it cancels out

/** The margin a paragraph in a stage cell takes: the most specific of the rules that reach it (later wins a tie). */
function stageCellParagraphMargin(fit: number): [number, number, number, number] {
  const candidates: Array<[number, string | undefined]> = [
    [11, rule(index, '.ProseMirror p').margin], // (0,1,1): .5em, outweighed below
    [21, rule(slide, `${B} p`).margin], // (0,2,1)
    [32, rule(decks, `${B}.is-editing :is(th, td) > p`).margin], // (0,3,2)
  ];
  const winner = candidates.filter(([, value]) => value !== undefined).sort((a, b) => a[0] - b[0]).pop();
  assert.ok(winner && winner[0] > 11, 'a slide rule decides the stage cell paragraph margin');
  return box(winner![1]!, fit);
}

function rowHeight(on: 'wall' | 'stage', fit: number): number {
  const [pt, , pb] = box(rule(slide, `${B} th, ${B} td`).padding, fit);
  const line = /1px/.test(rule(slide, `${B} td`)['border-top'] ?? '') ? 1 : 0;
  if (on === 'wall') return pt + LINE + pb + line;
  const [mt, , mb] = stageCellParagraphMargin(fit);
  return pt + mt + LINE + mb + pb + line;
}

for (const fit of [1, 0.8]) {
  assert.equal(rowHeight('stage', fit), rowHeight('wall', fit), `#827: a stage row is as tall as the wall's at fit ${fit}`);
}
// The stage keeps no other cell padding or border of the document editor's own that the wall lacks.
assert.equal(rule(decks, `${B}.is-editing th`).border, '0', 'a header cell on the stage has no document border');
assert.match(rule(decks, `${B}.is-editing td`)['border-bottom'] ?? '', /^0$/, 'a body cell on the stage has no bottom border');

/** The page's frame width for a table of `table` px in a column of `column` px, from its rule's width and max-width. */
function frameWidth(decls: Record<string, string>, table: number, column: number): number {
  assert.equal(decls.display, 'block', 'the frame is the table as a block, scrolling inside');
  const width = decls.width ?? 'auto';
  const wanted = width === 'auto' ? column : /^(fit-content|max-content)$/.test(width) ? table : NaN;
  assert.ok(!Number.isNaN(wanted), `a frame width the model knows: ${width}`);
  const max = decls['max-width'] === '100%' ? column : Infinity;
  return Math.min(wanted, max);
}
const page = PAGE_CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const frame = rule(page, `.layer.flow ${B} table`);
assert.equal(frameWidth(frame, 180, 688), 180, '#828: a narrow table\'s frame hugs it');
assert.equal(frameWidth(frame, 1100, 688), 688, '#828: a wide table\'s frame stops at the column\'s width');
assert.match(frame['overflow-x'] ?? '', /^auto$/, '#828: and a wide one scrolls inside');
assert.ok(rule(page, `.layer.flow ${B} table:is(.is-scrollable-left, .is-scrollable-right)`).mask, '#828: the side with more to scroll to fades');
assert.ok(PAGE_SCRIPT.includes(`querySelectorAll('${B} table')`), '#828: the page\'s script watches a slide table\'s edges');

console.log('tableSameEverywhere: ok');
