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
import { blockDataOf, blockSlideBody, convertDeckText, convertedPart, convertSlide, hasStepsPill, labelledSlideBody, renewedFrom, withCommentAtEnd, withDeckVersion, withStepsTag } from './convertDeck';
import { blockSectionNumberOf, blockSlideHtml, blockStepsLabelOf, blockStepsTagOf } from './slideRenderer';
import { labelLine, labelsAsPills, withStepsLabels } from './labelBlock';

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
  '```slide', '---', 'id: s1', 'section: true', '---', '1', '', '# Why agents?', '```', '',
  '## Why agents?', '', 'Section text.', '',
  '<!-- NOTESWORD --› still notes', 'Hidden by the old layout: SECTIONSUBTITLE -->', '',
  '```slide', '---', 'id: e2', '---', '[Harjutus]{.label}', '', '# Try it', '', '::: steps', '1. Open', '2. Ask', ':::', '```', '',
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

// ---- Review of #765: a Section slide without a number is still a divider on the page (its written kind goes with it);
// a word over a title is no section number.
{
  const text = '```slide section\nid: s1\ntitle: Intro\n```\n\nText.\n\n```slide\n---\nid: b2\n---\nProductory\n\n# Workshop\n```\n\nMore.\n';
  const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  assert.equal(deck.slides[0].section, '');
  const html = pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null });
  assert.equal((html.match(/<section class="part sect"/g) ?? []).length, 1, 'the Section slide, and only it');
  assert.equal(blockSectionNumberOf('Productory\n\n# Workshop'), null);
  assert.equal(blockSectionNumberOf('2.1\n\n# Workshop'), '2.1');
  assert.equal(blockSectionNumberOf('B\n\n# Workshop'), 'B');
}

// ---- Security review of #765: notes that quote slide syntax never become a slide, nor swallow the next one, once they
// are a comment: their fence lines are indented, and the converted deck has the slides it had, none of the notes public.
{
  const quoting = [
    '```slide points', 'id: s1', 'title: Public title', '```', '',
    '````notes', 'Remember how a slide is written:', '```slide', '# SECRET PRICE 40k', '```', '~~~slide', '# SECRET TILDE', '~~~', 'and SECRETTAIL', '```', '````', '',
    'Part one.', '',
    '```slide points', 'id: s2', 'title: Second', '```', '',
    'Part two.', '',
  ].join('\n');
  const after = convertDeckText(quoting);
  assert.deepEqual(parseDeck(after).slides.map(slide => slideDataOf(slide.kind, slide.body).id), ['s1', 's2'], 'two slides, as before');
  assert.ok(after.includes('\n    ```slide\n# SECRET PRICE 40k\n    ```\n    ~~~slide\n'), after);
  assert.ok(after.includes('\n    ``` -->'), 'the last line closes no fence and opens none');
  const page = JSON.stringify(publicDeck(after, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }));
  for (const word of ['SECRET PRICE', 'SECRET TILDE', 'SECRETTAIL']) assert.ok(!page.includes(word), `${word} reached the page`);
}

// ---- Review of #765, round 2: a comment is never put inside a prompt left open at the end of the deck (the page
// publishes a prompt's text); two v1 slides of different kinds with the same words are drawn each as its own kind.
{
  const open = '```slide columns\nid: c1\ntitle: T\nitems:\n- heading: A\n- heading: B\n- heading: HIDDENWORD\n```\n\nA prompt:\n\n```text\nWrite a summary';
  const after = convertDeckText(open);
  assert.ok(after.endsWith('```text\nWrite a summary\n```\n\n<!-- Hidden by the old layout: HIDDENWORD -->'), after);
  const page = JSON.stringify(publicDeck(after, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }));
  assert.ok(!page.includes('HIDDENWORD') && page.includes('Write a summary'));
  assert.equal(withCommentAtEnd('```\ncode\n```', '<!-- c -->'), '```\ncode\n```\n\n<!-- c -->', 'a closed fence is left alone');
  const same = slideDataOf('points', 'title: Steps\nitems:\n- heading: One');
  assert.notEqual(blockDataOf('points', same).markdown, blockDataOf('exercise', same).markdown);
  assert.match(blockDataOf('exercise', same).markdown ?? '', /::: steps/);
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

