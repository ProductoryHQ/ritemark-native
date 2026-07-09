# Sprint 91 — Seamless Update Delivery: Behaviour Spec

Source of truth for what the sprint changes. Written before implementation. Source plan:
[`docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md`](../../analysis/2026-07-07-seamless-update-delivery-plan.md).

## Problem

Ritemark already has a two-tier update platform (Sprint 42: `updateService.ts`, `updateResolver.ts`,
`userExtensionInstaller.ts`, `updateFeed.ts`) and it already installs extension updates outside the
signed app bundle. But two things are missing:

1. **Every release ships as a full shell release** (DMG + Setup.exe), even when the change is
   confined to `extensions/ritemark/`. That drags every release through 2–4 days of notarization,
   Windows CI, and repo-visibility toggling — work the platform doesn't actually require for
   extension-only changes.
2. **The extension-update UX is a 4-button notification + foreground download**, not the
   background-download / "Relaunch to update" model used by Claude Code and other fast-moving desktop
   tools.

On top of the product gap, the v1.8.1 Windows CI incident (VS2026 runner image change breaking
node-gyp detection across three layers — see `docs/releases/v1.8.1/WINDOWS-CI-HANDOVER.md`) exposed
that the tag-push CI trigger conflates "a tag exists" with "CI should run now", making iteration on a
broken pipeline expensive and hazardous (forced tag moves re-trigger both platforms).

## Requirements

### W1 — CI / pipeline de-risk

**R1 — Windows/macOS-x64 CI triggers on demand, not on tag push.**
`build-windows.yml` and `build-macos-x64.yml` switch from `push: tags: v*` to `workflow_dispatch`
with a required `ref` input. Decouples "tag exists" from "CI runs" and removes the forced-tag-move
hazard documented in the v1.8.1 incident. The `release-dmg.sh` / `release` skill Step 5 sequence is
updated to trigger the workflow explicitly instead of relying on the tag push side effect.

**R2 — Weekly Windows CI canary on a free public runner.**
A new scheduled workflow runs weekly on standard `windows-latest` (free tier, public repo, no
`windows-8core`, no repo-visibility toggle) and executes ONLY the dependency-install / native-module
path (the node-gyp patch + `preinstall.ts` steps that broke in the VS2026 incident) — enough to
surface a runner-image break long before the next real shell release. It does not attempt a full
8-core build and is not a substitute for Gate 1/Gate 2 CI.

**Explicit prerequisite, not sprint scope:** the in-flight v1.8.1 Windows fix (Layers 1–3, see
`docs/releases/v1.8.1/WINDOWS-CI-HANDOVER.md`) must be fully green BEFORE R1/R2 are implemented —
this sprint does not fix v1.8.1 Windows CI, it changes the trigger model and adds a canary once the
pipeline itself works again.

### W2 — One-command extension release

**R3 — `scripts/release-extension.sh` ships a compatible extension release end-to-end.**
Single script: preflight → version bump check → compile + webview build → package zip (excluding
`binaries/agents/`) → sha256 + size → `scripts/generate-update-feed.mjs --mode extension` → upload
zip + feed to `jarmo-productory/ritemark-public`.

**R4 — Release-tier guard blocks an extension release when shell-tier files changed.**
Preflight fails loudly (non-zero exit, clear message naming the offending path) if the diff since the
last shell release touches: `patches/`, the `vscode/` submodule pointer, `branding/product.json`,
native dependencies, `binaries/agents/`, or app-layout scripts. The message tells the operator to run
a shell release instead.

**R5 — `engines.vscode` compatibility check.**
Preflight fails if `extensions/ritemark/package.json`'s declared VS Code engine requirement is newer
than the currently-shipped shell's VS Code version — an extension release must never require API
surface the current shell doesn't have.

### W3 — Claude-Code-style update UX

