/**
 * Sprint 157: a deck opened as a deck saves byte for byte, and a slide edit rewrites only its own lines.
 * Run with `npx tsx webview/src/components/decks/handout/deckRoundTrip.test.ts`.
 *
 * Drives the editor's own pipeline (`utils/editorMarkdown.ts`) with the deck's extensions, as the deck view does:
 * the host's front-matter split and projection, `markdownToEditorHTML`, TipTap's mount parse, then `getHTML()`,
 * `editorHTMLToMarkdown` and the host's join. The flag-off round trip of the same file is the fidelity corpus's
 * `kept/deck.md`.
 */
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Plugin, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { isTextHandout, parseSlideBody, writeSlideBody } from '../../../../../src/decks/deckFormat'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from './deckSchema'
import { DECK_DERIVED, derivedHeadings, withDrawnHeadings } from '../deckDocument'
import { documentReplacement } from '../../../lib/documentUpdate'
import { DeckDrawnHeadings, drawnHeadingsFollow, handoutMarkFor, hasDrawnHeadings } from './drawnHeadings'

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

function open(text: string): { doc: PMNode; save: (doc: PMNode) => string } {
  const split = splitFrontMatter(text)
  const projection = canonicalMarkdownProjection(split.content)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(projection)), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  return { doc, save: next => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const deckFile = fs.readFileSync(path.join(here, '../../../utils/fidelity-corpus/kept/deck.md'), 'utf8')

const slides = (doc: PMNode) => {
  const found: PMNode[] = []
  doc.forEach(node => { if (node.type.name === 'deckSlide') found.push(node) })
  return found
}

// Every slide and its notes open as slide nodes; a notes block is folded into its slide.
{
  const { doc, save } = open(deckFile)
  const nodes = slides(doc)
  assert.deepEqual(nodes.map(node => node.attrs.kind), ['title', 'boxes', 'table'])
  assert.equal(nodes[1].attrs.notes, 'Ask who has used an agent.')
  assert.equal(nodes[0].attrs.notes, null)
  assert.equal(parseSlideBody(nodes[1].attrs.body).title, "An assistant's four parts")
  let notesCodeBlocks = 0
  doc.descendants(node => { if (node.type.name === 'codeBlock' && /notes/.test(node.textContent)) notesCodeBlocks++ })
  assert.equal(notesCodeBlocks, 0)
  assert.equal(save(doc), deckFile, 'opened as a deck and saved: byte for byte')
}

// A stage edit rewrites only its own lines.
{
  const { doc, save } = open(deckFile)
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'deckSlide' && node.attrs.kind === 'boxes') at = offset })
  const node = doc.nodeAt(at)!
  const body = writeSlideBody(node.attrs.body, { ...parseSlideBody(node.attrs.body), title: 'Four parts' })
  const tr = EditorState.create({ doc }).tr.setNodeMarkup(at, undefined, { ...node.attrs, body })
  const before = deckFile.split('\n')
  const after = save(tr.doc).split('\n')
  assert.equal(after.length, before.length)
  assert.deepEqual(after.filter((line, index) => line !== before[index]), ['title: Four parts'])
}

// Notes written, emptied and removed.
{
  const { doc, save } = open(deckFile)
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'deckSlide') at = offset })
  const node = doc.nodeAt(at)!
  const withNotes = save(EditorState.create({ doc }).tr.setNodeMarkup(at, undefined, { ...node.attrs, notes: 'Say hello.' }).doc)
  assert.ok(withNotes.includes('subtitle: Harbour Logistics · 3 hours · 12 November 2026\n```\n\n```notes\nSay hello.\n```\n\n## Welcome'))
  const reopened = open(withNotes)
  assert.equal(slides(reopened.doc)[0].attrs.notes, 'Say hello.')
  assert.equal(reopened.save(reopened.doc), withNotes)
}

