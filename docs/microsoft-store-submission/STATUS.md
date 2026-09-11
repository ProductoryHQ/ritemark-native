# Microsoft Store status

Last updated: **2026-09-11**

## High-level status

**Preparation is active. Store submission is still blocked on non-hosting evidence and Partner Center work.** The current candidate is v1.10.1 candidate 3, published to the immutable R2 URL on 2026-09-10. The anonymous download matched the approved size and SHA-256. Windows developer-machine signature, Defender, install/use/uninstall and SAC checks pass; clean-machine testing (Kristiina), screenshot approval, Partner Center completion and explicit Store submission approval remain open.

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

- [x] `getritemark.com` public A and AAAA resolution passes.
- [x] HTTPS certificate validation and TLS 1.2 minimum configuration pass.
- [x] Anonymous direct-download probe passes with no redirect, login, cookie, or HTML interstitial.
- [x] Release Gate 1 authorized the Windows build.
- [x] Signed x64 standalone EXE built from approved product commit `23493cef1f4d38cd997be5509e057cb75560fb5c`.
- [x] Installer and installed PE signature audit passes.
- [x] Standard-user silent install and uninstall pass.
- [x] Defender scan passes — no threats on 2026-09-10 (developer machine).
- [x] Repository upload tool validates the exact local size/hash, requires the versioned key confirmation, and uses conditional `If-None-Match: *` upload.
- [x] Real v1.10.0 plan check passes: approved local identity and unused public destination (`404`).
- [x] One-year R2 Object Read & Write account token exists for `ritemark-downloads-prod` only and is stored outside the repository.
- [x] Guarded R2 upload command refuses the existing public object before attempting an upload.
- [x] Production immutability control `windows-immutable` for `windows/` is configured, indefinite, enabled, and verified in Cloudflare Dashboard.
- [x] Versioned installer URL contains the exact tested bytes.
- [x] Fresh URL download matches the recorded SHA-256 and byte length.

## Store media

- [x] Seven 2880×1800 reference screenshots collected.
- [x] Reference screenshots copied into this hub.
- [x] Four 1920×1080 screenshots captured from installed v1.10.1 candidate 3; see ASSETS.md.
- [ ] Final screenshots contain no development-host title, test-only UI, private project names, secrets, or misleading platform chrome.
- [x] Four final screenshots selected and ordered; Jarmo approval and Partner Center preview remain pending.
- [ ] Captions reviewed in the English listing.
- [ ] 1:1 logo preview approved in Partner Center.

## Store certification (separate from completed direct-release gates)

- [ ] Certification notes finalized.
- [ ] Partner Center package validation passes.
- [ ] Clean Windows 11 / Smart App Control On test passes.
- [x] Developer-machine install, launch, edit/save, and uninstall evidence refers to the exact hosted v1.10.1 SHA-256. Clean-machine evidence remains pending.
- [ ] Final Partner Center review completed without placeholders.
- [ ] Jarmo explicitly approves **Submit to the Store** for the exact candidate.
- [ ] Microsoft certification passes.
- [ ] Store-origin install passes.
- [ ] Gate 2 records the Store and direct-download evidence.

## Immediate next actions

1. Kristiina: record clean Windows 11 / Smart App Control On evidence against the hosted v1.10.1 SHA-256.
2. Jarmo: approve the four installed-Windows screenshots and the exact Store candidate.
3. Finish the English listing, IARC attestation, certification notes, and package validation in Partner Center.
4. Do not select **Submit to the Store** until Jarmo explicitly approves the complete draft and exact hosted candidate.
