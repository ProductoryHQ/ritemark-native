/**
 * Sprint 161 (PR 2): a deck of today's slides is converted to block slides at its first real edit, in one transaction
 * with that edit, and one Undo gives the file back byte for byte. Opening writes nothing. The old notes and the words a
 * layout kept hidden become one comment at the end of their part, which never reaches the page.
 * Run with `npx tsx webview/src/components/decks/handout/deckConvert.test.ts`.
 *
 * The editor's own pieces as the deck view runs them: the deck's schema with comments, the history, the guard, the
 * drawn headings, the line's plugin and the conversion's, and the save through the editor's own Markdown pipeline.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Plugin, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo, redo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { slideDataOf, withWrittenHandout } from '../../../../../src/decks/deckFormat'
import { slideStamp, slideStamps } from '../../../../../src/decks/deckLibraryFormat'
import { convertDeckText } from '../../../../../src/decks/blocks/convertDeck'
import { publicDeck } from '../../../../../src/decks/page/publicDeck'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from './deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from './drawnHeadings'
import { deckGuardPlugin } from './deckGuard'
import { deckLinesPlugin } from './deckLines'
import { CONVERSION_NOTICE, commentNodeAt, conversionNoticeFor, pictureIntoSlide, handoutMarkdownOf, convertDeckInto, conversionStateOf, deckConvertPlugin, needsConversion } from './deckConvert'
import { derivedHeadings, slidesOf } from '../deckDocument'

installTestDocument()
ensureCommentMarkedPipeline()
const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

const DECK = [
  '---',
  'deck: 1',
  'theme: Slide library/Themes/Evening.theme.md',
  '---',
  '',
  '```slide title',
  'id: t1',
  'title: Harbour training',
  'subtitle: Three hours',
  'items:',
  '- heading: TITLEITEMWORD',
  '```',
  '',
  '```notes',
  'NOTESWORD: say hello first. --> not the end',
  '```',
  '',
  'Welcome to the day.',
  '',
  '```slide columns',
  'id: c2',
  'title: Two tools',
  'items:',
  '- heading: Copilot',
  '  text: Mail and documents',
  '- heading: Cursor',
  '  text: Code and files',
  '- heading: THIRDCOLUMNWORD',
  '```',
  '',
  'Compare them.',
  '',
  '```slide points',
  'id: p3',
  'title: The steps',
  'items:',
  '- heading: 1. Sisend',
  '- heading: 2. Väljund',
  '```',
  '',
  'Last words.',
  '',
  '```slide gamma.v2',
  'title: From elsewhere',
  '```',
  '',
  '```notes',
  'UNKNOWNNOTES',
  '```',
  '',
].join('\n')

const PRIVATE = ['NOTESWORD', 'TITLEITEMWORD', 'THIRDCOLUMNWORD', 'UNKNOWNNOTES']

function stateOf(text: string, plugins: Plugin[]): { state: EditorState; save: (doc: PMNode) => string; body: (doc: PMNode) => string } {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  let state = EditorState.create({ doc, plugins })
  // The deck view draws the parts' headings from the slides' titles as it opens (never an edit).
  const drawn = derivedHeadings(state)
  if (drawn) state = state.apply(drawn)
  return { state, save: next => joinFrontMatter(properties, editorMarkdown(next), text), body: next => editorMarkdown(next) }
}

const drawnPlugin = () => new Plugin({ appendTransaction: (transactions, _old, next) => drawnHeadingsFollow(transactions, next) })
const deckPlugins = () => [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin()]

/** The end of the first paragraph whose words are `words`. */
function endOf(doc: PMNode, words: string): number {
  let at = -1
  doc.descendants((node, pos) => {
    if (at < 0 && node.type.name === 'paragraph' && node.textContent === words) at = pos + node.nodeSize - 1
    return at < 0
  })
  assert.ok(at > 0, words)
  return at
}

const apply = (state: EditorState, tr: Transaction) => state.apply(tr)

// ---- Opening writes nothing: the deck as opened, its headings drawn, saves byte for byte, and nothing is converted.
{
  const { state, save } = stateOf(DECK, deckPlugins())
  assert.equal(save(state.doc), DECK, 'opened and saved: byte for byte')
  assert.equal(needsConversion(state.doc), true)
  assert.equal(conversionStateOf(state).count, 0)
}