// A body with backticks gets a longer fence, and reads back the same.
{
  const text = '```slide statement\nid: ab12\ntitle: "```js"\n```\n\nText.\n'
  const { doc, save } = open(text)
  const node = slides(doc)[0]
  const body = 'id: ab12\ntitle: x\n```\ninside'
  const saved = save(EditorState.create({ doc }).tr.setNodeMarkup(0, undefined, { ...node.attrs, body }).doc)
  assert.ok(saved.startsWith('````slide statement\n'))
  assert.equal(slides(open(saved).doc)[0].attrs.body, body)
}

// Non-canonical input is normalised once, predictably, and then stays.
{
  const text = '~~~slide  points\nid: p001\n~~~\nTight text.\n'
  const first = open(text)
  const once = first.save(first.doc)
  assert.equal(once, '```slide points\nid: p001\n```\n\nTight text.\n')
  const second = open(once)
  assert.equal(second.save(second.doc), once)
}

// A notes block that does not follow a slide stays a code block of the handout.
{
  const text = '```slide points\nid: p001\n```\n\nText.\n\n```notes\nNot the slide\'s.\n```\n'
  const { doc, save } = open(text)
  assert.equal(slides(doc)[0].attrs.notes, null)
  assert.equal(save(doc), text)
}

// A notes block with an HTML comment between it and the slide is not the slide's: both stay where they are (Codex on PR 1).
{
  const text = '```slide points\nid: p001\n```\n\n<!-- a comment -->\n\n```notes\nNot the slide\'s.\n```\n'
  const { doc, save } = open(text)
  assert.equal(slides(doc)[0].attrs.notes, null)
  assert.equal(save(doc).indexOf('```notes') > save(doc).indexOf('a comment'), true, 'the notes stay after the comment')
  // With comment callouts off the comment arrives as a DOM comment node, which `nextElementSibling` skipped.
  const html = '<pre data-md-info="slide points"><code>id: p001\n</code></pre><!-- c --><pre data-md-info="notes"><code>x\n</code></pre>'
  const parsed = PMDOMParser.fromSchema(schema).parse(elementFromString(html), { preserveWhitespace: 'full' })
  assert.equal(slides(parsed)[0].attrs.notes, null, 'a comment node between them: the notes are not the slide\'s')
  let notesBlocks = 0
  parsed.descendants(node => { if (node.type.name === 'codeBlock') notesBlocks++ })
  assert.equal(notesBlocks, 1, 'and the notes block stays, as a code block')
}


// ---------------------------------------------------------------------------
// 16 November: the handout is a Text document, and its headings are its own
// ---------------------------------------------------------------------------

const headed = [
  '---', 'deck: 1', 'theme: Slide library/Themes/Evening.theme.md', '---', '',
  '```slide boxes', 'id: b7k2', 'title: Four parts', '```', '',
  '## An assistant\'s four parts', '',
  'An assistant is set up once.', '',
  '```slide section', 'id: s001', 'title: Why agents?', 'number: "1"', '```', '',
  '# Why agents?', '',
  'Prompt', '',
  '```', 'You are an assistant for the customer service team.', '```', '',
].join('\n')

const blocksOf = (text: string) => text.match(/```slide[\s\S]*?\n```/g) ?? []

// A heading edit leaves the slide block's bytes unchanged.
{
  const { doc, save } = open(headed)
  assert.equal(save(doc), headed, 'a deck with headings opens and saves byte for byte')
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'heading') at = offset })
  const edited = save(EditorState.create({ doc }).tr.insertText(', in short', at + 1 + doc.nodeAt(at)!.content.size).doc)
  assert.deepEqual(blocksOf(edited), blocksOf(headed), 'the slide blocks are byte for byte as they were')
  assert.ok(edited.includes("## An assistant's four parts, in short"))
  assert.equal(edited.split('\n').filter((line, index) => line !== headed.split('\n')[index]).length, 1, 'only the heading line changed')
}

