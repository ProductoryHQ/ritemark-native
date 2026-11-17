/**
 * Front matter comes back byte for byte (Sprint 137, R5). Run with
 * `npx tsx src/editorSync/frontMatter.test.ts` (part of `test:editor-sync`).
 */
import { strict as assert } from 'node:assert';
import { headWithPlainKeyChanges, joinFrontMatter, splitFrontMatter } from './frontMatter';

/** The properties as the webview sends them back: through postMessage's JSON. */
const viaWebview = (properties: Record<string, unknown>) => JSON.parse(JSON.stringify(properties));

const obsidian = [
  '---',
  '# Exported from the vault',
  'title: "Plan: Q4"',
  'created: 2026-10-20',
  'tags: [client, draft]',
  '---',
  '',
  '# Plan',
  '',
  'The body.',
  '',
].join('\n');

{
  // S24: the body is edited, no property is.
  const split = splitFrontMatter(obsidian);
  assert.equal(split.hasProperties, true);
  assert.ok(split.properties.created instanceof Date, 'gray-matter reads the date as a Date');
  const saved = joinFrontMatter(viaWebview(split.properties), '# Plan\n\nThe body, edited.', obsidian);
  assert.equal(
    saved,
    obsidian.replace('The body.', 'The body, edited.'),
    'the comment, the quoting, the date, the inline list and the blank line after the closing --- stay',
  );
}

{
  // S25: a property changed in the Properties panel is written by gray-matter, as before.
  const split = splitFrontMatter(obsidian);
  const properties = { ...viaWebview(split.properties), title: 'Plan: Q1' };
  const saved = joinFrontMatter(properties, '# Plan\n\nThe body.', obsidian);
  assert.match(saved, /^---\n/);
  assert.match(saved, /title: 'Plan: Q1'/, 'the new title is written');
  assert.ok(saved.endsWith('# Plan\n\nThe body.\n'), 'the body is byte-identical');
}

{
  // No blank line after the front matter (static sites) stays that way.
  const tight = '---\ntitle: Notes\n---\n# Notes\n';
  const split = splitFrontMatter(tight);
  assert.equal(joinFrontMatter(viaWebview(split.properties), '# Notes', tight), tight);
}

{
  // Two blank lines after it stay two.
  const loose = '---\na: 1\n---\n\n\nBody\n';
  assert.equal(joinFrontMatter({ a: 1 }, 'Body', loose), loose);
}

{
  // A CRLF document: the head is compared and kept in the logical (LF) text;
  // the document's own line endings are applied when it is written.
  const crlf = obsidian.replace(/\n/g, '\r\n');
  const split = splitFrontMatter(crlf);
  assert.equal(joinFrontMatter(viaWebview(split.properties), '# Plan\n\nThe body.', crlf), obsidian);
}

{
  // Without front matter: the body and one trailing newline, as since #254.
  assert.equal(joinFrontMatter({}, 'Just text', 'Just text\n'), 'Just text\n');
  assert.equal(joinFrontMatter(undefined, 'Just text'), 'Just text\n');
  // Properties added to a document that had none are written by gray-matter.
  assert.match(joinFrontMatter({ title: 'New' }, 'Body', 'Body\n'), /^---\ntitle: New\n---\nBody\n$/);
}

{
  // An empty body under front matter.
  const headOnly = '---\na: 1\n---\n';
  assert.equal(joinFrontMatter({ a: 1 }, '', headOnly), headOnly);
}

// 16 November: a plain one-word key added or taken out (a deck's `handout: text`) changes only its own line; the
// comments, quoting and date forms of the rest stay byte for byte, and taking it out again gives back the same bytes.
{
  const deck = '---\n# client deck\ndeck: 1\ntheme: "Slide library/Themes/Evening.theme.md"\ndate: 2026-10-20\n---\n\nThe body.\n';
  const properties = JSON.parse(JSON.stringify(splitFrontMatter(deck).properties));
  const marked = joinFrontMatter({ ...properties, handout: 'text' }, 'The body, edited.', deck);
  assert.equal(marked, '---\n# client deck\ndeck: 1\ntheme: "Slide library/Themes/Evening.theme.md"\ndate: 2026-10-20\nhandout: text\n---\n\nThe body, edited.\n');
  assert.equal(joinFrontMatter(properties, 'The body.', marked), deck, 'taken out again: the bytes as they were');
  // Sprint 161 (PR 2): a deck's first edit writes `deck: 2` with `handout: text`, and one Undo takes both back: only
  // their own lines change, the blank line after the front matter stays, and the undo gives back the same bytes.
  const converted = joinFrontMatter({ ...properties, deck: 2, handout: 'text' }, 'The body, edited.', deck);
  assert.equal(converted, '---\n# client deck\ndeck: 2\ntheme: "Slide library/Themes/Evening.theme.md"\ndate: 2026-10-20\nhandout: text\n---\n\nThe body, edited.\n');
  assert.equal(joinFrontMatter(properties, 'The body.', converted), deck, 'undone: the bytes as they were');
  assert.equal(headWithPlainKeyChanges('---\na: 1\n---\n', { a: 1 }, { a: 2 }), '---\na: 2\n---\n', 'a whole number changed in place');
  // Anything else is gray-matter's, as before: a value that isn't one word or a whole number, a quoted or commented line.
  assert.equal(headWithPlainKeyChanges('---\na: 1.5\n---\n', { a: 1.5 }, { a: 2 }), null);
  assert.equal(headWithPlainKeyChanges('---\na: "1"\n---\n', { a: '1' }, { a: 2 }), null);
  assert.equal(headWithPlainKeyChanges('---\na: 1 # one\n---\n', { a: 1 }, { a: 2 }), null);
  assert.equal(headWithPlainKeyChanges('---\na: 1\n---\n', { a: 1 }, { a: 1, b: 'two words' }), null);
  assert.equal(headWithPlainKeyChanges('---\na: 1\n---\n', { a: 1 }, { a: 1 }), null);
  assert.equal(headWithPlainKeyChanges('---\nlook: borderless\n---\n', { look: 'borderless' }, {}), '---\n---\n');
}

