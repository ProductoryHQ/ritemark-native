# v1.10.1 release closeout

Recorded 2026-09-14 following release skill Step 10. The step was written the same day, in parallel with this closeout, so 10.3 ran before the 10.2 evidence was pushed; nothing else deviates.

- **Release worktree:** `.worktrees/release-23493cef1f4d`, detached at source commit `23493cef1f4d38cd997be5509e057cb75560fb5c` (tag `v1.10.1`), created 2026-09-10. 15.7 GB on disk at closeout: `dist/` 3.2 GB, `VSCode-darwin-arm64/` 2.0 GB, `VSCode-darwin-x64/` 2.1 GB, physical `vscode/` 6.6 GB.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.10.1>, published 2026-09-10T13:36:24Z, still `latest` at closeout.
- **CI runs (main@23493cef):** macOS x64 `34472235343` (artifact `ritemark-darwin-x64`), Windows `34472311244` (artifact `ritemark-windows-installer`). Both artifacts expire 2026-10-10.

## 10.1 Verify published assets

Recomputed SHA-256 and size of the local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` against GitHub's per-asset digests: all four equal, see `published-assets.txt`. The canonical `releases/latest/download/update-feed.json` was byte-identical to the local `dist/update-feed.json`, and its 1.10.1 entry names the same hashes and sizes. The build-time sidecars (`Ritemark-1.10.1-darwin-*.dmg.sha256`, `Ritemark-1.10.1-win32-x64-setup.sha256.txt`, CRLF) name the same three hashes. Result: every diff empty.

## 10.2 Evidence kept here

- `published-assets.txt` — GitHub digest, size and name per asset.
- `update-feed.json` — the canonical feed as published (SHA-256 `7b69d10632ec38a44368a1e96002ed27626e2e9adae2f695cea78d242da13112`).
- `Ritemark-1.10.1-*.sha256`, `Ritemark-1.10.1-win32-x64-setup.sha256.txt` — build-time sidecars.
- `win32-roundtrip/*.json` — the Windows standard-user install, registry and uninstall results (`status: passed`).
- `darwin-arm64-extension-pre-sign.sha256`, `darwin-x64-extension-pre-sign.sha256` — the pre-sign extension payload digests. The `VSCode-<target>/ritemark-extension-pre-sign.sha256` files were cleared before Step 10 existed, so these values are the `extensionPayload.sha256` attestation from each signed app's embedded `ritemark-build-provenance.json`, which `codesign-app.sh` verifies against that pre-sign file before signing. arm64 was read from the installed `/Applications/Ritemark.app` (1.10.1, source `23493cef`, built 2026-09-10T11:27:20Z); x64 was read from the published `Ritemark-x64.dmg` mounted read-only (source `23493cef`, built 2026-09-10T12:09:26Z).

Left out on purpose: the DMGs and the installer (the GitHub Release holds the verified bytes), the 9 MB of `win32-roundtrip-evidence/*.log` (outcomes are in the JSON results; the full set is in the Windows CI artifact until 2026-10-10 and in `~/Ritemark-release-archive/v1.10.1/` on the release Mac), and the empty `x64-ci/`.

## 10.3 Clear the build output and re-audit

`dist/`, `VSCode-darwin-arm64/` and `VSCode-darwin-x64/` were deleted by Jarmo after 10.1 passed (the auto-mode classifier refused the deletion from the agent session). Free disk went from 7.8 GB to 20 GB. Verdict from `node ./scripts/worktree-hygiene.mjs --check`:

```
REVIEW   …/.worktrees/release-23493cef1f4d — verified disposable release worktree ((detached)), 8.4 GiB
```

## 10.4 Removal

Jarmo said go. `node ./scripts/worktree-hygiene.mjs --clean` removed the release worktree together with the two other `REVIEW` entries in the same audit, `/private/tmp/ritemark-tasklist-debug` and `.claude/worktrees/sprint-117-assessment-ec97b2` (both merged into `main`; branches retained). Free disk after removal: 30 GB.
