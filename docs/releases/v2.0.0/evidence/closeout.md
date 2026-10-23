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

After 10.1 and this archive were pushed (`8a60cb3e`, PR #520), the build output was deleted by name in the release worktree on 2026-10-23: `dist/` (4.5 GB), `VSCode-darwin-arm64/` (2.2 GB) and `VSCode-darwin-x64/` (1.9 GB). The disk went from 12 to 19 GiB free. Then `node ./scripts/worktree-hygiene.mjs --check --no-sizes` from the main checkout:

```
REVIEW   …/.worktrees/release-c04eabf2fe02 — verified disposable release worktree ((detached))
```

It is the only `REVIEW` entry in that audit, so `--clean` would remove only this worktree. Removing it is Jarmo's call (10.4).

## 10.4 Remove the release worktree

Jarmo, in the release session on 2026-10-23, after #520 merged (`36bf2193`): "clean the release worktree". `--clean` removes every `REVIEW` entry. By then the audit had two more, this session's own worktree and #519's, so the run kept them out:
- it ran with `--repo` on this session's worktree, which counts as current and is never removed;
- #519's worktree (`ritemark-native-wt-keyfeatures`) was locked, and a `--check` showed the release worktree as the only `REVIEW` entry.

Then `node ./scripts/worktree-hygiene.mjs --clean --no-sizes`:

```
REMOVED  …/.worktrees/release-c04eabf2fe02
Stale worktree metadata pruned. Branches were intentionally retained.
```

#519's worktree was unlocked straight afterwards. The disk went from 19 to 30 GiB free.

## The issue sweep (Step 9)

On 2026-10-23 every issue on the v2.0.0 milestone was checked against what 2.0.0 shipped and its QA evidence: #459, #471, #475, #477, #480, #482 and #485–#488 (all from #490, with #491 for #477). All ten were closed with a comment naming v2.0.0, and the milestone was closed with all 11 issues closed (#493, the Windows update blocker that #494 fixed, was closed on 21 October). The comments say what was not run on screen (#459's and #482's signed-out views, #471's planted-change dry run) and name the follow-ups for 2.1: #508 (a restored card tab's name, from #477) and #496 (which plans work, from #482). No other open issue was resolved by 2.0.0: of the issues the merges since v1.14.0 mention, only #107 (bundle size) and #139 (shell auto-update) are still open, and neither is done.