**R6 — Background download + verify + silent staging.**
When the periodic check (`updateService.ts`, 6h interval; `updateScheduler.ts`, 10s startup check)
resolves a compatible **extension** release (`action: 'extension'`), the update is downloaded and
sha256-verified in the background — no notification, no progress dialog — using the existing staging
path in `userExtensionInstaller.ts` (`~/.ritemark/staging/` → atomic rename into
`~/.ritemark/extensions/ritemark-{version}/`).

**R7 — One-click "Relaunch to update" via status bar.**
Once staged and verified, a status-bar item appears ("Ritemark {version} ready — Relaunch to
update"). One click activates the staged version (already installed by R6's atomic rename — no
further install step) and runs `workbench.action.reloadWindow`.

**R8 — Apply-on-next-start if never clicked.**
If the user never clicks the status-bar item, the staged version is already the highest-versioned
directory under `~/.ritemark/extensions/`, so it activates automatically the next time the app starts
— no separate "pending apply" flag needed beyond what `userExtensionInstaller.ts` already does via
directory versioning; `updateService.ts`'s existing `pendingRestartVersion` reconciliation continues
to work unchanged.

**R9 — Rollback on failed activation.**
The previous (N−1) extension version directory is retained (not cleaned up) until the newly-activated
version has successfully activated at least once. If the new version's activation throws (extension
host `activate()` rejects or the module fails to load), the loader falls back to N−1 and reports the
failure — the user is never left with a completely broken extension host.

**R10 — `ritemark.updates.mode` setting.**
New setting `ritemark.updates.mode: "auto" | "prompt"`, default `"auto"`. `"auto"` = R6–R8 behaviour
(background stage, auto-apply on next start if not manually relaunched). `"prompt"` = preserve
today's notification-driven flow (`showExtensionUpdateNotification`) instead of silent staging.
Full-app (`action: 'full'`) updates are unaffected by this setting — R6–R9 only change the extension
tier; full releases keep today's notification (browser download).

### W4 — Process & harness changes

**R11 — Release-tier decision rule documented in `CLAUDE.md`.**
Root `CLAUDE.md` gets a "Release tiers" section stating the shell-vs-extension rule (mirrors R4's
guard list) as the canonical human-readable definition the guard script encodes.

**R12 — Extension-release procedure documented in the `release` skill.**
`.claude/skills/release/SKILL.md` gains a concrete extension-release procedure (exact commands via
`release-extension.sh`) alongside the existing DMG/notarization flow, and states which gates do NOT
apply to the extension tier (no notarization, no 60-min hardening, no Windows CI, no repo-visibility
toggle).

**R13 — `sprint-manager` declares release tier per sprint plan.**
`.claude/agents/sprint-manager.md` requires every sprint plan to declare `Release tier: extension` or
`Release tier: shell` based on the planned file paths against the R4/R11 decision rule. Extension is
the default; shell must be justified by naming which shell-tier path is touched.

**R14 — `release-manager` operates a two-tier gate model.**
`.claude/agents/release-manager.md` documents: extension release = light gate (Jarmo installs the zip
via the in-app updater or a local dev path, tests changed surfaces, says the approval phrase); shell
release = today's Gate 1 + Gate 2 + 60-min hardening + notarization, unchanged.

**R15 — `qa-validator` references a slim extension-tier QA checklist.**
`.claude/agents/qa-validator.md` references a slim, per-surface QA checklist for extension releases,
distinct from the full `TEST-CHECKLIST.md` used for shell releases.

**R16 — `docs/development/RELEASING.md` human guide for Jarmo.**
New one-page, low-jargon doc: what an extension release is, what Jarmo does (install the zip in-app,
test, say the approval phrase), what a shell release is and when it happens, plus a short FAQ.

**R17 — No manual `.codex/**`/`AGENTS.md` edits.**
This sprint does not touch the Codex harness directly — `harness-equalizer` (scheduled agent) syncs
Codex artifacts from the Claude canon automatically after this sprint's `.claude/` changes land.
Tasks.md notes this explicitly so nobody duplicates the work.

### W-D — ARCH-105 (esbuild extension host bundling) — riskiest workstream, explicitly droppable

