# Sprint 98: Safe Extension-Update Lane

Track: Plain full track
Release tier: shell
Branch: `sprint-98-safe-ext-lane` (create immediately after Jarmo approves this plan — no code before that)

## Goal

Make the extension-update fast lane (`-ext.N` releases) safe to reopen after the 1.8.3-ext.1
incident, by shipping four independent safety pieces together in one full release. The lane
stays CLOSED (no more `-ext.N` publishes) until all four pieces are in users' hands and one
deliberately trivial ext update has passed end-to-end in production.

## Incident Context (why this sprint exists)

- Issue #142 (semver floor bug) was fixed in v1.8.3 and validated: 1.8.3-ext.1 genuinely loaded
  from `~/.ritemark/extensions/`.
- But `scripts/release-extension.sh` ships an INCOMPLETE package — only `out/**/*.js`,
  `media/webview.js`, `package.json`. No `node_modules/`, no `themes/`, no `media/*.svg`. The
  update installer replaces the whole extension directory, so the extension died at module load
  (`Cannot find module 'pdfkit'`) BEFORE `activate()` ever ran.
- Because activation never happened, the extension-side rescue mechanisms (in-app updater,
  Sprint 93 R9 `activationIntegrity` quarantine tracker) never got a chance to run either — they
  live inside the same dead extension. Affected users had no remote rescue path.
- Recovery guide for affected users: `jarmo-productory/ritemark-public#1`. The fix shipped as a
  v1.8.4 full DMG (bundled `1.8.4-0` outranks `1.8.3-ext.1`; `cleanupOldVersions` removes the
  broken copy on next successful activation).
- Issue #142 stays OPEN until this sprint's lane-reopen criterion (below) is met with a real
  production ext update.

## Linked Issues

- #142 — extension-update semver floor / safety (stays open until lane reopens end-to-end)
- `jarmo-productory/ritemark-public#1` — incident recovery guide (reference only, not closed by
  this sprint)

## Feature Flag Check

- Does this sprint need a `features/flags.ts` feature flag? NO. `ritemark.updates.channel` is a
  plain user setting (same family as the existing `ritemark.updates.*` settings), not a
  flags.ts-gated feature — it doesn't hide/show a user-visible feature area, it selects an update
  feed URL. No kill-switch semantics needed beyond "don't ship the setting turned on for anyone
  but Jarmo" (default `"stable"`).

## The Four Pieces (design agreed with Jarmo)

### 1. Shell watchdog — patch 012 (SHELL-TIER, sets this sprint's release tier)

A new VS Code patch: when extension id `ritemark.ritemark` FAILS ACTIVATION and the failing copy
was loaded from the USER extensions dir (`~/.ritemark/extensions/...`, not the built-in copy
inside the app bundle), quarantine that user copy (VS Code's own `.obsolete` marker mechanism, or
a rename) and trigger/prompt a reload so VS Code falls back to the bundled built-in extension.

This must work even when the extension is completely dead at module-load time — that is the
entire point of the patch. The extension-side `activationIntegrity` tracker (Sprint 93 R9) cannot
help here because it lives inside the extension that never activated. Candidate hook point:
the extension-host activation-error path (e.g. `mainThreadExtensionService`'s
`$onExtensionActivationError` or equivalent in the shipped VS Code version — confirming the exact
hook is a Phase 1 research task). Keep the patch minimal and scoped to `ritemark.ritemark` only —
must not change behavior for any other/future extension.

Patch rules: `.claude/skills/vscode-development/PATCH-RULES.md`. New patch via
`scripts/create-patch.sh "shell-watchdog"` → `patches/vscode/012-ritemark-shell-watchdog.patch`.

### 2. Copy-then-overlay installer (extension-tier)

Rewrite `applyUpdate` in `extensions/ritemark/src/update/userExtensionInstaller.ts` so the target
directory is never built from downloaded files alone:

1. Locate the running app's BUNDLED (built-in) extension directory.
2. CLONE it into staging — macOS: try APFS clonefile (`cp -c`) for near-zero cost, fall back to
   recursive copy if clonefile fails (non-APFS volume, cross-device, etc.); Windows: recursive
   copy.
