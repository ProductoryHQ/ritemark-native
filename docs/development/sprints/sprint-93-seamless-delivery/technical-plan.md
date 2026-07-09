# Sprint 91 — Technical Plan

## Current state (verified 2026-07-07)

### CI triggers
- `.github/workflows/build-windows.yml` and `.github/workflows/build-macos-x64.yml` both trigger on
  `push: tags: v*`. `release-dmg.sh` / the `release` skill's Step 5 pushes a tag to fire both. The
  v1.8.1 incident forced repeated `git tag -f` + `--force` pushes to re-trigger after each CI fix
  attempt — a destructive, easy-to-misuse mechanism (see `docs/releases/v1.8.1/WINDOWS-CI-HANDOVER.md`).
- No canary/scheduled workflow exists today.

### Release scripts
- `scripts/release-dmg.sh` handles the FULL release publish step (DMG upload + feed generation call).
- No equivalent script exists for extension-only releases — the `release` skill's "Workflow —
  Extension-only release" section (lines 180–188) describes manual steps (`vsce package`), not a
  single script, and does not mention a release-tier guard or `engines.vscode` check.
- `scripts/generate-update-feed.mjs` exists and is invoked in extension mode already for the full
  release path (per the skill: "extend the same automation to the extension tier" — this sprint does
  that extension).

### Update platform (Sprint 42, `extensions/ritemark/src/update/`)
- `updateService.ts` — `checkForUpdates()` runs at most every 6h (`STARTUP_CHECK_INTERVAL_MS`),
  resolves via `resolveLatestUpdate()` → `resolveUpdate()` (feed-based) or a legacy GitHub-release
  fallback. `notifyIfNeeded()` always shows a notification today (`showFullUpdateNotification` /
  `showExtensionUpdateNotification`) — this is the exact code path R6/R10 branch on `mode`.
- `updateScheduler.ts` — fires one delayed (`10_000` ms) `checkAndNotify()` call on activation, gated
  by `ritemark.updates.enabled`.
- `updateResolver.ts` — `resolveUpdate()` already implements `minimumAppVersion` gating
  (`isExtensionCompatible`) and returns `action: 'blocked'` with a reason when a newer-but-incompatible
  extension release exists (S11's assertion is about EXISTING behaviour, not new code).
- `userExtensionInstaller.ts` — `applyUpdate()` already downloads to
  `~/.ritemark/staging/{extensionDirName}`, verifies all file checksums (`verifyAllChecksums`, throws
  and cleans up staging on ANY mismatch — this already satisfies most of S10's abort behaviour), then
  atomically `fs.promises.rename`s into `~/.ritemark/extensions/{extensionDirName}`.
  `cleanupOldVersions(keepVersion)` deletes every `ritemark-*` dir except the kept one — **this is the
  opposite of what R9 (keep N−1) needs and must not be called blindly after every install.**
- `updateNotification.ts` — `installExtensionUpdateWithProgress()` shows a **foreground** progress
  notification during download; this is the piece R6 replaces for the `auto` mode path (background,
  no progress UI). `promptReloadWindow()` is reusable as-is for R7's click handler.
- `updateFeed.ts` — schema v1, `extensionReleases[].minimumAppVersion` already present and consumed.
  `toExtensionManifest()` maps a feed entry to `UpdateManifest` (includes `files[]` with `sha256`).

**Key insight:** the staging → verify → atomic-rename mechanics R6/R9 need mostly already exist in
`userExtensionInstaller.ts`. The sprint's real work in W3 is (a) calling that path silently instead of
via `installExtensionUpdateWithProgress`'s foreground UI, (b) a status-bar affordance that doesn't
exist yet, (c) NOT deleting N−1 immediately (rollback safety), and (d) an activation-failure detector
that doesn't exist yet (nothing today verifies a staged version actually activates before treating the
install as done).

### Feature flags
- `extensions/ritemark/src/features/flags.ts` — registry pattern with `status: 'stable' |
  'experimental' | 'disabled' | 'premium'`. Recent precedent (Sprint 82, Sprint 90-adjacent) is:
  ship ON (`status: 'stable'`) with the flag existing purely as an un-surfaced kill-switch, per HARD
  RULE #2. Same pattern applies to `mode: 'auto'` default here — no Settings UI toggle needed (Sprint
  67 removed flag UI from Settings; see memory).

