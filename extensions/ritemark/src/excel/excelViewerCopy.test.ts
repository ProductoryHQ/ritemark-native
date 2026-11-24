/**
 * The Excel viewer's cell Copy (Sprint 158's sheet grid sends `copyToClipboard`) reaches the clipboard: the editor
 * handles the message and writes only its text. Found missing in Sprint 174 PR 4b's test window.
 * Run: npx tsx src/excel/excelViewerCopy.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const provider = readFileSync(join(__dirname, '..', 'excelEditorProvider.ts'), 'utf8');
const sheetGrid = readFileSync(join(__dirname, '..', '..', 'webview', 'src', 'components', 'excel', 'SheetGrid.tsx'), 'utf8');
const clipboard = readFileSync(join(__dirname, '..', '..', 'webview', 'src', 'lib', 'clipboard.ts'), 'utf8');

assert.match(sheetGrid, /writeClipboard\(/, 'the sheet grid copies cells through the shared clipboard helper');
assert.match(clipboard, /sendToExtension\('copyToClipboard', \{ text \}\)/, 'the helper sends copyToClipboard');
const handler = provider.match(/case 'copyToClipboard':([\s\S]*?)break;/);
assert.ok(handler, 'the Excel viewer handles copyToClipboard');
assert.match(handler![1], /typeof message\.text === 'string'/, 'only text is written');
assert.match(handler![1], /vscode\.env\.clipboard\.writeText\(message\.text\)/, 'the text goes to the clipboard');
console.log('excelViewerCopy: cell Copy reaches the clipboard');
