/**
 * The whole-window sheet's dev demo runs only in a development build that names a trigger file (Sprint 149, PR 5).
 */

import assert from 'node:assert/strict';
import { sheetDemoTrigger } from './sheetDemoTrigger';

assert.equal(sheetDemoTrigger({}), undefined);
assert.equal(sheetDemoTrigger({ RITEMARK_WEBVIEW_SHEET_DEMO: '/tmp/t' }), undefined, 'not in an installed Ritemark');
assert.equal(sheetDemoTrigger({ VSCODE_DEV: '1' }), undefined);
assert.equal(sheetDemoTrigger({ VSCODE_DEV: '1', RITEMARK_WEBVIEW_SHEET_DEMO: '  ' }), undefined);
assert.equal(sheetDemoTrigger({ VSCODE_DEV: '1', RITEMARK_WEBVIEW_SHEET_DEMO: ' /tmp/t ' }), '/tmp/t');
console.log('sheetDemoTrigger: 5 passing');
