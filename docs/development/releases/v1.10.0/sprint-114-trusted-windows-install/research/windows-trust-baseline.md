# Windows Trust Baseline — Sprint 114 Phase 0

**Status:** Repository audit and Phase 0 decisions complete; Windows artifact evidence still required<br>
**Date:** 2026-08-24

## Repository Findings

1. `.github/workflows/build-windows.yml` signs build-tree files only when `AZURE_SIGNING_ENABLED == 'true'` and filters by the `.exe` extension.
2. The workflow invokes ISCC without `/DSign` or `/Sazuresign`, so the conditional `SignTool=azuresign $f` and `SignedUninstaller=yes` block in `installer/windows/ritemark.iss` is not active.
3. The completed outer installer is signed afterward with `azure/trusted-signing-action`. That does not by itself prove the Inno extracted setup component or generated uninstaller is signed.
4. `scripts/validate-build-output.sh` skips Windows signature verification by default through `RITEMARK_SKIP_SIGNING_CHECK=1`.
5. Existing release/user documentation says the whole install chain is signed and tells blocked consumers to disable Smart App Control. Those claims must be revalidated against the exact shipping asset; the bypass instruction must be removed.
6. The v1.9.0 release checklist records the canonical Windows asset as Authenticode-signed, but it does not contain nested-component or all-PE evidence.

## Current Microsoft Platform Facts

- SmartScreen uses both publisher and file-hash reputation. A valid new OV/EV/Artifact Signing binary can still receive an “unrecognized” prompt while reputation accumulates.
- EV certificates no longer bypass SmartScreen reputation.
- Microsoft Store-distributed apps are the deterministic consumer path without SmartScreen download warnings.
- Store EXE/MSI submissions require the installer and all PE files to be signed by a chain trusted through the Microsoft Trusted Root Program.
- Store EXE/MSI requires a versioned immutable HTTPS URL, standalone/offline installer, and silent install behavior.
- Smart App Control evaluates executable content across install, launch, features, integrations, and uninstall. Code Integrity events 3076/3077 identify blocked/audited files.
- Consumer SmartScreen reputation has no manual allow-list submission path. Actual Defender malware/PUA false positives have a separate developer submission path.

## Phase 0 Evidence To Collect

| Item | Current evidence | Required result |
|---|---|---|
| Canonical installer hash | v1.9.0 checklist records `9b248918…`; live fetch not yet revalidated | Exact live URL/size/SHA-256 match recorded. |
| Outer installer signature | Release checklist says signed | Signer, chain, digest, timestamp verified on Windows. |
| Inno setup loader | Workflow gap indicates unproven/likely unsigned | Exact extracted component verified and evidence attached. |
| Generated uninstaller | Inno signed-uninstaller block is inactive | Installed uninstaller verified and evidence attached. |
| Payload PE coverage | CI filter is `.exe` only | Content-based inventory covers `.exe`, `.dll`, `.node`, and other PE suffixes. |
| SAC behavior | User reports severe block/warning | Reproduced/classified on clean Win11 SAC On with event logs. |
| Store account/name | Unknown | Partner Center readiness and owner recorded. |
| Immutable hosting | Unknown | Approved host/path and write-once policy recorded. |
| Silent install/uninstall | Inno supports silent modes; Store contract untested | Exact switches pass unattended install/uninstall test. |

## Approved Decisions (2026-08-24)

1. Keep the existing Azure Artifact Signing account/profile and exact publisher `Productory Services OÜ`.
2. Preserve valid trusted vendor signatures; sign Ritemark-owned or unsigned PEs. Because resource branding mutates `Ritemark.exe`, it is explicitly re-signed after the mutation.
3. Inno uses its built-in `SignTool` hook through a PowerShell SignTool+dlib adapter; Windows runner proof remains required.
4. Partner Center has not been set up. Jarmo owns enrollment, name reservation, listing approval, and submission/publish actions.
5. The Store package uses `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`; the object is immutable and GitHub Release is secondary.
6. Kristiina's clean Windows 11 machine supplies SAC-On direct and Store validation.

## Remaining Evidence Questions

1. Does the SignTool+dlib command run successfully for every Inno setup/uninstaller target on the hosted runner?
2. Which representative runtime/native paths load every relevant PE during the clean-machine test?
3. Does the exact current user failure occur at Edge download, SmartScreen launch, Inno temp loader, Defender quarantine, or more than one layer?
4. Is the `Ritemark` Partner Center name available, and when does the reservation expire?

## Phase 0 Decision Gate

Implementation was approved after the repository findings and external ownership decisions were frozen. These external release gates remain open:

- signed-canary runner proof of the selected integration;
- exact root-cause classification on Windows;
- Partner Center enrollment/name/listing/submission;
- immutable-host publication of the exact release candidate;
- Kristiina's clean Windows validation matrix and Jarmo's exact-hash Gate 2 approval.

## Sources

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements
- https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control
- https://learn.microsoft.com/en-us/azure/artifact-signing/concept-trust-models
