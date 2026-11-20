/**
 * #931: the bar's "Saved as <name>" shows the whole name while it fits, and cuts only a name too long for the room, in
 * its middle, keeping its end and ".pdf"; the full words stay in the notice's tooltip.
 *
 * Run: npx tsx webview/src/components/decks/noticeCut.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CUT, fitNotice, middleCut } from './noticeCut'

const long = 'Day one – slides and handout.pdf'
// The middle cut keeps the start, the end and the extension.
assert.equal(middleCut(long, 23), 'Day one – sl…handout.pdf')
assert.equal(middleCut(long, long.length), long)
for (let keep = 2; keep < long.length; keep++) {
  const cut = middleCut(long, keep)
  assert.ok(cut.endsWith('.pdf'), `${keep}: keeps ".pdf"`)
  assert.equal(cut.split(CUT).length, 2, `${keep}: one cut`)
  assert.ok(cut.length <= Math.max(keep, '.pdf'.length + 1) + 1, `${keep}: no longer than asked, but for ".pdf"`)
}
// A name without an extension is cut in its middle too.
assert.equal(middleCut('Quarterly review notes', 10), 'Quart…notes')

// Fitting: a stand-in measure of one unit a character. The whole words while they fit, never cut then.
const room = (width: number) => (words: string) => words.length <= width
assert.equal(fitNotice('Saved as ', 'Day one.pdf', room(40)), 'Saved as Day one.pdf')
assert.equal(fitNotice('Saved as ', long, room(41)), `Saved as ${long}`)
// Too long for the room: the longest middle cut that fits, ".pdf" kept.
const fitted = fitNotice('Saved as ', long, room(30))
assert.ok(fitted.length <= 30 && fitted.endsWith('.pdf') && fitted.startsWith('Saved as Day one'), fitted)
assert.ok(fitNotice('Saved as ', long, room(29)).length < fitted.length + 1)
// No room at all: the shortest cut, still ending with its extension.
assert.ok(fitNotice('Saved as ', long, room(0)).endsWith('.pdf'))

// The notice passes its file name, and the bar draws such a notice with its words fitted; the tooltip has the whole.
const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8')
assert.match(view, /<Tooltip label=\{notice\.text\} className="deck-notice-words">\s*<NoticeWords text=\{notice\.text\} name=\{notice\.name\} \/>/)
const publish = readFileSync(new URL('./DeckPublish.tsx', import.meta.url), 'utf8')
assert.match(publish, /run: \(\) => sendToExtension\('deck\/pdf-show'\) \}, message\.name\)/)
// No fixed width: the note's words are as wide as the bar gives them.
const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8')
for (const rule of css.match(/\.deck-notice(?:-words|-text|-cut|-shown|-sizer)?(?![\w-])[^{]*\{[^}]*\}/g) ?? []) assert.doesNotMatch(rule, /(^|[\s;{])(max-)?width:\s*\d/, rule)

console.log('noticeCut: passed')
