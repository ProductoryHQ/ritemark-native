/**
 * Sprint 126 (RQ3) — the three transport outcomes, and the one that matters.
 *
 * The case a Store reviewer is most likely to produce is a clean Windows
 * machine with no mail account. That must not look like a failure, and it must
 * not lose the report. Both are asserted here.
 */
import assert from 'node:assert/strict'
import {
  MAILTO_MAX_URL_CHARS,
  buildMailtoUrl,
  fitsInMailto,
  openReportMail,
} from './reportTransport'
import { decodeReportMailMessage, reportResult } from './protocol'

let passed = 0
function test(name: string, fn: () => void | Promise<void>): void {
  const run = async () => {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  }
  run().catch((error) => {
    console.error(`  ✗ ${name}`)
    throw error
  })
}

const request = {
  recipient: 'info@productory.eu',
  subject: 'Ritemark 1.11.0 — AI output report',
  body: 'Ritemark 1.11.0 (win32)\nReported 2026-09-15T18:40:00.000Z\n\nThe model produced something harmful.',
}

test('the mailto url encodes the headers and leaves the address raw', () => {
  const url = buildMailtoUrl(request)
  assert.ok(url.startsWith('mailto:info@productory.eu?'), 'address is raw after the scheme')
  assert.ok(url.includes('subject=Ritemark%201.11.0'), 'subject is percent-encoded')
  assert.ok(url.includes('body=Ritemark%201.11.0%20(win32)'), 'body is percent-encoded')
  assert.ok(!url.includes('\n'), 'no raw newline survives into the url')
})

test('a normal report fits', () => {
  assert.equal(fitsInMailto(request), true)
})

test('a long report does not fit, and is caught before anything opens', async () => {
  const long = { ...request, body: 'x'.repeat(MAILTO_MAX_URL_CHARS) }
  assert.equal(fitsInMailto(long), false)

  let opened = 0
  const outcome = await openReportMail(long, {
    openExternal: async () => {
      opened += 1
      return true
    },
  })
  assert.equal(outcome, 'too-long')
  assert.equal(opened, 0, 'nothing is handed over when it would be truncated')
})

test('a mail handler that accepts the uri reports opened', async () => {
  const outcome = await openReportMail(request, { openExternal: async () => true })
  assert.equal(outcome, 'opened')
})

test('a machine with no mail handler reports no-handler, not an error', async () => {
  const outcome = await openReportMail(request, { openExternal: async () => false })
  assert.equal(outcome, 'no-handler')
})

test('a throwing openExternal is an outcome, never an exception', async () => {
  const outcome = await openReportMail(request, {
    openExternal: async () => {
      throw new Error('no registered handler')
    },
  })
  assert.equal(outcome, 'no-handler')
})

// ── protocol ────────────────────────────────────────────────────────────────

test('a well-formed message decodes', () => {
  const decoded = decodeReportMailMessage({ type: 'report/open-mail', ...request })
  assert.ok(decoded)
  assert.equal(decoded?.recipient, 'info@productory.eu')
})

test('an empty body is allowed — subject-only reporting is legitimate', () => {
  const decoded = decodeReportMailMessage({ type: 'report/open-mail', ...request, body: '' })
  assert.ok(decoded, 'empty body decodes')
})

test('a malformed or tampered recipient is rejected', () => {
  for (const recipient of ['', 'not-an-address', 'a@b', 'a b@c.d', 'x@y.z, evil@elsewhere.tld', 42]) {
    assert.equal(
      decodeReportMailMessage({ type: 'report/open-mail', ...request, recipient }),
      null,
      `rejects ${String(recipient)}`,
    )
  }
})

test('a non-string or unbounded body is rejected', () => {
  assert.equal(decodeReportMailMessage({ type: 'report/open-mail', ...request, body: 42 }), null)
  assert.equal(
    decodeReportMailMessage({ type: 'report/open-mail', ...request, body: 'x'.repeat(200_000) }),
    null,
  )
})

test('the wrong message type is not claimed', () => {
  assert.equal(decodeReportMailMessage({ type: 'comment-task/accept', ...request }), null)
  assert.equal(decodeReportMailMessage(null), null)
  assert.equal(decodeReportMailMessage('nonsense'), null)
})

test('the result echoes the body so the webview can keep showing it', () => {
  const result = reportResult('no-handler', request.body)
  assert.equal(result.type, 'report/result')
  assert.equal(result.outcome, 'no-handler')
  assert.equal(result.body, request.body)
})

setTimeout(() => console.log(`\nreportTransport: ${passed} passed`), 50)