3. Overlay the downloaded per-file delta from the manifest on top of the clone.
4. Keep the existing checksum verification + atomic rename (`fs.promises.rename` staging → target)
   unchanged.

Additionally: the manifest already carries `appVersion` / `minimumAppVersion`
(`updateManifest.ts`, `updateFeed.ts`) but nothing currently enforces it in
`userExtensionInstaller.ts` — add an explicit check that refuses to install when the running app
version doesn't satisfy `minimumAppVersion` before touching staging.

Nice-to-have (do if it doesn't expand scope materially): manifest support for explicit file
deletions, so a future release that removes a file from the bundled tree doesn't leave the stale
file behind after overlay.

### 3. Publish-side guards (scripts)

- `scripts/release-extension-preflight.sh` (or `release-extension.sh`) gains a new check:
  **completeness** — every esbuild `external` runtime dependency actually required by the shipped
  `out/extension.js` must already exist in the BUNDLED extension's `node_modules` (the copy that
  ships inside the app / DMG). A NEW npm dependency that isn't in the bundled copy must REFUSE the
  ext release outright (message: "full release required, this dependency isn't in the bundled
  extension"). Also add a manifest-vs-shipped-files sanity check (every manifest file entry
  resolves to a real staged file, no orphans).
- New mandatory pre-publish step: an **install-and-activate smoke test**. Performs the real
  copy-then-overlay install into `~/.ritemark/extensions/` against the locally installed
  production app, launches it, verifies the extension actually ACTIVATES (not just "files landed
  on disk" — the exact class of failure that caused the incident), then cleans up. Publishing is
  BLOCKED if activation fails. This is the single check that would have caught the 1.8.3-ext.1
  incident before it shipped.

### 4. Canary ring (setting + scripts)

- New setting `ritemark.updates.channel`: `"stable"` (default) | `"canary"`, added alongside the
  existing `ritemark.updates.*` block in `extensions/ritemark/package.json` (~lines 186-196).
  `src/update/updateFeed.ts` already parameterizes `fetchUpdateFeed(feedUrl = DEFAULT_UPDATE_FEED_URL)`
  — the channel setting picks which feed URL to pass in. Canary feed URL: a fixed `canary` tag
  release on `jarmo-productory/ritemark-public` whose `update-feed.json` asset is republished with
  `gh release upload --clobber` each time.
- Publish-flow change: ext releases are published as GitHub **prerelease** (never becomes
  `latest`, so the PUBLIC feed at `releases/latest/download/update-feed.json` is untouched by a
  fresh ext publish). The canary feed = current stable feed + the new ext entry, clobbered onto
  the `canary` tag release.
- New `scripts/promote-extension-release.sh <version>`: after Jarmo has run the update on his
  canary-channel machine and confirms it's good, this script merges the ext entry into the PUBLIC
  feed (clobbers `update-feed.json` on the current `latest` release). Supports `--rollback` to
  remove an entry the same way (never deletes a GitHub release — preserves history/download
  counts, direct lesson from the incident, where nobody wanted to lose the withdrawn-but-still
  data-bearing 1.8.3-ext.1 release).

## Sequencing / Release Tier

- Piece 1 (watchdog) touches `patches/` → this sprint is SHELL-TIER as a whole, even though
  pieces 2-4 individually would be extension/scripts-tier. It ships as the next FULL release
  (e.g. v1.8.5): Gate 1 (technical) + Gate 2 (Jarmo tested), notarization, Windows CI.
- Pieces 2-4 ride along in the same full release. They stay DORMANT (no `-ext.N` publish happens)
  until the lane-reopen criterion below is satisfied.

## Lane-Reopen Criterion

The fast lane (`-ext.N` releases from `scripts/release-extension.sh`) stays CLOSED until BOTH:

1. The watchdog (piece 1) has shipped in a full release and is in users' hands (i.e. the shell
   release that contains patch 012 has passed Gate 1 + Gate 2 and been published).
