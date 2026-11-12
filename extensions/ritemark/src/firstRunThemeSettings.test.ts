/**
 * #461: first-run theme setup fills in only what the person hasn't set.
 * Run: npx tsx src/firstRunThemeSettings.test.ts
 */

import assert from 'node:assert/strict';
import { FIRST_RUN_THEME_SETTINGS, firstRunThemeWrites } from './firstRunThemeSettings';

const from = (settings: Record<string, unknown>) => (section: string, key: string): unknown => settings[`${section}.${key}`];

// A new profile with an empty settings.json: all four are written, in order.
assert.deepEqual(firstRunThemeWrites(from({})), [
  { section: 'window', key: 'autoDetectColorScheme', value: true },
  { section: 'workbench', key: 'iconTheme', value: 'ritemark-icons' },
  { section: 'workbench', key: 'preferredLightColorTheme', value: 'ritemark-light' },
  { section: 'workbench', key: 'preferredDarkColorTheme', value: 'ritemark-dark' },
]);

// The issue's case: `false` written before the first start stays `false`.
assert.deepEqual(
  firstRunThemeWrites(from({ 'window.autoDetectColorScheme': false })).map((s) => `${s.section}.${s.key}`),
  ['workbench.iconTheme', 'workbench.preferredLightColorTheme', 'workbench.preferredDarkColorTheme'],
  'a value set before the first start is not overwritten',
);

// The same rule for the other three, and for a value equal to Ritemark's own.
assert.deepEqual(
  firstRunThemeWrites(from({ 'workbench.preferredDarkColorTheme': 'some-other-dark', 'workbench.iconTheme': 'ritemark-icons' })).map((s) => s.key),
  ['autoDetectColorScheme', 'preferredLightColorTheme'],
);

// null is a value the person wrote (it turns the icon theme off).
assert.deepEqual(
  firstRunThemeWrites(from({ 'workbench.iconTheme': null })).map((s) => s.key),
  ['autoDetectColorScheme', 'preferredLightColorTheme', 'preferredDarkColorTheme'],
);

// Everything set: nothing to write.
assert.deepEqual(firstRunThemeWrites(() => 'set'), []);

// The list itself is not changed by a call.
assert.equal(FIRST_RUN_THEME_SETTINGS.length, 4);

console.log('✓ firstRunThemeSettings tests passed');