// A title edit leaves the handout unchanged.
{
  const { doc, save } = open(headed)
  let at = -1
  doc.forEach((node, offset) => { if (at < 0 && node.type.name === 'deckSlide') at = offset })
  const node = doc.nodeAt(at)!
  const body = writeSlideBody(node.attrs.body, { ...parseSlideBody(node.attrs.body), title: 'The four parts of an assistant' })
  const edited = save(EditorState.create({ doc }).tr.setNodeMarkup(at, undefined, { ...node.attrs, body }).doc)
  const changed = edited.split('\n').filter((line, index) => line !== headed.split('\n')[index])
  assert.deepEqual(changed, ['title: The four parts of an assistant'], 'only the title line: the handout and its heading stay')
}

// An older deck (parts without their own headings): opening draws them from the slides' titles (H1 for a section, H2
// otherwise) and saves none of them; a slide edit alone saves without them, its drawn heading following the title; the
// first edit of the handout writes them all, and Undo takes that step back whole.
{
  const older = [
    '```slide title', 'id: t0a1', 'title: AI assistants and agents', '```', '',
    '## Welcome', '',
    'Everything you need today.', '',
    '```slide section', 'id: s001', 'title: Why agents?', '```', '',
    '```slide points', 'id: p001', 'title: "Agents *really* act"', '```', '',
    'An agent is given a goal.', '',
  ].join('\n')
  const { doc, save } = open(older)
  assert.equal(save(doc), older, 'opened: byte for byte')
  const plugins = [history(), new Plugin({ appendTransaction: (trs, _old, next) => drawnHeadingsFollow(trs, next) })]
  const state = EditorState.create({ doc, plugins })
  const tr = derivedHeadings(state)!
  assert.ok(tr, 'the older deck gets its headings drawn')
  assert.equal(tr.getMeta(DECK_DERIVED), true)
  assert.equal(tr.getMeta('addToHistory'), false, 'never in the undo history')
  assert.equal(tr.getMeta('preventUpdate'), true, 'never an update the editor publishes')
  const drawn = state.apply(tr)
  assert.equal(derivedHeadings(drawn), null, 'drawn once: every part has its heading now')
  const headings = (next: PMNode) => {
    const found: string[] = []
    next.forEach(node => { if (node.type.name === 'heading') found.push(`h${node.attrs.level}${node.attrs.deckDrawn ? ' drawn' : ''} ${node.textContent}`) })
    return found
  }
  // The first part opens with its own "Welcome": no heading is drawn over it.
  assert.deepEqual(headings(drawn.doc), ['h2 Welcome', 'h1 drawn Why agents?', 'h2 drawn Agents *really* act'])
  assert.equal(save(drawn.doc), older, 'opening writes nothing: drawn headings are never saved')

  // A slide edit alone (its title on the stage): saved without the drawn headings, and the part's drawn heading follows.
  let slideAt = -1
  drawn.doc.forEach((node, offset) => { if (node.type.name === 'deckSlide' && node.attrs.kind === 'section') slideAt = offset })
  const slideNode = drawn.doc.nodeAt(slideAt)!
  const retitled = drawn.apply(drawn.tr.setNodeMarkup(slideAt, undefined, { ...slideNode.attrs, body: writeSlideBody(slideNode.attrs.body, { ...parseSlideBody(slideNode.attrs.body), title: 'Why agents now?' }) }))
  assert.deepEqual(headings(retitled.doc), ['h2 Welcome', 'h1 drawn Why agents now?', 'h2 drawn Agents *really* act'], 'a drawn heading is its slide\'s title')
  const retitledText = save(retitled.doc)
  assert.equal(retitledText, older.replace('title: Why agents?', 'title: Why agents now?'), 'and the save is the title line alone')

  // The first real edit of the handout writes them, as ordinary text.
  let end = -1
  retitled.doc.forEach((node, offset) => { if (node.type.name === 'paragraph' && node.textContent === 'An agent is given a goal.') end = offset + node.nodeSize - 1 })
  const edited = retitled.apply(retitled.tr.insertText(' It acts.', end))
  assert.deepEqual(headings(edited.doc), ['h2 Welcome', 'h1 Why agents now?', 'h2 Agents *really* act'], 'written: no longer drawn')
  const written = save(edited.doc)
  assert.ok(written.includes('```slide section\nid: s001\ntitle: Why agents now?\n```\n\n# Why agents now?\n\n'), 'a section part: its H1')
  assert.ok(written.includes('```\n\n## Agents \\*really\\* act\n\nAn agent is given a goal. It acts.'), 'another part: its H2, escaped as Markdown')
  assert.ok(written.includes('## Welcome\n\nEverything you need today.'), 'a part with its own heading keeps it, and gets no second one')
  assert.deepEqual(blocksOf(written), blocksOf(retitledText), 'and every slide block is as it was')
  // Undo takes the edit back with the headings it wrote: drawn again, and the save is the file before it.
  let undone: EditorState = edited
  undo(edited, (step: Transaction) => { undone = edited.apply(step) })
  assert.deepEqual(headings(undone.doc), ['h2 Welcome', 'h1 drawn Why agents now?', 'h2 drawn Agents *really* act'])
  assert.equal(save(undone.doc), retitledText)
  // Reopened after the edit, the headings are the file's: nothing more is drawn.
  const reopened = open(written)
  assert.equal(derivedHeadings(EditorState.create({ doc: reopened.doc })), null)
  assert.equal(reopened.save(reopened.doc), written)
}

