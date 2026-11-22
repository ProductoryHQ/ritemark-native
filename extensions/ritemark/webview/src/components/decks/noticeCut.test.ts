/**
 * #931: the bar's "Saved as <name>" shows the whole name while it fits, and cuts only a name too long for the room, in
 * its middle, keeping its end and ".pdf"; the full words stay in the notice's tooltip.
 *
 * Run: npx tsx webview/src/components/decks/noticeCut.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CUT, charactersOf, cutName, fitNotice } from './noticeCut'

const long = 'Day one – slides and handout.pdf'
// The middle cut keeps the start, the end and the extension.
assert.equal(cutName(long, 23), 'Day one – sl…handout.pdf')
assert.equal(cutName(long, long.length), long)
for (let keep = 2; keep < long.length; keep++) {
  const cut = cutName(long, keep)
  assert.ok(cut.endsWith('.pdf'), `${keep}: keeps ".pdf"`)
  assert.equal(cut.split(CUT).length, 2, `${keep}: one cut`)
  assert.ok(cut.length <= Math.max(keep, '.pdf'.length + 1) + 1, `${keep}: no longer than asked, but for ".pdf"`)
}
// A name without an extension is cut in its middle too.
assert.equal(cutName('Quarterly review notes', 10), 'Quart…notes')

// Codex on #932: a cut never splits a character in two, an emoji or a joined emoji included: no lone surrogate.
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
for (const name of ['📊 Quarterly review.pdf', 'Q3 👩‍💻 review 📊.pdf', '🇪🇪🇫🇮🇸🇪.pdf']) {
  const whole = charactersOf(name)
  for (let keep = 2; keep <= whole.length; keep++) {
    const cut = cutName(name, keep)
    assert.ok(!loneSurrogate.test(cut), `${name} at ${keep}: no lone surrogate (${JSON.stringify(cut)})`)
    assert.ok(cut.endsWith('.pdf'), `${name} at ${keep}: keeps ".pdf"`)
    for (const part of charactersOf(cut)) assert.ok(part === CUT || whole.includes(part), `${name} at ${keep}: "${part}" is a whole character of the name`)
  }
}
assert.equal(cutName('📊 Quarterly review.pdf', 2), '📊….pdf')
assert.equal(cutName('🇪🇪🇫🇮🇸🇪.pdf', 6), '🇪🇪…🇸🇪.pdf')
assert.ok(fitNotice('Saved as ', '📊 Quarterly review.pdf', words => charactersOf(words).length <= 20).startsWith('Saved as 📊'))

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
assert.match(view, /<NoticeWords\s+text=\{notice\.text\}\s+name=\{notice\.name\}\s+after=/)
assert.match(view, /<Tooltip label=\{text\} className="deck-notice-words">\s*<span ref=\{shownRef\} className="deck-notice-shown"/)
const publish = readFileSync(new URL('./DeckPublish.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8')
assert.match(publish, /onNotice\(savedNotice\(message\.name\), showInFolder\(message\.name\), message\.name\)/)
// The Experience lead (#931): Show in folder is an icon button (folder-open, 14 in 24) with its tooltip and a name
// for a screen reader; the deck's own Saved steps aside while the note shows, and an edit ends the note.
assert.match(view, /<Icon name=\{notice\.action\.icon\} size=\{14\} \/>/)
assert.match(view, /aria-label=\{notice\.action\.ariaLabel \?\? notice\.action\.label\}/)
assert.match(view, /notice\?\.name \? null : \(/)
assert.match(view, /else if \(transaction\.docChanged && shown\?\.name\) setNotice\(null\)/)
assert.match(css, /\.deck-notice \.deck-notice-icon \{ width: 24px; height: 24px;/)
// The icon's focus ring (2 px at 2 px) clears the name by 4 px: an 8 px gap, the same in the fit's sum (the lead, #932).
assert.match(css, /\.deck-notice-line \{[^}]*gap: 8px;/)
assert.match(view, /const NOTICE_ACTION_GAP = 8\b/)
assert.match(css, /\.deck-notice \{[^}]*flex: 1 0 0;/, "the Saved as notice uses the shared leftover room")
// Outside the minimum-width probe the words are as wide as the bar gives them.
for (const rule of (css.match(/\.deck-notice(?:-words|-text|-cut|-shown|-sizer)?(?![\w-])[^{]*\{[^}]*\}/g) ?? []).filter(rule => !rule.includes('deck-notice-icon') && !rule.includes('data-measure-min'))) assert.doesNotMatch(rule, /(^|[\s;{])(max-)?width:\s*\d/, rule)

console.log('noticeCut: passed')
