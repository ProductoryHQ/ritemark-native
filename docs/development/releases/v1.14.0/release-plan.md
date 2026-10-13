# Release Plan — v1.14.0

**Status:** **Feature complete** (2026-10-13). Sprints 129, 130 and 131, every fix for this release and the runtime update ([#424](https://github.com/ProductoryHQ/ritemark-native/pull/424), Jarmo approved 2026-10-13) are merged; `main` is at `426c4fc4` before the version bump. Next: the release-candidate build from the version-bump commit. `main` freezes when the version bump merges<br>
**Target:** v1.14.0<br>
**GitHub milestone:** [v1.14.0](https://github.com/ProductoryHQ/ritemark-native/milestone/13). All five issues are closed<br>
**Release type:** **Shell-tier.** [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195) changes `patches/vscode/009-*`, [#421](https://github.com/ProductoryHQ/ritemark-native/pull/421) changes `patches/vscode/002-*`, Sprint 129 adds native whisper binaries for Windows and Intel Macs, and Sprint 130 adds an activity-bar icon that an extension release does not ship. Full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI. The first live run of the draft-first publish (release skill Step 8, [#402](https://github.com/ProductoryHQ/ritemark-native/pull/402))<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-11 (the milestone); this file 2026-10-12<br>
**Source:** The Development manager opened the milestone on Jarmo's decision of 2026-10-11 (the next release opens when a candidate is built). On the same day Jarmo pressed "Build it" for #133, #119 and #195 on the Dev Dashboard; each sprint plan was approved separately in its own session.

## Release Thesis

Every project folder gets a task board whose tasks can be handed to Claude Code, Codex or OpenCode, and the result comes back onto the task for the user to review. Windows PCs and Intel Macs get on-device voice dictation and transcription; on Windows dictation works as "speak, then text": the user talks, presses Stop, and the text arrives about 20 s later. The browser's Recent list shows the pages the user actually visited, and new Codex conversations start on GPT-6.1 Sol.

## Sprints

| Sprint | Scope | Status |
|---|---|---|
| [129 — Windows dictation](sprint-129-windows-dictation/sprint-plan.md) | On-device Whisper on Windows: voice dictation and Transcribe's on-device engine ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)). The Intel Mac binary comes from the same pipeline ([#203](https://github.com/ProductoryHQ/ritemark-native/issues/203)). The Apple silicon engine is rebuilt for macOS 12–14 (R11, Jarmo 2026-10-12) | **Merged** 2026-10-12: [#399](https://github.com/ProductoryHQ/ritemark-native/pull/399), `4f6af92f`. Jarmo's speed decisions (2026-10-12): on Windows, dictation ships as "speak, then text" with the full audio window; q8_0 is the Windows model; no GPU (Vulkan) in v1.14.0; cutting at pauses (VAD) is separate work for all platforms. The Windows hardware checks of the silence fixes are on the Gate 2 list |
| [130 — Task board](sprint-130-task-board/sprint-plan.md) | Task board in each project folder, with Give to agent ([#119](https://github.com/ProductoryHQ/ritemark-native/issues/119)) | **Merged** 2026-10-13: [#409](https://github.com/ProductoryHQ/ritemark-native/pull/409), `f7cec600`. Follow-ups merged the same day: [#421](https://github.com/ProductoryHQ/ritemark-native/pull/421) (`e75d02cf`, Activity Bar order and Task board on Home) and [#422](https://github.com/ProductoryHQ/ritemark-native/pull/422) (`f0bbe89e`, Retry after a crash and the Windows test follow-ups). QA: [qa-evidence](sprint-130-task-board/qa-evidence.md). Codex, OpenCode and the rows a dev run cannot drive are on the Gate 2 list |
| [131 — Browser Recent](sprint-131-browser-recent/sprint-plan.md) | Browser Recent records the pages the user visits: address bar, links, the AI agent, files opened in the browser. A bridge in patch 009 forwards navigations to the extension; titles in the list; deleted local files drop out ([#195](https://github.com/ProductoryHQ/ritemark-native/issues/195)). Shell-tier (patch 009) | **Merged** 2026-10-12: [#414](https://github.com/ProductoryHQ/ritemark-native/pull/414), `b1080017`. Dev-instance QA: 30 of 31 scenarios pass ([qa-evidence](sprint-131-browser-recent/qa-evidence.md)). AI-agent navigation was seen later with Claude in Sprint 130's QA (S30); it and the Windows check are on the Gate 2 list |

## Merged since v1.13.0

The sprint PRs are in the table above.

| PR | Commit | What it changes | Ships in the product |
|---|---|---|---|
| [#396](https://github.com/ProductoryHQ/ritemark-native/pull/396) | `510384f3` | Agent Library More actions button uses Phosphor dots-three (#391) | Yes (extension) |
| [#404](https://github.com/ProductoryHQ/ritemark-native/pull/404) | `cf194e30` | Comment-task retention sweep runs at activation, so the store stops growing | Yes (extension) |
| [#397](https://github.com/ProductoryHQ/ritemark-native/pull/397) | `542bee6c` | README links ritemark.app; GitHub detects the MIT license | No (docs) |
| [#400](https://github.com/ProductoryHQ/ritemark-native/pull/400) | `e649fc09` | v1.13.0 closeout | No (docs) |
| [#402](https://github.com/ProductoryHQ/ritemark-native/pull/402) | `200adae9` | `notarize-dmg.sh` fails on every refusal; publish releases from a draft | No (release harness) |
| [#405](https://github.com/ProductoryHQ/ritemark-native/pull/405) | `d4c6ed47` | Pre-commit Check 7 actually runs the extension compile | No (harness) |
| [#407](https://github.com/ProductoryHQ/ritemark-native/pull/407) | `37c4973f` | Worktree hygiene proves squash merges | No (harness) |
| [#410](https://github.com/ProductoryHQ/ritemark-native/pull/410) | `e77a1dee` | This release plan opened | No (docs) |
| [#412](https://github.com/ProductoryHQ/ritemark-native/pull/412) | `f7ee2bcb` | Audio files open in Transcribe without the "multiple default editors" toast (#406) | Yes (extension) |
| [#418](https://github.com/ProductoryHQ/ritemark-native/pull/418) | `7ac39daa` | GPT-6.1 Sol is the default Codex model (#398) | Yes (extension) |
| [#419](https://github.com/ProductoryHQ/ritemark-native/pull/419) | `a26d9820` | A profile without a saved Claude model starts on the catalog default, with no `claude-sonnet-4-5` notice | Yes (extension) |
| [#421](https://github.com/ProductoryHQ/ritemark-native/pull/421) | `e75d02cf` | Activity Bar: Tasks right below the File browser, Agent Library last of Ritemark's tools, applied once to profiles from v1.13; a Task board button on Home | Yes (shell: patch 002; the Home button is extension code) |
| [#422](https://github.com/ProductoryHQ/ritemark-native/pull/422) | `f0bbe89e` | Task board: Retry after a crash no longer stays Queued (W13); narrow side bar, keyboard focus, Make it a task names the file and fills Done when; a three-line add field | Yes (extension) |
| [#424](https://github.com/ProductoryHQ/ritemark-native/pull/424) | `426c4fc4` | Claude Code 2.1.296 / SDK 0.3.296, Codex 0.162.1, OpenCode 1.19.0; Haiku 5.5; Claude models below 5 hidden from model menus, kept for saved selections | Yes (shell: bundled agent binaries and the Agent SDK) |

## Runtime versions

Reviewed 2026-10-13 against npm `latest` and the latest Codex GitHub release. Every release repeats this review.

| Runtime | v1.13.0 | v1.14.0 ([#424](https://github.com/ProductoryHQ/ritemark-native/pull/424)) | Main changes |
|---|---|---|---|
| Claude Code / Agent SDK | 2.1.289 / 0.3.289 | **2.1.296 / 0.3.296** (2026-10-09) | Fixes; among them token counts for Haiku 5.5, and on Windows stdio MCP servers are no longer force-killed at shutdown |
| Codex | 0.160.0 | **0.162.1** (2026-10-09) | 0.161.0 makes GPT-6.1 Sol Codex's own default, matching #418; 0.162.0 restores drive-letter file access on Windows 10 and keeps CRLF line endings in `apply_patch` |
| OpenCode | 1.18.34 | **1.19.0** (2026-10-11) | Small fixes. 1.19.0 adds an opt-in upgrade path to OpenCode 2; npm `latest` stays 1.x |

`check:anthropic-models` (catalog v2196, issued 2026-10-13): **OK**, the bundled Claude Code 2.1.289 supports every model in Anthropic's Claude Code catalog. One **WARNING**: Haiku 5.5 (`claude-haiku-5-5`) is in Anthropic's main list but not in Ritemark's Claude lineup, which still has Haiku 4.5.

**Decision (Jarmo, 2026-10-13, through the Development manager):** "jah uuenda kõik kolm ja lisa Haiku 5.5 - ja viska vanad Claude mudelid peitu - kõik mis alla 5" (yes, update all three and add Haiku 5.5, and hide the old Claude models, everything below 5). [#424](https://github.com/ProductoryHQ/ritemark-native/pull/424) does all three, as [#386](https://github.com/ProductoryHQ/ritemark-native/pull/386) did for v1.13.0. It merges **before** the version bump, because the version bump is the last merge before the freeze.
- **Haiku 5.5** is the quick Claude model. Claude Code 2.1.296 resolves `haiku` to it (2.1.289 resolved it to Haiku 4.5). With it, `check:anthropic-models` is OK with no warnings.
- **Claude below 5 is hidden from model menus, not deleted.** This covers every source (the catalog, Claude Code's live list, an API key's `/v1/models`, OpenCode). A saved selection keeps running on its model, with no notice. Checked in a dev instance on Jarmo's subscription: the Claude group lists only the seven 5.x models, and a profile with Opus 4.8 saved ran a turn on `claude-opus-4-8`.
- Evidence: hashes measured from the published artifacts, fetch 12/12, `verify-agent-runtimes.sh` and the OpenCode gate 4/4, and the Sprint 128 background probes on 2.1.296 (`agent-runtime-compatibility.md`, v1.14.0 entry).

## Not in this release

- [#417](https://github.com/ProductoryHQ/ritemark-native/issues/417): a conversation's model is not saved across restarts, for all three runtimes. #418 makes it visible for Codex: after the update, a Codex conversation that ran on GPT-5.6 Sol comes back on GPT-6.1 Sol and continues with its earlier messages as context. The release notes say so.
- Refreshing `feeds/model-catalog.json` in `ritemark-public`: after publish, not before. The refresh would also move v1.13 apps to GPT-6.1 Sol as the Codex default, unless its GPT-6.1 Sol row gets `minAppVersion: "1.14.0"` ([#418](https://github.com/ProductoryHQ/ritemark-native/pull/418), "After the release").

## Feature-complete checklist

- [x] Sprints 129, 130 and 131 merged, with their follow-ups #421 and #422.
- [x] All five milestone issues closed (#119, #133, #195, #398, #406); no open PR on the repository.
- [x] Release notes and `CHANGELOG.md` cover everything merged since v1.13.0.
- [x] Version 1.14.0 in all six version files.
- [x] Runtime update decided: Jarmo approved it on 2026-10-13.
- [x] [#424](https://github.com/ProductoryHQ/ritemark-native/pull/424) merged (`426c4fc4`), and the version bump rebased on it.
- [ ] Windows and macOS x64 CI green on `main` before the candidate is cut (release skill, "Prove CI green BEFORE cutting a candidate").

## Gates

- **Shell-tier:** clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, Windows CI (see `release-manager`).
- `main` is frozen from the first release-candidate build until publish. The version bump is the last merge before the candidate.
- `TEST-CHECKLIST.md` is generated when the arm64 candidate is built (release skill, Step 2). It must cover the list below.

### Gate 2 checklist

**Windows dictation and Transcribe (Sprint 129), on the signed Windows installer:**
- On-device Transcribe of an MP3, and "speak, then text" dictation: talk, press Stop, the text arrives.
- The whisper files carry Productory's signature.
- With the hardware mute key on, the first dictation after launch and once more: recording stops by itself within ~3 s with "Ritemark Heard Nothing", and nothing is inserted.
- A 30 s pause between two spoken sentences: no invented words between them.
- Turn off "Let desktop apps access your microphone" after dictating, then click the mic: a dialog within ~3 s, and nothing inserted.
- Rename `whisper-cli.exe` and put it back: "Can't Start", then dictation works without a restart.
- One normal Estonian dictation, to check that quiet real speech isn't dropped.
- A two-minute recording while the processor is busy (look for gaps).
- Dictation while another app uses the microphone.
- On the Mac: Apple silicon dictation on macOS 12–14. Intel Mac evidence is the CI runner's contract test only (Jarmo, 2026-10-11).

**Codex after the update (#418, #417 context):**
- On a profile from v1.13 with a Codex conversation that ran on GPT-5.6 Sol: install v1.14.0 and reopen that conversation. The model menu shows GPT-6.1 Sol; the next send says "Continuing with Codex. Previous messages were included as context.", the answer uses the earlier exchange, and there is no error.
- A new Codex conversation starts on GPT-6.1 Sol. Picking GPT-5.6 Sol in the menu runs GPT-5.6 Sol. After a restart that conversation is back on GPT-6.1 Sol: known, #417.

**Task board with Codex and OpenCode (Sprint 130):**
- Give a task to Codex and to OpenCode: Working, then Ready to review with the agent's conclusion (not its first sentence); Ask for changes… runs in the same conversation; Stop, then Give again starts at once.
- Review an idea with Codex and with OpenCode: a verdict comes back.
- In a Codex chat and an OpenCode chat: "turn the action items in notes/meeting.md into tasks in To do" creates the tasks, and "mark one of them done" is refused.
- Codex signed out: its button says so and the arrow offers the others.
- With the network off: Give to agent fails with words, and Review an idea fails with words.
- Keyboard only: add a task, open it, move it to Doing, give it to Claude, open its conversation, mark it done. Tooltips show on keyboard focus.
- Add files… through the system file picker; a file outside the project is refused with a sentence why.
- Delete… a task: its file is in the Trash (macOS) or the Recycle Bin (Windows).

**Activity Bar order (#421), on a profile from v1.13:**
- Install v1.14.0 over v1.13.0 and keep the profile. The first start shows Home, File browser, Tasks, then Search, Source Control, Extensions, then Transcribe, Browser, Agent Library.
- Drag Agent Library somewhere else and restart: it stays where it was dragged.
- Home shows **Task board** right after "New AI conversation" when a folder is open, and it opens the Task board tab.

**Browser Recent (Sprint 131), on the signed builds:**
- Agent navigation: ask Claude to open a page in the browser, then check Recent lists that page with its title. Repeat with Codex or OpenCode where signed in.
- Windows: browse by typing an address and by clicking a link, open a link in a background tab with Ctrl-click and switch to it, open a local `.html` file, delete that file. Recent lists the pages with their titles and no longer lists the file. The same on the Mac with Cmd-click.

**Claude models and agents (#424):**
- A Claude turn on Haiku 5.5.
- On a profile from v1.13 with Haiku chosen on a Claude subscription: after the update the button shows Haiku 5.5 and a turn runs on it.
- With Opus 4.8 or Haiku 4.5 saved by id (`ritemark.ai.selectedModel`, or picked from an API key's list): the menu offers only 5.x models, the button still shows the old model, and a turn runs on it with no notice.
- With an Anthropic API key: the menu offers no model below 5.
- A Codex turn on Codex 0.162.1 (GPT-6.1 Sol), and the OpenCode permission gate with OpenCode 1.19.0 on x64 and Windows.

**Every release:** an authenticated Claude turn, a Codex turn and the OpenCode permission gate on x64 and Windows; Settings → Google Docs → Connect against the production client.
