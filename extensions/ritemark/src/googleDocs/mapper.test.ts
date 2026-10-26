import assert from 'node:assert/strict';
import {
  bodyClearRange,
  buildPublishPlan,
  decodeEntities,
  hashableExportHtml,
  htmlToBlocks,
  locatePlaceholders,
  mathNotes,
  placeholderRequests,
  singleTabRequests,
  tableCellRequests,
  type Block,
} from './mapper';
import type { DocsDocument } from './GoogleApiClient';

// HTML shaped the way TipTap's getHTML() writes it: list items wrap their text
// in <p>, task items carry data-checked, images keep their path in `title`.
const TIPTAP_HTML = `
<h1>Course outline</h1>
<p>Plain, <strong>bold</strong>, <em>italic</em>, <code>code</code>, <s>gone</s>, <a href="https://ritemark.app/en/">link</a> &amp; more.</p>
<h3>Week one</h3>
<ul>
  <li><p>First</p></li>
  <li><p>Second with <strong>bold</strong></p>
    <ul><li><p>Nested</p><ul><li><p>Deeper</p></li></ul></li></ul>
  </li>
  <li><p>Third</p></li>
</ul>
<ol><li><p>One</p></li><li><p>Two</p><ol><li><p>Two a</p></li></ol></li></ol>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Open</p></div></li>
</ul>
<blockquote><p>Quoted</p><blockquote><p>Deeper quote</p></blockquote></blockquote>
<pre><code class="language-ts">const a = 1 &lt; 2
return a</code></pre>
<hr>
<table><tbody><tr><th><p>Name</p></th><th><p>Value</p></th></tr><tr><td><p>A</p></td></tr></tbody></table>
<p><img src="https://file+.vscode-resource.vscode-cdn.net/docs/shot.png" title="./shot.png" alt="Screenshot"></p>
<p>After the image.</p>
`;

const blocks = htmlToBlocks(TIPTAP_HTML);
const kinds = blocks.map((b) => b.kind);

// ── Blocks ───────────────────────────────────────────────────────────────────

assert.equal(blocks[0].kind, 'heading');
assert.equal(blocks[0].level, 1);
assert.equal(blocks[0].text, 'Course outline');

const prose = blocks[1];
assert.equal(prose.text, 'Plain, bold, italic, code, gone, link & more.', 'entities decode; &amp; is never published literally');
const runText = (run: { start: number; end: number }) => prose.text.slice(run.start, run.end);
assert.ok(prose.runs.some((r) => r.bold && runText(r) === 'bold'));
assert.ok(prose.runs.some((r) => r.italic && runText(r) === 'italic'));
assert.ok(prose.runs.some((r) => r.code && runText(r) === 'code'));
assert.ok(prose.runs.some((r) => r.strike && runText(r) === 'gone'));
assert.ok(prose.runs.some((r) => r.link === 'https://ritemark.app/en/' && runText(r) === 'link'));

const listItems = blocks.filter((b) => b.kind === 'listItem');
assert.deepEqual(
  listItems.slice(0, 5).map((b) => [b.text, b.level]),
  [['First', 0], ['Second with bold', 0], ['Nested', 1], ['Deeper', 2], ['Third', 0]],
  'nesting depth survives TipTap\'s <li><p> wrapping',
);
assert.deepEqual(listItems.slice(5, 8).map((b) => [b.text, b.level, b.ordered]), [['One', 0, true], ['Two', 0, true], ['Two a', 1, true]]);
const tasks = listItems.filter((b) => b.checkbox && b.checkbox !== 'none');
assert.deepEqual(tasks.map((b) => [b.text, b.checkbox]), [['Done', 'checked'], ['Open', 'unchecked']], 'task state comes from data-checked');

const quotes = blocks.filter((b) => b.kind === 'quote');
assert.deepEqual(quotes.map((b) => [b.text, b.level]), [['Quoted', 1], ['Deeper quote', 2]], 'a nested quote keeps its own depth');

const code = blocks.filter((b) => b.kind === 'code');
assert.deepEqual(code.map((b) => b.text), ['const a = 1 < 2', 'return a'], 'the <code> tag is stripped and entities decoded');
assert.ok(!code.some((b) => b.text.includes('<code')), 'the raw-text <pre> trap does not publish the tag');

