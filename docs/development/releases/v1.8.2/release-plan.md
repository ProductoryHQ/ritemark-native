# Release Plan — v1.8.2 Sturdy & Seamless Delivery (Windows-first)

**Status:** Planning (pre-sprint)
**Target:** v1.8.2
**GitHub milestone:** `v1.8.2` — to be created
**Release type:** Full app release (shell tier — patches + installer + code-signing + build system)
**Release owner:** Jarmo
**Created:** 2026-07-08
**Depends on:** v1.8.1 shipped and its Windows CI green (`8295cee`, VS2026 break resolved)
**Comes before:** v1.9.0 Cloud Sharing (future cross-repo initiative — governance `releases/v1.9.0/`)

## Release Thesis

One vision: **make Ritemark's delivery sturdy and fast — Windows-first.** Today every change ships as a slow, fragile full installer build, and on Windows users can't even install on a default Windows 11 machine. This release fixes both ends of that problem as one coherent story, across several related sprints:

1. Get Windows onto solid ground — the app installs on a default (Smart App Control) Windows 11 and reliably opens business files.
2. De-risk the build that produces it — bundle the extension host so the whole build stops tripping over itself.
3. Flip delivery to a seamless extension lane — most future changes download in the background and apply with one "Relaunch to update", no installer, no notarization, no fragile Windows CI.

The three threads are one vision because they depend on each other: the seamless lane only helps Windows *after* Windows is signed and installable, and the seamless lane is only trustworthy on a build that no longer breaks. After this release, Windows rides the fast lane like macOS, and shell releases become rare, deliberate events.

Grounded in the release-level research at [`docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md`](../../analysis/2026-07-07-seamless-update-delivery-plan.md) (seamless two-tier model §1–6; Windows issue→tier map + code-signing research §5b). Per the process model §7, sprint plans are written only against those settled findings.

## User-Facing Headlines

