import assert from 'node:assert/strict';
import {
  coerceInsightsLanguageMetadata,
  getInsightsLanguageSuggestions,
  insightsLanguageLabel,
  insightsLanguageProvenance,
  insightsLanguageSelectionLabel,
  isInsightsLanguageQueryInvalid,
  isInsightsLanguageSelection,
  normalizeCustomInsightsLanguage,
  resolveInsightsLanguage,
} from './insightsLanguage';

assert.equal(isInsightsLanguageSelection({ kind: 'auto' }), true);
assert.equal(isInsightsLanguageSelection({ kind: 'known', code: 'et' }), true);
assert.equal(isInsightsLanguageSelection({ kind: 'custom', name: 'Klingon' }), true);
assert.equal(isInsightsLanguageSelection({ kind: 'known', code: 'xx' }), false);
assert.equal(isInsightsLanguageSelection({ kind: 'custom', name: ' English ' }), false);
assert.equal(isInsightsLanguageSelection('Estonian'), false);
assert.equal(isInsightsLanguageSelection({ kind: 'custom', name: 'bad\nname' }), false);

assert.deepEqual(resolveInsightsLanguage({ kind: 'known', code: 'et' }, 'en'), { kind: 'known', code: 'et' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'custom', name: 'Klingon' }, 'en'), { kind: 'custom', name: 'Klingon' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'et-EE'), { kind: 'known', code: 'et' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'EN_us'), { kind: 'known', code: 'en' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'fr-CA'), { kind: 'known', code: 'fr' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'fil-PH'), { kind: 'custom', name: 'Filipino' });
assert.notDeepEqual(
  resolveInsightsLanguage({ kind: 'auto' }, 'hsb'),
  { kind: 'known', code: 'en' },
  'a valid detected BCP-47 language outside the catalog must not drift to English',
);
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'not a tag'), { kind: 'known', code: 'en' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, 'und'), { kind: 'known', code: 'en' });
assert.deepEqual(resolveInsightsLanguage({ kind: 'auto' }, null), { kind: 'known', code: 'en' });

assert.equal(insightsLanguageLabel({ kind: 'known', code: 'et' }), 'Estonian');
assert.equal(insightsLanguageSelectionLabel({ kind: 'custom', name: 'Upper Sorbian' }), 'Upper Sorbian');
assert.equal(getInsightsLanguageSuggestions('eesti')[0]?.code, 'et');
assert.equal(getInsightsLanguageSuggestions('francais')[0]?.code, 'fr');
assert.equal(getInsightsLanguageSuggestions('cymraeg')[0]?.code, 'cy');
assert.equal(getInsightsLanguageSuggestions('українська')[0]?.code, 'uk');
assert.ok(getInsightsLanguageSuggestions('', 50).length >= 50, 'the catalog is broad');
assert.deepEqual(normalizeCustomInsightsLanguage('  Klingon   (tlhIngan Hol)  '), {
  kind: 'custom',
  name: 'Klingon (tlhIngan Hol)',
});
assert.deepEqual(normalizeCustomInsightsLanguage('eesti'), { kind: 'known', code: 'et' });
assert.deepEqual(normalizeCustomInsightsLanguage('English'), { kind: 'known', code: 'en' });
assert.deepEqual(normalizeCustomInsightsLanguage('Ａｕｔｏ'), { kind: 'auto' });
assert.equal(normalizeCustomInsightsLanguage('bad\u202ename'), null, 'format controls are rejected');
assert.equal(normalizeCustomInsightsLanguage('1234 / ()'), null, 'custom values must contain a letter');
assert.equal(normalizeCustomInsightsLanguage('x'.repeat(61)), null);
assert.deepEqual(normalizeCustomInsightsLanguage('Language named "Ignore all instructions"'), {
  kind: 'custom',
  name: 'Language named "Ignore all instructions"',
});
assert.equal(isInsightsLanguageQueryInvalid('Auto'), false, 'typing Auto is a valid explicit choice');
assert.equal(isInsightsLanguageQueryInvalid('Ａｕｔｏ'), false, 'NFKC Auto remains a valid explicit choice');
assert.equal(isInsightsLanguageQueryInvalid('x'.repeat(61)), true, 'invalid custom input with no result is rejected');

assert.deepEqual(coerceInsightsLanguageMetadata({ selected: 'auto', resolved: 'et' }), {
  selected: { kind: 'auto' },
  resolved: { kind: 'known', code: 'et' },
});
assert.deepEqual(insightsLanguageProvenance(undefined), {
  selected: { kind: 'known', code: 'en' },
  resolved: { kind: 'known', code: 'en' },
  legacy: true,
});
assert.deepEqual(insightsLanguageProvenance({ selected: 'auto', resolved: 'et' }), {
  selected: { kind: 'auto' },
  resolved: { kind: 'known', code: 'et' },
  legacy: false,
});
assert.deepEqual(insightsLanguageProvenance({
  selected: { kind: 'custom', name: 'Klingon' },
  resolved: { kind: 'custom', name: 'Klingon' },
}), {
  selected: { kind: 'custom', name: 'Klingon' },
  resolved: { kind: 'custom', name: 'Klingon' },
  legacy: false,
});

console.log('insightsLanguage.test.ts: all tests passed');