assert.ok(kinds.includes('rule'));
const table = blocks.find((b) => b.kind === 'table');
assert.deepEqual(table?.rows, [['Name', 'Value'], ['A', '']], 'short rows are padded to the widest row');

const image = blocks.find((b) => b.kind === 'image');
assert.equal(image?.title, './shot.png', 'TipTap\'s original path travels in title');
assert.equal(kinds[kinds.length - 1], 'paragraph');
assert.equal(blocks[blocks.length - 1].text, 'After the image.');

assert.equal(decodeEntities('a &amp;lt; b'), 'a &lt; b', '&amp; decodes last, so it is never decoded twice');

// ── Plan: the four-pass discipline ─────────────────────────────────────────────

const plan = buildPublishPlan(blocks, { spacing: true });
const [insert, ...rest] = plan.requests as Record<string, any>[];
assert.ok(insert.insertText, 'the first request is the single insert');
assert.equal(insert.insertText.location.index, 1);
assert.equal(insert.insertText.text, plan.text);

// Every range addresses text the insert created.
const maxIndex = 1 + plan.text.length;
for (const request of rest) {
  const range = (Object.values(request)[0] as { range?: { startIndex: number; endIndex: number } }).range;
  if (!range) continue;
  assert.ok(range.startIndex >= 1 && range.endIndex <= maxIndex && range.endIndex > range.startIndex,
    `range ${JSON.stringify(range)} stays inside the inserted text (1..${maxIndex})`);
}

// Tabs appear only in front of list items.
const lines = plan.text.split('\n');
for (const line of lines) {
  if (line.startsWith('\t')) assert.ok(listItems.some((b) => line.endsWith(b.text)), `tabbed line "${line}" is a list item`);
}

// Bullets come last, later lists first, one request per contiguous list.
const bulletIndexes = rest.map((r, i) => (r.createParagraphBullets ? i : -1)).filter((i) => i >= 0);
assert.ok(bulletIndexes.length > 0);
assert.equal(bulletIndexes[0], rest.length - bulletIndexes.length, 'nothing that depends on indices follows the bullets');
const bulletStarts = bulletIndexes.map((i) => rest[i].createParagraphBullets.range.startIndex);
assert.deepEqual(bulletStarts, [...bulletStarts].sort((a, b) => b - a), 'later lists are bulleted first');
assert.equal(bulletIndexes.length, 3, 'unordered, ordered and task lists are three lists, not ten items');
const presets = bulletIndexes.map((i) => rest[i].createParagraphBullets.bulletPreset);
assert.ok(presets.includes('BULLET_CHECKBOX') && presets.includes('NUMBERED_DECIMAL_ALPHA_ROMAN') && presets.includes('BULLET_DISC_CIRCLE_SQUARE'));

// Inline runs are offset past a list item's tabs.
const boldInList = rest.find((r) => r.updateTextStyle?.textStyle?.bold && plan.text.slice(r.updateTextStyle.range.startIndex - 1, r.updateTextStyle.range.endIndex - 1) === 'bold'
  && r.updateTextStyle.range.startIndex > plan.text.indexOf('Second'));
assert.ok(boldInList, 'the bold run inside a list item lands on the word "bold"');

// Border colours are OptionalColor — the shape that failed a whole batch in Phase 0.
const quoteStyle = rest.find((r) => r.updateParagraphStyle?.paragraphStyle?.borderLeft);
assert.deepEqual(Object.keys(quoteStyle.updateParagraphStyle.paragraphStyle.borderLeft.color), ['color']);
assert.ok(quoteStyle.updateParagraphStyle.paragraphStyle.borderLeft.color.color.rgbColor);

assert.equal(plan.placeholders.length, 2, 'one table and one image');
assert.equal(plan.tables.length, 1);
assert.equal(plan.images.length, 1);
for (const { token } of plan.placeholders) assert.ok(plan.text.includes(token));

const noSpacing = buildPublishPlan(blocks, { spacing: false });
assert.ok(!(noSpacing.requests as Record<string, any>[]).some((r) => r.updateParagraphStyle?.fields === 'spaceBelow'),
  'a template governs spacing, so none is added');
