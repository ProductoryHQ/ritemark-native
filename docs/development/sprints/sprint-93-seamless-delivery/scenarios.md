# Sprint 93: Seamless Extension Delivery — Scenarios (manual QA matrix)

BDD examples. Each maps to a requirement in `spec.md`. Re-cut 2026-07-10 — old S1-S4 (CI de-risk) and S17-S18 (esbuild) removed; remaining scenarios renumbered starting at S1 for this sprint's own scope (old S5-S16 content preserved with corrections, not the old numbers — this is a fresh document, not a mid-sprint edit, so renumbering is appropriate per SDD discipline).

## W2 — One-command extension release

**S1 — Happy-path extension release end-to-end (R3)**
- Given a clean extension-only diff since the last shell release, version bumped in `extensions/ritemark/package.json` to an `-ext.N` value
- When `./scripts/release-extension.sh` runs
- Then: compile succeeds (esbuild bundle if sprint-92 has landed, tsc output otherwise), webview builds, the CURRENT file set is enumerated dynamically (not the old hardcoded list), sha256 + size are computed per file, `generate-update-feed.mjs --mode extension` runs, and the files + updated feed are uploaded to `jarmo-productory/ritemark-public` with `minimumAppVersion` = current shell version

**S2 — Fixed file-enumeration bug: no missing modules (R3, regression against the discovered bug)**
- Given the CURRENT source tree (not the stale hardcoded list `create-extension-release.sh` shipped with)
- When `./scripts/release-extension.sh` runs
- Then the resulting manifest's `files[]` includes every real current `out/**/*.js` file (or, if sprint-92 has landed, the ~2-3 bundled outputs) — verify by diffing the manifest's file-path list against `find extensions/ritemark/out -name '*.js' -not -name '*.map'`
- And installing this release via the update platform does NOT produce a "Cannot find module" activation error (the exact failure class the old stale script would have shipped)

**S3 — Release-tier guard fires when a patch file changed (R4)**
- Given a diff since the last shell release that includes a change under `patches/001-ritemark-branding.patch`
- When `./scripts/release-extension.sh` runs
- Then preflight fails immediately, names `patches/001-ritemark-branding.patch` in the error, and recommends a shell release; nothing is uploaded

**S4 — Release-tier guard fires for each shell-tier path class, INCLUDING the two new sprint-91 paths (R4)**
- Given diffs that individually touch: `vscode/` submodule pointer, `branding/product.json`, a native dependency in `extensions/ritemark/package.json` (if any), `binaries/agents/`, an app-layout script (e.g. `scripts/apply-patches.sh`), `installer/windows/ritemark.iss`, and `scripts/codesign-windows.sh`
- When `./scripts/release-extension.sh` runs against each
- Then preflight fails for all seven, each naming the specific offending path

**S5 — `engines.vscode` compatibility check blocks an incompatible bump (R5)**
- Given `extensions/ritemark/package.json`'s `engines.vscode` set higher than the currently-shipped shell's VS Code version
- When `./scripts/release-extension.sh` runs
- Then preflight fails with a clear "requires newer VS Code than current shell" message

## W3 — Claude-Code-style update UX

**S6 — Update staged then relaunch click (R6, R7)**
- Given `ritemark.updates.mode: "auto"` (default) and a compatible newer extension release published on the feed
- When the periodic check runs (manually trigger via the existing "Check for Updates" command instead of waiting 6h)
- Then no notification/dialog appears; the update downloads and sha256-verifies silently; a status-bar item "Ritemark {version} ready — Relaunch to update" appears
- When the status-bar item is clicked
- Then the window reloads and the new version is active (verify via `getCurrentVersion()` / the About dialog)

**S7 — Update staged then app restart, never clicked (auto-apply) (R8)**
- Given the same staged state as S6, but the status-bar item is never clicked
- When the app is fully quit and relaunched
- Then the new version is active on relaunch with no further user action (confirms VS Code core's own extension-directory version resolution, per technical-plan.md's hypothesis — this scenario is also the verification step for that hypothesis)

**S8 — sha256 mismatch aborts and retries next cycle (R6, R9 adjacent)**
- Given a feed entry whose file `sha256` deliberately does not match the actual asset bytes (fixture)
- When the background download runs
- Then the update is aborted (existing `verifyAllChecksums` throw + `removeDir(stagingTarget)` cleanup — no new code needed for this half), nothing is staged/activated, no partial/corrupt version directory is left under `~/.ritemark/extensions/`, and the next periodic check attempts again (no permanent "stuck" state)

