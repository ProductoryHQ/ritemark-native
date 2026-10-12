/**
 * Sprint 129 R5/R6 — what the dictation dialog tells the user, per platform.
 * Run: npx tsx webview/src/components/dictationProblems.test.ts
 */
import assert from 'node:assert/strict'
import { dictationProblemCopy, problemFromCapture, type DictationProblem } from './dictationProblems'

const ALL: DictationProblem[] = [
  'mic-blocked', 'mic-missing', 'mic-busy', 'mic-internal', 'mic-unexpected',
  'engine-missing', 'engine-blocked', 'engine-cpu', 'engine-failed', 'engine-unavailable',
  'model-missing', 'generic',
]

for (const platform of ['win32', 'darwin'] as const) {
  for (const problem of ALL) {
    const copy = dictationProblemCopy(problem, platform)
    const text = copy.body.map(part => part.text).join('')
    const where = `${problem}/${platform}`
    assert.ok(copy.title.length > 0 && copy.title.length <= 32, `${where}: a short title`)
    assert.ok(text.length > 20, `${where}: says something`)
    assert.ok(!/NotAllowed|NotFound|Error\b|0x|ENOENT|EPERM|engine|installation|configuration/i.test(text), `${where}: no codes or jargon`)
    for (const button of [copy.primary, copy.secondary].filter(Boolean)) {
      assert.ok(button!.label.length <= 24, `${where}: "${button!.label}" fits on one line`)
      assert.ok(button!.tooltip.length > 5, `${where}: "${button!.label}" has a tooltip`)
    }
  }
}

// Windows names the two switches, and does not send the user to a menu path or a list.
const winBlocked = dictationProblemCopy('mic-blocked', 'win32')
const strong = winBlocked.body.filter(part => part.strong).map(part => part.text)
assert.deepEqual(strong, ['Microphone access', 'Let desktop apps access your microphone'])
assert.equal(winBlocked.primary.action, 'open-mic-settings')
assert.match(winBlocked.primary.tooltip, /Windows Settings/)
assert.ok(!/Privacy & security|→/.test(winBlocked.body.map(part => part.text).join('')), 'no breadcrumb (Windows 10 and 11 differ)')

// macOS keeps its own steps.
const macBlocked = dictationProblemCopy('mic-blocked', 'darwin')
assert.match(macBlocked.body.map(part => part.text).join(''), /macOS is blocking/)
assert.match(macBlocked.primary.tooltip, /System Settings/)

// A busy microphone on Windows may be the privacy switch: offer the settings there.
assert.equal(dictationProblemCopy('mic-busy', 'win32').primary.action, 'open-mic-settings')
assert.equal(dictationProblemCopy('mic-busy', 'darwin').primary.action, 'retry')

// Fixable problems offer Try Again; unfixable ones only Close.
assert.equal(dictationProblemCopy('engine-failed', 'win32').primary.label, 'Try Again')
assert.equal(dictationProblemCopy('engine-cpu', 'win32').primary.action, 'close')
assert.equal(dictationProblemCopy('engine-cpu', 'win32').secondary, undefined)
assert.equal(dictationProblemCopy('model-missing', 'win32').primary.label, 'Download Speech Model')

// The host's own words show for an unexpected host error.
assert.equal(dictationProblemCopy('generic', 'win32', 'Voice dictation is not available').body[0].text, 'Voice dictation is not available')

// Microphone failures map from the classifier Transcribe Record uses.
assert.equal(problemFromCapture('os-denied'), 'mic-blocked')
assert.equal(problemFromCapture('no-device'), 'mic-missing')
assert.equal(problemFromCapture('device-busy'), 'mic-busy')
assert.equal(problemFromCapture('internal-config'), 'mic-internal')
assert.equal(problemFromCapture('unexpected'), 'mic-unexpected')

console.log('dictationProblems.test.ts: all tests passed')
