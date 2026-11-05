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
  limitLine,
  openWords,
  sheetButtons,
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

// Left out, the five reasons (answer 3)
const reasons = (['outside', 'hidden', 'toolFolder', 'gitIgnored', 'otherPage'] as const).map((reason) => leftOutReasonFor({ display: 'x', reason }))
assert.deepEqual(reasons, ['outside this project', 'a hidden file', "a tool's folder", 'Git ignores it', "another page, so its link won't work"])
assert.equal(leftOutName({ display: '', reason: 'otherPage', count: 7 }), '7 other pages', 'A3 finding 3: folded')
assert.equal(leftOutReasonFor({ display: '', reason: 'otherPage', count: 7 }), "so their links won't work")
assert.equal(leftOutCount([{ display: 'a', reason: 'outside' }, { display: '', reason: 'otherPage', count: 7 }]), 8)

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
assert.equal((source.match(/<Button\b/g) ?? []).length, (source.match(/<Tooltip\b/g) ?? []).length, 'every Button has a Tooltip')
assert.ok(source.includes("name=\"shield-warning\""), 'the key warning carries shield-warning')
assert.ok(!/text-(?:destructive|warning|amber|red)|bg-(?:destructive|warning|amber|red)/.test(source), 'the warning is in ink: no amber, no red')

console.log('publishSheetCopy.test: passed')
