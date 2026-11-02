/**
 * Sprint 152 (R7, the startup contract): the identifiers that the shell's frame manifest (`branding/product.json`'s
 * `ritemarkFrame`, read by patch 002's `ritemarkFrame.ts`) names and that live in this extension's code, in one place.
 * The shell draws these slots before the extension starts; the extension fills them. The rest of what the manifest
 * names lives in `package.json` (the places' view containers and views, the head rows' commands and menus).
 *
 * `scripts/check-frame-manifest.mjs` reads this file and `package.json`, and `release-extension-preflight.sh` refuses
 * an extension release whose identifiers differ from the manifest of the shell it would run in. Change one only with
 * the manifest, in a shell release.
 */

/** Home's tab (the desk's front in a project window) and the Task board's: their webview panels' view types. */
export const HOME_TAB_VIEW_TYPE = 'ritemark.home';
export const BOARD_TAB_VIEW_TYPE = 'ritemark.taskBoard';

/**
 * What the shell draws for each permanent tab before the extension starts (the manifest's `title`, `icon`, `setting`):
 * the title, one icon per theme (relative to the extension's folder), and, for the board, the setting that turns it off.
 * The panels set these same values when they open, so a tab does not change when the extension takes it over.
 */
export const HOME_TAB_TITLE = 'Home';
export const HOME_TAB_ICON_LIGHT = 'media/home/home-tab-light.svg';
export const HOME_TAB_ICON_DARK = 'media/home/home-tab-dark.svg';
export const BOARD_TAB_TITLE = 'Task board';
export const BOARD_TAB_ICON_LIGHT = 'media/tasks-tab-light.svg';
export const BOARD_TAB_ICON_DARK = 'media/tasks-tab-dark.svg';
export const BOARD_TAB_SETTING = 'ritemark.features.task-board';

/** The welcome's webview panel. */
export const WELCOME_VIEW_TYPE = 'ritemark.welcome';

/** The place a project window opens on when it has none of its own. */
export const HOME_PLACE_ID = 'workbench.view.extension.ritemark-home';

// The settings that shape the frame are the shell's list (the manifest's `settings`): the shell has them in
// product.json's `configurationDefaults` for the first frame, and the extension's copies in `package.json` (for a shell
// without them) stay equal to them (`frameIdentifiers.test.ts`, and the release check).