### Architecture debt tracking
- RESOLVED (verified 2026-07-07): the esbuild-bundling item is **GitHub issue
  [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105)**, already tracked in
  `architecture.md`'s debt table (line ~392: "Extension host esbuild bundling — 105 loose files +
  ~180 packages; root cause of EMFILE, 0-byte tsc trap, DMG bloat"). The earlier "ARCH-105" label in
  the source plan = GH #105. W-D updates that existing entry (and the prose at line ~285) to DONE
  rather than creating a new one. Issues #107 (webview bundle size) and #108 (build-integrity gate)
  list #105 as prerequisite — closing #105 unblocks them but they stay out of sprint-91 scope.

## W1 — CI / pipeline de-risk

### Workstream W1.1 — `workflow_dispatch` trigger swap
- Edit `.github/workflows/build-windows.yml` and `.github/workflows/build-macos-x64.yml`: replace
  `on: push: tags: ['v*']` with:
  ```yaml
  on:
    workflow_dispatch:
      inputs:
        ref:
          description: 'Git ref (tag or branch) to build'
          required: true
          default: 'main'
  ```
- Update any in-workflow steps that assume `github.ref_name` is a tag (checkout step, version
  extraction) to instead read from `inputs.ref`.
- Update `.claude/skills/release/SKILL.md` Step 5 ("Tag + push (triggers CI)") to trigger explicitly:
  `gh workflow run build-windows.yml -f ref=vX.Y.Z` (and same for macos-x64), instead of relying on
  the tag push side effect. Tag push still happens (for the release itself) but no longer drives CI.
- Per the CI-workflow-editing HARD RULE (`release` skill "CI workflow editing — pre-push audit"): read
  both workflow files end-to-end before editing, diff the pair for drift, and run
  `python3 -c "import yaml; yaml.safe_load(open(...))"` on both before commit.

### Workstream W1.2 — Weekly Windows canary
- New `.github/workflows/windows-canary.yml`:
  ```yaml
  on:
    schedule:
      - cron: '0 6 * * 1'   # weekly, Monday 06:00 UTC
    workflow_dispatch: {}
  jobs:
    canary:
      runs-on: windows-latest   # free public-runner tier, NOT windows-8core
      steps:
        - checkout (submodules)
        - setup-node (same NODE_VERSION pin as build-windows.yml)
        - the SAME "Patch bundled node-gyp for VS2026 detection" step as build-windows.yml
        - npm ci at repo root only (not the full ~55-dir postinstall sweep) — enough to exercise the
          node-gyp + preinstall.ts path that broke in the VS2026 incident
  ```
