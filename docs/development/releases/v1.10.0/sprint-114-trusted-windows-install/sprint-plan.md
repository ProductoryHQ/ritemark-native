# Sprint 114 — Trusted Windows Install

**Track:** Full SDD, audit-first, shell-tier<br>
**Status:** Active — repo-owned code and local QA complete; protected signed-canary, Windows SAC, Partner Center, and hosting evidence remain open<br>
**Branch:** `codex/sprint-114-trusted-windows-install`<br>
**Worktree:** `.worktrees/sprint-114-trusted-windows-install`<br>
**Base:** `origin/main@fb0d3a37d7c03f01041dcc182b7d1a49e0169fbe`<br>
**Implementation lineage:** Sprint 114's implementation commit is rebased directly on the base above; the branch's current Git history is canonical and supersedes pre-rebase local commit identifiers.<br>
**Issue:** [#212](https://github.com/ProductoryHQ/ritemark-native/issues/212)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Give a new Windows user a trusted, ordinary installation path: Microsoft Store is the primary channel, the direct installer has a complete verifiable Authenticode trust chain, and neither path asks the user to weaken Windows security.

## Why This Is a Separate Sprint

The current Windows release path mixes four distinct trust boundaries: payload signing, Inno Setup internal-component signing, Smart App Control/SmartScreen behavior, and Microsoft Store certification. The repository currently signs payload `.exe` files and the outer installer, but the release workflow does not activate the Inno `SignTool` path that its own installer script says is required for the extracted setup loader and uninstaller. Signature validation is also optional and skipped by default. Correcting this safely requires its own audit, Windows-native build changes, clean-machine evidence, external Store submission, branch, QA gate, and rollback plan.

## In Scope

- Reproduce and classify the current v1.9.0 failure on a clean Windows 11 machine: Edge/SmartScreen download reputation, Smart App Control execution block, Defender/PUA detection, or an unsigned nested installer component.
- Inventory every Portable Executable in the installed/runtime path by file contents rather than extension alone, including `.exe`, `.dll`, and native `.node` modules.
- Sign every Ritemark-owned or otherwise unsigned PE with the existing Productory Services OÜ Azure Artifact Signing Public Trust identity, SHA-256 digest, and RFC 3161 timestamp.
- Invoke Inno Setup with its registered Azure signing tool during compilation so the setup loader and generated uninstaller are signed before the outer installer is finalized.
- Make release signing fail closed: a release-capable Windows job cannot upload a canonical installer when credentials, signing, timestamping, publisher identity, chain validation, or required PE signatures are missing.
- Keep unsigned local/canary artifacts possible only when they are explicitly marked non-release and cannot reach the public release path.
- Add Windows-native verification for the packaged installer, installed payload, uninstaller, clean install, launch, update-sensitive paths, and uninstall with Smart App Control enabled.
- Prepare and exercise the existing offline EXE through the Microsoft Store MSI/EXE submission path, using silent install behavior and an immutable versioned HTTPS URL. Final certification repeats on the exact post-tag v1.10.0 candidate as a release gate.
- Make Microsoft Store the primary Windows download CTA after certification; retain the signed direct installer as a clearly secondary fallback.
- Replace security-bypass guidance with accurate Store/direct-download, publisher-verification, enterprise deployment, and Defender false-positive guidance.
- Update v1.10.0 release notes, test checklist, release plan, and Windows release runbook with the new hard gates.

## Explicitly Out of Scope

- Repackaging Ritemark as MSIX unless the Microsoft Store rejects the existing EXE path and Jarmo approves a scope change.
- Purchasing an EV certificate; EV no longer provides automatic SmartScreen reputation.
- Turning off Smart App Control, weakening Defender, or teaching users to bypass organization policy.
- Windows ARM64, Store commerce, paid licensing, or enterprise Intune package production.
- A new application updater; Store EXE/MSI installs continue to use Ritemark's existing update path.
- Unrelated Windows UI, OneDrive, shell integration, or VS Code OSS changes.

## Deliverables

1. Approved current-artifact and Windows trust-chain audit.
2. Complete build-time signing path for payload PEs, Inno setup loader, outer installer, and uninstaller.
3. Fail-closed release signing and post-package verification scripts/checks.
4. Clean Windows 11 Smart App Control install/launch/uninstall evidence with Code Integrity logs.
5. Microsoft Store EXE/MSI submission package, immutable hosting contract, listing, first-candidate certification findings, and a final exact-v1.10.0 Store-install release gate.
6. Updated download-channel, support, release, and operator documentation.

## Success Criteria

- [ ] The exact shipping installer, its setup loader, installed Ritemark payload, bundled agent executables/native modules, and uninstaller have valid trusted signatures or a documented valid third-party signature.
- [ ] A release workflow with signing disabled, incomplete, expired, mistimestamped, or invalid exits non-zero before uploading a canonical Windows artifact.
- [ ] No file is mutated after its final signature is applied.
- [ ] A clean Windows 11 machine with Smart App Control **On** installs, launches, exercises representative native code paths, updates as applicable, and uninstalls Ritemark without Code Integrity block events attributable to Ritemark.
- [ ] Partner Center product/listing and the EXE submission contract are ready, and preprocessing/certification findings from the first fully signed candidate are resolved before sprint close.
- [ ] At v1.10.0 release time, the exact post-tag candidate passes final Store certification; installing it from Microsoft Store produces no SmartScreen download warning and launches the verified v1.10.0 build.
- [ ] The website/release CTA points Windows users to Microsoft Store first; the direct installer remains available with publisher and SHA-256 verification information.
- [x] User documentation never asks a consumer to disable Smart App Control or Defender.
- [ ] `./scripts/validate-qa.sh`, Windows signing verification, Store-install verification, Gate 1, and Jarmo's Windows Gate 2 test pass before v1.10.0 publication.

## Dependencies and Gates

- Jarmo approves this plan and its priority before any implementation work.
- A dedicated non-`main` branch is required before code or workflow edits.
- Phase 0 ends with an explicit Jarmo decision on Store account readiness, immutable hosting, PE-signing scope, and the exact Inno/Azure signing integration.
- Azure Artifact Signing Public Trust credentials and the Productory Services OÜ identity must remain available in Windows CI.
- Partner Center enrollment, app-name reservation, legal/privacy details, and final publish action require Jarmo's account access and approval.
- Sprint 114 has no product dependency on Sprints 109–113. It is proposed first because Store certification and clean-machine validation have external lead time.
- Sprint completion is shell-tier and cannot use the extension-only release lane. Full-app Gate 1 and Gate 2 remain mandatory.
- The Sprint 114 PR may merge after its signed-candidate/SAC matrix and Store-readiness criteria pass. Final v1.10.0 certification is deliberately retained as a release gate because it must use all subsequently merged release scope.
- Architecture Gate is conditional: installer/CI/Store-channel work alone does not change extension module structure, but any binary-manifest, update-feed contract, feature-flag, or webview-message change requires the corresponding `docs/development/architecture.md` update before sprint close. Record the assessment either way.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Outer installer is signed while an extracted or native component remains unsigned | High | Content-based PE inventory, Inno build-time signing, installed-tree verification, SAC-on run and Code Integrity logs. |
| CI silently publishes unsigned output when a repository variable changes | High | Remove optional release behavior; explicit release/dev modes; fail before upload; verify publisher/chain/timestamp. |
| Re-signing third-party binaries breaks vendor signatures or runtime behavior | High | Audit first; preserve valid trusted vendor signatures; sign only unsigned/owned PEs; rerun launch/native-path matrix. |
| Store certification rejects the installer | High | Validate offline/silent/immutable/all-PE requirements before submission; capture rejection evidence; scope-change gate before MSIX. |
| Direct download still receives a reputation warning | Medium | Store is primary deterministic path; consistent publisher identity and immutable signed binaries build direct-channel reputation over time. |
| Store and direct channels drift to different builds | High | One canonical build hash, channel manifest, versioned URL, and release checklist cross-check. |
| Documentation turns a product defect into a security-bypass burden | High | Remove disable-SAC steps; test support copy against real Windows messages. |

## SDD Artifacts

- [spec.md](./spec.md) — Windows trust and distribution requirements.
- [scenarios.md](./scenarios.md) — build, signature, SAC, Store, and support QA matrix.
- [technical-plan.md](./technical-plan.md) — signing, verification, Store, and rollout design.
- [tasks.md](./tasks.md) — phased implementation and release checklist.
- [research/windows-trust-baseline.md](./research/windows-trust-baseline.md) — current findings and Phase 0 evidence template.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-23 | Add trusted Windows installation as Sprint 114 under v1.10.0 | The current path blocks or alarms new users and is a release-level acquisition defect. |
| 2026-08-23 | Microsoft Store becomes the primary Windows channel | It is the only deterministic consumer path that avoids SmartScreen download warnings. |
| 2026-08-23 | Keep Azure Artifact Signing; do not buy EV for reputation | Existing Public Trust is appropriate; EV no longer bypasses SmartScreen reputation. |
| 2026-08-23 | Direct EXE remains a secondary, fully signed fallback | Preserves user choice and enterprise/manual deployment without making reputation-based UX the default. |
| 2026-08-23 | Full SDD and audit-first delivery | Prior release documentation claimed nested signing that the current workflow does not demonstrably perform; evidence must precede another claim. |
| 2026-08-24 | Keep manual exact-tag Windows workflow with explicit signed/unsigned canary modes | Paid Windows CI stays deliberate; release mode fails closed and only accepts the matching version tag. |
| 2026-08-24 | Use existing Azure Artifact Signing identity and SignTool+dlib for Inno | The required signer is exactly Productory Services OÜ; the integration remains provisional until Windows-runner proof. |
| 2026-08-24 | Host Store input under `downloads.ritemark.app/windows/v1.10.0/` | Partner Center receives a publisher-controlled immutable versioned HTTPS object; GitHub Release remains secondary recovery/direct download. |
| 2026-08-24 | Jarmo owns Partner Center setup; Kristiina owns clean Win11 SAC-On evidence | Account and human-machine gates cannot be completed inside the repository and remain explicit release blockers. |

## Planning Approval

- [x] Jarmo approves Sprint 114 scope and first-priority placement.
- [x] Jarmo approves branch creation.
- [x] Phase 0 trust-chain/Store/hosting decision approved.
- [x] GitHub issue [#212](https://github.com/ProductoryHQ/ritemark-native/issues/212) created and assigned to milestone v1.10.0.

## Architecture Assessment

Sprint 114 changes the Windows build, signing, installer, and distribution contract. It does not change extension module structure, webview message contracts, feature flags, or the binary runtime manifest. The Sprint Architecture Gate therefore does not require a `docs/development/architecture.md` update for the current diff; reassess if the file surface expands.
