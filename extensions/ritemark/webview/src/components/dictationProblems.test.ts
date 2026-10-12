/**
 * Sprint 129 R5/R6 — what the dictation dialog tells the user, per platform.
 * Run: npx tsx webview/src/components/dictationProblems.test.ts
 */
import assert from 'node:assert/strict'
import { dictationProblemCopy, dictationStateCopy, problemFromCapture, type DictationProblem } from './dictationProblems'

const ALL: DictationProblem[] = [
  'mic-silent', 'mic-blocked', 'mic-missing', 'mic-busy', 'mic-internal', 'mic-unexpected',
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

// R13: the model dialog names the size the host sends, and none when it sends none.
assert.match(dictationProblemCopy('model-missing', 'win32', '834 MB').body[0].text, /about 834 MB/)
assert.doesNotMatch(dictationProblemCopy('model-missing', 'win32').body[0].text, /GB|MB/)

// R12: "speak, then text" never promises live text, and says how long the wait is.
const states = ['idle', 'preparing', 'listening', 'processing', 'finishing'] as const
for (const mode of ['live', 'deferred'] as const) {
  for (const state of states) {
    const copy = dictationStateCopy(state, mode, 'Estonian')
    assert.ok(copy.tooltip.length > 10, `${mode}/${state}: a tooltip`)
  }
}
const recording = dictationStateCopy('listening', 'deferred', 'Estonian')
assert.match(recording.placeholder!, /after you stop/)
assert.match(recording.tooltip, /Recording in Estonian/)
assert.doesNotMatch(recording.placeholder! + recording.tooltip, /Listening|Dictating/)
assert.match(dictationStateCopy('idle', 'deferred', 'Estonian').tooltip, /after you stop/)
assert.equal(dictationStateCopy('idle', 'live', 'Estonian').tooltip, 'Start dictation (Estonian)')
assert.match(dictationStateCopy('finishing', 'deferred', 'Estonian', { seconds: 20 }).placeholder!, /about 20 seconds/)
assert.match(dictationStateCopy('finishing', 'deferred', 'Estonian', { seconds: null }).placeholder!, /up to a minute/)
assert.equal(dictationStateCopy('finishing', 'deferred', 'Estonian').placeholder, '⏳ Processing your recording.', 'no "up to a minute" flash before the host answers')
assert.match(dictationStateCopy('finishing', 'deferred', 'Estonian', { seconds: 20, overdue: true }).placeholder!, /Still processing/)
assert.match(dictationStateCopy('finishing', 'live', 'Estonian').placeholder!, /last words/)
assert.equal(dictationStateCopy('idle', 'deferred', 'Estonian').placeholder, null)

// Windows test, bug C/B: "heard nothing" says what to check, per platform.
const silentWin = dictationProblemCopy('mic-silent', 'win32')
assert.equal(silentWin.title, 'Ritemark Heard Nothing')
assert.match(silentWin.body[0].text, /muted/)
assert.match(silentWin.body[0].text, /desktop apps/)
assert.equal(silentWin.primary.action, 'open-mic-settings')
assert.doesNotMatch(dictationProblemCopy('mic-silent', 'darwin').body[0].text, /Windows|desktop apps/)

// Bug D: after recording, an engine problem says "Dictation Stopped", not "Can't Start".
const late = dictationProblemCopy('engine-missing', 'win32', undefined, 'transcribing')
assert.equal(late.title, 'Dictation Stopped')
assert.match(late.body.map(p => p.text).join(''), /^Your recording couldn't be turned into text\. A part of Ritemark/)
assert.equal(dictationProblemCopy('engine-missing', 'win32').title, "Dictation Can't Start")

// Jarmo 2026-10-12: while recording, the button says what a click does.
assert.equal(dictationStateCopy('listening', 'deferred', 'Estonian').label, 'Transcribe now')
assert.equal(dictationStateCopy('finishing', 'deferred', 'Estonian').label, 'Transcribing…')
assert.equal(dictationStateCopy('listening', 'live', 'Estonian').label, 'Stop')
assert.equal(dictationStateCopy('idle', 'deferred', 'Estonian').label, null, 'idle shows the language')
assert.match(dictationStateCopy('listening', 'deferred', 'Estonian').tooltip, /Estonian/, 'the language stays in the tooltip')

console.log('dictationProblems.test.ts: R12/R13 and Windows-test additions passed')
