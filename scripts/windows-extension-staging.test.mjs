import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(projectRoot, '.github', 'workflows', 'build-windows.yml');
const canaryWorkflowPath = path.join(projectRoot, '.github', 'workflows', 'windows-canary.yml');
const registryProbePath = path.join(projectRoot, 'scripts', 'windows-standard-user-registry-probe.ps1');

test('Windows release workflow separates immutable product source from workflow revision', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /source_commit:\s*\n\s+description:[^\n]+\n\s+required: true\n\s+type: string/);
  assert.match(workflow, /uses: actions\/checkout@v4[\s\S]*?ref: \$\{\{ inputs\.source_commit \}\}/);
  assert.match(workflow, /- name: Checkout reviewed release harness[\s\S]*?ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /SOURCE_COMMIT='\$\{\{ inputs\.source_commit \}\}'/);
  assert.match(workflow, /\^\[0-9a-fA-F\]\{40\}\$/);
  assert.match(workflow, /CHECKED_OUT_COMMIT="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /HARNESS_COMMIT="\$\(git -C \.\.\/ci-harness rev-parse HEAD\)"/);
  assert.match(workflow, /verify-release-source\.sh --target win32-x64 --phase pristine/);
  assert.match(workflow, /source_commit=\$\(\(git rev-parse HEAD\)\.Trim\(\)\)/);
  assert.match(workflow, /workflow_commit=\$env:GITHUB_SHA/);
});

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

test('Windows standard-user test proves an isolated user environment before installing', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const verificationStep = workflow.indexOf('- name: Verify install and uninstall as a standard user');
  const uploadStep = workflow.indexOf('- name: Upload signed Windows artifacts');
  assert.notEqual(verificationStep, -1, 'standard-user verification step must exist');
  assert.notEqual(uploadStep, -1, 'Windows artifact upload step must exist');

  const verification = workflow.slice(verificationStep, uploadStep);
  const profileInitialization = verification.indexOf("Start-Process -FilePath 'cmd.exe'");
  const stageInstaller = verification.indexOf('Copy-Item -LiteralPath $installer -Destination $stagedInstaller');
  const compareInstallerHash = verification.indexOf("Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256");
  const defineUserEnvironment = verification.indexOf('$userProcessEnvironment = @{');
  const environmentProbe = verification.indexOf('$environmentProbe = Start-Process');
  const compareProbe = verification.indexOf('$expectedProbe = [ordered]@{');
  const registryProbeFunction = verification.indexOf('function Invoke-RegistryProbe');
  const launchInstaller = verification.indexOf('Start-Process -FilePath $stagedInstaller');
  const verifyInstalled = verification.indexOf("Invoke-RegistryProbe 'verify-installed'");
  const launchUninstaller = verification.indexOf('Start-Process -FilePath $uninstaller.FullName');
  const verifyUninstalled = verification.indexOf("Invoke-RegistryProbe 'verify-uninstalled'");

  assert.ok(profileInitialization >= 0, 'the standard-user profile must be initialized');
  assert.ok(stageInstaller > profileInitialization, 'installer staging must happen after profile initialization');
  assert.ok(compareInstallerHash > stageInstaller, 'staged installer bytes must be hashed after copying');
  assert.ok(defineUserEnvironment > compareInstallerHash, 'the user environment must be defined after exact installer staging');
  assert.ok(environmentProbe > defineUserEnvironment, 'the alternate-user environment must be probed before install');
  assert.ok(compareProbe > environmentProbe, 'the probe result must be checked before install');
  assert.ok(registryProbeFunction > compareProbe, 'current-user registry inspection must share the proven user boundary');
  assert.ok(launchInstaller > compareProbe, 'only the user-readable, exact staged copy may be launched');
  assert.ok(verifyInstalled > launchInstaller, 'HKCU must be checked as the standard user after install');
  assert.ok(launchUninstaller > verifyInstalled, 'uninstall must run after the installed HKCU state is proven');
  assert.ok(verifyUninstalled > launchUninstaller, 'HKCU must be checked as the standard user after uninstall');
  for (const variable of ['USERNAME', 'USERDOMAIN', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP']) {
    assert.match(verification, new RegExp(`\\b${variable}\\s*=`), `${variable} must be explicit at the user boundary`);
  }
  const environmentProbeBlock = verification.slice(environmentProbe, compareProbe);
  assert.match(environmentProbeBlock, /-WorkingDirectory \$profileRoot/, 'the environment canary must run from the user profile');
  assert.match(environmentProbeBlock, /-Environment \$userProcessEnvironment/, 'the environment canary must receive the explicit user environment');
  assert.equal(
    (verification.match(/-Environment \$userProcessEnvironment/g) ?? []).length,
    4,
    'the environment canary, registry probe, installer, and uninstaller must share the same proven user environment',
  );
  assert.equal(
    (verification.match(/-WorkingDirectory \$profileRoot/g) ?? []).length,
    4,
    'the environment canary, registry probe, installer, and uninstaller must share the user-owned working directory',
  );
  assert.match(verification, /InstallerSha256 = \$originalInstallerSha/, 'the user-side installer hash must match the signed source');
  assert.match(verification, /\/LOG=\$installLog/, 'installation failures must retain an Inno Setup log');
  assert.match(verification, /\/LOG=\$uninstallLog/, 'uninstallation failures must retain an Inno Setup log');
  assert.match(verification, /ci-harness\\scripts\\windows-standard-user-registry-probe\.ps1/, 'the reviewed registry probe must be copied into the user profile');
  assert.doesNotMatch(verification, /HKEY_USERS|NTUSER\.DAT|reg\.exe (?:load|unload)|Mount-TestUserHive|Dismount-TestUserHive/, 'admin-side profile hive mounting must not return');
  assert.match(workflow.slice(uploadStep), /- name: Upload signed Windows artifacts\n\s+if: always\(\)/, 'a built signed installer must remain downloadable when the roundtrip test fails');
});

test('free Windows canary exercises the shared current-user registry verifier', async () => {
  const [canaryWorkflow, registryProbe] = await Promise.all([
    readFile(canaryWorkflowPath, 'utf8'),
    readFile(registryProbePath, 'utf8'),
  ]);

  assert.match(canaryWorkflow, /Verify standard-user process and HKCU boundary/);
  for (const mode of ['seed-canary', 'verify-installed', 'remove-canary', 'verify-uninstalled']) {
    assert.match(canaryWorkflow, new RegExp(`Invoke-CanaryRegistryProbe '${mode}'`));
    assert.match(registryProbe, new RegExp(`'${mode}'`));
  }
  assert.match(registryProbe, /HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall/);
  assert.doesNotMatch(registryProbe, /HKEY_USERS|NTUSER\.DAT|reg\.exe/);
});
