/**
 * Sprint 169 (#866): every Phosphor regular icon by its name, the grid's 24 and aliases as before, the dashed circle for
 * any other name, and the icon menu's search index and search.
 *
 * Run: npx tsx webview/src/components/decks/slide/iconSearch.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { icons as catalog } from '@phosphor-icons/core'
import { ICON_TAGS, ICON_TAG_SEPARATOR } from './iconIndex'
import { PAGE_ICON_NAMES, PAGE_ICON_PATHS } from './pageIcons'
import { SLIDE_ICONS, SLIDE_ICON_ALIASES, SLIDE_ICON_NAMES, UNKNOWN_ICON, boxIconOf, gridIcon, slideIcon } from './iconSet'
import { searchIcons } from './iconSearch'

let passed = 0
function test(name: string, run: () => void) {
  run()
  passed++
  console.log(`ok - ${name}`)
}

const core = fileURLToPath(new URL('../../../../../node_modules/@phosphor-icons/core/assets/regular/', import.meta.url))

/** What each grid name and alias drew before Sprint 169 (iconSet.ts on main): an old deck must draw the same. */
const BEFORE: Record<string, [name: string, phosphor: string]> = {
  'list-checks': ['list-checks', 'list-checks'], 'book-open': ['book-open', 'book-open'], 'puzzle': ['puzzle', 'puzzle-piece'],
  'wrench': ['wrench', 'wrench'], 'folder-open': ['folder-open', 'folder-open'], 'mail': ['mail', 'envelope-simple'],
  'calendar': ['calendar', 'calendar'], 'globe': ['globe', 'globe'], 'users': ['users', 'users'], 'user-check': ['user-check', 'user-check'],
  'shield-check': ['shield-check', 'shield-check'], 'lightbulb': ['lightbulb', 'lightbulb'], 'target': ['target', 'target'],
  'clock': ['clock', 'clock'], 'chart-column': ['chart-column', 'chart-bar'], 'table': ['table', 'table'],
  'search-check': ['search-check', 'magnifying-glass'], 'message-square': ['message-square', 'chat-text'], 'file-text': ['file-text', 'file-text'],
  'bot': ['bot', 'robot'], 'sparkles': ['sparkles', 'sparkle'], 'circle-help': ['circle-help', 'question'],
  'triangle-alert': ['triangle-alert', 'warning'], 'circle-check': ['circle-check', 'check-circle'],
  'puzzle-piece': ['puzzle', 'puzzle-piece'], 'envelope': ['mail', 'envelope-simple'], 'chat': ['message-square', 'chat-text'],
  'message': ['message-square', 'chat-text'], 'chart': ['chart-column', 'chart-bar'], 'search': ['search-check', 'magnifying-glass'],
  'robot': ['bot', 'robot'], 'sparkle': ['sparkles', 'sparkle'], 'help': ['circle-help', 'question'], 'warning': ['triangle-alert', 'warning'],
  'check': ['circle-check', 'check-circle'], 'book': ['book-open', 'book-open'], 'folder': ['folder-open', 'folder-open'],
}

test('the generated modules are @phosphor-icons/core 2.1.1: every regular drawing, and its tags', () => {
  const files = readdirSync(core).filter(file => file.endsWith('.svg')).map(file => file.slice(0, -4)).sort()
  assert.equal(files.length, 1512)
  assert.deepEqual([...PAGE_ICON_NAMES], files, 'pageIcons.ts has every regular icon, in order')
  assert.deepEqual(Object.keys(ICON_TAGS), files, 'iconIndex.ts has every regular icon, in order')
  for (const icon of catalog) {
    const tags = [...new Set(icon.tags.filter(tag => !tag.startsWith('*')).map(tag => tag.trim().toLowerCase()))].filter(Boolean)
    assert.equal(ICON_TAGS[icon.name as keyof typeof ICON_TAGS], tags.join(ICON_TAG_SEPARATOR), `${icon.name}'s tags; run node scripts/generate-page-icons.mjs`)
  }
  assert.ok(!Object.values(ICON_TAGS).some(tags => tags.includes('*new*') || tags.includes('*updated*')), 'no catalog marks')
})

test('every name in the set resolves, in any case and spacing', () => {
  for (const name of PAGE_ICON_NAMES) {
    const icon = slideIcon(name)
    assert.ok(icon, name)
    assert.deepEqual(boxIconOf(` ${name.toUpperCase()} `), { known: true, name: icon.name, phosphor: icon.phosphor }, name)
    assert.ok(Object.prototype.hasOwnProperty.call(PAGE_ICON_PATHS, icon.phosphor), `${name} draws a drawing the module has`)
    // Its own drawing, but where an old deck's name reads it as one of the grid's (S8).
    if (icon.phosphor !== name) assert.ok(Object.prototype.hasOwnProperty.call(BEFORE, name), `${name} draws ${icon.phosphor}`)
  }
  assert.deepEqual(slideIcon('truck'), { name: 'truck', phosphor: 'truck', label: 'Truck' })
  assert.deepEqual(slideIcon('User-Circle'), { name: 'user-circle', phosphor: 'user-circle', label: 'User circle' })
  assert.deepEqual(boxIconOf(' Rocket-Launch '), { known: true, name: 'rocket-launch', phosphor: 'rocket-launch' })
  // A Phosphor name one of the 24 draws is that grid icon, so the menu marks it either way.
  assert.equal(slideIcon('envelope-simple')?.name, 'mail')
  assert.equal(slideIcon('magnifying-glass')?.name, 'search-check')
  // The dashed circle is an icon of its own when a box names it (in the icon's colour, not the placeholder's).
  assert.deepEqual(boxIconOf(UNKNOWN_ICON), { known: true, name: 'circle-dashed', phosphor: 'circle-dashed' })
})

