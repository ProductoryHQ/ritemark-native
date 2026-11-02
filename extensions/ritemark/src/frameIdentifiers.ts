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

/** The welcome's webview panel. */
export const WELCOME_VIEW_TYPE = 'ritemark.welcome';

/** The place a project window opens on when it has none of its own. */
export const HOME_PLACE_ID = 'workbench.view.extension.ritemark-home';

// The settings that shape the frame are the shell's list (the manifest's `settings`): the shell has them in
// product.json's `configurationDefaults` for the first frame, and the extension's copies in `package.json` (for a shell
// without them) stay equal to them (`frameIdentifiers.test.ts`, and the release check).
