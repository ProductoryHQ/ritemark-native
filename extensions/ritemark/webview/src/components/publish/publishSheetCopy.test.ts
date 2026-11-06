/**
 * Sprint 149 (R4, R5, S7, S13, S14, S15): the Publish sheet's words, as the Experience lead wrote them (answers 3 and
 * 4), and the sheet's buttons: Cancel becomes the main button and Publish reads "Publish anyway" when something looks
 * like a key. Also the sheet's source: shared Button and Tooltip only, no native `title`, no hand-rolled `<button>`.
 *
 * Run: npx tsx webview/src/components/publish/publishSheetCopy.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  keyWarning,
  leftOutCount,
  leftOutName,
  leftOutReasonFor,
  leftOutTip,
  limitLine,
  openWords,
  ringedButton,
  sheetButtons,
  showsFileList,
  whatGoesLine,
  WHO_CAN_SEE,
  NOTHING_ELSE,
} from './publishSheetCopy'
import type { FileKind } from '../../../../src/publish/types'

const page = { kind: 'page' as FileKind }
const of = (...kinds: FileKind[]) => [page, ...kinds.map((kind) => ({ kind }))]

// The line (answer 3, S7)
assert.equal(whatGoesLine(of()), 'This page, one file')
assert.equal(whatGoesLine(of('picture', 'picture')), 'This page and its 2 pictures')
assert.equal(whatGoesLine(of('picture')), 'This page and its picture')
assert.equal(whatGoesLine(of('style', 'style', 'style')), 'This page and its 3 styles')
assert.equal(whatGoesLine(of('font', 'font')), 'This page and its 2 fonts')
assert.equal(whatGoesLine(of('script')), 'This page and its script')
assert.equal(whatGoesLine(of('picture', 'picture', 'style', 'font')), 'This page and 4 files', 'S7: mixed kinds')
assert.equal(whatGoesLine(of('other', 'other')), 'This page and 2 files', 'videos and others are files')
assert.equal(whatGoesLine(of('other')), 'This page and one file')
assert.equal(NOTHING_ELSE, 'Nothing else from the project.')
assert.equal(WHO_CAN_SEE, "Anyone with the link can open the page. It isn't listed or searchable, and you can unpublish it any time.")

// Left out, the five reasons (answer 3), a link (review of #669) and a path Git can't check (minor 6)
const reasons = (['outside', 'hidden', 'toolFolder', 'gitIgnored', 'otherPage', 'link', 'gitUnchecked'] as const).map((reason) => leftOutReasonFor({ name: 'x', display: 'x', reason }))
assert.deepEqual(reasons, ['outside this project', 'a hidden file', "a tool's folder", 'Git ignores it', "another page, so its link won't work", "a linked file, so its link won't work", "couldn't be checked"])
const folded = { name: '', display: '', reason: 'otherPage' as const, count: 7 }
assert.equal(leftOutName(folded), '7 other pages', 'A3 finding 3: folded')
assert.equal(leftOutReasonFor(folded), "so their links won't work")
assert.equal(leftOutTip(folded), null, 'a folded row has no path to show')
assert.equal(leftOutCount([{ name: 'a', display: 'a', reason: 'outside' }, folded]), 8)

// The lead's change 2: a left-out row starts with the file's name; the path is its tooltip, never its text
const budget = { name: 'budget.png', display: '../../secrets/budget.png', reason: 'outside' as const }
assert.equal(`${leftOutName(budget)} · ${leftOutReasonFor(budget)}`, 'budget.png · outside this project')
assert.equal(leftOutTip(budget), '../../secrets/budget.png')
const chart = { name: 'chart.js', display: 'node_modules/chart/chart.js', reason: 'toolFolder' as const }
assert.equal(`${leftOutName(chart)} · ${leftOutReasonFor(chart)}`, "chart.js · a tool's folder")
const notes = { name: 'notes.png', display: 'drafts/notes.png', reason: 'gitIgnored' as const }
assert.equal(`${leftOutName(notes)} · ${leftOutReasonFor(notes)}`, 'notes.png · Git ignores it')
const doc = { name: 'notes.md', display: 'notes.md', reason: 'link' as const }
assert.equal(`${leftOutName(doc)} · ${leftOutReasonFor(doc)}`, "notes.md · a linked file, so its link won't work")

// The lead's change 1: no fold for "This page, one file" with nothing left out
assert.equal(showsFileList(1, []), false, 'nothing to see beyond the line')
assert.equal(showsFileList(2, []), true, 'the page uses a file')
assert.equal(showsFileList(1, [doc]), true, 'something is left out')

// The key warning (answer 4, S14): one place, then several
const hit = (index: number, fileName = 'script.js', line = 12) => ({ index, fileName, line })
const one = keyWarning([hit(0)])!
assert.equal(`${one.lead} ${one.places[0].words}. ${one.tail}`, 'This looks like a key or password: script.js, line 12. Anyone with the link could read it and use it.')
assert.equal(openWords(hit(0)), 'Open script.js')
const five = keyWarning([hit(0), hit(1, 'page.html', 3), hit(2, 'style.css', 40), hit(3), hit(4)])!
assert.equal(five.lead, '5 things look like keys or passwords:')
assert.deepEqual(five.places.map((p) => p.words), ['script.js, line 12', 'page.html, line 3', 'style.css, line 40'])
assert.equal(five.more, 'and 2 more')
assert.equal(keyWarning([hit(0), hit(1)])!.more, '')
// The lead's change 3: four places show the fourth instead of "and 1 more"; "and N more" starts at 2
const four = keyWarning([hit(0), hit(1, 'data.js', 1), hit(2, 'data.js', 2), hit(3, 'page.html', 4)])!
assert.deepEqual(four.places.map((p) => p.words), ['script.js, line 12', 'data.js, line 1', 'data.js, line 2', 'page.html, line 4'])
assert.equal(four.more, '', 'never "and 1 more"')
assert.equal(keyWarning([hit(0), hit(1)])!.places.length, 2)
assert.equal(keyWarning([hit(0), hit(1), hit(2)])!.places.length, 3)
assert.deepEqual([five.places.length, five.more], [3, 'and 2 more'], 'five: three places and "and 2 more"')
assert.equal(keyWarning([]), null)

// The buttons (decision 2)
assert.deepEqual(
  [sheetButtons(false, false).main, sheetButtons(false, false).publishWords, sheetButtons(false, false).publishDisabled],
  ['publish', 'Publish', false],
)
assert.deepEqual(
  [sheetButtons(true, false).main, sheetButtons(true, false).publishWords, sheetButtons(true, false).publishDisabled],
  ['cancel', 'Publish anyway', false],
  'a hit: Cancel is the main button, "Publish anyway" the quiet one',
)
assert.equal(sheetButtons(true, true).publishDisabled, true, 'over a limit nothing can be sent')
for (const b of [sheetButtons(false, false), sheetButtons(true, false), sheetButtons(false, true)]) {
  assert.ok(b.publishTip.length > 0 && b.cancelTip.length > 0, 'every button has a tooltip')
}

// A waiting Publish isn't ringed (the lead, PR 4 round 3): Enter does nothing while Publish waits, so nothing is ringed;
// the ring is back on Publish as soon as it can be pressed. Cancel, when it is the main button, keeps its ring.
assert.equal(ringedButton(sheetButtons(false, false)), 'publish', 'Publish ready: ringed')
assert.equal(ringedButton({ ...sheetButtons(false, false), publishDisabled: true }), null, 'Publish waiting (random end, taken name, invalid address, the check): nothing ringed')
assert.equal(ringedButton({ main: 'publish', publishDisabled: false }), 'publish', 'after Put it back, or once name and address are fine: ringed again')
assert.equal(ringedButton(sheetButtons(true, false)), 'cancel', 'a key found: Cancel ringed')
assert.equal(ringedButton(sheetButtons(true, true)), 'cancel', 'over a limit: Cancel ringed, Enter closes')

// Limits (R3, S15)
assert.equal(limitLine([{ name: 'clip.mp4', size: 30 * 1024 * 1024 }], false), 'clip.mp4 is too big to publish (30 MB). A file can be up to 25 MB.')
assert.equal(limitLine([], true), 'This page uses more than 20,000 files, too many to publish.')
assert.equal(limitLine([], false), null)

// Plain words: none of the machinery's
const words = [whatGoesLine(of('picture')), WHO_CAN_SEE, one.lead, one.tail, ...reasons, sheetButtons(true, false).publishTip, sheetButtons(false, false).publishTip].join(' ')
for (const banned of ['HTML', 'deploy', 'Worker', 'host', 'upload']) assert.ok(!words.includes(banned), `no "${banned}" on screen`)

// The sheet's source: shared Button and Tooltip, no native title or <button>, no value shown
const HERE = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(HERE, 'PublishSheet.tsx'), 'utf8')
assert.ok(!/<button\b/.test(source), 'no hand-rolled <button>')
assert.ok(!/\stitle=/.test(source), 'no native title')
assert.equal((source.match(/<Tooltip\b[^>]*>\s*<Button\b/g) ?? []).length, (source.match(/<Button\b/g) ?? []).length, 'every Button sits in a Tooltip')
// The lead's sheet behaviour: the default button is ringed while the sheet holds the focus, and Enter presses it
assert.ok(source.includes('group/sheet') && /const ringed = ringedButton\(buttons\)/.test(source), 'the ring follows the buttons as the sheet shows them, waiting Publish included')
for (const which of ['publish', 'cancel']) {
  assert.ok(new RegExp(`className=\\{ringed === '${which}' \\? DEFAULT_RING`).test(source), `${which}: ringed only when ringedButton says so`)
  assert.ok(new RegExp(`data-default=\\{ringed === '${which}' \\? ''`).test(source), `${which}: data-default follows the ring`)
}
assert.ok(!/buttons\.main === '(?:publish|cancel)' \? DEFAULT_RING/.test(source), 'never ringed by the main button alone')
assert.ok(/event\.key === 'Enter' && event\.target === event\.currentTarget/.test(source), 'Enter on the sheet presses the default button')
assert.ok(/\{fold && \(/.test(source), 'See the files only when there is something to see')
assert.ok(source.includes("name=\"shield-warning\""), 'the key warning carries shield-warning')
assert.ok(!/text-(?:destructive|warning|amber|red)|bg-(?:destructive|warning|amber|red)/.test(source), 'the warning is in ink: no amber, no red')

console.log('publishSheetCopy.test: passed')
