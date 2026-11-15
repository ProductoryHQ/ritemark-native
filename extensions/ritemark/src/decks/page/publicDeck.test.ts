/**
 * Sprint 159 (technical plan §6): what of a deck goes public. A distinct test word sits in every private place
 * (`testing/privateDeck.ts`), and none may reach `publicDeck`'s output.
 *
 * Run: npx tsx src/decks/page/publicDeck.test.ts
 */
import { strict as assert } from 'node:assert';
import { BUILT_IN_THEME, parseTheme } from '../deckTheme';
import { deckDigest, drawnData, publicDeck, publicMarkdown, type PublicDeck } from './publicDeck';
import { PRIVATE_DECK, PRIVATE_WORDS, PUBLIC_WORDS } from './testing/privateDeck';

const options = { folderName: 'Harbour Logistics', deckName: 'AI assistants and agents', theme: BUILT_IN_THEME };
const deck = publicDeck(PRIVATE_DECK, options);
const json = JSON.stringify(deck);

// Nothing private goes: every test word, in every private place, is missing from what the page is made from.
for (const [place, word] of Object.entries(PRIVATE_WORDS)) {
  assert.ok(!json.toLowerCase().includes(word.toLowerCase()), `${place}: "${word}" must not go public`);
}
// Everything public goes.
for (const word of PUBLIC_WORDS) assert.ok(json.includes(word), `"${word}" goes public`);

// The slides: the skipped one is gone, the rest are in their order, renumbered as the page counts them.
assert.deepEqual(deck.slides.map(slide => slide.kind), ['title', 'section', 'exercise', 'columns', 'boxes']);
assert.equal(deck.title, 'Harbour title', 'the title slide\'s title is the page\'s title');
assert.equal(deck.client, 'Harbour Logistics', 'the deck\'s folder is the client line');
assert.equal(deck.look, 'borderless', 'the look holds, from the front matter (whose lines never go)');
assert.equal(deck.theme, BUILT_IN_THEME);

// Only what each layout draws: no id, from or kept line, no items a Title slide keeps for other layouts, no third
// column, no Exercise step's line, no icon under a Line look.
const [title, section, exercise, columns, boxes] = deck.slides;
assert.deepEqual(title.data, { title: 'Harbour title', subtitle: 'Harbour Logistics · 3 hours' });
assert.deepEqual(section.data, { title: 'Why agents?', number: '1' });
assert.deepEqual(exercise.data, { title: 'Build an assistant for one task', items: [{ heading: 'Choose a task' }, { heading: 'Write it down' }] });
assert.deepEqual(columns.data.items, [{ heading: 'Left column', text: 'Answers when you ask' }, { heading: 'Right column', text: 'Works on a goal' }]);
assert.deepEqual(boxes.data, { title: 'Read the room', look: 'line', items: [{ heading: 'When', text: 'Every Monday' }] });

// The handout: the words an anchored comment sat on stay; the comment, its id and the standalone note go; a stray
// notes fence goes; an ordinary prompt stays, a comment written inside one stays as its words.
assert.match(title.handout, /Here are the words the comment sat on, kept\./);
assert.ok(!title.handout.includes('mark'), 'the <mark> tags go');
assert.ok(boxes.handout.includes('<!-- a prompt that shows a comment stays as written -->'), 'a prompt is the prompt');
assert.ok(exercise.handout.includes('```\nYou are an assistant'), 'the prompt stays a fence');

// The text before the first slide goes out, because the deck view shows it at the top of the handout (the page shows
// what the handout shows, minus what's private): its words go, its comment doesn't.
assert.equal(deck.preamble, 'Before the first slide: PREAMBLEPUBLIC, for everyone.');
assert.equal(publicDeck('```slide title\ntitle: T\n```\n', options).preamble, '', 'no preamble, none on the page');
assert.equal(publicDeck('---\ndeck: 1\n---\n\n<!-- only a note -->\n\n```slide title\ntitle: T\n```\n', options).preamble, '', 'a preamble that is only private is none');