// ---- The first real edit (typing in the handout) converts the whole deck in the same transaction; one Undo gives the
// file back byte for byte, and Redo the conversion again.
{
  const { state, save, body } = stateOf(DECK, deckPlugins())
  const typed = state.tr.insertText('!', endOf(state.doc, 'Compare them.'))
  const after = apply(state, typed)
  const slides = slidesOf(after.doc)
  assert.deepEqual(slides.map(slide => slide.kind), ['', '', '', 'gamma.v2'], 'every slide of the nine kinds is a block slide; a kind this build doesn\'t know stays')
  assert.equal(slides[3].node.attrs.notes, 'UNKNOWNNOTES', 'and keeps its notes')
  assert.ok(slides.slice(0, 3).every(slide => slide.node.attrs.notes === null), 'no notes block on a block slide')
  assert.equal(conversionStateOf(after).count, 1)
  assert.deepEqual(conversionStateOf(after).last, { slides: 3, comments: 2, firstComment: 'NOTESWORD: say hello first. --› not the end\nHidden by the old layout: TITLEITEMWORD' })
  // Their Markdown is what the stage drew before the edit (legacyToBlocks): "1. 1." numbers as a real list.
  assert.equal(slideDataOf('', slides[2].node.attrs.body).markdown, '# The steps\n\n1. Sisend\n2. Väljund')
  assert.equal(slideDataOf('', slides[0].node.attrs.body).id, 't1', 'the header keeps the id')

  // Byte for byte what the host's converter writes for the same edit, front matter aside (the deck view writes
  // `deck: 2` and `handout: text` into the front matter in the same change).
  const plain = stateOf(DECK, [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin()])
  const edited = apply(plain.state, plain.state.tr.insertText('!', endOf(plain.state.doc, 'Compare them.')))
  const expected = splitFrontMatter(convertDeckText(withWrittenHandout(plain.save(edited.doc)))).content
  assert.equal(body(after.doc).trim(), expected.trim(), 'the view writes what the converter writes')

  // The comments: one at the end of each part that had notes or hidden words, `-->` made harmless.
  const saved = save(after.doc)
  assert.ok(saved.includes('Welcome to the day.\n\n<!-- NOTESWORD: say hello first. --› not the end\nHidden by the old layout: TITLEITEMWORD -->\n\n```slide'), saved)
  assert.ok(saved.includes('Compare them.!\n\n<!-- Hidden by the old layout: THIRDCOLUMNWORD -->\n\n```slide'), saved)
  // None of it reaches the page.
  const page = JSON.stringify(publicDeck(saved, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  for (const word of PRIVATE) assert.ok(!page.includes(word), `${word} reached the page`)
  assert.ok(page.includes('Copilot') && page.includes('Sisend'), 'the slides\' words go')

  let undone = after
  undo(after, tr => { undone = after.apply(tr) })
  assert.equal(save(undone.doc), DECK, 'one Undo: the file as it was, byte for byte')
  assert.equal(needsConversion(undone.doc), true)
  let redone = undone
  redo(undone, tr => { redone = undone.apply(tr) })
  assert.equal(body(redone.doc), body(after.doc), 'Redo: converted again')
}

// ---- The stage's write (SlideEditor): the conversion and the slide's new Markdown in one transaction.
{
  const { state, save } = stateOf(DECK, deckPlugins())
  const tr = state.tr
  const entry = slidesOf(state.doc)[1]
  assert.ok(convertDeckInto(tr))
  const pos = tr.mapping.map(entry.pos)
  const node = tr.doc.nodeAt(pos)!
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: node.attrs.body.replace('# Two tools', '# Two tools, typed') })
  const after = state.apply(tr)
  assert.equal(conversionStateOf(after).count, 1, 'converted once: the plugin adds nothing more')
  assert.ok(save(after.doc).includes('# Two tools, typed'))
  let undone = after
  undo(after, back => { undone = after.apply(back) })
  assert.equal(save(undone.doc), DECK, 'one Undo')
}

