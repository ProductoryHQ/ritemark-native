/**
 * Sprint 157: copying slides between decks and the library. Run with `npx tsx src/decks/deckLibraryFormat.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseDeck, parseSlideBody } from './deckFormat';
import {
  appendPart, folderOf, newTopicText, normalizePath, partText, projectPath, rebasePath, rebaseSlide,
  foldMarkdown, insertPartsText, replaceSlidePart, rewriteMarkdownTargets, slideStamp, slideStamps, slidesOfText,
  movedTarget, placeAfterMoves, rewriteDeckPictures, rewritePictureTargets,
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
  const rebased = rebaseSlide('id: a1\ntitle: T\nimage: images/agent.png', 'Use ![shot](images/s.png) and [the brief](Brief.md).', 'Slide library', 'Clients/Harbour', 'boxes');
  assert.equal(rebased.body, 'id: a1\ntitle: T\nimage: ../../Slide library/images/agent.png');
  assert.equal(rebased.handout, 'Use ![shot](<../../Slide library/images/s.png>) and [the brief](<../../Slide library/Brief.md>).');
  // Sprint 159 (PR 2, Codex): a path that needs quoting stays one path, quoted, and every other line as written
  const quoted = rebaseSlide('id: a1\ntitle: T\nimage: "images/foo #1.png"\nlook: steps', '', 'Slide library', 'Clients/Harbour', 'boxes');
  assert.equal(parseSlideBody(quoted.body).image, '../../Slide library/images/foo #1.png');
  assert.equal(quoted.body, 'id: a1\ntitle: T\nimage: "../../Slide library/images/foo #1.png"\nlook: steps');
}

// The stamp: what a person sees, paths resolved, whitespace folded; not id, from, kept, skip or notes.
{
  const data = { id: 'a1', title: 'Four parts', items: [{ heading: 'One', text: 'a' }], image: 'images/a.png' };
  const base = slideStamp('boxes', data, 'Text with ![x](images/s.png).', 'Slide library');
  assert.match(base, /^[0-9a-z]{6}$/);
  assert.equal(slideStamp('boxes', { ...data, id: 'zz99', from: 'x#y @z', kept: true, skip: true }, 'Text with ![x](images/s.png).', 'Slide library'), base);
  assert.equal(slideStamp('boxes', { ...data, image: '../../Slide library/images/a.png' }, rebaseSlide('', 'Text   with\n![x](images/s.png).', 'Slide library', 'Clients/Harbour', 'boxes').handout, 'Clients/Harbour'), base, 'a rebased copy is not changed');
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
  // A from: line written before this counted the heading: that stamp still names the slide as it was.
  const legacy = slideStamps('boxes', data, '## Four parts\n\nText.', 'Slide library');
  // Sprint 161: today's stamp first (the block stamp), then the v1 stamps without and with the heading.
  assert.equal(legacy.length, 3);
  assert.equal(legacy[0], base);
  assert.ok(legacy.slice(1).every(stamp => stamp !== base));
  assert.equal(slideStamps('boxes', data, 'Text.', 'Slide library')[0], base, 'no heading: today\'s stamp first');
  assert.equal(slideStamps('boxes', data, 'Text.', 'Slide library').length, 2, 'and the one v1 stamp');
}

// 17 November: a deck moved or renamed in Ritemark keeps its pictures. Its paths to them are written for its new place:
// the slides' `image:` lines and Markdown pictures, and the handout's; links, code and every other byte stay as written.
{
  const DECK = [
    '---', 'deck: 2', '---', '',
    'Intro ![](images/intro.png)', '',
    '```slide', '---', 'id: m1', 'picture: right', 'image: images/side.png', '---', '# Pilot', '', '![chart](images/chart%201.png "the chart")', '', '[notes](notes.md)', '```', '',
    'Handout ![](images/hand.png) and [a link](other.md).', '',
    '```', 'A prompt: ![](images/in-code.png)', '```', '',
    'Inline `![](images/span.png)` stays.', '',
    '```slide', '---', 'id: m2', '---', '# Web', '', '![](https://example.org/a.png)', '```', '',
  ].join('\n');
  const old = 'Users/me/Project/Koolitus';
  const moved = 'Users/me/Project/Arhiiv/2026';
  const rebased = rewriteDeckPictures(DECK, target => movedTarget(target, old, moved));
  // Every picture now points from the new place to the file that stayed where it was.
  assert.ok(rebased.includes('Intro ![](../../Koolitus/images/intro.png)'), 'the words before the first slide');
  assert.ok(rebased.includes('image: ../../Koolitus/images/side.png'), "a slide's own picture (image:)");
  assert.ok(rebased.includes('![chart](../../Koolitus/images/chart%201.png "the chart")'), 'a picture in the slide, its encoding and title kept');
  assert.ok(rebased.includes('Handout ![](../../Koolitus/images/hand.png)'), "the handout's picture");
  // Links, code, a code span and a web address are never touched.
  assert.ok(rebased.includes('[notes](notes.md)') && rebased.includes('[a link](other.md)'), 'links stay');
  assert.ok(rebased.includes('A prompt: ![](images/in-code.png)'), 'a code block is the person\'s own words');
  assert.ok(rebased.includes('`![](images/span.png)`'), 'a code span too');
  assert.ok(rebased.includes('![](https://example.org/a.png)'), 'a web address');
  // Only the pictures' paths changed.
  const strip = (text: string) => text.replace(/(?:\.\.\/\.\.\/Koolitus\/)/g, '');
  assert.equal(strip(rebased), DECK, 'every other byte as it was');
  // A move back writes them back exactly (the person's Undo of the move in the explorer is a move back).
  assert.equal(rewriteDeckPictures(rebased, target => movedTarget(target, moved, old)), DECK, 'a move back restores the paths');
  // A rename in the same folder changes nothing.
  assert.equal(rewriteDeckPictures(DECK, target => movedTarget(target, old, old)), DECK, 'renamed in place: nothing written');
  // A folder moved with its pictures in it: the paths still point right, so nothing is written.
  const after = placeAfterMoves([{ from: old, to: 'Users/me/Project/Kursus' }]);
  assert.equal(rewriteDeckPictures(DECK, target => movedTarget(target, old, 'Users/me/Project/Kursus', after)), DECK, 'moved with its folder');
  // The deck and one picture moved in the same step: that picture is followed to its new place.
  const both = placeAfterMoves([{ from: `${old}/Fit.deck.md`, to: `${moved}/Fit.deck.md` }, { from: `${old}/images/side.png`, to: `${moved}/side.png` }]);
  assert.equal(movedTarget('images/side.png', old, moved, both), 'side.png');
  assert.equal(movedTarget('images/intro.png', old, moved, both), '../../Koolitus/images/intro.png');
  // Never across drives: a path that can't be written relatively stays as it was.
  assert.equal(movedTarget('images/a.png', 'C:/Decks', 'D:/Elsewhere'), 'images/a.png');
  assert.equal(movedTarget('./images/a.png', old, old), './images/a.png', 'a spelling that still points right is kept');
  assert.equal(movedTarget('images/a b.png', old, moved), '../../Koolitus/images/a b.png');
  assert.ok(rewritePictureTargets('![](<images/a b.png>)', () => 'x/a b.png').includes('(<x/a b.png>)'), 'a space in the new path is bracketed');
}

console.log('deckLibraryFormat: passed');
