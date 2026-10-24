# v2.0.1 release closeout

Recorded on 2026-10-24, following the release skill's Step 10.

## The release

- **Release worktree:** `.worktrees/release-7810385df767`, detached at source commit `7810385df7676034f54f7cfa6b6390c5006be28a`. That's #528's merge, the last of the release's four merges (#523, #524, #526, #528). It was created by `create-release-worktree.sh` (RELEASE SOURCE VERIFIED). Main was frozen from #528's merge until publication.
- **Release:** <https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.0.1>, published 2026-10-24T13:42:52Z on Jarmo's "lets go live" and "windows approved" in the release session. It was `latest` at closeout.
- **CI runs (main@7810385d):**
  - macOS x64 `40079411422`, artifact `ritemark-darwin-x64`.
  - Windows `40079413435`, artifact `ritemark-windows-installer`. Its round trip, update from v1.14.0 and app start all passed: staleFiles 0, appStarted true. The repository was private for that build and public again straight afterwards; its one star was lost, as each toggle loses them.
- **Notarization:**
  - arm64 `71cce3cf-df7a-4862-8254-e4419ffa8c05`, after Gate 1 and the 60-minute hardening wait from the DMG's 09:49:01Z.
  - x64 `e41cb3a5-ecfb-4688-b9ec-22ac2a77b3c1`, after Jarmo's x64 approval, more than 60 minutes after its DMG's 09:52:31Z.
  - Both Accepted and stapled. `stapler validate` and `spctl` (`source=Notarized Developer ID`) were checked directly on each DMG.
- **Gates, in Jarmo's own words in the release session:**
  - Gate 1, arm64: "gate 1 approved" (24 October, about 11:02Z).
  - Gate 2, x64 under Rosetta: "rosetta approved" (12:26Z).
  - Gate 2, Windows: "windows approved", after the Windows session's run on his PC. The Development manager relayed that report.
  - Publication: "lets go live".
- **DMGs:** made with the `ditto` + `hdiutil` fallback, because `create-dmg` cannot drive Finder from this session. Signed with the Developer ID identity hash.
- **Store:** the same installer goes to `https://getritemark.com/windows/v2.0.1/Ritemark-Setup.exe` and Partner Center with Free pricing, through the Development manager and Jarmo. That's recorded in `docs/microsoft-store-submission/` when it's done.

## Candidates

| Source | Outcome |
|---|---|
| `0a299477` (#524, the bump) | A release worktree was made; nothing was built. Superseded when Jarmo put the Home fix in 2.0.1. |
| `67c5d219` (#526, Home) | A release worktree was made, and x64 CI was green; nothing was built. Superseded when Jarmo made 2.0.1 a release for every platform with the ElevenLabs fix (#528). |
| `7810385d` (#528) | RC1, published. |

Both superseded worktrees were removed on Jarmo's word ("jah, eemalda see"), by the Development manager with `worktree-hygiene.mjs --clean`.

## The candidate before Gate 1

On 24 October the release session ran the arm64 DMG itself, mounted read-only and started once, hidden, on its own profile:

- **R3, the base window:** all 34 scenes match the baseline, at most 0.15% (the Settings foot); More matches the release images. `frame-screenshots.mjs` failed at its last step, the switch back to Ritemark Light. So the 34 captures were compared offline with the script's own rule: a pixel changes above an RGB difference of 24, and a scene above 0.5%. The script is fixed in this closeout.
- **Frame and project:** `frame-geometry.mjs` 34 pass, 0 fail, 2 skipped; `project-check.mjs` 6/6.
- **A document:** Brief.md opened, a line typed, saved with ⌘S, and the line on disk.
- **Claude:** "harbour", Done in 4.3s, with no keychain prompt.
- **ElevenLabs Test with a made-up key:** "ElevenLabs rejected this key" (400 `invalid_api_key`).
- **OpenCode:**
  - With a made-up OpenRouter key, the turn reached OpenRouter ("User not found") with no `EINVAL`.
  - With Jarmo's Google key, which he typed himself, Gemini 3.1 Pro answered. The socket `rmt-….sock` was held by the candidate's own process.
  - The profile holding his key was deleted afterwards.

## 10.1 Verify published assets

The local `dist/Ritemark-arm64.dmg`, `Ritemark-x64.dmg`, `Ritemark-Setup.exe` and `update-feed.json` were re-hashed (SHA-256 and size) and compared with GitHub's digest for each asset. All four match (`published-assets.txt`).

- **The feeds:** the per-version feed and `latest/download/update-feed.json` are byte-identical to `dist/update-feed.json`. It has 26 entries: v2.0.0's 25 are kept, and 2.0.1 names all three published hashes.
- **The installer:** the staged installer is the CI artifact (`cmp`).
- **The sidecars:** the DMGs' `*.dmg.sha256` hold the pre-staple hashes, which is expected, because stapling changes the bytes. The Windows sidecar matches.
- **The update offer (S8, without a window):** the app's own `resolveUpdate`, run on the live feed, offers 2.0.1 as a full update on darwin-arm64, darwin-x64 and win32-x64, from 2.0.0 and from 1.14.0. Each points to its own asset and size.

## 10.3 Clear the build output

Jarmo uploaded the installer to the Store's host on 2026-10-24 at 15:40Z (`windows/v2.0.1/Ritemark-Setup.exe`, R2 ETag `"780af5fb7990a8eec216798cc632c314"`). The uploader's anonymous re-download matched SHA-256 `29ff7a8f…f730` and 532,612,440 bytes. An anonymous HEAD afterwards returned 200, with the same length and ETag.

10.1 had passed, and this archive was pushed (`c44ab5d4`, PR #536). Then the build output was deleted by name in the release worktree: `dist/` (4.5 GB), `VSCode-darwin-arm64/` (2.2 GB) and `VSCode-darwin-x64/` (1.9 GB). The disk went from 14 to 18 GiB free. Then `node ./scripts/worktree-hygiene.mjs --check --no-sizes`:

```
REVIEW   …/.worktrees/release-7810385df767 — verified disposable release worktree ((detached))
```

The same audit has one more `REVIEW` entry: #523's agent worktree (`.claude/worktrees/agent-a9843017f5935f085`, squash-merged). A plain `--clean` would remove both. Removing the release worktree is Jarmo's call (10.4).
