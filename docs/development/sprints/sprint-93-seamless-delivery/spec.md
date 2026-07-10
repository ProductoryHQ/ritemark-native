# Sprint 93: Seamless Extension Delivery — Behaviour Spec

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md)
Track: SDD (three workstreams — one-command extension release, Claude-Code-style update UX, process/harness changes — spanning release scripting, the extension host update platform, and process docs; retains SDD per the release plan's own "SDD not written" designation)

**RE-CUT NOTICE (2026-07-10):** This directory previously held a combined draft (`sprint-91-seamless-updates`) folding four workstreams (CI de-risk, one-command release, update UX, process/harness) plus a droppable esbuild-bundling workstream into one sprint. Per `docs/development/releases/v1.8.2/release-plan.md`'s Housekeeping note, that draft is **superseded and split three ways**:
- CI de-risk (old W1) → **already shipped in sprint-91-windows-foundation** (W4: `workflow_dispatch`-only triggers, `windows-canary.yml`). The `release` skill's Step 5 already documents the new dispatch model. Nothing left to do here.
- esbuild bundling (old W-D / GH #105) → **now its own sprint**, [`sprint-92-esbuild-bundling`](../sprint-92-esbuild-bundling/spec.md). This sprint depends on it (see Dependency below).
- One-command release, update UX, process/harness (old W2/W3/W4) → **this sprint**, requirement IDs and workstream labels preserved unchanged from the original draft for traceability (R3-R17; R1/R2/R18 are retired, not reused, per SDD's "don't reuse requirement IDs" discipline).

Source: [`docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md`](../../analysis/2026-07-07-seamless-update-delivery-plan.md) Phases B-C-D(process) — approved by Jarmo to fold into a sprint; re-sequenced per §5b (Windows Foundation first) and re-cut per this document.

## Dependency

**Depends on `sprint-92-esbuild-bundling`.** Branch bases off `sprint-92-esbuild-bundling`, not `main` (see sprint-plan.md). Rationale: W2's packaging step (R3) enumerates every file that ships in an extension release; today that list is dangerously large and already proven fragile (see Problem below); sprint-92's bundling collapses it to ~3 files, which is what makes W2's fix maintainable rather than a second stale-list trap. If sprint-92 is dropped or delayed (its own R9 droppability clause), W2 falls back to enumerating the CURRENT multi-file `out/` tree directly — correctness-wise this still works, it is just a larger, more fragile list to maintain (the exact problem this sprint's R3 is fixing either way).

## Problem

Ritemark already has a two-tier update platform (Sprint 42: `updateService.ts`, `updateResolver.ts`, `userExtensionInstaller.ts`, `updateFeed.ts`, `updateManifest.ts`) and it already installs extension updates outside the signed app bundle, into `~/.ritemark/extensions/ritemark-{version}/` — a directory that (per `branding/product.json`'s `dataFolderName: ".ritemark"`) is VS Code core's own standard user-extensions directory, using VS Code's own standard multi-version extension-directory resolution, not custom Ritemark loader code. Two things are missing on top of that solid foundation:

1. **There is no working one-command path to CUT an extension release.** `scripts/create-extension-release.sh` already exists and already does most of the right things (manifest generation, checksum computation, calls `generate-update-feed.mjs --mode extension` correctly) — but its file list (`FILES=` variable, lines 117-141) is **stale and already broken**: it references `out/excelEditor.js`, `out/aiProvider.js`, and `out/commands/index.js`, none of which exist in the current source tree (`out/excelEditorProvider.js` is the real file; the other two modules were removed from the codebase entirely at some point and grep confirms zero remaining references). It also OMITS roughly 100 real current `out/**` files (`out/codex/**`, `out/agent/**`, `out/acp/**`, `out/browser/**`, `out/flows/**`, `out/features/**`, `out/runtime/**`, `out/ai/**`, `out/views/**`, `out/settings/**`, `out/voiceDictation/**`, `out/utils/**`, and several editor-provider modules). Running this script today would produce a release that installs and then crashes on activation with a missing-module error — the SAME failure class the v1.7.1 incident and sprint-92's esbuild bundling both exist to prevent. This script is not invoked anywhere today (confirmed: no CI workflow, no `release` skill step references it) — it is a landmine waiting to be stepped on, not yet a live incident.
2. **The extension-update UX is a 4-button notification + foreground download**, not the background-download / "Relaunch to update" model used by Claude Code and other fast-moving desktop tools.

## Correction to source material — "zip" framing

Both the source analysis doc and `release-plan.md`'s MVP scope text describe extension packaging as producing a "zip." The verified runtime mechanism (`userExtensionInstaller.ts`'s `applyUpdate` → `downloadFilesToStaging`) downloads a **manifest-driven list of individual files**, one `fetch()` per file, verified against per-file `sha256` in the manifest — there is no unzip/archive-extraction step anywhere in the install path. `scripts/create-extension-release.sh` (Problem #1) already correctly follows this per-file model; it is simply stale, not architecturally wrong. This spec is written against the VERIFIED per-file model. Where `release-plan.md`'s prose says "package zip," read it as "package the per-file manifest + assets" — the release plan's outcome (a published, installable extension update) is unaffected by this correction, only the packaging mechanism description is.

## Requirements

### W2 — One-command extension release

**R3 — `scripts/release-extension.sh` ships a compatible extension release end-to-end, built on the existing per-file model.**
This sprint FIXES AND EXTENDS `scripts/create-extension-release.sh` (renaming/promoting it to `scripts/release-extension.sh`, or fixing it in place and adding a thin `release-extension.sh` wrapper that calls preflight + the existing packaging logic — decide at implementation time, see technical-plan.md), rather than inventing a new zip-based mechanism. Pipeline: preflight (R4, R5) → version bump check → compile + webview build → enumerate every real current file that must ship (dynamically, not hardcoded — see technical-plan.md for how sprint-92's bundling makes this tractable) → sha256 + size per file → emit `update-manifest.json` (schema: `src/update/updateManifest.ts`) → `node scripts/generate-update-feed.mjs --mode extension --manifest <manifest> --version <v> --output <feed>` (verified interface: extension mode requires `--manifest`, not `--asset`) → upload files + feed to `jarmo-productory/ritemark-public`.

**R4 — Release-tier guard blocks an extension release when shell-tier files changed.**
Preflight fails loudly (non-zero exit, clear message naming the offending path) if the diff since the last shell release touches: `patches/`, the `vscode/` submodule pointer, `branding/product.json`, `extensions/ritemark/binaries/agents/`, or an app-layout script (`scripts/build-prod.sh`, `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/apply-patches.sh`, `scripts/update-vscode.sh`, `scripts/create-patch.sh`, plus TWO new shell-tier paths introduced by sprint-91: `installer/windows/ritemark.iss` and `scripts/codesign-windows.sh` — this denylist must stay current as new shell-tier surface is added by other sprints, which is exactly the drift class R11's canonical prose exists to prevent). The message tells the operator to run a shell release instead.

**R5 — `engines.vscode` compatibility check.**
Preflight fails if `extensions/ritemark/package.json`'s declared VS Code engine requirement (`"engines": { "vscode": "^1.94.0" }` — VERIFIED present, current value) is newer than the currently-shipped shell's VS Code version. An extension release must never require API surface the current shell doesn't have.

### W3 — Claude-Code-style update UX

**R6 — Background download + verify + silent staging.**
When the periodic check (`updateService.ts`, 6h interval; `updateScheduler.ts`, 10s startup check) resolves a compatible **extension** release (`action: 'extension'`), the update is downloaded and sha256-verified in the background — no notification, no progress dialog — using the existing staging path in `userExtensionInstaller.ts` (`~/.ritemark/staging/` → atomic rename into `~/.ritemark/extensions/ritemark-{version}/`).

**R7 — One-click "Relaunch to update" via status bar.**
Once staged and verified, a status-bar item appears ("Ritemark {version} ready — Relaunch to update"). One click activates the staged version (already installed by R6's atomic rename — no further install step) and runs `workbench.action.reloadWindow`.

**R8 — Apply-on-next-start if never clicked.**
If the user never clicks the status-bar item, the staged version is already the highest-versioned directory under `~/.ritemark/extensions/`, so VS Code's own standard extension-directory version resolution picks it up automatically on next start (see Problem section — this is core VS Code behavior via `dataFolderName`, not custom Ritemark logic; verify this holds at implementation time rather than re-deriving it from scratch). `updateService.ts`'s existing `reconcilePendingRestartVersion()` (clears `pendingRestartVersion` once `getCurrentVersion()` catches up) continues to work unchanged.

**R9 — Rollback on failed activation.**
The previous (N−1) extension version directory is retained (not cleaned up) until the newly-activated version has successfully activated at least once. If the new version's activation throws (extension host `activate()` rejects or the module fails to load), the loader falls back to N−1 and reports the failure — the user is never left with a completely broken extension host. **Confirmed:** `UserExtensionInstaller.cleanupOldVersions()` exists but is called from NOWHERE in the current codebase (grep confirms the only match is the method's own definition) — it is dead code today, which means R9's "don't delete N−1 too eagerly" requirement has zero current risk to regress against; the work is adding NEW cleanup-timing logic, not fixing an existing eager-cleanup bug.

**R10 — `ritemark.updates.mode` setting.**
New setting `ritemark.updates.mode: "auto" | "prompt"`, default `"auto"`, added to `package.json`'s existing `"Ritemark Updates"` configuration section (alongside `ritemark.updates.enabled` / `ritemark.updates.dismissed`, `contributes.configuration`, ~line 184). `"auto"` = R6-R8 behaviour (background stage, auto-apply on next start if not manually relaunched). `"prompt"` = preserve today's notification-driven flow (`showExtensionUpdateNotification`) instead of silent staging. Full-app (`action: 'full'`) updates are unaffected by this setting — R6-R9 only change the extension tier; full releases keep today's notification (browser download).

### W4 — Process & harness changes

**R11 — Release-tier decision rule documented in `CLAUDE.md`.**
Root `CLAUDE.md` gets a "Release tiers" section stating the shell-vs-extension rule (mirrors R4's guard list, kept textually identical — single source of truth) as the canonical human-readable definition the guard script encodes.

**R12 — Extension-release procedure documented in the `release` skill.**
`.claude/skills/release/SKILL.md` gains a concrete extension-release procedure (exact commands via `release-extension.sh`), replacing the existing stale "Workflow — Extension-only release" manual-steps section (lines 187-195, which describes `vsce package` — a mechanism this codebase does not actually use; the real mechanism is the per-file manifest, per the Correction above), and states which gates do NOT apply to the extension tier (no notarization, no 60-min hardening, no Windows CI, no repo-visibility toggle). **Note:** the skill's Step 5 (CI dispatch) was ALREADY updated by sprint-91 to reflect `workflow_dispatch`-only triggering — this sprint EXTENDS the skill (adds the extension-release section), it does not touch Step 5 again.

**R13 — `sprint-manager` declares release tier per sprint plan.**
`.claude/agents/sprint-manager.md` requires every sprint plan to declare `Release tier: extension` or `Release tier: shell` based on the planned file paths against the R4/R11 decision rule. Extension is the default; shell must be justified by naming which shell-tier path is touched.

**R14 — `release-manager` operates a two-tier gate model.**
`.claude/agents/release-manager.md` documents: extension release = light gate (Jarmo installs the update via the in-app "Relaunch to update" flow or a local dev path, tests changed surfaces, says the approval phrase); shell release = today's Gate 1 + Gate 2 + 60-min hardening + notarization, unchanged. **Note:** `release-manager.md` already has a "Release Types" table and Decision Tree distinguishing full vs. extension-only releases (pre-existing, Sprint 42-era) — this requirement EXTENDS that with the light-vs-heavy GATE model, it does not duplicate the existing type table.

**R15 — `qa-validator` references a slim extension-tier QA checklist.**
`.claude/agents/qa-validator.md` references a slim, per-surface QA checklist for extension releases, distinct from the full `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` used for shell releases.

**R16 — `docs/development/RELEASING.md` human guide for Jarmo.**
New one-page, low-jargon doc: what an extension release is, what Jarmo does (test via the in-app "Relaunch to update" flow or a local dev install, test, say the approval phrase), what a shell release is and when it happens, plus a short FAQ.

**R17 — No manual `.codex/**`/`AGENTS.md` edits.**
This sprint does not touch the Codex harness directly — `harness-equalizer` (scheduled agent) syncs Codex artifacts from the Claude canon automatically after this sprint's `.claude/` changes land.

## Non-goals (out of scope)

- **Phase E — native shell auto-update** (VS Code's own `updateUrl` / Squirrel.Mac / `inno_updater.exe` so shell releases themselves become "restart to update"). Explicitly deferred. File a GitHub `enhancement` issue on `ProductoryHQ/ritemark-native` referencing this sprint and the source plan when this sprint closes; do not implement any part of Phase E here.
- **CI trigger model changes** — already shipped in sprint-91 (old R1/R2, now retired IDs). Nothing to do here.
- **esbuild extension host bundling** — now sprint-92 (old R18, now retired ID). This sprint DEPENDS on that sprint's output but does not implement it.
- Any change to the full-release (DMG/notarization) UX or gate sequence beyond what R14 documents.
- Version-skew support beyond "latest shell only" — multi-version compatibility matrices are out of scope (Product Decision, see `sprint-plan.md`).

## Acceptance

- `scripts/release-extension.sh` run against a clean extension-only diff produces a published set of files + a feed entry on `jarmo-productory/ritemark-public`, with `minimumAppVersion` set to the current shell version, using the per-file manifest model (not a zip) (R3).
- Running `release-extension.sh` against a diff that touches a shell-tier path (including the two NEW sprint-91 paths, `installer/windows/ritemark.iss` and `scripts/codesign-windows.sh`) fails preflight with a clear message naming the path and recommending a shell release (R4).
- Running `release-extension.sh` when `engines.vscode` exceeds the current shell's VS Code version fails preflight (R5).
- With `ritemark.updates.mode: "auto"` (default), a compatible extension release is downloaded, sha256-verified, and staged with no notification; a status-bar item then appears offering relaunch (R6, R7).
- If the status-bar item is never clicked, the staged version activates automatically on the next app start (R8).
- A staged version that fails to activate rolls back to N−1 without leaving the extension host broken (R9).
- `ritemark.updates.mode: "prompt"` preserves today's 4-button notification flow (R10).
- `CLAUDE.md`, `.claude/skills/release/SKILL.md`, `.claude/agents/sprint-manager.md`, `.claude/agents/release-manager.md`, `.claude/agents/qa-validator.md`, and `docs/development/RELEASING.md` all reflect the two-tier release model (R11-R16).
- No manual edits land in `.codex/**` or `AGENTS.md` as part of this sprint (R17).
- TypeScript compiles; pre-commit hook passes; `qa-validator` signs off.

## Linked issues

None yet filed — this sprint originates from an approved analysis doc, not a GitHub issue. File issues retroactively if useful for release-note traceability; not a blocker for sprint start.
