# Sprint 114 — Trusted Windows Install

**Status:** Reopened for Gate 2 build recovery. Runs `33954203308`, `33965759422`, `33968428932`, and `33970702424` progressively isolated CI-only standard-user harness faults after the Windows app, Azure signing, payload verification, validation, and signed installer build had passed. The latest run produced preserved installer SHA-256 `7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3` from approved product commit `8698ce9900ec437067a40eda3f5209f79029786f`, installed it successfully as a standard user, and verified all 44 installed PE signatures. Its last failure was the harness expecting `DisplayName=Ritemark` although Inno Setup correctly writes the configured `AppVerName`, `Ritemark 1.10.0`. The corrected verifier and preserved-installer replay remain to pass before Gate 2. The immutable download URL, legal URLs, Partner Center certification, Kristiina SAC-On test, and Jarmo exact-hash approval remain v1.10.0 release gates.<br>
**Branch:** `codex/sprint-114-trusted-windows-install`<br>
**Follow-up branch:** `codex/sprint-114-windows-standard-user-ci`<br>
**Second follow-up branch:** `codex/sprint-114-windows-user-environment`<br>
**Issue:** [#212](https://github.com/ProductoryHQ/ritemark-native/issues/212)<br>
**Release:** [v1.10.0](../release-plan.md)

## User problem

A Windows user should be able to download, install, launch, and uninstall Ritemark without being told to bypass Windows security. Microsoft Store is the preferred channel; the signed direct installer remains available as a fallback.

## Outcomes

1. **Every PE is trusted.** CI finds PE content regardless of whether the file ends in `.exe`, `.dll`, `.node`, or has no extension. It preserves valid vendor signatures and signs Ritemark-owned or unsigned files as **Productory Services OÜ**.
2. **Inno signs its own executables.** The setup loader, outer installer, and generated uninstaller are signed during compilation.
3. **The installer works for a normal user.** CI silently installs under a standard Windows account, verifies the installed tree and single Ritemark Start-menu/app registration, detects unwanted additional registration, then silently uninstalls and checks cleanup.
4. **Windows enforcement accepts it.** Kristiina tests the exact installer on a clean Windows 11 machine with Smart App Control On without disabling SmartScreen, SAC, or Defender.
5. **Store submission is usable.** Partner Center receives the exact tested installer from a versioned HTTPS URL. The Store and direct download must have the same SHA-256.

## Scope

- One manually started, always-signed Windows workflow. Missing credentials or any failed signature blocks artifact upload.
- Content-based PE discovery and straightforward Authenticode + `signtool verify /pa /all` checks.
- Standard-user silent install/uninstall and basic product-registration checks.
- Practical Partner Center and Kristiina test instructions.
- Store-first user guidance with a signed direct-download fallback.

## Not in scope

- CI/release governance or distribution infrastructure beyond the one manual signed workflow and the versioned Store URL.
- MSIX conversion unless Partner Center rejects the signed EXE and Jarmo approves a later change.
- Disabling Windows security, buying an EV certificate, Windows ARM64, commerce, or Intune packaging.

## Sprint closeout

- [x] The manual Windows workflow implements always-on signing and blocks artifact upload when signing or verification fails.
- [x] Payload, installer, installed-tree, uninstaller, and standard-user install/registration/uninstall checks are implemented.
- [x] Focused local tests and `./scripts/validate-qa.sh` pass.
- [x] Repo implementation and documentation are complete and may merge without producing a new Windows build now.

## Deferred v1.10.0 release gates

These checks require the final release-ready v1.10.0 bytes. They do not keep the Sprint 114 worktree or PR open; issue [#212](https://github.com/ProductoryHQ/ritemark-native/issues/212) remains open as their release-gate tracker.

- [ ] Build and verify the fully signed v1.10.0 Windows candidate.
- [ ] Publish that exact candidate at `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe` without later replacing its bytes.
- [ ] Submit the same SHA-256 to Partner Center and pass certification.
- [ ] Kristiina's clean Windows 11 SAC-On test passes for that exact SHA-256.
- [ ] Microsoft Store becomes the primary Windows link; the direct installer remains the same signed file.
- [ ] Jarmo gives Windows Gate 2 approval for that exact SHA-256.

## Gate 2 build recovery

- [x] Preserve the failed run and identify its exact failing step and error instead of blindly rerunning it.
- [x] Confirm the failure mode: the retry queue waited its full minute but could not make progress because the VS Code packager had eagerly opened Ritemark's production dependency streams.
- [x] Remove redundant packaging: compile and validate the target-specific extension, stage it outside `vscode/extensions`, build the VS Code shell, then copy the same staged extension into the final app.
- [x] Add a deterministic staging test covering complete content, paths with spaces, collision refusal, and incomplete-extension refusal.
- [x] Keep provenance fail-closed: stage the extension before recording the Windows patch state, bind its intentional absence into the complete VS Code shell fingerprint, and leave macOS extension inputs fully fingerprinted.
- [x] Preserve and validate the locked Phosphor workbench font before extension dev dependencies are pruned; fail closed if neither the dependency source nor the preserved destination exists.
- [x] Record the complete staged extension tree digest before the shell build, require the final copied extension to match it, and embed that digest in build provenance.
- [x] Complete every extension transform, including the bundled-version floor, before staging; forbid post-copy extension mutation before attestation.
- [x] Keep integrity continuous across signing: both macOS build paths record an external exact extension-tree digest, signing verifies it immediately before the first Mach-O mutation, and DMG packaging then requires the valid deep app signature.
- [x] Preserve the x64 app's symlinks and executable modes across GitHub artifact transport with a verified tar archive, and bind POSIX permission bits into the extension-tree digest.
- [x] Restore the downloaded x64 archive through one fail-closed extractor before signing; keep the canonical Claude and Codex release playbooks aligned with that command.
- [x] On Windows, bind every extension PE header/section/overlay byte and every non-PE byte to the staged attestation; normalize only Authenticode-owned checksum, Certificate Table metadata, and the exact Certificate Table range, then independently verify every PE signature.
- [x] Preserve run `33954203308` as evidence that build, signing, payload validation, and signed-installer creation pass before the standard-user test fails with `Access is denied`.
- [x] Stage the exact signed installer bytes inside the new standard user's own profile, verify the staged SHA-256 before launch, and never launch the runner-workspace path across the user boundary.
- [x] Remove the unnecessary pre-install `NTUSER.DAT` mount for the newly created account; retry and explicitly verify the post-process hive mount/unmount transitions.
- [x] Capture Inno Setup install and uninstall logs on failure, with a deterministic workflow-shape regression test.
- [x] Pass repository QA and review.
- [x] Pass follow-up QA and local PowerShell syntax validation for the standard-user CI recovery.
- [x] Preserve run `33965759422` as evidence that exact-main build, signing, validation, and installer creation pass while Inno exits `1` before log creation under the inherited runner-admin process environment.
- [x] Replace that implicit environment boundary with an explicit standard-user working directory and identity/profile/temp/shell-folder environment shared by the canary, installer, and uninstaller.
- [x] Require an alternate-user canary to prove identity, environment, working directory, write access, and the user-visible installer SHA-256 before installation.
- [x] Decouple the immutable approved product-source SHA from the workflow revision: the paid workflow requires an explicit 40-character source commit, checks out that exact commit, still requires it to equal canonical `origin/main`, and records both source and workflow commits beside the installer hash.
- [x] Preserve run `33968428932` as evidence that the isolated standard-user process installs the signed application and that all 44 installed PE files verify; classify the later `reg unload` failure as an admin-side test-harness race.
- [x] Replace admin-side `HKEY_USERS` hive mounting with a shared verifier that inspects `HKCU` inside the same standard-user credential boundary before and after uninstall.
- [x] Pass the first shared standard-user/HKCU verifier in free `windows-latest` canary run `33970548341` before using it in the release workflow.
- [x] Preserve run `33970702424` and its exact signed installer after it proved standard-user install plus all 44 installed PE signatures, then failed only because the shared verifier modeled Inno's uninstall `DisplayName` incorrectly.
- [x] Match Inno Setup's documented registration contract: absent an explicit `UninstallDisplayName`, the registry `DisplayName` is `AppVerName` (`Ritemark 1.10.0`), while still detecting leftover or duplicate Ritemark registrations.
- [x] Extract the complete standard-user install/signature/registration/uninstall sequence into one shared roundtrip script used by both the release build and the preserved-installer replay path.
- [x] Capture every alternate-user child process's stdout/stderr and retain roundtrip evidence after the temporary user is deleted.
- [ ] Pass the corrected standard-user/HKCU contract in the free `windows-latest` canary.
- [ ] Replay and pass the preserved installer from run `33970702424` without rebuilding or re-signing product bytes.

## Decisions

- **2026-09-05 — Do not invalidate an approved Mac RC for a Windows-only CI harness correction.** The Windows workflow definition may advance independently, but the product checkout remains pinned to the exact Gate 1 source commit and must still pass the existing `origin/main` integrity and embedded provenance gates. Both identities are recorded in the workflow summary and Windows hash manifest.
- **2026-09-05 — Inspect user-owned state as that user.** Do not mount a generated user's `NTUSER.DAT` into `HKEY_USERS` from the runner administrator. Run the registry verifier under the exact standard-user credentials and `HKCU`, and exercise that same verifier in the free Windows canary before paying for another release build.
- **2026-09-05 — Preserve a completed signed installer even when the last test fails.** Record its SHA/source/workflow identity before the roundtrip and upload it with `if: always()`; this prevents a late harness failure from destroying the only debuggable artifact.
- **2026-09-05 — Re-verify immutable bytes instead of rebuilding after a harness-only failure.** A manual path in the free Windows canary accepts the source run ID, expected product commit, expected installer SHA-256, and version; it downloads the preserved artifact, fails closed on identity mismatch, and runs the same shared roundtrip script without compiling or signing a new product.
- **2026-09-05 — Model the installer's declared contract, not a synthetic canary value.** Inno Setup uses `AppVerName` as the Add/Remove Programs display name when `UninstallDisplayName` is absent. Both the canary and release verifier therefore require `Ritemark <version>` and retain the observed key names, display names, publishers, and versions as evidence.

- Existing repository-level Azure signing secrets remain in use.
- GitHub Release continues as the secondary direct-download location; no channel redesign is needed.
- Jarmo handles Partner Center setup and final submission. Kristiina performs the clean-machine SAC-On test.
- No Windows build is run for sprint closeout. Candidate signing, hosting, Store certification, SAC-On validation, and exact-hash approval happen once against the final v1.10.0 release-ready build.
- The 2026-08-25 Store worksheet records the exact package fields, draft listing copy, media inventory, and current blockers; it does not authorize a pre-Gate-1 Windows dispatch or submission.
- No `docs/development/architecture.md` update is required because this sprint changes packaging and documentation only.
- Ritemark is no longer packaged twice during the Windows build. VS Code builds the shell without Ritemark in its eager local-extension stream; the already compiled, pruned, target-specific extension is copied into the final shell exactly once and is then covered by the existing completeness, provenance, signing, install, and uninstall gates. Windows records and verifies its complete patched shell only after staging, with the extension's absence as part of that fingerprint. macOS keeps its physical extension copy in the complete fingerprint, so the Windows recovery cannot weaken another platform's provenance gate.
- No changelog or public release-note entry is added for this recovery because it changes only the release build pipeline and does not change user-facing product behavior.
- Run `33954203308` did not upload an artifact: fail-closed upload remained after the standard-user install/uninstall gate. The observed `Access is denied` happened only after the installer signature, Windows shell, signed payload, and installer-build checks had passed; the recovery therefore changes test-user isolation and diagnostics, not product payload or signing policy.
