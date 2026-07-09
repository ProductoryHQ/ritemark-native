# Sprint 91 — Scenarios (manual QA matrix)

BDD examples. Each maps to a requirement in `spec.md`. Fixtures (sample feed JSON, sample zips) live
in `./fixtures/` (created during implementation, mirroring the sprint-90 pattern).

## W1 — CI / pipeline de-risk

**S1 — Windows/macOS-x64 CI no longer fires on tag push (R1)**
- Given `build-windows.yml` and `build-macos-x64.yml` updated to `workflow_dispatch`
- When a release tag (`vX.Y.Z`) is pushed
- Then neither workflow starts a run (verify via `gh run list` immediately after the tag push)

**S2 — Manual dispatch still runs the full build (R1)**
- Given the updated workflows
- When `gh workflow run build-windows.yml -f ref=main` is invoked
- Then the workflow runs end-to-end exactly as it did under the old tag trigger

**S3 — Canary detects a broken runner image (R2)**
- Given the weekly canary workflow on `windows-latest`
- When the underlying runner image ships an incompatible VS/toolchain change (simulate by re-running
  the canary against a commit predating the Layer 1 node-gyp fix)
- Then the canary job fails with a clear log signal (node-gyp / `preinstall.ts` error), NOT a silent
  pass, and does so on a free public runner without a repo-visibility toggle

**S4 — Canary is slim, not a full build (R2)**
- Given the canary workflow definition
- When inspecting its steps
- Then it performs ONLY dependency-install / native-module-build steps and does not attempt
  `gulp vscode-win32-x64-min` or any packaging step

## W2 — One-command extension release

**S5 — Happy-path extension release end-to-end (R3)**
- Given a clean extension-only diff since the last shell release, version bumped in
  `extensions/ritemark/package.json`
- When `./scripts/release-extension.sh` runs
- Then: compile succeeds, webview builds, a zip is produced excluding `binaries/agents/`, sha256 +
  size are computed, `generate-update-feed.mjs --mode extension` runs, and the zip + updated feed are
  uploaded to `jarmo-productory/ritemark-public` with `minAppVersion` = current shell version

**S6 — Release-tier guard fires when a patch file changed (R4)**
- Given a diff since the last shell release that includes a change under `patches/001-ritemark-branding.patch`
- When `./scripts/release-extension.sh` runs
- Then preflight fails immediately, names `patches/001-ritemark-branding.patch` in the error, and
  recommends a shell release; no zip is built, nothing is uploaded

**S6b — Release-tier guard fires for each other shell-tier path class (R4)**
- Given diffs that individually touch: `vscode/` submodule pointer, `branding/product.json`, a native
  dependency in `extensions/ritemark/package.json`, `binaries/agents/`, and an app-layout script
- When `./scripts/release-extension.sh` runs against each
- Then preflight fails for all five, each naming the specific offending path

**S7 — `engines.vscode` compatibility check blocks an incompatible bump (R5)**
- Given `extensions/ritemark/package.json`'s `engines.vscode` set higher than the currently-shipped
  shell's VS Code version
- When `./scripts/release-extension.sh` runs
- Then preflight fails with a clear "requires newer VS Code than current shell" message

## W3 — Claude-Code-style update UX

**S8 — Update staged then relaunch click (R6, R7)**
- Given `ritemark.updates.mode: "auto"` (default) and a compatible newer extension release published
  on the feed
- When the periodic check runs (manually trigger via the existing "Check for Updates" command instead
  of waiting 6h)
- Then no notification/dialog appears; the update downloads and sha256-verifies silently; a status-bar
  item "Ritemark {version} ready — Relaunch to update" appears
- When the status-bar item is clicked
- Then the window reloads and the new version is active (verify via About dialog / `getCurrentVersion()`)

**S9 — Update staged then app restart, never clicked (auto-apply) (R8)**
- Given the same staged state as S8, but the status-bar item is never clicked
- When the app is fully quit and relaunched
- Then the new version is active on relaunch with no further user action

