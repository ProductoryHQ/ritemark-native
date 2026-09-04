# Sprint 114 — Trusted Windows Install

**Status:** Reopened for Gate 2 build recovery after Windows run `33876792999` exposed an `EMFILE` deadlock in VS Code's eager local-extension packager. The signed candidate, immutable download URL, legal URLs, Partner Center certification, Kristiina SAC-On test, and Jarmo exact-hash approval remain v1.10.0 release gates.<br>
**Branch:** `codex/sprint-114-trusted-windows-install`<br>
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
- [x] Keep integrity continuous across signing: use the staged payload digest before signing, then require a valid deep macOS app signature before DMG packaging.
- [x] On Windows, bind every extension PE header/section/overlay byte and every non-PE byte to the staged attestation; normalize only Authenticode-owned checksum, Certificate Table metadata, and the exact Certificate Table range, then independently verify every PE signature.
- [x] Pass repository QA and review.
- [ ] Pass a fresh Windows build from the merged canonical `main` commit.

## Decisions

- Existing repository-level Azure signing secrets remain in use.
- GitHub Release continues as the secondary direct-download location; no channel redesign is needed.
- Jarmo handles Partner Center setup and final submission. Kristiina performs the clean-machine SAC-On test.
- No Windows build is run for sprint closeout. Candidate signing, hosting, Store certification, SAC-On validation, and exact-hash approval happen once against the final v1.10.0 release-ready build.
- The 2026-08-25 Store worksheet records the exact package fields, draft listing copy, media inventory, and current blockers; it does not authorize a pre-Gate-1 Windows dispatch or submission.
- No `docs/development/architecture.md` update is required because this sprint changes packaging and documentation only.
- Ritemark is no longer packaged twice during the Windows build. VS Code builds the shell without Ritemark in its eager local-extension stream; the already compiled, pruned, target-specific extension is copied into the final shell exactly once and is then covered by the existing completeness, provenance, signing, install, and uninstall gates. Windows records and verifies its complete patched shell only after staging, with the extension's absence as part of that fingerprint. macOS keeps its physical extension copy in the complete fingerprint, so the Windows recovery cannot weaken another platform's provenance gate.
- No changelog or public release-note entry is added for this recovery because it changes only the release build pipeline and does not change user-facing product behavior.
