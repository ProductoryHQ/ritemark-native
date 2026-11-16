/**
 * The webview's file icon (Sprint 159, deck icons): a deck shows the easel in Search, the link list and the AI
 * column's file chips (the composer's and a sent message's); every other file keeps its surface's icon.
 *
 * Run: npx tsx webview/src/lib/fileIcon.test.ts
 */
import assert from 'node:assert/strict'
import { fileIconOf } from './fileIcon'

assert.deepEqual(
  ['/p/Harbour Logistics/AI assistants and agents.deck.md', 'C:\\p\\TEAMS.DECK.MD', '/p/Notes.md', '/p/deck.md', '/p/.deck.md', '/p/Pitch.pptx', null, undefined, ''].map((path) => fileIconOf(path, 'file-text')),
  ['presentation', 'presentation', 'file-text', 'file-text', 'file-text', 'file-text', 'file-text', 'file-text', 'file-text'],
)
assert.equal(fileIconOf('/p/data.csv', 'table'), 'table', "another file keeps its surface's icon")
console.log('fileIcon: all assertions passed')
