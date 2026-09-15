# Microsoft Store status

Last updated: **2026-09-15**

## High-level status

**Submitted. Awaiting Microsoft’s certification decision.** The v1.10.1 candidate 3 submission was completed in Partner Center on 2026-09-12 at ~12:08 UTC with Jarmo’s explicit approval, and shows **In review** with a stated Microsoft SLA of three business days. Package ID `23647104` (x64), installer `https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe`, SHA-256 `93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250`, re-verified by a fresh HTTPS download immediately before Submit.

Submission completion is **not** certification approval and **not** Store publication. Clean Windows 11 / Smart App Control On testing on a machine other than the developer’s is still outstanding, and the submission must not be represented as having covered it. The full record is in [`SUBMISSION-2026-09-12.md`](./SUBMISSION-2026-09-12.md); **Partner Center remains the live source of certification status** — this file is a snapshot.

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
- [x] English (United Kingdom) listing created and saved — **Complete**, with four installed-Windows screenshots (2026-09-12).

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

## Store media

- [x] Seven 2880×1800 reference screenshots collected.
- [x] Reference screenshots copied into this hub.
- [x] Four 1920×1080 screenshots captured from installed v1.10.1 candidate 3; see ASSETS.md.
- [ ] Final screenshots contain no development-host title, test-only UI, private project names, secrets, or misleading platform chrome — the four screenshots went into the submitted listing, but no separate hygiene review is recorded, so this item stays open rather than being marked done retroactively.
- [x] Four final screenshots selected, ordered, approved by Jarmo and submitted.
- [x] Captions reviewed in the English listing — saved as part of the **Complete** listing.
- [x] Square logo and 2:3 poster art uploaded by Jarmo, accepted and saved. The repository’s 1024px logo source was **rejected** by Partner Center and is not the final uploaded asset.

## Store certification (separate from completed direct-release gates)

- [x] Certification notes finalized — they disclose offline local editing, optional provider credentials, and the silent installation parameters.
- [x] Partner Center package validation status **Completed** — malware scan clean, code signing valid. Silent install, Apps & Features identity and bundleware checks came back **automatic identification inconclusive** with a link to manual verification; they were not reported as passed automated checks. Manual evidence for the same hash is in [`release-candidates/v1.10.1-candidate-3.md`](./release-candidates/v1.10.1-candidate-3.md).
- [ ] Clean Windows 11 / Smart App Control On test passes.
- [x] Developer-machine install, launch, edit/save, and uninstall evidence refers to the exact hosted v1.10.1 SHA-256. Clean-machine evidence remains pending.
- [x] Final Partner Center review completed without placeholders (2026-09-12).
- [x] Jarmo explicitly approved **Submit to the Store** for v1.10.1 candidate 3 (2026-09-12).
- [ ] Microsoft certification passes — **In review** since 2026-09-12; no decision recorded here yet.
- [ ] Store-origin install passes.
- [ ] Gate 2 records the Store and direct-download evidence.

## Immediate next actions

1. Await Microsoft’s certification decision and read any actionable report it returns.
2. Kristiina: record clean Windows 11 / Smart App Control On evidence against the hosted v1.10.1 SHA-256. This is the one pre-submission item the submission did not cover.
3. **Never replace the bytes at the submitted installer URL.** A changed binary needs a new immutable URL and a new candidate — the R2 `windows-immutable` control and the uploader’s `If-None-Match: *` both refuse an overwrite, and working around either would invalidate the submitted hash.
4. After publication: verify Store-origin install, launch, edit/save and uninstall, then record it in Gate 2.
