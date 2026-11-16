/**
 * 16 November (experience 46): a deck's / menu is the Text editor's own, with the same items; only Divider's name says
 * that the line starts a new slide there. Run with `npx tsx webview/src/extensions/blockItems.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { blockItems, DECK_DIVIDER_TITLE, slashItemsFor } from './blockItems'

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
})
assert.equal(blockItems.find(item => item.nodeType === 'horizontalRule')?.title, 'Divider', "the Text editor's own list is unchanged")
// Typing "/div" still finds it.
assert.ok(deck.some(item => item.title.toLowerCase().startsWith('div') && item.nodeType === 'horizontalRule'))

console.log('blockItems: passed')
