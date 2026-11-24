import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from 'node-html-parser'
import { readTimetable } from '../../../../src/decks/timetable'
import { DeckMinutes, draftMinutes } from './DeckMinutes'

Object.assign(globalThis, { React })

const labelSlide = readTimetable('\x60\x60\x60slide exercise\ntag: 20 min\n\x60\x60\x60\n').slides[0]
for (const timing of [labelSlide, { ...labelSlide, minutes: null, labelMinutes: null }]) {
  const html = parse(renderToStaticMarkup(React.createElement(DeckMinutes, {
    count: 'Slide 1 of 6',
    timing,
    fromLabel: timing.labelMinutes !== null,
    onCommit: () => {},
  })))
  assert.equal(html.querySelectorAll('button').length, 1)
  assert.equal(html.querySelector('button')?.textContent, timing.minutes === null ? 'Slide 1 of 6' : 'Slide 1 of 6 · 20 min')
}

assert.equal(draftMinutes(''), undefined, 'empty removes time')
for (const [draft, value] of [['0', '0'], ['0020', '20'], ['1440', '1440']]) {
  assert.equal(draftMinutes(draft), value)
}
for (const draft of ['-1', '1441', '2.5', '1e2', ' 5 ', 'abc']) {
  assert.equal(draftMinutes(draft), null, `reject ${draft}`)
}

// Node renders the resting button above. Check how the live component wires the field events.
const source = readFileSync(new URL('./DeckMinutes.tsx', import.meta.url), 'utf8')
assert.match(source, /onClick=\{\(\) => setDraft\(timing.minutes === null \? '' : String\(timing.minutes\)\)\}/)
assert.match(source, /value=\{draft\}/, 'open with the effective minutes, including the exercise label')
assert.match(source, /useDismissOnOutside\(edit, \(\) => input.current\?\.blur\(\)/)
assert.match(source, /onBlur=\{\(\) => \{\s*if \(closing\.current\) return\s*setDraft\(null\)\s*if \(value !== null\) onCommit\(value\)/)
// Return and Escape close the box themselves: a blur as the box leaves the page saves nothing more.
assert.match(source, /returnFocus\.current = true\s*closing\.current = true\s*setDraft\(null\)/)
assert.match(source, /if \(event.key === 'Enter' && value === null\) return\s*returnFocus.current = true\s*closing\.current = true\s*setDraft\(null\)\s*if \(event.key === 'Enter' && value !== null\) onCommit\(value\)/, 'Escape closes without committing')
console.log('DeckMinutes: run, label draft, blur, Escape, clearing and range passed')