// A host revision of an older deck changes only what it changed: the editor diffs it against the view's document, drawn
// headings and all (Editor's `viewOfIncoming`), so the caret and the current slide stay where they are.
{
  const older = [
    '```slide title', 'id: t0a1', 'title: One', '```', '', 'First.', '',
    '```slide points', 'id: p001', 'title: Two', '```', '', 'Second.', '',
    '```slide points', 'id: p002', 'title: Three', '```', '', 'Third.', '',
  ].join('\n')
  const { doc } = open(older)
  const shown = withDrawnHeadings(doc)
  assert.notEqual(shown, doc, 'the view draws the headings')
  const revised = withDrawnHeadings(open(older.replace('Second.', 'Second, revised.')).doc)
  const replacement = documentReplacement(shown, revised)!
  assert.ok(replacement, 'the revision is a change')
  const changed = shown.textBetween(replacement.from, replacement.to, '|')
  assert.equal(changed.includes('One') || changed.includes('Three'), false, `only the changed paragraph is replaced, not "${changed}"`)
  assert.equal(withDrawnHeadings(shown), shown, 'drawn once')
}

// A drawn heading follows its slide's kind too: a Points slide made a Section is an H1 until the first edit writes it.
{
  const older = '```slide points\nid: p001\ntitle: Why agents?\n```\n\nText.\n'
  const { doc, save } = open(older)
  const plugins = [new Plugin({ appendTransaction: (trs, _old, next) => drawnHeadingsFollow(trs, next) })]
  const state = EditorState.create({ doc, plugins })
  const drawn = state.apply(derivedHeadings(state)!)
  const node = drawn.doc.child(0)
  const section = drawn.apply(drawn.tr.setNodeMarkup(0, undefined, { ...node.attrs, kind: 'section' }))
  assert.equal(section.doc.child(1).attrs.level, 1, 'a section\'s drawn heading is an H1')
  assert.equal(section.doc.child(1).attrs.deckDrawn, true)
  assert.equal(save(section.doc), older.replace('```slide points', '```slide section'), 'still not saved')
}

