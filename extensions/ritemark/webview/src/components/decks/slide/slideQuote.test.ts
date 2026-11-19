/**
 * Sprint 166 PR 5 (#841): a Quote on a slide carries no fill or border from outside. VS Code's webview stylesheet gives
 * every blockquote a fill (`--vscode-textBlockQuote-background`) and a border colour; `.ProseMirror blockquote` adds a
 * 3 px border and its own padding. On a dark slide that drew a near-white box. slide.css (the one sheet the stage, the
 * strip, the wall, the presenter view and the page draw with) now sets each of those itself, with a selector that
 * outranks both. Inline code on a slide likewise takes the slide's colour, never VS Code's `code` colour.
 *
 * Sprint 168 PR 1 (#863, the decks README "A quote is a voice, not a box"): the quote's own look on that fix: a 3 px
 * bar in the full accent, 18 px to the words, the words in the heading colour at 1.08 em, weight 500, line height 1.4,
 * 6 px between paragraphs; the attribution (`.blk-by`) at 0.74 em, weight 600, the sub colour, 10 px above. Every length
 * is slide px times the fit. Its class is written by the renderer and by the stage's decoration on the same paragraph:
 * a last paragraph that opens with "— " or "– " under words of its own, never a quote of that one line. Run with
 * `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { EditorState } from '@tiptap/pm/state'
import { QUOTE_BY_CLASS, blockSlideHtml, isQuoteByWords } from '../../../../../src/decks/blocks/slideRenderer'
import { loadSlideWithComments, saveSlide as saveSlideWithComments } from '../blocks/slideEditorHarness'
import { quoteByDecorations } from '../blocks/slideQuote'
import { SlideSync } from '../blocks/slideSync'
import { saveSlideMarkdown } from '../blocks/slideEditorMarkdown'
import { editorHTML } from '../../../utils/markdownFidelity'

const sheet = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const rulesOf = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))
const slideRules = rulesOf(sheet('./slide.css'))
const editorRules = rulesOf(sheet('../decks.css'))

function decls(body: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at > 0) found[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return found
}

/** Specificity as [ids, classes, elements] for a plain selector chain (no pseudo-classes or attributes). */
function specificity(sel: string): [number, number, number] {
  assert.ok(!/[:[]/.test(sel), `plain selector: ${sel}`)
  const ids = (sel.match(/#[\w-]+/g) ?? []).length
  const classes = (sel.match(/\.[\w-]+/g) ?? []).length
  const elements = sel.split(/[\s>+~]+/).filter((p) => /^[a-z]/i.test(p)).length
  return [ids, classes, elements]
}
function beats(a: string, b: string): boolean {
  const x = specificity(a)
  const y = specificity(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

const sel = '.deck-sl.is-blocks blockquote'
const own = slideRules.filter((r) => r.sel === sel)
assert.equal(own.length, 1, 'slide.css has one rule for the slide quote')
const q = decls(own[0].body)

// No outside fill or border: each is set by the slide itself.
assert.equal(q.background, 'none', 'no fill from VS Code')
assert.equal(q.border, '0', 'no border from VS Code or .ProseMirror (3 px)')
assert.equal(q['border-radius'], '0')
// #863: the quote's own look. Its own padding on all four sides (one shorthand), its own colour and type.
assert.ok(!('padding-left' in q), 'one padding shorthand')
assert.equal(q['box-shadow'], 'inset 3px 0 0 var(--s-acc, #F2B544)', 'a 3 px bar in the full accent')
assert.equal(q.color, 'var(--s-hd, #fff)', 'the words in the heading colour')
assert.equal(q['font-size'], '1.08em')
assert.equal(q['font-weight'], '500')
assert.equal(q['line-height'], '1.4')

/** One length at a fit: `0`, or `calc(Npx * var(--fit, 1))` (slide px times the fit, never an em of the quote's type). */
function px(value: string, fit: number): number {
  if (value.trim() === '0') return 0
  const m = /^calc\(([\d.]+)px \* var\(--fit, 1\)\)$/.exec(value.trim())
  assert.ok(m, `slide px times the fit: ${value}`)
  return Number(m[1]) * fit
}
const sides = (value: string, fit: number) => {
  const [t, r = t, b = t, l = r] = (value.match(/calc\([^)]*\)\)|[^ ]+/g) ?? []).map((part) => px(part, fit))
  return { t, r, b, l }
}
const rule = (selector: string) => {
  const found = slideRules.filter((r) => r.sel === selector)
  assert.equal(found.length, 1, `slide.css has one rule for ${selector}`)
  return decls(found[0].body)
}
const para = rule(`${sel} > p`)
const lastChild = rule(`${sel} > :last-child`)
const by = rule(`${sel} > p.blk-by`)
for (const fit of [1, 0.7]) {
  const pad = sides(q.padding, fit)
  assert.equal(pad.l, 18 * fit, `18 from the bar to the words at fit ${fit}`)
  assert.equal(pad.t, 2 * fit, `the bar runs 2 above the words at fit ${fit}`)
  assert.equal(pad.b, 2 * fit, `and 2 under them at fit ${fit}`)
  assert.equal(pad.r, 0)
  const margin = sides(q.margin, fit)
  assert.deepEqual([margin.t, margin.b], [0, 12 * fit], `12 under a quote, none above, at fit ${fit}`)
  assert.deepEqual([sides(para.margin, fit).t, sides(para.margin, fit).b], [0, 6 * fit], `6 between its paragraphs at fit ${fit}`)
  assert.equal(px(by['margin-top'], fit), 10 * fit, `the attribution 10 under the words at fit ${fit}`)
  // The sizes, as the browser computes them from the flow's 24 px times the fit.
  const wordsPx: number = 24 * fit * parseFloat(q['font-size'])
  const attributionPx: number = wordsPx * parseFloat(by['font-size'])
  assert.equal(Math.round(wordsPx * 100) / 100, Math.round(25.92 * fit * 100) / 100, `the words at fit ${fit}`)
  assert.equal(Math.round(attributionPx * 100) / 100, Math.round(19.1808 * fit * 100) / 100, `the attribution at fit ${fit}`)
}
assert.equal(lastChild['margin-bottom'], '0', 'none under its last paragraph')
assert.equal(by['font-size'], '.74em')
assert.equal(by['font-weight'], '600')
assert.equal(by.color, 'var(--s-sub, #C7CAEB)', 'the attribution in the sub colour')
// Borderless (Paper): the words in the heading colour too, the attribution in the sub colour (no longer the quote's).
const hdOnWhite = slideRules.find((r) => r.sel.split(',').map((s) => s.trim()).includes('.deck-slide.is-borderless .deck-sl.is-blocks blockquote'))
assert.ok(hdOnWhite && decls(hdOnWhite.body).color === 'var(--s-hd, #1C1F4A)', 'a quote on white in the heading colour')
const subOnWhite = slideRules.find((r) => r.sel.split(',').map((s) => s.trim()).includes('.deck-slide.is-borderless .deck-sl.is-blocks blockquote > p.blk-by'))
assert.ok(subOnWhite && decls(subOnWhite.body).color === 'var(--s-sub, #5B5F86)', 'its attribution on white in the sub colour')
// Review: a bold name in the attribution keeps its quiet colour (the slide's `strong` is the heading colour), on white too.
const boldBy = slideRules.find((r) => r.sel.split(',').map((s) => s.trim()).includes(`${sel} > p.blk-by strong`))
assert.ok(boldBy && decls(boldBy.body).color === 'inherit', 'bold words in the attribution in its colour')
assert.ok(boldBy && boldBy.sel.includes('.deck-slide.is-borderless .deck-sl.is-blocks blockquote > p.blk-by strong'), 'and on white')
// Review: on the stage, a note after a quote's last paragraph (never drawn) doesn't give it its 6 px back.
assert.ok(editorRules.some((r) => r.sel === '.deck-sl.is-blocks.is-editing blockquote > :nth-last-child(1 of :not(ritemark-comment))' && decls(r.body)['margin-bottom'] === '0'), 'the stage skips a note after the last paragraph')
assert.equal(QUOTE_BY_CLASS, 'blk-by', 'the class slide.css draws is the one the renderer and the stage write')

// The selector outranks VS Code's `blockquote` and `.ProseMirror blockquote`, whatever the sheets' order.
assert.ok(beats(sel, 'blockquote'))
assert.ok(beats(sel, '.ProseMirror blockquote'))

// No other rule, in the shared sheet or the editor's own, draws a box or bar on a slide's quote again.
const boxy = /(^|;)\s*(background|border|box-shadow|outline)[\w-]*\s*:/
for (const r of [...slideRules, ...editorRules]) {
  if (!/blockquote/.test(r.sel) || r.sel === sel) continue
  assert.ok(!boxy.test(r.body), `no fill, border, shadow or outline in: ${r.sel}`)
}

// Inline code takes the slide's colour, never VS Code's `code` colour (the same leak as the quote's).
const code = slideRules.filter((r) => r.sel === '.deck-sl.is-blocks code')
assert.equal(code.length, 1)
assert.equal(decls(code[0].body).color, 'inherit')

// #863: the attribution, marked alike by the renderer (the strip, the wall, the presenter view, the page) and by the
// stage's decoration, on the same paragraph; never on a quote of that one line; the file as written, byte for byte.
const drawnBy = (markdown: string) =>
  [...blockSlideHtml(markdown).matchAll(/<p class="blk-by">([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').replace(/^&(?:mdash|#x02014);/, '—'))
const stageBy = (markdown: string) => {
  const doc = loadSlideWithComments(markdown)
  return quoteByDecorations(doc).find().map((d) => doc.nodeAt(d.from)?.textContent ?? '')
}
/** Each quote: what it is, its Markdown, the attribution drawn, and what the stage's first real edit writes when that
 * differs from the file (a soft-break attribution gets its blank `>` line then, and only then). */
const QUOTES: Array<[string, string, string[], string?]> = [
  ['an em dash under the words', '# What the team said\n\n> We used to spend Monday morning sorting the inbox.\n>\n> — Team lead, Harbour Logistics', ['— Team lead, Harbour Logistics']],
  ['an en dash', '> The replies sound like us.\n>\n> – Customer service', ['– Customer service']],
  ['two paragraphs of words, then the attribution', '> One.\n>\n> Two.\n>\n> — A. Writer', ['— A. Writer']],
  ['bold words in the attribution', '> Words\n>\n> **— A.** Writer', ['— A. Writer']],
  ['a dash written as an entity', '> Words\n>\n> &mdash; A. Writer', ['— A. Writer']],
  ['a dash written as a padded number', '> Words\n>\n> &#x02014; A. Writer', ['— A. Writer']],
  ['a list above it', '> - one\n> - two\n>\n> — A. Writer', ['— A. Writer']],
  ['a comment note after it', '> Words\n>\n> — A. Writer\n>\n> <!-- a note -->', ['— A. Writer']],
  ['in a column', ':::: columns\n::: column\n> Words\n>\n> — A\n:::\n::: column\n> Plain words\n:::\n::::', ['— A']],
  ['in a box', ':::: boxes\n::: box\n> Words\n>\n> — A\n:::\n::::', ['— A']],
  ['two quotes, one with', '> First\n>\n> — A\n\n> Second', ['— A']],
  // The Experience lead, 19 November: the last line after a line break is the attribution too ("> Words" / "> — X").
  ['a dash line after a line break', '# What the team said\n\n> We read what matters.\n> — Customer service', ['— Customer service'], '# What the team said\n\n> We read what matters.\n>\n> — Customer service'],
  ['an en dash after a hard break', '> Words  \n> – A. Writer', ['– A. Writer'], '> Words\n>\n> – A. Writer'],
  ['two lines of words, then the dash line', '> One\n> two\n> — A. Writer', ['— A. Writer'], '> One\n> two\n>\n> — A. Writer'],
  ['a dash line after a break, a note after it', '> Words\n> — A. Writer\n>\n> <!-- a note -->', ['— A. Writer'], '> Words\n>\n> — A. Writer\n>\n> <!-- a note -->'],
  ['a dash line after a break, under a paragraph', '> First.\n>\n> Words\n> — A. Writer', ['— A. Writer'], '> First.\n>\n> Words\n>\n> — A. Writer'],
  ['a dash line after a break, in a column', ':::: columns\n::: column\n> Words\n> — A\n:::\n::: column\nB\n:::\n::::', ['— A'], ':::: columns\n::: column\n> Words\n>\n> — A\n:::\n::: column\nB\n:::\n::::'],
  ['a dash line after a break under a picture (the stage opens the picture as a block)', '> ![](images/x.png)\n> — A. Writer', ['— A. Writer'], '> ![](images/x.png)\n>\n> — A. Writer'],
  ['a two-line attribution stays whole', '> Words\n>\n> — A. Writer\n> Harbour Logistics', ['— A. WriterHarbour Logistics']],
  // Never an attribution: a quote of that one line is its words (the Experience lead, 19 November).
  ['a quote of one dash line', '> — A. Writer', []],
  ['a dash line under a comment only', '> <!-- a note -->\n>\n> — A. Writer', []],
  ['a dash line under a Label of only spaces', '> [ ]{.label}\n>\n> — A. Writer', []],
  ['a hyphen', '> Words\n>\n> -- A. Writer', []],
  ['no space after the dash', '> Words\n>\n> —A. Writer', []],
  ['the dash line not last', '> — A. Writer\n>\n> Words', []],
  ['no dash', '> Words\n>\n> A. Writer', []],
  ['a dash inside the words', '> Words — and more\n>\n> words — too', []],
  ['a line break with no dash after it', '> Words\n> more words', []],
  ['a dash line after a break inside bold', '> **Words\n> — A. Writer**', []],
  ['no quote at all', '# Title\n\nWords\n\n— A line of its own', []],
]
for (const [what, markdown, expected, written] of QUOTES) {
  assert.deepEqual(drawnBy(markdown), expected, `the renderer: ${what}`)
  assert.deepEqual(stageBy(markdown), expected, `the stage: ${what}`)
  // The file is never touched by the look: the slide editor writes it back as written (an entity is written as the
  // character it draws, and a Label of only spaces as `[]{.label}`, as before #863).
  if (!markdown.includes('&') && !markdown.includes('[ ]{.label}')) assert.equal(saveSlideWithComments(loadSlideWithComments(markdown)), written ?? markdown, `as the stage writes it: ${what}`)
  // An untouched slide writes back byte for byte, whatever the stage opened it as (`SlideSync`: its first content).
  const load = (text: string) => loadSlideWithComments(text)
  const sync = new SlideSync(load, (doc) => saveSlideMarkdown(doc, editorHTML(doc), load), markdown, load(markdown))
  assert.equal(sync.markdownOf(load(markdown)), markdown, `untouched, byte for byte: ${what}`)
  if (written) {
    // The first real edit writes the blank `>` line, and the slide reads back the same.
    const doc = load(markdown)
    let end = -1
    doc.descendants((node, pos) => { if (end < 0 && node.isTextblock && node.textContent) end = pos + node.nodeSize - 1 })
    const edited = EditorState.create({ doc }).apply(EditorState.create({ doc }).tr.insertText('!', end)).doc
    const saved = sync.markdownOf(edited)
    assert.notEqual(saved, markdown, `an edit writes: ${what}`)
    // (The edit may land in the attribution itself: compare the lines' count and the two sides.)
    assert.equal(stageBy(saved).length, expected.length, `and reads back with its attribution: ${what}`)
    assert.deepEqual(drawnBy(saved), stageBy(saved), `and draws so: ${what}`)
    assert.ok(/\n>\n> [—–] /.test(saved), `with the blank line before the attribution: ${what}`)
  }
}
// A quote with no attribution, and a slide with no quote, draw exactly as marked draws them.
assert.equal(blockSlideHtml('> One\n>\n> Two'), '<blockquote>\n<p>One</p>\n<p>Two</p>\n</blockquote>\n')
assert.equal(blockSlideHtml('> — A. Writer'), '<blockquote>\n<p>— A. Writer</p>\n</blockquote>\n')
assert.equal(blockSlideHtml('> Words\n>\n> — A'), '<blockquote>\n<p>Words</p>\n<p class="blk-by">— A</p>\n</blockquote>\n')
assert.ok(isQuoteByWords('— A') && isQuoteByWords('– A') && !isQuoteByWords('- A') && !isQuoteByWords('—A') && !isQuoteByWords(' — A'))

// Typed on the stage: the class comes and goes with the words, live.
{
  const doc = loadSlideWithComments('> Words\n>\n> A. Writer')
  let at = -1
  doc.descendants((node, pos) => { if (node.isText && node.text === 'A. Writer') at = pos })
  const typed = EditorState.create({ doc }).apply(EditorState.create({ doc }).tr.insertText('— ', at)).doc
  assert.deepEqual(quoteByDecorations(typed).find().map((d) => typed.nodeAt(d.from)?.textContent), ['— A. Writer'])
  assert.equal(quoteByDecorations(doc).find().length, 0)
}

console.log(`slideQuote: ok (${QUOTES.length} quotes drawn alike by the renderer and the stage)`)