// A file saved with a byte-order mark keeps its front matter private and its look; a front matter never closed sends
// nothing before the first slide (fail closed).
{
  const bom = publicDeck('﻿---\ndeck: 1\ntheme: Slide library/Themes/SECRETTHEME.theme.md\nlook: borderless\n---\n\n```slide title\ntitle: T\n```\n', options);
  assert.equal(bom.preamble, '');
  assert.equal(bom.look, 'borderless');
  assert.ok(!JSON.stringify(bom).includes('SECRETTHEME'));
  const unclosed = publicDeck('---\ndeck: 1\ntheme: Slide library/Themes/SECRETTHEME.theme.md\n\n```slide title\ntitle: T\n```\n', options);
  assert.equal(unclosed.preamble, '');
  assert.equal(unclosed.slides.length, 1);
  // An empty front matter (--- twice) is closed: the text after it goes (round 2).
  assert.equal(publicDeck('---\n---\nHello public intro\n\n```slide points\ntitle: P\n```\n', options).preamble, 'Hello public intro');
}

// A deck with no title slide shown takes its name; a skipped title slide's title stays private.
assert.equal(publicDeck('```slide points\ntitle: Agenda\n```\n', options).title, 'AI assistants and agents');
assert.equal(publicDeck('```slide title\ntitle: Secret\nskip: true\n```\n\n```slide points\ntitle: Agenda\n```\n', options).title, 'AI assistants and agents');

// A kind this build doesn't know draws its title alone, and its other words stay.
{
  const other = publicDeck('```slide gamma.v2\ntitle: From Gamma\nsubtitle: GAMMAWORD\n```\n', options).slides[0];
  assert.equal(other.kind, 'other');
  assert.deepEqual(other.data, { title: 'From Gamma' });
}

// A picture beside the words goes with its path; a picture setting of none keeps the path private.
assert.deepEqual(drawnData('points', { title: 'P', picture: 'right', image: 'images/a.png', items: [{ heading: 'x', icon: 'wrench' }] }),
  { title: 'P', picture: 'right', image: 'images/a.png', items: [{ heading: 'x' }] });
assert.deepEqual(drawnData('points', { title: 'P', picture: 'none', image: 'images/PRIVATEPATH.png' }), { title: 'P' });
assert.deepEqual(drawnData('picture', { title: 'P', image: 'images/a.png', subtitle: 'cap', items: [{ heading: 'hidden' }] }), { title: 'P', image: 'images/a.png', subtitle: 'cap' });
assert.deepEqual(drawnData('table', { title: 'T', rows: [['a', 'b']], items: [{ heading: 'hidden' }] }), { title: 'T', rows: [['a', 'b']] });
// A box's icon goes wherever the layout draws it: every look but Steps, Line and Arrows (one it doesn't know draws boxes).
for (const look of ['steps', 'line', 'arrows']) assert.deepEqual(drawnData('boxes', { look, items: [{ heading: 'h', icon: 'wrench' }] }).items, [{ heading: 'h' }], look);
for (const look of [undefined, 'boxes', 'Steps', 'cards']) assert.deepEqual(drawnData('boxes', { look, items: [{ heading: 'h', icon: 'wrench' }] }).items, [{ heading: 'h', icon: 'wrench' }], String(look));

