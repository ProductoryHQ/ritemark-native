# v1.13.0 release closeout

Recorded 2026-10-11, following release skill Step 10.

- **Release worktree:** `.worktrees/release-1abac303d4bb`, detached at source commit `1abac303d4bbebddcdaa0fab1eb647b01370abd3` (tag `v1.13.0`). On disk at closeout: `dist/` 4.0 GB, `VSCode-darwin-arm64/` 1.9 GB, `VSCode-darwin-x64/` 1.9 GB, physical `vscode/` 6.6 GB.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.13.0>, published 2026-10-11T14:20:40Z. It was `latest` at closeout.
- **CI runs (main@1abac303):**
  - macOS x64 `37299068682`, artifact `ritemark-darwin-x64`.
  - Windows `37299072290`, artifact `ritemark-windows-installer`.
  - Windows CI Canary `37319843137`.
  - Artifacts are kept for 30 days from each run.
- **Notarization:** arm64 `df9d4177-b1c6-4363-a0c5-e009c2e80da4` (2026-10-08) and x64 `bbdd8041-8b9a-4bcc-a015-245a28fb93de` (2026-10-11). Both were Accepted and stapled. `stapler validate` passes and Gatekeeper reports `source=Notarized Developer ID` for both DMGs, checked directly rather than from the script's exit code.
- **Store host:** not uploaded. The Windows sidecar names `https://getritemark.com/windows/v1.13.0/Ritemark-Setup.exe`, but the Store submission waits until Microsoft approves 1.12.0. Upload this same installer (SHA-256 below) with `publish-store-installer` when 1.13.0 is submitted.

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match; see `published-assets.txt`.

- The versioned `update-feed.json` download is byte-identical to the local `dist/update-feed.json`, and its 1.13.0 entry lists the same hashes and sizes.
- `releases/latest/download/update-feed.json` served the 1.13.0 feed, byte-identical to the local one.
- The feed has 23 releases. It was seeded from the v1.12.0 feed with `--existing-feed-url`, and v1.12.0 and every older entry are unchanged.
- The installer is byte-identical to the Windows CI artifact in `dist/win-ci/`, and its sidecar hash matches.
- The two DMG sidecars differ from the published DMGs, as expected. They were written before stapling, and stapling changes the bytes.

Result: every blocking diff is empty.

The release stayed a draft while the three binaries uploaded (14:10–14:20 UTC) and became public at 14:20:40Z, when the last one was attached. The feed was uploaded at 14:20:56Z, so for 16 seconds `latest` had no feed. The next release can avoid that window by uploading the feed to the draft before it is made public, as v1.12.0 did.

## 10.2 Evidence kept here

- `published-assets.txt`: GitHub's digest, size and name for each asset.
- `update-feed.json`: the canonical feed as published (SHA-256 `f899be89ce804752d719c2b1304c5955e11ccefed9fb08689bc322b8342d3663`).
- `Ritemark-1.13.0-darwin-*.dmg.sha256` and `Ritemark-1.13.0-win32-x64-setup.sha256.txt`: the build-time sidecars. The DMG ones are pre-staple.
- `win32-roundtrip/*.json`: results of the Windows standard-user install, registry and uninstall checks (`status: passed`, registry entry `Ritemark 1.13.0` by Productory Services OÜ while installed, none after uninstall). The CI user named in them is the throwaway account the workflow creates for each run.
- `darwin-arm64-extension-pre-sign.sha256` and `darwin-x64-extension-pre-sign.sha256`: the digests of the extension payload taken before signing, copied from `VSCode-<target>/`.

Left out on purpose:

- The DMGs and the installer. The GitHub Release holds the verified bytes.
- The roundtrip `*.log` files. Their outcomes are in the JSON results, and the full set stays in the Windows CI artifact until it expires.
- `x64-ci/`, which holds only the downloaded tarball.

## 10.3 Clear the build output and re-audit

Audit on 2026-10-11, before clearing:

```
BLOCKED  .worktrees/release-1abac303d4bb — build output present: VSCode-darwin-arm64/ (2 entries), VSCode-darwin-x64/ (2 entries), dist/ (10 entries) — publish or move it before removing ((detached))
```

## 10.4 Removal

Removal is Jarmo's call.
