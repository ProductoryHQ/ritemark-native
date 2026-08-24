# Sprint 114 Tasks — Trusted Windows Install

Tick `[x]` only when the artifact/evidence exists on `codex/sprint-114-trusted-windows-install` and can be linked from the diff or release evidence.

> **Gate:** Implementation starts only after Jarmo approves the plan and the dedicated non-`main` branch exists. Phase 0 is audit/documentation only.

## Phase 0 — Audit and Decision Freeze

- [ ] Download the exact current canonical Windows installer; record source URL, version, size, and SHA-256.
- [ ] Verify outer signature, signer, chain, digest, and timestamp.
- [ ] Reproduce on clean Windows 11 with SAC On; capture the exact Edge/SmartScreen/SAC/Defender state and Code Integrity 3076/3077 events.
- [ ] Verify extracted setup component, installed PE inventory, and generated uninstaller signatures.
- [x] Audit `.github/workflows/build-windows.yml`, `installer/windows/ritemark.iss`, `scripts/codesign-windows.sh`, and `scripts/validate-build-output.sh` against observed behavior.
- [x] Record Store account/name readiness, silent switches, privacy/support metadata, and immutable-host options.
- [x] Freeze owned-versus-third-party signing rules and the Azure command Inno will invoke.
- [x] **Jarmo Phase 0 gate:** approve signing design, Store path, host, responsibilities, and Sprint 114 first-priority placement.

## Phase 1 — Complete and Fail-Closed Signing

- [x] Create/update the Windows PE inventory to detect binaries by file contents, including `.dll` and `.node` files.
- [x] Move every resource/icon mutation before signing and add a regression check for post-sign mutation.
- [x] Sign all Ritemark-owned/unsigned PEs with Productory Services OÜ Public Trust; preserve valid trusted vendor signatures.
- [x] Register the Azure signing command with ISCC and compile with `/DSign` so `SignTool` and `SignedUninstaller` are active.
- [x] Add repo-owned verification for setup/installer evidence, installed PEs, and uninstaller with signer/chain/timestamp checks; Windows proof remains unchecked below.
- [x] Replace optional/default-skipped release signing verification with a fatal release check.
- [x] Add explicit non-release mode and prove its unsigned artifacts cannot use canonical names or upload paths.
- [x] Add workflow tests/fixtures for missing secret, wrong publisher, missing timestamp, unsigned native module, and changed-after-signing failures.

## Phase 2 — Windows Security Validation

- [ ] Produce one signed candidate and record its immutable SHA-256.
- [ ] Install candidate on clean Windows 11 with SAC On and current Defender intelligence.
- [ ] Launch Ritemark and exercise representative agent/native module paths.
- [ ] Verify update-sensitive behavior required by the v1.10.0 release path.
- [ ] Uninstall and verify the generated uninstaller signature and behavior.
- [ ] Export/review Code Integrity Operational logs; resolve every Ritemark-attributable 3076/3077 finding.
- [ ] Rerun the full matrix after any binary rebuild; never reuse old evidence for a new hash.

## Phase 3 — Microsoft Store Readiness and Submission

- [ ] Confirm the installer is standalone/offline and passes silent install/uninstall tests.
- [ ] Confirm every PE meets Store signature requirements.
- [ ] Publish the exact candidate to the approved immutable versioned HTTPS URL and record URL/hash/size.
- [ ] Reserve/confirm the Ritemark app name and publisher in Partner Center.
- [ ] Complete listing, privacy, support, architecture, capability, and system-requirement metadata.
- [ ] Submit the EXE/MSI package for certification and record result.
- [ ] Resolve certification findings without mutating a previously submitted URL object; create a new immutable candidate URL for changed bytes.
- [ ] Install from Microsoft Store on a clean Windows machine and verify no SmartScreen download warning plus correct version/hash behavior.

## Phase 4 — Channel UX and Documentation

- [ ] Replace the primary Windows download CTA with Microsoft Store after certification; retain direct download as secondary.
- [x] Remove all consumer instructions to disable Smart App Control or Defender.
- [x] Update `docs/user/windows-smart-app-control.md` with Store, direct signature/hash, managed-policy, and Defender false-positive paths.
- [x] Update Windows installer/release operator instructions so Inno nested signing and fail-closed verification cannot be skipped.
- [ ] Update v1.10.0 release notes and `TEST-CHECKLIST.md` with exact Store/direct hashes and SAC evidence.
- [x] Record why MSIX, EV, Windows ARM64, and new updater work remain out of scope.

## Phase 5 — Closeout and Release Gates

- [x] Run focused Windows workflow/signature tests.
- [x] Run `./scripts/validate-qa.sh` on the sprint branch.
- [ ] Complete QA review and resolve findings.
- [ ] Update Sprint 114 issue/tracker, architecture assessment, changelog, and release notes.
- [ ] Merge the dedicated sprint PR before v1.10.0 release-candidate packaging.
- [ ] At release time, verify Store and direct assets match the exact Windows Gate 2-approved hash.
- [ ] Jarmo installs/tests the exact Windows candidate and explicitly clears Gate 2.
