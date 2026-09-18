# v1.11.0 release closeout

Recorded 2026-09-18 following release skill Step 10.

- **Release worktree:** `.worktrees/release-bb823de525bc`, detached at source commit `bb823de525bc6e96cd34b6513be8405ebe9bd1a7` (tag `v1.11.0`). On disk at closeout: `dist/` 3.8 GB, `VSCode-darwin-arm64/` 1.8 GB, `VSCode-darwin-x64/` 1.9 GB, physical `vscode/` 6.6 GB.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.11.0>, published 2026-09-18T11:56:21Z, `latest` at closeout.
- **CI runs (main@bb823de5):** macOS x64 `35181424280` (artifact `ritemark-darwin-x64`), Windows `35125844155` (artifact `ritemark-windows-installer`). Artifacts are kept 30 days from each run.

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match; see `published-assets.txt`. The versioned `update-feed.json` download was byte-identical to the local `dist/update-feed.json`, and its 1.11.0 entry lists the same hashes and sizes. The build-time sidecars list the same three hashes. The DMG sidecars were written after stapling on this run, so they match as well. Result: every diff empty.

The Windows CI artifact was downloaded to `dist/win-ci/` rather than `dist/`. Its installer is byte-identical to `dist/Ritemark-Setup.exe`, and its sidecar is `dist/win-ci/Ritemark-Setup.sha256.txt`. It also records `source_commit` and `workflow_commit` as `bb823de5`, plus the Store URL. The release skill's 10.1 and 10.2 commands assumed `dist/` for the Windows files and have been corrected.

## 10.2 Evidence kept here

- `published-assets.txt`: GitHub's digest, size and name for each asset.
- `update-feed.json`: the canonical feed as published (SHA-256 `a093d0271f152e0f8672bb5af3c0d0ab686ccce5f56df43e96bcdce0a0a976e1`, 21 releases, v1.10.1 retained).
- `Ritemark-1.11.0-darwin-*.dmg.sha256` and `Ritemark-1.11.0-win32-x64-setup.sha256.txt`: the build-time sidecars.
- `win32-roundtrip/*.json`: results of the Windows standard-user install, registry and uninstall checks (`status: passed`). The CI user named in them is the throwaway account the workflow creates for each run.
- `darwin-arm64-extension-pre-sign.sha256` and `darwin-x64-extension-pre-sign.sha256`: the digests of the extension payload taken before signing, copied from `VSCode-<target>/`.

Left out on purpose:

- The DMGs and the installer. The GitHub Release holds the verified bytes.
- The roundtrip `*.log` files. Their outcomes are in the JSON results, and the full set stays in the Windows CI artifact until it expires.
- `x64-ci/`, which holds only the downloaded tarball.

## 10.3 Clear the build output and re-audit

Pending.