test('the 24 and their aliases resolve as before, so an old deck reads and draws the same', () => {
  assert.equal(SLIDE_ICON_NAMES.length, 24)
  assert.deepEqual([...SLIDE_ICON_NAMES, ...SLIDE_ICON_ALIASES].sort(), Object.keys(BEFORE).sort())
  for (const [name, [written, phosphor]] of Object.entries(BEFORE)) {
    for (const lookup of [slideIcon, gridIcon]) {
      const icon = lookup(name)
      assert.equal(icon?.name, written, `${lookup.name}(${name})`)
      assert.equal(icon?.phosphor, phosphor, `${lookup.name}(${name})`)
    }
    assert.equal(slideIcon(` ${name.toUpperCase()} `)?.phosphor, phosphor, name)
  }
  // The old layout's picker and drawing keep to the 24 (Sprint 169 PR 2 widens them).
  assert.equal(gridIcon('truck'), null)
  assert.equal(gridIcon('envelope-simple'), null)
})

test('an unknown name still falls back to the dashed circle, as written', () => {
  for (const name of ['not-a-real-icon', 'zebra-crossing', 'rocket-launchpad', 'truck ship', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(slideIcon(name), null, name)
    assert.deepEqual(boxIconOf(` ${name} `), { known: false, name, phosphor: UNKNOWN_ICON }, name)
  }
  for (const none of [undefined, '', '   ']) assert.equal(boxIconOf(none), null)
})

test('the search finds "truck", "people" and "mail"', () => {
  const names = (query: string) => searchIcons(query).map(icon => icon.name)
  const truck = names('truck')
  assert.equal(truck[0], 'truck', 'the name itself first')
  for (const name of ['truck-trailer', 'fire-truck']) assert.ok(truck.includes(name), `truck: ${name}`)
  assert.ok(!truck.includes('text-strikethrough'), 'a tag that only holds the word is no match')
  // People: Phosphor's tag; the grid's own icon first.
  const people = names('people')
  assert.equal(people[0], 'users')
  for (const name of ['users-three', 'users-four']) assert.ok(people.includes(name), `people: ${name}`)
  // Mail: the grid's name first (envelope-simple), then the other envelopes by their tag.
  const mail = searchIcons('Mail ')
  assert.deepEqual(mail[0], SLIDE_ICONS.find(icon => icon.name === 'mail'))
  for (const name of ['mailbox', 'envelope-open', 'envelope-simple-open']) assert.ok(mail.some(icon => icon.name === name), `mail: ${name}`)
  // More words, and spaces for hyphens.
  assert.equal(names('user circle')[0], 'user-circle')
  assert.ok(names('first aid').includes('first-aid'))
  assert.ok(names('invoice').length > 0 && names('brain')[0] === 'brain')
})

test('the search finds nothing for nonsense or nothing, and offers only names that draw what it shows', () => {
  assert.deepEqual(searchIcons('zzzq'), [])
  assert.deepEqual(searchIcons(''), [])
  assert.deepEqual(searchIcons('   '), [])
  // `check` is the grid's circled check in an old deck, so Phosphor's own tick (no name reaches it) isn't offered.
  const check = searchIcons('check')
  assert.equal(check[0].phosphor, 'check-circle')
  assert.ok(!check.some(icon => icon.phosphor === 'check'))
  // Whatever it offers, writing its name draws that same icon; each icon once.
  const seen = new Set<string>()
  for (const letter of 'abcdefghijklmnopqrstuvwxyz0123456789') {
    const found = searchIcons(letter)
    assert.equal(new Set(found.map(icon => icon.phosphor)).size, found.length, `${letter}: each icon once`)
    for (const icon of found) {
      assert.equal(slideIcon(icon.name)?.phosphor, icon.phosphor, `${letter}: ${icon.name}`)
      seen.add(icon.phosphor)
    }
  }
  // Every drawing a name reaches can be found: all but the five an old deck's alias reads as the grid's.
  assert.equal(seen.size, PAGE_ICON_NAMES.length - 5)
  // A query is text, never a pattern.
  for (const query of ['.*', '(', '[', '\\', '?', '+']) assert.doesNotThrow(() => searchIcons(query), query)
})

console.log(`iconSearch: ${passed} passed`)
