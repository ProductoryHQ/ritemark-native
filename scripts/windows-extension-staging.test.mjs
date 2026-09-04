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
  const floorVersionStep = workflow.indexOf('- name: Floor staged extension version');
  const stageStep = workflow.indexOf('- name: Stage extension outside VS Code shell build');
  const applyPatchesStep = workflow.indexOf('- name: Apply patches to staged shell state');
  const shellBuildStep = workflow.indexOf('- name: Build VS Code (win32-x64-min)');
  const finalCopyStep = workflow.indexOf('- name: Copy extension to build output');
  const provenanceStep = workflow.indexOf('- name: Embed and verify build provenance');
  const signedPayloadStep = workflow.indexOf('- name: Verify signed payload');
  const validateBuildStep = workflow.indexOf('- name: Validate build');

  assert.notEqual(preserveFontStep, -1, 'font preservation step must exist');
  assert.notEqual(pruneStep, -1, 'extension pruning step must exist');
  assert.notEqual(floorVersionStep, -1, 'staged extension version step must exist');
  assert.notEqual(stageStep, -1, 'staging step must exist');
  assert.notEqual(applyPatchesStep, -1, 'post-staging patch step must exist');
  assert.notEqual(shellBuildStep, -1, 'Windows shell build step must exist');
  assert.notEqual(finalCopyStep, -1, 'final extension copy step must exist');
  assert.notEqual(provenanceStep, -1, 'build provenance step must exist');
  assert.notEqual(signedPayloadStep, -1, 'signed payload verification step must exist');
  assert.notEqual(validateBuildStep, -1, 'post-sign build validation step must exist');
  assert.ok(preserveFontStep < pruneStep, 'the dependency-backed font must be copied before npm prune');
  assert.ok(pruneStep < floorVersionStep, 'the compiled extension must be pruned before its final version transform');
  assert.ok(floorVersionStep < stageStep, 'all extension transforms must finish before staging');
  assert.ok(stageStep < shellBuildStep, 'extension must leave vscode/extensions before the shell build');
  assert.ok(stageStep < applyPatchesStep, 'extension must be staged before derived state is recorded');
  assert.ok(applyPatchesStep < shellBuildStep, 'the staged shell state must be verified before build');
  assert.ok(shellBuildStep < finalCopyStep, 'final extension copy must happen after the shell build');
  assert.ok(finalCopyStep < provenanceStep, 'the copied extension must be attested before later packaging steps');
  assert.ok(signedPayloadStep < validateBuildStep, 'Authenticode-normalized payload verification must run after PE signing');

  assert.match(
    workflow,
    /stage-extension-for-shell-build\.sh\s+\\\s*\n\s*vscode\/extensions\/ritemark\s+\\\s*\n\s*"\$RUNNER_TEMP\/ritemark-extension"/,
  );
  assert.match(
    workflow.slice(stageStep, shellBuildStep),
    /tree-sha256\.mjs[\s\\]+"\$RUNNER_TEMP\/ritemark-extension"/,
    'the staged extension digest must be recorded before the shell build',
  );
  assert.match(workflow, /STAGED_EXTENSION="\$RUNNER_TEMP\/ritemark-extension"/);
  assert.match(workflow, /cp -R "\$STAGED_EXTENSION" "\$EXT_DEST"/);
  assert.match(
    workflow.slice(floorVersionStep, stageStep),
    /floor-bundled-extension\.sh[\s\\]+"vscode\/extensions\/ritemark"/,
    'the version floor must be included in the staged payload digest',
  );
  assert.match(
    workflow.slice(finalCopyStep),
    /--extension-input "\$STAGED_EXTENSION"[\s\\]+--expected-extension-sha "\$STAGED_EXTENSION_SHA"/,
    'provenance must compare the final copied extension with the pre-build staged digest',
  );
  assert.match(
    workflow.slice(validateBuildStep),
    /build-provenance\.mjs[\s\\]+--verify --target win32-x64 --app "\$BUILD_DIR"[\s\\]+--verify-recorded-extension-authenticode[\s\\]+--expected-extension-sha "\$STAGED_EXTENSION_SHA"[\s\\]+--expected-extension-authenticode-sha "\$STAGED_EXTENSION_AUTHENTICODE_SHA"/,
    'post-sign validation must bind the original tree and Authenticode-normalized digests',
  );
  const finalCopyCommand = workflow.indexOf('cp -R "$STAGED_EXTENSION" "$EXT_DEST"', finalCopyStep);
  assert.notEqual(finalCopyCommand, -1, 'the staged extension must be copied into the final app');
  assert.doesNotMatch(
    workflow.slice(finalCopyCommand, provenanceStep),
    /floor-bundled-extension|strip-foreign-agent-runtimes|rm -rf "\$EXT_DEST\//,
    'the final copied extension must remain byte-identical until provenance verification',
  );
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
