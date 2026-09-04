import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(projectRoot, '.github', 'workflows', 'build-windows.yml');

test('Windows shell build stages Ritemark outside the eager VS Code packager', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const stageStep = workflow.indexOf('- name: Stage extension outside VS Code shell build');
  const shellBuildStep = workflow.indexOf('- name: Build VS Code (win32-x64-min)');
  const finalCopyStep = workflow.indexOf('- name: Copy extension to build output');

  assert.notEqual(stageStep, -1, 'staging step must exist');
  assert.notEqual(shellBuildStep, -1, 'Windows shell build step must exist');
  assert.notEqual(finalCopyStep, -1, 'final extension copy step must exist');
  assert.ok(stageStep < shellBuildStep, 'extension must leave vscode/extensions before the shell build');
  assert.ok(shellBuildStep < finalCopyStep, 'final extension copy must happen after the shell build');

  assert.match(
    workflow,
    /stage-extension-for-shell-build\.sh\s+\\\s*\n\s*vscode\/extensions\/ritemark\s+\\\s*\n\s*"\$RUNNER_TEMP\/ritemark-extension"/,
  );
  assert.match(workflow, /STAGED_EXTENSION="\$RUNNER_TEMP\/ritemark-extension"/);
  assert.match(workflow, /cp -R "\$STAGED_EXTENSION" "\$EXT_DEST"/);
  assert.doesNotMatch(
    workflow,
    /cp -R vscode\/extensions\/ritemark "\$EXT_DEST"/,
    'the post-build step must not depend on an extension left inside the eager packager tree',
  );
});