2. One deliberately TRIVIAL ext update (e.g. a single webview string change) has passed the full
   new pipeline end-to-end: publish (prerelease) → canary feed → Jarmo verifies on his
   canary-channel machine → `promote-extension-release.sh` → verified loading correctly from the
   PUBLIC feed on a non-canary machine.

Only after both hold does #142 get closed.

## Success Criteria

- [ ] Patch 012 quarantines a dead user-copy `ritemark.ritemark` extension and falls back to the
      bundled built-in, verified with a hand-crafted broken extension dir that mimics
      1.8.3-ext.1's incomplete file set (missing `node_modules`).
- [ ] `userExtensionInstaller.applyUpdate` produces a COMPLETE extension directory (clone +
      overlay) that activates correctly after an update, verified against a real production app
      install.
- [ ] `minimumAppVersion` is enforced client-side before install proceeds.
- [ ] Release scripts refuse a release when a shipped runtime dependency is missing from the
      bundled extension's `node_modules`.
- [ ] Install-and-activate smoke test is a mandatory, blocking pre-publish step and is proven to
      catch the exact 1.8.3-ext.1 failure mode (missing `pdfkit` et al.) when deliberately
      reproduced.
- [ ] `ritemark.updates.channel` setting exists, defaults to `"stable"`, and correctly switches
      the feed URL used by `fetchUpdateFeed`.
- [ ] Ext releases publish as GitHub prerelease; public `latest` feed is untouched until
      `promote-extension-release.sh` runs.
- [ ] `promote-extension-release.sh` (including `--rollback`) merges/removes a feed entry without
      ever deleting a GitHub release.
- [ ] Lane-reopen criterion met: watchdog shipped + one trivial ext update verified end-to-end in
      production.
- [ ] `docs/development/architecture.md` updated (update subsystem + patch list).
- [ ] CLAUDE.md patch table includes patch 012.
- [ ] `./scripts/apply-patches.sh --dry-run` clean with patch 012 in place.

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `patches/vscode/012-ritemark-shell-watchdog.patch` | Quarantine + fallback on `ritemark.ritemark` activation failure from user extensions dir |
| `userExtensionInstaller.ts` copy-then-overlay rewrite | Clone bundled dir + overlay delta + `minimumAppVersion` enforcement |
| `release-extension-preflight.sh` completeness check | Refuse release on missing bundled runtime dep |
| Install-and-activate smoke test (new script, invoked by `release-extension.sh`) | Blocking pre-publish activation check against the real installed app |
| `ritemark.updates.channel` setting | `stable` \| `canary`, in `extensions/ritemark/package.json` |
| Canary feed publish flow | Ext releases as GitHub prerelease; `canary` tag feed clobbered per publish |
| `scripts/promote-extension-release.sh` | Merge/rollback an ext entry into the public feed, no release deletion |
| `docs/development/architecture.md` update | Update subsystem + patch 012 |
| CLAUDE.md patch table update | Add patch 012 row |

## Implementation Checklist (phases)

### Phase 1: RESEARCH — COMPLETE (findings: [`research.md`](research.md))
- [x] Activation-error hook confirmed: `mainThreadExtensionService.$onExtensionActivationError`
      (`vscode/src/vs/workbench/api/browser/mainThreadExtensionService.ts:82-108`). Module-load
      throws DO reach it (chain traced); `missingExtensionDependency` is `null` for our case.
- [x] `.obsolete` researched → **REJECTED**, use directory rename (correction C1 in research.md).
      The scanner that builds the workbench list never reads `.obsolete`; rename makes the copy
      `isValid=false` and it is filtered out entirely, guaranteeing built-in fallback.
- [x] `cp -c -R` confirmed: macOS **auto-falls back** to `copyfile(2)` when cloning is impossible
      (man page + empirically verified on HFS+). **The plan's explicit fallback branch is
      unnecessary.** Preserves mode bits + symlinks; 200 MB = 0.005 s vs 0.181 s.
