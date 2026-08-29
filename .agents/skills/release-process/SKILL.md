---
name: release-process
description: Mandatory Ritemark release and distribution workflow. Use for release, publish, ship, deploy, DMG, notarization, GitHub release, update feed, version bump, signing, Windows/macOS build coordination, or release readiness checks. Enforces two hard gates, DMG content verification, notarization, and canonical update-feed publication.
---

# Release Process

This skill is Codex's release-manager guardrail for Ritemark Native. It was adapted from `.claude/agents/release-manager.md` and `.claude/skills/release/SKILL.md`. Do not modify `.claude/**` when using it.

## Prime Directive

Never describe a release as ready unless both gates are cleared:

| Gate | Cleared By | Blocks |
| --- | --- | --- |
| Gate 1 arm64 | automated checks plus Jarmo explicitly approving the signed, unnotarized arm64 DMG | arm64 notarization and multi-platform CI dispatch |
| Gate 2 x64/Windows | automated checks plus Jarmo explicitly approving the signed, unnotarized x64 DMG and verified Windows installer | x64 notarization, tag, GitHub release, and update publication |

If a gate is open, say `RELEASE BLOCKED` and name the missing item.


## DLC Pre-Release Planning Check

Before version bumps, tags, packaging, or release publication, verify the release has reached `Feature complete` or `Release candidate` in the DLC hierarchy:

- `docs/development/releases/vX.Y.Z/release-plan.md` exists.
- GitHub milestone `vX.Y.Z` exists.
- Release plan tracker lists every included sprint and shows merged/deferred status.
- Feature-complete checklist is satisfied or every exception is explicitly deferred.

If these are missing, block release execution with `RELEASE BLOCKED` and ask for release-plan/milestone cleanup before running distribution steps.

## Start Every Release Discussion

Run or require these before version bumps, tags, DMG distribution, GitHub release, or upload:

```bash
gh release list --repo jarmo-productory/ritemark-public --limit 10
./scripts/release-preflight.sh
```

Report latest existing release, next valid version, preflight status, blockers, and warnings. Never suggest or reuse a version that already exists.

## Full Release Workflow

Use this for VS Code core changes, `patches/vscode`, branding, app bundle changes, or any app installer/DMG distribution.

1. Preflight: `./scripts/release-preflight.sh` must pass.
2. Version bump commit: update `branding/product.json` and `extensions/ritemark/package.json`, commit, push. Do not tag yet.
3. Build local arm64 only: `./scripts/build-prod.sh`.
4. Sign and package arm64, but do not notarize yet:

```bash
./scripts/codesign-app.sh
./scripts/create-dmg.sh
```

5. Mount the signed, unnotarized DMG and run signature/content/version/architecture hard checks against the mounted app. Record its hash and build timestamp.
6. Generate `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`.
7. Gate 1: stop and ask Jarmo to install and test the signed, unnotarized arm64 DMG. A Gatekeeper warning is expected; do not notarize until he explicitly approves and at least 60 minutes have elapsed since the DMG build with no new bug. A rebuild resets the clock and approval.
8. After Gate 1 plus the full hardening window, notarize/staple the same arm64 build and verify it:

```bash
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
```

9. Switch the repository private and manually dispatch `build-macos-x64.yml` and `build-windows.yml` against the exact approved source commit. These workflows are `workflow_dispatch`-only; a tag push does not trigger them. Restore the repository to public after the Windows workflow completes.
10. Download the x64 artifact, sign it, create the x64 DMG without notarizing it, and verify the signed Windows installer.
11. Gate 2: Jarmo tests the signed, unnotarized x64 DMG and Windows installer. Complete any release-bound Store/external matrix against the exact Windows hash. Do not notarize x64 until Jarmo approves and at least 60 minutes have elapsed since the x64 DMG build with no new bug.
12. After Gate 2 plus the full hardening window, notarize/staple and verify the x64 DMG.
13. Tag the already-pushed source commit, create the GitHub release, and publish the canonical update feed together only after every release gate is closed.
14. Recommend product-marketer handoff unless the user says to skip.

## DMG Rules

- Use the project scripts. Do not hand-roll or patch around release packaging unless Jarmo explicitly asks.
- `./scripts/create-dmg.sh` is packaging only. The Gate candidate must be Developer ID signed and pass mounted-content checks; notarization/stapling happens only after Jarmo approves that unnotarized build and the 60-minute hardening window elapses.
- Notarize the DMG, not the `.app`.
- If `create-dmg` fails with `/Volumes/... Operation not permitted`, block and report it. Do not silently use `--sandbox-safe`, a plain `hdiutil` fallback, or a non-standard DMG layout.
- Do not call an unsigned, sandbox-safe, locally hacked, or not-yet-approved DMG “ready”. During Gate 1/Gate 2, describe the expected state precisely as “signed, unnotarized test candidate”.

## DMG Hard Checks

Mount the DMG and verify the mounted `Ritemark.app`, not only the source app bundle:

- `Contents/Resources/app/extensions/ritemark` exists.
- `media/webview.js` is greater than 500 KB.
- `out/extension.js` is non-trivial and contains the `resolveCustomTextEditor` sentinel. Since Sprint 92, editor code is bundled into this entrypoint; a standalone `out/ritemarkEditor.js` is neither produced nor required.
- `extensions/ritemark/node_modules` exists and has runtime dependencies; do not strip it.
- `product.json` contains the target `ritemarkVersion`. Do not use `Info.plist CFBundleShortVersionString` as Ritemark version; it is the VS Code base version.
- App and DMG signatures are Developer ID signed, not ad hoc.
- App bundle timestamps are recent, not 1980.

Before human Gate testing, notarization is intentionally absent. After each Gate and 60-minute hardening window, rerun the hard checks plus notarization, staple, and Gatekeeper verification before publication.

If any hard check fails, the DMG is broken and the release is blocked.

## Update Feed Requirement

Every release must regenerate, verify, and publish canonical update metadata with the shipped assets. This applies to full releases and extension-only releases.

Contract: `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`.

Binaries without matching update feed metadata are not a complete release.

## Extension-Only Release

Use only when changes are confined to `extensions/ritemark/`.

1. Bump `extensions/ritemark/package.json` to `X.Y.Z-ext.N`.
2. Build extension and webview.
3. Package `.vsix`.
4. Verify bundle integrity and `minimumAppVersion`.
5. Gate 1: Jarmo tests on a current Ritemark install.
6. GitHub release with `.vsix` and extension-only update metadata.

## Platform Rules

- arm64 macOS builds locally on Apple Silicon.
- x64 macOS comes from GitHub Actions; never cross-compile x64 from arm64.
- Windows comes from GitHub Actions. Before manually dispatching the paid Windows workflow, switch `ProductoryHQ/ritemark-native` private because larger Windows runners are not available on public repos. Switch back after CI finishes.
- Push the version commit before pushing the tag.

## Blocking Output

Use this shape when blocking:

```text
RELEASE BLOCKED
Gate: Pre-flight | Gate 1 | Gate 2 | Update feed | DMG verification
Reason: ...
Fix: ...
```

## Deep References

Read these only when details are needed:

- `.claude/agents/release-manager.md`
- `.claude/skills/release/SKILL.md`
- `docs/development/release-process/NOTARIZATION.md`
- `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`
- `docs/development/analysis/2026-02-03-multi-platform-build.md`