// ---- Not conversions: a host revision, a change of the selection, the view's drawn headings.
{
  const { state } = stateOf(DECK, deckPlugins())
  const moved = state.apply(state.tr.setSelection(TextSelection.create(state.doc, endOf(state.doc, 'Last words.'))))
  assert.equal(needsConversion(moved.doc), true, 'a caret move converts nothing')
  const host = state.apply(state.tr.insertText('!', endOf(state.doc, 'Last words.')).setMeta('ritemarkDocumentRevision', 3).setMeta('addToHistory', false))
  assert.equal(needsConversion(host.doc), true, 'the host\'s revision converts nothing')
  const quiet = state.apply(state.tr.insertText('!', endOf(state.doc, 'Last words.')).setMeta('preventUpdate', true))
  assert.equal(needsConversion(quiet.doc), true, 'a change made without an update (setContent) converts nothing')
}

// ---- A deck of block slides only: an edit converts nothing, and nothing is added.
{
  const blocks = '---\ndeck: 2\nhandout: text\n---\n\n```slide\n---\nid: b1\n---\n# Already blocks\n```\n\n## Already blocks\n\nText.\n'
  const { state, save } = stateOf(blocks, deckPlugins())
  assert.equal(save(state.doc), blocks)
  const after = state.apply(state.tr.insertText('!', endOf(state.doc, 'Text.')))
  assert.equal(conversionStateOf(after).count, 0)
  assert.equal(save(after.doc), blocks.replace('Text.', 'Text.!'))
}

// ---- Without the comment node (the comment-callouts kill switch), the private words stay in a notes block.
{
  const bare = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
  const doc = bare.nodes.doc.create(null, [
    bare.nodes.deckSlide.create({ kind: 'columns', body: 'id: c1\ntitle: T\nitems:\n- heading: A\n- heading: B\n- heading: HIDDEN', notes: 'MYNOTES' }),
    bare.nodes.paragraph.create(null, bare.text('Part.')),
  ])
  const tr = EditorState.create({ doc }).tr
  assert.ok(convertDeckInto(tr))
  const slide = slidesOf(tr.doc)[0]
  assert.equal(slide.kind, '')
  assert.equal(slide.node.attrs.notes, 'MYNOTES\nHidden by the old layout: HIDDEN')
  assert.equal(tr.doc.childCount, 2, 'no comment node')
}

// ---- A library copy still as it was copied gets the block stamp (its stamp counts its handout), so it never reads as
// changed after the conversion; a changed copy keeps its stamp.
{
  const handout = '## Copy\n\nThe copy\'s words.'
  const data = { id: 'k1', title: 'Copy', items: [{ heading: 'One' }] }
  const oldStamp = slideStamps('points', data, handout, '')[1]
  const fresh = slideStamp('points', data, handout, '')
  assert.notEqual(oldStamp, fresh, 'precondition: an older v1 stamp')
  const deck = (stamp: string) => `---\ndeck: 1\nhandout: text\n---\n\n\`\`\`slide points\nid: k1\ntitle: Copy\nfrom: Slide library/A.deck.md#a1 @${stamp}\nitems:\n- heading: One\n\`\`\`\n\n${handout}\n\n\`\`\`slide points\nid: k2\ntitle: Own\n\`\`\`\n\n## Own\n\nOwn words.\n`
  for (const [stamp, expected] of [[oldStamp, fresh], ['zzzzzz', 'zzzzzz']] as const) {
    const { state } = stateOf(deck(stamp), deckPlugins())
    const first = slidesOf(state.doc)[0]
    assert.equal(handoutMarkdownOf(state.doc, first.pos + first.node.nodeSize, slidesOf(state.doc)[1].pos), handout, 'the part\'s handout, as the file has it')
    // The first edit is in another part: the copy itself is as it was copied.
    const after = state.apply(state.tr.insertText('!', endOf(state.doc, 'Own words.')))
    const from = slideDataOf('', slidesOf(after.doc)[0].node.attrs.body).from ?? ''
    assert.equal(from.split('@')[1], expected, stamp === 'zzzzzz' ? 'a changed copy keeps its stamp' : 'renewed to the block stamp')
  }
}

