/**
 * Sprint 159 (technical plan §6): what of a deck goes public. A distinct test word sits in every private place
 * (`testing/privateDeck.ts`), and none may reach `publicDeck`'s output.
 *
 * Run: npx tsx src/decks/page/publicDeck.test.ts
 */
import { strict as assert } from 'node:assert';
import { publishText } from '../deckFormat';
import { BUILT_IN_THEME, parseTheme } from '../deckTheme';
import { joinFrontMatter, splitFrontMatter } from '../../editorSync/frontMatter';
import { deckLookOf } from '../present/presentSession';
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
// Sprint 161 (PR 2, decision 8): every v1 slide goes out as the block slide its conversion writes.
assert.deepEqual(deck.slides.map(slide => slide.kind), ['', '', '', '', '']);
assert.equal(deck.title, 'Harbour title', 'the title slide\'s title is the page\'s title');
assert.equal(deck.client, 'Harbour Logistics', 'the deck\'s folder is the client line');
assert.equal(deck.look, 'borderless', 'the look holds, from the front matter (whose lines never go)');
assert.equal(deck.theme, BUILT_IN_THEME);

// Only what each layout draws, as blocks: no id, from or kept line, no items a Title slide keeps for other layouts, no
// third column, no Exercise step's line, no icon under a Line look (those are the conversion's comment, never public).
const [title, section, exercise, columns, boxes] = deck.slides;
assert.deepEqual(title.data, { title: 'Harbour title', markdown: '# Harbour title\n\nHarbour Logistics · 3 hours' });
assert.deepEqual(section.data, { title: 'Why agents?', markdown: '1\n\n# Why agents?' });
assert.deepEqual(exercise.data, { title: 'Build an assistant for one task', markdown: '# Build an assistant for one task\n\n::: steps\n1. Choose a task\n2. Write it down\n:::' });
assert.equal(columns.data.markdown, '# Assistant or agent?\n\n:::: columns\n::: column\n### Left column\nAnswers when you ask\n:::\n::: column\n### Right column\nWorks on a goal\n:::\n::::');
assert.deepEqual(boxes.data, { title: 'Read the room', markdown: '# Read the room\n\n:::: {.boxes look="line"}\n::: box\n### When\nEvery Monday\n:::\n::::' });

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
  const bom = publicDeck('\uFEFF---\ndeck: 1\ntheme: Slide library/Themes/SECRETTHEME.theme.md\nlook: borderless\n---\n\n```slide title\ntitle: T\n```\n', options);
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
// A notes fence in a quote or a list (Codex on #729), as Markdown reads it: the whole quote or list holding it goes,
// so its notes are in neither the handout nor the digest. Other quotes, lists and prompts stay.
assert.equal(publicMarkdown('Before\n\n> Quote\n> ```notes\n> secret\n> ```\n> After\n\nAfter the quote'), 'Before\n\nAfter the quote');
assert.equal(publicMarkdown('> > ```notes\n> > secret\n> > ```\n\nafter'), 'after');
assert.equal(publicMarkdown('- one\n- ```notes\n  secret two\n  ```\n\nafter'), 'after');
assert.equal(publicMarkdown('1. step\n\n   ```notes\n   secret\n   ```\n\nafter'), '1. step\n\nafter', 'an indented fence goes by itself');
assert.equal(publicMarkdown('> ```\n> a prompt\n> ```\n\n- a list'), '> ```\n> a prompt\n> ```\n\n- a list', 'a prompt in a quote stays');
// The round-3 review's cases: a fence is never ended before Markdown ends it, so its first line never goes alone.
assert.equal(publicMarkdown('> ```notes\n> > ```\n> secret one\n> ```\n\nafter'), 'after');
assert.equal(publicMarkdown('> ```notes\n>     ```\n> secret three\n> ```\n\nafter'), 'after');
assert.equal(publicMarkdown('```notes\nsecret\n    ```\nmore secret\n```\n\nafter'), 'after', 'four columns deep closes nothing');
assert.equal(publicMarkdown('```notes\nsecret\n> ```\nmore secret\n```\n\nafter'), 'after');
{
  const quoted = (notes: string) => deckDigest(publicDeck(`\`\`\`slide points\ntitle: Q\n\`\`\`\n\nText.\n\n> \`\`\`notes\n> ${notes}\n> \`\`\`\n`, options));
  assert.equal(quoted('first'), quoted('second'), 'notes in a quote are no change');
  const listed = (notes: string) => deckDigest(publicDeck(`\`\`\`slide points\ntitle: Q\n\`\`\`\n\n- \`\`\`notes\n  ${notes}\n  \`\`\`\n`, options));
  assert.equal(listed('first'), listed('second'), 'notes in a list are no change');
}

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

