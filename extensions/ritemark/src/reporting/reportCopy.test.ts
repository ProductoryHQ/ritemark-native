/**
 * Sprint 126 (RQ4) — Ritemark never claims a delivery it cannot observe.
 *
 * `mailto:` hands the report to a mail client and the story ends there: no
 * callback, no receipt, no way to know whether the user pressed send or closed
 * the window. Any word implying otherwise is a lie the app tells on its own
 * behalf, so the whole vocabulary is asserted rather than reviewed by eye.
 */
import assert from 'node:assert/strict'
import { DELIVERY_CLAIM_WORDS, REPORT_COPY } from './reportCopy'
import { REPORT_RECIPIENT } from './composeReport'

let passed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}`)
    throw error
  }
}

const strings = Object.entries(REPORT_COPY) as Array<[string, string]>

test('every string is non-empty', () => {
  for (const [key, value] of strings) {
    assert.ok(value.trim().length > 0, `${key} must not be empty`)
  }
})

test('no string claims the report was delivered', () => {
  for (const [key, value] of strings) {
    const lower = value.toLowerCase()
    for (const claim of DELIVERY_CLAIM_WORDS) {
      assert.ok(
        !new RegExp(`\\b${claim}\\b`).test(lower),
        `${key} must not claim delivery, found "${claim}" in: ${value}`,
      )
    }
  }
})

test('the primary action says what happens, not that anything is sent', () => {
  const label = REPORT_COPY.primaryAction.toLowerCase()
  assert.ok(label.includes('email'), 'names the thing that opens')
  assert.ok(!/\bsend\b/.test(label), 'does not promise sending')
})

test('the handoff says the report still has to be sent by the user', () => {
  const detail = REPORT_COPY.handoffDetail.toLowerCase()
  assert.ok(detail.includes('not on its way yet'), 'states plainly that nothing has gone yet')
  assert.ok(detail.includes(REPORT_RECIPIENT), 'names the address the user must send to')
})

test('the fallback is written as a normal outcome, not an error', () => {
  const combined = `${REPORT_COPY.fallbackTitle} ${REPORT_COPY.fallbackDetail}`.toLowerCase()
  for (const alarm of ['error', 'failed', 'failure', 'could not', 'unable to', 'something went wrong']) {
    assert.ok(!combined.includes(alarm), `fallback must not read as an error, found "${alarm}"`)
  }
  assert.ok(REPORT_COPY.fallbackDetail.includes(REPORT_RECIPIENT), 'gives the user the address')
})

test('the too-long state also routes to copy rather than dropping content', () => {
  assert.ok(REPORT_COPY.tooLongDetail.includes(REPORT_RECIPIENT))
  assert.ok(/copy/i.test(REPORT_COPY.tooLongDetail), 'tells the user to copy it')
})

test('the dialog says what is included and what is not', () => {
  const description = REPORT_COPY.dialogDescription.toLowerCase()
  assert.ok(description.includes('only'), 'bounds what travels')
  assert.ok(description.includes('conversation'), 'names conversation as excluded')
  assert.ok(description.includes('document'), 'names documents as excluded')
})

test('the status bar item is labelled for what it does', () => {
  assert.ok(/report/i.test(REPORT_COPY.statusBarLabel))
  assert.ok(/ai/i.test(REPORT_COPY.statusBarLabel))
  assert.ok(REPORT_COPY.statusBarTooltip.length > REPORT_COPY.statusBarLabel.length, 'the tooltip explains further')
})

console.log(`\nreportCopy: ${passed} passed`)
