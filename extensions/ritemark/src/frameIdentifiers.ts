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

/**
 * The settings that shape the frame (Sprint 152, R1). The shell has them in `product.json`'s `configurationDefaults`,
 * so the frame has its shape from the first frame; the extension keeps its own copies in `package.json`, for a shell
 * without them. The two stay equal (`frameIdentifiers.test.ts`, and the release check).
 */
export const FRAME_SHAPING_SETTINGS = [
  'workbench.activityBar.location',
  'workbench.sideBar.location',
  'workbench.editor.tabSizing',
  'workbench.editor.tabSizingFixedMinWidth',
  'workbench.editor.tabSizingFixedMaxWidth',
  'workbench.editor.pinnedTabSizing',
  'workbench.editor.editorActionsLocation',
  'breadcrumbs.enabled',
  'workbench.iconTheme',
  'workbench.productIconTheme',
  'workbench.panel.defaultLocation',
  'terminal.integrated.defaultLocation',
  'terminal.integrated.hideOnStartup',
];
