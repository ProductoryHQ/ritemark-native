import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(projectRoot, '.github', 'workflows', 'build-windows.yml');

test('Windows shell build stages Ritemark outside the eager VS Code packager', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const preserveFontStep = workflow.indexOf('- name: Preserve dependency-backed workbench font');
  const pruneStep = workflow.indexOf('- name: Prune extension dev files before build');
  const stageStep = workflow.indexOf('- name: Stage extension outside VS Code shell build');
  const applyPatchesStep = workflow.indexOf('- name: Apply patches to staged shell state');
  const shellBuildStep = workflow.indexOf('- name: Build VS Code (win32-x64-min)');
  const finalCopyStep = workflow.indexOf('- name: Copy extension to build output');

  assert.notEqual(preserveFontStep, -1, 'font preservation step must exist');
  assert.notEqual(pruneStep, -1, 'extension pruning step must exist');
  assert.notEqual(stageStep, -1, 'staging step must exist');
  assert.notEqual(applyPatchesStep, -1, 'post-staging patch step must exist');
  assert.notEqual(shellBuildStep, -1, 'Windows shell build step must exist');
  assert.notEqual(finalCopyStep, -1, 'final extension copy step must exist');
  assert.ok(preserveFontStep < pruneStep, 'the dependency-backed font must be copied before npm prune');
  assert.ok(pruneStep < stageStep, 'the compiled extension must be pruned before staging');
  assert.ok(stageStep < shellBuildStep, 'extension must leave vscode/extensions before the shell build');
  assert.ok(stageStep < applyPatchesStep, 'extension must be staged before derived state is recorded');
  assert.ok(applyPatchesStep < shellBuildStep, 'the staged shell state must be verified before build');
  assert.ok(shellBuildStep < finalCopyStep, 'final extension copy must happen after the shell build');

  assert.match(
    workflow,
    /stage-extension-for-shell-build\.sh\s+\\\s*\n\s*vscode\/extensions\/ritemark\s+\\\s*\n\s*"\$RUNNER_TEMP\/ritemark-extension"/,
  );
  assert.match(workflow, /STAGED_EXTENSION="\$RUNNER_TEMP\/ritemark-extension"/);
  assert.match(workflow, /cp -R "\$STAGED_EXTENSION" "\$EXT_DEST"/);
  assert.match(
    workflow.slice(preserveFontStep, pruneStep),
    /node_modules\/@phosphor-icons\/web\/src\/regular\/Phosphor\.woff2/,
    'the locked Phosphor font must be copied while its dev dependency exists',
  );
  assert.match(
    workflow.slice(preserveFontStep, pruneStep),
    /test -s "\$PHOSPHOR_DESTINATION"/,
    'the preserved font must be validated before pruning',
  );
  assert.match(
    workflow.slice(applyPatchesStep, shellBuildStep),
    /apply-patches\.sh --extension-layout absent/,
    'apply-patches must record the exact absent-extension Windows shell state',
  );
  assert.match(
    workflow.slice(applyPatchesStep, shellBuildStep),
    /verify-release-source\.sh\s+\\\s*\n\s*--target win32-x64 --phase patched --extension-layout absent/,
    'the staged shell state must pass the canonical source gate before the build starts',
  );
  assert.doesNotMatch(
    workflow,
    /cp -R vscode\/extensions\/ritemark "\$EXT_DEST"/,
    'the post-build step must not depend on an extension left inside the eager packager tree',
  );
  assert.doesNotMatch(
    workflow.slice(0, stageStep),
    /apply-patches\.sh(?! --dry-run)/,
    'release patches must not record provenance before the extension is staged',
  );
});
