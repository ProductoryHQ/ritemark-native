# Release Plan — v2.0.1

**Status:** **Shipped** on 2026-10-24 as [v2.0.1](https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.0.1), for the Mac (arm64 and x64) and Windows, from RC1 `7810385d`. The record is in [evidence/closeout.md](../../../releases/v2.0.1/evidence/closeout.md). The Store update (hosting, Free pricing and resubmission) is with the Development manager and Jarmo.

Three fixes:
- OpenCode on the Mac (#523, `e91c3d9a`);
- Home fitting its desk (#525, `67c5d219`);
- the ElevenLabs key Test (#528, `7810385d`).<br>
**Target:** v2.0.1<br>
**GitHub milestone:** v2.0.1 (#523, #525)<br>
**Release type:** a full app release for the Mac and Windows. Every fix is extension-tier by path, but the release is built, gated and notarized as a full release. Jarmo decided: "admin merge 523, teeme 2.0.1 Macile", then "2.0.1 kõigile platvormidele, ElevenLabsi parandusega" (both 23 October, through the Development manager)<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64, and the Microsoft Store<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-23

## Why

- **OpenCode on the Mac.** In 2.0.0, every OpenCode turn on a Mac fails with `listen EINVAL`.
  - The socket that gives OpenCode Ritemark's tools (`RitemarkIpcServer`) had a 105-byte path, and macOS's `sun_path` holds 104 bytes.
  - Node 24, which ships in 2.0 with Electron 43, rejects such a path. Node 22 in 1.14 quietly cut it short, which is why 1.14 worked.
  - #523 shortens the path to `<tmpdir>/rmt-<12 hex>.sock` (70 bytes), falls back to `/tmp` for a long `TMPDIR`, and adds a real listen-and-connect test.
  - Windows uses a named pipe and is not affected.
- **Home.** On a desk under about 730, Home's page was cut off on the right, What moved's Got it with it. That happens beside the AI's sheet, in a smaller window, or zoomed in. Jarmo found it on the shipped 2.0.0 (#525).
- **The ElevenLabs Test.** Microsoft's certification failed the 2.0.0 Store update under 10.1.2.10, because the tester's key got "ElevenLabs rejected this key".
  - The Test asked `GET /v1/user`, which a restricted key cannot read, and ElevenLabs keys are restricted by default.
  - It now asks the endpoint transcription uses, with no audio. The same certification asked for Free pricing (10.8.2), which is a Partner Center change, not a build.

## Scope

| PR | What | Tier |
|---|---|---|
| [#523](https://github.com/ProductoryHQ/ritemark-native/pull/523) | OpenCode's tools socket path under macOS's limit | extension |
| [#526](https://github.com/ProductoryHQ/ritemark-native/pull/526) ([#525](https://github.com/ProductoryHQ/ritemark-native/issues/525)) | Home fits its desk: the page, rows, tiles, What moved's Got it and the path at any desk width (Jarmo: "yes, put the Home fix in 2.0.1", 23 October) | extension |
| The ElevenLabs fix | Settings' Test asks `POST /v1/speech-to-text` with no audio. The missing audio's 400 `invalid_parameters` means the key may transcribe; a 401 `missing_permissions` says to turn on Speech to Text; a reason that names the key (401 `invalid_api_key`, 400 `invalid_api_key_length`) is "rejected". A transcription gives the same guidance. Checked with Jarmo's real keys | extension |
| [#524](https://github.com/ProductoryHQ/ritemark-native/pull/524) | 2.0.1 in the six version files, the notes, the changelog | shell (`branding/product.json` and `installer/windows/ritemark.iss` are shell-tier paths) |

Nothing else. The docs PRs merged since 2.0.0 (#519, #520, #521, #522) are docs only and change no shipped byte.

## The runtimes

They are unchanged from 2.0.0, as a fix release should be: Claude Code 2.1.304 (SDK 0.3.304), Codex 0.163.0 and OpenCode 1.19.3. On 23 October npm's latest were Claude Code 2.1.309, Codex 0.164.0 and OpenCode 1.19.4, for 2.1's runtime review. `check:anthropic-models` runs at Step 0 on the release source.

## The release

The release skill's full sequence, for every platform:

1. The version bump PR (#524), then #526, then the ElevenLabs fix. The Development manager merges each after its check. Main is frozen from the last of them until publication.
2. On main at that commit, before any candidate: `build-macos-x64.yml` and `build-windows.yml` green. The Windows build needs the repository's visibility toggle.
3. The arm64 candidate in a new `create-release-worktree.sh` worktree: `build-prod.sh`, sign, DMG.
4. **Gate 1:** Jarmo's words in the release session. He sends at least one OpenCode turn on the candidate, looks at Home in a narrow window with the AI's sheet open, and does the usual smoke test.
5. x64: the CI artifact extracted and signed with `RITEMARK_RELEASE_COMMIT`, then the DMG. Windows: the installer staged from its CI artifact. **Gate 2:** Jarmo's Rosetta check and the Windows session's run on his PC, in his words.
6. 60 minutes after each DMG at the least, then notarize and staple.
7. The GitHub release v2.0.1 with `Ritemark-arm64.dmg`, `Ritemark-x64.dmg` and `Ritemark-Setup.exe`. The feed is generated with `--existing-feed-url` naming v2.0.0's feed and all three assets.
8. **The Store** (the Development manager, with Jarmo's R2 upload and his word to submit):
   - the installer hosted at `windows/v2.0.1/Ritemark-Setup.exe`;
   - Free pricing in Partner Center;
   - the update resubmitted.
9. The closeout PR: the test checklist, the evidence and the release record.
