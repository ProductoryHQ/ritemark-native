# Sprint 93: Seamless Extension Delivery — Technical Plan

Re-cut 2026-07-10 — see spec.md's RE-CUT NOTICE. Old W1 (CI de-risk) and W-D (esbuild bundling) content removed; see spec.md for where each moved.

## Current state (verified 2026-07-10)

### Release scripts — the central finding

`scripts/create-extension-release.sh` **already exists** and already implements most of R3's pipeline correctly:
- Version-format validation (`^[0-9]+\.[0-9]+\.[0-9]+(-ext\.[0-9]+)?$`).
- Prerequisite checks (`out/extension.js` exists, `media/webview.js` exists and is >100KB).
- Per-file sha256 + size computation, manifest assembly matching `src/update/updateManifest.ts`'s `UpdateManifest`/`UpdateFile` schema exactly (`installType`, `extensionId`, `extensionDirName`, `files[].path/url/sha256/size`).
- Correctly calls `node scripts/generate-update-feed.mjs --mode extension --version <v> --manifest <manifest> --output <feed>` — the real, verified feed-generation interface.

**What is broken:** its hardcoded `FILES` variable (lines 117-141) is stale — three listed paths do not exist in the current source tree (`out/excelEditor.js`, `out/aiProvider.js`, `out/commands/index.js` — confirmed via direct `Glob`/`Grep`: the real file is `out/excelEditorProvider.js`; the other two modules have zero references anywhere in `.ts` sources, meaning they were removed from the codebase at some point after this script was last touched), and it OMITS ~100 real current files. It is not invoked by any CI workflow or `release` skill step today (confirmed via grep) — dead-but-broken, not yet a live incident, but a landmine.

**Design consequence:** R3 is a REPAIR + EXTEND task on an existing script, not new-script-from-scratch. The main design problem to solve is **how the file list is generated** — hardcoding it (the current approach) is proven fragile. Two options, in priority order:

