/**
 * Sprint 159's privacy fixture (technical plan §6): a deck with a distinct test word in every private place, for the
 * page's tests. Never imported by product code.
 *
 * Each word may appear in the deck's file and nowhere public: not in `publicDeck`'s output, not in the page's bytes,
 * not in what Publish's gather sends. The public words must all arrive.
 */

/** Each private place and the word that sits in it. */
export const PRIVATE_WORDS = {
  frontMatterTheme: 'FMTHEMEQXA',
  frontMatterOther: 'FMOTHERQXB',
  id: 'idqxc',
  from: 'FROMQXD',
  foldedNotes: 'NOTESQXE',
  strayNotes: 'STRAYNOTESQXF',
  anchoredComment: 'ANCHOREDQXG',
  anchoredCommentId: 'anchoridqxh',
  standaloneComment: 'STANDALONEQXI',
  preambleComment: 'PRECOMMENTQXJ',
  hiddenItem: 'HIDDENITEMQXK',
  exerciseLine: 'EXERCISELINEQXL',
  thirdColumn: 'THIRDCOLUMNQXM',
  skippedTitle: 'SKIPTITLEQXN',
  skippedWords: 'SKIPWORDSQXO',
  skippedHandout: 'SKIPHANDOUTQXP',
  skippedNotes: 'SKIPNOTESQXQ',
  skippedPicture: 'skippictureqxr',
  slideInHandout: 'SLIDEFENCEQXS',
  iconOfLine: 'ICONOFLINEQXT',
  commentAcrossFence: 'ACROSSFENCEQXU',
} as const;

/** Words that must reach the page. */
export const PUBLIC_WORDS = [
  'PREAMBLEPUBLIC',
  'Harbour title',
  'Harbour Logistics · 3 hours',
  'words the comment sat on',
  'Choose a task you do every week',
  'Write the instructions with the prompt below',
  'You are an assistant for the customer service team',
  'Why agents?',
  'Left column',
  'Right column',
  'Assistant or agent',
  'Read the room',
  'which-stays.png',
] as const;

const W = PRIVATE_WORDS;

/** The deck's text: every private place holds its word. */
export const PRIVATE_DECK = `---
deck: 1
theme: Slide library/Themes/${W.frontMatterTheme}.theme.md
look: borderless
owner: ${W.frontMatterOther}
---

Before the first slide: PREAMBLEPUBLIC, for everyone.

<!-- {id:p1} ${W.preambleComment} -->

\`\`\`slide title
id: ${W.id}
title: Harbour title
subtitle: Harbour Logistics · 3 hours
from: Slide library/${W.from}.deck.md#a1 @j4kptu
kept: true
items:
- heading: ${W.hiddenItem}
\`\`\`

\`\`\`notes
Welcome everyone. ${W.foldedNotes}
\`\`\`

Here are the <mark data-comment="Check this ${W.anchoredComment}" data-comment-id="${W.anchoredCommentId}">words the comment sat on</mark>, kept.

<!-- {id:c2} Ask Mari about this. ${W.standaloneComment} -->

\`\`\`notes
A stray notes block the deck view keeps as code. ${W.strayNotes}
\`\`\`

\`\`\`slide section
id: c004
number: "1"
title: Why agents?
\`\`\`

\`\`\`slide exercise
id: e006
title: Build an assistant for one task
items:
- heading: Choose a task
  text: ${W.exerciseLine}
- heading: Write it down
\`\`\`

1. Choose a task you do every week.
2. Write the instructions with the prompt below.

PROMPT

\`\`\`
You are an assistant for the customer service team. Answer only from the Policies folder.
\`\`\`

\`\`\`slide picture
id: d005
title: ${W.skippedTitle}
subtitle: ${W.skippedWords}
image: images/${W.skippedPicture}.png
skip: true
\`\`\`

\`\`\`notes
${W.skippedNotes}
\`\`\`

A skipped slide's handout: ${W.skippedHandout}. ![A picture only it uses](images/${W.skippedPicture}.png)

\`\`\`slide columns
id: a002
title: Assistant or agent?
items:
- heading: Left column
  text: "Answers when you ask"
- heading: Right column
  text: "Works on a goal"
- heading: ${W.thirdColumn}
  text: more
\`\`\`

\`\`\`slide boxes
id: g002
title: Read the room
look: line
items:
- heading: When
  text: Every Monday
  icon: ${W.iconOfLine}
\`\`\`

![A picture that stays](images/which-stays.png)

    \`\`\`slide points
    id: ${W.slideInHandout}
    \`\`\`

<!-- a comment that opens here ${W.commentAcrossFence}

\`\`\`
${W.commentAcrossFence} inside a fence inside the comment
\`\`\`

and closes here -->

\`\`\`
<!-- a prompt that shows a comment stays as written -->
\`\`\`
`;

/**
 * Sprint 161: the same rule for block slides (format v2), each private place with its word: the header's keys, a
 * comment and an anchored comment written on the slide itself, a private fence in a slide, a skipped block slide with
 * its picture, and a v1 slide's words its layout hides next to it (a mixed deck).
 */
export const PRIVATE_BLOCK_WORDS = {
  headerId: 'hdridqxa',
  headerFrom: 'HDRFROMQXB',
  slideComment: 'SLIDECOMMENTQXC',
  slideAnchored: 'SLIDEANCHOREDQXD',
  slideNotesFence: 'SLIDENOTESQXE',
  partComment: 'PARTCOMMENTQXF',
  skippedBlockTitle: 'SKIPBLOCKQXG',
  skippedBlockPicture: 'skipblockpicqxh',
  v1Notes: 'VONENOTESQXI',
  v1HiddenColumn: 'VONECOLUMNQXJ',
  rawHtml: 'RAWHTMLQXK',
} as const;

/** Words of the block deck that must reach the page and the wall. */
export const PUBLIC_BLOCK_WORDS = ['Copilot or Cursor?', 'Documents and mail', 'Building things', 'Pick a question', 'Harjutus', 'Block cover', 'the anchored words', 'pilot.png'] as const;

const B = PRIVATE_BLOCK_WORDS;

export const PRIVATE_BLOCK_DECK = `---
deck: 2
---

\`\`\`slide
# Block cover

A line under it
\`\`\`

The cover's handout.

\`\`\`slide
---
id: ${B.headerId}
from: Slide library/${B.headerFrom}.deck.md#a1 @abc123
kept: true
---
# Copilot or Cursor?

:::: columns
::: column
### Copilot
Documents and mail
:::
::: column
### Cursor
Building things
<!-- ${B.slideComment} -->
:::
::::

Here are <mark data-comment="${B.slideAnchored}">the anchored words</mark> on the slide.

<script>${B.rawHtml}</script>

~~~notes
${B.slideNotesFence}
~~~
\`\`\`

<!-- ${B.partComment} -->

The handout of the columns.

\`\`\`slide
# Steps

::: {.steps tag="Harjutus"}
1. Pick a question
2. Write it down
:::

![](images/pilot.png)
\`\`\`

\`\`\`slide
---
skip: true
---
# ${B.skippedBlockTitle}

![](images/${B.skippedBlockPicture}.png)
\`\`\`

\`\`\`slide columns
title: A v1 slide beside them
items:
- heading: One
- heading: Two
- heading: ${B.v1HiddenColumn}
\`\`\`

\`\`\`notes
${B.v1Notes}
\`\`\`
`;
