---
name: release-process
description: Run the Ritemark release workflow for full app releases and extension-only releases. Use for version bumps, tags, GitHub releases, DMG creation, notarization, Windows/macOS build coordination, and release readiness checks.
---

# Release Process

This skill covers distribution work. Treat releases as scripted operations with explicit gates, not as ad hoc shell sessions.

## Mandatory Release Metadata Rule

A release is not complete when binaries are uploaded. It is complete only when the canonical update feed / release metadata has also been regenerated and published.

Apply this to both:

- full app releases
- extension-only releases

Use the current contract in:

- `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`

## Start Here

From repo root:

```bash
./scripts/release-preflight.sh
```

Do not proceed to version bumps, tags, build, or upload steps until preflight passes.

## Choose Release Type

- Full release: VS Code core changes, branding changes, patch changes, or app bundle distribution.
- Extension-only release: only extension/webview code changes, distributed via update manifest and release artifacts.

## Common Commands

Full release:

```bash
./scripts/build-prod.sh
./scripts/build-prod.sh darwin-x64
./scripts/create-dmg.sh
./scripts/create-dmg.sh x64
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
```

Extension-only release:

```bash
./scripts/create-extension-release.sh X.Y.Z-ext.N
```

## Rules

1. Report preflight status before discussing release readiness.
2. For macOS distribution, notarize the DMG, not the `.app`.
3. Verify notarization before upload.
4. Keep release notes and versioned docs under `docs/releases/`.
5. Regenerate and publish canonical update feed / metadata for every release.
6. For extension-only releases, verify `minimumAppVersion` is correct before upload.
7. Block the release if assets and feed metadata are out of sync.

## Deep References

- `docs/development/release-process/NOTARIZATION.md`
- `.claude/agents/release-manager.md`
- `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`
- `docs/development/analysis/2026-02-03-multi-platform-build.md`
