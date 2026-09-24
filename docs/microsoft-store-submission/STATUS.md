# Microsoft Store status

Last updated: **2026-09-23**

## High-level status

**Ritemark v1.11.0 is certified and live in Microsoft Store.** The public product ID is `XP9K8SP24TRNK4` and the canonical web listing is `https://apps.microsoft.com/detail/xp9k8sp24trnk4`. The public page was observed on 2026-09-23 with the Ritemark title, `Productory Services OÜ` publisher, Productivity category, and approved listing copy. Jarmo confirmed Store-origin installation, launch, and uninstall on 2026-09-23. See [`PUBLICATION-2026-09-23.md`](./PUBLICATION-2026-09-23.md).

The immutable v1.11.0 installer is hosted at `https://getritemark.com/windows/v1.11.0/Ritemark-Setup.exe`: 444207592 bytes, SHA-256 `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b`. A fresh anonymous HTTPS stream on 2026-09-23 returned HTTP 200, the same length/hash/ETag, executable content type, and `immutable` cache policy. No installer or probe file was left behind. **Partner Center and the public Store page remain the live sources of publication status** — this file is a snapshot.

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
- [x] Public Store product ID recorded: `XP9K8SP24TRNK4`.
- [x] Canonical public listing recorded: `https://apps.microsoft.com/detail/xp9k8sp24trnk4`.
- [x] New account verification state propagated to the Store listing surface; the stale verification warning disappeared on 2026-09-02.
- [x] English (United Kingdom) listing created and saved — **Complete**, with four installed-Windows screenshots (2026-09-12).

## Stable submission content

- [x] Publisher identity recorded.
- [x] English short and full descriptions drafted.
- [x] Feature list and seven search terms drafted.
- [x] Product and support URLs verified.
- [x] Approved Productory privacy and terms URLs verified.
- [x] Required 1:1 Store-logo source collected.
- [x] Category confirmed in the live Partner Center taxonomy: **Productivity**.
- [x] Pricing changed and saved in Partner Center as **Freemium: optional in-app purchases**, matching Microsoft's finding about optional third-party AI costs. Ritemark itself does not sell a subscription.
- [x] Market availability confirmed and observed: all 240 regions; future regions are not added automatically.
- [x] Normal Microsoft Store discoverability confirmed.
- [x] Age-rating questionnaire answers completed and rating preview generated in Partner Center.
- [x] IARC Terms of Use/adult-status attestation approved by Jarmo and ratings saved — Age ratings **Complete**, Microsoft rating 12+ (other rating systems differ).
- [x] Public support email confirmed and saved by Jarmo: `info@productory.eu` — not the onboarding contact.

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
- [x] v1.11.0 is published at a new immutable key; v1.10.1 remains unchanged.

## Store media

- [x] Seven 2880×1800 reference screenshots collected.
- [x] Reference screenshots copied into this hub.
- [x] Four 1920×1080 screenshots captured from installed v1.10.1 candidate 3; see ASSETS.md.
- [ ] Final screenshots contain no development-host title, test-only UI, private project names, secrets, or misleading platform chrome — the four screenshots went into the submitted listing, but no separate hygiene review is recorded, so this item stays open rather than being marked done retroactively.
- [x] Four final screenshots selected, ordered, approved by Jarmo and submitted.
- [x] Captions reviewed in the English listing — saved as part of the **Complete** listing.
- [x] Square logo and corrected 2:3 Windows poster art uploaded and saved by Jarmo. The replacement source is [`assets/store-screenshots/1.10.1/posterart_windows.png`](./assets/store-screenshots/1.10.1/posterart_windows.png); it contains Windows UI rather than the previously submitted Mac screenshot.

## Store certification (separate from completed direct-release gates)

- [x] Certification notes updated and saved with the four-finding remediation summary, reviewer steps, and v1.11.0 package identity.
- [x] v1.11.0 Partner Center package validation status **Completed** — malware scan clean and code signing valid. Silent install, Apps & Features identity and bundleware checks came back **automatic identification inconclusive**; they were not reported as passed automated checks. Manual install/uninstall evidence for the exact v1.11.0 candidate is recorded in [`release-candidates/v1.11.0-candidate-1.md`](./release-candidates/v1.11.0-candidate-1.md).
- [x] Jarmo's install/use confirmation and candidate install/uninstall evidence refer to the exact hosted v1.11.0 SHA-256. Clean-machine evidence remains pending.
- [x] Final Partner Center review completed without placeholders (2026-09-12).
- [x] Jarmo explicitly approved the original v1.10.1 **Submit to the Store** action (2026-09-12).
- [x] Microsoft returned the v1.10.1 certification report on 2026-09-15 — **Attention needed**, four findings recorded in Sprint 126.
- [x] Jarmo explicitly approved **Submit anyway** for the v1.11.0 resubmission on 2026-09-20 after the completed validation report and pricing warning were reviewed.
- [x] Partner Center accepted the resubmission and displayed **In review**, submission complete, and review **in process** on 2026-09-20; see [`SUBMISSION-2026-09-20.md`](./SUBMISSION-2026-09-20.md).
- [x] Microsoft certified and published the v1.11.0 resubmission; the public Store page was observed on 2026-09-23.
- [x] Jarmo confirmed Store-origin install, launch, and uninstall on 2026-09-23.
- [x] Gate 2 records the Store-origin and fresh direct-download evidence in [`PUBLICATION-2026-09-23.md`](./PUBLICATION-2026-09-23.md) and the v1.11.0 release checklist.
- [ ] Clean Windows 11 / Smart App Control On test passes; Store publication does not retroactively prove this separate internal hardening check.

## Immediate next actions

1. Record a clean Windows 11 / Smart App Control On result if that separate hardening test is run; do not infer it from certification.
2. Record Store-origin edit/save separately if it is tested; the 2026-09-23 owner confirmation explicitly covers install, launch, and uninstall.
3. **Never replace either v1.10.1 or v1.11.0 bytes.** Any changed binary needs a new immutable URL and candidate record.