// ---- Settings' Label row on a block slide (gone since Sprint 164 PR 3; `withStepsTag` stays only while DeckView.tsx,
// PR 1's until #819 merges, still imports it): the first Steps block's pill, its colons kept, nothing else touched.
{
  const markdown = '# Try\n\n```\n::: steps\n```\n\n:::: {.steps look="x"}\n1. A\n::::\n\n::: steps\n1. B\n:::';
  const tagged = withStepsTag(markdown, 'Harjutus');
  assert.equal(tagged, markdown.replace(':::: {.steps look="x"}', ':::: {.steps look="x" tag="Harjutus"}'), 'a ::: line in code is no block; the other values keep their order (withFenceValue)');
  assert.equal(blockStepsTagOf(tagged), 'Harjutus');
  assert.equal(blockStepsTagOf(withStepsTag(tagged, '')), '', 'emptied: no pill');
  assert.equal(withStepsTag(tagged, 'Harjutus'), tagged, 'the same words: the same text');
  assert.equal(withStepsTag('::: steps\n1. A\n:::', 'Say "hi"'), "::: {.steps tag='Say \"hi\"'}\n1. A\n:::");
  assert.equal(withStepsTag('# No steps', 'X'), '# No steps');
}

// ---- Sprint 164 PR 3 (the decks README, "Today's pills are kept"): a block slide's Steps pill becomes a Label in the
// same place, before the heading over the steps, or before the steps when there is no heading; the person's words kept
// exactly; an emptied pill becomes nothing; a Steps block with no tag has no Label; a deck with no pill is not touched.
{
  // Before the heading over the steps, its notes included; the other values on the line stay in their order.
  assert.equal(withStepsLabels('# Try it\n\n::: {.steps tag="Harjutus · 1 / 2" reveal="one"}\n1. Open\n:::'), '[Harjutus · 1 / 2]{.label}\n\n# Try it\n\n::: {.steps reveal="one"}\n1. Open\n:::');
  assert.equal(withStepsLabels('<!-- {id:a} on the title -->\n# Try\n\n::: {.steps tag="X"}\n1. A\n:::'), '[X]{.label}\n\n<!-- {id:a} on the title -->\n# Try\n\n::: steps\n1. A\n:::', 'a note on the heading stays with it');
  // No heading over it: before the steps (a paragraph between is no heading over them), never joined to the words before.
  assert.equal(withStepsLabels('::: {.steps tag="Harjutus"}\n1. Open\n:::'), '[Harjutus]{.label}\n\n::: steps\n1. Open\n:::');
  assert.equal(withStepsLabels('# T\n\nIntro\n::: {.steps tag="X"}\n1. A\n:::'), '# T\n\nIntro\n\n[X]{.label}\n\n::: steps\n1. A\n:::');
  // In a column, as an exercise's layout writes it: before the column's title, inside the column.
  assert.equal(
    withStepsLabels(':::: columns\n::: {.column width="35%"}\n# Report\n::: {.steps tag="Exercise · 1 / 2"}\n1. Read\n:::\n:::\n::: column\nTabs\n:::\n::::'),
    ':::: columns\n::: {.column width="35%"}\n[Exercise · 1 / 2]{.label}\n\n# Report\n::: steps\n1. Read\n:::\n:::\n::: column\nTabs\n:::\n::::',
  );
  // Emptied: nothing. No tag: nothing. In code: words. Written again: the same text.
  assert.equal(withStepsLabels('# T\n\n::: {.steps tag=""}\n1. A\n:::'), '# T\n\n::: steps\n1. A\n:::');
  assert.equal(withStepsLabels('# T\n\n::: {.steps tag="  "}\n1. A\n:::'), '# T\n\n::: steps\n1. A\n:::');
  const plain = '# T\n\n::: steps\n1. A\n:::';
  assert.equal(withStepsLabels(plain), plain, 'a new Steps block has no Label');
  const code = '```\n::: {.steps tag="X"}\n```';
  assert.equal(withStepsLabels(code), code, 'a ::: line in code is words');
  const once = withStepsLabels('# T\n\n::: {.steps tag="X"}\n1. A\n:::');
  assert.equal(withStepsLabels(once), once, 'a slide written as Labels is never changed again');
  // Brackets and emphasis marks in the words are escaped, so they read back as typed.
  assert.equal(withStepsLabels('::: {.steps tag="A [b] *c*"}\n1. A\n:::'), '[A \\[b\\] \\*c\\*]{.label}\n\n::: steps\n1. A\n:::');
  assert.equal(blockStepsLabelOf('::: {.steps tag="A [b] *c*"}\n1. A\n:::'), 'A [b] *c*');
  // What is drawn before the first edit is what it writes.
  const old = '# Try it\n\n::: {.steps tag="Harjutus"}\n1. Open\n:::';
  assert.equal(blockSlideHtml(old), blockSlideHtml(withStepsLabels(old)));
  assert.equal(blockStepsLabelOf(old), 'Harjutus');
  assert.equal(blockStepsTagOf, blockStepsLabelOf, 'the old name, for DeckView.tsx until #819 merges');
  // Review of #858: a Steps block in a tab's pane keeps its Label in that pane; the tab's name is no heading over it.
  const inPane = '::: {.panel-tabset}\n## Prompt 1\n::: {.steps tag="Harjutus"}\n1. x\n:::\n\n## Prompt 2\n\nWords\n:::';
  assert.equal(withStepsLabels(inPane), '::: {.panel-tabset}\n## Prompt 1\n\n[Harjutus]{.label}\n\n::: steps\n1. x\n:::\n\n## Prompt 2\n\nWords\n:::');
  const paneHtml = blockSlideHtml(inPane);
  assert.ok(paneHtml.includes('class="blk-tabs"') && /data-tab-name="Prompt 1"><div class="blk-tabname">Prompt 1<\/div><div class="blk-label">Harjutus<\/div>/.test(paneHtml), paneHtml);
  // What an Agenda block holds is kept as written and never read: its lines aren't moved either.
  const inAgenda = '# Today\n\n::: agenda\n::: {.steps tag="Kept"}\n1. One\n:::\n:::';
  assert.equal(withStepsLabels(inAgenda), inAgenda);
  assert.equal(labelsAsPills(inAgenda, tag => `STEPS(${tag})`), '# Today\n\n::: agenda\nSTEPS(Kept)\n1. One\n:::\n:::', 'its stamp as before');
  // Security review of #858: a Label's attribute block is written back only as one line.
  assert.equal(labelLine('x', '{.label note="a\nb"}'), '[x]{.label}');
  assert.equal(labelLine('x', '{.label #intro}'), '[x]{.label #intro}');
  // Review of #858: "Tagasiside" and "tagasi" are words, not a pill to read.
  const words = '# Tagasiside\n\n::: steps\n1. Tule tagasi\n:::';
  assert.equal(withStepsLabels(words), words);
}

