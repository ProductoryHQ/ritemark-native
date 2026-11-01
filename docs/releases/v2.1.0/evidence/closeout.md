# v2.1.0 release closeout

- **Release worktree:** `.worktrees/release-7852c9f38fa1`, detached at source commit `7852c9f38fa1e14d8aa5ba7686d1c219fe37b941` (2.1.0 RC4).
- **Release:** https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.1.0, published 27 October 2026, 22:04 UTC. It is still `latest` on 1 November.
- **CI runs:**
  - `build-windows.yml` run 40568939149, success. Its Windows round-trip evidence is in `win32-roundtrip/`; the runner's user folder (`rmci-<run id>`) is the only path in it.
  - `build-macos-x64.yml` run 40568932326, success.
- **10.1, on 1 November 2026:** every blocking check came back empty.
  - Local `dist/` matches GitHub's published digests and sizes for `Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json`.
  - The versioned feed's 2.1.0 entry matches local.
  - `dist/update-feed.json` is byte-identical to the published feed.
  - The staged installer is the CI artifact (`cmp`).
  - `published-assets.txt` is the authoritative published record.
- **Not archived:**
  - `darwin-arm64-extension-pre-sign.sha256`, because `VSCode-darwin-arm64/` was no longer in the worktree on 1 November. The arm64 DMG's published digest above is the record.
  - The DMGs and the installer: the GitHub Release holds the same bytes.