- [x] esbuild `external` enumerated (`esbuild.config.mjs:20-26`); `pdfkit` is a STATIC top-level
      require (why the incident was fatal at module load). Completeness check must run against the
      BUILT APP's copy → belongs in a shell-release preflight, not `release-extension-preflight.sh`.
- [x] `gh` semantics confirmed against live repo: prereleases are excluded from `/releases/latest`
      (proven by existing `v1.0.1-beta`); `--clobber` overwrites same-name assets. No `canary` tag
      exists yet.

**Four plan corrections applied — see [`research.md`](research.md) "PLAN CORRECTIONS":**
C1 rename-not-`.obsolete` · C2 gate on `extensionLocation`, never `isBuiltin` (it is mutated to
`true` on a winning user copy) · C3 insert BEFORE the `isDev` early-return or it never fires in
production · C4 `minimumAppVersion` IS already enforced at `updateResolver.ts:52` — the real gaps
are installer-layer enforcement and missing `validateManifest` validation.

### Phase 2: shell watchdog (patch 012) — COMPLETE
- [x] Quarantine + fallback + reload prompt implemented in `$onExtensionActivationError`
      (`mainThreadExtensionService.ts`), inserted BEFORE the `isDev` early-return.
- [x] Scope check: early-returns unless the id is exactly `ritemark.ritemark`.
- [x] Scope check: only quarantines when the failing `extensionLocation` matches an installed
      `ExtensionType.User` copy — the built-in copy is never touched. (Gating on `isBuiltin` would
      have been wrong: `dedupExtensions` rewrites it to `true` on a winning user copy.)
- [x] `patches/vscode/012-ritemark-shell-watchdog.patch` created; `apply-patches.sh --dry-run`
      clean (12/12, 0 conflicts); reverse/re-apply round-trip verified; `compile-check-ts-native`
      and `valid-layers-check` both pass.
- [x] CLAUDE.md patch table updated (12 patches).
- [x] **Dev-mode validation found and fixed a real bug.** The first implementation renamed the
      extension DIRECTORY. In a live dev instance the broken copy was quarantined in ~3 s, but
      VS Code's profile bookkeeping FOLLOWED the rename — `extensions.json` was rewritten to
      `relativeLocation: ritemark-1.8.5-ext.1.quarantined`, which still had a readable
      `package.json`, so the next launch would have scanned and loaded the broken copy again. The
      quarantine did not stick. Fixed by renaming the MANIFEST (`package.json` →
      `package.json.quarantined`) instead: the directory path stays valid so nothing follows it,
      but the copy is unreadable and drops out of the scan. Re-validated end to end (below).

### Phase 3: copy-then-overlay installer — COMPLETE
- [x] Rewrote `applyUpdate` to clone the bundled extension dir into staging before overlay.
- [x] macOS: `cp -c -R` (auto-falls back to copyfile — no explicit fallback branch needed, per Phase 1).
- [x] Windows/other: `fs.promises.cp` recursive copy.
- [x] New util `src/update/bundledExtensionPath.ts` — resolves the BUILT-IN copy from
      `vscode.env.appRoot`, `appRoot`-injectable for tests, validates a readable `package.json`,
      returns `null` (installer fails closed) rather than guessing.
- [x] `minimumAppVersion` enforced at the INSTALLER layer before anything touches disk, and
      validated in `validateManifest`.
- [x] Fixed the `Already installed` short-circuit re-release trap: a structurally broken install
      (no `node_modules`) is now replaced instead of skipped, so a repaired re-release of the same
      version reaches exactly the users who need it.
- [x] Path-traversal containment: `isContainedRelativePath` in `updateManifest.ts` (validation)
      plus `resolveInStaging` in the installer (enforcement) — deliberately not relying on each
      other having run.
- [x] Manifest file deletions via `op?: 'write' | 'delete'` — newly meaningful now that absent
      means "inherited from the bundled copy" rather than "not present".
- [x] `src/update/applyUpdate.test.ts` — 8 tests, registered in `test` and `test:update`. Closes
      the Phase-1 risk that `applyUpdate` had ZERO coverage. Test 1 reproduces the incident shape
      (delta-only manifest) and asserts a complete directory results.

