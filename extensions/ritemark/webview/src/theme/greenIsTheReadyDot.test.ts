/**
 * Sprint 145 (#578, R6, S36): green appears only as the small "ready" dot (the Experience lead's framework, §3:
 * "One accent, no other hues"). A done mark, a saved line, a copied check or a valid key is drawn in ink.
 *
 * Scans the webview's source, in any letter case, for the ways green is written: the success token, Tailwind's green
 * and emerald classes (any prefix), VS Code's green colours, and Tailwind's green and emerald hex values. It fails on
 * any use outside the list below, each with its reason. Not scanned: rgb()/rgba() values and other hex values.
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
const GREEN = new RegExp([
  String.raw`--r-success|--ritemark(?:-dark)?-success|ritemark-success`,
  String.raw`testing-iconPassed|charts-green|ansi(?:bright)?green|gitDecoration-addedResourceForeground`,
  String.raw`(?:^|[\s"'\x60:])[a-z-]*-(?:green|emerald)-\d`,
  String.raw`#(?:${GREEN_HEX})\b`,
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
  { file: 'components/properties/StatusSelect.tsx', line: /value: 'published'/, why: 'a chosen front-matter status, not a done mark; with its amber Draft, for the Experience lead' },
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

// A comment's marker and bubble are white in both themes, so their done marks take the fixed light ink, as their
// words do: the theme's ink-strong is near white in Dark and would vanish there (review round 1).
const css = readFileSync(join(root, 'index.css'), 'utf-8')
const ruleBody = (selector: string) => css.match(new RegExp(`^${selector.replace(/[.:-]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? ''
for (const surface of ['.rm-marker', '.rm-bubble']) {
  assert.match(ruleBody(surface), /background: var\(--ritemark-surface, #fff\)/, `${surface} is white in both themes (if it follows the theme, revisit the inks below)`)
}
for (const selector of ['.rm-task-dot--success', '.rm-task-status--success', '.rm-bubble-done:hover']) {
  const body = ruleBody(selector)
  assert.match(body, /var\(--ritemark-ink-strong, #1e1b4b\)/, `${selector} is the fixed light ink`)
  assert.doesNotMatch(body, /var\(--r-/, `${selector} uses no theme token on its white surface`)
}

console.log(`greenIsTheReadyDot: green only as the ready dot (${ALLOWED.length} allowances, each with its reason); comment surfaces keep their light ink`)