**S9 — Incompatible `minimumAppVersion` produces a blocked-update message (existing `updateResolver.ts` behaviour, re-verified under the new UX) (R6)**
- Given a feed extension release whose `minimumAppVersion` is newer than the current app version
- When the periodic check runs
- Then `resolveUpdate()` returns `action: 'blocked'`, no background download is attempted, and (if the user does a manual check) the existing blocked-reason message is shown — unchanged from pre-sprint behaviour, confirming R6's background path only engages for actually-compatible releases

**S10 — Failed activation rolls back to N−1 (R9)**
- Given a staged version whose activation deliberately throws (fixture: syntactically valid but intentionally-broken `extension.js`/`out/extension.js` in the staged directory, mirroring the v1.7.1 "Invalid or unexpected token" precedent)
- When the app starts and attempts to activate the newest version directory
- Then the extension host falls back to the previous (N−1) version directory, Ritemark activates successfully on N−1, and the failure is reported (not silently swallowed)
- **Platform note (intentionally verified on macOS only for this launch):** `quarantineVersion()` deletes the currently-loaded version's own on-disk directory while the extension host still has it loaded in memory. This is safe because Node has already read those files into memory and closed the handles by the time `activate()` runs — plausible on both macOS and Windows, but only exercised on macOS for v1.8.2. If a future Windows user reports a locked-file/EPERM error on rollback, that's the case to revisit (matching the project's existing pattern for niche, hard-to-fixture edge cases). Extension-tier ships without Windows CI, so this is verified empirically rather than gated.

**S11 — `cleanupOldVersions` only fires after confirmed activation, keeping exactly N + N−1 (R9)**
- Given a successful update + restart + confirmed activation of the new version
- When cleanup logic runs
- Then exactly TWO `ritemark-*` directories remain under `~/.ritemark/extensions/` (current + N−1), not one (which would have been the bug if `cleanupOldVersions(keepVersion)`'s existing behavior — delete everything except one — were wired in naively) and not three or more (stale accumulation)

**S12 — `mode: "prompt"` preserves today's notification flow (R10)**
- Given `ritemark.updates.mode: "prompt"`
- When a compatible extension update is found
- Then the existing 4-button notification (`showExtensionUpdateNotification`) appears exactly as before this sprint — no background staging, no status-bar item

**S13 — Full-app updates unaffected by `mode` (R10 boundary)**
- Given a feed `fullReleases` entry newer than the current app version
- When the periodic check runs, regardless of `ritemark.updates.mode`
- Then the existing `showFullUpdateNotification` flow runs unchanged (background staging is extension-tier only)

## W4 — Process & harness (documentation-verification scenarios)

**S14 — sprint-manager declares a release tier (R13)**
- Given the updated `sprint-manager.md`
- When a new sprint plan is drafted touching only `extensions/ritemark/src/`
- Then the generated `sprint-plan.md` includes a `Release tier: extension` line with no shell-tier justification needed

**S15 — release-manager routes an extension release through the light gate (R14)**
- Given the updated `release-manager.md`
- When an extension-only release is requested
- Then the agent's documented workflow shows a single light gate (Jarmo tests via the in-app "Relaunch to update" flow + approval phrase) with no notarization/hardening/Windows-CI steps referenced, while the pre-existing full-release Workflow Overview table is UNCHANGED (extension only)

**S16 — `release` skill's extension procedure replaces the stale `vsce package` text (R12)**
- Given the updated `.claude/skills/release/SKILL.md`
- When reading the "Extension Release" section
- Then it documents the actual per-file manifest mechanism (`release-extension.sh` → dynamic file enumeration → manifest → feed) with NO reference to `vsce package` (a mechanism this codebase never actually uses)

## Intentionally-untested / accepted limitations

- Real Apple notarization / Windows SmartScreen behavior for extension-tier releases — not applicable, extension tier ships individual files + a feed entry, no OS-level installer trust prompt to test.
- Multi-hop version skew (extension release N applying on top of shell version N−2) — explicitly out of scope per the Product Decision in `sprint-plan.md` (latest-shell-only support; also already enforced structurally by `generate-update-feed.mjs`'s per-`appVersion` de-duplication, see technical-plan.md).
- Confirming VS Code core's exact extension-directory version-resolution source (R8's hypothesis) against live `vscode/` submodule source is a Phase 3 read-the-code task, not a scenario — S7 is the BEHAVIORAL verification, not a code-reading exercise.
