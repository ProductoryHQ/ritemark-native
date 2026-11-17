/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude"): what a comment on a block slide is on, read from
 * the slide's Markdown in the handout's own notation, and the words that name it.
 * Run with `npx tsx src/decks/blocks/slideComments.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { anchorLine, commentOnSlide, slideCommentCount, slideCommentsOf } from './slideComments';
import { blockSectionNumberOf, blockSlideHtml, isCoverSlide } from './slideRenderer';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';
const ID_D = '44444444-4444-4444-8444-444444444444';

const SLIDE = `# An assistant's four parts

An assistant is set up <mark data-comment="@claude say once" data-comment-id="${ID_A}">once and used every day</mark>.

<!-- {id:${ID_B}} Make each box at most five words, and keep the icons. @claude -->

:::: {.boxes look="boxes"}

::: {.box icon="list-checks"}
### Instructions
What it does
:::

::: {.box icon="book"}
### Knowledge
The files it answers from
:::

::: {.box icon="puzzle"}
### Skills
Small skills it can call on
:::

::: {.box icon="wrench"}
### Tools
What it may open
:::

::::

<!-- {id:${ID_C}} The whole slide is too busy. -->`;

// ── What each comment is on ──────────────────────────────────────────────────
{
  const comments = slideCommentsOf(SLIDE);
  assert.equal(comments.length, 3);
  assert.deepEqual(comments[0], { id: ID_A, note: '@claude say once', anchor: { kind: 'words', words: 'once and used every day' } });
  assert.deepEqual(comments[1].anchor, { kind: 'block', block: { kind: 'boxes', count: 4 } }, 'a note before a block is on it');
  assert.equal(comments[1].id, ID_B);
  assert.equal(comments[1].note, 'Make each box at most five words, and keep the icons. @claude');
  assert.deepEqual(comments[2].anchor, { kind: 'slide' }, 'a note with nothing after it is on the whole slide');
  assert.equal(slideCommentCount(SLIDE), 3);
  console.log('slideComments: anchors read from where the comments are written');
}

// ── The card's head line ─────────────────────────────────────────────────────
{
  const [words, boxes, whole] = slideCommentsOf(SLIDE);
  assert.equal(anchorLine(boxes.anchor, 6), 'On the four boxes, slide 6', 'frame 28');
  assert.equal(anchorLine(whole.anchor, 6), 'On slide 6');
  assert.equal(anchorLine(words.anchor, 6), 'On “once and used every day”, slide 6');
  assert.equal(anchorLine({ kind: 'words', words: 'Ask it three questions you were really asked last week' }, 2), 'On “Ask it three questions you were really…”, slide 2');
  assert.equal(anchorLine({ kind: 'block', block: { kind: 'columns', count: 2 } }, 3), 'On the two columns, slide 3');
  assert.equal(anchorLine({ kind: 'block', block: { kind: 'boxes', count: 1 } }, 3), 'On the box, slide 3');
  assert.equal(anchorLine({ kind: 'block', block: { kind: 'boxes', count: 14 } }, 3), 'On the 14 boxes, slide 3');
  console.log('slideComments: the head line names what a comment is on');
}

// ── The title, a line, a picture; notes in a row; an empty note ──────────────
{
  const md = `<!-- {id:${ID_A}} On the title -->
# Title

<!-- {id:${ID_B}} first -->

<!-- {id:${ID_C}} second, on the same picture -->

![A chart](images/chart.png)

<!-- {id:${ID_D}} -->

Closing line`;
  const comments = slideCommentsOf(md);
  assert.deepEqual(comments.map(comment => comment.anchor), [
    { kind: 'block', block: { kind: 'title' } },
    { kind: 'block', block: { kind: 'picture' } },
    { kind: 'block', block: { kind: 'picture' } },
    { kind: 'block', block: { kind: 'text' } },
  ]);
  assert.equal(comments[3].note, '', 'an empty note (a box still open) is kept');
  assert.equal(slideCommentCount(md), 3, 'but not counted');
  console.log('slideComments: title, picture, notes in a row, an empty note');
}

// ── Code is code: a comment written in a prompt is the prompt's words ────────
{
  const md = '# Prompt\n\n```\n<!-- not a comment -->\n```\n\nSay `<mark data-comment="x">no</mark>` here.';
  assert.equal(slideCommentsOf(md).length, 0);
  console.log('slideComments: code is never a comment');
}

// ── One anchored comment over two blocks is one comment ──────────────────────
{
  const md = `# <mark data-comment="shorter" data-comment-id="${ID_A}">Title</mark>\n\n<mark data-comment="shorter" data-comment-id="${ID_A}">Line under</mark>`;
  const comments = slideCommentsOf(md);
  assert.equal(comments.length, 1);
  assert.deepEqual(comments[0].anchor, { kind: 'words', words: 'Title Line under' });
  console.log('slideComments: a comment over several blocks is one');
}

// ── A comment never changes how a slide is drawn ─────────────────────────────
{
  const cover = '# Thank you\n\nQuestions?';
  assert.equal(isCoverSlide(cover), true);
  assert.equal(isCoverSlide(`${cover}\n\n<!-- {id:${ID_A}} bigger -->`), true, 'a note on the whole slide keeps a cover a cover');
  assert.equal(isCoverSlide(`<!-- {id:${ID_A}} on the title -->\n\n${cover}`), true, 'a note on the title too');
  assert.equal(blockSectionNumberOf(`2\n\n<!-- {id:${ID_A}} x -->\n\n# Prompts`), '2', 'a section stays a section');
  const drawn = blockSlideHtml(SLIDE);
  for (const secret of ['say once', 'five words', 'too busy', 'data-comment', ID_A, ID_B, ID_C]) assert.ok(!drawn.includes(secret), `the drawing never shows ${secret}`);
  assert.ok(drawn.includes('once and used every day'), 'the words a comment is on stay');
  assert.equal((drawn.match(/class="blk-box"/g) ?? []).length, 4, 'a note never becomes a box');
  console.log('slideComments: the drawing is the same with or without comments, and shows none');
}

// ── The host names the slide a comment is on ─────────────────────────────────
{
  const deck = `---
deck: 2
---

\`\`\`slide
# Welcome
\`\`\`

Handout one <mark data-comment="handout" data-comment-id="${ID_D}">words</mark>.

\`\`\`slide
---
id: k3f9
---
${SLIDE}
\`\`\`

Handout two.
`;
  const found = commentOnSlide(deck, ID_B);
  assert.ok(found);
  assert.equal(found.number, 2);
  assert.equal(found.count, 2);
  assert.equal(found.id, 'k3f9');
  assert.equal(found.title, "An assistant's four parts");
  assert.deepEqual(found.comment.anchor, { kind: 'block', block: { kind: 'boxes', count: 4 } });
  assert.equal(commentOnSlide(deck, ID_D), null, 'a handout comment is not on a slide');
  assert.equal(commentOnSlide(deck, 'missing'), null);
  console.log('slideComments: the host finds the slide a comment is on');
}

console.log('slideComments: all tests passed');
