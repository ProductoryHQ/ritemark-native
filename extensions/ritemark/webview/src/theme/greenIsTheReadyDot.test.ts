/**
 * Sprint 145 (#578, R6, S36): green appears only as the small "ready" dot (the Experience lead's framework, §3:
 * "One accent, no other hues"). A done mark, a saved line, a copied check or a valid key is drawn in ink.
 *
 * Scans the webview's source, in any letter case, for the ways green is written here: the success token; Tailwind's
 * green and emerald classes, with any prefix or `!`; VS Code's success and "added" colours (`--vscode-…` only);
 * Tailwind's green and emerald hex values, with or without alpha; and a colour property or attribute set to a named
 * green (`color: lime`, `fill="green"`). It fails on any use outside the list below, each with its reason. Not
 * scanned: rgb()/rgba()/hsl() values, and hex values outside Tailwind's green and emerald scales.
 *
 * Also pins a comment's done marks (the marker and the bubble are white in both themes): they take the fixed light
 * inks, and the theme's own tokens stay in charge of everything else there, so the marker's focus ring (drawn on the
 * desk) and the idle dot's ring keep their contrast in Dark (review round 3).
 *
 * Run: npx tsx webview/src/theme/greenIsTheReadyDot.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Tailwind's green and emerald scales, 50 to 950. */
const GREEN_HEX = 'f0fdf4|dcfce7|bbf7d0|86efac|4ade80|22c55e|16a34a|15803d|166534|14532d|052e16|ecfdf5|d1fae5|a7f3d0|6ee7b7|34d399|10b981|059669|047857|065f46|064e3b|022c22'
/** CSS's named greens. */
const NAMED_GREEN = String.raw`(?:lime|green|limegreen|forestgreen|seagreen|darkgreen|lightgreen|mediumseagreen|springgreen|lawngreen|palegreen|darkseagreen|lightseagreen|mediumspringgreen|yellowgreen|greenyellow)(?![\w-])`
/** Properties and attributes that take a colour, in CSS and in JSX style objects. */
const COLOUR_KEY = String.raw`(?:color|background|background-color|backgroundColor|fill|stroke|border|border-color|borderColor|outline|outline-color|outlineColor|stop-color|stopColor|accent-color|accentColor|caret-color|caretColor)`
const GREEN = new RegExp([
  String.raw`--r-success|--ritemark(?:-dark)?-success|ritemark-success`,
  String.raw`--vscode-(?:testing-iconPassed|charts-green|terminal-ansi(?:Bright)?Green|gitDecoration-addedResourceForeground|(?:editorGutter|minimapGutter|editorOverviewRuler)-added[\w-]*|diffEditor-inserted[\w-]*|notebookStatusSuccessIcon-foreground|debugIcon-startForeground|[\w-]*[Ss]uccess[\w-]*)`,
  String.raw`(?:^|[\s"'\x60:!])[a-z-]*-(?:green|emerald)-\d`,
  String.raw`#(?:${GREEN_HEX})(?:[0-9a-f]{2})?\b`,
  String.raw`(?:^|[^\w-])${COLOUR_KEY}['"]?\s*:\s*['"]?${NAMED_GREEN}`,
  String.raw`(?:^|[^\w-])${COLOUR_KEY}\s*=\s*\{?\s*['"]${NAMED_GREEN}`,
].join('|'), 'i')

