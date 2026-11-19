/**
 * Sprint 166 PR 5 (#841): a Quote on a slide carries no fill or border from outside. VS Code's webview stylesheet gives
 * every blockquote a fill (`--vscode-textBlockQuote-background`) and a border colour; `.ProseMirror blockquote` adds a
 * 3 px border and its own padding. On a dark slide that drew a near-white box. slide.css (the one sheet the stage, the
 * strip, the wall, the presenter view and the page draw with) now sets each of those itself, with a selector that
 * outranks both. The page keeps its look: the same padding and colour it had. Inline code on a slide likewise takes the
 * slide's colour, never VS Code's `code` colour. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const sheet = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const rulesOf = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }))
const slideRules = rulesOf(sheet('./slide.css'))
const editorRules = rulesOf(sheet('../decks.css'))

function decls(body: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at > 0) found[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return found
}

/** Specificity as [ids, classes, elements] for a plain selector chain (no pseudo-classes or attributes). */
function specificity(sel: string): [number, number, number] {
  assert.ok(!/[:[]/.test(sel), `plain selector: ${sel}`)
  const ids = (sel.match(/#[\w-]+/g) ?? []).length
  const classes = (sel.match(/\.[\w-]+/g) ?? []).length
  const elements = sel.split(/[\s>+~]+/).filter((p) => /^[a-z]/i.test(p)).length
  return [ids, classes, elements]
}
function beats(a: string, b: string): boolean {
  const x = specificity(a)
  const y = specificity(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

const sel = '.deck-sl.is-blocks blockquote'
const own = slideRules.filter((r) => r.sel === sel)
assert.equal(own.length, 1, 'slide.css has one rule for the slide quote')
const q = decls(own[0].body)

// No outside fill or border: each is set by the slide itself.
assert.equal(q.background, 'none', 'no fill from VS Code')
assert.equal(q.border, '0', 'no border from VS Code or .ProseMirror (3 px)')
assert.equal(q['border-radius'], '0')
// Its own padding on all four sides, the page's look of today, and its own colour.
assert.equal(q.padding, '0 0 0 .8em')
assert.ok(!('padding-left' in q), 'one padding shorthand')
assert.equal(q.color, 'var(--s-sub, #C7CAEB)', 'the sub colour, as today')
// The accent bar the slide draws stays.
assert.match(q['box-shadow'], /^inset 3px 0 0 var\(--s-accl/)

// The selector outranks VS Code's `blockquote` and `.ProseMirror blockquote`, whatever the sheets' order.
assert.ok(beats(sel, 'blockquote'))
assert.ok(beats(sel, '.ProseMirror blockquote'))

// No other rule, in the shared sheet or the editor's own, draws a box or bar on a slide's quote again.
const boxy = /(^|;)\s*(background|border|box-shadow|outline)[\w-]*\s*:/
for (const r of [...slideRules, ...editorRules]) {
  if (!/blockquote/.test(r.sel) || r.sel === sel) continue
  assert.ok(!boxy.test(r.body), `no fill, border, shadow or outline in: ${r.sel}`)
}

// Inline code takes the slide's colour, never VS Code's `code` colour (the same leak as the quote's).
const code = slideRules.filter((r) => r.sel === '.deck-sl.is-blocks code')
assert.equal(code.length, 1)
assert.equal(decls(code[0].body).color, 'inherit')

console.log('slideQuote: ok')