assert.deepEqual(buildPublishPlan([], { spacing: true }).requests, [], 'an empty document inserts nothing');

// ── Placeholders, located in a fresh read and replaced last-first ─────────────

const tokenTable = plan.placeholders.find((p) => p.block.kind === 'table')!;
const tokenImage = plan.placeholders.find((p) => p.block.kind === 'image')!;
const docWithTokens: DocsDocument = {
  documentId: 'doc', revisionId: 'r1', title: 't',
  body: {
    content: [
      { endIndex: 1, sectionBreak: {} },
      { startIndex: 1, endIndex: 40, paragraph: { elements: [{ startIndex: 1, endIndex: 40, textRun: { content: `Intro ${tokenTable.token}\n` } }] } },
      { startIndex: 40, endIndex: 90, paragraph: { elements: [{ startIndex: 40, endIndex: 90, textRun: { content: `${tokenImage.token}\n` } }] } },
    ],
  },
};
const located = locatePlaceholders(docWithTokens, plan.placeholders);
assert.equal(located.length, 2);
assert.equal(located.find((l) => l.placeholder === tokenTable)?.at, 1 + 'Intro '.length);

const staged = new Map<Block, string>([[tokenImage.block, 'https://drive.google.com/uc?export=view&id=x']]);
const batch = placeholderRequests(located, staged, new Map());
const first = batch.requests[0] as Record<string, any>;
assert.equal(first.deleteContentRange.range.startIndex, 40, 'the later placeholder is replaced first');
assert.ok((batch.requests as Record<string, any>[]).some((r) => r.insertInlineImage?.uri.startsWith('https://drive.google.com/')));
assert.ok((batch.requests as Record<string, any>[]).some((r) => r.insertTable?.rows === 2 && r.insertTable.columns === 2));
assert.deepEqual(batch.skipped, []);

const unstaged = placeholderRequests(located, new Map(), new Map([[tokenImage.block, 'the image file was not found']]));
assert.equal(unstaged.skipped.length, 1, 'an image without a URI is reported, not silently lost');
assert.equal(unstaged.skipped[0].source, './shot.png');
assert.ok(!(unstaged.requests as Record<string, any>[]).some((r) => r.insertInlineImage));
assert.ok((unstaged.requests as Record<string, any>[]).filter((r) => r.deleteContentRange).length === 2, 'its placeholder text is still removed');

// ── Table cells, last cell first ────────────────────────────────────────────

const docWithTable: DocsDocument = {
  documentId: 'doc', revisionId: 'r2', title: 't',
  body: {
    content: [
      { endIndex: 1, sectionBreak: {} },
      {
        startIndex: 10, endIndex: 30,
        table: { tableRows: [
          { tableCells: [{ content: [{ startIndex: 12 }] }, { content: [{ startIndex: 14 }] }] },
          { tableCells: [{ content: [{ startIndex: 17 }] }, { content: [{ startIndex: 19 }] }] },
        ] },
      },
    ],
  },
};
const cells = tableCellRequests(docWithTable, [[['Name', 'Value'], ['A', '']]]) as Record<string, any>[];
const cellInserts = cells.filter((c) => c.insertText).map((c) => c.insertText.location.index);
assert.deepEqual(cellInserts, [17, 14, 12], 'filled from the last cell backwards; an empty cell is skipped');
assert.ok(cells.some((c) => c.updateTextStyle?.textStyle?.bold), 'the header row is bold');

// ── Clearing a body for Sync or a template copy ───────────────────────────────

assert.deepEqual(bodyClearRange({ ...docWithTokens, body: { content: [{ endIndex: 1 }, { startIndex: 1, endIndex: 2 }] } }), null,
  'an empty document has nothing to clear');
assert.deepEqual(bodyClearRange(docWithTokens), { startIndex: 1, endIndex: 89 }, 'the final newline is never deleted');

