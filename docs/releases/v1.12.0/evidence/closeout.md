# v1.12.0 release closeout

Recorded 2026-09-29, following release skill Step 10.

- **Release worktree:** `.worktrees/release-e5739a32a67b-4`, detached at source commit `e5739a32a67bc2ceba480792ea736ffbf196183b` (tag `v1.12.0`). On disk at closeout: `dist/` 3.9 GB, `VSCode-darwin-arm64/` 1.8 GB, `VSCode-darwin-x64/` 1.9 GB, physical `vscode/` 6.6 GB.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.12.0>, published 2026-09-29T17:16:16Z. It was `latest` at closeout.
- **CI runs (main@e5739a32):**
  - macOS x64 `36412574103`, artifact `ritemark-darwin-x64`.
  - Windows `36412578323`, artifact `ritemark-windows-installer`.
  - Artifacts are kept for 30 days from each run.
- **Notarization:** arm64 `9edc82a0-d49c-4d5f-ab78-9be715d1325e` and x64 `8601ded7-0f8b-43b8-97a0-3873877186f1`. Both were Accepted and stapled, and Gatekeeper reports `source=Notarized Developer ID`.
- **Store host:** the Windows installer was uploaded to `https://getritemark.com/windows/v1.12.0/Ritemark-Setup.exe` under the immutable `windows/` lock on 2026-09-29.
  - Two fresh anonymous downloads matched its size and SHA-256: the repository tool's `verify` and a cookie-less curl GET.
  - The responses were HTTP 200 with no redirects, `application/vnd.microsoft.portable-executable`, and `immutable` caching.

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match; see `published-assets.txt`.

- The versioned `update-feed.json` download is byte-identical to the local `dist/update-feed.json`, and its 1.12.0 entry lists the same hashes and sizes.
- `releases/latest/download/update-feed.json` served the 1.12.0 feed on the first request.
- The installer is byte-identical to the Windows CI artifact in `dist/win-ci/`, and its sidecar hash matches.
- The two DMG sidecars differ from the published DMGs, as expected. They were written before stapling, and stapling changes the bytes.

Result: every blocking diff is empty.

Before publishing, the release was a draft with all four assets attached. Their GitHub digests were checked against the local files before it was made public, so `latest` never pointed at a release without its feed.

## 10.2 Evidence kept here

- `published-assets.txt`: GitHub's digest, size and name for each asset.
- `update-feed.json`: the canonical feed as published (SHA-256 `da87f3a4ac3c9f540a65c9fcfa25e01f9795d084cd791888f92bdba0845cec5a`). It has 22 releases, and v1.11.0 and every older entry are unchanged.
- `Ritemark-1.12.0-darwin-*.dmg.sha256` and `Ritemark-1.12.0-win32-x64-setup.sha256.txt`: the build-time sidecars. The DMG ones are pre-staple.
- `win32-roundtrip/*.json`: results of the Windows standard-user install, registry and uninstall checks (`status: passed`). The CI user named in them is the throwaway account the workflow creates for each run.
- `darwin-arm64-extension-pre-sign.sha256` and `darwin-x64-extension-pre-sign.sha256`: the digests of the extension payload taken before signing, copied from `VSCode-<target>/`.

Left out on purpose:

- The DMGs and the installer. The GitHub Release holds the verified bytes, and getritemark.com holds the installer for the Store.
- The roundtrip `*.log` files. Their outcomes are in the JSON results, and the full set stays in the Windows CI artifact until it expires.
- `x64-ci/`, which holds only the downloaded tarball.

## 10.3 Clear the build output and re-audit

This evidence was pushed first (PR #372). The auto-mode classifier then refused the deletion of `dist/`, `VSCode-darwin-arm64/` and `VSCode-darwin-x64/` from the agent session, as it did for v1.10.1 and v1.11.0, so clearing the output is Jarmo's step.

Audit on 2026-09-29, before clearing:

```
BLOCKED  .worktrees/release-e5739a32a67b-4 — build output present: VSCode-darwin-arm64/ (2 entries), VSCode-darwin-x64/ (2 entries), dist/ (11 entries)
```

## 10.4 Removal

Removal is Jarmo's call.

The same audit lists `.worktrees/store-v1120` (branch `codex/store-v1120`, the Store update's Codex worktree) as `REVIEW`. So `--clean` would remove it too. Do not run `--clean` while that work is in progress.
