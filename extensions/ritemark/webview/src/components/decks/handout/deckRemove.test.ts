/**
 * Removing a slide from the handout (experience 46, "Removing a slide from the handout"): Backspace in an empty part,
 * the two-press join at the start of a part, the part number's ⋯ (the strip's own menu), and typing that never removes
 * a slide. Driven as the handout's editor runs them: the deck's schema with comments, the history, the guard, the
 * lines, the drawn headings, the conversion and the removal's own plugin, with the editor's keys through
 * `handleRemoveKey`, and the file saved through the editor's own Markdown pipeline.
 * Run with `npx tsx webview/src/components/decks/handout/deckRemove.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Plugin, TextSelection, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { history, undo, undoDepth } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { joinedSlideMarkdown, joinsCleanly, slideHasNothing } from '../../../../../src/decks/blocks/joinSlides'
import { slideCommentsOf } from '../../../../../src/decks/blocks/slideComments'
import { lexBlockSlide } from '../../../../../src/decks/blocks/slideRenderer'
import { deckDigest, publicDeck } from '../../../../../src/decks/page/publicDeck'
import { pageHtml } from '../../../../../src/decks/page/pageHtml'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from './deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from './drawnHeadings'
import { deckGuardPlugin } from './deckGuard'
import { deckLinesPlugin } from './deckLines'
import { deckConvertPlugin } from './deckConvert'
import { DECK_REMOVED, backspaceAt, joinPartUp, deckRemovePlugin, handleRemoveKey, isEmptyPart, joinMarkOf, joinNote, partStartOf, removalNotice, type DeckRemoval } from './deckRemove'
import { derivedHeadings, slidesOf } from '../deckDocument'
import { slideMenuItems, type SlideMenuActions } from '../slideMenuItems'

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

const drawnPlugin = () => new Plugin({ appendTransaction: (transactions, _old, next) => drawnHeadingsFollow(transactions, next) })
const removePlugin = deckRemovePlugin()
const deckPlugins = () => [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin(), removePlugin]

/**
 * The deck as the deck view's editor opens it (its drawn headings or a text handout's empty lines), a stand-in for the
 * editor's view (its state and its dispatch, as `handleRemoveKey` uses them), and the file's save.
 */
function openDeck(text: string) {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  let state = EditorState.create({ doc, plugins: deckPlugins() })
  const drawn = derivedHeadings(state, split.properties.handout === 'text')
  if (drawn) state = state.apply(drawn)
  const removals: DeckRemoval[] = []
  const view = {
    get state() { return state },
    composing: false,
    dispatch(tr: Transaction) {
      const removal = tr.getMeta(DECK_REMOVED) as DeckRemoval | undefined
      if (removal) removals.push(removal)
      state = state.apply(tr)
    },
  }
  const key = (name: string, extra: Partial<KeyboardEvent> = {}) => handleRemoveKey(view as unknown as EditorView, { key: name, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, ...extra })
  return {
    view,
    get state() { return state },
    set state(next: EditorState) { state = next },
    key,
    removals,
    save: (next: PMNode = state.doc) => joinFrontMatter(properties, editorMarkdown(next), text),
    caret(pos: number) { view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos))) },
    undo() { undo(state, tr => { state = state.apply(tr) }) },
  }
}

/** Where the words `words` start in the document (in a paragraph or heading). */
function startOf(doc: PMNode, words: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.isTextblock && node.textContent.startsWith(words)) found = pos + 1
    return found < 0
  })
  assert.ok(found >= 0, `no line starts with ${words}`)
  return found
}

const ID_TITLE = '11111111-1111-4111-8111-111111111111'
const ID_WORDS = '22222222-2222-4222-8222-222222222222'
const ID_LOWER = '33333333-3333-4333-8333-333333333333'
const ID_UPPER = '44444444-4444-4444-8444-444444444444'
const ID_COLS = '55555555-5555-4555-8555-555555555555'
const PRIVATE = ['TITLENOTE', 'WORDSNOTE', 'LOWERWHOLE', 'UPPERWHOLE', 'COLUMNSNOTE']

