/**
 * Sprint 136 R11 (#486) — dictation starts in the person's own language, then English.
 * Run: npx tsx webview/src/components/dictationLanguage.test.ts
 */
import assert from 'node:assert/strict'
import {
  defaultDictationLanguage,
  defaultRecentLanguages,
  dictationLanguageFor,
  setDictationSystemLanguage,
} from './dictationLanguage'

const known = ['en', 'et', 'de', 'fi', 'no', 'zh']

assert.equal(dictationLanguageFor('et-ee', known), 'et')
assert.equal(dictationLanguageFor('de_DE', known), 'de')
assert.equal(dictationLanguageFor('en-us', known), 'en')
assert.equal(dictationLanguageFor('nb-no', known), 'no', 'Bokmål is Whisper\'s Norwegian')
assert.equal(dictationLanguageFor('nn', known), 'no', 'so is Nynorsk')
assert.equal(dictationLanguageFor('zh-hans', known), 'zh')
assert.equal(dictationLanguageFor('xx-yy', known), 'en', 'a language Whisper lacks: English')
assert.equal(dictationLanguageFor('', known), 'en')
assert.equal(dictationLanguageFor(undefined, known), 'en')

// Nobody starts in Estonian unless their computer is in Estonian.
setDictationSystemLanguage(undefined)
assert.equal(defaultDictationLanguage(known), 'en')
assert.deepEqual(defaultRecentLanguages(known), ['en'])

setDictationSystemLanguage('en-gb')
assert.deepEqual(defaultRecentLanguages(known), ['en'], 'English once, not twice')

setDictationSystemLanguage('et-ee')
assert.equal(defaultDictationLanguage(known), 'et')
assert.deepEqual(defaultRecentLanguages(known), ['et', 'en'])

setDictationSystemLanguage('fi')
assert.deepEqual(defaultRecentLanguages(known), ['fi', 'en'])

console.log('dictationLanguage: ok')
