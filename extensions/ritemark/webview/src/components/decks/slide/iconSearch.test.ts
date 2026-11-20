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
import { ICON_MENU_PAGE, deckIconsInUse, editsBetween, iconMenuChoices, iconMenuMoreLine, iconMenuMove, iconMenuStartQuery, searchIcons } from './iconSearch'

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

test("PR 3 (#868): the deck's icons in use, in the order it first uses them, each once, known ones only", () => {
  const slides = [
    { kind: 'boxes', data: { title: 'One', items: [{ icon: 'truck' }, { icon: 'Mail' }, { icon: 'not-a-real-icon' }, {}] } },
    // A layout that draws no item's icon: its items' icons are in use nowhere.
    { kind: 'title', data: { title: 'Cover', items: [{ icon: 'acorn' }] } },
    { kind: 'blocks', data: { markdown: '# Two\n\n:::: boxes\n::: {.box icon="brain"}\n### A\n:::\n::: {.box icon="truck"}\n:::\n::: box\n:::\n::::\n::: {.column icon="rocket"}\n:::' } },
    // A `:::` line inside a code block is code, not a box; `envelope-simple` is the grid's mail, already in.
    { kind: 'blocks', data: { markdown: '```\n::: {.box icon="rocket"}\n```\n::: {.box icon=envelope-simple}\n:::\n~~~~\n::: {.box icon="acorn"}\n~~~\n~~~~\n::: {.box icon=\'users\'}\n:::' } },
    { kind: 'boxes', data: {} },
  ]
  assert.deepEqual(deckIconsInUse(slides).map(icon => icon.name), ['truck', 'mail', 'brain', 'users'])
  assert.deepEqual(deckIconsInUse([]), [])
  // A Boxes block set to Number, Dot or Arrow draws its own mark: its boxes' icons are in use nowhere, and count again
  // once it is Icon. A box after the block closes counts as before.
  const boxes = (look: string) => [{ kind: 'blocks', data: { markdown: `:::: {.boxes${look}}\n::: {.box icon="truck"}\n### A\n:::\n::::\n\n::: {.box icon="brain"}\n:::` } }]
  for (const look of [' look="steps"', ' look="line"', ' look="arrows"']) assert.deepEqual(deckIconsInUse(boxes(look)).map(icon => icon.name), ['brain'], look)
  for (const look of ['', ' look="boxes"', ' look="something-new"']) assert.deepEqual(deckIconsInUse(boxes(look)).map(icon => icon.name), ['truck', 'brain'], look || 'Icon')
})

test('PR 3: before typing, the icons in use, then the 24, each once; then results, a page at a time', () => {
  const inUse = deckIconsInUse([{ kind: 'boxes', data: { items: [{ icon: 'truck' }, { icon: 'brain' }, { icon: 'users' }] } }])
  const before = iconMenuChoices('', inUse)
  assert.equal(before.searching, false)
  // In use first (users among them), then the 24 without users: 3 + 23.
  assert.deepEqual(before.icons.slice(0, 3).map(icon => icon.name), ['truck', 'brain', 'users'])
  assert.deepEqual(before.icons.slice(3).map(icon => icon.name), SLIDE_ICON_NAMES.filter(name => name !== 'users'))
  assert.equal(before.total, 26)
  assert.deepEqual(iconMenuChoices('   ', []).icons.map(icon => icon.name), [...SLIDE_ICON_NAMES], 'no deck icons: the 24')
  // Typing: the search's results, best first, whatever is in use.
  const truck = iconMenuChoices('truck', inUse)
  assert.equal(truck.searching, true)
  assert.equal(truck.icons[0].name, 'truck')
  assert.deepEqual(truck.icons, searchIcons('truck').slice(0, ICON_MENU_PAGE))
  // A short query finds many: a page of them, and how many there are.
  const many = iconMenuChoices('a', [])
  assert.equal(many.icons.length, ICON_MENU_PAGE)
  assert.ok(many.total > ICON_MENU_PAGE)
  // The quiet line under them (the Experience lead on #908); none when all are shown.
  assert.equal(iconMenuMoreLine(many.icons.length, many.total), `60 of ${many.total} · type more to narrow`)
  assert.equal(iconMenuMoreLine(4, 4), null)
  assert.equal(iconMenuMoreLine(0, 0), null)
  assert.equal(iconMenuChoices('people', []).icons[0].name, 'users')
  assert.equal(iconMenuChoices('mail', []).icons[0].phosphor, 'envelope-simple')
  // Nothing matches: no icons (the menu says "No icons match"; No icon stays at its foot).
  assert.deepEqual(iconMenuChoices('zzzz', inUse), { icons: [], total: 0, searching: true })
})