/** A deck of block slides with a text handout: the second slide empty, the fourth full of everything a join moves. */
const DECK = [
  '---', 'deck: 2', 'handout: text', '---', '',
  '```slide', '---', 'id: a1', '---', '# Where assistants help', '', 'Three jobs every week', '```', '',
  '## Where assistants help', '', 'Ask who has done one.', '',
  '```slide', '---', 'id: e2', '---', '```', '',
  '```slide', '---', 'id: u3', 'picture: right', 'image: images/upper.png', 'skip: true', '---',
  '# The pilot', '', 'Six weeks with the bank.', '', `<!-- {id:${ID_UPPER}} UPPERWHOLE: keep it short -->`, '```', '',
  '## The pilot', '', 'What we tried first.', '',
  '```slide', '---', 'id: l4', 'picture: left', 'image: images/lower.png', '---',
  `<!-- {id:${ID_TITLE}} TITLENOTE: a better title -->`, '', '# What it taught us', '',
  `Answers came <mark data-comment="WORDSNOTE: which answers?" data-comment-id="${ID_WORDS}">twice as fast</mark>.`, '',
  `<!-- {id:${ID_COLS}} COLUMNSNOTE: two is enough -->`, '',
  ':::: columns', '::: column', '### Fast', 'Drafts in minutes', ':::', '', '::: column', '### Careful', 'Checked by people', ':::', '::::', '',
  `<!-- {id:${ID_LOWER}} LOWERWHOLE: too busy -->`, '```', '',
  '## What it taught us', '', 'Two lessons for the room.', '',
  '```slide', '---', 'id: z5', '---', '# Thanks', '```', '',
  '## Thanks', '',
].join('\n')

// ---- The deck opens as written (the fixture itself is stable).
{
  const deck = openDeck(DECK)
  assert.equal(deck.save(), DECK, 'opened and saved: the same bytes')
  assert.equal(slidesOf(deck.state.doc).length, 5)
}

// ---- Backspace in an empty part removes exactly that slide and its line, in one step; the bar's line; one Undo gives
// the file back byte for byte.
{
  const deck = openDeck(DECK)
  assert.equal(isEmptyPart(deck.state.doc, 1), true, 'the second part is empty')
  assert.equal(isEmptyPart(deck.state.doc, 0), false)
  const second = slidesOf(deck.state.doc)[1]
  // The caret in the part's empty heading.
  deck.caret(second.pos + second.node.nodeSize + 1)
  assert.deepEqual(backspaceAt(deck.state), { what: 'remove', index: 1 })
  const depth = undoDepth(deck.state)
  assert.equal(deck.key('Backspace'), true, 'the deck takes the key')
  const ids = slidesOf(deck.state.doc).map(entry => entry.data.id)
  assert.deepEqual(ids, ['a1', 'u3', 'l4', 'z5'], 'exactly that slide')
  assert.deepEqual(deck.removals, [{ what: 'deleted', number: 2 }])
  assert.equal(removalNotice(deck.removals[0]), 'Slide 2 is deleted.')
  assert.equal(undoDepth(deck.state), depth + 1, 'one undo step')
  const saved = deck.save()
  assert.ok(!saved.includes('id: e2') && saved.includes('Ask who has done one.\n\n```slide\n---\nid: u3'), 'its line and its part go, nothing else')
  assert.equal(deck.state.selection.$from.parent.textContent, 'Ask who has done one.', 'the caret at the end of the part above')
  deck.undo()
  assert.equal(deck.save(), DECK, 'one Undo: byte for byte')
}

