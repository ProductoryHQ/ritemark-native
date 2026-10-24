# Ritemark 2.0.1 Test Checklist

> **RC1, published** on 24 October 2026. A fix release with three fixes: OpenCode on the Mac (#523), Home fitting its desk (#525, #526) and the ElevenLabs key Test (#528). It ships for every platform. Results are in [evidence/closeout.md](evidence/closeout.md), and the sign-off table below records the gates in Jarmo's words.

## The candidate

| | |
|---|---|
| Source commit (`origin/main`, #528's merge) | `7810385df7676034f54f7cfa6b6390c5006be28a` |
| Release worktree | `.worktrees/release-7810385df767` (new, RELEASE SOURCE VERIFIED) |
| `main` frozen | from #528's merge until publication |
| CI on that commit | macOS x64 [40079411422](https://github.com/ProductoryHQ/ritemark-native/actions/runs/40079411422) · Windows [40079413435](https://github.com/ProductoryHQ/ritemark-native/actions/runs/40079413435), both green |
| Runtimes | unchanged from 2.0.0: Claude Code 2.1.304, Codex 0.163.0, OpenCode 1.19.3; `check:anthropic-models` OK |

| Platform | Published as | SHA-256 as tested (un-notarized) | DMG built | Notarization, stapled | SHA-256 as published |
|---|---|---|---|---|---|
| macOS arm64 | `Ritemark-arm64.dmg` | `8cd2d0ebfc325babf29f48590e6e2e92686037774236bf5c9a42206719e3c0e9` | 09:49:01Z (47 signed, 0 failed) | `71cce3cf-df7a-4862-8254-e4419ffa8c05` | `6882def3b215080848b277d260be00501c0cbfa1d3aca831e1eef98a70290fa7` (764,872,138 bytes) |
| macOS x64 | `Ritemark-x64.dmg` | `5f6e508a1661023555c8dc1e32a36f9d13ac7657877b382ddafd0869da7d3a23` | 09:52:31Z (48 signed, 0 failed; provenance anchored to `7810385d`) | `e41cb3a5-ecfb-4688-b9ec-22ac2a77b3c1` | `0c88a80afcef89ea5d2412aa1da0e93c8c17d2236b20c11d0b891ca3c882f24f` (742,323,329 bytes) |
| Windows x64 | `Ritemark-Setup.exe` | `29ff7a8f8bddf3d92d5d51d9eeb4f6a7ccd0d0dd297811d4c9ca16c0fe5ef730` | CI | n/a (Productory Services OÜ) | unchanged (532,612,440 bytes) |

## Gate 1 technical: the agent, on the arm64 DMG

The DMG was mounted read-only and started once, hidden, on its own profile, extensions and shared data, with the mock keychain, the test marker and usage data off.

- [x] Fixes in the bundles: `rmt-` socket path, `/v1/speech-to-text`, key-named reasons, `.rh-fit` and the under-440 rule. Arm64 and x64 both
- [x] R3, the base window: 34/34 scenes the same (max 0.15%); More matches the release images. Compared offline after the script's last step failed (fixed in the closeout)
- [x] `frame-geometry.mjs` 34 pass, 0 fail; `project-check.mjs` 6/6
- [x] A document opened, edited and saved to disk
- [x] A Claude turn answered (Done in 4.3s), with no keychain prompt
- [x] ElevenLabs Test with a made-up key: "ElevenLabs rejected this key"
- [x] OpenCode with a made-up OpenRouter key: past the socket to the provider, no `EINVAL`
- [x] OpenCode with Jarmo's Google key (typed by him; the profile was deleted afterwards): Gemini 3.1 Pro answered
- [ ] A ChatGPT (Codex) turn: not run, because a newly signed `codex-app-server` risks keychain prompts on Jarmo's screen

## The fixes, before the candidate

- **#525 Home:** 49 cases in 2.0.0's shell with the fix's extension. Desks of 784, 600, 440 and 360, at 100% and 125%, in Light and Dark. No sideways scroll anywhere. The Experience lead approved, with two changes that are in #526.
- **#528 ElevenLabs:** checked with Jarmo's real keys:

  | Key | ElevenLabs answered | The Test said |
  |---|---|---|
  | Speech-to-Text-only | 400 `invalid_parameters` | valid |
  | made-up, wrong length | 400 `invalid_api_key_length` | rejected |
  | right length, wrong key | 401 `invalid_api_key` | rejected |

## Gate 1: Jarmo, macOS arm64

Asked of him, on his own Mac: an OpenCode turn, Home at a narrow desk with the AI's sheet open, the ElevenLabs Test with his restricted key if willing, and the usual smoke test. Which of these he ran is not recorded; his words: "gate 1 approved".

## Gate 2: macOS x64 (Rosetta) and Windows x64

- **x64:** Jarmo's Rosetta check. "rosetta approved".
- **Windows:** the Ritemark on Windows session's run on Jarmo's PC, relayed by the Development manager, passed item by item:
  - **The installer:** the hash and sidecar match, the signature is valid, and ProductVersion is 2.0.1.
  - **The update over the 2.0.0 RC:** 0 extra and 0 missing files, and About reads 2.0.1, `7810385d`, Electron 43.7.7.
  - **Home:** a 141-character path, at 100% and 125%. Forcing the AI sheet open in a window under about 600 px makes Home scroll sideways; that's for 2.1.
  - **ElevenLabs Test:** valid for the restricted key, rejected for a fake one.
  - **Smoke:** save and reopen, PDF, Word, terminal, Task board and a Claude turn.
  - **Not run:** Codex and OpenCode, because that PC has no sign-in or key.

  "windows approved".

## After publication

- [x] Every published asset matches `dist/`, and the feeds are byte-identical, with 26 entries
- [x] S8 by the app's own `resolveUpdate` on the live feed: 2.0.0 and 1.14.0 are offered 2.0.1 on all three platforms. No live app was used, so no window opened
- [ ] The Store: hosting at `windows/v2.0.1/`, Free pricing and the resubmission, with the Development manager and Jarmo

## Sign-off

| Gate | Platform | Jarmo, in the release session | Notarized + stapled |
|---|---|---|---|
| Gate 1 | macOS arm64 | "gate 1 approved", 24 Oct | `71cce3cf…`, stapled |
| Gate 2 | macOS x64 (Rosetta) | "rosetta approved", 24 Oct | `e41cb3a5…`, stapled |
| Gate 2 | Windows x64 | "windows approved", 24 Oct | n/a |
| Publish | All three, one publication | "lets go live", 24 Oct; published 13:42:52Z | — |
