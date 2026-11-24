/**
 * #978: a document opened at start (a double-click in Finder or Explorer while Ritemark is closed) opens in
 * Ritemark's editor. VS Code's custom-editor service registers the custom editors with the editor resolver only
 * when it is created; Delayed, it was created on idle, after a start's documents had been resolved to the text
 * editor. Patch 022 makes it Eager. This checks the patch says so and that no other patch touches the line.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const patchesDir = path.resolve(__dirname, '../../../patches/vscode');
const contribution = 'src/vs/workbench/contrib/customEditor/browser/customEditor.contribution.ts';
const patchName = '022-ritemark-custom-editor-at-startup.patch';

const patchPath = path.join(patchesDir, patchName);
assert.ok(fs.existsSync(patchPath), `${patchName} must exist (#978)`);
const patch = fs.readFileSync(patchPath, 'utf8');

assert.ok(patch.includes(`diff --git a/${contribution} b/${contribution}`), `${patchName} must patch ${contribution}`);
assert.ok(
  patch.includes('\n-registerSingleton(ICustomEditorService, CustomEditorService, InstantiationType.Delayed);\n'),
  `${patchName} must remove the Delayed registration`
);
assert.ok(
  patch.includes('\n+registerSingleton(ICustomEditorService, CustomEditorService, InstantiationType.Eager);\n'),
  `${patchName} must register ICustomEditorService Eager`
);

const others = fs
  .readdirSync(patchesDir)
  .filter((name) => name.endsWith('.patch') && name !== patchName)
  .filter((name) => fs.readFileSync(path.join(patchesDir, name), 'utf8').includes(`b/${contribution}`));
assert.deepEqual(others, [], `only ${patchName} may patch ${contribution}`);

console.log('customEditorAtStartup: 4 checks passed');