// ---- Review of #858: the exercise's Label for the page's Contents and Present's timer is the Steps block's own (in its
// place), else the last one before it; never one after it; none for a slide whose only Steps block is in a tab's pane.
{
  assert.equal(blockStepsLabelOf('[Exercise · 2 / 3]{.label}\n\n# Try\n\n::: steps\n1. A\n:::\n\n:::: boxes\n::: box\n[Tip]{.label}\n\nOne\n:::\n::::'), 'Exercise · 2 / 3');
  assert.equal(blockStepsLabelOf('# Try\n\n::: steps\n1. A\n:::\n\n:::: boxes\n::: box\n[Tip]{.label}\n:::\n::::'), '', 'a Label after the steps is not theirs');
  assert.equal(blockStepsLabelOf('[Day 1]{.label}\n\n# Try\n\n:::: columns\n::: column\n::: steps\n1. A\n:::\n:::\n::::'), 'Day 1', 'the last one before the steps');
  assert.equal(blockStepsLabelOf('# Try\n\n::: {.panel-tabset}\n## One\n\n::: steps\n1. A\n:::\n:::'), null, 'Steps only in a pane: no exercise, as before');
  assert.equal(blockStepsLabelOf('# Try\n\nWords\n[Not a label]{.label}\n\n::: steps\n1. A\n:::'), '', 'a line that goes on a paragraph is words');
  // Round two of #858's review: read as the slide is drawn. A Label line that goes on with words, or that a setext line
  // makes a heading, is no Label; an emptied Label in the steps' place is none (never an earlier one); a box's Label
  // before the title is not the exercise's; what a comment holds is never read; a Tabs block with no tabs is a block.
  assert.equal(blockStepsLabelOf('[Day 1]{.label}\nSome words\n\n# Try\n\n::: steps\n1. A\n:::'), '');
  assert.equal(blockStepsLabelOf('[Day]{.label}\n---\n\n::: steps\n1. A\n:::'), '');
  assert.equal(blockStepsLabelOf('[Part 2]{.label}\n\n# Intro\n\nWords\n\n[]{.label}\n\n# Try\n\n::: steps\n1. A\n:::'), '');
  assert.equal(blockStepsLabelOf(':::: boxes\n::: box\n[Tip]{.label}\n\nOne\n:::\n::::\n\n# Try\n\n::: steps\n1. A\n:::'), '');
  assert.equal(blockStepsLabelOf('# Try\n\n<!-- draft\n::: steps\n1. A\n:::\n-->\n\nWords'), null, 'Steps in a comment: no exercise');
  assert.equal(blockStepsLabelOf('<!--\n\n[Old]{.label}\n\n-->\n\n# Try\n\n::: steps\n1. A\n:::'), '', 'a Label in a comment is never read');
  const commented = '# Try\n\n<!-- draft\n::: {.steps tag="X"}\n1. A\n:::\n-->';
  assert.equal(withStepsLabels(commented), commented, 'nor migrated');
  const deeper = '::: {.panel-tabset}\n## Tab\n\n### Do this\n\n::: {.steps tag="X"}\n1. a\n:::\n:::';
  assert.equal(withStepsLabels(deeper), '::: {.panel-tabset}\n## Tab\n\n[X]{.label}\n\n### Do this\n\n::: steps\n1. a\n:::\n:::', 'a deeper heading in a pane is the pane\'s');
  const noTabs = '# Try\n\n::: {.panel-tabset}\n::: {.steps tag="X"}\n1. a\n:::\n:::';
  assert.equal(blockStepsLabelOf(noTabs), 'X', 'a tabset with no tabs is a plain block, as it is drawn');
  assert.equal(labelLine('x', '{.label note="a\rb"}'), '[x]{.label}', 'a lone carriage return is a line break too');
  assert.ok(!labelsAsPills('[Day]{.label}\n---\n\n::: steps\n1. A\n:::', tag => `STEPS(${tag})`).includes('STEPS(Day)'));
  // The stamp reads only a Label that is a block of its own back as the pill.
  const continued = 'Intro words\n[Note]{.label}\n\n# Title\n\n::: steps\n1. A\n:::';
  assert.ok(labelsAsPills(continued, tag => `STEPS(${tag})`).includes('Intro words\n[Note]{.label}'), 'the paragraph keeps its words');
  assert.ok(labelsAsPills(continued, tag => `STEPS(${tag})`).includes('STEPS(null)'));
}