- Reuse the exact patch-step logic from `build-windows.yml` (don't fork a second copy — extract to a
  shared step/script if drift risk is high; minimum bar is identical logic, per the "single source of
  truth" CI rule).
- Runs on public repo, no visibility toggle required (that requirement is `windows-8core`-specific,
  per the `release` skill's "Windows builds — public/private repo toggle" gotcha — `windows-latest` is
  unaffected).

## W2 — One-command extension release

### Workstream W2.1 — `scripts/release-extension.sh`
New script, modeled on `release-dmg.sh`'s discipline (colors, step numbering, `set -e`, dry-run flag):

1. **Preflight** (new `scripts/release-extension-preflight.sh`, called from the main script, mirroring
   `release-preflight.sh`'s separation):
   - Clean git tree, on a shell that has the target extension change committed.
   - **Release-tier guard (R4):** `git diff --name-only <last-shell-release-tag>..HEAD` against a
     path-prefix denylist: `patches/`, `vscode` (submodule pointer changes show as a mode/gitlink
     diff on the `vscode` path itself), `branding/product.json`, `extensions/ritemark/binaries/agents/`,
     and an explicit list of app-layout scripts (`scripts/build-prod.sh`, `scripts/codesign-app.sh`,
     `scripts/create-dmg.sh`, `scripts/apply-patches.sh` — exact list finalized in tasks.md). Any match
     → fail with the offending path named.
   - **`engines.vscode` check (R5):** read `extensions/ritemark/package.json`'s `engines.vscode`
     (VERIFIED 2026-07-07: field exists, value `"^1.94.0"` — the check is "read", not "add"), compare
     against the current shell's VS Code version (`vscode/package.json` version or
     `branding/product.json`). Fail if the extension declares a floor higher than what's shipped.
   - Compile clean (`npm run compile`), webview bundle fresh + `ai-sidebar` sentinel present (reuse
     `pre-commit-validator.sh`'s checks where possible instead of re-implementing).
2. **Version bump check** — verify `extensions/ritemark/package.json` version was already bumped (this
   script does not bump it itself, matching `release-dmg.sh`'s pattern of taking version as an arg /
   reading it from the already-committed bump).
3. **Build** — `npm run compile` + `cd webview && npm run build`.
4. **Package** — zip `extensions/ritemark/` EXCLUDING `binaries/agents/`, `webview/node_modules`,
   `webview/src` (same exclusions `release` skill's "v1.0.1 broken DMG" post-mortem warns about for
   `node_modules` — but note extension's OWN `node_modules` (runtime deps) must stay, only
   `webview/node_modules` is dev-only and excluded).
5. **Checksum** — sha256 + byte size of the zip.
6. **Feed generation** — VERIFIED 2026-07-07 against `scripts/generate-update-feed.mjs` (lines
   168–258): `--mode extension` exists and requires `--manifest <update-manifest.json>` (NOT `--asset`,
   which is full-mode only), plus `--version` and `--output`. The manifest supplies `installType`
   (default `user-extension`), `extensionId` (default `ritemark`), and `extensionDirName`. The script
   merges into the existing feed and de-duplicates by version. W2.1 must therefore also emit an
   `update-manifest.json` during packaging (see `src/update/updateManifest.ts` for the schema the
   installer expects).
7. **Upload** — `gh release create` (or update existing) on `jarmo-productory/ritemark-public` with
   the zip + regenerated feed, `minAppVersion` = current shell version per Product Decision D2.

### Workstream W2.2 — `engines.vscode` field
- VERIFIED 2026-07-07: `extensions/ritemark/package.json` already declares `"engines": { "vscode":
  "^1.94.0" }`. W2.2 reduces to: confirm the floor stays ≤ the shipped shell's VS Code version
  (currently 1.117) and wire the preflight check to read it.

## W3 — Claude-Code-style update UX

### Workstream W3.1 — `mode` setting
- Add `ritemark.updates.mode` to `extensions/ritemark/package.json` `contributes.configuration`,
  sibling to the existing `ritemark.updates.enabled` / `ritemark.updates.dismissed`:
  ```json
  "ritemark.updates.mode": {
    "type": "string",
    "enum": ["auto", "prompt"],
    "default": "auto",
    "description": "How extension updates are applied: 'auto' stages silently and relaunches on next start or click; 'prompt' shows the existing install notification."
  }
  ```

### Workstream W3.2 — Background download + stage (R6)
- In `updateService.ts`'s `notifyIfNeeded()` (or a new sibling method), branch on
  `vscode.workspace.getConfiguration('ritemark.updates').get('mode', 'auto')`:
  - `action === 'extension'` AND `mode === 'auto'` → skip `showExtensionUpdateNotification` entirely;
    instead call a new silent path that reuses `installer.applyUpdate(manifest)` WITHOUT the
    `withProgress` foreground wrapper (i.e. call `UserExtensionInstaller.applyUpdate` directly, not
    `installExtensionUpdateWithProgress`).
  - `action === 'extension'` AND `mode === 'prompt'` → existing notification flow, unchanged (S13).
  - `action === 'full'` → always existing `showFullUpdateNotification` flow regardless of `mode`
    (S14) — `mode` only governs the extension tier per R10.
- Checksum verification is already enforced inside `applyUpdate` (`verifyAllChecksums`) — on mismatch
  it throws, staging is cleaned up (`removeDir(stagingTarget)` in the catch block), and the promise
  rejects. The silent caller must catch this and simply NOT set `pendingRestartVersion` / NOT show the
  status-bar item — next periodic check retries naturally (S10). No new retry logic needed; this falls
  out of the existing 6h interval.

### Workstream W3.3 — Status-bar item (R7)
- New `extensions/ritemark/src/update/updateStatusBar.ts`: a `vscode.StatusBarItem` created once at
  activation, hidden by default. After a successful silent stage (W3.2), call
  `updateStatusBar.show(version)` → text `"$(sync) Ritemark {version} ready"`, tooltip "Click to
  relaunch and update", `command` bound to a new `ritemark.updates.relaunch` command.
- `ritemark.updates.relaunch` command handler: since `applyUpdate` already did the atomic rename (the
  new version directory is ALREADY the active one on disk — `userExtensionInstaller.ts`'s directory
  model means "staged" and "installed" are the same step, there's no separate "activate" step short of
  a reload), the handler is simply `promptReloadWindow`'s reload call
  (`vscode.commands.executeCommand('workbench.action.reloadWindow')`) — no confirmation dialog needed
  since the user already clicked an explicit "ready" affordance.
- Register status-bar item disposal in `extension.ts`'s `deactivate`/subscriptions list (existing
  pattern — verify against how other status-bar items in the codebase are registered, if any exist, or
  follow standard VS Code extension disposal pattern).

### Workstream W3.4 — Apply-on-next-start (R8)
- No new code needed for the "which version wins" mechanic — the extension host loader already picks
  the highest-versioned `ritemark-*` directory (verify this is the actual VS Code / product.json
  mechanism at implementation time — read how `~/.ritemark/extensions/` is wired into the extension
  host's search path; this was built in Sprint 42 and this sprint must NOT re-derive it from scratch,
  only confirm it still holds).
- `updateService.ts`'s existing `reconcilePendingRestartVersion()` (clears `pendingRestartVersion` once
  `getCurrentVersion()` catches up) continues to work unchanged — S9 is a regression check on EXISTING
  logic plus the NEW silent-staging path from W3.2, not new reconciliation code.

