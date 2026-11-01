/**
 * Sprint 146 (R2, S10): every control `components/ui/` exports has a row in the catalogue, or is named, with its
 * reason, on the short list of parts that need none. A file exports several (`dropdown-menu.tsx` exports its trigger,
 * content, item, separator and More actions), so the test reads each file's exports, not one row per file. Only
 * components count: names that start with a capital and are not types. Helpers (`buttonVariants`,
 * `splitButtonState`, the input rule) start lower-case.
 *
 * Run: npx tsx webview/src/components/catalogue/catalogueCoverage.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { CATALOGUE, NEEDS_NO_ROW, STATE_INPUT, cellName } = await import('./catalogueRows')

const UI = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui')

/** The components a source file exports: `export function X`, `export const X`, `export { X, Y as Z }` (pure, tested). */
export function exportedComponents(source: string): string[] {
  const names = new Set<string>()
  for (const match of source.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1])
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && !name.startsWith('type ')) names.add(name)
    }
  }
  return [...names].filter((name) => /^[A-Z]/.test(name)).sort()
}

assert.deepEqual(exportedComponents('export function Icon() {}\nexport type IconSize = 12\nexport interface IconProps {}'), ['Icon'])
assert.deepEqual(exportedComponents('const A = 1\nconst b = 2\nexport { A, b, A as C }'), ['A', 'C'])
assert.deepEqual(exportedComponents('export const Input = forwardRef()\nexport function splitButtonState() {}'), ['Input'])

// Every control file of the folder (tests and the input rule's helpers left out)
const files = readdirSync(UI).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
const exported = new Map<string, string>()
for (const file of files) for (const name of exportedComponents(readFileSync(join(UI, file), 'utf8'))) exported.set(name, file)
assert.ok(exported.size > 40, `the folder's controls are read (${exported.size})`)

const covered = new Map<string, string>()
for (const row of CATALOGUE) for (const name of row.covers) {
  assert.ok(!covered.has(name), `${name} has one row (${covered.get(name)} and ${row.id})`)
  covered.set(name, row.id)
}

const missing = [...exported.keys()].filter((name) => !covered.has(name) && !(name in NEEDS_NO_ROW))
assert.deepEqual(missing, [], `every exported control has a row, or is on the list of parts that need none: ${missing.map((name) => `${name} (${exported.get(name)})`).join(', ')}`)

// Nothing stale: every name a row covers, or the list excuses, is still exported
for (const name of [...covered.keys(), ...Object.keys(NEEDS_NO_ROW)]) assert.ok(exported.has(name), `${name} is no longer exported by components/ui/`)
for (const name of Object.keys(NEEDS_NO_ROW)) assert.ok(!covered.has(name), `${name} is either covered or excused, not both`)

// Every cell has a state the script knows how to reach, and a name of its own
const names = new Set<string>()
for (const row of CATALOGUE) for (const variant of row.variants) for (const cell of variant.cells) {
  assert.ok(cell.state in STATE_INPUT, `${row.id}/${variant.id}: ${cell.state} is a state control-states.mjs reaches`)
  const name = cellName(row, variant, cell)
  assert.ok(/^[a-z0-9-]+$/.test(name), `${name} is a file name`)
  assert.ok(!names.has(name), `${name} is one cell`)
  names.add(name)
}

// The test fails on a control with no row: a new export in the folder would be named here
const withNewControl = [...exported.keys(), 'NewControl'].filter((name) => !covered.has(name) && !(name in NEEDS_NO_ROW))
assert.deepEqual(withNewControl, ['NewControl'], 'a control added with no row is caught')

console.log(`catalogueCoverage.test.ts: all assertions passed (${exported.size} controls, ${names.size} cells)`)
