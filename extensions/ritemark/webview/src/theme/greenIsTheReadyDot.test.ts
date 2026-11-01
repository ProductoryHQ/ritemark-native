/**
 * Sprint 145 (#578, R6, S36): green appears only as the small "ready" dot (the Experience lead's framework, §3:
 * "One accent, no other hues"). A done mark, a saved line, a copied check or a valid key is drawn in ink.
 *
 * Scans the webview's source for the ways this code base writes green as a meaning (the success token, Tailwind's
 * green families, VS Code's "passed" colours) and fails on any use outside the list below, each with its reason.
 * Hex colours are not scanned: the conversation colours and Transcribe's speakers use them to say who, not done.
 *
 * Run: npx tsx webview/src/theme/greenIsTheReadyDot.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const GREEN = /--r-success|--ritemark(?:-dark)?-success|ritemark-success|testing-iconPassed|charts-green|\b(?:text|bg|border|fill|stroke|ring)-(?:green|emerald)-\d|#15803d/

/** Where green stays, by file and by what the line holds. */
const ALLOWED: Array<{ file: string; line: RegExp; why: string }> = [
  { file: 'index.css', line: /^\s*--(?:ritemark(?:-dark)?-success(?:-soft)?|r-success(?:-soft)?):/, why: 'the token itself' },
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

console.log(`greenIsTheReadyDot: green only as the ready dot (${ALLOWED.length} allowances, each with its reason)`)
