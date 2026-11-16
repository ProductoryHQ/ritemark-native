/**
 * The file-link picker's icons (Sprint 159, deck icons): a deck shows the deck's own icon, as its tab, Documents,
 * Home and Search do; every other file keeps the icon of its kind.
 *
 * Run: npx tsx webview/src/extensions/FileLinkSuggestionList.test.ts
 */
import assert from 'node:assert/strict'
import { iconForFile } from './FileLinkSuggestionList'

assert.equal(iconForFile('markdown', 'Harbour Logistics/AI assistants and agents.deck.md'), 'presentation', 'a deck')
assert.equal(iconForFile('markdown', 'Slide library/TEAMS.DECK.MD'), 'presentation', 'a deck, in any case')
assert.equal(iconForFile('markdown', 'Notes/Session notes.md'), 'file-text', 'other Markdown keeps the page')
assert.equal(iconForFile('markdown', 'deck.md'), 'file-text', 'a file named deck.md is no deck')
assert.equal(iconForFile('data', 'data.csv'), 'table')
assert.equal(iconForFile('image', 'photo.png'), 'file-image')
assert.equal(iconForFile(undefined), 'file', 'a row with no file')
console.log('FileLinkSuggestionList: all assertions passed')
