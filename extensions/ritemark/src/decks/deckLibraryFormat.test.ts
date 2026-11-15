/**
 * Sprint 157: copying slides between decks and the library. Run with `npx tsx src/decks/deckLibraryFormat.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseDeck } from './deckFormat';
import {
  appendPart, folderOf, newTopicText, normalizePath, partText, projectPath, rebasePath, rebaseSlide,
  foldMarkdown, replaceSlidePart, rewriteMarkdownTargets, slideStamp, slidesOfText,
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

console.log('deckLibraryFormat: passed');