// ── Template copies keep one tab ───────────────────────────────────────────
{
  assert.deepEqual(singleTabRequests([], 'Doc'), [], 'no tab data, no requests');
  assert.deepEqual(singleTabRequests([{ tabProperties: { tabId: 't.0', title: 'Doc' } }], 'Doc'), [],
    'a single tab that already has the name is left alone');
  assert.deepEqual(singleTabRequests([{ tabProperties: { tabId: 't.0', title: 'Tab 1' } }], 'Doc'),
    [{ updateDocumentTabProperties: { tabProperties: { tabId: 't.0', title: 'Doc' }, fields: 'title,iconEmoji' } }]);
  assert.deepEqual(singleTabRequests([
    { tabProperties: { tabId: 'a', title: 'I osa' }, childTabs: [{ tabProperties: { tabId: 'a1' } }] },
    { tabProperties: { tabId: 'b' }, childTabs: [{ tabProperties: { tabId: 'b1' } }] },
  ], 'Doc'), [
    { deleteTab: { tabId: 'a1' } },
    { deleteTab: { tabId: 'b' } },
    { updateDocumentTabProperties: { tabProperties: { tabId: 'a', title: 'Doc' }, fields: 'title,iconEmoji' } },
  ], "the first tab's children and every other top-level tab go; a deleted tab takes its own children");
}

