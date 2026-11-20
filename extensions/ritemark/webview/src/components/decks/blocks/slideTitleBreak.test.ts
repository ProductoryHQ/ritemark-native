/**
 * #923: a line break (Shift+Enter) in a slide's title. It was written as CommonMark's `\` and a newline, which an ATX
 * heading can't hold: on the slide's next open the title ended in a literal `\` and its second line was a paragraph.
 * Now it is written `<br>`, on the title's one line, and the slide editor, the renderer (the stage's strip, the wall,
 * the presenter view and the page all draw with it), the slide's name and the handout read it as the title's break.
 * Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { blockSlideHtml } from '../../../../../src/decks/blocks/slideRenderer'
import { blockTitleOf } from '../../../../../src/decks/deckFormat'
import { tabHeadingOf } from '../../../../../src/decks/blocks/tabset'
import { loadSlide, saveSlide, slideSchema } from './slideEditorHarness'

const n = slideSchema.nodes
const t = (text: string) => slideSchema.text(text)

// ---- the slide editor writes and reads it as one title ----
const typed = n.doc.create(null, [
  n.heading.create({ level: 1 }, [t('First line'), n.hardBreak.create(), t('second line')]),
  n.paragraph.create(null, t('Body')),
])
const written = saveSlide(typed)
assert.equal(written, '# First line<br>second line\n\nBody', 'the break is `<br>`, on the title\'s one line')
assert.ok(loadSlide(written).eq(typed), 'the slide opens again with the same two-line title, and its body')
assert.equal(saveSlide(loadSlide(written)), written, 'and saves again the same')

// A heading in a column, a box's title line: the same.
const column = ':::: columns\n\n::: column\n### Left<br>side\nText\n:::\n\n::: column\nB\n:::\n\n::::'
assert.equal(saveSlide(loadSlide(column)), column, 'a column\'s two-line heading stays as written')

// ---- the renderer draws it as the title's second line ----
assert.equal(blockSlideHtml(written).trim(), '<h1>First line<br>second line</h1>\n<p>Body</p>', 'one h1 with a break in it')
assert.equal(blockSlideHtml('# One<br/>two').trim(), '<h1>One<br>two</h1>', '`<br/>` is the same break')
assert.equal(blockSlideHtml('# One <span>x</span>').trim(), '<h1>One x</h1>', 'any other tag still draws nothing')
assert.equal(blockSlideHtml('<br>\n\nText').trim(), '<p>Text</p>', 'a `<br>` block of its own draws nothing')
assert.equal(blockSlideHtml('# a \\<br> b').trim(), '<h1>a &lt;br&gt; b</h1>', 'typed `<br>` words stay words')

// ---- the slide's name (strip, go-to box, Contents, Agenda) joins its lines with a space ----
assert.equal(blockTitleOf(written), 'First line second line')
assert.equal(blockTitleOf('# a \\<br> b'), 'a <br> b', 'typed `<br>` words stay in the name, without a stray backslash')
assert.equal(blockTitleOf('# a\\\\<br>b'), 'a\\ b', 'a break after an escaped backslash is still a break')
assert.equal(tabHeadingOf('### Left<br>side')?.name, 'Left side', 'a tab\'s two-line heading names it with a space')

// ---- a title saved the old way opens as every Markdown reader shows it, never guessed into one title ----
const old = '# First line\\\nsecond line'
assert.equal(blockSlideHtml(old).trim(), '<h1>First line\\</h1>\n<p>second line</p>', 'the old form draws as it reads')

console.log('slideTitleBreak: passed')
