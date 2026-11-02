#!/usr/bin/env node

// Sprint 152 (R7, the startup contract): does this extension fill the frame the shell draws?
//
// The shell draws Ritemark's frame from its first frame, from the `ritemarkFrame` block of branding/product.json
// (patch 002's ritemarkFrame.ts): the places, their order, titles and icons, the head's rows, the AI column, the
// permanent tabs, the desk's front, the welcome, and the settings that shape the frame. The extension fills those slots.
// An extension release runs in a shell built from an older commit, so every identifier that manifest names must still
// be the extension's: its view containers and their views, the head rows' commands and menus (package.json), the
// permanent tabs', the desk front's and the welcome's view types and Home's place (src/frameIdentifiers.ts), and its
// defaults for the frame-shaping settings. A slot the extension no longer fills is released, logged, and the frame
// moves; a place it adds that the manifest doesn't name arrives late. release-extension-preflight.sh stops either.
//
// Usage:
//   node scripts/check-frame-manifest.mjs [--ref <git-ref> | --product <product.json>] [--extension <dir>]
//
// --ref reads branding/product.json at that ref (the shell release the extension would run in); --product reads a
// file instead. --extension is the extension's folder (extensions/ritemark unless given). Prints each mismatch and
// exits 1 when there is one; a shell with no manifest (before Sprint 152) passes, since it draws no slots.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WEBVIEW = 'mainThreadWebview-';
const CONTAINER = 'workbench.view.extension.';

/** What the check reads from src/frameIdentifiers.ts; one it can't read is a mismatch, never a skip. */
export const FRAME_IDENTIFIERS = ['HOME_TAB_VIEW_TYPE', 'BOARD_TAB_VIEW_TYPE', 'WELCOME_VIEW_TYPE', 'HOME_PLACE_ID', 'FRAME_SHAPING_SETTINGS'];

/**
 * The string and string-array constants exported from src/frameIdentifiers.ts, read without compiling it: either
 * quote, an optional type annotation, an optional `as const`.
 */
export function readFrameIdentifiers(source) {
  const identifiers = {};
  const string = /^(['"])(.*)\1$/;
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

/** Each way the extension (its package.json and frame identifiers) doesn't fill the frame the product's manifest draws. */
export function frameMismatches(product, pkg, identifiers) {
  const frame = product.ritemarkFrame;
  if (!frame) {
    return [];
  }
  const problems = [];
  for (const name of FRAME_IDENTIFIERS) {
    if (name === 'FRAME_SHAPING_SETTINGS' ? !Array.isArray(identifiers[name]) || !identifiers[name].length : typeof identifiers[name] !== 'string') {
      problems.push(`could not read ${name} from src/frameIdentifiers.ts`);
    }
  }
  const contributes = pkg.contributes ?? {};
  const containers = contributes.viewsContainers ?? {};
  const views = contributes.views ?? {};
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
      continue; // VS Code's own place (Documents)
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
  }
  for (const container of activitybar) {
    if (!places.some(place => place.id === `${CONTAINER}${container.id}`)) {
      problems.push(`place ${CONTAINER}${container.id}: not in the manifest (it would arrive after the first frame)`);
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

  // The settings that shape the frame: the extension's defaults are the shell's
  const shells = product.configurationDefaults ?? {};
  const defaults = contributes.configurationDefaults ?? {};
  for (const key of identifiers.FRAME_SHAPING_SETTINGS ?? []) {
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
  return problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
