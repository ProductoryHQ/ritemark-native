/**
 * Sprint 136 R11 (#486) — the operating system's language reaches dictation.
 * Run: npx tsx src/voiceDictation/systemLanguage.test.ts
 */
import assert from 'node:assert/strict';
import { systemLanguage } from './systemLanguage';

const nls = (config: unknown) => ({ VSCODE_NLS_CONFIG: JSON.stringify(config) });

assert.equal(systemLanguage(nls({ userLocale: 'en', osLocale: 'et-ee', resolvedLanguage: 'en' }), 'en'), 'et-ee');
assert.equal(systemLanguage(nls({ userLocale: 'en', osLocale: 'de' }), 'en'), 'de');
assert.equal(systemLanguage(nls({ userLocale: 'en' }), 'en'), 'en', 'no osLocale: the fallback');
assert.equal(systemLanguage(nls({ osLocale: '  ' }), 'fr'), 'fr', 'an empty osLocale: the fallback');
assert.equal(systemLanguage({}, 'en'), 'en', 'no NLS config at all (a test run): the fallback');
assert.equal(systemLanguage({ VSCODE_NLS_CONFIG: 'not json' }, 'en'), 'en');

console.log('systemLanguage: ok');
