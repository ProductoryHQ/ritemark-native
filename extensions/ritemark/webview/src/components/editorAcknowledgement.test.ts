/**
 * #512: the editor acknowledges a document update without waiting for an
 * animation frame. Run with `npx tsx webview/src/components/editorAcknowledgement.test.ts`.
 *
 * A window behind other windows, minimized or on another space runs no
 * animation frames. The acknowledgement used to be sent from one, so it never
 * came, and the host showed "Retry document update" after its delivery budget
 * — on text the editor already showed. In the app this is reproduced by
 * `scripts/qa/markdown-roundtrip-check.mjs --hidden-update`, which suspends the
 * editor's frames the way a hidden window does and writes the file from
 * outside.
 *
 * `Editor.tsx` is a React component a Node test cannot render, so the
 * contract is checked on its source, as `workbenchLayout.test.ts` does.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./Editor.tsx', import.meta.url)), 'utf-8')

/** The bodies of every `requestAnimationFrame(...)` call, by bracket matching. */
function frameCallbacks(text: string): string[] {
  const bodies: string[] = []
  let index = text.indexOf('requestAnimationFrame(')
  while (index !== -1) {
    let depth = 0
    let end = index + 'requestAnimationFrame'.length
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')' && --depth === 0) break
    }
    bodies.push(text.slice(index, end + 1))
    index = text.indexOf('requestAnimationFrame(', end)
  }
  return bodies
}

for (const body of frameCallbacks(source)) {
  assert.ok(!body.includes('onExternalApplied'), `no acknowledgement waits for a frame: ${body.slice(0, 80)}…`)
}
assert.equal(
  (source.match(/queueMicrotask\(\(\) => onExternalApplied\?\.\(syncTarget\)\)/g) ?? []).length,
  2,
  'both acknowledgements — after applying an update, and for the view\'s own accepted edit — run in a microtask',
)

console.log('editorAcknowledgement.test.ts — all assertions passed')
