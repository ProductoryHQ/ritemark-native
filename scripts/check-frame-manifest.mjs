#!/usr/bin/env node

// Sprint 152 (R7, the startup contract): does this extension fill the frame the shell draws?
//
// The shell draws Ritemark's frame from its first frame, from the `ritemarkFrame` block of branding/product.json
// (patch 002's ritemarkFrame.ts): the places, their order, titles and icons, the head's rows, the AI column, the
// permanent tabs, the desk's front, the welcome, and the settings that shape the frame. The extension fills those slots.
// An extension release runs in a shell built from an older commit, so every identifier that manifest names must still
// be the extension's: its view containers and their views, the head rows' commands and menus (package.json), the
// permanent tabs' (view type, title, icons, gating setting), the desk front's and the welcome's view types and Home's place (src/frameIdentifiers.ts), and its
// defaults for the frame-shaping settings the manifest lists (`settings`). A slot the extension no longer fills is released, logged, and the frame
// moves; a place it adds that the manifest doesn't name arrives late. release-extension-preflight.sh stops either.
//
// A place may carry a boolean `setting` and its `settingDefault`. The default must match package.json,
// and every view in the place must be shown on exactly
// `config.<setting>`, which is what the shell seeds for a new profile's first frame (ritemarkFrame.ts). A place that
// is off by default in that way and missing from an older shell's manifest is accepted (decision 2): with the flag
// off, as every installed app has it, the place never shows, so the frame doesn't move; with it on, the place arrives
// after the first frame and in More, since that shell's row gives a spot only to the places its manifest names
// (compositeBar.ts), until the shell release that names it. The CLI says so on stderr, one line per place. Only an
// extension's place can carry a setting.
//
// Usage:
//   node scripts/check-frame-manifest.mjs [--ref <git-ref> | --product <product.json>] [--extension <dir>]
//
// --ref reads branding/product.json at that ref (the shell release the extension would run in); --product reads a
// file instead. --extension is the extension's folder (extensions/ritemark unless given). Prints each mismatch and
// exits 1 when there is one; a shell with no manifest (before Sprint 152) passes, since it draws no slots.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEBVIEW = 'mainThreadWebview-';
const CONTAINER = 'workbench.view.extension.';

/** What the check reads from src/frameIdentifiers.ts; one it can't read is a mismatch, never a skip. */
export const FRAME_IDENTIFIERS = [
  'HOME_TAB_VIEW_TYPE', 'BOARD_TAB_VIEW_TYPE', 'WELCOME_VIEW_TYPE', 'HOME_PLACE_ID',
  'HOME_TAB_TITLE', 'HOME_TAB_ICON_LIGHT', 'HOME_TAB_ICON_DARK', 'BOARD_TAB_TITLE', 'BOARD_TAB_ICON_LIGHT', 'BOARD_TAB_ICON_DARK', 'BOARD_TAB_SETTING',
];

/**
 * The string and string-array constants exported from src/frameIdentifiers.ts, read without compiling it: either
 * quote, an optional type annotation, an optional `as const`.
 */
