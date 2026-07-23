# Sprint 98 Tasks — Safe Extension-Update Lane

Branch: `sprint-98-safe-ext-lane` (create before any code edit, after plan approval)

## Phase 0: Branch
- [ ] `git checkout -b sprint-98-safe-ext-lane` (off `main`)
- [ ] `git branch --show-current` confirms `sprint-98-safe-ext-lane`

## Phase 1: Research
- [ ] Identify exact VS Code extension-host activation-error hook for the shipped VS Code version
- [ ] Confirm `.obsolete` marker mechanism vs plain rename for quarantine
- [ ] Verify APFS clonefile (`cp -c`) success + fallback behavior
- [ ] Verify Windows recursive-copy approach
- [ ] Enumerate esbuild `external` deps in `out/extension.js` vs bundled `node_modules` today
- [ ] Confirm `gh release create --prerelease` / `gh release upload --clobber` semantics

## Phase 2: Shell Watchdog (patch 012) — SHELL-TIER
- [ ] `scripts/create-patch.sh "shell-watchdog"` scaffolding
- [ ] Implement quarantine of a failed-activation `ritemark.ritemark` copy loaded from user
      extensions dir
- [ ] Implement fallback/reload to built-in extension
- [ ] Confirm no effect on other extension ids
- [ ] Confirm no effect when the FAILING copy is the built-in (must not quarantine itself)
- [ ] `./scripts/apply-patches.sh --dry-run` clean
- [ ] Manual QA: hand-crafted broken user extension dir (mimic 1.8.3-ext.1) triggers quarantine +
      fallback

## Phase 3: Copy-Then-Overlay Installer
- [ ] `userExtensionInstaller.ts`: locate running app's bundled extension dir
- [ ] Clone bundled dir into staging (macOS `cp -c`, fallback recursive copy)
- [ ] Windows recursive copy path
- [ ] Overlay downloaded manifest files on top of the clone
- [ ] Keep existing checksum verification + atomic rename
- [ ] Enforce `minimumAppVersion` against running app version before staging
- [ ] (Nice-to-have) manifest support for explicit file deletions
- [ ] Update/extend installer unit tests for clone+overlay path
- [ ] Manual QA: real update against locally installed prod app produces a complete, activating
      extension dir

## Phase 4: Publish-Side Guards
- [ ] Completeness check: shipped runtime deps vs bundled `node_modules` in
      `release-extension-preflight.sh`
- [ ] Manifest-vs-shipped-files sanity check
- [ ] New install-and-activate smoke-test script
- [ ] Wire smoke test as a mandatory blocking pre-publish step
- [ ] Reproduce 1.8.3-ext.1 failure mode locally, confirm smoke test catches it
- [ ] Reproduce a missing-new-dependency case, confirm completeness check refuses

## Phase 5: Canary Ring
- [ ] Add `ritemark.updates.channel` setting (`stable` default, `canary`) to
      `extensions/ritemark/package.json`
- [ ] Wire channel setting → feed URL selection
- [ ] Change ext publish flow to `gh release create --prerelease`
- [ ] Canary feed clobber step onto `canary` tag release
- [ ] `scripts/promote-extension-release.sh <version>` (merge entry into public feed)
- [ ] `--rollback` flag (remove entry, never delete release)
- [ ] Manual QA: canary channel fetches canary feed URL on Jarmo's machine
- [ ] Manual QA: prerelease publish does not touch public `latest` feed until promote runs
- [ ] Manual QA: promote / rollback round-trip, no release ever deleted

## Phase 6: Docs + Lane Reopen
- [ ] Update `docs/development/architecture.md` (update subsystem + patch list)
- [ ] Update CLAUDE.md patch table (patch 012 row)
- [ ] Full release ships (Gate 1 + Gate 2, notarization, Windows) containing patch 012
- [ ] Publish one deliberately trivial ext update end-to-end (publish → canary → Jarmo approves →
      promote → verify public)
- [ ] Close #142

## Phase 7: Cleanup (pre-commit / QA)
- [ ] Remove debug code / temp fixtures used for watchdog + smoke-test QA
- [ ] `qa-validator` review recommended before final commit
- [ ] `qa-validator` review recommended again on prod build (Phase 6 gate)
