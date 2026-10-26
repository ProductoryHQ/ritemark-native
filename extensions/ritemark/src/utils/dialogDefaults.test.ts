/**
 * Sprint 143 (#510, R9, S40): every Ritemark picker starts in a folder that
 * exists, so a missing Desktop (or any missing folder) is never handed to the
 * operating system's dialog.
 *
 * Run: npx tsx src/utils/dialogDefaults.test.ts
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pickerFolder } from './dialogDefaults';

const folders = new Set(['C:\\Ritemark', 'C:\\Ritemark\\Documents\\Harbour']);
const deps = { isFolder: (p: string) => folders.has(p), home: () => 'C:\\Ritemark' };

// The project's folder when it is there.
assert.equal(pickerFolder(['C:\\Ritemark\\Documents\\Harbour'], deps), 'C:\\Ritemark\\Documents\\Harbour');
// A missing folder (the Desktop) is passed over, for the next candidate or the home.
assert.equal(pickerFolder(['C:\\Ritemark\\Desktop', 'C:\\Ritemark\\Documents\\Harbour'], deps), 'C:\\Ritemark\\Documents\\Harbour');
assert.equal(pickerFolder(['C:\\Ritemark\\Desktop'], deps), 'C:\\Ritemark');
// Nothing given: the home.
assert.equal(pickerFolder([undefined, null, ''], deps), 'C:\\Ritemark');
assert.equal(pickerFolder([], deps), 'C:\\Ritemark');
// The real file system: this folder exists, a made-up one doesn't.
assert.equal(pickerFolder([__dirname]), __dirname);
assert.equal(pickerFolder(['/no/such/folder/for/ritemark']), os.homedir());

// Every open dialog in the extension's source starts in a folder that exists.
const srcRoot = path.join(__dirname, '..');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}
let checked = 0;
for (const file of sources(srcRoot)) {
  const text = readFileSync(file, 'utf8');
  let at = text.indexOf('showOpenDialog(');
  while (at >= 0) {
    const call = text.slice(at, text.indexOf(');', at) + 2);
    const relative = path.relative(srcRoot, file);
    if (call.startsWith('showOpenDialog({')) {
      assert.match(call, /defaultUri: vscode\.Uri\.file\(pickerFolder\(/, `${relative}: showOpenDialog without an existing starting folder`);
    } else {
      // Options built beforehand (Flows): each options object names one.
      const options = (text.match(/const options: vscode\.OpenDialogOptions = \{[\s\S]*?\};/g) ?? []);
      assert.ok(options.length > 0 && options.every((block) => /defaultUri: vscode\.Uri\.file\(pickerFolder\(/.test(block)), `${relative}: options without an existing starting folder`);
    }
    checked += 1;
    at = text.indexOf('showOpenDialog(', at + 1);
  }
}
assert.ok(checked >= 14, `found the open dialogs (${checked})`);

console.log(`dialogDefaults: all passed (${checked} open dialogs)`);