// The `handout: text` mark (16 November): the first real edit writes the headings and asks for the mark in the same
// edit; Undo of that edit brings the drawn headings back and takes the mark out again; a marked deck draws nothing, so a
// heading the person deleted stays deleted when the deck is opened again.
{
  const older = '```slide points\nid: p001\ntitle: Agents act\n```\n\nAn agent is given a goal.\n'
  const { doc, save } = open(older)
  const plugins = [history(), new Plugin({ appendTransaction: (trs, _old, next) => drawnHeadingsFollow(trs, next) })]
  const state = EditorState.create({ doc, plugins })
  const drawn = state.apply(derivedHeadings(state)!)
  assert.equal(save(drawn.doc), older, 'opening a deck with no mark: byte for byte')
  assert.equal(handoutMarkFor({ marked: false, drawn: hasDrawnHeadings(drawn.doc), addedHere: false, undo: false }), null, 'and no mark is asked for')
  // The first real edit: the heading is written, and the mark goes with it in that same edit.
  const end = drawn.doc.content.size - 1
  const edited = drawn.apply(drawn.tr.insertText(' It acts.', end))
  assert.ok(save(edited.doc).includes('## Agents act\n\nAn agent is given a goal. It acts.'))
  assert.equal(handoutMarkFor({ marked: false, drawn: hasDrawnHeadings(edited.doc), addedHere: false, undo: false }), 'add')
  // One undo: the edit and its headings go back together, and the mark with them.
  let undone: EditorState = edited
  undo(edited, (tr: Transaction) => { undone = edited.apply(tr) })
  assert.equal(save(undone.doc), older)
  assert.equal(handoutMarkFor({ marked: true, drawn: hasDrawnHeadings(undone.doc), addedHere: true, undo: true }), 'remove')
  assert.equal(handoutMarkFor({ marked: true, drawn: true, addedHere: false, undo: true }), null, "a mark this view didn't add stays")
  assert.equal(handoutMarkFor({ marked: true, drawn: true, addedHere: true, undo: false }), null, 'only an undo takes the mark out: a heading drawn meanwhile never does')

  // A marked deck whose part's heading the person deleted: reopened, nothing is drawn, so the heading stays deleted.
  const marked = '---\ndeck: 1\nhandout: text\n---\n\n```slide points\nid: p001\ntitle: Agents act\n```\n\nAn agent is given a goal.\n'
  const reopened = open(marked)
  assert.equal(isTextHandout(marked), true)
  assert.equal(derivedHeadings(EditorState.create({ doc: reopened.doc }), isTextHandout(marked)), null, 'a marked deck draws nothing')
  assert.equal(reopened.save(reopened.doc), marked)
}

// A new deck's title slide ("The deck's title", to be typed over): its part's heading is drawn empty, so it shows the
// placeholder and writes nothing.
{
  const fresh = '```slide title\nid: t0a1\ntitle: The deck\'s title\n```\n'
  const { doc, save } = open(fresh)
  const drawn = EditorState.create({ doc }).apply(derivedHeadings(EditorState.create({ doc }))!)
  let empty = 0
  drawn.doc.forEach(node => { if (node.type.name === 'heading' && node.childCount === 0) empty++ })
  assert.equal(empty, 1)
  assert.equal(save(drawn.doc), fresh, 'an empty heading is never written')
}

// A prompt in the handout is the editor's own code block: `pre.tiptap-code-block`, as in a Text document.
{
  const { doc } = open(headed)
  let code: PMNode | null = null
  doc.descendants(node => { if (!code && node.type.name === 'codeBlock') code = node })
  assert.ok(code, 'the prompt is a code block of the handout')
  const element = DOMSerializer.fromSchema(schema).serializeNode(code!, { document: createDocument('<body></body>') as unknown as Document }) as HTMLElement
  assert.equal(element.nodeName, 'PRE')
  assert.ok((element.getAttribute('class') ?? '').split(/\s+/).includes('tiptap-code-block'))
  const css = fs.readFileSync(path.join(here, '../decks.css'), 'utf8')
  assert.ok(!/tiptap-code-block|deck-copy|hljs/.test(css), 'the deck has no style or Copy of its own for a prompt')
  for (const gone of ['deck-part-bar', 'deck-part-band', 'deck-part-eyebrow', 'deck-part-title']) assert.ok(!css.includes(gone), `${gone} is gone`)
}

console.log('deckRoundTrip: passed')
