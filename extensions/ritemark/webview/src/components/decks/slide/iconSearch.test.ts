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
import { PAGE_ICON_NAMES, PAGE_ICON_PATHS, isPageIconName } from './pageIcons'
import { SLIDE_ICONS, SLIDE_ICON_ALIASES, SLIDE_ICON_NAMES, UNKNOWN_ICON, boxIconOf, slideIcon } from './iconSet'
import { searchIcons } from './iconSearch'

let passed = 0
function test(name: string, run: () => void) {
  run()
  passed++
  console.log(`ok - ${name}`)
}

const core = fileURLToPath(new URL('../../../../../node_modules/@phosphor-icons/core/assets/regular/', import.meta.url))
// The generator's own reading of an icon's tags (review of #879: one rule, so a regenerated index can't drift from it).
const generator = new URL('../../../../../scripts/generate-page-icons.mjs', import.meta.url).href
const { iconTags } = (await import(generator)) as { iconTags: (name: string) => string[] }

/**
 * What each grid name and alias drew before Sprint 169 (iconSet.ts on main). An old deck draws the same, but for the
 * five Phosphor has icons of its own by (`NOW_PHOSPHOR`): a Phosphor name always means Phosphor's icon (the Experience
 * lead, 19 November; 2.3 isn't out, so no released deck changes).
 */
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
const NOW_PHOSPHOR = ['check', 'envelope', 'chat', 'book', 'folder']

test('the generated modules are @phosphor-icons/core 2.1.1: every regular drawing, and its tags', () => {
  const files = readdirSync(core).filter(file => file.endsWith('.svg')).map(file => file.slice(0, -4)).sort()
  assert.equal(files.length, 1512)
  assert.deepEqual([...PAGE_ICON_NAMES], files, 'pageIcons.ts has every regular icon, in order')
  assert.deepEqual(Object.keys(ICON_TAGS), files, 'iconIndex.ts has every regular icon, in order')
  assert.deepEqual(catalog.map(icon => icon.name).sort(), files, "the catalog's names are the drawings'")
  for (const icon of catalog) {
    assert.equal(ICON_TAGS[icon.name as keyof typeof ICON_TAGS], iconTags(icon.name).join(ICON_TAG_SEPARATOR), `${icon.name}'s tags; run node scripts/generate-page-icons.mjs`)
  }
  assert.ok(ICON_TAGS.truck.split(ICON_TAG_SEPARATOR).includes('delivery') && ICON_TAGS.users.split(ICON_TAG_SEPARATOR).includes('people'))
  // The rule itself, apart from the generator: Phosphor's tags, lower case and trimmed, once each, no catalog marks.
  for (const icon of catalog) {
    const tags = ICON_TAGS[icon.name as keyof typeof ICON_TAGS].split(ICON_TAG_SEPARATOR).filter(Boolean)
    assert.equal(new Set(tags).size, tags.length, `${icon.name}: each tag once`)
    for (const tag of tags) {
      assert.ok(tag === tag.trim().toLowerCase() && !tag.startsWith('*'), `${icon.name}: ${tag}`)
      assert.ok(icon.tags.some(source => source.trim().toLowerCase() === tag), `${icon.name}: ${tag} is Phosphor's`)
    }
    for (const source of icon.tags) if (!source.startsWith('*') && source.trim()) assert.ok(tags.includes(source.trim().toLowerCase()), `${icon.name}: ${source} kept`)
  }
  assert.ok(!Object.values(ICON_TAGS).some(tags => tags.includes('*new*') || tags.includes('*updated*')), 'no catalog marks')
})

