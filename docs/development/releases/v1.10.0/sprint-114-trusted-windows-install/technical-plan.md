# Sprint 114 Technical Plan — Trusted Windows Install

## Critical Path

```text
current-asset audit
→ complete PE + Inno internal signing
→ fail-closed verification
→ clean Windows 11 SAC-on install/uninstall
→ immutable Store package URL
→ Partner Center certification
→ Store-first Windows CTA
```

Store account/listing preparation can run in parallel with engineering after Phase 0, but certification cannot start before the exact signed candidate and immutable URL exist.

## W0 — Current Trust Baseline

1. Download the exact current canonical installer and record SHA-256.
2. Verify the outer Authenticode signature, signer subject, chain, timestamp, and digest.
3. On a disposable clean Windows 11 VM, capture Edge/SmartScreen/SAC/Defender behavior and Code Integrity event IDs 3076/3077.
4. Inspect the setup loader during installation, install to a disposable location, and verify the generated uninstaller and installed PE inventory.
5. Compare observed evidence with the current release documentation and record every incorrect or unproven claim.
6. Freeze Phase 0 decisions: Azure/Inno invocation, PE ownership/signing rules, Store account state, versioned hosting, silent switches, and rollout order.

## W1 — Complete Build-Time Signing

### Payload inventory

Add a Windows-native inventory/verification script that identifies PE files by their headers, not filename extension. For each PE, record:

- path and SHA-256;
- signature status and signer subject;
- chain/trust result;
- digest and RFC 3161 timestamp status;
- owned/third-party classification.

Preserve already-valid trusted vendor signatures. Sign Ritemark-owned or unsigned PEs before packaging. Resource/icon changes remain earlier than the signing step.

### Inno integration

The release compiler invocation must activate the existing conditional block in `installer/windows/ritemark.iss`:

- pass `/DSign`;
- register `/Sazuresign=<supported Azure Artifact Signing command> $f`;
- keep `SignTool=azuresign` and `SignedUninstaller=yes` active; Inno supplies the target through the `$f` placeholder embedded in the registered `/Sazuresign` command;
- fail if the signing command, timestamp, or verification fails.

Phase 0 approved a PowerShell adapter around SignTool plus the Azure Artifact Signing dlib. The command must still prove that it works repeatedly when invoked by Inno on the GitHub Windows runner and must not rely on a later outer-installer signing action to cover embedded components.

### Finalization order

1. Build and patch resources/icons.
2. Inventory and sign payload PEs.
3. Verify payload signatures.
4. Compile Inno with its signing tool active.
5. Apply/verify the final outer signature if Inno does not finalize it itself.
6. Perform no binary mutation afterward.
7. Install into a disposable target and verify installed payload plus uninstaller.

## W2 — Fail-Closed Verification and SAC Test

### Workflow contract

Replace optional release signing with an explicit mode. A release/tag/manual release dispatch requires signing and hard verification. Canary/local jobs can be unsigned only through an explicit non-release input and isolated artifact name/path.

The canonical Windows installer upload depends on all signing and verification steps. `AZURE_SIGNING_ENABLED != true` cannot be a successful release configuration.

### Verification scope

Update or replace the opt-in section of `scripts/validate-build-output.sh` so release checks are on by default and failures are fatal. Add a packaged-installer verification step that validates:

- all discovered PEs in the build tree;
- Inno setup loader/engine evidence;
- final installer;
- installed-tree PEs;
- generated uninstaller;
- signer identity, chain, digest, and timestamp;
- exact release version and SHA-256.

### Clean-machine matrix

Use a clean Windows 11 SAC-on VM or dedicated machine. Capture:

- OS build, Defender intelligence version, SAC mode;
- installer hash and source channel;
- install, first launch, representative native/agent load, and uninstall;
- Code Integrity Operational log export;
- screenshots only where they add evidence beyond logs/commands.

Any Ritemark-attributable block is a sprint and release blocker.

## W3 — Microsoft Store EXE/MSI Channel

### Package readiness

Use the existing EXE submission path first. Confirm and document:

- standalone/offline setup;
- Store-compatible silent install/uninstall switches;
- x64 architecture and Windows minimum version;
- all-PE signature compliance;
- no unrelated bundled offers;
- privacy policy, support URL, capabilities, and system requirements.

### Immutable hosting

Use the approved publisher-controlled versioned URL:

`https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`

The object is write-once for the submitted version. The existing mutable `releases/latest/download/...` pattern is not used as the Partner Center package contract. Record URL, ETag/length where available, and SHA-256 in the channel manifest. GitHub Release remains a same-hash secondary direct-download/recovery channel.

### Partner Center

Jarmo-owned tasks: enrollment/legal status, app-name reservation, publisher/profile access, listing approval, and final publish action.

Engineering-owned tasks: certified binary, silent switches, package URL, architecture/requirements, certification notes, failure diagnosis, resubmission, and evidence.

Store certification and one clean Store-origin install must complete before the Windows CTA switches.

## W4 — Channel UX, Documentation, and Release Gates

- Make Microsoft Store the primary Windows CTA after certification; direct EXE becomes secondary.
- Rewrite `docs/user/windows-smart-app-control.md`: remove disable-SAC instructions; distinguish reputation, signature enforcement, Defender detection, and managed policy.
- Update `docs/development/RELEASING.md`, the Windows installer skill/runbook, v1.10.0 release notes, and `TEST-CHECKLIST.md` with exact build/sign/Store steps.
- Add a release checklist invariant: Store and direct channel manifests refer to the exact approved hash; any rebuild resets Windows Gate 2.
- Do not claim warning-free direct download. Claim warning-free Store installation only after measured evidence.

## Expected File Surface

| Path | Expected change |
|---|---|
| `.github/workflows/build-windows.yml` | Explicit release/non-release mode, complete signing, fail-closed verification, gated upload. |
| `installer/windows/ritemark.iss` | Confirm/adjust Inno sign-tool contract and silent Store behavior. |
| `scripts/codesign-windows.sh` | Content-based PE signing/inventory or shared signing primitive. |
| `scripts/validate-build-output.sh` | Mandatory Windows release verification instead of default skip. |
| `scripts/verify-windows-signatures.ps1` | New Windows-native signature/PE report and hard-fail check, if audit confirms this split. |
| `docs/user/windows-smart-app-control.md` | Safe, channel-aware support guidance. |
| `docs/development/RELEASING.md` | Store and Windows release operator flow. |
| `docs/releases/v1.10.0/*` | Release notes and exact-hash test evidence. |
| Website/download repository | External handoff for Store-first CTA; do not edit from this repo without separate scope/access. |

## Rollback

- If signing changes break Windows build/runtime behavior, revert the Sprint 114 branch/PR; do not fall back to publishing unsigned output.
- If Store certification fails for a correctable EXE requirement, fix and resubmit on the same sprint with a new immutable candidate URL when bytes change.
- If EXE certification is structurally infeasible, stop at a dated scope-change decision. MSIX work does not enter this sprint implicitly.
- The existing direct installer remains available only if it passes the full signing and SAC matrix. Store failure is not permission to restore security-bypass guidance.

## External References

- Microsoft SmartScreen reputation: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft Store MSI/EXE requirements: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements
- Microsoft Smart App Control signature testing: https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control
- Azure Artifact Signing Public Trust: https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models