// ---- The deck's first edit writes each block slide's pill as a Label (`convertDeckText` is the deck view's rule):
// the fences, the notes and the handout stay byte for byte, and a deck with no pill comes back as it is.
{
  const deck = [
    '---', 'deck: 2', '---', '',
    '```slide', '---', 'id: e1', '---', '# Try it', '', '::: {.steps tag="Harjutus · 1 / 2"}', '1. Open', ':::', '```', '',
    '```notes', 'Kept notes.', '```', '',
    '## Try it', '', 'Handout words.', '',
    '````slide', '::: {.steps tag=""}', '1. Read', '', '```', 'code', '```', ':::', '````', '',
    '```slide', '# Plain', '', '::: steps', '1. Go', ':::', '```', '',
  ].join('\n');
  const bodies = parseDeck(deck).slides.map(slide => slide.body);
  assert.ok(hasStepsPill('', bodies[0]) && hasStepsPill('', bodies[1]) && !hasStepsPill('', bodies[2]));
  const after = convertDeckText(deck);
  assert.equal(after, deck
    .replace('# Try it\n\n::: {.steps tag="Harjutus · 1 / 2"}', '[Harjutus · 1 / 2]{.label}\n\n# Try it\n\n::: steps')
    .replace('::: {.steps tag=""}', '::: steps'));
  assert.equal(convertDeckText(after), after, 'converting again changes nothing');
  const untouched = '---\ndeck: 2\n---\n\n```slide\n# Plain\n\n::: steps\n1. Go\n:::\n```\n\n## Plain\n';
  assert.equal(convertDeckText(untouched), untouched, 'no pill: the deck as it is');
}

