/**
 * #461: first-run theme setup fills in only what the person hasn't set.
 * Run: npx tsx src/firstRunThemeSettings.test.ts
 */

import assert from 'node:assert/strict';
import { FIRST_RUN_THEME_SETTINGS, applyFirstRunThemeSettings, firstRunThemeWrites, type UserThemeSettings } from './firstRunThemeSettings';

const listBefore = JSON.stringify(FIRST_RUN_THEME_SETTINGS);
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

// A profile a Ritemark 1 build before Sprint 52 set up holds that build's own values: all four are replaced.
assert.deepEqual(firstRunThemeWrites(() => 'set', true), [...FIRST_RUN_THEME_SETTINGS]);

// ── The setup itself, against a stand-in for the user's settings.json ──────────

/** A user settings.json: `inspect().globalValue` reads it, `update(…, Global)` writes it. */
function settingsFile(initial: Record<string, unknown>, failing: string[] = []): UserThemeSettings & { json: Record<string, unknown> } {
  const json: Record<string, unknown> = { ...initial };
  return {
    json,
    userValue: (section, key) => json[`${section}.${key}`],
    write: async (section, key, value) => {
      if (failing.includes(`${section}.${key}`)) throw new Error('settings.json is read-only');
      json[`${section}.${key}`] = value;
    },
  };
}
const quiet = () => {};

void (async () => {
  // The issue's file: a value in settings.json before the first start survives the setup.
  const chosen = settingsFile({ 'window.autoDetectColorScheme': false, 'workbench.colorTheme': 'Ritemark Dark' });
  assert.equal(await applyFirstRunThemeSettings(chosen, false), true);
  assert.deepEqual(chosen.json, {
    'window.autoDetectColorScheme': false,
    'workbench.colorTheme': 'Ritemark Dark',
    'workbench.iconTheme': 'ritemark-icons',
    'workbench.preferredLightColorTheme': 'ritemark-light',
    'workbench.preferredDarkColorTheme': 'ritemark-dark',
  }, 'false and the chosen theme are kept; the three missing settings are filled in');

  // A new profile with nothing in settings.json still gets Ritemark's defaults.
  const empty = settingsFile({});
  assert.equal(await applyFirstRunThemeSettings(empty, false), true);
  assert.deepEqual(empty.json, {
    'window.autoDetectColorScheme': true,
    'workbench.iconTheme': 'ritemark-icons',
    'workbench.preferredLightColorTheme': 'ritemark-light',
    'workbench.preferredDarkColorTheme': 'ritemark-dark',
  });

  // A Ritemark 1 profile from before Sprint 52: its light-only, no-auto-detect values are migrated, as before #461.
  const old = settingsFile({
    'window.autoDetectColorScheme': false, 'workbench.colorTheme': 'ritemark-light', 'workbench.iconTheme': 'ritemark-icons',
    'workbench.preferredLightColorTheme': 'Ritemark Light', 'workbench.preferredDarkColorTheme': 'ritemark-light',
  });
  assert.equal(await applyFirstRunThemeSettings(old, true), true);
  assert.equal(old.json['window.autoDetectColorScheme'], true);
  assert.equal(old.json['workbench.preferredLightColorTheme'], 'ritemark-light');
  assert.equal(old.json['workbench.preferredDarkColorTheme'], 'ritemark-dark', 'a dark-mode system gets the dark theme');

  // One write that fails doesn't stop the others; the result says so, so the setup runs again next start.
  const logged: string[] = [];
  const readOnly = settingsFile({}, ['workbench.iconTheme']);
  assert.equal(await applyFirstRunThemeSettings(readOnly, false, (message) => logged.push(message)), false);
  assert.deepEqual(Object.keys(readOnly.json), ['window.autoDetectColorScheme', 'workbench.preferredLightColorTheme', 'workbench.preferredDarkColorTheme']);
  assert.deepEqual(logged, ['Ritemark: could not set workbench.iconTheme on first run']);
  const nextStart = settingsFile(readOnly.json);
  assert.equal(await applyFirstRunThemeSettings(nextStart, false, quiet), true);
  assert.equal(nextStart.json['workbench.iconTheme'], 'ritemark-icons', 'the next start fills in what failed');

  assert.equal(JSON.stringify(FIRST_RUN_THEME_SETTINGS), listBefore, 'the list itself is not changed by a call');
  console.log('✓ firstRunThemeSettings tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
