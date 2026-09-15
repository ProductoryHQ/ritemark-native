/**
 * Sprint 126 (RQ2, RQ5) — the report carries only what it is given.
 *
 * The negative tests below are the point of the file. They pass trivially
 * today, because the builder's signature cannot accept a conversation or a
 * document — and that is exactly what they exist to protect. The first time
 * someone widens `ReportContextV1` to "just add the runtime, it's useful",
 * these fail and force the privacy decision into the open.
 */
import assert from 'node:assert/strict'
import {
  MAX_REPORT_BODY_CHARS,
  REPORT_RECIPIENT,
  composeReport,
  narrowReportContext,
  reportContextLines,
  reportSubject,
  type ReportContextV1,
} from './composeReport'

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

const context: ReportContextV1 = {
  appVersion: '1.11.0',
  platform: 'win32',
  occurredAt: '2026-09-15T18:40:00.000Z',
}

test('the report is the context lines plus the user text, and nothing else', () => {
  const report = composeReport(context, 'The model claimed a fact that is false.')
  assert.equal(
    report,
    'Ritemark 1.11.0 (win32)\nReported 2026-09-15T18:40:00.000Z\n\nThe model claimed a fact that is false.',
  )
})

test('context lines name the version, platform and time — nothing more', () => {
  const lines = reportContextLines(context)
  assert.equal(lines.length, 2, 'exactly two context lines')
  assert.ok(lines[0].includes('1.11.0') && lines[0].includes('win32'))
  assert.ok(lines[1].includes('2026-09-15T18:40:00.000Z'))
})

// ── RQ5: what a report may never carry ───────────────────────────────────────
// Each case hands `narrowReportContext` a bootstrap-shaped object that really
// does hold this data in the running app, and asserts it does not survive.

const leakyBootstrap = {
  appVersion: '1.11.0',
  platform: 'win32',
  occurredAt: '2026-09-15T18:40:00.000Z',
  workspaceName: 'Productory consulting',
  documentPath: '/Users/jarmo/Documents/secret-client-brief.md',
  documentText: 'Confidential: the merger closes in October.',
  conversationId: 'conv-8f21',
  conversation: [{ role: 'assistant', content: 'earlier private turn' }],
  runtimeId: 'claude-code',
  modelId: 'example-model-id',
  apiKey: 'sk-do-not-leak-this',
  accessToken: 'token-do-not-leak-this',
  accountEmail: 'jarmo@productory.eu',
}

test('narrowing drops every field that is not version, platform or time', () => {
  const narrowed = narrowReportContext(leakyBootstrap)
  assert.deepEqual(Object.keys(narrowed).sort(), ['appVersion', 'occurredAt', 'platform'])
})

test('no workspace name, document path or document content survives', () => {
  const report = composeReport(narrowReportContext(leakyBootstrap), 'a user complaint')
  for (const secret of ['Productory consulting', 'secret-client-brief.md', 'merger closes']) {
    assert.ok(!report.includes(secret), `report must not contain ${secret}`)
  }
})

test('no conversation identity or content survives', () => {
  const report = composeReport(narrowReportContext(leakyBootstrap), 'a user complaint')
  for (const secret of ['conv-8f21', 'earlier private turn']) {
    assert.ok(!report.includes(secret), `report must not contain ${secret}`)
  }
})

test('no runtime or model identifier survives', () => {
  const report = composeReport(narrowReportContext(leakyBootstrap), 'a user complaint')
  for (const secret of ['claude-code', 'example-model-id']) {
    assert.ok(!report.includes(secret), `report must not contain ${secret}`)
  }
})

test('no credential or account identifier survives', () => {
  const report = composeReport(narrowReportContext(leakyBootstrap), 'a user complaint')
  for (const secret of ['sk-do-not-leak-this', 'token-do-not-leak-this', 'jarmo@productory.eu']) {
    assert.ok(!report.includes(secret), `report must not contain ${secret}`)
  }
})

test('the subject carries no report content', () => {
  const subject = reportSubject(narrowReportContext(leakyBootstrap))
  assert.ok(subject.includes('1.11.0'))
  for (const secret of ['Productory consulting', 'sk-do-not-leak-this', 'conv-8f21']) {
    assert.ok(!subject.includes(secret), `subject must not contain ${secret}`)
  }
})

// ── Robustness ───────────────────────────────────────────────────────────────

test('missing context degrades to a named unknown rather than undefined', () => {
  const narrowed = narrowReportContext({})
  assert.equal(narrowed.appVersion, 'unknown')
  assert.equal(narrowed.platform, 'unknown')
  assert.ok(narrowed.occurredAt.length > 0, 'a timestamp is always present')
})

test('a null or non-object input does not throw', () => {
  assert.doesNotThrow(() => narrowReportContext(null))
  assert.doesNotThrow(() => narrowReportContext(undefined))
  assert.doesNotThrow(() => narrowReportContext('nonsense'))
})

test('an over-long body is clipped, not rejected', () => {
  const body = 'x'.repeat(MAX_REPORT_BODY_CHARS + 500)
  const report = composeReport(context, body)
  assert.ok(report.length <= MAX_REPORT_BODY_CHARS + 200, 'clipped to the bound plus the context block')
  assert.ok(report.includes('Ritemark 1.11.0'), 'context survives the clip')
})

test('the recipient is the monitored address', () => {
  assert.equal(REPORT_RECIPIENT, 'info@productory.eu')
})

console.log(`\ncomposeReport: ${passed} passed`)
