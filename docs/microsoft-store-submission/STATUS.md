# Microsoft Store status

Last updated: **2026-09-02**

## High-level status

**Preparation is active. Publication is blocked.** Productory's verified company account is active, `Ritemark` is reserved, and its EXE/MSI submission is in draft. The verified state now appears across the relevant Partner Center surfaces. Installer hosting is not configured, no final signed Windows candidate is approved, and the current screenshots are release references rather than Store-ready Windows captures.

## Account and Partner Center

- [x] Company account selected.
- [x] Business details entered.
- [x] Contact details entered.
- [x] Email verification passed.
- [x] Employment verification passed.
- [x] Official English company registry extract uploaded.
- [x] Business verification passed — **Verified** on 2026-09-01.
- [x] **Finish account setup** completed.
- [x] Partner Center **Apps and games** area opened successfully.
- [x] `Ritemark` availability checked — **Name is available**.
- [x] `Ritemark` product name reserved.
- [x] EXE/MSI app draft created.
- [x] Partner Center ID recorded: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.
- [x] New account verification state propagated to the Store listing surface; the stale verification warning disappeared on 2026-09-02.
- [ ] English (United Kingdom) listing created and saved.

## Stable submission content

- [x] Publisher identity recorded.
- [x] English short and full descriptions drafted.
- [x] Feature list and seven search terms drafted.
- [x] Product and support URLs verified.
- [x] Approved Productory privacy and terms URLs verified.
- [x] Required 1:1 Store-logo source collected.
- [x] Category confirmed in the live Partner Center taxonomy: **Productivity**.
- [x] Pricing confirmed and observed in Partner Center: **Free: no payment necessary**.
- [x] Market availability confirmed and observed: all 240 regions; future regions are not added automatically.
- [x] Normal Microsoft Store discoverability confirmed.
- [x] Age-rating questionnaire answers completed and rating preview generated in Partner Center.
- [ ] IARC Terms of Use/adult-status attestation explicitly approved by Jarmo and ratings saved.
- [ ] Public support email confirmed; do not automatically expose the onboarding contact.

## Hosting and package

- [ ] `downloads.ritemark.app` DNS resolves.
- [ ] HTTPS certificate and direct-download behavior pass.
- [ ] Release Gate 1 authorizes the Windows build.
- [ ] Signed x64 standalone EXE built from the approved commit.
- [ ] Installer and installed PE signature audit passes.
- [ ] Standard-user silent install and uninstall pass.
- [ ] Defender scan passes.
- [ ] Versioned installer URL contains the exact tested bytes.
- [ ] Fresh URL download matches the recorded SHA-256.

## Store media

- [x] Seven 2880×1800 reference screenshots collected.
- [x] Reference screenshots copied into this hub.
- [ ] Final screenshots captured from an installed Windows candidate.
- [ ] Final screenshots contain no development-host title, test-only UI, private project names, secrets, or misleading platform chrome.
- [ ] At least four final screenshots selected and ordered.
- [ ] Captions reviewed in the English listing.
- [ ] 1:1 logo preview approved in Partner Center.

## Certification and release Gate 2

- [ ] Certification notes finalized.
- [ ] Partner Center package validation passes.
- [ ] Clean Windows 11 / Smart App Control On test passes.
- [ ] Install, launch, edit/save, and uninstall evidence refers to the exact hosted SHA-256.
- [ ] Final Partner Center review completed without placeholders.
- [ ] Jarmo explicitly approves **Submit to the Store** for the exact candidate.
- [ ] Microsoft certification passes.
- [ ] Store-origin install passes.
- [ ] Gate 2 records the Store and direct-download evidence.

## Immediate next actions

1. Obtain Jarmo's explicit approval for the IARC Terms of Use/adult-status attestation, then save the generated ratings.
2. Add the English Store listing and save its text-only draft after action-time approval of the exact copy.
3. Resolve the support-contact URL field, which has cleared input and remains blank.
4. Configure `downloads.ritemark.app` DNS/HTTPS and the versioned path convention.
5. Do not add a placeholder package URL or submit until the approved Windows candidate exists.
