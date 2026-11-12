# v2.2.0 release closeout

- **Release worktree:** `.worktrees/release-d08d0c53110d`, detached at source commit `d08d0c53110dccb7e2ee480f4c2771ef5ac89e2e`. Tag `v2.2.0` (annotated) points at it.
- **Release:** https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.2.0, published 11 November 2026 at 19:02:57 UTC, on Jarmo's "jah, lähme live'i". It is `latest`.
- **CI runs:**
  - `build-windows.yml` run 42585270616, success. Its Windows round-trip evidence is in `win32-roundtrip/`; the runner's user folder (`rmci-<run id>`) is the only path in it.
  - `build-macos-x64.yml` run 42585266003, success.
- **10.1, on 12 November 2026:** every blocking check came back empty.
  - Local `dist/` matches GitHub's published digests and sizes for `Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json`. On 11 November, before the feed was uploaded, the three binaries were also downloaded back and hashed, because GitHub's digest was still `null` then.
  - The versioned feed's 2.2.0 entry matches local.
  - `dist/update-feed.json` is byte-identical to the published feed.
  - The staged installer is the CI artifact (`cmp`).
  - `published-assets.txt` is the authoritative published record.
- **The hashes that passed the gates** are in `../TEST-CHECKLIST.md`'s candidate table, un-notarized and published side by side, as 2.1's closeout asked. The `*.dmg.sha256` sidecars here carry the stapled, published hashes, because the release session rewrote them after each staple.
- **Windows hosting:** Jarmo uploaded the installer to `https://getritemark.com/windows/v2.2.0/Ritemark-Setup.exe` on 11 November (R2 last-modified 19:05:24 UTC). The manager downloaded it again: 559,320,800 bytes, SHA-256 `3b290edd…464e`, the same file as the release asset.
- **Microsoft Store:** the update draft (package URL v2.2.0, What's new, certification notes, one description sentence and one product feature) was prepared on 12 November. It is recorded in ritemark-dev `releases/v2.2.0/store-listing.md`. Submit is on Jarmo's "jah, kui roheline siis submit", once package validation is green.
- **Gate results and deferrals:** `gate-results.md` and `../TEST-CHECKLIST.md`.
- **Not archived:** the DMGs and the installer, because the GitHub Release holds the same bytes.
- **10.3:** not done yet. Clearing `dist/`, `VSCode-darwin-arm64/` and `VSCode-darwin-x64/` waits for this evidence on `origin` and for Jarmo's word. Removing the worktree itself is Jarmo's step.
