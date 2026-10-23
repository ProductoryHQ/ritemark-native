# v2.0.0 release closeout

Recorded 2026-10-23, following release skill Step 10.

- **Release worktree:** `.worktrees/release-c04eabf2fe02`, detached at source commit `c04eabf2fe02648bb872c6f65b6645ac5a2009f2` (#500, the version bump), created by `create-release-worktree.sh` (RELEASE SOURCE VERIFIED). Main was frozen from #500's merge until this closeout.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.0.0>, published 2026-10-23T04:56:43Z on Jarmo's "publish - lets go live" in the release session. It was `latest` at closeout.
- **CI runs (main@c04eabf2):**
  - macOS x64 `39598843953`, artifact `ritemark-darwin-x64`.
  - Windows `39598992733`, artifact `ritemark-windows-installer`. It was the first release build with #494's update check: v1.14.0 then 2.0.0, nothing left behind, the app starts after both.
  - Artifacts are kept for 30 days from each run.
- **Notarization:**
  - arm64 `b9506d94-fce5-4ff2-96f7-27b04a122422` (21 October, after Gate 1 and the 60-minute hardening wait).
  - x64 `a11f044b-a542-4d4c-bfaa-7e775dc041a6` (21 October, after Jarmo's x64 approval, 161 minutes after the DMG).
  - Both Accepted and stapled. `stapler validate` passes, and `spctl` reports `source=Notarized Developer ID` for both DMGs, checked directly rather than from the script's exit code.
- **Gates, in Jarmo's own words in the release session:**
  - Gate 1, arm64: "gate 1 approved" (21 October), after his test of RC1 on his own Mac. #503 and #504 are 2.1 by his call.
  - Gate 2, x64 under Rosetta: "rosetta - approved" (21 October).
  - Gate 2, Windows: "windows approved" (22 October), after the Windows session's run on his PC passed every item it ran.
- **DMGs:** made with the `ditto` + `hdiutil` fallback (`create-dmg` cannot drive Finder from a non-interactive session, -1743), and signed with the Developer ID identity hash.
- **Store:** the same installer was hosted at `https://getritemark.com/windows/v2.0.0/Ritemark-Setup.exe` on 22 October, and the Store update was submitted on 23 October, about 05:24Z. Partner Center shows it as in review (`docs/microsoft-store-submission/evidence/`).

## Candidates

The published build is the first and only candidate (RC1).

| Source | Outcome |
|---|---|
| `8052a182` | The dress rehearsal (Sprint 136, E3), never signed or released. It found the file watcher stall fixed by #491. Windows round 5 on its installer found the update over 1.14 failing, fixed by #494, and three faults fixed by #495. |
| `c04eabf2` | RC1, published. |

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match (`published-assets.txt`).

- The per-version feed is byte-identical to `dist/update-feed.json`, and its 2.0.0 entry names the three published hashes. The feed has 25 entries: v1.14.0's 24 are kept.
- The staged installer is the CI artifact (`cmp`).
- The DMG sidecars `*.dmg.sha256` hold the pre-staple hashes. That's expected, because stapling changes the bytes. The Windows sidecar matches.

## 10.3 Clear the build output

To be recorded after the clear.
