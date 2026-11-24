import assert from 'node:assert/strict'
import { deckWordCount } from './deckWordCount'
import { debounceCount } from '../../lib/debounceCount'

const deck = `---
deck: 2
id: hidden
---

\`\`\`\`slide
---
id: slide-one
---
# Title words

:::: columns
::: column
Body line here
:::
::::
\`\`\`\`

Handout line here
`
assert.equal(deckWordCount(deck), 8)
assert.equal(deckWordCount(''), 0)

// A table's cells are words; the reader's ' · ' between them is not (Codex, #962).
assert.equal(deckWordCount('| A | B |\n| --- | --- |\n| One | Two |\n| Three | Four |\n'), 6)

// Bursts of edits yield one count after the last edit; closing cancels it.
async function checkDebounce() {
  let calls = 0
  const pending = debounceCount(() => { calls++ }, 20)
  pending.schedule()
  pending.schedule()
  assert.equal(calls, 0)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(calls, 1)
  pending.schedule()
  pending.cancel()
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(calls, 1)
}
checkDebounce().catch(error => { console.error(error); process.exitCode = 1 })