1. **Ritemark installs on default Windows 11 (no more Smart App Control block)** — installer and all executable parts are code-signed; the "can't confirm who published" / Error 4551 block is gone.
2. **OneDrive / SharePoint files open reliably (or tell you why they don't)** — synced business files no longer fail with a cryptic error; the app gives an actionable message when a cloud file isn't downloaded.
3. **Updates arrive by themselves** — most updates download in the background and apply with one click ("Relaunch to update"), instead of downloading and reinstalling an installer.
4. **Creating a file is one click again** — New File / New Folder buttons return to the File Browser header.

## Scope Envelope

### In scope (grouped by sprint)

- **sprint-91-windows-foundation** — #130 Windows code-signing (installer + uninstaller + `.tmp` loader + app exe + bundled binaries via Azure Trusted Signing; submit to Microsoft for reputation review; clean-Win11-SAC-enabled QA step). #134 OneDrive/SharePoint read-failure error surfacing + real OS error-code logging. #131 File Browser New File/New Folder buttons. CI de-risk: `workflow_dispatch` triggers + weekly free-public-runner Windows canary.
- **sprint-92-esbuild-bundling** — #105 bundle the extension host with esbuild (105 loose `.js` + ~180 packages → one bundle). Closes the EMFILE failure class, the 0-byte tsc trap, and DMG/zip bloat; unblocks #107 (webview size budget) and #108 (build-integrity gate), which stay out of scope here.
- **sprint-93-seamless-delivery** — one-command `release-extension.sh` (with release-tier guard + `engines.vscode` check), background download + sha256 verify + silent staging, status-bar "Relaunch to update", apply-on-next-start, N−1 rollback, `ritemark.updates.mode` setting. Plus the two-tier process/harness changes: CLAUDE.md release-tier rule, `release` skill extension procedure, `sprint-manager`/`release-manager`/`qa-validator` two-tier updates, new `docs/development/RELEASING.md` for Jarmo.

### Out of scope / explicitly deferred

- **#133 voice dictation on Windows** — Windows *feature-parity* (a different vision from delivery-sturdiness); adds a bundled `win32-x64/whisper-cli.exe` (build + signing surface). Deferred to a later Windows-parity release.
- **#107 / #108 / #106** architecture debt — unblocked by #105 esbuild but not built here.
- **The AI/editor bug backlog** (#121, #103, #132, #125, #123, …) — after this release these stop being "release" work and stream as `-ext.N` extension updates.
- **Deep OneDrive core read fix** — only error surfacing + diagnostics until reproduced against a real cloud placeholder.
- **v1.9.0 cloud sharing** — future cross-repo initiative, untouched.

## Sprint Map

| # | Sprint | Purpose | Issues | Tier | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | sprint-91-windows-foundation | Install + open files on Windows; CI de-risk | #130 #134 #131 | shell | cert procurement (external) | In review — PR pending. W2/W3/W4 done, W1 signing wired + verified on clean Windows; W1-11 (Microsoft SAC submission) + W1-12 (flip signing check to enforce) deferred to release time. |
| 2 | sprint-92-esbuild-bundling | Bundle extension host; kill EMFILE/0-byte/bloat | #105 | shell | — | In review — PR pending. Full runtime QA done (T2-3 dev-mode agent launches, T4-2 full prod build + editor/sidebar/Settings QA). |
| 3 | sprint-93-seamless-delivery | Extension release lane + "Relaunch to update" + two-tier process/harness | (seamless research) | extension | sprint-92 (small bundle) | In review — PR pending. All W2/W3/W4 done; qa-validator gate in progress. |

**Execution order / dependency spine:** sprint-91 and sprint-92 are independent domains (installer/signing vs build tooling) and can interleave — start sprint-91 immediately (and kick off cert procurement), run sprint-92 while the cert validates, land sprint-91's signing when the cert arrives, then sprint-93 on top of the bundled host. Each sprint runs its own DLC (plan → approve → branch `sprint-NN-name` → implement → QA → PR); no code lands before each sprint-plan's approval, per the repo's HARD gates.

## External Dependency / Critical Path (unusual — read this)

sprint-91's #130 signing is gated on an **external procurement lead time** (not code) that must start before the sprint can finish:

1. **Eligibility — RESOLVED (2026-07-08):** Productory is 7 years old → **eligible for Azure Trusted Signing (public trust)**. Path confirmed; the cloud-OV fallback (SSL.com / DigiCert) is not needed.
2. **Setup** — paid Azure subscription + Trusted Signing account + identity validation (officially 1–20 business days).
3. **Reputation reality** — signing removes the "unsigned" block immediately, but Smart App Control also gates on Microsoft cloud reputation; a fresh build may still be held until reputation builds or the app is submitted for review. "#130 done" = sign everything **+ submit to Microsoft for review + document the interim SAC workaround.**

**Contingency:** if the cert slips badly, the release can drop sprint-91's signing to a follow-up (v1.8.3) and still ship the rest — the bug fixes, esbuild, and seamless lane don't need the cert.

## Feature-Complete Definition

**sprint-91**
- [ ] Installer + uninstaller + `.tmp` loader + bundled binaries all signed (#130).
- [ ] App submitted to Microsoft for reputation review; interim SAC workaround documented (#130).
- [ ] Clean Windows 11 (Smart App Control **enabled**) install test passes — headline exit test (#130).
- [ ] OneDrive/SharePoint placeholder shows an actionable error; real OS error code logged (#134).
- [ ] New File / New Folder buttons render inline in File Browser on Windows (#131); macOS unchanged (already correct).
- [ ] Windows / macOS-x64 CI trigger via `workflow_dispatch`; weekly Windows canary green.

**sprint-92**
- [ ] Extension host ships as a single esbuild bundle; prod build boots cleanly; no EMFILE on Windows CI.

**sprint-93**
- [ ] `release-extension.sh` ships a compatible extension release end-to-end; release-tier guard + `engines.vscode` check enforced.
- [ ] Background download + verify + staged apply; "Relaunch to update" works; auto-apply on restart; N−1 rollback.
- [ ] CLAUDE.md, `release` skill, `sprint-manager`, `release-manager`, `qa-validator`, and new `docs/development/RELEASING.md` reflect the two-tier model.

**Release-level**
- [ ] Version bumped to `1.8.2` in `branding/product.json` + `extensions/ritemark/package.json`.
- [ ] Gate 1 (macOS arm64 build, sign, DMG) — un-notarized, Jarmo local test.
- [ ] Gate 2 (macOS x64 + **signed** Windows installer, incl. clean-Win11-SAC test) — Jarmo local test.
- [ ] Notarization (arm64 + x64) — only after respective gate + 60-min hardening.
- [ ] GitHub Release published to `jarmo-productory/ritemark-public` + canonical update feed regenerated.
- [ ] `qa-validator` sign-off recorded.

## Housekeeping

- The unapproved `sprint-91-seamless-updates` draft is **superseded**: its Windows/CI content moves into sprint-91-windows-foundation, its esbuild content into sprint-92, its release-lane/UX/process content into sprint-93. To be renumbered/re-cut when descending to the sprint layer.
- v1.9.0's native sprints are reserved in the governance plan with stale numbers (`sprint-85/86/87`); they renumber to the next-free native sequence when v1.9.0 is built.