### Phase 4: publish-side guards — COMPLETE
- [x] Completeness check `scripts/check-bundled-extension-complete.sh` — runs against the BUILT
      APP's copy (per Phase 1, the source tree passes trivially), so it is wired into
      `build-prod.sh` after the version floor, NOT into `release-extension-preflight.sh`. Blocking.
      Checks: host entry points, version floor (`X.Y.Z-0`), every esbuild `external` present in
      bundled `node_modules`, static-require sweep over `out/extension.js`, sentinel assets
      (`themes/*.json`, `media/*.svg`, `starter-pack/`, `media/webview.js`).
- [x] `esbuild.config.mjs` now EXPORTS `external` (and only builds when it is the process entry
      point) so the check reads the real array instead of regex-scraping the file.
- [x] Manifest-vs-staged sanity check in `release-extension.sh` (every entry resolves to a staged
      asset, sizes match, no orphan staged files). The `⚠ not found, skipping` branch is now FATAL
      for every required file; `media/webview.js.map` is declared optional (the production webview
      build emits no sourcemap, so it has been silently skipped on every release to date).
- [x] `scripts/ext-install-smoke-test.sh` — clone bundled → overlay manifest delta (honouring
      `op: 'delete'`) → `require()` the result in a bare Node process with `scripts/lib/vscode-stub.js`.
      Temp-dir only, trap-cleaned, never touches `~/.ritemark/` or the installed app. Wired into
      `release-extension.sh` after feed generation, before the ready banner (`set -e` = blocking).
- [x] Incident reproduced with `--skip-clone` against the real 1.8.3-ext.1 staging artifact: exits
      1 on `Cannot find module 'pdfkit'` (thrown from `src/export/v2/pdfHtmlExporter.ts` at module
      load). Same staging dir passes with the clone step. Proof step satisfied.

### Phase 5: canary ring — COMPLETE
- [x] `ritemark.updates.channel` (`stable` | `canary`, default `stable`) added after
      `ritemark.updates.mode` with `enumDescriptions`.
- [x] `feedUrlForChannel()` + `STABLE_UPDATE_FEED_URL` / `CANARY_UPDATE_FEED_URL` exported from
      `updateFeed.ts`; the single production call site (`updateService.ts`) reads the setting and
      passes the resolved URL. Unknown channel values fall back to stable. `UpdateFeed.channel`
      widened to `'stable' | 'canary'` and the degenerate no-op ternary now really parses.
- [x] `release-extension.sh` defaults to `--channel canary` and prints a `gh release create
      --prerelease` command plus the `canary`-tag create/clobber commands. Publication stays
      manual and gated on Jarmo's approval phrase.
- [x] `generate-update-feed.mjs` is channel-aware — each channel reads and writes only its own
      feed (a canary publish can no longer merge into and clobber the stable feed). The canary
      feed is seeded from stable on first generation. `main()` runs only as an entry point so the
      promote script can import `CHANNELS` / `sortByVersionDesc` instead of re-deriving them.
- [x] `scripts/promote-extension-release.sh <version>` with `--rollback`, `--force`, `--dry-run`.
      Merges/removes one `extensionReleases` entry and `gh release upload --clobber`s the feed onto
      the current `latest` release. NEVER deletes a GitHub release in either direction.

### Phase 6: docs + lane reopen
- [ ] Update `docs/development/architecture.md` (update subsystem, patch list).
- [ ] Update CLAUDE.md patch table (row for patch 012).
- [ ] Ship full release containing patch 012 (Gate 1 + Gate 2, notarization, Windows).
- [ ] Publish one trivial ext update through the new pipeline end-to-end (canary → promote →
      verify public).
- [ ] Close #142 once the lane-reopen criterion is met.

## QA Matrix

