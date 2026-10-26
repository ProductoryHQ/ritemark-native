/**
 * Sprint 140 (R8; S33–S39, S41): the starting points by place, at most three, the "…" fill, and About this
 * project left out once it exists.
 * Run: npx tsx webview/src/components/ai-sidebar/startingPointWords.test.ts
 */

import assert from 'node:assert/strict'
import { fillOf, startingPointsFor, startingSentence } from './startingPointWords'

const labels = (place: Parameters<typeof startingPointsFor>[0], hasAbout = false) => startingPointsFor(place, { hasAbout }).map((point) => point.label)

assert.deepEqual(labels('project'), ['What is here?', 'Find what I wrote about…', 'Write About this project'], 'S33')
assert.deepEqual(labels('project', true), ['What is here?', 'Find what I wrote about…'], 'S41: About this project exists')
assert.deepEqual(labels('empty_project'), ['This project is for…', 'Plan a first document with me'], 'S34')
assert.deepEqual(labels('word_or_pdf'), ['Summarise this in five points', 'Turn this into a one-page brief', 'What does this say about…?'], 'S35')
assert.deepEqual(labels('short_text'), ['Fill in the outline', 'Write a first draft from my notes'], 'S36')
assert.deepEqual(labels('long_text'), ['Tighten this for a client', 'What is missing?', 'Add a summary at the top'], 'S36')
assert.deepEqual(labels('table'), ['What stands out here?', 'Write a short summary of this table'], 'S37')
assert.deepEqual(labels('sample', true), ['Draft Module 4 from the brief', 'Summarise the call with the HR lead', 'What is here?'], 'S38')
for (const place of ['project', 'empty_project', 'word_or_pdf', 'short_text', 'long_text', 'table', 'sample'] as const) {
  assert.ok(startingPointsFor(place, { hasAbout: false }).length <= 3, `${place}: at most three`)
  assert.ok(!startingPointsFor(place, { hasAbout: false }).some((point) => /task/i.test(point.label)), `${place}: none asks for tasks (Jarmo, 15 October)`)
}

// S39: the fill, and where the cursor waits
assert.deepEqual(fillOf('Summarise this in five points'), { text: 'Summarise this in five points', cursor: 29 })
assert.deepEqual(fillOf('Find what I wrote about…'), { text: 'Find what I wrote about ', cursor: 24 })
assert.deepEqual(fillOf('What does this say about…?'), { text: 'What does this say about ?', cursor: 25 })
assert.equal(fillOf('What does this say about…?').text.slice(0, 25), 'What does this say about ', 'the cursor waits before the "?"')
assert.deepEqual(fillOf('This project is for…'), { text: 'This project is for ', cursor: 20 }, 'the same words as the empty project\'s ready request')

assert.equal(startingSentence('ChatGPT'), 'ChatGPT can work across your open documents and the whole project.', 'D2')

console.log('startingPointWords: all assertions passed')