**R18 — Extension host bundled via esbuild into a single output.**
`extensions/ritemark/out/` (105 loose `.js` files + ~180 transitive `node_modules` packages) is
bundled by esbuild into a single (or minimal-chunk) output, matching the pattern already used for the
webview build. Reduces DMG/zip size, removes the EMFILE failure class on Windows CI (fewer discrete
file handles during install/copy), and closes the "0-byte incremental tsc" trap class documented in
the `release` skill (broken partial `out/` state is structurally impossible once there's one bundled
file instead of 105).

**Scope-change note:** R18 is its own sub-workstream with its own QA tasks (see `tasks.md`) and can be
dropped mid-sprint via the Mid-Sprint Scope Change Protocol (see `.claude/skills/spec-driven-sprint/SKILL.md`)
without endangering W1–W4, which are independently completable and independently valuable.

## Non-goals (out of scope)

- **Phase E — native shell auto-update** (VS Code's own `updateUrl` / Squirrel.Mac / `inno_updater.exe`
  so shell releases themselves become "restart to update"). Explicitly deferred. File a GitHub
  `enhancement` issue on `ProductoryHQ/ritemark-native` referencing this sprint and the source plan
  when this sprint closes; do not implement any part of Phase E here.
- Fixing the in-flight v1.8.1 Windows CI incident itself (prerequisite, not scope — see R1).
- Any change to the full-release (DMG/notarization) UX or gate sequence beyond what R14 documents.
- Any new runtime dependency for rasterization, canvas, or unrelated export work (out of scope,
  unrelated to this sprint).
- Windows canary running the FULL 8-core build matrix — R2 is deliberately a slim dependency-only job.
- Version-skew support beyond "latest shell only" — multi-version compatibility matrices are out of
  scope (see Product Decision D2 in `sprint-plan.md`).

## Acceptance

- `build-windows.yml` and `build-macos-x64.yml` trigger via `workflow_dispatch` with a `ref` input;
  tag push alone no longer triggers either (R1).
- A weekly scheduled workflow runs the dependency-install path on `windows-latest` and fails loudly if
  node-gyp/`preinstall.ts` detection breaks again (R2).
- `scripts/release-extension.sh` run against a clean extension-only diff produces a published zip +
  feed entry on `jarmo-productory/ritemark-public`, with `minAppVersion` set to the current shell
  version (R3).
- Running `release-extension.sh` against a diff that touches a shell-tier path (e.g. `patches/001-*`)
  fails preflight with a clear message naming the path and recommending a shell release (R4).
- Running `release-extension.sh` when `engines.vscode` in `extensions/ritemark/package.json` exceeds
  the current shell's VS Code version fails preflight (R5).
- With `ritemark.updates.mode: "auto"` (default), a compatible extension release is downloaded,
  sha256-verified, and staged with no notification; a status-bar item then appears offering relaunch
  (R6, R7).
- If the status-bar item is never clicked, the staged version activates automatically on the next app
  start (R8).
- A staged version that fails to activate rolls back to N−1 without leaving the extension host broken
  (R9).
- `ritemark.updates.mode: "prompt"` preserves today's 4-button notification flow (R10).
- `CLAUDE.md`, `.claude/skills/release/SKILL.md`, `.claude/agents/sprint-manager.md`,
  `.claude/agents/release-manager.md`, `.claude/agents/qa-validator.md`, and
  `docs/development/RELEASING.md` all reflect the two-tier release model (R11–R16).
- No manual edits land in `.codex/**` or `AGENTS.md` as part of this sprint (R17).
- TypeScript compiles; pre-commit hook passes; `qa-validator` signs off.
- (If not dropped) `extensions/ritemark/out/` is a single esbuild bundle and a full prod build boots
  Ritemark with no activation errors (R18).

## Linked issues

None yet filed — this sprint originates from an approved analysis doc, not a GitHub issue. File
issues retroactively if useful for release-note traceability; not a blocker for sprint start.
