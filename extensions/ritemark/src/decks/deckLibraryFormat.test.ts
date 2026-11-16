/**
 * Sprint 157: copying slides between decks and the library. Run with `npx tsx src/decks/deckLibraryFormat.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseDeck, parseSlideBody } from './deckFormat';
import {
  appendPart, folderOf, newTopicText, normalizePath, partText, projectPath, rebasePath, rebaseSlide,
  foldMarkdown, insertPartsText, replaceSlidePart, rewriteMarkdownTargets, slideStamp, slidesOfText,
} from './deckLibraryFormat';

// Paths.
assert.equal(normalizePath('a/./b/../c.png'), 'a/c.png');
assert.equal(normalizePath('../x'), null);
assert.equal(folderOf('Slide library/AI.deck.md'), 'Slide library');
assert.equal(folderOf('Top.deck.md'), '');
assert.equal(rebasePath('images/a.png', 'Slide library', 'Clients/Harbour'), '../../Slide library/images/a.png');
assert.equal(rebasePath('../images/a.png', 'Clients/Harbour', 'Clients/Kestrel'), '../images/a.png');
assert.equal(rebasePath('images/a.png', 'Clients', 'Clients'), 'images/a.png');
assert.equal(rebasePath('https://x.org/a.png', 'a', 'b'), 'https://x.org/a.png');
assert.equal(rebasePath('#part', 'a', 'b'), '#part');
assert.equal(rebasePath('my%20pic.png#x', 'a', 'b'), '../a/my%20pic.png#x');
assert.equal(projectPath('images/a.png', 'Slide library'), 'Slide library/images/a.png');
assert.equal(projectPath('https://x.org', 'a'), null);
assert.equal(
  rewriteMarkdownTargets('See ![x](img/a.png "t") and [doc](<My Doc.md>) and [web](https://x.org).', target => `R(${target})`),
  'See ![x](R(img/a.png) "t") and [doc](<R(My Doc.md)>) and [web](R(https://x.org)).',
);

// A copy's paths are rebased into the target deck's folder: the picture and the handout's links.
{
  const rebased = rebaseSlide('id: a1\ntitle: T\nimage: images/agent.png', 'Use ![shot](images/s.png) and [the brief](Brief.md).', 'Slide library', 'Clients/Harbour');
  assert.equal(rebased.body, 'id: a1\ntitle: T\nimage: ../../Slide library/images/agent.png');
  assert.equal(rebased.handout, 'Use ![shot](<../../Slide library/images/s.png>) and [the brief](<../../Slide library/Brief.md>).');
  // Sprint 159 (PR 2, Codex): a path that needs quoting stays one path, quoted, and every other line as written
  const quoted = rebaseSlide('id: a1\ntitle: T\nimage: "images/foo #1.png"\nlook: steps', '', 'Slide library', 'Clients/Harbour');
  assert.equal(parseSlideBody(quoted.body).image, '../../Slide library/images/foo #1.png');
  assert.equal(quoted.body, 'id: a1\ntitle: T\nimage: "../../Slide library/images/foo #1.png"\nlook: steps');
}

// The stamp: what a person sees, paths resolved, whitespace folded; not id, from, kept, skip or notes.
{
  const data = { id: 'a1', title: 'Four parts', items: [{ heading: 'One', text: 'a' }], image: 'images/a.png' };
  const base = slideStamp('boxes', data, 'Text with ![x](images/s.png).', 'Slide library');
  assert.match(base, /^[0-9a-z]{6}$/);
  assert.equal(slideStamp('boxes', { ...data, id: 'zz99', from: 'x#y @z', kept: true, skip: true }, 'Text with ![x](images/s.png).', 'Slide library'), base);
  assert.equal(slideStamp('boxes', { ...data, image: '../../Slide library/images/a.png' }, rebaseSlide('', 'Text   with\n![x](images/s.png).', 'Slide library', 'Clients/Harbour').handout, 'Clients/Harbour'), base, 'a rebased copy is not changed');
  assert.notEqual(slideStamp('points', data, 'Text with ![x](images/s.png).', 'Slide library'), base, 'kind');
  assert.notEqual(slideStamp('boxes', { ...data, title: 'Five parts' }, 'Text with ![x](images/s.png).', 'Slide library'), base, 'words');
  assert.notEqual(slideStamp('boxes', data, 'Other text.', 'Slide library'), base, 'handout (answer 2)');
  // The same handout as the editor writes it back is the same copy.
  assert.equal(foldMarkdown('* One\n+ Two\n\n1) Three\n\n__Bold__ and *it*\\!\n\nTitle\n====='), foldMarkdown('- One\n- Two\n\n1. Three\n\n**Bold** and _it_!\n\n## Title ##'));
  assert.notEqual(foldMarkdown('- One'), foldMarkdown('- Two'));
  assert.notEqual(foldMarkdown('See report_2025.xlsx'), foldMarkdown('See report2025.xlsx'), 'a `_` inside a word is a character');
  assert.equal(foldMarkdown('A **bold** _word_, and *this*.'), foldMarkdown('A bold word, and this.'));
}

// One slide of a deck by id: replaced with every other byte kept; appended; a new topic.
{
  const deck = '---\ndeck: 1\n---\n\n```slide title\nid: t1\ntitle: A\n```\n\nIntro.\n\n```slide points\nid: p1\ntitle: B\n```\n\n```notes\nN\n```\n\nText b.\n\n```slide statement\nid: s1\ntitle: C\n```\n\nText c.\n';
  const part = partText('points', 'id: p1\ntitle: B2', 'Text b2.');
  const replaced = replaceSlidePart(deck, 'p1', part)!;
  assert.equal(replaced, deck.replace('```slide points\nid: p1\ntitle: B\n```\n\n```notes\nN\n```\n\nText b.', '```slide points\nid: p1\ntitle: B2\n```\n\nText b2.'));
  const last = replaceSlidePart(deck, 's1', partText('statement', 'id: s1\ntitle: C2', ''))!;
  assert.ok(last.endsWith('```slide statement\nid: s1\ntitle: C2\n```\n'));
  assert.equal(replaceSlidePart(deck, 'nope', part), null);
  const appended = appendPart(deck, partText('boxes', 'id: b1', 'New.'));
  assert.ok(appended.endsWith('Text c.\n\n```slide boxes\nid: b1\n```\n\nNew.\n'));
  assert.deepEqual(parseDeck(appended).slides.map(slide => slide.kind), ['title', 'points', 'statement', 'boxes']);
  assert.equal(newTopicText('Slide library/Themes/Evening.theme.md', part), `---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\n---\n\n${part}\n`);
  const slides = slidesOfText(deck);
  assert.deepEqual(slides.map(slide => [slide.data.id, slide.handout, slide.notes]), [['t1', 'Intro.', null], ['p1', 'Text b.', 'N'], ['s1', 'Text c.', null]]);
}

// Parts put in after slide N; every other byte kept.
{
  const text = '---\ndeck: 1\n---\n\n```slide title\nid: a\n```\n\nOne.\n\n```slide title\nid: b\n```\n\nTwo.\n';
  const part = '```slide points\nid: n\n```\n\nNew.';
  assert.deepEqual(slidesOfText(insertPartsText(text, 1, [part])).map(slide => slide.data.id), ['a', 'n', 'b']);
  assert.deepEqual(slidesOfText(insertPartsText(text, 0, [part])).map(slide => slide.data.id), ['n', 'a', 'b']);
  assert.deepEqual(slidesOfText(insertPartsText(text, 9, [part])).map(slide => slide.data.id), ['a', 'b', 'n']);
  assert.ok(insertPartsText(text, 1, [part]).startsWith(text.slice(0, text.indexOf('```slide title\nid: b'))));
}

// 16 November: a part's own heading is the handout's, and never marks a library copy changed. So an older copy whose
// heading the editor writes in at the first edit keeps its source's stamp, and so does any edit of that heading.
{
  const data = { id: 'a1', title: 'Four parts' };
  const base = slideStamp('boxes', data, 'Text.', 'Slide library');
  assert.equal(slideStamp('boxes', data, '## Four parts\n\nText.', 'Slide library'), base, 'the heading written in');
  assert.equal(slideStamp('boxes', data, '## Four parts, in short\n\nText.', 'Slide library'), base, 'the heading edited');
  assert.equal(slideStamp('boxes', data, 'Four parts\n---\n\nText.', 'Slide library'), base, 'a setext heading too');
  assert.notEqual(slideStamp('boxes', data, '## Four parts\n\nOther text.', 'Slide library'), base, 'the text under it still counts');
  assert.notEqual(slideStamp('boxes', data, '### Smaller\n\nText.', 'Slide library'), base, 'an H3 is text, not the part\'s heading');
}


console.log('deckLibraryFormat: passed');
