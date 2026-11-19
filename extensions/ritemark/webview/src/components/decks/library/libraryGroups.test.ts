/** Sprint 165 PR 1: Other decks by folder, the row's date and count, and which decks start open. */
import assert from 'node:assert/strict'
import { deckDate, deckExpanded, deckMeta, folderHeading, folderOfDeck, groupByFolder, slideCount } from './libraryGroups'

const day = (text: string) => new Date(text).getTime()
const decks = [
  { path: 'Harbour/day 1.deck.md', modified: day('2026-11-10T10:00') },
  { path: 'Kickoff.deck.md', modified: day('2026-11-01T10:00') },
  { path: 'Fernhollow/Bank intro.deck.md', modified: day('2026-11-15T10:00') },
  { path: 'Harbour/day 2.deck.md', modified: day('2026-11-12T10:00') },
  { path: 'Fernhollow/Bank wrap.deck.md', modified: day('2026-10-02T10:00') },
  { path: 'Notes.deck.md', modified: day('2026-11-05T10:00') },
  { path: 'Clients/North/plan.deck.md', modified: day('2025-06-01T10:00') },
]

// ---- Folders by their newest deck, decks newest first, the top level under the project's name.
const groups = groupByFolder(decks, 'Trainings')
assert.deepEqual(groups.map(group => group.name), ['Fernhollow', 'Harbour', 'Trainings', 'Clients › North'])
assert.deepEqual(groups[0].decks.map(deck => deck.path), ['Fernhollow/Bank intro.deck.md', 'Fernhollow/Bank wrap.deck.md'])
assert.deepEqual(groups[1].decks.map(deck => deck.path), ['Harbour/day 2.deck.md', 'Harbour/day 1.deck.md'])
assert.deepEqual(groups[2].decks.map(deck => deck.path), ['Notes.deck.md', 'Kickoff.deck.md'])
assert.equal(groups[2].folder, '', 'the top level is the folder ""')
assert.equal(groupByFolder([{ path: 'a.deck.md', modified: 1 }], '')[0].name, 'This project', 'a project with no name still gets a heading')
assert.deepEqual(groupByFolder([], 'X'), [])
assert.equal(folderOfDeck('a/b/c.deck.md'), 'a/b')
assert.equal(folderOfDeck('c.deck.md'), '')

// ---- The date: "12 Nov" this year, with the year otherwise.
const now = day('2026-11-19T12:00')
assert.equal(deckDate(day('2026-11-12T09:30'), now), '12 Nov')
assert.equal(deckDate(day('2026-01-03T09:30'), now), '3 Jan')
assert.equal(deckDate(day('2025-11-12T09:30'), now), '12 Nov 2025')
assert.equal(deckDate(0, now), '', 'no time read: no date')

// ---- Nested folders read with ›, as search's "Folder › Deck" will.
assert.equal(folderHeading('Clients/North'), 'Clients › North')
assert.equal(folderHeading('a/b/c'), 'a › b › c')
assert.equal(folderHeading('Harbour'), 'Harbour')
assert.equal(folderHeading(''), '')
assert.equal(groups[3].folder, 'Clients/North', 'the folder itself keeps its path')

// ---- The row's second line: date · count, the count alone with no date.
assert.equal(deckMeta(day('2026-11-18T09:00'), 9, now), '18 Nov · 9 slides')
assert.equal(deckMeta(day('2025-10-15T09:00'), 1, now), '15 Oct 2025 · 1 slide')
assert.equal(deckMeta(0, 4, now), '4 slides')

// ---- The count.
assert.equal(slideCount(1), '1 slide')
assert.equal(slideCount(41), '41 slides')
assert.equal(slideCount(0), '0 slides')

// ---- Every deck starts closed; "From another deck…" opens the newest; a search opens all; a hand's choice wins.
const newest = groups[0].decks[0].path
const closed = { searching: false, open: {}, openNewest: false, newest }
assert.equal(decks.some(deck => deckExpanded(deck.path, closed)), false, 'every deck starts closed')
const fromAnother = { ...closed, openNewest: true }
assert.deepEqual(decks.filter(deck => deckExpanded(deck.path, fromAnother)).map(deck => deck.path), ['Fernhollow/Bank intro.deck.md'])
assert.equal(deckExpanded(newest, { ...fromAnother, open: { [newest]: false } }), false, 'closed by hand stays closed')
assert.equal(deckExpanded('Notes.deck.md', { ...closed, open: { 'Notes.deck.md': true } }), true)
assert.equal(deckExpanded('Notes.deck.md', { ...closed, searching: true }), true)

console.log('libraryGroups: ok')
