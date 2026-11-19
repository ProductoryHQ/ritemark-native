/**
 * 16 November (experience 46): a deck's / menu is the Text editor's own, with the same items; only Divider's name says
 * that the line starts a new slide there. Run with `npx tsx webview/src/extensions/blockItems.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { blockItems, DECK_DIVIDER_TITLE, filterSlashItems, slashItemsFor } from './blockItems'
import { SLIDE_ITEMS } from '../components/decks/blocks/slideCommands'

const text = slashItemsFor(false)
const deck = slashItemsFor(true)

assert.equal(text, blockItems, "a Text document's menu is the editor's own list")
assert.equal(DECK_DIVIDER_TITLE, 'Divider · a new slide')
assert.deepEqual(deck.map(item => item.nodeType), text.map(item => item.nodeType), 'the same items, in the same order: nothing added or taken away')
assert.deepEqual(
  deck.map(item => item.title),
  text.map(item => (item.nodeType === 'horizontalRule' ? 'Divider · a new slide' : item.title)),
  'only Divider is named differently',
)
deck.forEach((item, index) => {
  assert.equal(item.icon, text[index].icon)
  assert.equal(item.description, text[index].description)
  assert.deepEqual(item.attrs, text[index].attrs)
  if (item.nodeType !== 'horizontalRule') assert.deepEqual(item.keywords, text[index].keywords)
})
assert.equal(blockItems.find(item => item.nodeType === 'horizontalRule')?.title, 'Divider', "the Text editor's own list is unchanged")
// Typing "/div" still finds it.
assert.ok(deck.some(item => item.title.toLowerCase().startsWith('div') && item.nodeType === 'horizontalRule'))

// ---- Experience 22 (18 November): hidden search words, in both menus.
const titles = (items: typeof blockItems, query: string) => filterSlashItems(items, query).map(item => item.title)

// One name for a picture: the Text editor's Image is Picture, same icon and behaviour, and "image" finds it.
const picture = blockItems.find(item => item.nodeType === 'image')!
assert.equal(picture.title, 'Picture')
assert.equal(picture.icon, 'image')
assert.ok(!blockItems.some(item => item.title === 'Image'), 'no item is called Image any more')
assert.deepEqual(titles(text, 'image'), ['Picture'])
assert.deepEqual(titles(text, 'pilt'), ['Picture'])
assert.deepEqual(titles(SLIDE_ITEMS, 'image'), ['Picture'])
assert.deepEqual(titles(SLIDE_ITEMS, 'img'), ['Picture'])

// The start of any word of the name: "/list" finds both lists, in the menu's order.
assert.deepEqual(titles(SLIDE_ITEMS, 'list'), ['Bullet list', 'Numbered list'])
assert.deepEqual(titles(text, 'list'), ['Bullet list', 'Numbered list', 'Task list'])
assert.deepEqual(titles(SLIDE_ITEMS, 'below'), ['New slide below'])
// Only the start of a word: "ist" is inside "list", not at a word's start.
assert.deepEqual(titles(text, 'ist'), [])

// Case and accents: "tapploend" finds täpploend, "ulesanded" finds Task list, "PAEVAKAVA" finds Agenda.
assert.deepEqual(titles(SLIDE_ITEMS, 'tapploend'), ['Bullet list'])
assert.deepEqual(titles(text, 'täpploend'), ['Bullet list'])
assert.deepEqual(titles(text, 'ulesanded'), ['Task list'])
assert.deepEqual(titles(SLIDE_ITEMS, 'PAEVAKAVA'), ['Agenda'])
assert.deepEqual(titles(text, 'PiCtU'), ['Picture'])

// A hidden phrase matches at its start or at any of its words; separators don't count ("heading1", "drawio").
assert.deepEqual(titles(SLIDE_ITEMS, 'two'), ['Columns'])
assert.deepEqual(titles(SLIDE_ITEMS, 'twocol'), ['Columns'])
assert.deepEqual(titles(SLIDE_ITEMS, 'slaid'), ['New slide below'])
assert.deepEqual(titles(text, 'heading1'), ['Heading 1'])
assert.deepEqual(titles(text, 'draw.io'), ['Diagram'])
assert.deepEqual(titles(text, 'drawio'), ['Diagram'])
assert.deepEqual(titles(SLIDE_ITEMS, 'h1'), ['Title'])

// Names that start with the query come first, then the other matches, each in the menu's own order.
assert.deepEqual(titles(SLIDE_ITEMS, 's'), ['Steps', 'Split slide here', 'Heading', 'Code block', 'Tabs', 'Agenda', 'Picture', 'New slide below'])
assert.deepEqual(titles(text, 'ta'), ['Task list', 'Table', 'Tabs', 'Bullet list'])
assert.deepEqual(titles(text, 'title'), ['Heading 1', 'Heading 2', 'Heading 3'])
assert.deepEqual(titles(SLIDE_ITEMS, 'grid'), ['Boxes', 'Table'])

// In a deck, Divider is also found by "slide" (experience 22).
assert.deepEqual(titles(deck, 'new'), [DECK_DIVIDER_TITLE])
assert.deepEqual(titles(text, 'new'), [])

// Nothing typed keeps the whole menu; what matches nothing gives an empty list ("No commands found").
assert.equal(filterSlashItems(SLIDE_ITEMS, ''), SLIDE_ITEMS)
assert.deepEqual(titles(text, 'xyzq'), [])
assert.deepEqual(titles(SLIDE_ITEMS, 'xyzq'), [])
assert.deepEqual(titles(text, '-'), [])

// Words are what spaces part: "draw.io" is one word, so "/io" doesn't find Diagram; "slidebelow" finds "slide below".
assert.deepEqual(titles(text, 'io'), [])
assert.deepEqual(titles(SLIDE_ITEMS, 'slidebelow'), ['New slide below'])
// Marks alone find the item whose shortcut they start (review of #802).
assert.deepEqual(titles(SLIDE_ITEMS, '#'), ['Title', 'Heading'])
assert.deepEqual(titles(SLIDE_ITEMS, '##'), ['Heading'])
assert.deepEqual(titles(SLIDE_ITEMS, '***'), ['Split slide here'])
assert.deepEqual(titles(SLIDE_ITEMS, '-'), ['Bullet list'])
// The deck's list is built once, so its items keep their identity from keystroke to keystroke.
assert.equal(slashItemsFor(true), slashItemsFor(true))
// The items both menus have share their words.
for (const nodeType of ['bulletList', 'orderedList', 'table', 'image', 'picture']) {
  const own = blockItems.find(item => item.nodeType === (nodeType === 'picture' ? 'image' : nodeType))!.keywords
  const slide = SLIDE_ITEMS.find(item => item.nodeType === nodeType)
  if (slide && nodeType !== 'image') assert.equal(slide.keywords, own, `${slide.title} shares its words`)
}

// Every item in both menus has hidden words (the README lists them all).
for (const item of [...text, ...SLIDE_ITEMS]) assert.ok(item.keywords?.length, `${item.title} has hidden words`)

console.log('blockItems: passed')