test('PR 3: a Phosphor name beats an alias and a tag', () => {
  // `folder` and `check` were aliases of the grid's; Phosphor's own icon comes first.
  assert.equal(iconMenuChoices('folder', []).icons[0].phosphor, 'folder')
  assert.equal(iconMenuChoices('check', []).icons[0].phosphor, 'check')
  // `search` is an alias (Phosphor has no `search`): the grid's magnifying glass first.
  assert.equal(iconMenuChoices('search', []).icons[0].phosphor, 'magnifying-glass')
  // A name it is beats a tag it is: `calendar` the icon, before icons tagged calendar.
  assert.equal(iconMenuChoices('calendar', []).icons[0].phosphor, 'calendar')
})

test('PR 3: ↑ and ↓ move the highlight a row at a time, to No icon at the foot and back to the field', () => {
  const move = (at: number, step: 1 | -1, count = 26, withNoIcon = true) => iconMenuMove(at, step === 1 ? 'down' : 'up', count, withNoIcon, 6)
  // From the field to the first icon, a row down each time, then No icon (place 26), where it stays.
  assert.deepEqual([-1, 0, 6, 12, 18, 24].map(at => move(at, 1)), [0, 6, 12, 18, 24, 26])
  assert.equal(move(20, 1), 26, 'the last full row: on to No icon')
  assert.equal(move(26, 1), 26)
  // Without No icon (a box with none), the last row goes to the last icon and stays there.
  assert.equal(move(20, 1, 26, false), 25)
  assert.equal(move(25, 1, 26, false), 25)
  // Up: a row back, from No icon to the last row's first, from the first row to the field.
  assert.deepEqual([26, 24, 6, 3, 0].map(at => move(at, -1)), [24, 18, 0, -1, -1])
  // Nothing found: ↓ reaches No icon alone; with none, nothing moves.
  assert.equal(move(-1, 1, 0, true), 0)
  assert.equal(move(0, -1, 0, true), -1)
  assert.equal(move(-1, 1, 0, false), -1)
  // ← and → walk the list one icon at a time, stopping at its ends; No icon and none stay.
  const side = (at: number, way: 'left' | 'right') => iconMenuMove(at, way, 26, true, 6)
  assert.deepEqual([0, 5, 24, 25].map(at => side(at, 'right')), [1, 6, 25, 25])
  assert.deepEqual([0, 1, 6].map(at => side(at, 'left')), [0, 0, 5])
  assert.equal(side(26, 'left'), 26)
  assert.equal(side(-1, 'right'), -1)
})

test('PR 4 (#869): a misspelt name finds the names nearest it, nearest first; nonsense still finds none', () => {
  const first = (query: string) => searchIcons(query)[0]?.phosphor
  assert.equal(first('trukc'), 'truck', 'two letters swapped')
  assert.equal(first('Trukc '), 'truck', 'any case and spacing')
  assert.ok(first('envelop')?.startsWith('envelope'), "a name it starts, as before (the grid's envelope first)")
  assert.equal(first('calender'), 'calendar', 'a letter changed')
  assert.equal(first('rocekt'), 'rocket')
  assert.ok(searchIcons('peple').some(icon => icon.name === 'users'), "a tag's word: people")
  assert.deepEqual(searchIcons('qqzx-wvvk'), [], 'nothing near: No icons match')
  for (const nonsense of ['qwe', 'abx', 'qwer', 'zxcv', 'zq']) assert.deepEqual(searchIcons(nonsense), [], `${nonsense}: under four letters or nothing near`)
  // An unknown name of several words (an AI's "delivery-van") finds what its words find, then what is near them.
  assert.deepEqual(searchIcons('delivery-van').map(icon => icon.phosphor).sort(), ['package', 'truck', 'van'])
  assert.ok(searchIcons('delivry-vann').some(icon => icon.phosphor === 'van'), 'near one of its words')
  // A search that finds names as before isn't widened by near ones.
  assert.ok(searchIcons('truck').every(icon => icon.phosphor.includes('truck') || ICON_TAGS[icon.phosphor].includes('truck')))
  assert.equal(editsBetween('trukc', 'truck', 1), 1)
  assert.equal(editsBetween('abc', 'abc', 1), 0)
  assert.equal(editsBetween('kitten', 'sitting', 2), 3, 'more than the limit: limit + 1')
  assert.equal(editsBetween('a', 'abcd', 1), 2)
})

test("PR 4: the menu's search starts with a box's unknown name, as written; a known icon or none starts it empty", () => {
  assert.equal(iconMenuStartQuery('trukc'), 'trukc')
  assert.equal(iconMenuStartQuery(' Not-A-Real-Icon '), 'Not-A-Real-Icon')
  assert.equal(iconMenuStartQuery('truck'), '')
  assert.equal(iconMenuStartQuery('mail'), '', 'an alias is known')
  assert.equal(iconMenuStartQuery(null), '')
  assert.equal(iconMenuStartQuery('  '), '')
})

console.log(`iconSearch: ${passed} passed`)
