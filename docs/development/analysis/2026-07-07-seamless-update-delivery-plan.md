# Seamless Update Delivery Plan — from "build 3 installers every release" to "Relaunch to update"

**Date:** 2026-07-07
**Status:** PROPOSAL — awaiting Jarmo approval
**Goal:** Make building and releasing Ritemark easier and faster. Deliver most updates the way Claude Code does ("Relaunch to update"), and make the fragile Windows installer pipeline a rare event instead of a per-release blocker.

---

## 1. The core insight

Ritemark **already has** a two-tier update platform (built in Sprint 42):

| Tier | Vehicle | Delivery UX today | Pipeline cost today |
|---|---|---|---|
| **Full release** | 2× DMG + 1× Setup.exe | Notification → browser → manual download/install | 2–4 days: local 25-min build, 2× 60-min notarization windows, repo private/public toggle, fragile Windows CI (`windows-8core` + VS2026 breakage), 19–25 manual steps |
| **Extension release** | ~45 MB zip | In-app download → extract to `~/.ritemark/extensions/ritemark-{version}/` → reload window | Minutes: no signing, no notarization, no Windows CI, no repo toggle |

The extension tier installs **outside the signed app bundle** (`userExtensionInstaller.ts:44`), so it needs no Apple involvement and works identically on macOS and Windows. The feed (`update-feed.json`, schema v1) already supports both tiers with `minAppVersion` compatibility gating and the resolver (`updateResolver.ts`) already prefers/blocks correctly.

**The problem is not missing infrastructure — it's that every release is shipped as a full release.** Nearly all sprint work (Sprint 89 model gateway, Sprint 90 export integrity, all webview/AI/editor work) lives in `extensions/ritemark/` and never needed the VS Code shell rebuilt.

**The plan: flip the default.** Extension releases become the normal release vehicle; full ("shell") releases become a scheduled, rare event.

---

## 2. Release taxonomy (the decision rule)

A release is a **shell release** only if it changes any of:

- `vscode/` submodule version or `patches/vscode/*`
- Native modules / Electron / Node version
- `branding/product.json` (branding, product config)
- Bundled agent binaries (`binaries/agents/` — resolved from the app bundle, not the extension zip)
- Anything under `scripts/` that affects the shipped app layout

Everything else — extension host TS, webview (TipTap/React/AI sidebar), flows, settings UI, modelConfig — ships as an **extension release**.

Target cadence: extension releases **on demand (weekly or faster)**; shell releases **~every 4–6 weeks**, batching submodule bumps + patch changes + agent binary refreshes.

Versioning: use the update platform's native `-ext.N` scheme (`versionComparison.ts` already parses `1.8.1-ext.2` with the ext build as a fourth comparison component): shell releases are `X.Y.Z`, extension releases on that shell are `X.Y.Z-ext.1`, `-ext.2`, … with `minAppVersion: X.Y.Z`. This is exactly what the feed schema was designed for. Guard rail: extension releases must not use VS Code API newer than the oldest supported shell (enforced via `engines.vscode` + a preflight check).

---

## 3. Phases

### Phase A — Land v1.8.1 and de-risk the tag pipeline (immediate)