// publicMarkdown, case by case.
assert.equal(publicMarkdown('a\n\n```notes\nsecret\n```\n\nb'), 'a\n\nb');
assert.equal(publicMarkdown('a\n\n~~~ Notes\nsecret\n~~~\n\nb'), 'a\n\nb', 'tildes and any case');
assert.equal(publicMarkdown('a\n\n````notes\n```\nsecret\n```\n````\n\nb'), 'a\n\nb', 'a longer fence holding a shorter one');
assert.equal(publicMarkdown('a\n\n```notes\nsecret, never closed'), 'a', 'an unclosed notes fence runs to the end');
assert.equal(publicMarkdown('a <!-- secret --> b'), 'a  b');
assert.equal(publicMarkdown('a <!-- secret, never closed\n\nb'), 'a', 'an unclosed comment runs to the end (fails closed)');
assert.equal(publicMarkdown('A <mark data-comment="a > b secret" data-comment-id="x">word</mark> here'), 'A word here', 'a quoted > in the note');
assert.equal(publicMarkdown("A <mark data-comment='secret'>word</mark>"), 'A word');
assert.equal(publicMarkdown('Code `<!-- kept -->` and `<mark>kept</mark>`'), 'Code `<!-- kept -->` and `<mark>kept</mark>`', 'code spans are the prompt\'s words');
assert.equal(publicMarkdown('``a ` <!-- kept --> b``'), '``a ` <!-- kept --> b``');
assert.equal(publicMarkdown('<markdown> is a word'), '<markdown> is a word', 'only the mark tag');
assert.equal(publicMarkdown('a\r\n\r\n<!-- x -->\r\n\r\nb'), 'a\n\nb', 'Windows line ends');
assert.equal(publicMarkdown('```\nline\n\n\n\nafter blank lines\n```'), '```\nline\n\n\n\nafter blank lines\n```', 'a prompt keeps its blank lines');
assert.equal(publicMarkdown('a\n\n<!-- one -->\n\nb'), publicMarkdown('a\n\nb'), 'taking a comment out reads as before the comment');
// Where the scanner and Markdown could differ, it fails closed: a code span closes on its own line only, so a notes
// fence right after an unclosed backtick is still a fence; an indented code block is text here (the editor writes
// fences), so a comment in one goes.
assert.equal(publicMarkdown('Run `npm\n```notes\nsecret notes `\n```\n\nafter'), 'Run `npm\n\nafter');
assert.equal(publicMarkdown('Run `npm\nmore` and <!-- secret -->'), 'Run `npm\nmore` and');
assert.equal(publicMarkdown('Prompt:\n\n    write <!-- gone --> here'), 'Prompt:\n\n    write  here');

// The digest: a public edit changes it; notes, a comment, a skipped slide, an id or from line, and the fit don't.
{
  const base = '```slide title\nid: t1\ntitle: Title\n```\n\n```notes\nNotes\n```\n\nHandout.\n\n```slide points\nid: s2\ntitle: Skipped\nskip: true\n```\n\nSkipped handout.\n';
  const digest = (text: string, extra: Partial<typeof options> & { steps?: number[] } = {}) => deckDigest(publicDeck(text, { ...options, ...extra }));
  const same = digest(base);
  assert.equal(digest(base), same, 'the same deck, the same digest');
  assert.equal(digest(base.replace('Notes', 'Other notes')), same, 'notes');
  assert.equal(digest(base.replace('Skipped handout.', 'Changed skipped handout.')), same, "a skipped slide's handout");
  assert.equal(digest(base.replace('title: Skipped', 'title: Changed while skipped')), same, "a skipped slide's words");
  assert.equal(digest(base.replace('Handout.', 'Handout.\n\n<!-- a comment -->')), same, 'a comment');
  assert.equal(digest(base.replace('id: t1', 'id: t9')), same, 'an id');
  assert.equal(digest(base.replace('id: t1\n', 'id: t1\nfrom: Slide library/A.deck.md#a1 @abc\n')), same, 'a from line');
  assert.equal(digest(base, { steps: [2, 0] }), same, 'the fit is a measurement, not the deck');
  assert.notEqual(digest(base.replace('Handout.', 'Handout, changed.')), same, 'the handout');
  assert.notEqual(digest(base.replace('title: Title', 'title: Another')), same, 'a slide\'s words');
  assert.notEqual(digest(base.replace('skip: true\n', '')), same, 'a slide shown again');
  assert.notEqual(digest(`---\nlook: borderless\n---\n${base}`), same, 'the look');
  assert.notEqual(digest(base, { theme: parseTheme('---\naccent: "#2255AA"\n---\n') }), same, 'the theme');
  assert.notEqual(digest(base, { folderName: 'Another client' }), same, 'the client line');
}

// The fit steps the open view measured, by the slide's place in the deck (skipped slides counted), kept within 0–3.
{
  const text = '```slide title\ntitle: A\n```\n\n```slide points\ntitle: B\nskip: true\n```\n\n```slide points\ntitle: C\n```\n';
  const fitted: PublicDeck = publicDeck(text, { ...options, steps: [1, 3, 9] });
  assert.deepEqual(fitted.slides.map(slide => slide.step), [1, 3]);
  assert.deepEqual(publicDeck(text, { ...options, steps: [-2, 0, Number.NaN] }).slides.map(slide => slide.step), [0, 0]);
}

console.log('publicDeck: passed');
