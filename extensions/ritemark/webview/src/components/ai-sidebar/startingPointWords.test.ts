/**
 * Sprint 140 (R8; S33–S39, S41): the starting points by place, at most three, the "…" fill, and About this
 * project left out once it exists.
 * Run: npx tsx webview/src/components/ai-sidebar/startingPointWords.test.ts
 */

import assert from 'node:assert/strict'
import { fillOf, startingPointsFor, startingSentence } from './startingPointWords'

import { READ_KINDS_PASSED, startingPlacesForAgents } from '../../../../src/guidance/startingPlace'
import { createConversationState } from './conversationState'
import { hydrateConversations, selectStartingPlace, useAISidebarStore } from './store'
import { vscode } from '../../lib/vscode'

const labels = (place: Parameters<typeof startingPointsFor>[0], hasAbout = false) => startingPointsFor(place, { hasAbout }).map((point) => point.label)

assert.deepEqual(labels('project'), ['What is here?', 'Find what I wrote about…', 'Write “About this project”'], 'S33')
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

// Sprint 173, S39 and S40: deliver the host's places once per platform, then switch AIs in the column.
const passed = { ...READ_KINDS_PASSED, 'claude-code': { darwin: true, win32: false } }
const word = { viewType: 'ritemark.docxViewer', fileName: 'Tender.docx' }
const pdf = { viewType: 'ritemark.pdfViewer', fileName: 'Tender.pdf' }
const conversation = createConversationState('starting-points', { selectedAgent: 'claude-code' })
hydrateConversations([conversation], conversation.id)
const store = useAISidebarStore.getState
const originalPostMessage = vscode.postMessage
vscode.postMessage = () => undefined

try {
  const receivePlaces = (platform: NodeJS.Platform) => {
    store().handleExtensionMessage({ type: 'starting-place', places: startingPlacesForAgents(word, 'files', platform, passed), hasAbout: false })
  }
  const offeredLabels = () => {
    const place = selectStartingPlace(store())
    return place ? labels(place, store().startingPlace?.hasAbout) : []
  }

  receivePlaces('darwin')
  assert.deepEqual(offeredLabels(), labels('word_or_pdf'), 'S39: Claude offers all three Word points')
  store().selectAgent('codex')
  assert.deepEqual(offeredLabels(), labels('project'), 'S39: switching to ChatGPT immediately offers the project points')
  store().selectAgent('opencode')
  assert.deepEqual(offeredLabels(), labels('project'), 'OpenCode also needs its own pass')
  store().selectAgent('claude-code')
  assert.deepEqual(offeredLabels(), labels('word_or_pdf'), 'S40: Claude passed on Mac')
  receivePlaces('win32')
  assert.deepEqual(offeredLabels(), labels('project'), 'S40: Claude failed on Windows')
  receivePlaces('linux')
  assert.deepEqual(offeredLabels(), labels('project'), 'Linux always follows the project')
  assert.equal(startingPlacesForAgents(pdf, 'files', 'darwin', passed)['claude-code'], 'word_or_pdf')
  assert.equal(startingPlacesForAgents(pdf, 'files', 'win32', passed)['claude-code'], 'project')
} finally {
  vscode.postMessage = originalPostMessage
}

console.log('startingPointWords: all assertions passed')