/** Where green stays, by file and by what the line holds. */
const ALLOWED: Array<{ file: string; line: RegExp; why: string }> = [
  { file: 'index.css', line: /^\s*--(?:ritemark(?:-dark)?-success(?:-soft)?|r-success(?:-soft)?):/, why: 'the token itself' },
  { file: 'index.css', line: /^\s*--r-conversation-\d+:/, why: 'a conversation colour says which chat, not done' },
  { file: 'index.css', line: /^(?:body\.vscode-dark |body\.ritemark-dark |\.dark )?\.rm-step-chip\.action[ ,]/, why: "a Flow step's kind keeps one colour in both themes (experience 31): says which, not done" },
  { file: 'components/transcribe/workbench/playback.ts', line: /\{ dot: '#059669', text: '#047857' \}/, why: "a Transcribe speaker's colour says who" },
  { file: 'components/settings/RitemarkSettings.tsx', line: /h-1\.5 w-1\.5 rounded-full bg-\[#4ADE80\]/, why: "the window's traffic lights in Settings' theme pictures" },
  { file: 'components/settings/RitemarkSettings.tsx', line: /bg: 'bg-ritemark-success', pulse: false, ariaLabel: 'Status: ready'/, why: "Settings' runtime ready dot" },
  { file: 'components/transcribe/TranscribePanel.tsx', line: /engine\.readiness\.ready \? 'bg-ritemark-success'/, why: "a Transcribe engine's ready dot" },
  { file: 'components/agent/ProvenanceBadge.tsx', line: /label: 'ChatGPT'/, why: "ChatGPT's provenance badge says which, not done" },
]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const found: string[] = []
const used = new Set<number>()
for (const path of sources(root)) {
  const file = relative(root, path).split('\\').join('/')
  readFileSync(path, 'utf-8').split('\n').forEach((text, index) => {
    if (!GREEN.test(text)) return
    const allowed = ALLOWED.findIndex((entry) => entry.file === file && entry.line.test(text))
    if (allowed >= 0) used.add(allowed)
    else found.push(`${file}:${index + 1}: ${text.trim()}`)
  })
}

assert.deepEqual(found, [], `green outside the ready dot:\n${found.join('\n')}`)
// Every allowance still matches something, so the list can't hide a stale entry.
ALLOWED.forEach((entry, index) => assert.ok(used.has(index), `the allowance for ${entry.file} (${entry.why}) matches nothing`))

// ── A comment's done marks (review rounds 1–3) ──
// The marker and the bubble are white in both themes. Their done marks take the fixed light inks, as their words do
// (the theme's inks fade on white in Dark). Everything else there keeps the theme's tokens: a light-token block on
// the two surfaces (round 2) moved the marker's focus ring, which is drawn on the desk, to a dark indigo on Dark's
// dark desk, and faded the idle dot's ring.
const css = readFileSync(join(root, 'index.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Splits at the commas and combinators that are not inside parentheses or brackets. */
function topLevel(text: string, at: (char: string) => boolean): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (depth === 0 && at(char)) { parts.push(current); current = '' } else current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}
/** The element a selector styles: its last compound, without what `:not()` excludes. */
const subject = (selector: string) => (topLevel(selector, (char) => /[\s>+~]/.test(char)).pop() ?? '').replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ subjects: topLevel(match[1], (char) => char === ',').map(subject), body: match[2] }))
const hasClass = (compound: string, name: string) => new RegExp(`\\.${name}(?![\\w-])`).test(compound)
const styling = (name: string, also?: RegExp) => rules.filter((rule) => rule.subjects.some((compound) => hasClass(compound, name) && (!also || also.test(compound))))

for (const surface of ['rm-marker', 'rm-bubble']) {
  // Every rule that paints the surface itself (a dark-scoped, compound or pseudo-element one included) keeps it white
  const painting = styling(surface).filter((rule) => /(?:^|[;\s])background(?:-color)?\s*:/.test(rule.body))
  assert.ok(painting.length >= 1, `.${surface} has its background rule`)
  for (const rule of painting) assert.match(rule.body, /background(?:-color)?\s*:\s*var\(--ritemark-surface, #fff\)/, `.${surface} stays white in both themes (if it follows the theme, revisit the done inks below)`)
  // No rule moves the theme's tokens on the surface: the focus ring and the idle ring take them as the theme has them
  for (const rule of styling(surface)) assert.doesNotMatch(rule.body, /(?:^|[;\s])--r-[\w-]+\s*:/, `.${surface} leaves the theme's tokens alone`)
}
assert.ok(styling('rm-marker', /:focus-visible/).every((rule) => /outline:[^;]*var\(--r-accent\b/.test(rule.body)) && styling('rm-marker', /:focus-visible/).length >= 1, "the marker's focus ring is the theme's accent")
assert.ok(styling('rm-task-dot--idle').some((rule) => /var\(--r-ink-faint\b/.test(rule.body)), "the idle dot's ring is the theme's faint ink")

const fixed: Array<[string, RegExp | undefined, RegExp]> = [
  ['rm-task-dot--success', undefined, /^\s*background:\s*var\(--ritemark-ink-muted, #617187\);\s*$/], // muted, filled (the Experience lead, 486c2da)
  ['rm-task-status--success', undefined, /^\s*color:\s*var\(--ritemark-ink-strong, #1e1b4b\);\s*$/],
  ['rm-bubble-done', /:hover/, /^\s*color:\s*var\(--ritemark-ink-strong, #1e1b4b\);\s*background:\s*var\(--ritemark-surface-soft, #f1f5f9\);\s*$/],
]
for (const [name, also, body] of fixed) {
  const done = styling(name, also)
  assert.ok(done.length >= 1, `.${name} is styled`)
  for (const rule of done) assert.match(rule.body, body, `.${name}${also ? ' ' + also.source : ''} takes the fixed light ink`)
}
// The fixed inks can't be moved by a theme: each is declared once, in :root
for (const token of ['--ritemark-ink-strong', '--ritemark-ink-muted', '--ritemark-surface', '--ritemark-surface-soft']) {
  const declaring = rules.filter((rule) => new RegExp(`(?:^|[;\\s])${token}\\s*:`).test(rule.body))
  assert.deepEqual(declaring.map((rule) => rule.subjects.join(', ')), [':root'], `${token} is declared only in :root`)
}

console.log(`greenIsTheReadyDot: green only as the ready dot (${ALLOWED.length} allowances, each with its reason); a comment's done marks keep their light ink`)