// ---- A copy's stamp through the pill's move: a pill and its Label stamp alike, so a copy and its source still match
// whichever was written first; an emptied pill's stamp changes, and its copy's `from:` is renewed with the edit.
{
  const handout = 'Words.';
  const withPill = '---\nid: c1\n---\n# Try\n\n::: {.steps tag="Harjutus"}\n1. A\n:::';
  const asLabel = labelledSlideBody(withPill);
  assert.equal(asLabel, '---\nid: c1\n---\n[Harjutus]{.label}\n\n# Try\n\n::: steps\n1. A\n:::');
  assert.equal(slideStamp('', slideDataOf('', withPill), handout, ''), slideStamp('', slideDataOf('', asLabel), handout, ''), 'a pill and its Label stamp alike');
  const bare = '---\nid: c1\n---\n# Try\n\n::: steps\n1. A\n:::';
  const exercise = '---\nid: c1\n---\n[Exercise]{.label}\n\n# Try\n\n::: steps\n1. A\n:::';
  assert.equal(slideStamp('', slideDataOf('', bare), handout, ''), slideStamp('', slideDataOf('', exercise), handout, ''), 'the old bare pill was "Exercise": stamps written before still stand');
  assert.notEqual(slideStamp('', slideDataOf('', asLabel), handout, ''), slideStamp('', slideDataOf('', asLabel.replace('Harjutus', 'Other')), handout, ''), "a Label's words count");
  assert.equal(labelsAsPills('[Free]{.label}\n\n# T\n\nWords', () => 'x'), '[Free]{.label}\n\n# T\n\nWords', 'a free Label stays words');
  // An emptied pill: its stamp changes when it is written as nothing, so a copy that matched is renewed.
  const emptied = '---\nid: c1\n---\n# Try\n\n::: {.steps tag=""}\n1. A\n:::';
  const stamp = slideStamp('', slideDataOf('', emptied), handout, '');
  const copy = writeSlideData('', emptied, { ...slideDataOf('', emptied), from: writeFrom({ path: 'Slide library/A.deck.md', id: 'a1', stamp }) });
  const written = labelledSlideBody(copy, handout, '');
  const fresh = slideStamp('', slideDataOf('', written), handout, '');
  assert.notEqual(fresh, stamp, 'precondition: the emptied pill stamps otherwise once written as nothing');
  assert.equal(parseFrom(slideDataOf('', written).from)?.stamp, fresh, 'renewed');
  const changed = writeSlideData('', emptied, { ...slideDataOf('', emptied), from: writeFrom({ path: 'Slide library/A.deck.md', id: 'a1', stamp: 'zzzzzz' }) });
  assert.equal(parseFrom(slideDataOf('', labelledSlideBody(changed, handout, '')).from)?.stamp, 'zzzzzz', 'a changed copy keeps its stamp');
}

// ---- parseDeck still reads every part of the converted deck.
assert.deepEqual(parseDeck(converted).slides.map(slide => slide.kind), ['', '', 'gamma.v2']);

console.log('convertDeck: passed');
