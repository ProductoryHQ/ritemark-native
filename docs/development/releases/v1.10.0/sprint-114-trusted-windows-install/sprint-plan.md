# Sprint 114 — Trusted Windows Install

**Status:** Active — implementation ready for signed Windows CI, Kristiina SAC-On test, and Store submission<br>
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

## Done when

- [ ] Manual Windows workflow produces one fully signed installer and fails closed when signing is unavailable.
- [ ] Payload, installer, installed tree, and uninstaller signature checks pass.
- [ ] Standard-user install/registration/uninstall checks pass.
- [ ] Kristiina's clean Windows 11 SAC-On test passes for the exact SHA-256.
- [ ] Partner Center accepts the same SHA-256 from `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`.
- [ ] Microsoft Store is the primary Windows link and the direct installer remains the same signed file.
- [ ] `./scripts/validate-qa.sh` passes.

## Decisions

- Existing repository-level Azure signing secrets remain in use.
- GitHub Release continues as the secondary direct-download location; no channel redesign is needed.
- Jarmo handles Partner Center setup and final submission. Kristiina performs the clean-machine SAC-On test.
- No `docs/development/architecture.md` update is required because this sprint changes packaging and documentation only.
