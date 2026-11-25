/**
 * #931: the bar's "Saved as <name>" shows the whole name while it fits, and cuts only a name too long for the room, in
 * its middle, keeping its end and ".pdf"; the full words stay in the notice's tooltip.
 *
 * Run: npx tsx webview/src/components/decks/noticeCut.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CUT, charactersOf, cutName, fitNotice, hideClippedNotice } from './noticeCut'

import { updateDeckFailures } from './deckFailures'

const note = 'This deck is now a copy of Quarterly planning workshop'
const measure = (words: string) => charactersOf(words).length * 6
const minimum = measure('This deck is…')
assert.equal(hideClippedNotice(note, measure('Th'), undefined, measure), true)
const shortened = measure('This deck is no')
assert.ok(shortened < measure(note), 'CSS ellipsizes the visible note at this width')
assert.equal(hideClippedNotice(note, shortened, note, measure), false)
assert.equal(hideClippedNotice(note, measure(note), note, measure), false)
assert.equal(hideClippedNotice(note, minimum - 1, undefined, measure), true)
assert.equal(hideClippedNotice(note, minimum + 1, note, measure), true)
assert.equal(hideClippedNotice(note, minimum + 3, note, measure), false)
assert.equal(hideClippedNotice(note, minimum + 1, undefined, measure), false)

const short = 'Saved'
assert.equal(hideClippedNotice(short, measure(short), undefined, measure), false)
assert.equal(hideClippedNotice(short, measure(short) - 1, undefined, measure), true)
assert.equal(hideClippedNotice('  Save   done\n', measure('Save done') - 0.5, undefined, measure), false)

const newNote = 'This deck is ready for the workshop'
assert.equal(hideClippedNotice(newNote, minimum + 1, note, measure), false)

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

const saved = `Saved as ${long}`
const shortestSaved = `Saved as ${cutName(long, 2)}`
const savedMinimum = measure(shortestSaved)
assert.equal(hideClippedNotice(saved, 12.5, undefined, measure, shortestSaved), true)
assert.equal(hideClippedNotice(saved, savedMinimum - 1, undefined, measure, shortestSaved), true)
assert.equal(hideClippedNotice(saved, savedMinimum + 1, saved, measure, shortestSaved), true)
assert.equal(hideClippedNotice(saved, savedMinimum + 3, saved, measure, shortestSaved), false)

// The notice passes its file name, and the bar draws such a notice with its words fitted; the tooltip has the whole.
const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8')
assert.match(view, /<NoticeWords\s+text=\{notice\.text\}\s+name=\{notice\.name\}\s+after=/)
assert.match(view, /<Tooltip label=\{text\} className="deck-notice-words">\s*<span ref=\{shownRef\} className="deck-notice-shown"/)
const publish = readFileSync(new URL('./DeckPublish.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8')
assert.match(view, /hideClippedNotice\(text, room, shown\.dataset\.noteHidden, noticeMeasure\(shown, measure\), shortestCut\)/)
assert.match(css, /\.deck-notice:not\(\[data-measure-words\]\) > \.deck-notice-words:has\(> \.deck-notice-text\[data-note-hidden\]\),\s*\.deck-notice-line > \.deck-notice-words:has\(> \.deck-notice-shown\[data-note-hidden\]\) \{[^}]*position: absolute;[^}]*inline-size: 0;/)
assert.match(css, /\.deck-notice-text \{[^}]*text-overflow: ellipsis;/)
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

// A failure uses the same word threshold as a passing notice. Only the words leave the layout.
const failure = 'The slides could not be put in.'
assert.equal(hideClippedNotice(failure, measure(failure), undefined, measure), false)
const failureMinimum = measure('The slides c…')
assert.equal(hideClippedNotice(failure, failureMinimum - 1, undefined, measure), true)
assert.equal(hideClippedNotice(failure, failureMinimum, undefined, measure), false)
assert.match(css, /\.deck-notice > \.deck-notice-words \{[^}]*overflow: hidden;/)
assert.match(css, /\.deck-notice > \.deck-failure-words \{[^}]*min-width: 0;/)
assert.match(view, /role="status" aria-live="polite">\s*\{Array\.from\(failures\)\.map[\s\S]*?<Tooltip label=\{text\} className="deck-notice-warning">\s*<span role="img" tabIndex=\{0\} aria-label=\{text\}>\s*<Icon name="warning" size=\{16\} tone="inherit"[\s\S]*?<span className="inline-flex deck-notice-words deck-failure-words" aria-hidden="true">\s*<span className="deck-notice-text">\{text\}<\/span>/)
// The compact cap is the intrinsic width of the probe, with each action still in flow.
assert.match(css, /\.deck-notice\[data-measure-min\] \{ flex: none; width: max-content; min-width: 0; \}/)
assert.match(css, /\.deck-notice\[data-measure-min\] > \.deck-notice-words \{ flex: none; width: 1em; \}/)
assert.match(css, /\.deck-notice\[data-measure-min\] > \.deck-failure-words,\s*\.deck-notice\[data-measure-min\] \.deck-notice-sizer > :first-child \{ display: none; \}/)
assert.match(css, /\.deck-notice\[data-measure-min\] \.deck-notice-room \{ width: calc\(32px \+ 1em\); \}/)
assert.match(css, /\.deck-bar\[data-theme-compact\] > \.deck-notice \{ max-width: var\(--deck-notice-min\); \}/)
assert.match(css, /\.deck-notice > \.deck-notice-act \{ flex: none; \}/)
assert.match(css, /\.deck-notice-after \{ display: inline-flex; flex: none; \}/)
assert.match(view, /className="deck-notice-icon"[\s\S]*?onClick=\{\(\) => \{\s*notice\.action\?\.run\(\)/)
assert.match(view, /className="deck-line-action"\s+onClick=\{\(\) => \{\s*notice\.action\?\.run\(\)/)
assert.match(view, /onClick=\{\(\) => setSplitRequest\(value => value \+ 1\)\}>\s*Split at the cursor/)
assert.match(css, /\.deck-notice-warning \{ flex: none; color: var\(--r-deck-warning\); \}/)

// The passing-note timer and the edit/Undo dismissals only write the passing state.
assert.match(view, /window\.setTimeout\(\(\) => setNotice\(current => current === notice \? null : current\), NOTICE_MS\)/)
assert.match(view, /if \(next === failuresRef\.current\) return\s+failuresRef\.current = next\s+setFailures\(next\)\s+setNotice\(null\)/)
assert.match(view, /clearFailure\('insert-slides'\)\s*answer\(true\)/)

const insertFailed = updateDeckFailures(new Map(), 'insert-slides', { kind: 'failure', text: failure })
const bothFailed = updateDeckFailures(insertFailed, 'save-image', { kind: 'failure', text: 'The picture could not be saved.' })
assert.equal(updateDeckFailures(bothFailed, 'save-pdf', { kind: 'success' }), bothFailed)
const retried = updateDeckFailures(bothFailed, 'insert-slides', { kind: 'success' })
assert.deepEqual([...retried], [['save-image', 'The picture could not be saved.']])
assert.equal(updateDeckFailures(retried, 'save-image', { kind: 'success' }).size, 0)

const host = (file: string) => readFileSync(new URL(`../../../../src/decks/${file}`, import.meta.url), 'utf8')
const pages = host('deckPages.ts')
const repeated = updateDeckFailures(new Map(), 'deck/source-states', { kind: 'failure', text: failure })
assert.equal(updateDeckFailures(repeated, 'deck/source-states', { kind: 'failure', text: failure }), repeated)
assert.match(view, /if \(state\.fresh === false\) \{\s*startCardGone\.current = true\s*clearFailure\('start-card'\)/)
assert.match(view, /const hideStart = useCallback\(\(\) => \{\s*startCardGone\.current = true\s*clearFailure\('start-card'\)/)
assert.match(view, /if \(operation === 'start-card' && startCardGone\.current\) return/)
assert.match(view, /if \(stale\.length\) setNotice\(\{ text: .*left as it is now/)
assert.match(pages, /text: 'The library was changed since, so it is left as it is\.', kind: 'success', operation: request\.type/)
assert.match(pages, /if \(change\) \{[^}]+\}\s*await this\.post\(webview, \{ type: 'deck\/notice', text: '', kind: 'success', operation: `session-\$\{field\}`/)

const recovery: Array<[kind: string, success: string, source: string, handler: RegExp]> = [
  ['insert-slides', 'slides inserted', view, /clearFailure\('insert-slides'\)\s*answer\(true\)/],
  ['drop-pictures', 'pictures saved and inserted', view, /else clearFailure\('drop-pictures'\)/],
  ['copy-picture', 'picture copied', view, /if \(!copied\).*\n\s*clearFailure\('copy-picture'\)/],
  ['save-image', 'image saved', view, /clearFailure\('save-image'\)/],
  ['present', 'deck/present-started', view, /message\.type === 'deck\/present-started'[^\n]*\n\s*clearFailure\('present'\)/],
  ['publish', 'published', host('deckPublish.ts'), /if \(outcome === 'published'\) notice\('', 'success'\)/],
  ['save-pdf', 'named deck/pdf-saved', view, /if \(name\) clearFailure\('save-pdf'\)/],
  ['start-card', 'card gone or fresh:false', view, /if \(state\.fresh === false\) \{[^}]+clearFailure\('start-card'\)/],
  ['deck/source-states', 'source states received', view, /case 'deck\/source-states': \{\s*clearFailure\('deck\/source-states'\)/],
  ['deck/library-topics', 'library topics received', view, /case 'deck\/library-topics': \{\s*clearFailure\('deck\/library-topics'\)/],
  ['deck/add-to-library', 'library write added', view, /clearFailure\(message\.verb === 'added' \? 'deck\/add-to-library'/],
  ['deck/update-library', 'library write updated', view, /clearFailure\(message\.verb === 'added' .* : 'deck\/update-library'\)/],
  ['deck/use-library', 'library version inserted', view, /clearFailure\('deck\/use-library'\)/],
  ['deck/show-in-library', 'library focused', pages, /executeCommand\(.*SLIDE_LIBRARY_VIEW.*\);\s*await this\.post\(webview, \{ type: 'deck\/notice', text: '', kind: 'success', operation: request\.type/],
  ['deck/undo-library', 'library undone', view, /case 'deck\/library-undone': \{\s*clearFailure\('deck\/undo-library'\)/],
  ...(['start', 'end', 'length'] as const).map((field): [string, string, string, RegExp] => [
    `session-${field}`, 'session time saved or already current', pages, /kind: 'success', operation: `session-\$\{field\}`/,
  ]),
]
for (const [kind, success, source, handler] of recovery) {
  assert.match(source, handler, `${kind} → ${success}`)
  const failed = updateDeckFailures(new Map(), kind, { kind: 'failure', text: failure })
  assert.equal(updateDeckFailures(failed, kind, { kind: 'success' }).size, 0, `${kind} → ${success}`)
}

console.log('noticeCut: passed')
