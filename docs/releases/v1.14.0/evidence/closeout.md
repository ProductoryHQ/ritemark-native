# v1.14.0 release closeout

Recorded 2026-10-15, following release skill Step 10.

- **Release worktree:** `.worktrees/release-ed0b62268637`, detached at source commit `ed0b6226863759da109f396f50dee51226c69468` (tag `v1.14.0`). On disk at closeout: `dist/` 4.1 GB, `VSCode-darwin-arm64/` 1.9 GB, `VSCode-darwin-x64/` 2.0 GB, physical `vscode/` 6.6 GB.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.14.0>, published 2026-10-15T17:32:50Z. It was `latest` at closeout.
- **CI runs (main@ed0b6226):**
  - macOS x64 `38565571713`, artifact `ritemark-darwin-x64`.
  - Windows `38565576037`, artifact `ritemark-windows-installer`.
  - Artifacts are kept for 30 days from each run.
- **Notarization:** arm64 `983d8f18-b689-49d3-9013-bbcc97ce1e50` and x64 `cde319a4-7e72-4315-9da5-564687be1fc8`, both 2026-10-14, after the 60-minute hardening wait. Both were Accepted and stapled. `stapler validate` passes and Gatekeeper reports `source=Notarized Developer ID` for both DMGs, checked directly rather than from the script's exit code.
- **Gates:** Jarmo tested the arm64 DMG and approved on 2026-10-14 ("proceed with 1.14 release. I tested dmg. looks good"). The Windows session ran the Windows Gate 2 list on a real PC against the same installer: everything it could run passed. Live-voice dictation, Codex, OpenCode, network-off and Google consent needed Jarmo and were not run. Findings: #433, #434.
- **Store host:** not uploaded. The Windows sidecar names `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`, but nobody owns Store submissions since #212 closed; that is Jarmo's call. Upload this same installer (SHA-256 below) with `publish-store-installer` when 1.14.0 is submitted.

## Candidates

The published build is the fourth arm64 build attempt and the second tested candidate:

| Source | Outcome |
| --- | --- |
| `98fe6b37` | Built, failed post-build validation: the arm64 app carried the darwin-x64 and win32-x64 whisper folders. Fixed by #427 (`build-prod.sh` copies the extension for its target). |
| `7d8523bf` | Built and signed 46/0, failed `codesign --verify --deep --strict`: 13 `node_modules/.bin` links had become absolute paths. Fixed by #428 (`verbatimSymlinks`, plus a validator check for absolute links). |
| `8b57d362` | RC1. Gate 1 passed; Jarmo's test found three Tasks usability issues, fixed by #431. |
| `ed0b6226` | RC2, published. |

Also fixed during the release: #425 (Windows CI whisper hash check compared CRLF-tainted hashes) and #426 (preflight checked a non-app workflow against app-build rules).

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match; see `published-assets.txt`.

- The versioned `update-feed.json` download is byte-identical to the local `dist/update-feed.json`, and its 1.14.0 entry lists the same hashes and sizes.
- `releases/latest/download/update-feed.json` served the 1.14.0 feed, byte-identical to the local one, on the first try after publishing.
- The feed has 24 releases. It was seeded from the v1.13.0 feed with `--existing-feed-url`, and v1.13.0 and every older entry are unchanged.
- The installer is byte-identical to the Windows CI artifact in `dist/win-ci/`, and its sidecar hash matches.
- The two DMG sidecars differ from the published DMGs, as expected. They were written before stapling, and stapling changes the bytes.

Result: every blocking diff is empty.

This was the first release published draft-first (Step 8, #402): all four assets, the feed included, were uploaded to the draft and their digests checked before it was made public, so `latest` never lacked a feed.

## 10.3 After clearing the build output

This file and the evidence beside it were pushed first. Then `dist/`, `VSCode-darwin-arm64/` and `VSCode-darwin-x64/` were deleted by name. `worktree-hygiene.mjs --check` reclassified the worktree from `BLOCKED` (build output) to `REVIEW — verified disposable release worktree`. Under Jarmo's standing "remove useless worktrees", the worktree itself was then removed with `git worktree remove`.
