# Sprint 153: the browser's and the microphone's fixes

Track: Lightweight (two bug fixes, one PR each, no new surface)<br>
Release tier: shell. #658 changes patches 009 and 010 (the browser's context and action bridges) as well as the extension; #656's tier is recorded in its own section below.<br>
**Status:** Under way. #658 is merged (PR #660); #656 is in review as draft PR #661. This plan was written on 5 November 2026, after Codex's review of #660 found that the work had no sprint under 2.2 (AGENTS.md: release-bound work needs one).<br>
**Approval:** the Development manager approved both fixes as one lightweight sprint on 5 November 2026, under Jarmo's 2.2 delegation of 1 November (the manager approves 2.2's plans and starts its sprints until 2.2's RC). Release approval stays Jarmo's.<br>
**Release:** [v2.2.0](../release-plan.md)

## Scope

| Issue | What | PR | Branch |
|---|---|---|---|
| [#658](https://github.com/ProductoryHQ/ritemark-native/issues/658) | With several browser tabs open, the AI's actions go to the wrong tab | [#660](https://github.com/ProductoryHQ/ritemark-native/pull/660) | `fix-658-browser-action-page` |
| [#656](https://github.com/ProductoryHQ/ritemark-native/issues/656) | Transcribe: warn when the microphone gives no sound, before and while recording | [#661](https://github.com/ProductoryHQ/ritemark-native/pull/661) | `fix-656-mic-silence` |

Each fix has its own branch and PR, named after its issue rather than the sprint (both were started as fixes before this plan existed). Each merges on its own Review record.

## #658: the AI's browser actions go to the turn's page

### Goal

Every AI browser action goes to the page its turn was given, by id: never to whichever tab is in front when the action runs, and never by bringing a tab forward.

### Jarmo's rule (5 November 2026)

**An AI action never brings a tab forward or changes what the person sees**, not even one browser tab over another. An input action on a page that isn't in front returns an error at once, and the AI asks the person. Reads keep working.

### What changed

- **The turn's page is the single source.** At the start of a turn the host records its page (`BrowserTurnPage`, one per conversation): the page the turn's browser context came from, or else the browser page in front, none when a document is in front. Every browser tool in the one registry (`src/runtime/ritemarkTools.ts`) sends that page by id, for Claude Code, Codex and OpenCode alike.
- **Patch 010 finds the page by id.** A page that has gone returns "no longer open"; nothing falls back to the active tab. Navigate loads into the turn's page, or opens a new tab that becomes the turn's page when the turn has none.
- **"In front" comes from the editors:** the page's tab is its desk's front tab, the pane is visible, and no other desk (or the AI column) is maximized.
- **Pages the AI wasn't given** are named by id only until the person shares them. Refusals carry `{ pageId, error }` and nothing else.
- **Patch 009:** the context's summary and viewport are read by page id.
- **One step of the browser queue per tool call** (Codex's review, below): reading the turn's page, the action and noting the page it opened run together, so two calls started at the same time can't each open a tab.

### Review rounds

| Round | Reviewer, commit | Found | Fixed in |
|---|---|---|---|
| 1 | Opus/high, `4de8618c` | 1 Important (showing the page brought it over the person's document), 7 minor | `1dc5a251`, with Jarmo's rule |
| 2 | Opus/high, `1dc5a251` | 3 Important (visible was taken as in front; OpenCode's page outlived its turn; refusals passed an unshared page's address and title), 2 minor | `8b590dc4` |
| 3 | Opus/high, `8b590dc4` | 1 Important (a page under a maximized AI column or desk counted as in front), 3 minor | `5137d5ea` |
| 4 | The manager's read of `5137d5ea` (`isPageInFront`, `isGroupShown`) | none | — |
| Codex | Codex, `5137d5ea` | P2: concurrent calls in a turn with no page each opened a tab. P1: no sprint. P1: no release-facing note | The commit after `5137d5ea`: the queue step, this plan, the CHANGELOG line |

### Evidence

`proof-658.txt` (not committed; grepped by the manager). Through round 4: 128 PASS, 0 FAIL.

- Shell and extension unit tests, both typechecks, and mutation checks that fail with each fix taken back.
- Patch blocks byte-identical to the tree; a dry run at the pin with 19 patches applying and 0 conflicts; the pre-commit hook passes.
- Live isolated runs: a popup, a key press, the navigate fallback, a gone page, a document in front, another browser tab in front, a blank tab, a failed page, a maximized AI column and a maximized desk. Every stop printed `LEFT=0`.
- Codex round: the new test in `src/browser/browserTurnPage.test.ts` starts two navigates at once in a turn with no page, on each runtime's path. One tab opens and the second call acts in it. With the queue step taken back, the test fails ("only one tab is opened").

### Not covered

- **A real AI turn in any runtime.** Test windows have no keys or sign-in, so the runs drive the shell commands with the page the extension sends. Gate 1 row below.
- **Windows.** Not run. The code is platform-neutral, and the browser tools sit behind the macOS-only `browser-agent-control` flag.
- **The exact original report** (Cmd+E in a web app with several tabs) was never reproduced. The two proven routes and the key-press run are covered.
- **A page in front in a minimized auxiliary window** still counts as in front.
- **OpenCode with two conversations working at once:** its adapter's requests name no conversation, so the conversation prompted last gives the page (D2, one shared browser; in architecture.md).

### Gate 1 rows (at the RC)

- **A real AI turn with several tabs, in each runtime (Claude Code, Codex, OpenCode):** three browser tabs, the turn's page not the active one. Click, type and navigate land in the turn's page; no tab comes forward; an action on a page that isn't in front returns the error and the AI asks.
- **A Codex conversation started before the update continues after it:** its visible history is there and the next message is answered. It starts a fresh native thread once, because the browser tools' new `page_id` changes the tool set Codex keys its threads by.

### Release notes

2.2's `docs/releases/v2.2.0/release-notes.md` doesn't exist yet: the release plan writes 2.2's notes in its release step, with the `release-notes` skill. Until then the CHANGELOG line under `[Unreleased] — 2.2.0` (this sprint's section) carries #658, including the one-time fresh Codex thread.

## #656: the microphone's warning

### Goal

When the microphone gives no sound, Transcribe says so while recording and names the input it records from, and a recording with no sound at all is never sent to an engine, on the device or in the cloud. Jarmo recorded 236 s from the wrong macOS input: every sample was 0, nothing said so, and the file went to ElevenLabs, which answered that it found no speech.

### Release tier

Extension-tier: the extension host and the webview only (`out/`, `media/webview.js`, `media/office-preview.js`, `package.json`'s test script). No patch, shell or contribution change. It ships with 2.2's shell build like the rest of the sprint.

### What changed

- **While recording.** The card names the input from the first second, on its own muted line under the status: "From MacBook Pro Microphone", cut with an ellipsis, the whole name in its tooltip; "Recording" and the time stay on one line. After 3 s with no sample reaching -80 dBFS (dictation's rule, `webview/src/hooks/dictationLevel.ts`), one line appears in plain ink with a microphone-slash: "No sound from the microphone. Check the input in System Settings ▸ Sound." The name is a link to Sound ▸ Input (`ms-settings:sound` and "Settings ▸ System ▸ Sound" on Windows). The recording goes on, and the line goes when sound arrives.
- **Before transcribing.** `src/speech/silence.ts` reads a PCM or float WAV to its first audible sample. A recording made here with no sound shows, in place of the engines, the sheets' quiet note (the ground's fill, a hairline, the microphone-slash): "No sound was recorded, so there's nothing to transcribe. Check the input in System Settings ▸ Sound, then record again." Record again is the main button and starts a new recording at once; Cancel stays. A silent file added from elsewhere says "No sound in this file, so there's nothing to transcribe." with Cancel only.
- **Never sent.** The host's `_start` refuses a silent pending file, and `JobManager` checks again before any engine runs (`silent-audio`, not retryable), which covers the Transcript Workbench's re-run and a stale page. The answer is kept per path, size and modification time, so a silent file is read to its end once.
- **One source for the settings' name.** The host sends it in `TranscribeState.soundSettings` (`soundSettingsName` in `silence.ts`); the webview keeps no copy.

### The Experience lead's answers

[`releases/v2.2.0/analysis/2026-11-05-656-no-sound-experience-answers.md`](https://github.com/ProductoryHQ/ritemark-dev/blob/504aa3c/releases/v2.2.0/analysis/2026-11-05-656-no-sound-experience-answers.md) (ritemark-dev `504aa3c`): the recording line and its tooltip as built; the pending card's words above, with the same link; Record again instead of a greyed Transcribe; plain ink with a microphone-slash, no amber or red; the quiet note instead of the yellow box; the device on its own muted line. All applied in round 2.

### Review rounds

| Round | Reviewer, commit | Found | Fixed in |
|---|---|---|---|
| 1 | Opus, `cc385d3a` | APPROVE, 0 Important. Minor: the settings' name written twice (host and webview); a silent WAV read to its end twice (panel and job); behaviour tests wanted for `_start`, the pending card and Record again | Round 2 (`39ef6e61` and after), with the lead's answers |

### Evidence

`proof-656.txt` (not committed). Round 1: unit tests on synthetic buffers and files only (`silence.test.ts`, `capture.test.ts`, `captureSession.test.ts`, `JobManager.test.ts`), two mutation checks, and live isolated runs with Chromium's fake media (a silent input and a beep). Round 2 adds:

- `TranscribeViewProvider.silence.test.ts`: the real host, a silent WAV staged and Transcribe sent for it: no job; the same with sound starts one. With the `_start` guard taken back, it fails.
- `pendingSilence.test.ts`: the pending card rendered and clicked: the lead's words, the note's fill and hairline, no amber, the link and its message, Record again first and Cancel, no Transcribe and no engine; Record again posts `clearPending` and the capture session starts; a silent file from elsewhere has Cancel only; the live card's status line, its "From" line and the no-sound line.
- `silence.test.ts`: the cache answers from memory for the same size and time, and reads again for a new time, a new size or a gone file.
- `npm run test:recording` (11 suites), both typechecks, the pre-commit hook.
- Live, the current build of the pinned VS Code (`d956e8a6`), isolated, after 18:00, fake media, no real microphone: the device line, the no-sound line at 0:03, the pending card, Record again starting a new recording, the ellipsis and tooltip at a narrowed width. Every stop printed `LEFT=0`. After-shots in `captures-656/after-*`.

### Not covered

- **Windows:** not run. Its words and the `ms-settings:sound` link are tested only as strings. A privacy-blocked microphone on Windows can also send silence, and the line doesn't say so.
- **A real wrong-device run:** not done, since no real microphone may be recorded here; the label Chromium gives the default Mac input wasn't seen live (both forms are handled).
- The name shown stays the one the recording started with if the system's default input changes mid-recording.
- Before transcribing, only WAV is read (plus other formats through the Mac's peaks WAV); an mp3 or m4a on Windows goes on as before.
- At a card narrower than the sidebar allows (146 px, forced), the link runs a few pixels past the card's edge, as Stop and use is already cut there.

### Gate 1 rows (at the RC)

- **Record with the wrong input chosen** (System Settings ▸ Sound ▸ Input set to a muted or unused device): the card says "From <that device>", the no-sound line appears after about 3 s and the recording goes on; after Stop and use the pending card says "No sound was recorded…" with Record again, and no engine is called.
- **Record with the right input and a long name** (for example a USB or Bluetooth headset): "Recording" and the time stay on one line, "From <name>" is cut with an ellipsis and its tooltip has the whole name, and no no-sound line appears while you speak.

### CHANGELOG

The line under Sprint 153's `#### Fixed` in `docs/CHANGELOG.md` carries #656.

## Planning approval

- [x] The Development manager approves both fixes as one lightweight sprint (5 November 2026, Jarmo's 2.2 delegation of 1 November).
- [x] GitHub issues exist: #658 (bug), #656.
- [x] Each fix has its own branch and PR: #660, #661.