// ---- The empty part's slide must have nothing of its own: a setting (Skip slide), a picture or a word keeps it.
{
  const skipped = DECK.replace('id: e2\n---', 'id: e2\nskip: true\n---')
  assert.equal(isEmptyPart(openDeck(skipped).state.doc, 1), false, 'Skip slide is a setting of its own')
  const pictured = DECK.replace('id: e2\n---', 'id: e2\npicture: none\nimage: images/kept.png\n---')
  assert.equal(isEmptyPart(openDeck(pictured).state.doc, 1), false, 'a picture kept with its place None')
  const worded = DECK.replace('id: e2\n---\n```', 'id: e2\n---\nA word\n```')
  assert.equal(isEmptyPart(openDeck(worded).state.doc, 1), false, 'a word on the slide')
  const texted = DECK.replace('```\n\n```slide\n---\nid: u3', '```\n\nA line of handout.\n\n```slide\n---\nid: u3')
  assert.equal(isEmptyPart(openDeck(texted).state.doc, 1), false, 'words in its part')
  const commented = DECK.replace('```\n\n```slide\n---\nid: u3', '```\n\n<!-- a private note -->\n\n```slide\n---\nid: u3')
  assert.equal(isEmptyPart(openDeck(commented).state.doc, 1), false, 'a comment in its part')
  assert.equal(slideHasNothing('', { id: 'x' }, null), true)
  assert.equal(slideHasNothing('', { id: 'x' }, 'old notes'), false, 'a v1 slide with notes')
  // Codex on #770: values that say nothing are no setting (an empty list of items or rows, `skip: false`, a picture placed
  // nowhere); a word anywhere in them is.
  assert.equal(slideHasNothing('', { id: 'x', items: [], rows: [], skip: false, picture: 'none' } as never, null), true)
  assert.equal(slideHasNothing('', { id: 'x', items: [{ heading: '' }] } as never, null), true)
  assert.equal(slideHasNothing('', { id: 'x', items: [{ heading: 'A word' }] } as never, null), false)
  assert.equal(slideHasNothing('', { id: 'x', picture: 'none', image: 'images/kept.png' }, null), false, 'a picture kept with its place None')
  assert.equal(slideHasNothing('', { id: 'x', skip: true }, null), false)
  // The deck's only slide stays.
  const single = openDeck(['---', 'deck: 2', 'handout: text', '---', '', '```slide', '---', 'id: o1', '---', '```', ''].join('\n'))
  const only = slidesOf(single.state.doc)[0]
  single.caret(only.pos + only.node.nodeSize + 1)
  assert.equal(backspaceAt(single.state), null, 'the last slide stays')
}

// ---- A Backspace in a non-empty part never removes a slide: in its words, at the start of a later line, in an empty
// line among words, and the first press at the part's start (which only marks the join).
{
  const deck = openDeck(DECK)
  const count = slidesOf(deck.state.doc).length
  for (const [where, at] of [
    ['in its words', startOf(deck.state.doc, 'Ask who') + 3],
    ['at the start of a later line', startOf(deck.state.doc, 'Ask who')],
    ['at the start of a heading that isn\'t the part\'s first line', startOf(deck.state.doc, 'Two lessons')],
  ] as Array<[string, number]>) {
    const fresh = openDeck(DECK)
    fresh.caret(at)
    const before = fresh.state.doc
    assert.equal(fresh.key('Backspace'), false, `${where}: the editor's own Backspace`)
    assert.equal(fresh.state.doc, before, `${where}: nothing written by the deck`)
    assert.equal(slidesOf(fresh.state.doc).length, count)
  }
  // The first press at a part's start marks the join and writes nothing.
  const first = openDeck(DECK)
  first.caret(startOf(first.state.doc, 'What it taught us') )
  const before = first.state.doc
  assert.equal(first.key('Backspace'), true)
  assert.equal(first.state.doc, before, 'the first press writes nothing')
  assert.deepEqual(joinMarkOf(first.state), { index: 3, id: 'l4' })
  assert.equal(joinNote(3), 'Backspace again joins slide 4 into slide 3. Nothing is lost.')
  // Typing over a selection across a line keeps the line (the guard refuses it).
  const across = openDeck(DECK)
  const from = startOf(across.state.doc, 'Ask who') + 2
  const to = startOf(across.state.doc, 'The pilot') + 2
  const typed = across.state.apply(across.state.tr.setSelection(TextSelection.create(across.state.doc, from, to)).insertText('x'))
  assert.equal(slidesOf(typed.doc).length, count, 'typing over a line keeps it')
}