### Workstream W3.5 — Rollback safety (R9)
- **Change `cleanupOldVersions` call site.** Today nothing calls `cleanupOldVersions()` from the
  update-check path shown in `updateService.ts` (verify at implementation time whether it's called
  elsewhere, e.g. after a successful reload) — audit ALL call sites before changing behaviour. The
  requirement is: after a NEW version has successfully activated at least once (not merely staged),
  clean up versions older than N−1 (i.e. keep current + previous, not just current).
- **New: activation-failure detection.** Nothing today verifies a staged/installed version actually
  activates before treating install as terminal-success. Add a lightweight self-check: on extension
  activation (`extension.ts`'s `activate()`), if the currently-active version directory is NOT the one
  `versionService.ts` expects post-update AND a fallback candidate (N−1 directory) exists, this is the
  rollback trigger. Concretely: wrap the top of `activate()` in a try/catch is insufficient (VS Code
  has already resolved the extension path before `activate()` runs — a load-time syntax error, per the
  v1.7.1 "Invalid or unexpected token" precedent in the `release` skill, throws BEFORE `activate()` is
  ever reached). **This means rollback cannot be pure in-process JS — it needs a pre-activation
  integrity signal.** Two candidate approaches (resolve at implementation time, document the choice in
  a short research note if non-trivial):
  (a) a lightweight "last known good version" marker file written only AFTER a successful `activate()`
  completes, checked by `userExtensionInstaller.ts` (or a tiny bootstrap shim) before VS Code resolves
  the extension path on NEXT startup — if the newest directory has no corresponding "activated
  successfully" marker from a prior run AND is not brand new, treat as failed and prune/deprioritize it
  so the loader falls through to N−1; or
  (b) rely on VS Code's own extension-activation-failure surfacing (if it exists in this VS Code
  version) plus a manual "if Ritemark fails twice in a row, offer rollback" UX prompt as a fallback
  layer, since a purely automatic same-session rollback isn't possible once the host has already failed
  to load the module.
  This is the single most architecturally uncertain piece of the sprint — treat it as spec-complete
  (R9's OBSERVABLE behaviour is fixed) but implementation-open, and flag for a short audit before
  coding if the marker-file approach turns out to need product.json or bootstrap-script changes (which
  would brush against shell-tier territory and needs a release-tier gut-check per R4's own rule).

## W4 — Process & harness

Pure documentation edits, all under `.claude/` and `docs/`. No source code. See `tasks.md` for exact
file/section targets. Key discipline: **R11's decision-rule list, R4's guard-script denylist, and
R14/R13's agent-doc lists must all describe the SAME set of shell-tier paths** — write R11 first as
the canonical prose, then make W2.1's guard script and the agent-doc updates reference it rather than
re-deriving independently (avoids the exact drift class the `release` skill's CI-editing rule warns
about, applied to docs instead of YAML).

## W-D — ARCH-105 esbuild bundling

### Workstream WD.1 — Bundle config
- Add an esbuild build step for the extension host (`extensions/ritemark/src/extension.ts` as entry),
  producing a single bundled `out/extension.js` (or a small number of chunks if dynamic `import()` is
  used anywhere — audit for that first). Mirrors the existing webview esbuild/Vite pattern already in
  the repo (webview already builds via Vite, which is esbuild-based) — new tooling, not new concepts.
- `vscode` module import must stay external (`external: ['vscode']`) — standard VS Code extension
  esbuild pattern.
- Audit `extensions/ritemark/src/` for any `require()` calls that assume a relative `out/` file layout
  (dynamic requires of sibling compiled files) — these break under bundling and must be found before
  writing the config, not discovered via a broken prod build.

### Workstream WD.2 — Native/binary dependencies
- Anything that ships a native `.node` binary or must stay as a loose file (bundled agent binaries,
  any native module) must be explicitly marked external and copied post-bundle, not bundled — audit
  `extensions/ritemark/node_modules` for `.node`/`binding.gyp` (reuse the release-manager's existing
  audit command: `find extensions/ritemark/node_modules -name "*.node" -o -name "binding.gyp"`).

### Workstream WD.3 — Validate against existing prod-build checks
- `pre-commit-validator.sh` and `scripts/validate-build-output.sh` check specific file paths/sizes
  under `out/` today (per CLAUDE.md's "Critical Invariants" — webview bundle size + sentinel, extension
  TS compiles). Audit whether any hardcode expectations about `out/` being a multi-file tree; update
  if so.

### Workstream WD.4 — `docs/development/architecture.md` entry
- Update the existing GH [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105) debt
  entry in `architecture.md` (debt table ~line 392 + prose ~line 285) to reflect the bundling:
  what was bundled, why (EMFILE class closure, 0-byte tsc trap closure, size reduction), residual
  risk. Close GH issue #105 at sprint end; note that #107/#108 are now unblocked.

**Scope-change trigger:** if WD.1's require()/dynamic-import audit surfaces more than a handful of
call sites needing rework, or WD.2's native-binary externals list turns out large/fragile, invoke the
Mid-Sprint Scope Change Protocol and drop W-D to a follow-on sprint — W1–W4 ship independently and are
not blocked by W-D's outcome.

## Files touched (indicative, not exhaustive — finalize exact paths in tasks.md)

- `.github/workflows/build-windows.yml`, `.github/workflows/build-macos-x64.yml` (W1.1)
- `.github/workflows/windows-canary.yml` (new, W1.2)
- `scripts/release-extension.sh`, `scripts/release-extension-preflight.sh` (new, W2.1)
- `extensions/ritemark/package.json` (`engines.vscode`, `ritemark.updates.mode` config) (W2.2, W3.1)
- `extensions/ritemark/src/update/updateService.ts` (W3.2, W3.5 audit)
- `extensions/ritemark/src/update/updateStatusBar.ts` (new, W3.3)
- `extensions/ritemark/src/update/userExtensionInstaller.ts` (W3.5 rollback/cleanup timing)
- `extensions/ritemark/src/extension.ts` (status-bar registration, W3.3; possible activation marker, W3.5)
- `CLAUDE.md` (W4, R11)
- `.claude/skills/release/SKILL.md` (W4, R12; also W1.1's Step 5 update)
- `.claude/agents/sprint-manager.md` (W4, R13)
- `.claude/agents/release-manager.md` (W4, R14)
- `.claude/agents/qa-validator.md` (W4, R15)
- `docs/development/RELEASING.md` (new, W4, R16)
- `docs/development/architecture.md` (W-D, ARCH entry)
- esbuild config + `extensions/ritemark/src/**` audit touches (W-D, scope TBD by WD.1 audit)

## Risks

- **R9 rollback mechanism is the least-derisked piece** — flagged explicitly in W3.5; may need a short
  implementation-time research note before coding if the marker-file approach is chosen.
- **Release-tier guard path list (R4) must exactly match R11's documented list** — drift here silently
  reintroduces the "shipped a shell-tier change as an extension release" failure mode the whole sprint
  exists to prevent. Single-source-of-truth discipline required (see W4 note).
- **W-D is the highest-uncertainty workstream** — explicitly scoped as droppable; see Scope-change
  trigger above.