// ---- A picture put onto a v1 slide shown as blocks (review of #765): the deck converts in the same step and the picture
// is a block at the end of that slide's words, every point of it kept on the slide; one Undo gives the file back. On a
// slide with a picture beside it, the picture takes that place.
{
  const { state, save } = stateOf(DECK, deckPlugins())
  const tr = pictureIntoSlide(state, 'p3', 'images/new shot.png')!
  const after = state.apply(tr)
  const slide = slidesOf(after.doc)[2]
  assert.equal(slide.kind, '')
  assert.equal(slideDataOf('', slide.node.attrs.body).markdown, '# The steps\n\n1. Sisend\n2. Väljund\n\n![](<images/new shot.png>)')
  assert.equal(conversionStateOf(after).count, 1)
  let undone = after
  undo(after, back => { undone = after.apply(back) })
  assert.equal(save(undone.doc), DECK, 'one Undo')
  const beside = stateOf(DECK.replace('title: Two tools\n', 'title: Two tools\npicture: right\n'), deckPlugins())
  const placed = beside.state.apply(pictureIntoSlide(beside.state, 'c2', 'images/a.png')!)
  const data = slideDataOf('', slidesOf(placed.doc)[1].node.attrs.body)
  assert.deepEqual([data.picture, data.image], ['right', 'images/a.png'])
  assert.ok(!(data.markdown ?? '').includes('images/a.png'))
  assert.equal(pictureIntoSlide(state, 'nope', 'images/a.png'), null)
  // A v1 Picture slide's picture is replaced, never a second one added (review of #765, round 2).
  const pictured = stateOf('```slide picture\nid: pc1\ntitle: Shot\nimage: images/old.png\n```\n\nText.\n', deckPlugins())
  const replaced = pictured.state.apply(pictureIntoSlide(pictured.state, 'pc1', 'images/new.png')!)
  assert.equal(slideDataOf('', slidesOf(replaced.doc)[0].node.attrs.body).markdown, '# Shot\n\n![](images/new.png)')
}

// ---- The conversion's line (the Experience lead on #765): "Old notes are now comments in the handout." with Show, once
// per deck, and only when notes or hidden words became comments; Show's target is the deck's first converted comment.
{
  const { state } = stateOf(DECK, deckPlugins())
  const after = state.apply(state.tr.insertText('!', endOf(state.doc, 'Compare them.')))
  const made = conversionStateOf(after).last
  const said = conversionNoticeFor(made, false)
  assert.deepEqual(said, { text: CONVERSION_NOTICE, firstComment: made!.firstComment })
  assert.equal(CONVERSION_NOTICE, 'Old notes are now comments in the handout.')
  assert.equal(conversionNoticeFor(made, true), null, 'once per deck: said already, it says nothing')
  // Show's target: the first converted comment, at the end of slide 1's part (before slide 2).
  const at = commentNodeAt(after.doc, said!.firstComment)!
  const slides = slidesOf(after.doc)
  assert.ok(at > slides[0].pos && at < slides[1].pos, 'in the first part with one')
  assert.equal(after.doc.nodeAt(at)!.type.name, 'commentNode')
  assert.equal(commentNodeAt(after.doc, 'no such note'), null)
  // An undo and a new edit convert again: the view has said it, so nothing more is said.
  let undone = after
  undo(after, back => { undone = after.apply(back) })
  const again = undone.apply(undone.tr.insertText('?', endOf(undone.doc, 'Last words.')))
  assert.equal(conversionStateOf(again).count, 2, 'converted again')
  assert.equal(conversionNoticeFor(conversionStateOf(again).last, true), null)
  // A deck with no notes and no hidden words converts without a line.
  const plain = stateOf('---\ndeck: 1\n---\n\n```slide points\nid: p1\ntitle: Plain\nitems:\n- heading: One\n```\n\nWords.\n', deckPlugins())
  const quiet = plain.state.apply(plain.state.tr.insertText('!', endOf(plain.state.doc, 'Words.')))
  assert.equal(conversionStateOf(quiet).count, 1)
  assert.deepEqual(conversionStateOf(quiet).last, { slides: 1, comments: 0, firstComment: null })
  assert.equal(conversionNoticeFor(conversionStateOf(quiet).last, false), null, 'no notes, no line')
}

console.log('deckConvert: passed')