// Sprint 162: picking a deck's theme changes only its `theme:` line, in the quotes it has, and one Undo gives back the
// same bytes; a deck with no line gets one at the end, and the Undo takes it out again.
{
  const quoted = '---\n# client deck\ndeck: 1\ntheme: "Slide library/Themes/Evening.theme.md"\nlook: borderless\n---\n\nThe body.\n';
  const properties = JSON.parse(JSON.stringify(splitFrontMatter(quoted).properties));
  const picked = joinFrontMatter({ ...properties, theme: 'Slide library/Themes/Fern Hollow (2).theme.md' }, 'The body.', quoted);
  assert.equal(picked, '---\n# client deck\ndeck: 1\ntheme: "Slide library/Themes/Fern Hollow (2).theme.md"\nlook: borderless\n---\n\nThe body.\n');
  assert.equal(joinFrontMatter(properties, 'The body.', picked), quoted, 'undone: the bytes as they were');

  const plain = '---\ndeck: 2\ntheme: Slide library/Themes/Evening.theme.md\n---\n\nThe body.\n';
  const plainProperties = JSON.parse(JSON.stringify(splitFrontMatter(plain).properties));
  const evening = joinFrontMatter({ ...plainProperties, theme: 'Slide library/Themes/Õhtu.theme.md' }, 'The body.', plain);
  assert.equal(evening, '---\ndeck: 2\ntheme: Slide library/Themes/Õhtu.theme.md\n---\n\nThe body.\n');
  assert.equal(joinFrontMatter(plainProperties, 'The body.', evening), plain);

  const none = '---\ndeck: 1\n---\n\nThe body.\n';
  const added = joinFrontMatter({ deck: 1, theme: 'Slide library/Themes/Paper.theme.md' }, 'The body.', none);
  assert.equal(added, '---\ndeck: 1\ntheme: Slide library/Themes/Paper.theme.md\n---\n\nThe body.\n');
  assert.equal(joinFrontMatter({ deck: 1 }, 'The body.', added), none);

  // A path YAML would read differently (a colon, a hash) is gray-matter's to write, never a line written as it is.
  assert.equal(headWithPlainKeyChanges('---\ntheme: a.theme.md\n---\n', { theme: 'a.theme.md' }, { theme: 'Slide library/Themes/a: b.theme.md' }), null);
  assert.equal(headWithPlainKeyChanges('---\ntheme: a.theme.md\n---\n', { theme: 'a.theme.md' }, { theme: 'x #y.theme.md' }), null);
  // Names with other characters a theme file can have are written on their line too, and read back the same.
  for (const name of ['Black & Gold', "Client's", 'Q1, 2026', 'Brand.Theme']) {
    const theme = `Slide library/Themes/${name}.theme.md`;
    const picked = joinFrontMatter({ ...plainProperties, theme }, 'The body.', plain);
    assert.equal(picked, `---\ndeck: 2\ntheme: ${theme}\n---\n\nThe body.\n`, name);
    assert.equal(splitFrontMatter(picked).properties.theme, theme, name);
    assert.equal(joinFrontMatter(plainProperties, 'The body.', picked), plain, name);
  }
  // A single quote inside a single-quoted line would read back differently: gray-matter's to write.
  assert.equal(headWithPlainKeyChanges("---\ntheme: 'a.theme.md'\n---\n", { theme: 'a.theme.md' }, { theme: "Client's.theme.md" }), null);
  // Only theme paths keep quotes: another quoted value is still gray-matter's.
  assert.equal(headWithPlainKeyChanges('---\na: "one"\n---\n', { a: 'one' }, { a: 'two' }), null);
}

console.log('frontMatter.test.ts — all assertions passed');
