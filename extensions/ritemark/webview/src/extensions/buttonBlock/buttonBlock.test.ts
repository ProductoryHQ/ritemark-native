/**
 * Sprint 163 PR 3 (the decks README, "The Button block"). Run with `npx tsx` (part of `test:decks`).
 *
 *  - the format: a paragraph ending with `[words](https://…){.button}` opens as a Button block and saves back byte for
 *    byte, on a slide, in a deck's handout and in a Text document; an edit writes only its own line;
 *  - https only, everywhere: the address check, the sheet's Done, the renderer (the strip, the wall), the page, the
 *    wall's request and the host's deck check never let `javascript:`, `data:`, `file:` or `http:` through;
 *  - the icon follows the address;
 *  - the hidden words find Button in both / menus, after Table.
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { createDocument } from '@mixmark-io/domino'
import { canonicalMarkdownProjection } from '../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../src/editorSync/frontMatter'
import { BUTTON_WORDS, buttonAddressOf, buttonIconOf, buttonParagraphOf, isButtonAddress, isButtonAttributes } from '../../../../src/decks/blocks/buttonBlock'
import { blockButtonAddresses, blockSlideHtml, lexBlockSlide } from '../../../../src/decks/blocks/slideRenderer'
import { deckButtonAddresses } from '../../../../src/decks/deckButtons'
import { decodeWallRequest } from '../../../../src/decks/present/presentProtocol'
import { handoutHtml } from '../../../../src/decks/page/pageHtml'
import { createEditorSchemaExtensions, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument, openDocument, saveDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from '../../components/decks/handout/deckSchema'
import { loadSlide, saveSlide } from '../../components/decks/blocks/slideEditorHarness'
import { SLIDE_ITEMS } from '../../components/decks/blocks/slideCommands'
import { blockItems, filterSlashItems } from '../blockItems'
import { BUTTON_NODE, buttonAt, buttonBackspace, buttonDelete, buttonEnter, deleteButton, insertButton, labelEnd, setButtonAddress } from './buttonCommands'
import type { Tokens } from 'marked'

installTestDocument()

const DANGEROUS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  ' javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'http://example.com/a.pdf',
  'HTTP://example.com',
  'https:example.com',
  'https:/example.com',
  'https://',
  'https://user:secret@example.com/',
  'https://exa mple.com',
  'https://example.com/\njavascript:alert(1)',
  '//example.com/a.pdf',
  'files/report.pdf',
  'vbscript:msgbox(1)',
  '',
]

// ---------------------------------------------------------------------------
// The address: full https only
// ---------------------------------------------------------------------------

for (const address of DANGEROUS) assert.equal(isButtonAddress(address), false, `refused: ${JSON.stringify(address)}`)
for (const address of [
  'https://fernhollow.sharepoint.com/:b:/s/training/EaBc123?e=xyz',
  'https://drive.google.com/file/d/1AbC/view?usp=sharing',
  'https://example.com',
  'HTTPS://example.com/a.pdf',
  'https://example.com/a%20b.pdf#page=3',
]) assert.equal(isButtonAddress(address), true, `accepted: ${address}`)
assert.equal(isButtonAddress('https://example.com/' + 'a'.repeat(3000)), false, 'too long to be an address')
assert.equal(buttonAddressOf('  https://example.com/a.pdf  '), 'https://example.com/a.pdf', 'the typed address, trimmed')
assert.equal(buttonAddressOf('http://example.com'), null)
assert.equal(BUTTON_WORDS.refused, 'Use a full address that starts with https://')
assert.equal(BUTTON_WORDS.hint, 'A full address, such as a SharePoint or Drive link. It opens in a new tab.')

// ---------------------------------------------------------------------------
// The icon follows the address
// ---------------------------------------------------------------------------

const ICONS: Array<[string, 'file' | 'link']> = [
  ['https://example.com/files/annual-report-2025.pdf', 'file'],
  ['https://example.com/files/REPORT.PDF?download=1', 'file'],
  ['https://example.com/a/inbox-ten-emails.docx', 'file'],
  ['https://example.com/a/old.doc', 'file'],
  ['https://example.com/a/budget.xlsx', 'file'],
  ['https://example.com/a/budget.xls#Sheet2', 'file'],
  ['https://example.com/a/deck.pptx', 'file'],
  ['https://example.com/a/materials.zip', 'file'],
  ['https://example.com/a/my%20report.pdf', 'file'],
  ['https://fernhollow.sharepoint.com/:w:/s/training/EaBc?e=1', 'file'],
  ['https://fernhollow.sharepoint.com/:x:/g/personal/x/EaBc', 'file'],
  ['https://fernhollow.sharepoint.com/:p:/s/training/EaBc', 'file'],
  ['https://fernhollow.sharepoint.com/:b:/s/training/EaBc', 'file'],
  ['https://fernhollow.sharepoint.com/:f:/s/training/EaBc', 'link'],
  ['https://fernhollow.sharepoint.com/sites/training', 'link'],
  ['https://docs.google.com/document/d/1AbC/edit', 'link'],
  ['https://forms.office.com/r/abc', 'link'],
  ['https://example.com/pdf', 'link'],
  ['https://example.com/report.pdf.html', 'link'],
  ['https://example.com/?file=report.pdf', 'link'],
  ['not an address', 'link'],
]
for (const [address, kind] of ICONS) assert.equal(buttonIconOf(address), kind, `icon of ${address}`)
assert.equal(buttonIconOf(null), 'link')

// ---------------------------------------------------------------------------
// Reading a button paragraph
// ---------------------------------------------------------------------------

const firstParagraph = (markdown: string) => lexBlockSlide(markdown).find(token => token.type === 'paragraph') as Tokens.Paragraph
{
  const read = buttonParagraphOf(firstParagraph('No report of your own? Use **the bank\'s** report. [Open the sample](https://example.com/a.pdf){.button}').tokens)
  assert.ok(read)
  assert.equal(read.label, 'Open the sample')
  assert.equal(read.href, 'https://example.com/a.pdf')
  assert.equal(read.sep, ' ')
  assert.equal(read.attrs, '{.button}')
  assert.equal(read.words.map(token => token.raw).join(''), 'No report of your own? Use **the bank\'s** report.')
}
assert.equal(buttonParagraphOf(firstParagraph('[Open](https://example.com){.button} and more').tokens), null, 'words after it: a link')
assert.equal(buttonParagraphOf(firstParagraph('[Open](https://example.com){.btn}').tokens), null, 'another class: a link')
assert.equal(buttonParagraphOf(firstParagraph('[**Open**](https://example.com){.button}').tokens), null, 'marked-up words: a link')
assert.equal(buttonParagraphOf(firstParagraph('[Open][ref]{.button}\n\n[ref]: https://example.com').tokens), null, 'a reference: a link')
assert.equal(buttonParagraphOf(firstParagraph('<https://example.com>{.button}').tokens), null, 'an autolink: no button')
assert.equal(buttonParagraphOf(firstParagraph('[Open](https://example.com) {.button}').tokens), null, 'a space before the block: a link')
assert.equal(buttonParagraphOf(firstParagraph('[A &amp; B](https://example.com){.button}').tokens)?.label, 'A & B', 'the words as read')
assert.ok(isButtonAttributes('{.button}'))
assert.ok(isButtonAttributes('{.button .btn-lg target="_blank"}'))
assert.ok(isButtonAttributes('{#get .button}'))
assert.ok(!isButtonAttributes('{.buttons}'))
assert.ok(!isButtonAttributes('{button}'))

// ---------------------------------------------------------------------------
// The format: byte for byte, in a Text document, on a slide and in a deck's handout
// ---------------------------------------------------------------------------

const FORMS = [
  '[Open the sample](https://fernhollow.sharepoint.com/:b:/s/training/EaBc123?e=xyz){.button}',
  "**No report of your own?** Use the bank's 2025 annual report (PDF, 38 pages). [Open the sample](https://example.com/files/annual-report-2025.pdf){.button}",
  'The emails are in the shared folder.\n[Open the emails](https://example.com/inbox.docx){.button}',
  'Two lines of words,  \nthe second here. [Open](https://example.com){.button .btn-lg}',
  '[Open](<https://example.com/a b.pdf> "The sample"){.button}',
  '[Open (PDF)](https://example.com/a_(1).pdf){#sample .button}',
  '[](){.button}',
  '[Open](javascript:alert(1)){.button}',
  // Review: nothing between the words and the link stays nothing.
  'Word.[Open](https://example.com/a.pdf){.button}',
  '**Bold**[Open](https://example.com/a.pdf){.button}',
  '> Quoted words. [Open](https://example.com/a.pdf){.button}',
]

// Review: a space after the block is the line's, not the button's (many editors leave one); it is still a button,
// drawn as one, and the editor's save drops the line's trailing space as it does for every paragraph.
{
  const html = blockSlideHtml('[Open](https://example.com/a.pdf){.button} \t')
  assert.match(html, /class="blk-button is-solo"/, 'a trailing space: still a button')
  assert.ok(!/\{\.button\}/.test(html))
  assert.equal(saveDocument(openDocument('[Open](https://example.com/a.pdf){.button}  \n')), '[Open](https://example.com/a.pdf){.button}\n')
}

// Review: an empty address draws the page icon on the stage and wherever the slide is drawn (one rule, `buttonIconFor`).
{
  const unset = blockSlideHtml('[Open](){.button}')
  assert.match(unset, /M213\.66,82\.34/, 'no address yet: the page, as the editor draws it')
  const doc = loadSlide('[Open](){.button}')
  let icon: string | null = null
  doc.descendants(node => { if (node.type.name === BUTTON_NODE) icon = (node.type.spec.toDOM!(node) as unknown as [string, Record<string, string>])[1]['data-icon'] })
  assert.equal(icon, 'file')
}

// Review: a button in a quote is a button on the published page too.
assert.match(handoutHtml('> Quoted words. [Open](https://example.com/a.pdf){.button}', { partKey: 'p', exercise: false, pictureUrl: () => null }), /<blockquote>\n<div class="blk-button pbutton"><p class="blk-button-words">Quoted words\.<\/p><a class="blk-btn" href="https:\/\/example\.com\/a\.pdf"/)

// Review: `/button` in a table cell of a Text document puts the button after the table, never nothing.
{
  const opened = openDocument('| A | B |\n| --- | --- |\n| one | two |\n')
  let cell = -1
  opened.doc.descendants((node, pos) => { if (cell < 0 && node.type.name === 'paragraph' && node.textContent === 'two') cell = pos + 2 })
  const state = EditorState.create({ doc: opened.doc })
  const tr = insertButton(state.tr, cell)
  assert.ok(tr.docChanged, 'a button was put in')
  assert.equal(tr.doc.lastChild?.type.name, BUTTON_NODE, 'after the table')
  assert.equal(buttonAt(EditorState.create({ doc: tr.doc, selection: tr.selection }))?.pos, tr.doc.content.size - tr.doc.lastChild!.nodeSize)
}

for (const form of FORMS) {
  // A Text document.
  const text = `# Material\n\n${form}\n\nAfter it.\n`
  const opened = openDocument(text)
  assert.equal(saveDocument(opened), text, `Text document, byte for byte: ${form}`)
  let buttons = 0
  opened.doc.descendants(node => { if (node.type.name === BUTTON_NODE) buttons++ })
  assert.equal(buttons, 1, `opens as a button: ${form}`)
  // A slide, alone and in a column.
  assert.equal(saveSlide(loadSlide(`# Exercise\n${form}`)), `# Exercise\n${form}`, `slide, byte for byte: ${form}`)
  const columns = `# Exercise\n\n:::: columns\n\n::: column\n1. Step one\n:::\n\n::: column\n${form}\n:::\n\n::::`
  assert.equal(saveSlide(loadSlide(columns)), columns, `a column's button, byte for byte: ${form}`)
}

// A deck's handout (the Text editor with the deck's nodes), and a slide's button in its block, both byte for byte.
{
  const deckSchema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
  const parse = (markdown: string): PMNode => {
    const body = createDocument(`<body>${markdownToEditorHTML(markdown)}</body>`).body as unknown as HTMLElement
    return PMDOMParser.fromSchema(deckSchema).parse(body, { preserveWhitespace: 'full' })
  }
  const deck = [
    '---',
    'deck: 2',
    '---',
    '',
    '```slide',
    '# Exercise',
    '',
    "No report of your own? [Open the sample](https://example.com/a.pdf){.button}",
    '```',
    '',
    'The handout: the sample is here too.',
    '',
    '[Open the sample](https://example.com/a.pdf){.button}',
    '',
  ].join('\n')
  const split = splitFrontMatter(deck)
  const doc = parse(canonicalMarkdownProjection(split.content))
  let inHandout = 0
  doc.descendants(node => { if (node.type.name === BUTTON_NODE) inHandout++ })
  assert.equal(inHandout, 1, "the handout's button opens as a button (the slide's stays the slide's)")
  assert.equal(joinFrontMatter(JSON.parse(JSON.stringify(split.properties)), editorMarkdown(doc), deck), deck, 'a deck with buttons: byte for byte')
  // The host reads the deck's buttons from its slides only (the wall draws the slides).
  assert.deepEqual([...deckButtonAddresses(deck)], ['https://example.com/a.pdf'])
}

// An edit writes only its own line: a new address, then the button's words.
{
  const markdown = '# Exercise\nUse the sample. [Open](https://example.com/a.pdf){.button}\n\nAfter.'
  const doc = loadSlide(markdown)
  let pos = -1
  doc.descendants((node, at) => { if (node.type.name === BUTTON_NODE) pos = at })
  const state = EditorState.create({ doc })
  for (const bad of DANGEROUS.filter(Boolean)) assert.equal(setButtonAddress(state, pos, bad), null, `Done refuses ${JSON.stringify(bad)}`)
  const tr = setButtonAddress(state, pos, ' https://example.com/b (1).pdf ')
  assert.equal(tr, null, 'a space inside: refused')
  const moved = setButtonAddress(state, pos, 'https://example.com/b.pdf')!
  assert.equal(saveSlide(moved.doc), '# Exercise\nUse the sample. [Open](https://example.com/b.pdf){.button}\n\nAfter.')
  assert.equal(moved.selection.from, labelEnd(moved.doc.nodeAt(pos)!, pos), "Done puts the caret on the button's words")
  const typed = EditorState.create({ doc: moved.doc, selection: TextSelection.create(moved.doc, moved.selection.from) })
  const more = typed.tr.insertText(' it')
  assert.equal(saveSlide(more.doc), '# Exercise\nUse the sample. [Open it](https://example.com/b.pdf){.button}\n\nAfter.')
  // Empty: the address stays, the caret moves.
  const kept = setButtonAddress(state, pos, '   ')!
  assert.equal(saveSlide(kept.doc), markdown)
  // Delete: the button goes; an undo (the inverse) brings it back.
  const gone = deleteButton(state, pos)!
  assert.equal(saveSlide(gone.doc), '# Exercise\n\nAfter.')
  assert.equal(saveSlide(gone.steps[0].invert(state.doc).apply(gone.doc).doc!), markdown)
}

// A new button from the / menu: where the / was, its sheet asked for, its words written as a new paragraph.
{
  const doc = loadSlide('# Exercise\n\nText')
  const state = EditorState.create({ doc })
  const tr = state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create())
  const at = tr.doc.content.size - 1
  insertButton(tr, at)
  assert.equal(tr.getMeta('buttonAskAddress'), true, 'the sheet opens at once')
  const placed = buttonAt(EditorState.create({ doc: tr.doc, selection: tr.selection }))
  assert.ok(placed, 'the caret is in the new button')
  assert.equal(saveSlide(tr.doc), '# Exercise\n\nText\n\n[](){.button}')
  const named = setButtonAddress(EditorState.create({ doc: tr.doc, selection: tr.selection }), placed.pos, 'https://example.com/a.pdf')!
  const label = EditorState.create({ doc: named.doc, selection: named.selection }).tr.insertText('Open the sample')
  assert.equal(saveSlide(label.doc), '# Exercise\n\nText\n\n[Open the sample](https://example.com/a.pdf){.button}')
}

// The keys: Enter in the button's words ends them; the block's two parts never join.
{
  const doc = loadSlide('Words. [Open](https://example.com){.button}')
  let pos = -1
  doc.descendants((node, at) => { if (node.type.name === BUTTON_NODE) pos = at })
  const node = doc.nodeAt(pos)!
  const inLabel = EditorState.create({ doc, selection: TextSelection.create(doc, labelEnd(node, pos)) })
  const entered = buttonEnter(inLabel)!
  assert.equal(entered.doc.lastChild?.type.name, 'paragraph', 'Enter on the button: a new line after it')
  assert.equal(entered.selection.$from.parent.type.name, 'paragraph')
  const labelStart = labelEnd(node, pos) - node.child(1).content.size
  const atLabelStart = EditorState.create({ doc, selection: TextSelection.create(doc, labelStart) })
  const back = buttonBackspace(atLabelStart)
  assert.ok(back && back !== 'stop')
  assert.equal(back.selection.$from.parent.type.name, 'buttonWords', 'Backspace at the button: to the words beside it')
  assert.equal(saveSlide(back.doc), 'Words. [Open](https://example.com){.button}', 'nothing joins')
  const wordsEnd = EditorState.create({ doc, selection: TextSelection.create(doc, pos + 1 + node.child(0).nodeSize - 1) })
  const forward = buttonDelete(wordsEnd)
  assert.ok(forward && forward !== 'stop')
  assert.equal(forward.selection.$from.parent.type.name, 'buttonLabel', 'Delete at the words: on to the button')
  const inWords = EditorState.create({ doc, selection: TextSelection.create(doc, pos + 2) })
  assert.equal(buttonEnter(inWords)!.selection.$from.parent.type.name, 'buttonLabel', 'Enter beside it: on to the button')
}

// ---------------------------------------------------------------------------
// Drawn: the renderer (the strip, the wall, the presenter view) and the page
// ---------------------------------------------------------------------------

{
  const html = blockSlideHtml('# Exercise\nUse **this**. [Open the sample](https://example.com/a.pdf){.button}')
  assert.match(html, /<div class="blk-button"><p class="blk-button-words">Use <strong>this<\/strong>\.<\/p><span class="blk-btn" role="link" data-href="https:\/\/example\.com\/a\.pdf" tabindex="-1">/)
  assert.ok(!/<a\b/.test(html), 'on the wall and the strip: no link the window would follow')
  assert.match(html, /<span class="blk-btn-text">Open the sample<\/span>/)
  const page = blockSlideHtml('[Open](https://example.com/a.pdf?x=1&y="2"){.button}', { buttonLinks: true })
  assert.match(page, /<div class="blk-button is-solo"><a class="blk-btn" href="https:\/\/example\.com\/a\.pdf\?x=1&amp;y=&quot;2&quot;" target="_blank" rel="noopener noreferrer" tabindex="-1">/, 'the page: a real link, escaped, to a new tab')
  assert.match(page, /M213\.66,82\.34/, "a file's page icon")
  const link = blockSlideHtml('[Open](https://forms.office.com/r/abc){.button}', { buttonLinks: true })
  assert.match(link, /M200,64V168/, 'any other address: the arrow out')
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'http://example.com', 'https:example.com', 'vbscript:x']) {
    for (const drawn of [blockSlideHtml(`[Open](${bad}){.button}`), blockSlideHtml(`[Open](${bad}){.button}`, { buttonLinks: true }), handoutHtml(`[Open](${bad}){.button}`, { partKey: 'p', exercise: false, pictureUrl: () => null })]) {
      assert.ok(!/href=|data-href=/.test(drawn), `never drawn as a link: ${bad} → ${drawn}`)
      assert.match(drawn, /blk-btn is-unset/, `an inert button: ${bad}`)
    }
  }
  // The label's words are escaped wherever it is drawn.
  const sneaky = blockSlideHtml('[<img src=x onerror=alert(1)>](https://example.com){.button}', { buttonLinks: true })
  assert.ok(!/<img/.test(sneaky), 'no tag from the words')
  assert.deepEqual(blockButtonAddresses('[A](https://example.com/a){.button}\n\n:::: columns\n::: column\n[B](https://example.com/b){.button}\n:::\n::::\n\n[C](http://example.com/c){.button}\n\n[D](https://example.com/d)'), ['https://example.com/a', 'https://example.com/b'])
}

{
  const page = handoutHtml('Use the sample.\n\n**No report?** Use ours. [Open the sample](https://example.com/a.pdf){.button}', { partKey: 'p', exercise: false, pictureUrl: () => null })
  assert.match(page, /<div class="blk-button pbutton"><p class="blk-button-words"><strong>No report\?<\/strong> Use ours\.<\/p><a class="blk-btn" href="https:\/\/example\.com\/a\.pdf" target="_blank" rel="noopener noreferrer">/)
}

// ---------------------------------------------------------------------------
// The wall's request and the host's check
// ---------------------------------------------------------------------------

assert.deepEqual(decodeWallRequest({ type: 'present/open-link', url: 'https://example.com/a.pdf' }), { type: 'present/open-link', url: 'https://example.com/a.pdf' })
for (const bad of DANGEROUS) assert.equal(decodeWallRequest({ type: 'present/open-link', url: bad }), null, `the wall can't ask for ${JSON.stringify(bad)}`)
assert.equal(decodeWallRequest({ type: 'present/open-link', url: 'https://example.com', extra: 1 }), null)
assert.equal(decodeWallRequest({ type: 'present/open-link', url: 42 }), null)
{
  const deck = '---\ndeck: 2\n---\n\n````slide\n# A\n[Open](https://example.com/a.pdf){.button}\n````\n\n[Handout only](https://example.com/h.pdf){.button}\n'
  const addresses = deckButtonAddresses(deck)
  assert.ok(addresses.has('https://example.com/a.pdf'))
  assert.ok(!addresses.has('https://example.com/h.pdf'), "the wall never draws the handout's buttons")
  assert.ok(!addresses.has('https://evil.example.com/'))
}

// ---------------------------------------------------------------------------
// The / menus: Button in Blocks after Table, found by its hidden words
// ---------------------------------------------------------------------------

{
  const blocks = SLIDE_ITEMS.filter(item => item.group === 'Blocks').map(item => item.title)
  assert.ok(blocks.indexOf('Button') === blocks.indexOf('Table') + 1, `Button after Table: ${blocks.join(', ')}`)
  const textTitles = blockItems.map(item => item.title)
  assert.ok(textTitles.indexOf('Button') === textTitles.indexOf('Table') + 1, 'the Text editor: Button after Table')
  for (const word of ['link', 'file', 'material', 'download', 'nupp', 'fail', 'materjal', 'button', 'butt']) {
    assert.ok(filterSlashItems(SLIDE_ITEMS, word).some(item => item.title === 'Button'), `/${word} finds Button on a slide`)
    assert.ok(filterSlashItems(blockItems, word).some(item => item.title === 'Button'), `/${word} finds Button in a Text document`)
  }
  assert.equal(filterSlashItems(SLIDE_ITEMS, 'nupp')[0].title, 'Button')
}

console.log('buttonBlock: all passed')
