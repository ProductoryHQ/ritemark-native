/**
 * #647: the editor's find marks take the search results list's marks, never the comment's amber.
 *
 * Run: npx tsx webview/src/extensions/findMarks.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FIND_MARK_STYLES } from './SearchExtension'

const here = new URL('.', import.meta.url)
const resultsCss = readFileSync(new URL('../components/search/search.css', here), 'utf8')
const indexCss = readFileSync(new URL('../index.css', here), 'utf8')

function rule(css: string, selector: string): string {
  const flat = css.replace(/\s+/g, ' ')
  const at = flat.indexOf(`${selector} {`)
  assert.ok(at >= 0, `no rule for ${selector}`)
  return flat.slice(at, flat.indexOf('}', at))
}

// Light desk: the results list's tokens
assert.match(rule(FIND_MARK_STYLES, '.find-highlight'), /background: var\(--r-hairline\);/)
assert.match(resultsCss, /\.rs-column mark \{ background: var\(--r-hairline\);/)

// The current match: the chosen fill in both themes, never overridden on Dark
assert.match(rule(FIND_MARK_STYLES, '.find-highlight-active'), /background: var\(--r-accent-soft\);/)
assert.equal(FIND_MARK_STYLES.match(/\.find-highlight-active/g)?.length, 1, 'the current match has one rule, no Dark override')

// Dark desk: the other matches take the results list's own lifted step
assert.ok(resultsCss.includes('rgba(199, 210, 254, 0.18)'), 'results list no longer uses its 0.18 step')
assert.match(FIND_MARK_STYLES, /vscode-dark'\] \.find-highlight \{ background: rgba\(199, 210, 254, 0\.18\)/)
assert.ok(!FIND_MARK_STYLES.includes('0.32'), 'the current match has no Dark override')

// Never the comment's colour: no amber, no warning token, not the comment mark's own values
const commentLight = /mark\.ritemark-comment-mark \{[^}]*background-color: (#[0-9A-Fa-f]+)/.exec(indexCss)?.[1]
const commentDark = /mark\.ritemark-comment-mark \{[^}]*background-color: (rgba\([^)]+\))/.exec(indexCss.slice(indexCss.indexOf('.ritemark-dark .ProseMirror mark.ritemark-comment-mark')))?.[1]
assert.ok(commentLight && commentDark, 'comment mark colours not found')
for (const forbidden of [commentLight, commentDark, '255, 200, 0', '255, 180, 0', '251, 191, 36', '--r-warning', 'amber']) {
  assert.ok(!FIND_MARK_STYLES.toLowerCase().includes(forbidden.toLowerCase()), `find marks use the comment colour ${forbidden}`)
}

console.log('findMarks: ok')
