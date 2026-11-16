/**
 * The theme settings Ritemark fills in once per profile (Sprint 52), and the
 * rule for which of them to write (#461): only the ones the person hasn't set.
 * A value already in the user's settings.json before the first start, put there
 * by the person or an admin, is theirs and is never overwritten.
 *
 * One exception: a profile an older Ritemark already set up. Ritemark 1 builds
 * before Sprint 52 wrote the light theme with auto-detect off on every update
 * and stored `ritemark.themeAppliedVersion`; those values are Ritemark's own,
 * and replacing them is what this once-per-profile pass is for.
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
 * when they hold nothing. Any value there, `false` and `null` included, is kept,
 * unless `setUpBefore`: an older Ritemark wrote these settings on this profile,
 * so all four are replaced.
 */
export function firstRunThemeWrites(
  userValue: (section: FirstRunSetting['section'], key: string) => unknown,
  setUpBefore = false,
): FirstRunSetting[] {
  if (setUpBefore) return [...FIRST_RUN_THEME_SETTINGS];
  return FIRST_RUN_THEME_SETTINGS.filter((setting) => userValue(setting.section, setting.key) === undefined);
}

/** The user's own settings, as the setup reads and writes them (`inspect().globalValue`, `update(…, Global)`). */
export interface UserThemeSettings {
  userValue(section: FirstRunSetting['section'], key: string): unknown;
  write(section: FirstRunSetting['section'], key: string, value: FirstRunSetting['value']): PromiseLike<void>;
}

/**
 * Write what `firstRunThemeWrites` names. A write that fails (an unreadable or
 * read-only settings.json) is logged and does not stop the others. The result
 * is false then, so the caller keeps its once-per-profile marker unset and the
 * setup runs again on the next start, as it did when a write threw before.
 */
export async function applyFirstRunThemeSettings(
  settings: UserThemeSettings,
  setUpBefore: boolean,
  log: (message: string, error: unknown) => void = (message, error) => console.error(message, error),
): Promise<boolean> {
  let done = true;
  for (const setting of firstRunThemeWrites((section, key) => settings.userValue(section, key), setUpBefore)) {
    try {
      await settings.write(setting.section, setting.key, setting.value);
    } catch (error) {
      done = false;
      log(`Ritemark: could not set ${setting.section}.${setting.key} on first run`, error);
    }
  }
  return done;
}
