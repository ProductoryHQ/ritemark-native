/**
 * 18 November (the smoke run): Radix warned "Missing `Description` or `aria-describedby={undefined}` for
 * {DialogContent}" twice from webview.js. Radix looks for the element with its own description id, so a dialog needs a
 * `DialogDescription` (visible, or `sr-only` where the design shows no words) that keeps that id: no `id=` of its own,
 * and no `aria-describedby` on the content pointing elsewhere (the Publish sheets did both).
 *
 * Every dialog content in the webview is checked here.
 *
 * Run: npx tsx webview/src/components/ui/dialogDescriptions.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : tsxFiles(full)
    return name.endsWith('.tsx') && !name.includes('.test.') ? [full] : []
  })
}

const OPEN = /<(DialogContent|Dialog\.Content|DialogPrimitive\.Content)\b/g
let checked = 0
for (const file of tsxFiles(src)) {
  const text = readFileSync(file, 'utf8')
  const name = relative(src, file)
  if (name === join('components', 'ui', 'dialog.tsx')) continue
  for (const match of text.matchAll(OPEN)) {
    const tag = match[1]
    const close = text.indexOf(`</${tag}>`, match.index)
    assert.ok(close > 0, `${name}: <${tag}> is closed`)
    const block = text.slice(match.index, close)
    const head = block.slice(0, block.indexOf('>', block.search(/\n\s*>|[^=]>/)) + 1)
    checked++
    if (/aria-describedby=\{undefined\}/.test(head)) continue
    assert.match(block, /<(DialogDescription|Dialog\.Description|DialogPrimitive\.Description)\b/, `${name}: the dialog at offset ${match.index} has a description`)
    assert.doesNotMatch(head, /aria-describedby="/, `${name}: the content keeps Radix's own aria-describedby`)
    for (const description of block.matchAll(/<(?:DialogDescription|Dialog\.Description|DialogPrimitive\.Description)\b[^>]*>/g)) {
      assert.doesNotMatch(description[0], /\sid=/, `${name}: a description keeps Radix's id (${description[0]})`)
    }
  }
}
assert.ok(checked >= 20, `every dialog checked (${checked})`)

console.log(`dialog descriptions: ${checked} dialogs passed`)