// ---------------------------------------------------------------- Sprint 138: equations (R10) and quotes (#408, R11)
{
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const html = `
<p>The mean <span data-math="inline" data-latex="\\bar{x}" data-source="$\\bar{x}$" data-display="false" data-status="ok" data-width="16" data-height="20" data-depth="5"><img data-math-image="" src="${png}" alt="\\bar{x}"></span> rose, and <span data-math="inline" data-latex="\\fracc{a}" data-source="$\\fracc{a}$" data-display="false" data-status="error">$\\fracc{a}$</span> is a typo.</p>
<div data-math="block" data-latex="&#10;E = mc^2&#10;" data-source="$$&#10;E = mc^2&#10;$$" data-display="true" data-status="ok" data-width="80" data-height="24" data-depth="6"><img data-math-image="" src="${png}" alt="E"></div>
<table><tbody><tr><th><p>Symbol</p></th></tr><tr><td><p><span data-math="inline" data-latex="\\mu" data-source="$\\mu$" data-display="false" data-status="ok" data-width="10" data-height="12" data-depth="3"><img data-math-image="" src="${png}" alt="\\mu"></span> the mean</p></td></tr></tbody></table>
<blockquote><p>One</p><p>Two</p><blockquote><p>Nested</p></blockquote><ul><li><p>In a list</p></li></ul></blockquote>
`;
  const mathBlocks = htmlToBlocks(html);
  const [paragraph, display, table] = mathBlocks;

  // An inline equation is a token in its sentence, with its picture at the text's size.
  assert.equal(paragraph.kind, 'paragraph');
  assert.match(paragraph.text, /^The mean \u2063RITEMARK_MATH_0\u2063 rose, and \$\\fracc\{a\}\$ is a typo\.$/);
  assert.equal(paragraph.inlineImages?.length, 1);
  assert.deepEqual(paragraph.inlineImages?.[0].block.math, { source: '$\\bar{x}$', width: 12, height: 15, display: false }, 'px to pt');
  assert.ok(paragraph.runs.some((r) => r.code && paragraph.text.slice(r.start, r.end) === '$\\fracc{a}$'), 'a typo is its source in the code style');
  assert.equal(paragraph.mathTypos, 1);
  assert.equal(mathBlocks.filter((b) => b.kind === 'image').length, 1, 'the inline picture is not lifted out as a block of its own');

  // An equation block is a picture of its own, centred.
  assert.equal(display.kind, 'image');
  assert.equal(display.math?.display, true);
  assert.equal(display.math?.source, '$$\nE = mc^2\n$$');

  // A table cell takes the source; the result says so.
  assert.equal(table.kind, 'table');
  assert.deepEqual(table.rows, [['Symbol'], ['$\\mu$ the mean']]);
  assert.equal(table.mathAsSource, 1);
  assert.deepEqual(mathNotes(mathBlocks), [
    'The equation in a table is published as its source, because Google Docs fills table cells with text.',
    "1 equation couldn't be typeset and shows as its source.",
  ]);

  const mathPlan = buildPublishPlan(mathBlocks, { spacing: false });
  assert.equal(mathPlan.images.length, 2, 'both pictures are staged: the inline one and the block');
  assert.ok(mathPlan.placeholders.some((p) => p.token === '\u2063RITEMARK_MATH_0\u2063'), 'the inline token is located like the others');
  const centred = mathPlan.requests.find((r) => (r as any).updateParagraphStyle?.paragraphStyle?.alignment === 'CENTER') as any;
  assert.ok(centred, 'the equation block\'s line is centred');

  // Placed with its size in points; one Google could not fetch is named by its source.
  const inlineBlock = paragraph.inlineImages![0].block;
  const located = [{ at: 20, endAt: 37, placeholder: paragraph.inlineImages![0] }, { at: 50, endAt: 70, placeholder: { token: 'x', block: display } }];
  const batch = placeholderRequests(located, new Map([[inlineBlock, 'https://example.com/a.png']]), new Map());
  const insert = batch.requests.find((r) => (r as any).insertInlineImage) as any;
  assert.deepEqual(insert.insertInlineImage.objectSize, { width: { magnitude: 12, unit: 'PT' }, height: { magnitude: 15, unit: 'PT' } });
  assert.deepEqual(batch.skipped, [{ source: 'the equation $$\nE = mc^2\n$$', reason: 'could not be read' }]);

  // The unchanged-source check ignores the pictures' bytes and sizes, not the sources.
  const again = html.replace(/iVBORw0KGgo=/g, 'AAAA').replace('data-width="16"', 'data-width="16.4"');
  assert.equal(hashableExportHtml(again), hashableExportHtml(html), 'a re-drawn picture is not a change');
  assert.notEqual(hashableExportHtml(html.replace('$\\bar{x}$', '$\\bar{y}$')), hashableExportHtml(html), 'an edited source is');
  // An equation that could not be drawn this time (no picture, its source as the body) is no change either.
  const undrawn = html.replace(
    /<span data-math="inline" data-latex="\\bar\{x\}"[^>]*>[\s\S]*?<\/span>/,
    '<span data-math="inline" data-latex="\\bar{x}" data-source="$\\bar{x}$" data-display="false" data-status="ok">$\\bar{x}$</span>',
  );
  assert.notEqual(undrawn, html, 'the test replaced the drawn equation');
  assert.equal(hashableExportHtml(undrawn), hashableExportHtml(html), 'drawn or not, the same equation hashes the same');

  // An equation published as its source because it has no picture is counted, as a typo is.
  const [fallback] = htmlToBlocks('<p>Mean <span data-math="inline" data-latex="x" data-source="$x$" data-display="false" data-status="ok">$x$</span> here.</p>');
  assert.equal(fallback.mathTypos, 1, 'a valid equation without a picture is counted');
  assert.deepEqual(mathNotes([fallback]), ["1 equation couldn't be typeset and shows as its source."]);

  // #408: every quote line starts at its indent, the first included; the bar is thin.
  const quotes = mathBlocks.filter((b) => b.kind === 'quote');
  assert.deepEqual(quotes.map((b) => [b.text, b.level]), [['One', 1], ['Two', 1], ['Nested', 2], ['In a list', 1]], 'a list inside a quote is quoted too (its lines, as before)');
  const quoteRequests = buildPublishPlan(quotes, { spacing: false }).requests
    .map((r) => (r as any).updateParagraphStyle)
    .filter((s) => s?.paragraphStyle?.borderLeft);
  assert.equal(quoteRequests.length, 4, 'single, multi-paragraph, nested and a list in a quote');
  for (const style of quoteRequests) {
    const p = style.paragraphStyle;
    assert.deepEqual(p.indentFirstLine, p.indentStart, 'the first line starts at the quote\'s indent');
    assert.equal(p.borderLeft.width.magnitude, 0.5, 'a thin bar');
    assert.equal(p.borderLeft.padding.magnitude, 6);
    assert.equal(style.fields, 'indentStart,indentFirstLine,borderLeft', 'indentFirstLine is in the fields, or Docs ignores it');
  }
  assert.deepEqual(quoteRequests.map((s) => s.paragraphStyle.indentStart.magnitude), [18, 18, 36, 18]);
  const listInQuote = mathBlocks.find((b) => b.text === 'In a list');
  assert.equal(listInQuote?.kind, 'quote', 'a list inside a quote is quoted too');
}

console.log('googleDocs/mapper: all assertions passed');
