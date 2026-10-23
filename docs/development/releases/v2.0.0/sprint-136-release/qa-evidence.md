# Sprint 136: QA evidence

Status: **Pass**, **Partial** (what was not run is named), **Not run** (with the reason), **Later** (the dress rehearsal or a gate).

## The dev walk of the first sprint PR (20 October)

A dev build of the sprint branch on VS Code 1.142 (Electron 43.7.7), launched in the background (`open -n -g`) with its own short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, `--use-mock-keychain` and the three backgrounding flags, driven over CDP. Projects: a copy of the shipped sample project ("Leadership programme"), and two scratch folders (`plain`, `With space`). Claude was signed in through this Mac's own login, so the turns ran on the updated Claude Code 2.1.304. ChatGPT was signed in too; no ChatGPT turn was sent (the 19 October rule for the real `~/.codex`).

| Scenario | Status | Evidence and notes |
|---|---|---|
| S35 A task card's tab (#477) | Pass, with one finding | Opening "Draft Module 4 from the brief" from the board: the tab reads "Draft Module 4 from th…" with the check-square, and the chip shows the check-square and the full title. A plain document keeps its name ("Module 1.md"). **Finding:** after a restart, a card tab that is not in front reads its file name ("m4d7r2-draft-module-4.md") until it is clicked, because VS Code resolves a background tab only when it is shown and does not keep a webview's title. Recorded for the Experience lead; not fixed here |
| S36 The chip follows the document in front (#485) | Pass | Module 1 in front: "Active: Modules/Module 1.md". Closed with the card behind it: the chip names the card. The last document closed (Home in front): no chip. A document deleted from disk while open (in a window whose file watcher works): the chip goes |
| S37 Codex on a free account (#482) | Partial | ChatGPT is signed in on this Mac, so the signed-out line was not shown on screen. The built bundle carries "Any ChatGPT account works, Free included. Paid plans get higher limits." and no "Requires ChatGPT Plus" |
| S38 Dictation's first language (#486) | Pass on an English Mac | The control reads as drawn: the microphone, then "EN ⌄"; the microphone's tooltip "Dictate, in English". Picking Finnish through More languages… only set it: nothing recorded, the control read "FI" and "Dictate, in Finnish". Finnish was still set in another document's editor and after Reload Window, and the menu ticks it. A computer in another language is covered by the unit tests (`dictationLanguage.test.ts`, `systemLanguage.test.ts`), not on screen |
| S39 The left column stays (#487) | Pass, after a fix | With the column on Home, a chat's start and end leave Home. With the column closed, a turn that wrote a file left it closed. **Found:** without any refresh, Documents did not list a file Claude wrote: that window's file watcher had stopped delivering (see below), which is bug #33, the reason the refresh existed. **Fixed:** patch 002 gives Refresh Explorer `{ reveal: false }`, and every turn's end refreshes Documents without opening it. Re-run on the fix: the column stayed closed through a turn that wrote `later.md`, Documents listed it when opened, and a turn with Home showing left Home |
| S40 A restored chat's time (#488) | Pass for a restart | After Reload Window the restored chat read "Done in 11s" and its earlier turn "Activity (4 steps · 9.3s)". A project switch goes through the same projection; it is checked at the dress rehearsal |
| S41 A flow's Claude step, signed out (#459) | Partial | Claude was signed in (signing out would sign Jarmo out), so the run was not made. The built extension carries "Claude is not signed in. In Ritemark Settings, sign in with Claude.ai under API Keys, then run the flow again." and no "under Agent Runtime" |
| S34 Our own runs are marked (#480) | Later | A dev run is always `dev`; the marker is for installed builds. Unit-tested (`consent.test.ts`); on the dress rehearsal's build |
| S42 A fresh profile with another build's recents (#475) | Partial | The run's log: "Creating shared storage database at …/rm136/shared/sharedStorage/state.vscdb", so the flag isolates the recent list. The installed app's list before and after is checked at the dress rehearsal |
| S18 A Claude turn (arm64, dev) | Pass | Four Claude turns on 2.1.304 in the 1.142 shell: "pong" (Done in 4.3s), two file writes (11s, 9.3s), "ok" (4.2s). The first signed-in turn on 1.142 |

### Found in the walk

- **A payload key the editor refused.** The first build put the operating system's language into the editor's render payload without adding it to the payload's parser, which accepts only known keys, so every Ritemark document stayed on "Loading…". `test:editor-sync` covers that parser and `npm test` does not; the parser now takes `systemLanguage`, with a test, and every offline `test:*` script runs before a PR.
- **A keychain prompt.** The first launch left out `--use-mock-keychain`; an unsigned dev Electron then asks the keychain, a password prompt lands on the screen, and the main process blocks (CDP hung). The instance was stopped at once, which withdraws the prompt. The `ritemark-automation` skill's launches now carry the flag.
- **A window's file watcher stopped delivering** in two of three windows (one after a Reload Window, one after a few Claude turns): Documents kept a deleted file and missed new ones, while a third window on the same instance kept working. Not reproduced on demand and not explained. The turn-end refresh covers what the AI writes; whether a production build's watcher behaves the same is checked at the dress rehearsal (S39 there, with a file created outside Ritemark).
- **1.x words in app strings**, seen by the user-docs pass: the board's "at the bottom of the Tasks side bar" (`BoardColumns.tsx`), and the Google Docs notifications' "Future Syncs" and "Remove publishing link". For the Experience lead's copy pass.

### Checks

- Every offline test script passes: `npm test`, `test:conversations`, `test:editor-sync`, `test:thinking-effort`, `test:sprint113-language`, `test:task-list-roundtrip`, `test:security-backports`, `test:claude-auth`, `test:update`, `test:integration:free`. `test:integration` was not run (it calls real models).
- The extension compiles (`tsc` and esbuild) and the webview builds; VS Code's `typecheck-client` has no errors after the 002 change.
- `check-patch-stacking.mjs`: 18 patches OK. `apply-patches.sh --dry-run`: 18 can apply, 0 conflicts.
- The runtime update's checks are in `agent-runtime-compatibility.md`, v2.0.0.

## The dress rehearsal on main `8052a182` (21 October, E3)

A clean-room release worktree (`.worktrees/release-8052a182c16a`, from `create-release-worktree.sh`), the release skill's Step 0 and `build-prod.sh` under the arm64 wrapper. Not signed, never a release. The app ran in the background with the launch rule (its own short profile, `--extensions-dir`, `--shared-data-dir`, `--use-mock-keychain`, `RITEMARK_BUILD_CHANNEL=test`). CI on the same commit: macOS x64 [39540339261](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39540339261) and Windows [39540359645](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39540359645) green (the Development manager dispatched them; Windows Check 5e "OK (8052a182c16a)", d3dcompiler_47.dll and dxil.dll signed as type Catalog, Verify 0 failures). Windows round 5 runs on that installer.

| Scenario | Status | Evidence and notes |
|---|---|---|
| S26 The source | Pass | "RELEASE SOURCE VERIFIED" at `8052a182c16a`; `release-preflight.sh` passed with its one known warning; `check:anthropic-models` OK for Claude Code 2.1.304 |
| S44 The build leaves the source alone (#471) | Pass for the build; the planted-change dry run not made | "The extension is out of VS Code's tree while gulp runs", then "Extension source unchanged by the build (tree e42f6b338e5b)"; no "corrupted during build"; the link back. `validate-build-output.sh` inside the build passed: 17 native modules for darwin-arm64, the runtimes arm64 (Claude Code, Codex app-server and code-mode host, OpenCode, ripgrep), the fonts, "product.json's commit... OK (8052a182c16a)" |
| Sprint 135's E5 checks | Pass | For a minute after launch: no `agenthost.log`, no "agent host started", 3 Node utility processes (the Copilot processes on the Mac were the Microsoft 365 Copilot app's). A terminal tab ran `echo dress-$((6*7)) > file`. A JSON file as code: 5 token classes. `CachedData/8052a182…` 14 MB. product.json's commit `8052a182…` |
| R3's section, rehearsed | Pass with two expected differences | `project-check.mjs` 6/6; `frame-geometry.mjs` 22 pass, 0 fail, 2 skipped; `frame-screenshots.mjs --compare`: 30 of 34 the same. More 1.07% and 1.04% (no Copilot Chat in a production build, as E5). The Settings foot 3.39% and 3.37%: the dev baseline shows other runtime versions, an earlier check time and "Extension 1.14.0" (a production build shows "1.14.0-0"), and caught a scrollbar mid-fade that shifts the page 8 px. Both pairs are release-image candidates for Jarmo at Gate 1 (D2) |
| S1 The Mac, from "Harbour" | Pass | Harbour (made with the installed v1.14.0: three projects, the notice closed with OK, Ritemark Dark, Search moved to the AI column, Agent Library dragged first, a card waiting on a decision, a weekly flow, an agent, two recordings, Claude chats in two projects; no Google Docs link, no API key). The first start: "Welcome to Ritemark 2.0", Claude and ChatGPT Signed in, the recent projects Harbour's three with Leadership programme "Open when you left", the usage switch on, "On, as you chose in Ritemark 1.". Open when you left: Home of Leadership programme; the places row Home, Documents, Tasks, Browser, Agents, Transcribe, More; the AI column only Ritemark AI; Ritemark Dark; What moved on Home; the waiting card under Waiting for you; the projects list all three |
| S4 Nothing is lost | Pass, but the API key and Google Docs | The agent and the flow in Agents, both recordings in Transcribe, the board's waiting card, the 1.x chat (shown "Done": 1.x saved no time). A turn in it continued the conversation: Claude recalled its earlier answer. It said "Continuing with Claude. Previous messages were included as context.": the native session was taken on Claude Code 2.1.296, and resume needs the same runtime, so after a runtime update a conversation carries on with its transcript. Not in Harbour: an API key, a Google Docs link |
| S5 The second start | Pass | No welcome on the second start; What moved stays until Got it, as Sprint 134's R11 says, and after Got it and another start it is gone. The drag of a place across a restart was Sprint 135's S19 on 1.142 and is not repeated |
| S6 An older extension copy | Later | Before the version bump the bundled extension is `1.14.0-0`, so an older user-directory copy would win; it is meaningful on the 2.0.0 candidate |
| S18 A Claude turn (arm64, production) | Pass | Claude Code 2.1.304 in S4's turn, "Done in 4.7s" |
| S42 The installed app's recent list | Pass | `~/.ritemark-shared/sharedStorage/state.vscdb` had the same SHA-256 and modification time before and after every run. Harbour's own shared folder holds its three projects, and its profile no longer has a recent list: 1.142 moves the list, it does not copy it (the update-path audit) |
| S34, S33 | Later | They need the welcome on a fresh no-folder profile and a PostHog stand-in; at Gate 1 |

### Found: the file watcher stops delivering (fixed for the candidate)

On this build, Documents stopped showing files created or deleted outside Ritemark after a while, until Refresh Explorer: the view was right, VS Code's workspace file watcher had stopped delivering. The same had happened in two of three dev windows the day before.

What the trace logs (`--log trace`, `window1/fileWatcher.log`) showed:
- Every window asked for a recursive watch of the whole home folder ("Started watching: '/Users/jarmotuisk' with backend 'fs-events'"). It comes from Ritemark's `_watchAgentFiles` (#450, Sprint 132): a `RelativePattern` based at the home folder for `.claude/{agents,commands,skills}/**`, which VS Code serves by watching its base. v1.14.0 did not have it. In 8 minutes it delivered about 2,300 events from `Library/Application Support`, `Library/Caches`, `.codex` and `.claude/projects`.
- **Reproducer.** 5,000 files created and deleted in a scratch folder in the home folder: the watcher logged "Events were dropped by the FSEvents client. File system must be re-scanned. (path: /Users/jarmotuisk)", and from 40 s later every probe missed (a file created in the project not shown in Documents within 4 s), on a production 1.142 build.
- **The same flood on 1.117** (Jarmo's 2.0 preview tree, run with its own profile): the same drop errors, and every probe for 3.5 minutes still seen. So 1.142 is more fragile here, and Ritemark's home-folder watch is what exposes it.
- **With the fix on 1.142** (a dev build): no recursive watch of the home folder (only `~/.claude/agents` and the project); after the home-folder flood every probe for 3.5 minutes seen and no drop error; after 20,000 files created and deleted inside the project, three drop errors on the project's own stream and every probe for 1.75 minutes still seen.

Not explained: why a drop on the home folder's stream leaves 1.142's watcher silent while a drop on the project's stream does not. The fix removes the home folder's stream, the cause in every stall seen. Related upstream report: [microsoft/vscode#328589](https://github.com/microsoft/vscode/issues/328589) (Claude-related file watching overload, the same FSEvents drops). S47 checks it on the candidate.

## Windows round 5's faults A, B and C (21 October)

Windows round 5 on `8052a182` found three faults for 2.0 (the Development manager's report): A, the update's welcome behind a restored "powershell" terminal tab; B, a message sent while the share question waited started without the page; C, What moved naming a Copilot Chat that 2.0 does not ship. Fixed on `sprint-136-update-welcome-share`, checked in a dev build on the Mac with a v1.14.0 "Harbour" whose terminal comes back (Harbour restored from its zip; in the installed v1.14.0 `terminal.integrated.persistentSessionReviveProcess: onExitAndWindowClose`, a terminal opened in the AI column with a line run in it, Brief.md open, the window closed: 15,899 bytes of terminal buffer saved).

| Scenario | Status | Evidence and notes |
|---|---|---|
| S48 The welcome in front | Pass, with the cause not reproduced | On the Mac the first 2.0 start had the welcome in front and `bash` behind it ("Home \| Task board \| Brief.md \| Welcome* \| bash"), and "Open when you left" brought Brief.md: Windows' order did not reproduce. The guard, proven by moving to the terminal with the next-tab shortcut during the welcome's first minute: "Welcome \| bash*", 2 s later "Welcome* \| bash"; the second time `bash` stayed in front. On Windows' retest the welcome must be in front by itself |
| S49 The share question and a sent message | Pass | example.com loaded and asked at once, as on Windows. Sent "What is the title of the web page I have open now?": Working…, no answer for 10 s, the question still showing. Share this page: the turn answered "Example Domain", "Done in 2.8s" (the wait is not counted). On example.net, sent and then Stop while waiting: "Execution cancelled", Stopped, the chat "Interrupted", the same as a stop of a running turn (compared with Home in front); the conversation record has the turn's user message, a `not-sent` receipt and a `cancelled` boundary. Before the fix the same send answered "The browser tab isn't shared with Ritemark AI" (round 5's fault): the sheet sent `skipBrowserContext` for an unshared page, so the host never waited |
| S49 after the review | Pass | The `qa-validator` review's points fixed: the wait (`BrowserContextStore.waitForAnswer`) can be stopped from its first moment and is tied to the page asked about (a question replaced by another page's settles it, unanswered); an ask still in flight is waited for; Stop all chats (a project switch) and a Stop during any step before the turn starts end it as stopped; a closed sheet drops its question; the welcome guard leaves a person's own new terminal ("Terminal", "Terminal 2") alone. Rechecked on main `96b4e4f2` in the dev build: on example.net held, Share, "example.net", "Done in 6.2s"; on iana.org Stop while held, "Execution cancelled", Stopped; Not now, the turn went on ("ready") with the question gone |
| S50 What moved without Copilot Chat | Pass in tests; the production half at the candidate | `home.test.ts`: no Copilot Chat line without it, its line with it. The dev build ships the built-in Copilot Chat, so its What moved shows the line; every production build strips it (`build-prod.sh`, `build-macos-x64.yml`, `build-windows.yml`) |


## RC1 on `c04eabf2`: the gates and publication (21–23 October)

RC1 was built in `.worktrees/release-c04eabf2fe02` (RELEASE SOURCE VERIFIED), after macOS x64 CI [39598843953](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598843953) and Windows CI [39598992733](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598992733) went green at the same commit.
- **The build:** `build-prod.sh` took 8 minutes. "Extension source unchanged by the build", the bundled extension floored to `2.0.0-0`, product.json's commit "OK (c04eabf2fe02)", VALIDATION PASSED.
- **Signing and the DMG:** 47 components signed, 0 failed. `create-dmg` stopped at Finder's -1743, so the DMG was made with the `ditto` + `hdiutil` fallback.
- **Before the build:** `check:anthropic-models` OK for Claude Code 2.1.304, and preflight passed with its one known warning.

The Gate 1 prep ran on a copy of RC1 in `/private/tmp`, with every test launch on its own profile, extensions and shared data, the mock keychain, and the test marker except where S33 needs `prod`.

| Scenario | Status | Evidence and notes |
|---|---|---|
| S9 The base window | Pass | Second run: 32 of 34 scenes the same. More is 1.07% light and 1.04% dark, the expected production difference (no Copilot Chat); Jarmo approved those two captures as the first release images ("release pildid OK", 21 October). The first run's dark switcher showed 4.83%, but its capture had no menu open (the script's click missed); a second full run matched it at 0.02%. `frame-geometry.mjs` 34 pass, 0 fail, 2 skipped; `project-check.mjs` 6/6 |
| S47 Documents after a flood | Pass | The trace log's recursive watches are only the project, `~/.claude/agents` and `~/.claude/skills`, never the home folder. 5,000 files created and deleted in the home folder and then in the project; a probe each minute for five minutes all seen within 4 s, 0 dropped-events errors |
| S1, S4, S5 The update, on a fresh Harbour | Pass | Launched with no folder, as a person updating would. "Welcome to Ritemark 2.0", Claude and ChatGPT signed in, Harbour's three projects with Leadership programme "Open when you left", "On, as you chose in Ritemark 1.". Home in Ritemark Dark, What moved without a Copilot Chat line, the waiting card; the agent and flow in Agents; both recordings in Transcribe; the 1.x chat continued ("Continuing with Claude…", Claude recalled "harbour"). Second start: no welcome; What moved until Got it |
| S6 An older extension copy | Pass | With `/Applications` holding RC1, the older copy was RC1's own extension marked 1.14.0 in a run's `--extensions-dir`: "Skipping extension …/ritemark.ritemark-1.14.0 in favour of the builtin extension" |
| S18 Claude on arm64 | Pass | The Harbour chat's turn, Claude Code 2.1.304, "Done in 7.6s". No Codex or OpenCode turns in the scripted runs: a newly signed `codex-app-server` risks keychain prompts on Jarmo's screen |
| S33 Yes, no and 1.x answers | Pass, but the live PostHog check | Against a local stand-in for PostHog. Harbour (OK in 1.x) and a fresh profile that said yes sent `welcome_shown`, `project_opened` and `first_message_sent`, all `prod`; the fresh profile sent nothing before it left the welcome. A fresh profile that said no, and a 1.x profile that opted out (`ritemark.analytics.enabled: false`, what 1.x's Opt Out writes), sent nothing at all, even after a Claude turn. `ai_signed_in` is sent only for a sign-in made inside the welcome (Sprint 133's spec), so it never fired on this Mac, where both AIs were already signed in. The live run in PostHog needs PostHog access and was not run |
| S34 Our own runs marked | Pass | A test-marked fresh profile that said yes sent five events, all `build_channel: test`. A profile with `ritemark.features.analytics: false` sent nothing. A test-marked profile opened straight into a folder sent nothing either: with no welcome there is no yes |
| S48, S50 on the Mac | Pass | Harbour's first start had the welcome in front (its terminals did not come back on the Mac). What moved has no Copilot Chat line in the production build |
| S8 The update offer, after publication | Pass on the Mac (23 October) | v1.14.0 (arm64) on a fresh profile, 10 s after start: "Ritemark 2.0.0 is available (729.5 MB)" with Download Installer, Later, Skip This Version and Pause 7 Days. 729.5 MB is the published arm64 DMG. Windows' offer not checked |
| S7 Going back to 1.14 | Pass (22 October) | The v1.14.0 DMG, hash matching its published one, started on a Harbour profile 2.0 had used. Nothing of the person's work was deleted (3 chats, 5 cards, the project files; only Chromium caches), its Open Recent showed only the folder it opened, and 2.0 started cleanly again afterwards. 1.14 restores 2.0's Home tab as a blank tab, which the notes' "some things look different" covers |

**Gates, in Jarmo's own words in the release session:**
- Gate 1, arm64: "gate 1 approved" (21 October), after his test of RC1 on his own Mac. #503 (corner shadows) and #504 (the Transcribe scrollbar) are 2.1 by his call.
- Gate 2, x64 under Rosetta: "rosetta - approved" (21 October).
- Gate 2, Windows: "windows approved" (22 October), after the Windows session's run on his PC passed every item it ran.
  - What it ran: the update over the v1.14.0 Harbour zip with 0 extra and 0 missing files, the signatures, About, a day's work, and a clean uninstall.
  - What it didn't run: Codex and OpenCode, and whether SmartScreen speaks after Run.
  - The restored terminal came first on a slow first start (11 s, then the welcome at 23 s). That's #501, for 2.1.

**Notarization:**
- arm64 `b9506d94-fce5-4ff2-96f7-27b04a122422` and x64 `a11f044b-a542-4d4c-bfaa-7e775dc041a6`, both Accepted and stapled.
- `stapler validate` and `spctl` (Notarized Developer ID) were checked directly.
- x64 went 161 minutes after its DMG was built.

**Publication:**
- Published 2026-10-23T04:56:43Z on Jarmo's "publish - lets go live": <https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.0.0>.
- The release stayed a draft until GitHub's digests for all four assets matched `dist/`.
- The `latest` feed was byte-identical afterwards, with 25 entries.
- The published body is the repo's release notes with four edits:
  - the two working comments removed;
  - the Smart App Control link made absolute;
  - the Strategy Room's inked first sentence. The repo's notes got that sentence in this closeout.
- Store: hosted on 22 October and submitted on 23 October (`docs/microsoft-store-submission/evidence/`).
- Release closeout: `docs/releases/v2.0.0/evidence/closeout.md`.