**S10 — sha256 mismatch aborts and retries next cycle (R6, R9 adjacent)**
- Given a feed entry whose file `sha256` deliberately does not match the actual asset bytes (fixture)
- When the background download runs
- Then the update is aborted, nothing is staged/activated, no partial/corrupt version directory is
  left under `~/.ritemark/extensions/`, and the next periodic check attempts again (no permanent
  "stuck" state)

**S11 — Incompatible `minAppVersion` produces a blocked-update message (existing `updateResolver.ts`
behaviour, re-verified under the new UX) (R6)**
- Given a feed extension release whose `minimumAppVersion` is newer than the current app version
- When the periodic check runs
- Then `resolveUpdate()` returns `action: 'blocked'`, no background download is attempted, and (if
  the user does a manual check) the existing blocked-reason message is shown — unchanged from
  pre-sprint behaviour, confirming R6's background path only engages for actually-compatible releases

**S12 — Failed activation rolls back to N−1 (R9)**
- Given a staged version whose activation deliberately throws (fixture: syntactically valid but
  intentionally-broken `extension.js` in the staged directory)
- When the app starts and attempts to activate the newest version directory
- Then the extension host falls back to the previous (N−1) version directory, Ritemark activates
  successfully on N−1, and the failure is reported (not silently swallowed)

**S13 — `mode: "prompt"` preserves today's notification flow (R10)**
- Given `ritemark.updates.mode: "prompt"`
- When a compatible extension update is found
- Then the existing 4-button notification (`showExtensionUpdateNotification`) appears exactly as
  before this sprint — no background staging, no status-bar item

**S14 — Full-app updates unaffected by `mode` (R10 boundary)**
- Given a feed `fullReleases` entry newer than the current app version
- When the periodic check runs, regardless of `ritemark.updates.mode`
- Then the existing `showFullUpdateNotification` flow runs unchanged (background staging is
  extension-tier only)

## W4 — Process & harness (documentation-verification scenarios)

**S15 — sprint-manager declares a release tier (R13)**
- Given the updated `sprint-manager.md`
- When a new sprint plan is drafted touching only `extensions/ritemark/src/`
- Then the generated `sprint-plan.md` includes a `Release tier: extension` line with no shell-tier
  justification needed

**S16 — release-manager routes an extension release through the light gate (R14)**
- Given the updated `release-manager.md`
- When an extension-only release is requested
- Then the agent's documented workflow shows a single light gate (Jarmo installs + tests + approval
  phrase) with no notarization/hardening/Windows-CI steps referenced

## W-D — ARCH-105 esbuild bundling (if not dropped)

**S17 — Bundled extension host boots cleanly (R18)**
- Given `extensions/ritemark/out/` is now an esbuild bundle
- When a full prod build (`build-prod.sh`) runs and the app launches
- Then Ritemark activates with no `Cannot find module` / `Invalid or unexpected token` errors, and all
  existing manual regression surfaces (editor loads, AI sidebar loads, Settings loads) behave as
  before this sprint

**S18 — Windows EMFILE class is closed (R18)**
- Given the bundled extension host
- When the Windows CI packaging step that previously risked EMFILE (many discrete `out/` files) runs
- Then file-handle count during the copy/package step drops substantially (qualitative check: no
  EMFILE errors across at least one full Windows CI run post-bundling)

## Intentionally-untested / accepted limitations

- Real Apple notarization / Windows SmartScreen behavior for extension-tier releases — not applicable,
  extension tier ships unsigned-zip, no OS-level installer trust prompt to test.
- Multi-hop version skew (extension release N applying on top of shell version N−2) — explicitly out
  of scope per Product Decision D2 (latest-shell-only support).
- Exact esbuild chunk-splitting strategy performance tuning (R18) — functional correctness (S17/S18)
  is the bar this sprint; bundle-size micro-optimization is not.
