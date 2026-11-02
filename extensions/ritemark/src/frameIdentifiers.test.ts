/**
 * Sprint 152 (R7): the frame-shaping defaults in the extension's package.json equal the shell's in
 * branding/product.json, and the manifest names this extension's own identifiers.
 * Run: npx tsx src/frameIdentifiers.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BOARD_TAB_VIEW_TYPE, FRAME_SHAPING_SETTINGS, HOME_PLACE_ID, HOME_TAB_VIEW_TYPE, WELCOME_VIEW_TYPE } from './frameIdentifiers';

const extensionDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8'));
const product = JSON.parse(readFileSync(path.join(extensionDir, '..', '..', 'branding', 'product.json'), 'utf8'));

const ours = pkg.contributes.configurationDefaults as Record<string, unknown>;
const shells = product.configurationDefaults as Record<string, unknown>;
const differ = FRAME_SHAPING_SETTINGS.filter((key) => JSON.stringify(ours[key]) !== JSON.stringify(shells[key]));
assert.deepEqual(differ, [], `the frame-shaping defaults differ between package.json and branding/product.json: ${differ.join(', ')}`);
assert.ok(FRAME_SHAPING_SETTINGS.every((key) => key in ours), 'every frame-shaping setting has the extension\'s own default');

const frame = product.ritemarkFrame;
assert.equal(frame.extension, `${pkg.publisher}.${pkg.name}`);
assert.deepEqual(frame.permanentTabs.map((tab: { viewType: string }) => tab.viewType), [`mainThreadWebview-${HOME_TAB_VIEW_TYPE}`, `mainThreadWebview-${BOARD_TAB_VIEW_TYPE}`]);
assert.equal(frame.deskFront, `mainThreadWebview-${HOME_TAB_VIEW_TYPE}`);
assert.equal(frame.welcome, `mainThreadWebview-${WELCOME_VIEW_TYPE}`);
assert.equal(frame.homePlace, HOME_PLACE_ID);

console.log('frameIdentifiers: all assertions passed');