export function readFrameIdentifiers(source) {
  const identifiers = {};
  const string = /^(['"])([^'"]*)\1$/;
  for (const match of source.matchAll(/export const (\w+)(?:\s*:\s*[^=]+?)?\s*=\s*([^;]+?)(?:\s+as\s+const)?\s*;/gs)) {
    const value = match[2].trim();
    if (string.test(value)) {
      identifiers[match[1]] = value.match(string)[2];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      identifiers[match[1]] = [...value.matchAll(/(['"])([^'"]*)\1/g)].map(entry => entry[2]);
    }
  }
  return identifiers;
}

/** The extension's settings: package.json's `configuration`, one section or a list of them, as one map of properties. */
function settingsOf(pkg) {
  const configuration = pkg.contributes?.configuration ?? [];
  return Object.assign({}, ...(Array.isArray(configuration) ? configuration : [configuration]).map(section => section?.properties ?? {}));
}

/**
 * The setting that keeps a view container off by default: every one of its views is shown on exactly `config.<key>`,
 * and the key is a boolean of the extension's that is false by default. Undefined when it is not off by default.
 */
export function offByDefaultSetting(pkg, containerId) {
  const views = pkg.contributes?.views?.[containerId];
  if (!Array.isArray(views) || !views.length) {
    return undefined;
  }
  const keys = new Set(views.map(view => typeof view.when === 'string' && view.when.startsWith('config.') ? view.when.slice('config.'.length) : undefined));
  const [key] = keys;
  const setting = settingsOf(pkg)[key];
  return keys.size === 1 && key && /^[\w.-]+$/.test(key) && setting?.type === 'boolean' && setting.default === false ? key : undefined;
}

/**
 * The extension's places that the shell's manifest doesn't name, each with the setting that keeps it off by default
 * (accepted, decision 2) or none (refused: it would arrive after the first frame). The one rule for both the check and
 * the CLI's note.
 */
export function placesMissing(product, pkg) {
  const places = product.ritemarkFrame?.places ?? [];
  return (pkg.contributes?.viewsContainers?.activitybar ?? [])
    .filter(container => !places.some(place => place.id === `${CONTAINER}${container.id}`))
    .map(container => ({ id: `${CONTAINER}${container.id}`, offBy: offByDefaultSetting(pkg, container.id) }));
}

/** The places missing from the shell's manifest that are accepted because they are off by default, with their settings. */
export function offByDefaultPlacesMissing(product, pkg) {
  return placesMissing(product, pkg).filter(place => place.offBy).map(place => ({ id: place.id, setting: place.offBy }));
}

/** Each way the extension (its package.json and frame identifiers) doesn't fill the frame the product's manifest draws. */
export function frameMismatches(product, pkg, identifiers) {
  const frame = product.ritemarkFrame;
  if (!frame) {
    return [];
  }
  const problems = [];
  for (const name of FRAME_IDENTIFIERS) {
    if (typeof identifiers[name] !== 'string') {
      problems.push(`could not read ${name} from src/frameIdentifiers.ts`);
    }
  }
  const contributes = pkg.contributes ?? {};
  const containers = contributes.viewsContainers ?? {};
  const views = contributes.views ?? {};
  const settings = settingsOf(pkg);
  const commands = new Set((contributes.commands ?? []).map(command => command.command));
  const menus = new Set(Object.keys(contributes.menus ?? {}));
  const hasViews = id => Array.isArray(views[id]) && views[id].length > 0;

  const extension = `${pkg.publisher}.${pkg.name}`;
  if (frame.extension !== extension) {
    problems.push(`the manifest's extension is ${frame.extension}, this one is ${extension}`);
  }

  // The places: each of Ritemark's is a view container of this extension's, with its views, title and icon
  const places = frame.places ?? [];
  const activitybar = containers.activitybar ?? [];
  for (const place of places) {
    if (!place.id?.startsWith(CONTAINER)) {
      // VS Code's own place (Documents): no view container of ours, and nothing of ours that a setting could gate
      if (place.setting !== undefined || place.settingDefault !== undefined) {
        problems.push(`place ${place.id}: VS Code's own place can't carry a setting (only an extension's place is shown on one)`);
      }
      continue;
    }
    const id = place.id.slice(CONTAINER.length);
    const container = activitybar.find(entry => entry.id === id);
    if (!container) {
      problems.push(`place ${place.id}: no view container ${id} in package.json`);
      continue;
    }
    if (!hasViews(id)) {
      problems.push(`place ${place.id}: its view container has no views`);
    }
    if (container.title !== place.title) {
      problems.push(`place ${place.id}: titled "${container.title}", the manifest's placeholder says "${place.title}"`);
    }
    if (place.icon && container.icon !== place.icon) {
      problems.push(`place ${place.id}: its icon is ${container.icon}, the manifest's placeholder draws ${place.icon}`);
    }
    // A place with a setting: shown only while it is on, at the first frame as the shell seeds it and after it
    if (place.setting !== undefined) {
      const setting = settings[place.setting];
      if (typeof place.setting !== 'string' || setting?.type !== 'boolean') {
        problems.push(`place ${place.id}: its setting ${JSON.stringify(place.setting)} is not a boolean setting in package.json`);
      } else if (typeof place.settingDefault !== 'boolean' || setting.default !== place.settingDefault) {
        problems.push(`place ${place.id}: settingDefault must be a boolean matching ${place.setting} in package.json (manifest: ${JSON.stringify(place.settingDefault)}, package.json: ${JSON.stringify(setting.default)})`);
      }
      for (const view of hasViews(id) ? views[id] : []) {
        if (view.when !== `config.${place.setting}`) {
          problems.push(`place ${place.id}: its view ${view.id} is shown on ${JSON.stringify(view.when)}, the manifest seeds it on "config.${place.setting}"`);
        }
      }
    } else {
      if (place.settingDefault !== undefined) {
        problems.push(`place ${place.id}: settingDefault requires a setting`);
      }
      // Drawn from a new profile's first frame, then hidden once the extension registers it with the flag off
      const offBy = offByDefaultSetting(pkg, id);
      if (offBy) {
        problems.push(`place ${place.id}: off by default in package.json (config.${offBy}), but the manifest draws it always: give it "setting": "${offBy}", "settingDefault": false`);
      }
    }
  }
  // A place off by default (its views all shown on one false-by-default flag) may be missing from an older shell's
  // manifest: with the flag off it never shows (decision 2)
  for (const place of placesMissing(product, pkg)) {
    if (!place.offBy) {
      problems.push(`place ${place.id}: not in the manifest (it would arrive after the first frame)`);
    }
  }

  // The AI column
  const auxiliary = containers.auxiliarybar ?? [];
  if (frame.aiColumn) {
    const id = frame.aiColumn.slice(CONTAINER.length);
    if (!auxiliary.some(entry => entry.id === id) || !frame.aiColumn.startsWith(CONTAINER)) {
      problems.push(`the AI column ${frame.aiColumn}: no such view container in the auxiliary bar`);
    } else if (!hasViews(id)) {
      problems.push(`the AI column ${frame.aiColumn}: its view container has no views`);
    }
  }
  for (const container of auxiliary) {
    if (`${CONTAINER}${container.id}` !== frame.aiColumn) {
      problems.push(`the AI column holds only ${frame.aiColumn}, not ${CONTAINER}${container.id}`);
    }
  }

  // The head's rows: their commands, and the menus that open under them
  for (const place of places) {
    for (const row of place.head?.rows ?? []) {
      if (!commands.has(row.command)) {
        problems.push(`head row on ${place.id}: no command ${row.command} in package.json`);
      }
      if (row.menu && !menus.has(row.menu)) {
        problems.push(`head row on ${place.id}: no menu ${row.menu} in package.json`);
      }
    }
  }

  // The tabs, the desk's front, the welcome and Home's place: the extension's code (src/frameIdentifiers.ts)
  const tabs = (frame.permanentTabs ?? []).map(tab => tab.viewType);
  const ours = [identifiers.HOME_TAB_VIEW_TYPE, identifiers.BOARD_TAB_VIEW_TYPE].map(viewType => `${WEBVIEW}${viewType}`);
  if (JSON.stringify(tabs) !== JSON.stringify(ours)) {
    problems.push(`the permanent tabs are ${tabs.join(', ') || 'none'} in the manifest, ${ours.join(', ')} in src/frameIdentifiers.ts`);
  } else {
    // Everything else the shell draws for a tab before the extension starts: its title, its icon per theme, its gating setting
    const drawn = [
      { name: 'Home', title: identifiers.HOME_TAB_TITLE, light: identifiers.HOME_TAB_ICON_LIGHT, dark: identifiers.HOME_TAB_ICON_DARK, setting: undefined },
      { name: 'Task board', title: identifiers.BOARD_TAB_TITLE, light: identifiers.BOARD_TAB_ICON_LIGHT, dark: identifiers.BOARD_TAB_ICON_DARK, setting: identifiers.BOARD_TAB_SETTING },
    ];
    (frame.permanentTabs ?? []).forEach((tab, index) => {
      const expected = drawn[index];
      const fields = [
        ['title', tab.title, expected.title],
        ['light icon', tab.icon?.light, expected.light],
        ['dark icon', tab.icon?.dark, expected.dark],
        ['setting', tab.setting, expected.setting],
      ];
      for (const [field, shell, extensionValue] of fields) {
        if (shell !== extensionValue) {
          problems.push(`permanent tab ${expected.name}: its ${field} is ${JSON.stringify(shell)} in the manifest, ${JSON.stringify(extensionValue)} in src/frameIdentifiers.ts`);
        }
      }
    });
  }
  if (frame.deskFront !== `${WEBVIEW}${identifiers.HOME_TAB_VIEW_TYPE}`) {
    problems.push(`the desk's front is ${frame.deskFront} in the manifest, ${WEBVIEW}${identifiers.HOME_TAB_VIEW_TYPE} in src/frameIdentifiers.ts`);
  }
  if (frame.welcome !== `${WEBVIEW}${identifiers.WELCOME_VIEW_TYPE}`) {
    problems.push(`the welcome is ${frame.welcome} in the manifest, ${WEBVIEW}${identifiers.WELCOME_VIEW_TYPE} in src/frameIdentifiers.ts`);
  }
  if (frame.homePlace !== identifiers.HOME_PLACE_ID) {
    problems.push(`Home's place is ${frame.homePlace} in the manifest, ${identifiers.HOME_PLACE_ID} in src/frameIdentifiers.ts`);
  }

  // The settings that shape the frame, as the shell lists them: the extension's defaults are the shell's
  const shells = product.configurationDefaults ?? {};
  const defaults = contributes.configurationDefaults ?? {};
  if (!Array.isArray(frame.settings) || !frame.settings.length) {
    problems.push('the manifest lists no frame-shaping settings (ritemarkFrame.settings)');
  }
  for (const key of Array.isArray(frame.settings) ? frame.settings : []) {
    if (JSON.stringify(shells[key]) !== JSON.stringify(defaults[key])) {
      problems.push(`setting ${key}: ${JSON.stringify(defaults[key])} in package.json, ${JSON.stringify(shells[key])} in the shell's product.json`);
    }
  }
  return problems;
}

function main(argv) {
  let ref;
  let productFile;
  let extensionDir = 'extensions/ritemark';
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--ref') {
      ref = argv[++index];
    } else if (arg === '--product') {
      productFile = argv[++index];
    } else if (arg === '--extension') {
      extensionDir = argv[++index];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  const productText = productFile ? readFileSync(productFile, 'utf8') : execFileSync('git', ['show', `${ref ?? 'HEAD'}:branding/product.json`], { encoding: 'utf8' });
  const product = JSON.parse(productText);
  const pkg = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8'));
  const identifiers = readFrameIdentifiers(readFileSync(path.join(extensionDir, 'src', 'frameIdentifiers.ts'), 'utf8'));
  if (!product.ritemarkFrame) {
    console.error(`the shell's product.json (${productFile ?? `${ref ?? 'HEAD'}:branding/product.json`}) has no frame manifest: nothing to fill`);
    return 0;
  }
  const problems = frameMismatches(product, pkg, identifiers);
  for (const problem of problems) {
    console.log(problem);
  }
  for (const place of offByDefaultPlacesMissing(product, pkg)) {
    console.error(`place ${place.id} is off by default (${place.setting}) and not in this shell's manifest: it shows only once the setting is on, after the first frame and in More`);
  }
  return problems.length ? 1 : 0;
}

// Run as a script, however it was reached (a symlinked checkout, /tmp on a Mac): compare real paths
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