| Scenario | How to test |
|----------|--------------|
| Watchdog quarantine + fallback | Hand-craft a broken `~/.ritemark/extensions/ritemark-X.Y.Z-ext.N/` dir mimicking 1.8.3-ext.1 (missing `node_modules`), launch app, confirm quarantine + fallback to built-in, confirm app usable |
| Watchdog scope | Confirm patch has no effect on any other extension id |
| Copy-then-overlay installer | Run a real update against the locally installed prod app; confirm resulting dir has full `node_modules`/`themes`/svg assets and the extension activates |
| `minimumAppVersion` enforcement | Craft a manifest with a `minimumAppVersion` above the running app version; confirm install is refused, no staging side effects |
| Completeness check (missing dep) | Add a fake new npm dep not present in bundled `node_modules`; confirm `release-extension-preflight.sh` refuses |
| Install-and-activate smoke test | Deliberately reproduce the 1.8.3-ext.1 file set; confirm the smoke test fails and blocks publish |
| Canary channel | On Jarmo's machine, set `ritemark.updates.channel` = `canary`; confirm it fetches the canary feed URL, not the public one |
| Prerelease isolation | Publish an ext release as prerelease; confirm public `latest` feed is unchanged until promote runs |
| Promote / rollback | Run `promote-extension-release.sh`, confirm public feed gains the entry; run `--rollback`, confirm it's removed; confirm no GitHub release is ever deleted in either direction |
| End-to-end lane reopen | One trivial ext update: publish → canary → Jarmo approves → promote → verify loading on a non-canary machine |

## Sprint Exit: Dev-Mode Self-Validation (MANDATORY — before any handoff to Jarmo)

**Standing rule (Jarmo 2026-07-21):** Claude runs dev mode and validates the sprint's results HIMSELF before telling Jarmo anything is ready. Jarmo must never be the first person to find out the work doesn't run.

1. Launch dev mode: `/rundev` (`./vscode/scripts/code.sh` from project root — serves from `out/`; remember CSS/static assets do not auto-copy from `src/` to `out/`).
2. Drive the running instance and verify the shell watchdog quarantine path, the copy-then-overlay installer producing a complete extension dir, and the update-channel setting. Use the `ritemark-automation` CDP harness for scripted UI verification and screenshots; check the console for errors.
3. Fix whatever fails and re-verify — do not hand over a known-broken build.
4. Only then notify Jarmo: state what was verified, attach/describe evidence (screenshots for UI work), and name exactly what he should look at.

This step sits BEFORE `qa-validator` sign-off and before any release gate. It is not optional and not delegable to Jarmo.

## Risks

- VS Code's activation-error hook may differ across VS Code versions — the patch must be
  re-verified on any future `update-vscode.sh` bump (same class of risk as existing patches).
- APFS clonefile fallback path must be exercised on non-APFS test volumes, not just assumed.
- Smoke test running against a real installed prod app risks corrupting a developer's local
  install if cleanup fails — must be idempotent and side-effect-free on failure.
- Scope creep risk: the four pieces are somewhat independent; keep Phase boundaries so partial
  progress is still individually testable rather than one big-bang integration at the end.
- **(Phase 1)** `applyUpdate` has ZERO test coverage today (`updateService.test.ts` stubs it out);
  the clone+overlay rewrite must land with real tests or it repeats the incident's root cause.
- **(Phase 1)** Feed generation is cumulative-by-fetch and channel-blind
  (`generate-update-feed.mjs:83` fetches the current `latest` feed and merges) — a canary publish
  would clobber the stable feed unless the fetch becomes channel-aware. Phase 5 must handle this.
- **(Phase 1)** The ext lane depends on `scripts/floor-bundled-extension.sh` flooring the bundled
  copy to `X.Y.Z-0` (`build-prod.sh:252`) so `X.Y.Z-ext.N` outranks it in `extensionsUtil.ts:26`.
  If that floor step is ever skipped, every ext update silently stops loading. Worth a preflight
  assertion.

## Status
**Track:** Plain full 6-phase
**Current Phase:** 6 (docs + lane reopen) — Phases 1-5 complete
**Approval Required:** Yes

## Approval
- [x] Jarmo approved this sprint plan (2026-07-21)