1. Finish the in-flight v1.8.1 Windows VS2026 fix (Layer 2 run pending; audit `vscode/` tree for further hardcoded `\2022`/`\2019` assumptions before any re-trigger, per WINDOWS-CI-HANDOVER.md).
2. Switch `build-windows.yml` and `build-macos-x64.yml` from `push: tags: v*` to **`workflow_dispatch`** (input: ref/version). Kills the tag-force-push double-trigger hazard and decouples "tag exists" from "CI runs", which also simplifies the private/public repo toggle dance.
3. Automate feed generation into the release scripts (it's currently a manual, release-blocking step): `release-dmg.sh` already calls `generate-update-feed.mjs` — extend the same automation to the extension tier in Phase B.

### Phase B — Make the extension release a one-command path (the payoff)

New script `scripts/release-extension.sh` (mirroring `release-dmg.sh` discipline):

1. Preflight (compile clean, webview bundle fresh + sentinel, tests, `engines.vscode` compat check, no shell-tier files changed since last shell release — fail loudly if the diff touches `patches/`, `vscode/`, `branding/`, binaries).
2. Version bump (`extensions/ritemark/package.json` only).
3. Build: `npm run compile` + webview build → package zip (exclude `binaries/agents/`) → sha256 + size.
4. `generate-update-feed.mjs --mode extension` → merge into canonical feed.
5. Upload zip + feed to `jarmo-productory/ritemark-public` release.

Gates stay, but shrink: Gate 1 = Jarmo installs the zip via the in-app updater (or a `--local` dev install path) and tests. No 60-min hardening window — nothing is notarized. **Version bump → published: well under an hour, all on the Mac, zero CI.**

### Phase C — Claude-Code-style UX ("Relaunch to update")

Today's extension-update UX is a 4-button notification and a foreground download. Change to:

1. **Background download:** when the 6-hour check (`updateService.ts`) finds a compatible extension release, download + verify sha256 + stage it silently to `~/.ritemark/extensions/` staging.
2. **One-click apply:** show a status-bar item / subtle notification — *"Ritemark 1.9.2 ready — Relaunch to update"* — one click = activate staged version + `workbench.action.reloadWindow`.
3. **Apply-on-next-start:** if the user never clicks, the staged version activates on next app start (updater already installs versioned dirs; the loader picks highest compatible).
4. **Rollback safety:** keep N−1 version dir; if the new extension fails to activate, fall back and report. (Cleanup of older dirs already exists in `userExtensionInstaller.ts`.)
5. Full releases keep a notification, but the button downloads the installer directly (with progress) instead of bouncing to the browser — small polish, optional.

Settings stay: `ritemark.updates.enabled`, plus a new `ritemark.updates.mode: auto | prompt`.

### Phase D — Shell-release hardening (make the rare event boring)

With shell releases down to ~monthly, invest to make each one predictable:

1. **ARCH-105 (esbuild extension host bundling)** — already-tracked debt; kills the EMFILE failure class on Windows CI, fixes the 0-byte tsc trap, shrinks the DMG and the extension zip. This is the single highest-leverage build-stability item.
2. **Windows CI image stability:** pin the larger-runner image where the runner group allows it; add a cheap weekly `workflow_dispatch` canary build on `main` so runner-image breakage (like VS2026) is discovered on a Tuesday, not mid-release.
3. Keep the existing macOS discipline (Gate order, 60-min hardening, notarization) — it only applies ~monthly now.

### Phase E (optional, later) — native background auto-update for the shell

Enable VS Code's built-in updater (`updateUrl` in product.json → Squirrel.Mac archive updates on macOS, `inno_updater.exe` on Windows) so even shell releases become "restart to update". Requires an update-server endpoint shape (`/api/update/:platform/:quality/:commit`) — feasible as a tiny static/worker service, but a real project. **Not needed to hit the goal**; revisit after Phases B–D prove out.

---

## 4. What this buys

| | Today (every release) | After (typical release) | After (shell release, ~monthly) |
|---|---|---|---|
| Wall clock | 2–4 days | **< 1 hour** | 1–2 days (unchanged, but rare + canary-protected) |
| Windows CI runs | every release | **zero** | one, on a pre-validated image |
| Apple notarizations | 2 | **zero** | 2 |
| Manual steps | 19–25 | **~4** (bump, run script, test, approve) | as today |
| User experience | browser download + reinstall | **background download → "Relaunch to update"** | installer (or Phase E later) |

## 5. Risks / open questions for Jarmo

1. **Auto-apply policy:** OK with staged updates activating silently on next start (`mode: auto` default), or always prompt? Recommendation: auto by default — it's what Claude Code does.
2. **Version-skew support window:** how many shell versions back must a new extension release support? Recommendation: current shell only (`minAppVersion` = latest shell), keeping the matrix trivial.
3. **Windows canary cost:** weekly `windows-8core` canary run costs runner minutes on a private toggle — acceptable? (Alternative: monthly, right before the planned shell release.)
4. **QA depth for extension releases:** full TEST-CHECKLIST or a slimmer extension-tier checklist? Recommendation: slim checklist scoped to changed surfaces.

## 5b. Re-sequencing — Windows Foundation goes FIRST (decided 2026-07-08)

After reviewing the four open Windows issues (#130, #131, #133, #134), Jarmo reprioritized: **the Windows shell + signing release comes before the seamless-update work.** Reason: 3 of 4 Windows issues are shell-tier, and the biggest (#130, Smart App Control blocks the installer) is an install-blocker — the seamless fast-lane is meaningless if Windows users can't install at all.

**Key insight:** the extension fast-lane does NOT rescue the *current* Windows pain, because that pain lives in the shell/installer/signing layer the fast-lane skips. It only helps *future* Windows fixes. So the move is a one-time "Windows Foundation" shell release to get Windows installable + signed, after which Windows rides the fast-lane like macOS.

**Windows issue → tier map:**

| Issue | Layer | Tier | In Foundation release? |
|---|---|---|---|
| #130 Smart App Control blocks installer | signing/installer + cert procurement | shell + infra | ✅ headline |
| #134 OneDrive/SharePoint file won't open | VS Code core read fail; near-term fix = better error UI | extension | ✅ error surfacing only (no deep core fix pre-repro) |
| #131 File Browser New File/Folder buttons | VS Code patch (002/003 hid explorer actions) | shell | ✅ free ride |
| #133 Voice dictation on Windows | bundled `win32-x64/whisper-cli.exe` + ext + signing | shell | ❌ deferred (keep the shell build tight) |

### Windows code-signing research (2026-07-08)

**#130 has two sub-problems; signing only fully fixes the first:**
- **A. Unsigned installer + Inno's extracted `.tmp` loader** → "can't confirm who published". Signing the installer/uninstaller/setup-loader/bundled binaries fixes this directly (Inno `SignTool=` directive covers the loader + uninstaller).
- **B. Smart App Control reputation** → SAC (Win11 22H2+, tightened in 24H2/25H2) blocks on Microsoft *cloud ML reputation*, not just signature. A correctly signed app with no download reputation can still be blocked. **EV certs lost their automatic SmartScreen/SAC reputation in 2024** — EV is no longer a shortcut. Reputation builds via download volume OR by submitting the app to Microsoft for review. SAC trusts RSA certs only (not ECC).

**Chosen path: Azure Trusted Signing (renamed "Azure Artifact Signing").** Microsoft's own documented *preferred* method for SAC compliance; ~$9.99/mo (5000 sigs/mo); cloud-based (no hardware-token shipping delay). Eligibility gate = **organization with 3+ years verifiable history** (EU orgs appear eligible for Public Trust per current MS docs — confirm at signup). Identity validation officially **1–20 business days** (some report minutes). Requires a **paid** Azure subscription. Gotcha: signs ~5–8s/file with no parallelism — plan the multi-binary Windows signing step accordingly. Fallback if ineligible: cloud OV signing (SSL.com eSigner / DigiCert KeyLocker) — fast issue, no token, but same SAC reputation ramp.

**"Done" for #130 = sign everything + submit the app to Microsoft for review + document the interim SAC workaround.** Signing alone will not instantly clear SAC on a new-reputation build.

**Fastest path (external lead time starts today):**
1. **Jarmo, today:** verify Productory Services OÜ is ≥3 years old (eligibility gate); create/confirm a paid Azure subscription; start the Trusted Signing account + identity validation.
2. **Claude, in parallel (needs no cert):** W1 CI de-risk (`workflow_dispatch` + free-public-runner canary) + #131 patch + #134 error surfacing — get CI reliable and the cheap fixes done while the cert validates.
3. **When the cert lands:** wire SignTool + Trusted Signing into the Inno build + bundled-binary signing; produce the signed installer; test on a clean Win11 with SAC **enabled**; submit to Microsoft for review.

**Re-cut sprint packaging:** the seamless-update work below slips one slot; the immediate next sprint becomes **Windows Foundation** (SHELL tier) = W1 CI de-risk + #130 signing + #131 + #134. Prerequisite unchanged: v1.8.1 Windows CI green first (now resolved on `8295cee`).

## 6. Sprint packaging (superseded by §5b re-sequencing; original 2026-07-07 note below)

Jarmo directed folding all related work into a **single sprint: `sprint-91-seamless-updates`** (docs in `docs/development/sprints/sprint-91-seamless-updates/`), covering Phases A–D plus process/harness changes (CLAUDE.md release-tier rule, release skill, sprint-manager / release-manager / qa-validator agent updates, and a human-facing `docs/development/RELEASING.md` guide). ARCH-105 esbuild bundling is included as the riskiest workstream, droppable mid-sprint via the scope-change protocol. Phase E stays backlog (GitHub `enhancement` issue). Decisions 1–4 from section 5 are baked in as defaults (auto-apply on restart, latest-shell-only skew, slim public-runner canary, slim extension-tier QA checklist) — overridable at plan approval.