1. **(Preferred, if sprint-92 has landed)** Enumerate `out/**/*.js` dynamically at packaging time (`find extensions/ritemark/out -name '*.js' -not -name '*.map'` or equivalent), which is SAFE and CHEAP once sprint-92's esbuild bundling collapses the tree to ~2 files (`out/extension.js`, `out/browser/browserMcpAdapter.js`) plus `media/webview.js` and `package.json`. A short, correct, self-maintaining list.
2. **(Fallback, if sprint-92 was dropped/delayed)** Enumerate dynamically against the CURRENT ~130-file multi-file tree — still correct (dynamic enumeration never goes stale the way a hardcoded list does), just a longer file list to upload and a larger `files[]` array in the manifest. Functionally fine; the only cost is more individual `fetch()` calls at install time (per `userExtensionInstaller.ts`'s per-file model) and a larger surface for accidental omission if anyone reverts to hardcoding later.

Either way, the FIX for R3's core bug (dynamic enumeration replacing the hardcoded list) does not strictly require sprint-92 — the DEPENDENCY (see spec.md) is about how SHORT/maintainable the result is, not about correctness. This softens the "hard blocker" read of the dependency: sprint-92 makes this sprint's output smaller and its file list simpler to reason about, but sprint-93's own correctness fix stands on its own.

- No `.vscodeignore`/`vsce package` mechanism is actually used anywhere in this codebase for the extension-release path (the OLD `release` skill text describing "Package: vsce package --out dist/..." was aspirational/inaccurate — `vsce` does not appear in `package.json` devDependencies, and no script invokes it). R12 corrects this stale documentation.
- `scripts/generate-update-feed.mjs` (lines 168-258, already read in full): `--mode extension` requires `--manifest <update-manifest.json>` (NOT `--asset`, which is full-mode only), plus `--version` and `--output`. Merges into the existing feed (fetched from the canonical feed URL or defaulted to an empty schema-v1 shell) and de-duplicates by version AND by `appVersion` (line 249: filters out prior entries with the SAME `appVersion` as the new release — i.e. only the latest `-ext.N` build per shell version is kept in the feed, older ext builds for the same shell are pruned). This is existing, working, unmodified-by-this-sprint behavior — noted here because it affects how "latest shell only" version-skew (a Product Decision) is already enforced by the feed generator itself, not something this sprint needs to build.

### Update platform (Sprint 42, `extensions/ritemark/src/update/`)
- `updateService.ts` — `checkAndNotify()`/`checkForUpdates()` runs at most every 6h (`STARTUP_CHECK_INTERVAL_MS`), resolves via `resolveLatestUpdate()` → `resolveUpdate()` (feed-based, in `updateResolver.ts`) or a legacy GitHub-release fallback. `notifyIfNeeded()` (private method, called from `checkForUpdates` when `notify: true`) always calls `showFullUpdateNotification`/`showExtensionUpdateNotification` today — this is the exact branch point R6/R10 modify.
- `updateScheduler.ts` — `scheduleStartupCheck()` fires one delayed (10,000 ms) `checkAndNotify()` call on activation, gated by `ritemark.updates.enabled`.
- `updateResolver.ts` — `resolveUpdate()` already implements `minimumAppVersion` gating; returns `action: 'blocked'` with a reason when a newer-but-incompatible extension release exists. This is EXISTING behavior, re-verified under the new UX by scenarios, not new code.
- `userExtensionInstaller.ts` — `applyUpdate()` (verified in full, lines 81-147): downloads to `~/.ritemark/staging/{extensionDirName}` (`downloadFilesToStaging`, one `fetch()` per manifest file entry), verifies ALL file checksums (`verifyAllChecksums`, throws on ANY mismatch, catch block calls `removeDir(stagingTarget)` — staging cleanup on failure ALREADY WORKS, satisfying most of R6's abort-safety requirement with zero new code), then atomically `fs.promises.rename`s staging → `~/.ritemark/extensions/{extensionDirName}`. **`cleanupOldVersions(keepVersion)`** (lines 166-187) exists and would delete every `ritemark-*` dir except the kept one — but a full-codebase grep confirms **this method is called from NOWHERE today** (only match is its own definition). This means R9 (keep N−1) requires ADDING a call site with correct timing, not fixing an existing eager-cleanup regression — the risk profile is lower than the original draft assumed.
- `updateNotification.ts` — `installExtensionUpdateWithProgress()` (verified, lines 86-129) wraps `installer.applyUpdate()` in a **foreground** `vscode.window.withProgress` notification; this is the piece R6 bypasses for the `auto`-mode path (call `installer.applyUpdate()` directly, skip the `withProgress` wrapper). `promptReloadWindow(version)` (lines 131-141) is reusable as-is for R7's click handler — it already does exactly "show a message, reload on confirm," though R7's status-bar affordance replaces the need for its confirmation dialog (the user already clicked an explicit "ready" affordance).
- `updateFeed.ts` — schema v1, `extensionReleases[].minimumAppVersion` present and consumed by `updateResolver.ts`.
- `versionComparison.ts` — `compareVersions()` already parses the `-ext.N` suffix as a fourth comparison component (`major.minor.patch.extBuild`); `determineUpdateType()` already distinguishes `'extension'` (same base version, ext build changed) from `'full'` (different base version). No changes needed to this file.

### Startup extension-directory resolution (R8 — confirms, does not re-derive)
`branding/product.json`'s `dataFolderName: ".ritemark"` is VS Code core's standard user-data-folder config key. There is no Ritemark-authored patch or custom scanner touching `userExtensionsDir`/extension-directory version resolution (grep of `patches/**` for those terms: zero matches). This strongly indicates `~/.ritemark/extensions/ritemark-{version}/` is resolved by VS Code's OWN standard "user-installed extension directory" scanning logic (the same mechanism that resolves ordinary marketplace extension updates in vanilla VS Code, which already picks the highest-compatible-version directory when multiple installs of the same extension ID coexist) — NOT bespoke Ritemark loader code. This should be CONFIRMED at implementation time (read the relevant VS Code core extension-scanning source under the `vscode/` submodule) rather than assumed, but it de-risks R8 considerably: there is likely no new code needed for "which version wins," matching the original draft's own conclusion, now with a concrete mechanism hypothesis to verify instead of an open question.

### Feature flags
- `extensions/ritemark/src/features/flags.ts` — registry pattern, `status: 'stable' | 'experimental' | 'disabled' | 'premium'`. Recent precedent (Sprint 82, Sprint 90): ship ON (`status: 'stable'`) with the flag as an un-surfaced kill-switch, per HARD RULE #2. Same pattern applies to `ritemark.updates.mode: 'auto'` default — no Settings UI toggle needed (Sprint 67 removed flag UI from Settings).

## W2 — One-command extension release

### Workstream W2.1 — `scripts/release-extension.sh`
Repairs and wraps `scripts/create-extension-release.sh` rather than replacing it wholesale (preserve the working manifest/feed-generation logic; fix the file-enumeration bug; add the two new preflight checks). Concretely:

1. **New `scripts/release-extension-preflight.sh`**, called first:
   - Clean git tree check.
   - **Release-tier guard (R4):** `git diff --name-only <last-shell-release-tag>..HEAD` (or equivalent ref range) against a path-prefix denylist held as a single array: `patches/`, `vscode` (submodule pointer — shows as a mode/gitlink diff on the `vscode` path itself), `branding/product.json`, `extensions/ritemark/binaries/agents/`, `scripts/build-prod.sh`, `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/apply-patches.sh`, `scripts/update-vscode.sh`, `scripts/create-patch.sh`, **plus two NEW shell-tier paths introduced by sprint-91**: `installer/windows/ritemark.iss`, `scripts/codesign-windows.sh`. Any match → fail with the offending path named. **This array MUST be textually identical to CLAUDE.md's R11 "Release tiers" prose list** — copy-paste, not independently re-derived (single-source-of-truth discipline; see Risks).
   - **`engines.vscode` check (R5):** read `extensions/ritemark/package.json`'s `engines.vscode` (verified: `"^1.94.0"`), compare against the current shell's VS Code version (`vscode/package.json` or `branding/product.json`). Fail if the extension declares a floor higher than what's shipped.
   - Compile clean (`npm run compile` — after sprint-92 lands, this also runs the esbuild bundle), webview bundle fresh + `ai-sidebar` sentinel present (reuse `.claude/hooks/pre-commit-validator.sh`'s Check 5/6 logic rather than reimplementing).
2. **Fix the file-enumeration bug in `create-extension-release.sh` / its `release-extension.sh` wrapper**: replace the hardcoded `FILES` variable with a dynamic enumeration (`find "$EXTENSION_DIR/out" -name '*.js' -not -name '*.map'` plus `media/webview.js`, `media/webview.js.map`, `package.json`). Verify against sprint-92's bundled output (2-3 files) if that sprint has landed, or the current ~130-file tree if not — the enumeration logic is correct either way; only the RESULT SIZE differs.
3. **Version bump check** — verify `extensions/ritemark/package.json` version was already bumped to the `-ext.N` format (script does not bump it itself, matching `release-dmg.sh`'s pattern).
4. **Build** — `npm run compile` + `cd webview && npm run build`.
5. **Package (per-file, NOT zip)** — reuses `create-extension-release.sh`'s existing checksum/manifest-assembly logic (already correct), fed by the fixed dynamic file list from step 2.
6. **Feed generation** — unchanged, already correct: `node scripts/generate-update-feed.mjs --mode extension --manifest <manifest> --version <v> --output <feed>`.
7. **Upload** — `gh release create` (or edit existing) on `jarmo-productory/ritemark-public` with the individual files + regenerated feed (matching `create-extension-release.sh`'s existing "next steps" guidance, which already prints the correct `gh release create ... $OUTPUT_DIR/upload/*` command — this part just needs to actually RUN instead of being printed as a manual next step).

### Workstream W2.2 — `engines.vscode` field
VERIFIED: `extensions/ritemark/package.json` already declares `"engines": { "vscode": "^1.94.0" }`. W2.2 reduces to: confirm the floor stays ≤ the shipped shell's VS Code version (currently 1.117 per `release-manager.md`'s Windows Build Notes context) and wire the preflight check to read it.

## W3 — Claude-Code-style update UX

### Workstream W3.1 — `mode` setting
Add `ritemark.updates.mode` to `extensions/ritemark/package.json`'s EXISTING `"Ritemark Updates"` configuration block (verified at lines 182-197, sibling to `ritemark.updates.enabled`/`ritemark.updates.dismissed`):
```json
"ritemark.updates.mode": {
  "type": "string",
  "enum": ["auto", "prompt"],
  "default": "auto",
  "description": "How extension updates are applied: 'auto' stages silently and relaunches on next start or click; 'prompt' shows the existing install notification."
}
```

### Workstream W3.2 — Background download + stage (R6)
In `updateService.ts`'s `notifyIfNeeded()` (private method, called from `checkForUpdates`), branch on `vscode.workspace.getConfiguration('ritemark.updates').get<string>('mode', 'auto')`:
- `this.lastResolved.action === 'extension'` AND `mode === 'auto'` → skip `showExtensionUpdateNotification` entirely; call `this.installer.applyUpdate(manifest)` directly (bypassing `installExtensionUpdateWithProgress`'s foreground `withProgress` wrapper).
- `action === 'extension'` AND `mode === 'prompt'` → existing notification flow, unchanged.
- `action === 'full'` → always the existing `showFullUpdateNotification` flow regardless of `mode` — `mode` only governs the extension tier (R10).
- Checksum verification and staging-cleanup-on-failure are ALREADY ENFORCED inside `applyUpdate` (`verifyAllChecksums` throws, catch block removes staging) — the silent caller just needs to catch the rejection, log it, and NOT set `pendingRestartVersion` / NOT show the status-bar item. Next periodic check retries naturally (existing 6h interval) — no new retry logic needed.

### Workstream W3.3 — Status-bar item (R7)
New `extensions/ritemark/src/update/updateStatusBar.ts`: a `vscode.StatusBarItem` created once at activation, hidden by default. After a successful silent stage (W3.2), call `show(version)` → text `"$(sync) Ritemark ${version} ready"`, tooltip "Click to relaunch and update", `command: 'ritemark.updates.relaunch'`. Register the command in `extension.ts`: handler is simply `vscode.commands.executeCommand('workbench.action.reloadWindow')` (no confirmation dialog needed — the staged version is ALREADY the active one on disk per `userExtensionInstaller.ts`'s atomic-rename model; "staged" and "installed" are the same step, there's no separate "activate" step short of a reload). Register disposal in `extension.ts`'s subscriptions (existing pattern — verify against how other status-bar items in the codebase are registered, or follow the standard VS Code disposal pattern if this is the first).

### Workstream W3.4 — Apply-on-next-start (R8)
No new code expected for "which version wins" — per the Current State section above, this is (hypothesized, to be confirmed) VS Code core's own standard extension-directory version resolution via `dataFolderName`. Confirm this holds at implementation time by reading the relevant `vscode/` submodule source; document the finding in `tasks.md`. Regression-verify `updateService.ts`'s existing `reconcilePendingRestartVersion()` still correctly clears `pendingRestartVersion` under the NEW silent-stage path (not just the old notification path).

### Workstream W3.5 — Rollback safety (R9)
`cleanupOldVersions()` is dead code today (zero call sites) — this is a greenfield addition, not a bug fix. Add a call site AFTER a new version has successfully activated at least once (not merely staged), keeping N−1 alongside current. **Activation-failure detection is genuinely the hardest sub-problem** — nothing today verifies a staged/installed version actually activates before treating install as terminal-success, and (per the v1.7.1 "Invalid or unexpected token" precedent in the `release` skill) a load-time syntax/module error throws BEFORE `activate()` is ever reached, meaning a simple try/catch inside `activate()` is insufficient. Two candidate approaches (resolve at implementation time, document the choice with a rationale in `tasks.md`):
(a) A "last known good version" marker file written only AFTER a successful `activate()` completes, checked before VS Code resolves the extension path on the NEXT startup — if the newest directory has no marker from a prior run and isn't brand new, treat as failed and prune/deprioritize so the loader falls through to N−1.
(b) Rely on VS Code's own extension-activation-failure surfacing (if it exists in this VS Code version) plus a manual "if Ritemark fails twice in a row, offer rollback" UX prompt as a fallback layer.
If approach (a) requires touching `product.json` or a bootstrap script under `scripts/`, run it back through W2.1's release-tier denylist (R4) — this sprint's own guard should not have been bypassable by its own rollback mechanism. Flag to Jarmo explicitly if this tension surfaces; record the go/no-go in `sprint-plan.md`'s Product Decisions.

## W4 — Process & harness

Pure documentation edits under `.claude/` and `docs/`. Key discipline (carried over from the original draft, still correct): **R11's decision-rule list, R4's guard-script denylist, and R14/R13's agent-doc lists must all describe the SAME set of shell-tier paths** — write R11 first as the canonical prose (now including the two new sprint-91 paths), then make W2.1's guard script and the agent-doc updates reference it rather than re-deriving independently.

`release-manager.md` ALREADY has a "Release Types" table (`| Full Release... | Extension-Only... |`) and a Decision Tree (Sprint 42-era) — R14 EXTENDS this with the asymmetric GATE model (light vs. heavy), it is not a from-scratch addition. Read the existing "Workflow Overview" table (lines 90-124) before editing — the "Extension-only release" section (lines 115-124) already lists 6 steps; R14's job is to make Gate 1/Gate 2 for that path explicitly LIGHT (no notarization/hardening/Windows-CI/repo-toggle referenced), matching the shell path's explicit HEAVY gate language just above it.

## Files touched (indicative — finalize exact paths in tasks.md)

- `scripts/create-extension-release.sh` (fix file enumeration — W2.1) — OR renamed/wrapped as `scripts/release-extension.sh`, decide naming at implementation time and update all cross-references consistently.
- `scripts/release-extension-preflight.sh` (new, W2.1)
- `extensions/ritemark/package.json` (`ritemark.updates.mode` config — W3.1)
- `extensions/ritemark/src/update/updateService.ts` (W3.2, W3.4 regression check)
- `extensions/ritemark/src/update/updateStatusBar.ts` (new, W3.3)
- `extensions/ritemark/src/update/userExtensionInstaller.ts` (W3.5 rollback/cleanup call site)
- `extensions/ritemark/src/extension.ts` (status-bar registration, W3.3; possible activation marker, W3.5)
- `CLAUDE.md` (W4, R11)
- `.claude/skills/release/SKILL.md` (W4, R12 — replace the stale `vsce package` section)
- `.claude/agents/sprint-manager.md` (W4, R13)
- `.claude/agents/release-manager.md` (W4, R14 — extend existing tables, don't duplicate)
- `.claude/agents/qa-validator.md` (W4, R15)
- `docs/development/RELEASING.md` (new, W4, R16)

## Risks

- **R9's rollback mechanism is the least-derisked piece** — flagged explicitly in W3.5; likely needs a short implementation-time research note before coding.
- **Release-tier guard path list (R4) must exactly match R11's documented list, INCLUDING the two paths sprint-91 newly introduced** (`installer/windows/ritemark.iss`, `scripts/codesign-windows.sh`) — a drift here silently reintroduces the exact failure mode this sprint exists to prevent (shipping a shell-tier change as a fast-lane extension release).
- **The dependency on sprint-92 is soft, not hard** (see spec.md Dependency + this doc's W2.1 design note) — if sprint-92 drops scope, W2.1 still ships correctly, just with a longer per-file list. Confirm this framing with Jarmo if it doesn't match his intent for the dependency.
