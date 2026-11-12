/**
 * The theme settings Ritemark fills in once per profile (Sprint 52), and the
 * rule for which of them to write (#461): only the ones the person hasn't set.
 * A value already in the user's settings.json before the first start, put there
 * by the person or an admin, is theirs and is never overwritten.
 *
 * No `vscode` import, so the rule is unit-tested: firstRunThemeSettings.test.ts.
 */

export interface FirstRunSetting {
  section: 'window' | 'workbench';
  key: string;
  value: string | boolean;
}

export const FIRST_RUN_THEME_SETTINGS: readonly FirstRunSetting[] = [
  { section: 'window', key: 'autoDetectColorScheme', value: true },
  { section: 'workbench', key: 'iconTheme', value: 'ritemark-icons' },
  { section: 'workbench', key: 'preferredLightColorTheme', value: 'ritemark-light' },
  { section: 'workbench', key: 'preferredDarkColorTheme', value: 'ritemark-dark' },
];

/**
 * The settings first-run setup writes, in order. `userValue` returns what the
 * user's own settings hold for a key (`inspect().globalValue`), or `undefined`
 * when they hold nothing. Any value there, `false` and `null` included, is kept.
 */
export function firstRunThemeWrites(
  userValue: (section: FirstRunSetting['section'], key: string) => unknown,
): FirstRunSetting[] {
  return FIRST_RUN_THEME_SETTINGS.filter((setting) => userValue(setting.section, setting.key) === undefined);
}
