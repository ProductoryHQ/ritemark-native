# Release Plan — v2.0.1

**Status:** **Feature complete; release candidate next.** The one fix is merged (#523, `e91c3d9a`), and the version bump to 2.0.1 is the last merge before the candidate. Main is frozen from that merge until publication.<br>
**Target:** v2.0.1<br>
**GitHub milestone:** v2.0.1 (#523)<br>
**Release type:** a full app release for the Mac only. #523 is extension-tier by path, but the release is built, gated and notarized as a full release, as Jarmo decided ("admin merge 523, teeme 2.0.1 Macile", 23 October, through the Development manager)<br>
**Platforms:** darwin-arm64, darwin-x64. Windows stays on 2.0.0<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-23

## Why

In 2.0.0, every OpenCode turn on a Mac fails with `listen EINVAL`. The socket that gives OpenCode Ritemark's tools (`RitemarkIpcServer`) had a 105-byte path, and macOS's `sun_path` holds 104 bytes. Node 24, which ships in 2.0 with Electron 43, rejects such a path. Node 22 in 1.14 quietly cut it short, which is why 1.14 worked. #523 shortens the path to `<tmpdir>/rmt-<12 hex>.sock` (70 bytes), falls back to `/tmp` for a long `TMPDIR`, and adds a real listen-and-connect test. Windows uses a named pipe and is not affected.

## Scope

| PR | What | Tier |
|---|---|---|
| [#523](https://github.com/ProductoryHQ/ritemark-native/pull/523) | OpenCode's tools socket path under macOS's limit | extension |
| The version bump | 2.0.1 in the six version files, these notes, the changelog | shell (`branding/product.json` and `installer/windows/ritemark.iss` are shell-tier paths) |

Nothing else. The docs PRs merged since 2.0.0 (#519, #520, #521, #522) are docs only and change no shipped byte.

## The runtimes

They are unchanged from 2.0.0, as a fix release should be: Claude Code 2.1.304 (SDK 0.3.304), Codex 0.163.0 and OpenCode 1.19.3. On 23 October npm's latest were Claude Code 2.1.309, Codex 0.164.0 and OpenCode 1.19.4, for 2.1's runtime review. `check:anthropic-models` runs at Step 0 on the release source.

## The release

The release skill's full sequence, for the Mac only:

1. The version bump PR (this file, the notes, the changelog). The Development manager merges it after its check. Main is frozen from then until publication.
2. `build-macos-x64.yml` green on main at the bump's commit, before any candidate. No Windows build and no visibility toggle.
3. The arm64 candidate in a new `create-release-worktree.sh` worktree: `build-prod.sh`, sign, DMG.
4. **Gate 1:** Jarmo's words in the release session. He sends at least one OpenCode turn on the candidate, plus the usual smoke test.
5. x64: the CI artifact extracted and signed with `RITEMARK_RELEASE_COMMIT`, then the DMG. **Gate 2:** Jarmo's Rosetta check, in his words.
6. 60 minutes after each DMG at the least, then notarize and staple.
7. The GitHub release v2.0.1 with `Ritemark-arm64.dmg` and `Ritemark-x64.dmg` only. The feed is generated with `--existing-feed-url` naming v2.0.0's feed and darwin assets only, so Windows keeps resolving to 2.0.0. The Store is not touched.
8. The closeout PR: the test checklist, the evidence and the release record.

**Known side effect:** with v2.0.1 as `latest` and no installer on it, `releases/latest/download/Ritemark-Setup.exe` returns 404. The app's updater is not affected, because the feed names v2.0.0's installer by its own URL. The website's Windows button goes to the Store.
