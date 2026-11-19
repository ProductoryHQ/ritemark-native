/** Sprint 165 PR 1: Other decks by folder, the row's date and count, and which decks start open. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deckDate, deckExpanded, deckMeta, folderHeading, folderOfDeck, groupByFolder, sectionIds, sectionsOf, slideCount, takeSectionTip } from './libraryGroups'
import { parseDeck, slideDataOf } from '../../../../../src/decks/deckFormat'

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

// Sprint 165 PR 2: an open deck's sections. A section slide (a short number over its title) starts one, up to the next;
// the slides before the first have no heading; a deck without sections has none.
{
  const block = (markdown: string) => ['```slide', markdown, '```', ''].join('\n')
  const deck = (...parts: string[]) => parseDeck(['---', 'deck: 2', '---', '', ...parts].join('\n')).slides.map((entry, index) => ({ index, kind: entry.kind, data: slideDataOf(entry.kind, entry.body) }))
  const places = (slides: Array<{ index: number }>) => slides.map(slide => slide.index)
  const withSections = deck(
    block('# Welcome'),
    block('# Today'),
    block('1\n\n# Agents at work'),
    block('# What an agent is'),
    block('# Exercise'),
    block('2\n\n# Prompts'),
    block('# A good prompt'),
  )
  const grouped = sectionsOf(withSections)
  assert.deepEqual(places(grouped.before), [0, 1], 'the slides before the first section stand alone')
  assert.deepEqual(grouped.sections.map(section => [section.number, section.title, places(section.slides)]), [
    ['1', 'Agents at work', [2, 3, 4]],
    ['2', 'Prompts', [5, 6]],
  ])
  // A section first: nothing before it.
  assert.deepEqual(sectionsOf(withSections.slice(2)).before, [])
  // An old Section slide counts, its number from its header; one with no title is named by its number.
  const old = sectionsOf([{ kind: 'section', data: { number: '3' } }, { kind: 'points', data: { title: 'x' } }])
  assert.deepEqual(old.sections.map(section => [section.number, section.title, section.slides.length]), [['3', 'Section 3', 2]])
  // No sections: every slide as before.
  const none = deck(block('# One'), block('# Two'), block('# Just a title'))
  assert.deepEqual(sectionsOf(none), { before: none, sections: [] })
  assert.deepEqual(sectionsOf([]), { before: [], sections: [] })
}

// A skipped section slide starts no section; Take section's ids only when the host will take them.
{
  const skipped = sectionsOf([{ kind: 'section', data: { number: '1', title: 'One' } }, { kind: 'section', data: { number: '2', title: 'Backup', skip: true } }, { kind: 'points', data: {} }])
  assert.deepEqual(skipped.sections.map(section => [section.title, section.slides.length]), [['One', 3]])
  assert.deepEqual(sectionIds([{ id: 's1' }, { id: 'a2' }]), ['s1', 'a2'])
  assert.equal(sectionIds([{ id: 's1' }, {}]), null, 'a slide without an id')
  assert.equal(sectionIds([{ id: 'a1' }, { id: 'a1' }]), null, 'an id twice')
  assert.equal(sectionIds([{ id: 'intro-1' }]), null, 'a hand-written id the host refuses')
  assert.equal(sectionIds(Array.from({ length: 201 }, (_, i) => ({ id: `i${i}` }))), null)
}

// The Experience lead on #861: Take section names the count, keeps its reasons when it can't be taken, and shows only
// while the pointer is over its section or the heading holds the keyboard, so at rest the title has the full width.
{
  assert.equal(takeSectionTip('Insert after slide 2', ['a', 'b', 'c'], 3), 'Take section · 3 slides')
  assert.equal(takeSectionTip('Insert after slide 2', ['a'], 1), 'Take section · 1 slide')
  assert.equal(takeSectionTip(null, ['a'], 1), 'Open a deck to insert this section into it.')
  assert.match(takeSectionTip('Insert as slide 1', null, 2), /need ids/)
  const css = readFileSync(new URL('../decks.css', import.meta.url), 'utf8')
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`)
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at))
  }
  assert.match(rule('.deck-lib-take-slot'), /position: absolute/, 'at rest the button takes no room from the title')
  assert.match(rule('.deck-lib-take-slot'), /opacity: 0/)
  assert.match(css, /\.deck-lib-section:hover \.deck-lib-take-slot/, 'shown while the pointer is over the section')
  assert.match(css, /\.deck-lib-section-head:has\(:focus-visible\) \.deck-lib-take-slot/, 'shown while the heading holds the keyboard, not after a click')
  assert.match(rule('.deck-lib-section-title'), /-webkit-line-clamp: 2/, 'two lines before an ellipsis')
  assert.match(rule('.deck-lib-section-head'), /align-items: flex-start/, "the number sits on a two-line title's first line")
  assert.match(rule('.deck-lib-section-head'), /padding: 5px 0/)
  assert.match(rule('.deck-lib-section-number'), /margin-top: -1px/)
  assert.match(rule('.deck-lib-take-slot'), /top: 1px/, 'Take section on the first line too')
  assert.doesNotMatch(rule('.deck-lib-take-slot'), /top: 50%/)
}