// The fit steps the open view measured, by the slide's place in the deck (skipped slides counted), kept within 0–5 (a v1
// slide is drawn as blocks since PR 2, so it has the block fit's six steps).
{
  const text = '```slide title\ntitle: A\n```\n\n```slide points\ntitle: B\nskip: true\n```\n\n```slide points\ntitle: C\n```\n';
  const fitted: PublicDeck = publicDeck(text, { ...options, steps: [1, 3, 9] });
  assert.deepEqual(fitted.slides.map(slide => slide.step), [1, 5]);
  assert.deepEqual(publicDeck(text, { ...options, steps: [-2, 0, Number.NaN] }).slides.map(slide => slide.step), [0, 0]);
}

// Sprint 159 PR 4 (security review, round 2; code review, round 3): Publish joins the document's front matter with the
// view's body. Where the editor reads the front matter differently from parseDeck (its YAML doesn't read, so the editor
// keeps the whole text; or it ends the front matter at an earlier `---` line), the view's body holds front matter as
// words; none of them may reach the page.
const frontMatters = [
  '---\ndeck: 1\nclient: FRONTWORDQXZ\nsubtitle: Training: Day 1\n---\n',
  '---\ndeck: 1\nclient: FRONTWORDQXZ\ntheme: Slide library/Themes/A.theme.md\ntheme: Slide library/Themes/B.theme.md\n---\n',
  '---\ndeck: 1\n---note: FRONTWORDQXZ\nclient: FRONTWORDQXZ\n---\n',
];
for (const front of frontMatters) {
  const saved = `${front}\n\`\`\`slide title\ntitle: Harbour title\n\`\`\`\n\nThe handout.\n`;
  const editorBody = splitFrontMatter(saved).content;
  assert.ok(editorBody.includes('FRONTWORDQXZ'), `the editor gives the view front matter words for ${JSON.stringify(front)}`);
  // The view's body as the editor serialized it: the front matter's words as a heading, then the slides
  const viewBody = `## ${editorBody.split('\n---')[0].replace(/\n/g, ' ')}\n\n\`\`\`slide title\ntitle: Harbour title\n\`\`\`\n\nThe handout, newer.\n`;
  for (const body of [viewBody, editorBody]) {
    for (const look of [undefined, 'card', 'borderless'] as const) {
      const page = JSON.stringify(publicDeck(publishText(saved, body, editorBody, look).text, options));
      assert.ok(!page.includes('FRONTWORDQXZ'), `the front matter's words reached the page (${JSON.stringify(front)}, ${look})`);
      assert.ok(page.includes('The handout'));
    }
  }
}
// A front matter that reads: the view's newer words go, the front matter doesn't
{
  const saved = '---\ndeck: 1\nclient: FRONTWORDQXZ\n---\n\n```slide title\ntitle: Harbour title\n```\n\nOlder words.\n';
  const page = JSON.stringify(publicDeck(publishText(saved, '```slide title\ntitle: Harbour title\n```\n\nNewer words.\n', splitFrontMatter(saved).content).text, options));
  assert.ok(page.includes('Newer words') && !page.includes('Older words') && !page.includes('FRONTWORDQXZ'));
}

// The look Publish takes is the deck view's (Codex on #737). The page reads the front matter's look as the editor gives
// it to the view, and as the wall reads it. A look chosen just before the press, still on its way to the document,
// makes the page the document makes once the look has reached it (written as the host writes it), so the chip then
// reads Published.
{
  const viewLook = (text: string) => (splitFrontMatter(text).properties.look === 'borderless' ? 'borderless' : 'card');
  const slides = '\n```slide title\ntitle: Harbour title\n```\n\nThe handout.\n';
  const fronts = ['', '---\ndeck: 1\n---\n', '---\ndeck: 1\nlook: borderless\n---\n', '---\ndeck: 1\nlook: "borderless"\n---\n', '---\ndeck: 1\nlook: Borderless\n---\n', '---\ndeck: 1\nlook: card\n---\n', '---\nlook: BORDERLESS\ndeck: 1\n---\n'];
  for (const front of fronts) {
    const saved = front + slides;
    assert.equal(publicDeck(saved, options).look, viewLook(saved), `the page's look is the view's: ${JSON.stringify(front)}`);
    assert.equal(publicDeck(saved, options).look, deckLookOf(saved), `the page's look is the wall's: ${JSON.stringify(front)}`);
    const { properties, content } = splitFrontMatter(saved);
    for (const look of ['card', 'borderless'] as const) {
      // The deck view's Card | Borderless (DeckView's setLook), and the document once it has arrived
      const next = { ...properties };
      if (look === 'borderless') next.look = 'borderless';
      else delete next.look;
      const caughtUp = joinFrontMatter(next, content, saved);
      const published = publishText(saved, content, content, look).text;
      assert.equal(publicDeck(published, options).look, look, `${JSON.stringify(front)} → ${look}`);
      assert.equal(deckDigest(publicDeck(published, options)), deckDigest(publicDeck(caughtUp, options)), `the chip reads Published: ${JSON.stringify(front)} → ${look}`);
    }
  }
}

console.log('publicDeck: passed');