test('every name in the set resolves to its own icon, in any case and spacing; no alias shadows one', () => {
  for (const name of PAGE_ICON_NAMES) {
    const icon = slideIcon(name)
    assert.ok(icon, name)
    // The rule (the Experience lead on #879): a Phosphor name always means Phosphor's icon.
    assert.equal(icon.phosphor, name, `${name} draws its own icon`)
    assert.deepEqual(boxIconOf(` ${name.toUpperCase()} `), { known: true, name: icon.name, phosphor: icon.phosphor }, name)
    assert.ok(Object.prototype.hasOwnProperty.call(PAGE_ICON_PATHS, icon.phosphor), `${name} draws a drawing the module has`)
    // Written as Phosphor's name, or as the grid's for one of the 24's drawings.
    assert.ok(icon.name === name || SLIDE_ICONS.some(grid => grid.name === icon.name && grid.phosphor === name), `${name} is written ${icon.name}`)
  }
  // Ritemark's own names fill only names Phosphor doesn't have.
  for (const name of SLIDE_ICON_ALIASES) assert.ok(!isPageIconName(name), `the alias ${name} is no Phosphor name`)
  for (const icon of SLIDE_ICONS) assert.ok(!isPageIconName(icon.name) || icon.name === icon.phosphor, `the grid's ${icon.name} is no other Phosphor icon`)
  assert.deepEqual(slideIcon('truck'), { name: 'truck', phosphor: 'truck', label: 'Truck' })
  assert.deepEqual(slideIcon('User-Circle'), { name: 'user-circle', phosphor: 'user-circle', label: 'User circle' })
  assert.deepEqual(boxIconOf(' Rocket-Launch '), { known: true, name: 'rocket-launch', phosphor: 'rocket-launch' })
  // Spaces for hyphens, as the search reads them (review of #879).
  assert.deepEqual(boxIconOf('User  Circle'), { known: true, name: 'user-circle', phosphor: 'user-circle' })
  assert.equal(slideIcon('puzzle piece')?.name, 'puzzle')
  // A Phosphor name one of the 24 draws is that grid icon, so the menu marks it either way.
  assert.equal(slideIcon('envelope-simple')?.name, 'mail')
  assert.equal(slideIcon('magnifying-glass')?.name, 'search-check')
  // The dashed circle is an icon of its own when a box names it (in the icon's colour, not the placeholder's).
  assert.deepEqual(boxIconOf(UNKNOWN_ICON), { known: true, name: 'circle-dashed', phosphor: 'circle-dashed' })
})

test('the 24 and their old aliases draw as before, but for the five Phosphor names', () => {
  assert.equal(SLIDE_ICON_NAMES.length, 24)
  for (const name of [...SLIDE_ICON_NAMES, ...SLIDE_ICON_ALIASES]) assert.ok(Object.prototype.hasOwnProperty.call(BEFORE, name), name)
  for (const [name, [written, phosphor]] of Object.entries(BEFORE)) {
    if (NOW_PHOSPHOR.includes(name)) {
      assert.deepEqual(slideIcon(name), { name, phosphor: name, label: name.charAt(0).toUpperCase() + name.slice(1) }, `${name}: Phosphor's own`)
      continue
    }
    const icon = slideIcon(name)
    assert.equal(icon?.name, written, `slideIcon(${name})`)
    assert.equal(icon?.phosphor, phosphor, `slideIcon(${name})`)
    assert.equal(slideIcon(` ${name.toUpperCase()} `)?.phosphor, phosphor, name)
  }
  // Sprint 169 PR 2 (#867): the old layout reads a name as a block slide's box does (`boxIconOf`), the full set too.
  assert.equal(boxIconOf(' Puzzle Piece ')?.name, 'puzzle')
  assert.equal(boxIconOf('envelope-simple')?.name, 'mail')
  assert.deepEqual(boxIconOf('truck'), { known: true, name: 'truck', phosphor: 'truck' })
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
  // `check` is Phosphor's tick, offered first; the grid's circled check comes after it.
  const check = searchIcons('check')
  assert.deepEqual(check[0], { name: 'check', phosphor: 'check', label: 'Check' })
  assert.ok(check.some(icon => icon.name === 'circle-check' && icon.phosphor === 'check-circle'))
  for (const name of NOW_PHOSPHOR) assert.equal(searchIcons(name)[0].phosphor, name, name)
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
  // Every regular icon can be found.
  assert.equal(seen.size, PAGE_ICON_NAMES.length)
  // A query is text, never a pattern.
  for (const query of ['.*', '(', '[', '\\', '?', '+']) assert.doesNotThrow(() => searchIcons(query), query)
})

console.log(`iconSearch: ${passed} passed`)
