/**
 * Sprint 161 (PR 2): converting today's slides to block slides as text, the host's half (the library's writes,
 * `insert_slides`), and the helpers the deck view uses. Run with `npx tsx src/decks/blocks/convertDeck.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseDeck, parseFrom, slideDataOf, withBlockMarkdown, writeFrom, writeSlideData } from '../deckFormat';
import { slideStamp, slideStamps } from '../deckLibraryFormat';
import { BUILT_IN_THEME } from '../deckTheme';
import { pageHtml } from '../page/pageHtml';
import { deckDigest, publicDeck } from '../page/publicDeck';
import { blockDataOf, blockSlideBody, convertDeckText, convertedPart, convertSlide, renewedFrom, withCommentAtEnd, withDeckVersion, withStepsTag } from './convertDeck';
import { blockSectionNumberOf, blockStepsTagOf } from './slideRenderer';

// ---- deck: 2 in the front matter: replaced, added first, or a front matter made; every other byte stays.
assert.equal(withDeckVersion('---\ndeck: 1\ntheme: T\n---\n\nText\n', 2), '---\ndeck: 2\ntheme: T\n---\n\nText\n');
assert.equal(withDeckVersion('---\ntheme: T\n---\n\nText\n', 2), '---\ndeck: 2\ntheme: T\n---\n\nText\n');
assert.equal(withDeckVersion('Text\n', 2), '---\ndeck: 2\n---\n\nText\n');
assert.equal(withDeckVersion('---\n---\nText\n', 2), '---\ndeck: 2\n---\nText\n', 'an empty front matter');
assert.equal(withDeckVersion('﻿---\r\ndeck: 1\r\n---\r\nText', 2), '﻿---\r\ndeck: 2\r\n---\r\nText', 'a byte-order mark and CRLF');
const two = '---\ndeck: 2\n---\n\nText\n';
assert.equal(withDeckVersion(two, 2), two, 'already there: the same text');

// ---- A block slide's body: its header only when it has keys; an empty slide ends at its header.
assert.equal(blockSlideBody({}, '# T'), '# T');
assert.equal(blockSlideBody({ id: 'a1', skip: true }, '# T'), '---\nid: a1\nskip: true\n---\n# T');
assert.equal(blockSlideBody({ id: 'a1' }, ''), '---\nid: a1\n---');
assert.equal(withBlockMarkdown('---\nid: a1\n---', '# New'), '---\nid: a1\n---\n# New', 'words after a header that had none');
assert.equal(withBlockMarkdown('---\nid: a1\n---\n# Old', '# New'), '---\nid: a1\n---\n# New');
assert.equal(withBlockMarkdown('---\nid: a1\n---\n# Old', ''), '---\nid: a1\n---');
assert.equal(withBlockMarkdown('# Old', '# New'), '# New');

// ---- The comment goes at the end of the part, before the blank lines that end it.
assert.equal(withCommentAtEnd('\n\n## H\n\nWords.\n\n', '<!-- c -->'), '\n\n## H\n\nWords.\n\n<!-- c -->\n\n');
assert.equal(withCommentAtEnd('\n\n', '<!-- c -->'), '\n\n<!-- c -->\n\n', 'an empty part');
assert.equal(withCommentAtEnd('', '<!-- c -->'), '<!-- c -->', "a copy's empty handout");
assert.equal(withCommentAtEnd('Words.', '<!-- c -->'), 'Words.\n\n<!-- c -->');
assert.equal(withCommentAtEnd('Words.\n', null), 'Words.\n');

// ---- A whole deck: every v1 slide of the nine kinds as a block slide, its notes and hidden words one comment at the
// end of its part (`-->` made harmless), a kind this build doesn't know as written, deck: 2. Nothing private reaches
// the page from the converted deck.
const DECK = [
  '---', 'deck: 1', '---', '',
  '```slide section', 'id: s1', 'number: "1"', 'title: Why agents?', 'subtitle: SECTIONSUBTITLE', '```', '',
  '```notes', 'NOTESWORD --> still notes', '```', '',
  '## Why agents?', '', 'Section text.', '',
  '```slide exercise', 'id: e2', 'title: Try it', 'tag: Harjutus', 'items:', '- heading: 1. Open', '  text: STEPLINEWORD', '- heading: 2. Ask', '```', '',
  'Do it.', '',
  '```slide gamma.v2', 'title: Elsewhere', '```', '',
  '```notes', 'UNKNOWNNOTES', '```', '',
].join('\n');
const converted = convertDeckText(DECK);
assert.equal(converted, [
  '---', 'deck: 2', '---', '',
  '```slide', '---', 'id: s1', '---', '1', '', '# Why agents?', '```', '',
  '## Why agents?', '', 'Section text.', '',
  '<!-- NOTESWORD --› still notes', 'Hidden by the old layout: SECTIONSUBTITLE -->', '',
  '```slide', '---', 'id: e2', '---', '# Try it', '', '::: {.steps tag="Harjutus"}', '1. Open', '2. Ask', ':::', '```', '',
  'Do it.', '',
  '<!-- Hidden by the old layout: step 1: STEPLINEWORD -->', '',
  '```slide gamma.v2', 'title: Elsewhere', '```', '',
  '```notes', 'UNKNOWNNOTES', '```', '',
].join('\n'), converted);
assert.equal(convertDeckText(converted), converted, 'converting again changes nothing');
{
  const deck = publicDeck(converted, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null });
  for (const word of ['NOTESWORD', 'SECTIONSUBTITLE', 'STEPLINEWORD', 'UNKNOWNNOTES']) {
    assert.ok(!html.includes(word) && !JSON.stringify(deck).includes(word), `${word} reached the page`);
  }
  // A converted Section slide is still a section on the page: a divider with its number.
  assert.ok(html.includes('<section class="part sect"') && html.includes('Section 1'), 'the section band stays');
  assert.equal(blockSectionNumberOf('1\n\n# Why agents?'), '1');
  assert.equal(blockSectionNumberOf('# Title\n\nA line'), null);
  assert.equal(blockSectionNumberOf('A long first line, not a number\n\n# Title'), null);
  // The same page before and after the conversion: what the person saw is what is written (decision 8).
  const before = publicDeck(DECK, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  assert.deepEqual(deck.slides.map(slide => slide.data), before.slides.map(slide => slide.data));
}

// ---- A copy's stamp: renewed to the block stamp when it still matches (an older v1 stamp), kept when it was changed.
{
  const data = { id: 'c1', title: 'Four parts', items: [{ heading: 'One' }] };
  const handout = 'Read this.';
  const oldStamp = slideStamps('boxes', data, handout, 'Clients')[1];
  const fresh = slideStamp('boxes', data, handout, 'Clients');
  assert.notEqual(oldStamp, fresh, 'precondition: a v1 stamp written before Sprint 161');
  const from = writeFrom({ path: 'Slide library/A.deck.md', id: 'a1', stamp: oldStamp });
  assert.equal(parseFrom(renewedFrom('boxes', { ...data, from }, handout, 'Clients'))?.stamp, fresh, 'renewed');
  const changedFrom = writeFrom({ path: 'Slide library/A.deck.md', id: 'a1', stamp: 'zzzzzz' });
  assert.equal(renewedFrom('boxes', { ...data, from: changedFrom }, handout, 'Clients'), changedFrom, 'a changed copy keeps its stamp');
  // The converted slide's stamp is the stamp it got: the copy is still its source's.
  const body = writeSlideData('boxes', 'id: c1\ntitle: Four parts\nitems:\n- heading: One', { ...data, from });
  const slide = convertSlide('boxes', body, null, handout, 'Clients');
  const after = slideDataOf('', slide.body);
  assert.equal(parseFrom(after.from)?.stamp, fresh);
  assert.ok(slideStamps('', after, handout, 'Clients').includes(fresh));
}

// ---- A part the host writes, and what the deck view draws: the same blocks.
{
  const part = convertedPart({ kind: 'columns', body: 'id: x\ntitle: T\nitems:\n- heading: A\n- heading: B\n- heading: C', handout: 'Words.' });
  assert.equal(part.kind, '');
  assert.equal(part.handout, 'Words.\n\n<!-- Hidden by the old layout: C -->');
  const drawn = blockDataOf('columns', slideDataOf('columns', 'id: x\ntitle: T\nitems:\n- heading: A\n- heading: B\n- heading: C'));
  assert.equal(drawn.markdown, slideDataOf('', part.body).markdown);
  assert.equal(drawn.title, 'T');
  assert.ok(!(drawn.markdown ?? '').includes('C\n'), 'a hidden word is never drawn');
  const kept = { kind: 'gamma.v2', body: 'title: x', handout: '' };
  assert.equal(convertedPart(kept), kept, 'a kind this build doesn\'t know stays');
}

// ---- Settings' Label row on a block slide: the first Steps block's pill, its colons kept, nothing else touched.
{
  const markdown = '# Try\n\n```\n::: steps\n```\n\n:::: {.steps look="x"}\n1. A\n::::\n\n::: steps\n1. B\n:::';
  const tagged = withStepsTag(markdown, 'Harjutus');
  assert.equal(tagged, markdown.replace(':::: {.steps look="x"}', ':::: {.steps tag="Harjutus" look="x"}'), 'a ::: line in code is no block');
  assert.equal(blockStepsTagOf(tagged), 'Harjutus');
  assert.equal(blockStepsTagOf(withStepsTag(tagged, '')), '', 'emptied: no pill');
  assert.equal(withStepsTag(tagged, 'Harjutus'), tagged, 'the same words: the same text');
  assert.equal(withStepsTag('::: steps\n1. A\n:::', 'Say "hi"'), "::: {.steps tag='Say \"hi\"'}\n1. A\n:::");
  assert.equal(withStepsTag('# No steps', 'X'), '# No steps');
}

// ---- parseDeck still reads every part of the converted deck.
assert.deepEqual(parseDeck(converted).slides.map(slide => slide.kind), ['', '', 'gamma.v2']);

console.log('convertDeck: passed');