// ---- The join's two presses: blocks in order, the title an H3, the picture a block at the end, the handout text
// following on, the upper slide's settings kept, comments with their blocks, the whole-slide comment on the H3; one Undo
// gives the file back byte for byte.
{
  const deck = openDeck(DECK)
  deck.caret(startOf(deck.state.doc, 'What it taught us'))
  assert.equal(partStartOf(deck.state.doc, 3), deck.state.selection.from)
  const depth = undoDepth(deck.state)
  assert.equal(deck.key('Backspace'), true)
  assert.equal(deck.removals.length, 0, 'the first press joins nothing')
  assert.equal(deck.key('Backspace'), true)
  assert.deepEqual(deck.removals, [{ what: 'joined', number: 4, into: 3 }])
  assert.equal(removalNotice(deck.removals[0]), 'Slide 4 is joined to slide 3.')
  assert.equal(undoDepth(deck.state), depth + 1, 'one undo step')
  assert.equal(joinMarkOf(deck.state), null)
  const slides = slidesOf(deck.state.doc)
  assert.deepEqual(slides.map(entry => entry.data.id), ['a1', 'e2', 'u3', 'z5'])
  const joined = slides[2]
  assert.equal(joined.data.picture, 'right', "the upper slide's picture place");
  assert.equal(joined.data.image, 'images/upper.png')
  assert.equal(joined.data.skip, true, 'its Skip slide')
  assert.equal(joined.data.title, 'The pilot', 'its title')
  const expected = [
    '# The pilot', '', 'Six weeks with the bank.', '',
    `<!-- {id:${ID_TITLE}} TITLENOTE: a better title -->`, '',
    `<!-- {id:${ID_LOWER}} LOWERWHOLE: too busy -->`, '',
    '### What it taught us', '',
    `Answers came <mark data-comment="WORDSNOTE: which answers?" data-comment-id="${ID_WORDS}">twice as fast</mark>.`, '',
    `<!-- {id:${ID_COLS}} COLUMNSNOTE: two is enough -->`, '',
    ':::: columns', '::: column', '### Fast', 'Drafts in minutes', ':::', '', '::: column', '### Careful', 'Checked by people', ':::', '::::', '',
    '![](images/lower.png)', '',
    `<!-- {id:${ID_UPPER}} UPPERWHOLE: keep it short -->`,
  ].join('\n')
  assert.equal(joined.data.markdown, expected, 'the blocks in order, the H3, the picture at the end of what moved')
  const comments = new Map(slideCommentsOf(joined.data.markdown ?? '').map(comment => [comment.id, comment.anchor]))
  assert.deepEqual(comments.get(ID_TITLE), { kind: 'block', block: { kind: 'heading' } }, 'on the H3, as it was on the title')
  assert.deepEqual(comments.get(ID_LOWER), { kind: 'block', block: { kind: 'heading' } }, "the lower slide's whole-slide comment on its H3")
  assert.deepEqual(comments.get(ID_WORDS), { kind: 'words', words: 'twice as fast' }, 'on its words')
  assert.deepEqual(comments.get(ID_COLS), { kind: 'block', block: { kind: 'columns', count: 2 } }, 'on its block')
  assert.deepEqual(comments.get(ID_UPPER), { kind: 'slide' }, "the upper slide's whole-slide comment stays on its whole slide")
  // The handout: part 3's text, then part 4's, in that part now.
  const saved = deck.save()
  assert.ok(saved.includes('## The pilot\n\nWhat we tried first.\n\n## What it taught us\n\nTwo lessons for the room.\n\n```slide\n---\nid: z5'), 'the handout text follows on')
  assert.equal(deck.state.selection.$from.parent.textContent, 'What it taught us', 'the caret where the part began')
  // The page: no comment's words after the join.
  const page = JSON.stringify(publicDeck(saved, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  for (const word of PRIVATE) assert.ok(!page.includes(word), `${word} isn't on the page`)
  const pub = publicDeck(saved, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME })
  const html = pageHtml(pub, { slideCss: '', fonts: [] }, { digest: deckDigest(pub), pictureUrl: () => null })
  for (const word of PRIVATE) assert.ok(!String(html).includes(word), `${word} isn't in the page's HTML`)
  deck.undo()
  assert.equal(deck.save(), DECK, 'one Undo brings slide 4 back exactly: byte for byte')
}

// ---- The typing after a removal is a step of its own: one Undo takes back only the typing, the next the join.
{
  const deck = openDeck(DECK)
  deck.caret(startOf(deck.state.doc, 'What it taught us'))
  deck.key('Backspace')
  deck.key('Backspace')
  const joined = deck.save()
  deck.view.dispatch(deck.state.tr.insertText('Now: '))
  deck.undo()
  assert.equal(deck.save(), joined, 'the typing alone')
  deck.undo()
  assert.equal(deck.save(), DECK, 'then the join')
}

// ---- The first press, then Esc, a click or another key: the mark goes and nothing is written.
{
  for (const how of ['Escape', 'a', 'ArrowLeft', 'click', 'blur', 'caret'] as const) {
    const deck = openDeck(DECK)
    deck.caret(startOf(deck.state.doc, 'What it taught us'))
    deck.key('Backspace')
    assert.ok(joinMarkOf(deck.state), `${how}: marked`)
    const before = deck.state.doc
    if (how === 'click' || how === 'blur') {
      const handler = removePlugin.props.handleDOMEvents?.[how === 'click' ? 'mousedown' : 'blur'] as ((view: EditorView, event: Event) => boolean) | undefined
      assert.ok(handler)
      handler!(deck.view as unknown as EditorView, {} as Event)
    } else if (how === 'caret') {
      deck.caret(startOf(deck.state.doc, 'Two lessons'))
    } else {
      const taken = deck.key(how)
      assert.equal(taken, how === 'Escape', `${how}: Esc does only that; another key does what it does`)
    }
    assert.equal(joinMarkOf(deck.state), null, `${how}: the mark goes`)
    assert.equal(deck.state.doc, before, `${how}: nothing written`)
    assert.equal(deck.save(), DECK)
    // A modifier alone (on the way to another key) keeps the mark.
    const again = openDeck(DECK)
    again.caret(startOf(again.state.doc, 'What it taught us'))
    again.key('Backspace')
    again.key('Shift')
    assert.ok(joinMarkOf(again.state), 'Shift alone is no key of its own')
  }
}

// ---- The part number's ⋯ is the strip's own menu: the same items, each acting on that slide.
{
  const calls: string[] = []
  const actions: SlideMenuActions = {
    duplicate: index => calls.push(`duplicate ${index}`),
    toggleSkip: index => calls.push(`skip ${index}`),
    addToLibrary: index => calls.push(`add ${index}`),
    showInLibrary: index => calls.push(`show ${index}`),
    remove: index => calls.push(`remove ${index}`),
    settings: index => calls.push(`settings ${index}`),
  }
  const items = slideMenuItems({ index: 2, count: 5, skipped: true, fromLibrary: false, deleteKey: '⌫' })
  assert.deepEqual(items.map(item => item.label), ['Duplicate', 'Show slide', 'Add to library…', 'Slide settings…', 'Delete slide'])
  for (const item of items) item.run(actions)
  assert.deepEqual(calls, ['duplicate 2', 'skip 2', 'add 2', 'settings 2', 'remove 2'], 'each on that slide')
  assert.deepEqual(slideMenuItems({ index: 0, count: 1, skipped: false, fromLibrary: true, deleteKey: '⌫' }).map(item => `${item.label}${item.disabled ? ' (off)' : ''}`),
    ['Duplicate', 'Skip slide', 'Show in the library', 'Slide settings…', 'Delete slide (off)'])
  // Both menus draw that one list: the strip's thumbnail and the part number's ⋯.
  const here = join(process.cwd(), process.cwd().endsWith('webview') ? 'src/components/decks' : 'webview/src/components/decks')
  const strip = readFileSync(join(here, 'SlideStrip.tsx'), 'utf8')
  const view = readFileSync(join(here, 'DeckView.tsx'), 'utf8')
  assert.match(strip, /<DropdownMenuContent[^>]*onCloseAutoFocus=\{onMenuCloseFocus\}>\s*<SlideMenuItems /, "the thumbnail's menu")
  // The strip's own actions; Slide settings… anchored beside this part's number.
  assert.match(view, /function PartMenu[\s\S]*?<SlideMenuItems index=\{index\}[^>]*actions=\{\{ \.\.\.actions, settings: at => onSettings\(at, slot\) \}\}/, "the part number's menu")
  assert.match(view, /<PartMenu\s+key=\{slot\.id\}\s+slot=\{slot\}\s+index=\{entry \? entry\.index : -1\}[\s\S]*?actions=\{stripActions\}/, "with the strip's own actions, for its own slide")
}

// ---- A deck of today's slides: the join converts it first, in the same step, and one Undo gives the file back.
{
  const V1 = [
    '---', 'deck: 1', '---', '',
    '```slide points', 'id: p1', 'title: Where assistants help', 'items:', '- heading: Mail', '- heading: Notes', '```', '',
    'Ask who has done one.', '',
    '```slide statement', 'id: s2', 'title: What it taught us', 'subtitle: Answers came twice as fast.', '```', '',
    '```notes', 'NOTESWORD: say it slowly', '```', '',
    'Two lessons for the room.', '',
  ].join('\n')
  const deck = openDeck(V1)
  assert.equal(deck.save(), V1, 'opening writes nothing')
  // The caret at the start of part 2's first line: its drawn heading.
  const second = slidesOf(deck.state.doc)[1]
  deck.caret(second.pos + second.node.nodeSize + 1)
  assert.equal(deck.state.selection.$from.parent.textContent, 'What it taught us')
  const depth = undoDepth(deck.state)
  deck.key('Backspace')
  deck.key('Backspace')
  assert.deepEqual(deck.removals, [{ what: 'joined', number: 2, into: 1 }])
  assert.equal(undoDepth(deck.state), depth + 1, 'the conversion and the join: one undo step')
  const slides = slidesOf(deck.state.doc)
  assert.equal(slides.length, 1)
  assert.equal(slides[0].kind, '', 'a block slide now')
  assert.equal(slides[0].data.markdown, '# Where assistants help\n\n1. Mail\n2. Notes\n\n### What it taught us\n\nAnswers came twice as fast.')
  const saved = deck.save()
  assert.ok(saved.includes('## What it taught us\n\nTwo lessons for the room.'), "part 2's heading and text follow on, written")
  assert.ok(saved.includes('NOTESWORD'), 'the old notes are a comment in the handout, not lost')
  const page = JSON.stringify(publicDeck(saved.replace('deck: 1', 'deck: 2'), { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  assert.ok(!page.includes('NOTESWORD'), 'and never on the page')
  deck.undo()
  assert.equal(deck.save(), V1, 'one Undo: byte for byte')
}

// ---- The join as text, alone: a setext title, a slide without a title, an empty lower slide, notes only.
{
  assert.equal(joinedSlideMarkdown('# Up', 'Down\n===\n\nWords'), '# Up\n\n### Down\n\nWords', 'a setext title')
  assert.equal(joinedSlideMarkdown('# Up', 'Words\n\n<!-- {id:x} WHOLE -->'), '# Up\n\n<!-- {id:x} WHOLE -->\n\nWords', 'no title: on its first block')
  assert.equal(joinedSlideMarkdown('# Up\n\n<!-- {id:u} U -->', ''), '# Up\n\n<!-- {id:u} U -->', 'an empty lower slide adds nothing')
  assert.equal(joinedSlideMarkdown('# Up', '<!-- {id:x} ONLY -->'), '# Up\n\n<!-- {id:x} ONLY -->', 'notes alone: on the joined slide')
  assert.equal(joinedSlideMarkdown('', '# Down', { picture: 'behind', image: 'images/a b.png' }), '### Down\n\n![](<images/a b.png>)', 'a picture behind, with a space in its path')
  assert.equal(joinedSlideMarkdown('# Up', '# Down', { picture: 'none', image: 'images/kept.png' }), '# Up\n\n### Down', 'a picture placed nowhere is no slide-wide picture')
  assert.equal(joinedSlideMarkdown('# Up', '```\n# not a title\n```\n\n# Down'), '# Up\n\n```\n# not a title\n```\n\n### Down', 'a heading in code stays')
}

// ---- Review round 1, finding 1: a deck of today's slides whose upper slide has notes. The conversion puts their comment
// in front of the lower slide, and the join's position for the lower slide is read after the conversion: it is not
// moved again by the conversion's own steps (it was, and the second press removed nothing, or the upper slide).
{
  const V1 = [
    '---', 'deck: 1', '---', '',
    '```slide points', 'id: p1', 'title: Where assistants help', 'items:', '- heading: Mail', '```', '',
    '```notes', 'NOTESWORD: say it slowly', '```', '',
    'Ask who has done one.', '',
    '```slide statement', 'id: s2', 'title: What it taught us', 'subtitle: Twice as fast.', '```', '',
    'Two lessons.', '',
  ].join('\n')
  const deck = openDeck(V1)
  const second = slidesOf(deck.state.doc)[1]
  deck.caret(second.pos + second.node.nodeSize + 1)
  deck.key('Backspace')
  deck.key('Backspace')
  assert.deepEqual(deck.removals, [{ what: 'joined', number: 2, into: 1 }], 'the second press joins')
  const slides = slidesOf(deck.state.doc)
  assert.deepEqual(slides.map(entry => entry.data.id), ['p1'], 'the lower slide went, the upper one stayed')
  assert.equal(slides[0].data.markdown, '# Where assistants help\n\n1. Mail\n\n### What it taught us\n\nTwice as fast.')
  const saved = deck.save()
  assert.ok(saved.includes('NOTESWORD') && saved.includes('Ask who has done one.') && saved.includes('Two lessons.'), 'nothing lost')
  deck.undo()
  assert.equal(deck.save(), V1, 'one Undo: byte for byte')
}

// ---- Finding 2: an upper slide ending in a list and a lower one starting with a list of the same kind make one tight
// list (a blank line between them would space the upper slide's own items out); an indent of 1 to 3 spaces at a moved
// block's start never makes it part of the list above.
{
  assert.equal(joinedSlideMarkdown('# A\n\n- a\n- b', '- c\n- d'), '# A\n\n- a\n- b\n- c\n- d', 'one tight list')
  assert.equal(joinedSlideMarkdown('1. a\n2. b', '1. c'), '1. a\n2. b\n1. c', 'ordered: one list, its numbers the renderer counts')
  assert.equal(joinedSlideMarkdown('- a', '1. c'), '- a\n\n1. c', 'a bullet list and a numbered one stay two')
  assert.equal(joinedSlideMarkdown('- a', '# T\n\n- c'), '- a\n\n### T\n\n- c', 'a title between: nothing to merge')
  assert.equal(joinedSlideMarkdown('- a', '  continued'), '- a\n\ncontinued', 'the indent goes, so it is a paragraph of its own')
  assert.equal(joinedSlideMarkdown('- a', '    code'), '- a\n\n```\ncode\n```', 'indented code moves fenced, never into the item above')
  assert.equal(joinedSlideMarkdown('Para', '  - c\n  - d'), 'Para\n\n- c\n- d', 'an indented list moves whole: its items stay siblings')
  assert.equal(joinedSlideMarkdown('- a\n- b', '- c\n\n- d'), '- a\n- b\n\n- c\n\n- d', 'a loose list below is not merged into a tight one')
  assert.equal(joinedSlideMarkdown('- a', '    x ``` y'), '- a\n\n````\nx ``` y\n````', 'the fence sized past the code')
  const tokens = (markdown: string) => lexBlockSlide(markdown).filter(token => token.type !== 'space').map(token => token.type)
  assert.deepEqual(tokens(joinedSlideMarkdown('- a\n- b', '- c')), ['list'], 'one list')
  assert.equal((lexBlockSlide(joinedSlideMarkdown('- a\n- b', '- c'))[0] as { loose?: boolean }).loose, false, 'and a tight one, as the upper slide had it')
  assert.deepEqual(tokens(joinedSlideMarkdown('- a', '  continued')), ['list', 'paragraph'])
  assert.deepEqual(tokens(joinedSlideMarkdown('- a\n- b', '    code here')), ['list', 'code'], 'code after a list stays code')
  const items = (lexBlockSlide(joinedSlideMarkdown('Para', '  - c\n  - d')).find(token => token.type === 'list') as { items: unknown[] }).items
  assert.equal(items.length, 2, 'two items')
}

// ---- Finding 3: a skipped slide is never joined into a shown one (its words would reach the wall and the page): the
// first press says why, and no press writes anything. A shown slide may join a skipped one (its words stay off the page).
{
  const skipped = DECK.replace('image: images/upper.png\nskip: true', 'image: images/upper.png').replace('id: l4\npicture: left', 'id: l4\nskip: true\npicture: left')
  assert.notEqual(skipped, DECK)
  const deck = openDeck(skipped)
  deck.caret(startOf(deck.state.doc, 'What it taught us'))
  const before = deck.state.doc
  assert.equal(deck.key('Backspace'), true)
  assert.deepEqual(joinMarkOf(deck.state), { index: 3, id: 'l4', blocked: 'skipped' })
  assert.equal(joinNote(3, 'skipped'), "Slide 4 is skipped, so it can't join slide 3. Show it first, from its ⋯.")
  assert.equal(deck.key('Backspace'), true, 'the second press is taken too')
  assert.equal(deck.state.doc, before, 'and writes nothing')
  assert.equal(deck.removals.length, 0)
  assert.equal(joinPartUp(deck.state, 3), null)
  // The fixture's slide 3 is skipped, slide 4 shown.
  const upperSkipped = openDeck(DECK)
  upperSkipped.caret(startOf(upperSkipped.state.doc, 'What it taught us'))
  upperSkipped.key('Backspace')
  upperSkipped.key('Backspace')
  assert.equal(upperSkipped.removals.length, 1, 'into a skipped slide: joined, its words stay off the page')
}

// ---- Security review: a slide that ends in a code fence never closed would take the other slide's words, its private
// comments too, into code, which the page shows as written. Such a join isn't made, and the note says why.
{
  assert.equal(joinsCleanly('# A\n\n```\ncode', '# B'), false, 'an open fence above')
  assert.equal(joinsCleanly('# A', '# B\n\n```\ncode'), false, 'an open fence below (the upper slide\'s notes go after it)')
  assert.equal(joinsCleanly('# A\n\n```\ncode\n```', '# B\n\n<!-- {id:x} n -->'), true, 'closed fences and notes are fine')
  assert.equal(joinsCleanly('', ''), true)
  const open = DECK.replace('Six weeks with the bank.', 'Six weeks with the bank.\n\n~~~\nan open fence')
  const deck = openDeck(open)
  deck.caret(startOf(deck.state.doc, 'What it taught us'))
  const before = deck.state.doc
  deck.key('Backspace')
  assert.equal(joinMarkOf(deck.state)?.blocked, 'unclosed')
  assert.equal(joinNote(3, 'unclosed'), "Slide 4 can't join slide 3: one of them ends in a block that is never closed.")
  deck.key('Backspace')
  assert.equal(deck.state.doc, before, 'nothing written')
  const page = JSON.stringify(publicDeck(deck.save(), { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  assert.ok(!page.includes('TITLENOTE') && !page.includes('LOWERWHOLE'), "the lower slide's comments stay off the page")
}

console.log('deckRemove.test.ts: all passed')
