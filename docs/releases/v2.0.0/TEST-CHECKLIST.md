# Ritemark 2.0.0 Test Checklist

> **RC1, published** (Sprint 136, S14). Filled in as RC1 was built on 21 October 2026, and closed with the release on 23 October.
>
> **How it was used.** The boxes were not ticked one by one. The release session ran the scripted Gate 1 prep. Jarmo ran Gate 1 on his own Mac, from a one-screen list drawn from S13, S32 and S35–S43. The Windows session ran Gate 2 on his PC. Results are in [qa-evidence.md](../../development/releases/v2.0.0/sprint-136-release/qa-evidence.md) ("RC1") and in [evidence/](evidence/closeout.md), and the sign-off table below records the gates in Jarmo's words. What nobody ran is named there: the live PostHog check, and Codex and OpenCode turns in the scripted runs. `main` is frozen from the version bump until publish, so this file, the release images it produces and the gate record go into the closeout PR. They do not merge earlier: any merge to `main` invalidates the candidate.

Release: Ritemark 2.0 ([release plan](../../development/releases/v2.0.0/release-plan.md), [Sprint 136](../../development/releases/v2.0.0/sprint-136-release/sprint-plan.md)). **Shell-tier:** a full app release on VS Code 1.142.0 (Electron 43.7.7, Node 24.18.0), with Claude Code 2.1.304 / Agent SDK 0.3.304, Codex 0.163.0 and OpenCode 1.19.3 bundled. Gate 1 and Gate 2 run on un-notarized builds. Notarization comes after the 60-minute hardening window. Publication is draft-first, for all three platforms at once (R8).

## The candidate

| | |
|---|---|
| Source commit (`origin/main`, the version bump's merge, #500) | `c04eabf2fe02648bb872c6f65b6645ac5a2009f2` |
| Release worktree | `.worktrees/release-c04eabf2fe02` (new, from `create-release-worktree.sh`; RELEASE SOURCE VERIFIED) |
| `main` frozen since | 2026-10-21, the merge of #500 |
| CI on that commit (S25) | macOS x64 [39598843953](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598843953) · Windows [39598992733](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598992733), both green |
| Harness worktree for x64 signing | the release worktree itself, at `c04eabf2` (product source and harness are the same commit), `RITEMARK_RELEASE_COMMIT=c04eabf2fe02648bb872c6f65b6645ac5a2009f2` |

| Platform | File in `dist/` | Published as | Size | SHA-256 as tested (un-notarized) | Built | Notarize no earlier than | Notarization ID, stapled | SHA-256 as published |
|---|---|---|---|---|---|---|---|---|
| macOS arm64 | `Ritemark-2.0.0-darwin-arm64.dmg` | `Ritemark-arm64.dmg` | 764,901,676 | `72c76578071a761212ef5aaab15616ddce28e0c40ae37fef735b580ff3f2bfc8` | 2026-10-21 13:10:43Z (build 8 min; 47 signed, 0 failed; DMG by the ditto + hdiutil fallback after `create-dmg`'s -1743) | 2026-10-21 14:10:43Z | `b9506d94-fce5-4ff2-96f7-27b04a122422` (Accepted, submitted 14:51:48Z, after Gate 1 "gate 1 approved" in the release session), stapled: yes (`stapler validate` and `spctl`: Notarized Developer ID) | `7455887947c19174a0d7444ef4b2b627bf9c3b5539737602d36576e8ac1d3560` (post-staple, 764,904,332 bytes; checked against GitHub at publish) |
| macOS x64 | `Ritemark-2.0.0-darwin-x64.dmg` (CI [39598843953](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598843953)) | `Ritemark-x64.dmg` | 742,259,769 | `73171e59af71a8f45cff7d5934ef324e9c843a88ebad601b48267f205c362411` | 2026-10-21 14:59:11Z (signed in the release worktree with `RITEMARK_RELEASE_COMMIT=c04eabf2…`: provenance verified; 48 signed, 0 failed) | 2026-10-21 15:59:11Z | `a11f044b-a542-4d4c-bfaa-7e775dc041a6` (Accepted, after Jarmo's "rosetta - approved" in the release session, 161 min after the DMG), stapled: yes (`stapler validate` and `spctl`: Notarized Developer ID) | `3b423f9bdd98fe46147b43ad63bac2ca57d7055feb77512722843c8fb21a2e68` (post-staple, 742,262,467 bytes) |
| Windows x64 | `Ritemark-Setup.exe` (CI [39598992733](https://github.com/ProductoryHQ/ritemark-native/actions/runs/39598992733)) | `Ritemark-Setup.exe` | 532,642,016 | `5364a56e7d1b5f8c60084f69039b344d28605b0d82b67ff9c7e6c735ade884fe` | CI, 2026-10-21 (matches its sidecar; source and workflow commit `c04eabf2…`) | n/a | n/a (Productory Services OÜ) | `5364a56e7d1b5f8c60084f69039b344d28605b0d82b67ff9c7e6c735ade884fe` (unchanged) |

## How to use this checklist

- A plain **S** number is a scenario in Sprint 136's [scenarios.md](../../development/releases/v2.0.0/sprint-136-release/scenarios.md). **134-S28** means Sprint 134's S28, and the same goes for 132-, 133- and 135-. **P1.01** is a row of the [v1.14 parity list](../../development/releases/v2.0.0/parity-v1.14.md) checked on the Mac, and **W1.01** is the same row checked on Windows.
- Tick a line only when it passes. A line that fails gets its issue number beside it. A line that was not run says why and stays unticked. A deferral counts only when Jarmo writes it into **Deferred in writing** at the end.
- Mac shortcuts use ⌘. The Windows sections use Ctrl.
- **The launch rule.** Every scripted test launch of an installed candidate gets its own short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, plus `--use-mock-keychain` on the Mac, `RITEMARK_BUILD_CHANNEL=test` in the environment and a debugging port that is not 9224. Launches run in the background (`open -n -g`) with the three backgrounding flags. That keeps test folders out of the installed app's recent list (#475) and keeps test runs from counting as people (#480). Jarmo's own Gate 1 run on his own profile is the one exception (R10). The other exception is S33's `prod` payload runs, which leave out the test marker and send to the local stand-in instead.

```bash
S=/private/tmp/claude-501/rc-<name>          # short: the IPC socket path has a length limit; new for every run
mkdir -p "$S/ud/User" "$S/ext" "$S/shared"
RITEMARK_BUILD_CHANNEL=test open -n -g -a /Applications/Ritemark.app --args \
  "$FOLDER" \
  --remote-debugging-port=9411 \
  --user-data-dir="$S/ud" --extensions-dir="$S/ext" --shared-data-dir="$S/shared" \
  --use-mock-keychain \
  --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling
```

Put the folder right after `--args`. A folder placed after the backgrounding flags is read as one flag's value. In a run that does not test usage data, `{ "ritemark.features.analytics": false }` in `$S/ud/User/settings.json` turns it off before the first start. In a run that finishes the welcome, `"files.simpleDialog.enable": true` lets the folder pickers be driven, and the welcome must finish into `/private/tmp`, never `~/Documents/Ritemark`. Quit only your own instance: its command line names your `--user-data-dir`.

## Gate 1 technical: the agent, before handover

- [ ] `worktree-hygiene.mjs --check` reviewed. The dress rehearsal's worktree was removed with Jarmo's yes before this one was made (E2)
- [ ] Windows and macOS x64 CI green on `main` at the version bump's commit, before the arm64 build (S25)
- [ ] New release worktree detached at the exact `origin/main`; `release-preflight.sh` passes; "RELEASE SOURCE VERIFIED" (S26)
- [ ] `(cd extensions/ritemark && npm run check:anthropic-models)` prints OK. An ALERT stops the release, and a WARNING is handled (S17)
- [ ] The version bump's diff is 7 insertions and 7 deletions across 6 files (S19)
- [ ] `build-prod.sh` prints no "corrupted during build", does print "Extension source unchanged by the build", and leaves `vscode/extensions/ritemark` a link again (S44)
- [ ] `validate-build-output.sh` passes: the darwin-arm64 native modules, the arm64 runtimes, the fonts, and product.json's commit equal to the source commit (S44)
- [ ] The embedded provenance names the source commit. `ritemarkVersion` is `2.0.0`, and the bundled extension is floored to `2.0.0-0` (S19, R10)
- [ ] `scripts/check-google-oauth-build.mjs` passes on the built extension
- [x] `codesign-app.sh` reports 47 components (arm64; x64 48) and 0 failures. `codesign --verify --deep --strict` passes. TeamIdentifier is `JKBSC3ZDT5`, not adhoc
- [ ] DMG hard checks on the mounted image: the extension is present, `webview.js` is over 500 KB, `node_modules` holds 100 or more packages, no timestamp reads 1980, and `ritemarkVersion` is in `product.json`
- [ ] Runtime bump verified: `agent-runtime-compatibility.md`'s v2.0.0 entry names 2.1.304, 0.163.0 and 1.19.3, and `verify-agent-runtimes.sh` exits 0 (S18; a SKIP means not proven)
- [ ] DMG build time recorded in the table above. Notarization waits at least 60 minutes from it, and longer if anything new turns up (S27)

## Installation

### macOS arm64 (Gate 1)
- [ ] The DMG mounts as Ritemark, with `Ritemark.app`, the Applications link and the volume icon
- [ ] With v1.14.0 quit by ⌘Q, dragging the app to Applications replaces it
- [ ] Un-notarized, so if Gatekeeper warns: right-click ▸ **Open**. On macOS 15 and later use System Settings ▸ Privacy & Security ▸ **Open Anyway**, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`
- [ ] Runs from `/Applications`. About says 2.0.0 and names the source commit (S19)
- [ ] After notarization: `notarize-dmg.sh` exits 0 (staple, `stapler validate`, Gatekeeper). A downloaded copy of the stapled DMG opens with no warning

### macOS x64 (Gate 2)
- [ ] The DMG mounts, and the app replaces the one in Applications (S3)
- [ ] Gatekeeper is handled as on arm64 for the un-notarized build
- [ ] Runs from `/Applications`. Under Rosetta, Activity Monitor shows Kind **Intel** (D4). About says 2.0.0 and names the source commit
- [ ] After notarization: `notarize-dmg.sh` exits 0 on the x64 DMG

### Windows x64 (Gate 2)
- [ ] The installer is signed by Productory Services OÜ (Properties ▸ Digital Signatures), and the CI standard-user round trip reads `passed`
- [ ] SmartScreen does not block it. A "Windows protected your PC" warning while reputation builds is a known issue in the notes. Record what showed
- [ ] The installer says 2.0.0, runs over v1.14.0 as a standard user, and keeps the profile (S2, S19)
- [ ] Launches from the Start Menu with Ritemark's icon
- [ ] Last of all: uninstall is clean (or on a spare account)

## The base window against the baseline

R3, S9–S11, S15. This section is permanent for every shell release, because the frame rests on VS Code's internal class names and a VS Code update or a build difference can change them without warning. How to read the results: `docs/development/frame-baseline/README.md`, "Comparing a release candidate".

**The rule.** A scene over 0.5% is fixed, or Jarmo approves it, before Gate 1 passes. `frame-screenshots.mjs` exits with the number of scenes that differ by more than 0.5% or are missing from the baseline. `frame-geometry.mjs` exits with the number of failed checks. A non-zero exit leaves the line unticked (S15).

**The release images (D2).** At the frozen commit, `docs/development/frame-baseline/release/` does not exist yet, because this first candidate makes it. The dress rehearsal on `8052a182` matched 30 of 34 scenes. The other 4 are expected to read DIFFERS here too:
- More, light and dark (1.07% and 1.04%): a production build has no Copilot Chat
- The Settings foot, light and dark (3.39% and 3.37%): other runtime versions, the check time, and "Extension …-0". If a scrollbar is caught mid-fade and shifts the page 8 px, retake the capture before showing it

Jarmo approves these four as release images, or they are fixed. The approved files go into the closeout PR, because `main` is frozen. Until then, a re-run points `--release` at their local copy.

### macOS arm64 (Gate 1; S9)
- [ ] The installed candidate, launched by the launch rule on a fresh profile with the baseline's sample, freshly copied to the fixed place (move an older copy aside): `cp -R "docs/development/frame-baseline/sample-project/Harbour leadership programme" /private/tmp/ritemark-frame/` and `FOLDER="/private/tmp/ritemark-frame/Harbour leadership programme"`
- [ ] `node scripts/qa/frame-screenshots.mjs --port 9411 --out <out> --compare docs/development/frame-baseline --release docs/development/frame-baseline/release` exits 0, or every DIFFERS scene is fixed or approved by Jarmo (S9, S15). `<out>/compare.html` was looked at
- [ ] `node scripts/qa/frame-geometry.mjs --port 9411` exits 0 (rehearsal: 22 pass, 0 fail, 2 skipped; name the skips)
- [ ] `node scripts/qa/project-check.mjs --port 9411 --user-data-dir "$S/ud" --close-all --share-question` passes (rehearsal: 6/6)
- [ ] The welcome's scenes, by eye against the baseline's `*-welcome-*.png`: `welcome-screenshots.mjs --scene step-1 --then-skip` on a fresh profile with no folder, and `update-on` and `update-off` on copies of v1.14.0 profiles
- [x] More's release images, light and dark, approved by Jarmo (D2): "release pildid OK", 21 October, through the Development manager. The Settings foot matched the baseline (0.14%), so it needs none
- [ ] By eye: Ritemark Light, Ritemark Dark, Light High Contrast and Dark High Contrast show every control and border (S9)

### macOS x64 (Gate 2; S10, D4)
- [ ] Under Rosetta on the release Mac (`open --arch x86_64 -n -g -a /Applications/Ritemark.app --args …`, same launch rule), unless an Intel Mac is at hand. Machine used: Jarmo's own Mac, under Rosetta ("rosetta - approved", 21 October)
- [ ] `frame-screenshots.mjs --compare docs/development/frame-baseline --release docs/development/frame-baseline/release` exits 0, with the release images approved at Gate 1 (S10)
- [ ] `frame-geometry.mjs` exits 0 (S10)

### Windows x64 (Gate 2; S11)
- [ ] Fresh profile at 1440 × 900, with the launch rule in PowerShell: `$env:RITEMARK_BUILD_CHANNEL='test'`, then `& "<install dir>\Ritemark.exe" "<folder>" --remote-debugging-port=9411 --user-data-dir="$S\ud" --extensions-dir="$S\ext" --shared-data-dir="$S\shared"`
- [ ] Where the Windows session can run the scripts: `frame-screenshots.mjs` with `--compare docs/development/frame-baseline --release docs/development/frame-baseline/release-win32` and `frame-geometry.mjs`. The first Windows images are shown to Jarmo for `release-win32/` (D2)
- [ ] Otherwise, the screenshots compared by eye with Windows rounds 4 and 5 (D2). Which was done: not recorded; the Windows session's Gate 2 report covers the window by its items, not by the frame scripts

## The update from v1.14.0 (S1–S7)

**Harbour** is the lived-in v1.14.0 profile. It is archived at `/private/tmp/claude-501/harbour-v1.14.0.zip` and restored to `/private/tmp/claude-501/hb`, always at that exact path, because its recent list, recordings and chats use absolute paths. Every run starts from a fresh restore (move the previous `hb` aside). `hb/HARBOUR.md` says what it holds. It has no Google Docs link, no API key and no dictation model.

```bash
ditto -x -k /private/tmp/claude-501/harbour-v1.14.0.zip /private/tmp/claude-501/      # gives /private/tmp/claude-501/hb
H=/private/tmp/claude-501/hb; SH=/private/tmp/claude-501/hb-shared-<n>; mkdir -p "$SH"   # an empty shared folder per run
RITEMARK_BUILD_CHANNEL=test open -n -g -a /Applications/Ritemark.app --args \
  --remote-debugging-port=9453 --user-data-dir="$H/ud" --extensions-dir="$H/ext" --shared-data-dir="$SH" \
  --use-mock-keychain \
  --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling
```

### macOS arm64 (Gate 1)
- [ ] Harbour's two Claude sessions are in `~/.claude/projects/-private-tmp-claude-501-hb-proj-*` (copy them back from `hb/claude-sessions/` if missing)
- [ ] S1: the update welcome shows once, already signed in, with the usage switch on and "On, as you chose in Ritemark 1."
- [ ] S1: its recent projects are Harbour's three, and **Open when you left** opens the last one, Leadership programme
- [ ] S1: the places row is on top in Ritemark's order, the AI column holds only the AI, Search is in More, and the theme is still Ritemark Dark
- [ ] S1: no terminal is in the AI column. v1.14 kept no terminal, so the evidence records that a terminal tab could not be exercised
- [ ] S1: the projects list holds all three, each opens on its Home, and What moved shows once
- [ ] S4: every project, chat, card (the waiting one under Waiting for you), recording with its transcript, the flow with its schedule, and the agent is there
- [ ] S4: a 1.x chat continues in the same conversation. Expected after the runtime update: "Continuing with Claude. Previous messages were included as context."
- [ ] S4: dictation needs no new model download
- [ ] S4: the API key works without being entered again and the Google Docs link is there. Neither is in Harbour, so check them on Jarmo's own profile (S43), or record them as not run
- [ ] S5: on the second start no welcome shows and nothing in the window moves. What moved stays until Got it and never comes back after it
- [ ] S5: drag Transcribe before Browser and restart. Transcribe stays where it was put
- [ ] S6: put an older Ritemark extension copy by hand into the run's own `--extensions-dir` (Harbour's `ext/` holds none). 2.0's bundled extension runs (About, and `2.0.0-0` in the extension's log), and the older copy is not loaded
- [ ] S7 (recorded only): the v1.14.0 DMG replaces 2.0 and starts on a Harbour run after S1. v1.14.0 starts and nothing in the profile is deleted
- [ ] S7: what looks different (the places row, the AI column, an empty Open Recent) is written into the release notes' known issues, and the notes' "confirm with S7" comment is resolved
- [ ] The candidate is back in `/Applications` after S7

### macOS x64 (Gate 2; S3, D4)
- [ ] v1.14.0 x64 installed, Harbour freshly restored, and the x64 candidate's DMG replacing the app, under Rosetta (`open --arch x86_64 …`) unless an Intel Mac is at hand. Machine used: not run as an update; Jarmo's x64 check ran the app beside his arm64 install, under Rosetta
- [ ] S3: S1's checks hold
- [ ] S3: S4's checks hold
- [ ] The arm64 candidate is back in `/Applications` afterwards (one Ritemark there at a time)

### Windows x64 (Gate 2; S2)
- [ ] The Windows Harbour: made with v1.14.0 in round 5 (Part A, step 1), `%APPDATA%\Ritemark` zipped and kept on the PC; restored fresh from that zip for this run
- [ ] S2: the candidate's installer runs over v1.14.0, and S1's checks hold with Ctrl in every shortcut, Reveal in File Explorer and the frame without a title row
- [ ] S2: S4's and S5's checks hold on Windows

## Gate 1 prep on Jarmo's own Mac (S43, D3)

These steps run after Harbour has passed on this candidate (D3). **Each step needs Jarmo's yes first.** His own run is a person's run: no test marker, no isolation.

- [ ] Harbour's S1 and S4–S6 passed on this candidate
- [ ] v1.14.0 quit with ⌘Q, so the shutdown save runs
- [x] **Yes (his request to start testing, through the Development manager, 21 October):** his profile kept as copy-on-write clones in `~/Ritemark-gate1-backup-2026-10-21` (`app-support-Ritemark`, `dot-ritemark`), until after publication
- [x] Read (no writes) by the Development manager, 21 October: his profile's own recent list, `User/globalStorage/state.vscdb`, key `history.recentlyOpenedPathsList`: his 1.x list is still there
- [x] The entries that point into `/private/tmp` or a Claude scratchpad listed (the Social manager found two): `…/scratchpad/demo/Harbour Lane Bakery` and `Riverside Library Workshop`
- [x] Not removed: the Development manager left them, so they show as Not found projects, which also exercises that path
- [x] `~/.ritemark-shared` moved aside into `~/Ritemark-gate1-backup-2026-10-21/dot-ritemark-shared-moved-aside`, not deleted
- [ ] He installs the candidate over his v1.14.0 and starts it (Installation, macOS arm64)
- [ ] S43: the welcome shows once, signed in, with the usage switch as he answered 1.x's notice
- [ ] S43: his 1.x recent folders are in Open Recent and the projects list, and **Open when you left** reopens his last project
- [ ] From here on, every scripted run keeps its own `--shared-data-dir`, so nothing lands in his new `~/.ritemark-shared`

## macOS arm64: Gate 1, Jarmo's pass

### Jarmo's Mac pass (S13: 132-S4, S5, S6, S37, S38) and another macOS (S12)
- [ ] S13: moving the window by each strip (left, desk, AI) works
- [ ] S13: full screen and back
- [ ] S13: a sheet dialog (a save dialog) opens and closes in place
- [ ] S13: the native menu bar's File, Edit, View and Help
- [ ] S13: Help from You
- [ ] S13: VoiceOver reaches You and every control in the strips
- [ ] S12: on the oldest macOS at hand (13, 14 or 15), zooming in and out, full screen and back, and a restart keep the traffic lights on the strip's line. Machine: not recorded (D4)

### New in 2.0 (the release notes)
- [ ] No title row. Each strip holds its controls on one line: traffic lights, a toggle per side column, the tabs, You (S9)
- [ ] Places row: Home, Documents, Tasks, Browser, Agents, Transcribe. Dragging one moves it, and it stays after a restart (S5)
- [ ] More (⋯) holds File changes, Extensions, Search and any place that does not fit
- [ ] Tabs are as wide as their names. A full row folds into **N ⌄**. The + makes a Text, Table, Web page or Terminal tab, as do File ▸ New tab and ⌘T
- [ ] A terminal tab has Stop, Split, Clear and Close on its bar. ⌃` opens a new one. Closing one with a running command asks first
- [ ] You ▸ Settings and Help. ⌘, opens Ritemark Settings, and **Advanced settings** at its foot opens every other setting
- [ ] Menus, dialogs, the palette and notifications share one look. All commands lists no developer or debugging commands
- [ ] A narrowing window: below 1400 the AI column narrows to 320, below 1200 the left column hides, below 960 the AI hides. Widening brings them back
- [ ] File tree: no carets, taller rows, file icons that tell apart, extensions in a lighter ink
- [ ] Welcome, on a fresh profile: ChatGPT and Claude sign in with their own accounts, OpenCode with a key of your own, Claude with an Anthropic API key, or **Skip for now**
- [ ] Welcome: **Open a folder…**, **Start a new project** (Documents/Ritemark, or **Change…**) and **Try the sample project**. It never writes over an existing folder
- [ ] Welcome: lands on the project's Home with the AI's sheet on a new chat ("Ask Claude about this project", or the AI signed in)
- [ ] Welcome with the network off: the words say why (release plan, step 2)
- [ ] A later window with no folder asks "Where do you want to start?" and lists recent projects
- [ ] Help ▸ Welcome opens Ritemark's welcome. Help ▸ Getting started sits beside Support
- [ ] Home: the cover, the mark, the name and an editable line; Waiting for you; Start something; Last changed
- [ ] Home and Tasks are the first two tabs, pinned as icons. **Close all** leaves just these two. The Tasks tab shows the waiting count
- [ ] With Home chosen, the left column lists the projects with what waits in each
- [ ] Switching in the same window: each project keeps its tabs, Home offers **Go back**, and ⌥-click opens a new window
- [ ] A switch with a chat working asks first, from Home's list, the project's menu, File ▸ Open Recent and File ▸ Open Folder…. **Open in a new window** lets the AI finish. Open Folder… and Close Folder offer Cancel (the default) and Switch and stop (134-S31, 134-S33)
- [ ] A moved folder stays in the list as Not found, until **Find it…** or removal
- [ ] About this project opens or creates `AGENTS.md` from the project's menu. Your own `CLAUDE.md` changes only on **Add the line**
- [ ] Tasks are in the order Ideas, To do, Doing, Done, with what waits first
- [ ] The document's bar says **Saved**. **Share** sends a PDF or Word copy, publishes to Google Docs, or copies the document as Markdown
- [ ] PDF and Word: **Make an editable copy**, and Share on their bars
- [ ] New Text and Table land in the folder chosen in the tree, or in the project's top folder, as `Untitled.md` and `Untitled.csv`
- [ ] The share question waits on the AI's sheet, once per page, and the tabs keep working
- [ ] A reply you have not read has an amber dot on the chat rail until you open it (134-S62)
- [ ] ChatGPT by name everywhere. In comments, @codex still assigns ChatGPT
- [ ] Agents: **New → Command**, and the redrawn flow editor
- [ ] Notes' fixes: one unreadable task is listed under Couldn't read and the rest of the board loads; a sorted CSV deletes the row you chose; saving works after Use disk version
- [ ] Notes' fixes: Settings' Appearance follows the theme; a table's handles stay on their rows when scrolling; new agents, commands and skills show under @ and / without a reload
- [ ] Notes' fixes: a Markdown file opens once on the very first launch (#429), and a deleted project folder stays deleted, shown as Not found

### Looks, tabs and switching (the release plan's Gate 2 list)
- [ ] Ritemark Light, Ritemark Dark and high contrast; zoomed in and out; one desk and two; each column shown and hidden
- [ ] Many tabs fold into **N ⌄**. Close all leaves Home and Tasks. A terminal tab works. Copilot Chat from More, when installed

### What a dev build could not check (S32)
- [ ] S32: Google Docs connects with the production client (Settings and Share ▸ Google Docs)
- [ ] S32: a save problem offers Retry, and Retry works
- [ ] S32: an Excel file shows its sheet tabs, and a PowerPoint file shows its notes
- [ ] S32: the transcript workbench opens a transcript
- [ ] S32: a conversation's menu renames and pins it, and the prompt queue takes a second message
- [ ] S32: an approval card asks and works, and a sign-in card signs in
- [ ] S32: a scheduled agent runs
- [ ] S32: Claude Login and Codex's repair open their own terminal, or say why not
- [ ] S32: a line written in About this project is used by a new chat with Claude and then with ChatGPT (134-S28, 134-S44)
- [ ] S32: the share question, then a question about the shared page, answered from it (134-S55)
- [ ] S32: a message sent while the question waits carries nothing of the page (134-S57)
- [ ] S32: a reply that finishes behind another chat counts as unread until read (134-S62)
- [ ] S32: the AI reads a page's context, and clicks and fills on it (135-S26)
- [ ] An agent-driven ChatGPT turn backs up `~/.codex/config.toml` and restores it byte for byte, and stops at any keychain prompt (the 19 October rule)

### The Sprint 136 fixes (S35–S41, S47–S50)
- [ ] S35: "Draft Module 4 from the brief" (`.ritemark/tasks/m4d7r2-draft-module-4.md`) opened from Tasks. Its tab reads the title with the check-square, and the AI's chip shows the check-square and the title
- [ ] S35: the Task board's own tab keeps its kanban mark
- [ ] S35: the card's title changed on the board, and the open tab follows
- [ ] S35: `Brief.md` keeps "Brief.md" on its tab and in the chip. Known, not fixed: after a restart, a card tab that is not in front reads its file name until clicked
- [ ] S36: with `settings-e5.json` open, the chip reads "Active: settings-e5.json". Close it with another document behind, and the chip names that document
- [ ] S36: close the last document, or delete one while it is open. The chip goes, and the next message names no file
- [ ] S36: with two desks and a document in each, the chip names the active desk's document
- [ ] S37: with ChatGPT signed out, Settings' card, the welcome's ChatGPT row and the AI column's sign-in sheet name no paid plan or price, and Settings says any ChatGPT account works, Free included, with higher limits on paid plans
- [ ] S38: on a fresh English profile, "EN ⌄" sits beside the microphone, the microphone's tooltip reads "Dictate, in English", and the recent list holds English
- [ ] S38: on a fresh profile in a display language Whisper has (Estonian or German), the button shows that language, and the recent list holds it and English
- [ ] S38: pick Finnish, close the document, open another and restart. Finnish is still set, and the menu ticks it
- [ ] S38: picking a language only sets it and never starts the microphone. The next press of the microphone dictates in that language
- [ ] S39: with the left column closed, a Claude chat about `Participants.csv` ends with the column still closed, and the table keeps its width
- [ ] S39: with the left column on Home, a chat's start and end with Claude, then with ChatGPT, leave it on Home
- [ ] S39: opening Documents then lists the files the AI wrote
- [ ] S40: a turn showing "Done in …" keeps its time after a switch to another project and back, and after a restart
- [ ] S40: a conversation saved before the fix (Harbour's 1.x chat) shows "Done", never "Done in 0.0s"
- [ ] S41: with Claude Code signed out (a fresh test profile, never by signing Jarmo out), a flow with a Claude Code step names the Settings heading that holds Claude's sign-in card, and that heading exists
- [ ] S47: a scripted run with `--log trace` on a project, with Documents showing
- [ ] S47: 5,000 files created and deleted in a scratch folder in the home folder (removed afterwards), then 5,000 inside the project
- [ ] S47: the run's `window1/fileWatcher.log` asks for no recursive watch of the home folder (no "Started watching: '/Users/<you>'")
- [ ] S47: a file created outside Ritemark in the project shows in Documents within 4 s, every minute for five minutes
- [ ] S48: Harbour with a terminal that comes back: the first start has the welcome in front, the terminal a tab behind it, and "Open when you left" never lands on the terminal
- [ ] S49: a page asks to be shared; a question sent before answering waits (Working…); Share this page, and the turn answers about the page
- [ ] S49: on another page that asks, send and press Stop while the turn waits: Stopped, nothing sent
- [ ] S50: What moved on the updated profile has no Copilot Chat line

### Core regression
- [ ] Open a `.md`, type, format (⌘B, a heading, a list) and save. Saved shows, and the file on disk has the change
- [ ] Dictation starts and stops from the microphone, and the text lands in the document
- [ ] AI features work with Claude signed in (S18 below)

## Usage data (S33, S34; R10)

These are scripted runs on the arm64 candidate, which the dress rehearsal could not do (they need a fresh welcome and a stand-in). The stand-in is a small local HTTP server on `127.0.0.1:9450` that logs every `POST /batch/` body (gunzipped). A run that sends to it sets `RITEMARK_POSTHOG_PROJECT_KEY=<any>` and `RITEMARK_POSTHOG_HOST=http://127.0.0.1:9450`, so nothing leaves the Mac. The four events are welcome shown, AI signed in, project opened and first message sent.

- [ ] S33: a fresh profile with the switch on leaves the welcome for a project. The stand-in gets the four events with `build_channel: prod`. This run leaves out the test marker on purpose, so it reads prod
- [ ] S33: nothing reaches the stand-in before the welcome is left
- [ ] S33: a second fresh profile turns the switch off on the welcome, and nothing at all is sent, from any part of Ritemark
- [ ] S33: Harbour (closed with OK in v1.14.0), updated, sends the four events with `build_channel: prod`
- [ ] S33: a v1.14.0 profile that chose Opt Out, updated, sends nothing at all
- [ ] S33: one live run, with the project key given and `RITEMARK_BUILD_CHANNEL=test`, shows in PostHog's live events marked `test` (filtered by the run's time)
- [ ] S34: with `RITEMARK_BUILD_CHANNEL=test`, a fresh profile that says yes and no key given: nothing reaches Ritemark's PostHog project (live events empty at that time)
- [ ] S34: the same with the stand-in's key given: every event carries `build_channel: test`
- [ ] S34: the same build started without the variable: its events carry `build_channel: prod` (stand-in)
- [ ] S34: a fresh profile seeded with `"ritemark.features.analytics": false` sends nothing, from any part of Ritemark
- [ ] No event carries a location, a path, a name, a file, a message or an account (stand-in log read)

## The runtimes on every platform (S18)

The bundled versions are Claude Code 2.1.304, Codex 0.163.0 and OpenCode 1.19.3. Every release checks an authenticated Claude turn, a Codex turn and the OpenCode permission gate in both directions.

### macOS arm64 (Gate 1)
- [ ] S18: an authenticated Claude turn answers
- [ ] S18: a ChatGPT (Codex) turn answers
- [ ] S18: OpenCode asks before a write. Deny writes nothing, and Allow writes
- [ ] S18: `./scripts/verify-agent-runtimes.sh` exits 0 on the release Mac. Any SKIP is listed as not proven
- [ ] The Sprint 128 background probes, which need Jarmo's login (release plan, "Runtime versions")

### macOS x64 (Gate 2)
- [ ] S18: an authenticated Claude turn answers. Machine: Jarmo's Mac under Rosetta. The check list he was given included a Claude turn; whether he ran one is not recorded
- [ ] S18: a ChatGPT (Codex) turn answers
- [ ] S18: OpenCode asks before a write. Deny writes nothing, and Allow writes

### Windows x64 (Gate 2)
- [ ] S18: an authenticated Claude turn answers
- [ ] S18: a ChatGPT (Codex) turn answers, and Codex's sandbox commands run (the Windows helpers)
- [ ] S18: OpenCode asks before a write. Deny writes nothing, and Allow writes

## A fresh profile on a computer with another 2.0 build (E4, S42)

- [ ] S42: a fresh profile on a computer with another 2.0 build. The installed candidate and a dev build have both opened folders on this Mac. The candidate, started on a fresh profile with its own `--shared-data-dir`, shows an empty Open Recent, an empty welcome list and an empty projects list
- [ ] S42: `~/.ritemark-shared/sharedStorage/state.vscdb` has the same SHA-256 and modification time before and after the run
- [ ] S42 on the Windows PC: the same, with its own `--shared-data-dir`

## macOS x64: Gate 2 (D4)

D4: the x64 candidate runs under Rosetta on the release Mac with `open --arch x86_64`, unless an Intel Mac is at hand. The evidence says which machine. It is a native Intel binary, so an Intel Mac needs no Rosetta. Its other lines are in Installation, "The base window against the baseline" (S10), the update (S3) and the runtimes (S18).

- [x] Machine used: Jarmo's own Mac, under Rosetta
- [ ] Open a `.md`, type, format and save. Saved shows
- [ ] Ritemark Light and Ritemark Dark, one desk and two, each column hidden and shown
- [ ] A terminal tab from the + runs a command
- [ ] Google Docs connects with the production client

## Windows x64: Gate 2

Ctrl replaces ⌘ in every shortcut and tooltip. File, Edit, View and Help sit behind the menu button at the start of the left strip. The Windows lines for installation, the base window (S11), the update (S2), the runtimes (S18) and E4 are in their sections above.

### The frame on Windows (S11)
- [ ] S11: no title row. The menu button sits at the start of the left strip and opens by mouse, and Alt opens it from the keyboard
- [ ] S11: minimise, maximise and close sit at the right end of the AI's strip, or of the desk's strip when the AI is hidden, and all three work
- [ ] S11: dragging the strip to a screen edge snaps the window, and snap layouts show on the maximise button
- [ ] S11: every tooltip and shortcut says Ctrl
- [ ] Labels with an ellipsis (**Open a folder…**) show no stray characters
- [ ] Ritemark Light, Ritemark Dark and high contrast; zoomed in and out; one desk and two; each column shown and hidden

### The Sprint 136 fixes on Windows (S35–S41, as S46)
- [ ] S35: a task card's tab and the AI's chip show the title with the check-square. The board keeps its kanban mark. `Brief.md` keeps its name
- [ ] S36: the chip follows the document in front: after a close, after a delete, and across two desks
- [ ] S37: no paid plan or price is named on the ChatGPT card, the welcome row or the sign-in sheet, and Settings says any account works
- [ ] S38: "EN ⌄" (or the display language) beside the microphone. Picking a language only sets it, and the pick survives a restart
- [ ] S39: a turn leaves the left column closed, or on Home, and Documents lists what the AI wrote
- [ ] S40: "Done in …" survives a project switch and a restart
- [ ] S41: a signed-out Claude Code step in a flow names the right Settings heading
- [ ] S47 (Windows, light): a file created in File Explorer inside the project shows in Documents within 4 s
- [ ] S48: Harbour (Windows), restored from its zip, updated: the welcome is in front, not the "powershell" tab; "Open when you left" lands on Home or the document, never the terminal
- [ ] S49: a question sent while the share question waits waits for Share, then answers about the page; Stop while waiting ends it Stopped
- [ ] S50: What moved has no Copilot Chat line

### Windows specifics
- [ ] A fresh profile: the welcome, a provider's sign-in, the usage choice, a new project and the sample project, landing on Home with the AI ready
- [ ] Ctrl+T new tab, Ctrl+` a terminal tab, Ctrl+, Ritemark Settings, and Ctrl+Alt+I doing nothing without Copilot Chat
- [ ] Dictation starts and stops, and the text lands in the document
- [ ] Switching projects with a chat working asks first. Alt-click opens a new window
- [ ] Open a `.md`, type, format and save. Saved shows

## Everything v1.14.0 can do (S31)

Every row of the [v1.14 parity list](../../development/releases/v2.0.0/parity-v1.14.md), sections 1–13, is ticked on the candidate or deferred by Jarmo in writing, and no row is still a gap. **P** rows are checked on the arm64 candidate at Gate 1, **W** rows on the Windows candidate at Gate 2. A row marked S32 is one a dev build could not check. "Left out" rows check that the written place still reaches the function.

### macOS arm64 (Gate 1)

#### 1. The window

- [ ] **P1.01** Home's launcher → Home, first place in the row; Home's page and the projects list replace it (S31; 134-S13, S23, S40)
- [ ] **P1.02** Home: New document → Start something; the +; New ▸ Text; File ▸ New Document; ⌘N (S31; 134-S14, S40)
- [ ] **P1.03** Home: New AI conversation → the AI sheet's New chat (S31; 134-S40)
- [ ] **P1.04** Home: Task board → the Tasks place; the pinned Tasks tab; Home's Waiting for you (S31; 134-S8, S18, S21)
- [ ] **P1.05** Home: Open document… → File ▸ Open… (⌘O) (S31; 134-S40)
- [ ] **P1.06** Home: New table → Start something; the +; New ▸ Table; File ▸ New Table (S31; 134-S14)
- [ ] **P1.07** Home: Open folder… → the head's Open a folder…; Add a project…; the File menu (S31; 134-S6, S25)
- [ ] **P1.08** Home: recent documents → Home's Last changed (S31; 134-S13, S15)
- [ ] **P1.09** Home: recent folders → the projects list; File ▸ Open Recent; the welcome's lists (S31; 134-S5, S23, S54)
- [ ] **P1.10** The file list (Explorer) → Documents, with the project's head, New and Search (S31)
- [ ] **P1.11** New file, New folder → New, under the head (S31)
- [ ] **P1.12** Search across files → Search under the head; More ▸ Search (S31)
- [ ] **P1.13** Refresh the file list → All commands only (left out, 14 October) (S31; 134-S58)
- [ ] **P1.14** Open editors → the tabs; All commands (left out) (S31)
- [ ] **P1.15** A file's right-click menu → the same menu (S31)
- [ ] **P1.16** Send to AI Chat → a file's right-click menu (S31)
- [ ] **P1.17** Source control → More ▸ File changes; View menu (S31)
- [ ] **P1.18** Extensions → More ▸ Extensions; View menu (S31)
- [ ] **P1.19** `.ritemark` in the tree → hidden; tasks and flows reached through Tasks and Agents (left out) (S31)
- [ ] **P1.20** The terminal beside the AI → a tab on the desk from the + and ⌃`; none opens at start (S31)
- [ ] **P1.21** View ▸ Advanced ▸ Terminal → the + and ⌃` (left out) (S31)
- [ ] **P1.22** ⌃⇧` new terminal → the same (S31)
- [ ] **P1.23** Copilot Chat → More ▸ Copilot Chat as a tab; View ▸ Copilot Chat; ⌃⌘I; only while Copilot Chat is installed (a production build has none) (S31)
- [ ] **P1.24** The gear at the foot of the bar → You ▸ Settings; ⌘, (S31)
- [ ] **P1.25** The AI panel's gear → You ▸ Settings; ⌘, (S31)
- [ ] **P1.26** Show and hide the side columns → one toggle per strip (S31)
- [ ] **P1.27** The AI column's Maximize and … → All commands (left out, G7, Jarmo 20 October) (S31; 134-S58)
- [ ] **P1.28** The window title → the project's name in the head on every place; Home's page (S31; 134-S13, S45, S47)
- [ ] **P1.29** The breadcrumb → the tab's tooltip shows the path in the project (left out) (S31)
- [ ] **P1.30** Status bar remote and problems → Problems in the View menu (left out) (S31)
- [ ] **P1.31** Status bar: words, AI ready or offline, update ready, scheduled runs, notifications, Report AI issue → the same (S31)
- [ ] **P1.32** The empty editor's hints → an empty desk keeps its sheet, its + and the Text, Table and Web page tiles (left out) (S31)
- [ ] **P1.33** VS Code's settings page → Advanced settings at the foot of Ritemark Settings; All commands ▸ Preferences: Open Settings (G4) (S31; 134-S58, S60)

#### 2. Menus

- [ ] **P2.01** The Mac menu bar: File, Edit, View, Help → the same, native (S31; S13)
- [ ] **P2.03** File ▸ New Document, New Table (S31)
- [ ] **P2.04** File ▸ Open…, Open Folder…, Open Recent, Save, Close (S31)
- [ ] **P2.05** File ▸ New tab, Switch project, Share (the document's Share) (S31; 134-S29, S52)
- [ ] **P2.06** View ▸ File Browser → View ▸ Documents (S31)
- [ ] **P2.07** View ▸ Run → its shortcut only, ⇧⌘D (left out: Run is for code) (S31)
- [ ] **P2.08** View ▸ Chat → View ▸ Copilot Chat (S31)
- [ ] **P2.09** View ▸ Problems, Output, Debug Console → the same, in VS Code's bottom panel (S31)
- [ ] **P2.10** Help ▸ Support, View License, Toggle Developer Tools, About → the same; Support asks about no outside site (S31)
- [ ] **P2.11** New: You ▸ Settings and Help (S31)
- [ ] **P2.12** New: More (⋯) with the places that do not fit (and Copilot Chat when installed) (S31)
- [ ] **P2.13** All commands → without VS Code's developer and debugging commands; their menus still run them (S31; 134-S58)

#### 3. The first window

- [ ] **P3.01** Getting Started in an empty window → the welcome, alone in the window (S31)
- [ ] **P3.02** Getting Started: New document, table, flow → the +; New ▸ Text, Table, Flow; the empty desk's tiles (S31)
- [ ] **P3.03** Getting Started: Open folder → the welcome's step 2; the head's Open a folder… (S31)
- [ ] **P3.04** Getting Started: recent files and folders → the welcome's lists (three); the projects list; File ▸ Open Recent (S31; 134-S5, S54)
- [ ] **P3.05** Getting Started: Support link → Help ▸ Support; You ▸ Help (S31)
- [ ] **P3.06** Getting Started: Getting started and Blog → Help ▸ Getting started beside Support; the blog from ritemark.app (G1) (S31)
- [ ] **P3.07** Launch check: ChatGPT and Claude signed in → the welcome's cards; Settings' account cards (S31)
- [ ] **P3.08** Launch check: Git → Settings' This computer's tools, whatever the runtime (G2) (S31)
- [ ] **P3.09** Launch check: Node, when needed → Settings and the welcome, for this computer's runtime (S31)
- [ ] **P3.10** The usage-data notice → the welcome's switch, on by default; Settings ▸ Usage data with Privacy and Terms; a 1.x OK carried over, an Opt Out kept (S31; S33)
- [ ] **P3.11** Walkthroughs → the welcome (left out, G8, Jarmo 20 October) (S31)
- [ ] **P3.12** The AI sheet focused at start → in project windows; not while the welcome shows (S31)
- [ ] **P3.13** The AI's onboarding wizard and setup views → unchanged, for anyone who skipped the welcome (S31)

#### 4. The document editor

- [ ] **P4.01** Contents (outline), jump to a heading → the document's bar (S31)
- [ ] **P4.02** Properties: title, author, date, tags, status, description, custom → the bar's side panel (S31)
- [ ] **P4.03** Comments: count, overview, send assigned comments to the AI → the bar (S31)
- [ ] **P4.04** Agent settings for agent files → the bar (S31)
- [ ] **P4.05** Dictation: mic, language, more languages, settings, model download → the bar (S31; S38)
- [ ] **P4.06** Save problem: Review changes, Retry → the bar, in Saved's place; Retry works (S31; S32)
- [ ] **P4.07** New: Saved on the document's bar (S31; 134-S36)
- [ ] **P4.08** Export PDF, Export Word, Copy as Markdown → Share: Send a copy, Copy as Markdown (S31; 134-S37)
- [ ] **P4.09** Google Docs: Connect, Create, Sync, Open, Remove link, Reconnect → Share ▸ Google Docs, with the production client (S31; S32)
- [ ] **P4.10** Word count → the status bar (S31)
- [ ] **P4.11** Typing shortcuts, headings, undo and redo, lists, autosave → the same (S31)
- [ ] **P4.12** Slash menu, block handle, selection menu, link dialog, @ file links, ⌘-click → the same (S31)
- [ ] **P4.13** Tables, images, code blocks, Mermaid, draw.io → the same (S31)
- [ ] **P4.14** Margin comments with @ an agent → the same (S31)
- [ ] **P4.15** Find with count → the same (S31)
- [ ] **P4.16** Conflict dialog: compare, Use disk version, keep mine → the same; saving works after Use disk version (S31)

#### 5. Other kinds of file

- [ ] **P5.01** CSV and Excel grid: edit, sort, column menu, rows and columns, cell bar; a sorted delete removes the chosen row; numbers sort as numbers (S31)
- [ ] **P5.02** Excel sheet tabs, formula bar; .xls read-only, .xlsx editable (S31; S32)
- [ ] **P5.03** Open in Excel or Numbers → the bar (S31)
- [ ] **P5.04** PDF: page, zoom, fit, find → the bar (S31)
- [ ] **P5.05** PDF and Word: Save as Markdown → Make an editable copy (S31; 134-S51)
- [ ] **P5.06** New: Share on the PDF and Word bars: Show in Finder, and Open in Preview or Open in Word (S31; 134-S51)
- [ ] **P5.07** Word: pages, zoom, find, Open in Word → the bar (S31)
- [ ] **P5.08** PowerPoint: slides, notes, zoom, find, Open in PowerPoint → the bar; notes show (S31; S32)
- [ ] **P5.09** draw.io editor, flow editor, transcript workbench → tabs on the desk; the workbench opens a transcript (S31; S32)
- [ ] **P5.10** HTML: open as text, open in the browser → a file's right-click menu (S31)

#### 6. The AI

- [ ] **P6.01** The AI panel in the right side bar → the AI's sheet, alone in its column (S31)
- [ ] **P6.02** New conversation; pinned, working, needs-you and recent; All conversations → the chat rail (S31)
- [ ] **P6.03** Conversations: pin, rename, delete, move to this project → the same; the menu renames and pins (S31; S32)
- [ ] **P6.04** Example prompts → the empty sheet, naming the AI in use (S31)
- [ ] **P6.05** Message box: send, stop, resize → the same (S31)
- [ ] **P6.06** The AI and model: Claude, ChatGPT, OpenCode → the same picker (S31)
- [ ] **P6.07** Manual, Auto, Plan only → the same (S31)
- [ ] **P6.08** Thinking effort → the same, inside the sheet (S31)
- [ ] **P6.09** Attach files and images; context chips; @ agents and / commands; drag and paste → the same (S31)
- [ ] **P6.10** Prompt queue → takes a second message (S31; S32)
- [ ] **P6.11** Status line, activity, helpers, changed files, plan, questions → the same (S31)
- [ ] **P6.12** Approvals and plan reviews → an approval card asks and works (S31; S32)
- [ ] **P6.13** Sign-in, setup, repair and recovery cards; offline and compatibility notices → a sign-in card signs in (S31; S32)
- [ ] **P6.14** "You are interacting with AI" → the same (S31)
- [ ] **P6.15** AI information → the same (S31)
- [ ] **P6.16** Report AI output → the status bar; AI information (S31)

#### 7. Agents, flows and scheduled agents

- [ ] **P7.01** Agent Library: Instructions, Agents, Skills, Commands, Scheduled, Flows → the Agents place, with the project's head (S31)
- [ ] **P7.02** Collapsing a section; the + on each section → New in the head: Agent, Skill, Command, Flow (left out: "agents ok") (S31)
- [ ] **P7.03** The count line; the empty state's New skill and New agent → one muted line; New in the head (count line left out, G5) (S31)
- [ ] **P7.04** Search and Sort, always shown → Search in the head opens the field; Sort inside it (S31)
- [ ] **P7.05** Descriptions, the Claude/Codex badge, a flow's used by → each row's tooltip (S31)
- [ ] **P7.06** An agent's own icon and colour → one icon per kind, in the agent's chosen colour (S31; 134-S61)
- [ ] **P7.07** Project / User → This project / All projects (S31)
- [ ] **P7.08** A row's menu: Launch Chat, Open, Duplicate, Reveal, Move scope, Delete… → the same (S31)
- [ ] **P7.09** The agent's settings panel → the same, redrawn (S31)
- [ ] **P7.10** Scheduled agents: consent, runs, approve, open result → Agents ▸ Scheduled; a scheduled agent runs (S31; S32)
- [ ] **P7.11** Flows: create, edit, run, schedule, six kinds of step → Agents ▸ Flows; New ▸ Flow (S31)
- [ ] **P7.12** A flow's run, signed out → names where to sign in (ChatGPT step 134-S59; Claude Code step S41) (S31; S41)
- [ ] **P7.13** A flow's Note boxes → one help line under Timeout (S31)

#### 8. Tasks

- [ ] **P8.01** The Tasks place → the head, New task and Search; the list in the order work moves; a waiting task first in its stage; Archived inside Done (S31; 134-S45, S48, S49)
- [ ] **P8.02** The board tab: Your calls, Board, Ideas, Log → the same; the pinned Tasks tab (S31; 134-S18, S20, S22)
- [ ] **P8.03** Card actions: Give to agent, Review with…, Ask for changes…, Stop, Move to…, Archive, Restore, Delete…, Add files → the same (S31)
- [ ] **P8.04** The count on Tasks → the place and the Tasks tab (S31; 134-S8, S12)
- [ ] **P8.05** Add a Task… (All commands) → the same (S31)

#### 9. Transcribe and dictation

- [ ] **P9.01** Add recording, Record → the head's Transcribe a file… and Record (S31; 134-S45, S46)
- [ ] **P9.02** Engine choice, jobs, first-run set-up, model download → the same (S31)
- [ ] **P9.03** Library and All projects; Open, Open saved document, Rename…, Remove transcript, Relink → the same, under Recordings (S31; 134-S45)
- [ ] **P9.04** The gear → at the right of the Recordings label; opens Settings at the transcription card (S31; 134-S46)
- [ ] **P9.05** The transcript workbench → a tab on the desk (S31; S32)
- [ ] **P9.06** Voice dictation in documents → the document's bar (S31; S38)

#### 10. Browser

- [ ] **P10.01** The Browser place, called Recent → Browser, with the project's head and a Recent label (S31; 134-S45, S47, S50)
- [ ] **P10.02** New Browser Tab, Clear history → New page under the head; Clear history beside Recent; the + ▸ Web page; both in All commands (S31; 134-S46, S50)
- [ ] **P10.03** Recent pages: open, remove → each page a row with icon, title and domain; "No pages yet" (S31; 134-S50)
- [ ] **P10.04** The tab's bar: back, forward, reload, address, screenshot for the AI, developer tools → the same, Developer tools in the bar's ⋯ (S31)
- [ ] **P10.05** Share with the agent → the same question on the AI's sheet, not a dialog (S31; 134-S55, S56, S57)
- [ ] **P10.06** Allow control → the same dialog (S31)

#### 11. Ritemark Settings

- [ ] **P11.01** How it opens → You ▸ Settings; ⌘, (S31)
- [ ] **P11.02** Appearance: the theme cards → the same; they follow the theme (S31)
- [ ] **P11.03** Agent runtime: bundled or this computer's → the same; This computer's tools (Git, Node) (S31)
- [ ] **P11.04** Claude account: install, repair, sign in with Claude.ai or an API key, sign out, status → the same (S31)
- [ ] **P11.05** ChatGPT account: sign in, sign out, plan and credits; approval and sandbox → the same, ChatGPT in the words, earlier choices kept (S31; 134-S59)
- [ ] **P11.06** OpenCode: auto-approve → the same (S31)
- [ ] **P11.07** API keys: OpenAI, Google AI, Anthropic, OpenRouter, ElevenLabs → the same (S31)
- [ ] **P11.08** Google Docs: connect, reconnect, disconnect, template → the same, with the production client (S31; S32)
- [ ] **P11.09** Agent timeout; debug trace → the same (S31)
- [ ] **P11.10** Chat font size → the same (S31)
- [ ] **P11.11** Updates: check on start, Check now, Install or Download, Skip, Pause 7 days → the same (S31)
- [ ] **P11.12** Component readiness: voice model, Claude, Codex; clear transcription data → the same (S31)
- [ ] **P11.13** New: Usage data, with Privacy and Terms (S31; S33)

#### 12. Updates, feedback and usage data

- [ ] **P12.01** The update notice: install, skip, pause, relaunch → the same (v1.14.0 offered 2.0.0: S8, after publication) (S31)
- [ ] **P12.02** The update status bar item → the same (S31)
- [ ] **P12.03** Send Feedback (All commands) → the same; sends with usage data off (G3) (S31)
- [ ] **P12.04** Usage data on by default → the welcome's switch and Settings; nothing before the welcome is left; no location (S31; S33)
- [ ] **P12.05** Report AI output → the status bar; AI information (S31)

#### 13. Keyboard

- [ ] **P13.01** ⌘N new document; ⌘Z and ⇧⌘Z in the editor; ⌘B bold in the editor, not a column toggle (S31)
- [ ] **P13.02** ⌘, → Ritemark Settings (VS Code's settings through Advanced settings) (S31)
- [ ] **P13.03** New: ⌃` a new terminal tab; ⌃⌘I Copilot Chat as a tab, only with Copilot Chat (S31)
- [ ] **P13.04** New: ⌘T New tab (S31; 134-S52)

### Windows x64 (Gate 2)

#### 1. The window

- [ ] **W1.01** Home's launcher → Home, first place in the row; Home's page and the projects list replace it (S31; 134-S13, S23, S40)
- [ ] **W1.02** Home: New document → Start something; the +; New ▸ Text; File ▸ New Document; Ctrl+N (S31; 134-S14, S40)
- [ ] **W1.03** Home: New AI conversation → the AI sheet's New chat (S31; 134-S40)
- [ ] **W1.04** Home: Task board → the Tasks place; the pinned Tasks tab; Home's Waiting for you (S31; 134-S8, S18, S21)
- [ ] **W1.05** Home: Open document… → File ▸ Open… (Ctrl+O) (S31; 134-S40)
- [ ] **W1.06** Home: New table → Start something; the +; New ▸ Table; File ▸ New Table (S31; 134-S14)
- [ ] **W1.07** Home: Open folder… → the head's Open a folder…; Add a project…; the File menu (S31; 134-S6, S25)
- [ ] **W1.08** Home: recent documents → Home's Last changed (S31; 134-S13, S15)
- [ ] **W1.09** Home: recent folders → the projects list; File ▸ Open Recent; the welcome's lists (S31; 134-S5, S23, S54)
- [ ] **W1.10** The file list (Explorer) → Documents, with the project's head, New and Search (S31)
- [ ] **W1.11** New file, New folder → New, under the head (S31)
- [ ] **W1.12** Search across files → Search under the head; More ▸ Search (S31)
- [ ] **W1.13** Refresh the file list → All commands only (left out, 14 October) (S31; 134-S58)
- [ ] **W1.14** Open editors → the tabs; All commands (left out) (S31)
- [ ] **W1.15** A file's right-click menu → the same menu (S31)
- [ ] **W1.16** Send to AI Chat → a file's right-click menu (S31)
- [ ] **W1.17** Source control → More ▸ File changes; View menu (S31)
- [ ] **W1.18** Extensions → More ▸ Extensions; View menu (S31)
- [ ] **W1.19** `.ritemark` in the tree → hidden; tasks and flows reached through Tasks and Agents (left out) (S31)
- [ ] **W1.20** The terminal beside the AI → a tab on the desk from the + and Ctrl+`; none opens at start (S31)
- [ ] **W1.21** View ▸ Advanced ▸ Terminal → the + and Ctrl+` (left out) (S31)
- [ ] **W1.22** Ctrl+Shift+` new terminal → the same (S31)
- [ ] **W1.23** Copilot Chat → More ▸ Copilot Chat as a tab; View ▸ Copilot Chat; Ctrl+Alt+I; only while Copilot Chat is installed (a production build has none) (S31)
- [ ] **W1.24** The gear at the foot of the bar → You ▸ Settings; Ctrl+, (S31)
- [ ] **W1.25** The AI panel's gear → You ▸ Settings; Ctrl+, (S31)
- [ ] **W1.26** Show and hide the side columns → one toggle per strip (S31)
- [ ] **W1.27** The AI column's Maximize and … → All commands (left out, G7, Jarmo 20 October) (S31; 134-S58)
- [ ] **W1.28** The window title → the project's name in the head on every place; Home's page (S31; 134-S13, S45, S47)
- [ ] **W1.29** The breadcrumb → the tab's tooltip shows the path in the project (left out) (S31)
- [ ] **W1.30** Status bar remote and problems → Problems in the View menu (left out) (S31)
- [ ] **W1.31** Status bar: words, AI ready or offline, update ready, scheduled runs, notifications, Report AI issue → the same (S31)
- [ ] **W1.32** The empty editor's hints → an empty desk keeps its sheet, its + and the Text, Table and Web page tiles (left out) (S31)
- [ ] **W1.33** VS Code's settings page → Advanced settings at the foot of Ritemark Settings; All commands ▸ Preferences: Open Settings (G4) (S31; 134-S58, S60)

#### 2. Menus

- [ ] **W2.02** The Windows menu bar → the same menus behind the menu button at the start of the left strip; Alt focuses it (S31; S11)
- [ ] **W2.03** File ▸ New Document, New Table (S31)
- [ ] **W2.04** File ▸ Open…, Open Folder…, Open Recent, Save, Close (S31)
- [ ] **W2.05** File ▸ New tab, Switch project, Share, from the menu button (first check on Windows) (S31; 134-S29, S52)
- [ ] **W2.06** View ▸ File Browser → View ▸ Documents (S31)
- [ ] **W2.07** View ▸ Run → its shortcut only, Ctrl+Shift+D (left out: Run is for code) (S31)
- [ ] **W2.08** View ▸ Chat → View ▸ Copilot Chat (S31)
- [ ] **W2.09** View ▸ Problems, Output, Debug Console → the same, in VS Code's bottom panel (S31)
- [ ] **W2.10** Help ▸ Support, View License, Toggle Developer Tools, About → the same; Support asks about no outside site (S31)
- [ ] **W2.11** New: You ▸ Settings and Help (S31)
- [ ] **W2.12** New: More (⋯) with the places that do not fit (and Copilot Chat when installed) (S31)
- [ ] **W2.13** All commands → without VS Code's developer and debugging commands; their menus still run them (S31; 134-S58)

#### 3. The first window

- [ ] **W3.01** Getting Started in an empty window → the welcome, alone in the window (S31)
- [ ] **W3.02** Getting Started: New document, table, flow → the +; New ▸ Text, Table, Flow; the empty desk's tiles (S31)
- [ ] **W3.03** Getting Started: Open folder → the welcome's step 2; the head's Open a folder… (S31)
- [ ] **W3.04** Getting Started: recent files and folders → the welcome's lists (three); the projects list; File ▸ Open Recent (S31; 134-S5, S54)
- [ ] **W3.05** Getting Started: Support link → Help ▸ Support; You ▸ Help (S31)
- [ ] **W3.06** Getting Started: Getting started and Blog → Help ▸ Getting started beside Support; the blog from ritemark.app (G1) (S31)
- [ ] **W3.07** Launch check: ChatGPT and Claude signed in → the welcome's cards; Settings' account cards (S31)
- [ ] **W3.08** Launch check: Git → Settings' This computer's tools, whatever the runtime (G2) (S31)
- [ ] **W3.09** Launch check: Node, when needed → Settings and the welcome, for this computer's runtime (S31)
- [ ] **W3.10** The usage-data notice → the welcome's switch, on by default; Settings ▸ Usage data with Privacy and Terms; a 1.x OK carried over, an Opt Out kept (S31; S33)
- [ ] **W3.11** Walkthroughs → the welcome (left out, G8, Jarmo 20 October) (S31)
- [ ] **W3.12** The AI sheet focused at start → in project windows; not while the welcome shows (S31)
- [ ] **W3.13** The AI's onboarding wizard and setup views → unchanged, for anyone who skipped the welcome (S31)

#### 4. The document editor

- [ ] **W4.01** Contents (outline), jump to a heading → the document's bar (S31)
- [ ] **W4.02** Properties: title, author, date, tags, status, description, custom → the bar's side panel (S31)
- [ ] **W4.03** Comments: count, overview, send assigned comments to the AI → the bar (S31)
- [ ] **W4.04** Agent settings for agent files → the bar (S31)
- [ ] **W4.05** Dictation: mic, language, more languages, settings, model download → the bar (S31; S38)
- [ ] **W4.06** Save problem: Review changes, Retry → the bar, in Saved's place; Retry works (S31; S32)
- [ ] **W4.07** New: Saved on the document's bar (S31; 134-S36)
- [ ] **W4.08** Export PDF, Export Word, Copy as Markdown → Share: Send a copy, Copy as Markdown (S31; 134-S37)
- [ ] **W4.09** Google Docs: Connect, Create, Sync, Open, Remove link, Reconnect → Share ▸ Google Docs, with the production client (S31; S32)
- [ ] **W4.10** Word count → the status bar (S31)
- [ ] **W4.11** Typing shortcuts, headings, undo and redo, lists, autosave → the same (S31)
- [ ] **W4.12** Slash menu, block handle, selection menu, link dialog, @ file links, Ctrl+click → the same (S31)
- [ ] **W4.13** Tables, images, code blocks, Mermaid, draw.io → the same (S31)
- [ ] **W4.14** Margin comments with @ an agent → the same (S31)
- [ ] **W4.15** Find with count → the same (S31)
- [ ] **W4.16** Conflict dialog: compare, Use disk version, keep mine → the same; saving works after Use disk version (S31)

#### 5. Other kinds of file

- [ ] **W5.01** CSV and Excel grid: edit, sort, column menu, rows and columns, cell bar; a sorted delete removes the chosen row; numbers sort as numbers (S31)
- [ ] **W5.02** Excel sheet tabs, formula bar; .xls read-only, .xlsx editable (S31; S32)
- [ ] **W5.03** Open in Excel → the bar (S31)
- [ ] **W5.04** PDF: page, zoom, fit, find → the bar (S31)
- [ ] **W5.05** PDF and Word: Save as Markdown → Make an editable copy (S31; 134-S51)
- [ ] **W5.06** New: Share on the PDF and Word bars: show in File Explorer, and the open-in-app item (S31; 134-S51)
- [ ] **W5.07** Word: pages, zoom, find, Open in Word → the bar (S31)
- [ ] **W5.08** PowerPoint: slides, notes, zoom, find, Open in PowerPoint → the bar; notes show (S31; S32)
- [ ] **W5.09** draw.io editor, flow editor, transcript workbench → tabs on the desk; the workbench opens a transcript (S31; S32)
- [ ] **W5.10** HTML: open as text, open in the browser → a file's right-click menu (S31)

#### 6. The AI

- [ ] **W6.01** The AI panel in the right side bar → the AI's sheet, alone in its column (S31)
- [ ] **W6.02** New conversation; pinned, working, needs-you and recent; All conversations → the chat rail (S31)
- [ ] **W6.03** Conversations: pin, rename, delete, move to this project → the same; the menu renames and pins (S31; S32)
- [ ] **W6.04** Example prompts → the empty sheet, naming the AI in use (S31)
- [ ] **W6.05** Message box: send, stop, resize → the same (S31)
- [ ] **W6.06** The AI and model: Claude, ChatGPT, OpenCode → the same picker (S31)
- [ ] **W6.07** Manual, Auto, Plan only → the same (S31)
- [ ] **W6.08** Thinking effort → the same, inside the sheet (S31)
- [ ] **W6.09** Attach files and images; context chips; @ agents and / commands; drag and paste → the same (S31)
- [ ] **W6.10** Prompt queue → takes a second message (S31; S32)
- [ ] **W6.11** Status line, activity, helpers, changed files, plan, questions → the same (S31)
- [ ] **W6.12** Approvals and plan reviews → an approval card asks and works (S31; S32)
- [ ] **W6.13** Sign-in, setup, repair and recovery cards; offline and compatibility notices → a sign-in card signs in (S31; S32)
- [ ] **W6.14** "You are interacting with AI" → the same (S31)
- [ ] **W6.15** AI information → the same (S31)
- [ ] **W6.16** Report AI output → the status bar; AI information (S31)

#### 7. Agents, flows and scheduled agents

- [ ] **W7.01** Agent Library: Instructions, Agents, Skills, Commands, Scheduled, Flows → the Agents place, with the project's head (S31)
- [ ] **W7.02** Collapsing a section; the + on each section → New in the head: Agent, Skill, Command, Flow (left out: "agents ok") (S31)
- [ ] **W7.03** The count line; the empty state's New skill and New agent → one muted line; New in the head (count line left out, G5) (S31)
- [ ] **W7.04** Search and Sort, always shown → Search in the head opens the field; Sort inside it (S31)
- [ ] **W7.05** Descriptions, the Claude/Codex badge, a flow's used by → each row's tooltip (S31)
- [ ] **W7.06** An agent's own icon and colour → one icon per kind, in the agent's chosen colour (S31; 134-S61)
- [ ] **W7.07** Project / User → This project / All projects (S31)
- [ ] **W7.08** A row's menu: Launch Chat, Open, Duplicate, Reveal, Move scope, Delete… → the same (S31)
- [ ] **W7.09** The agent's settings panel → the same, redrawn (S31)
- [ ] **W7.10** Scheduled agents: consent, runs, approve, open result → Agents ▸ Scheduled; a scheduled agent runs (S31; S32)
- [ ] **W7.11** Flows: create, edit, run, schedule, six kinds of step → Agents ▸ Flows; New ▸ Flow (S31)
- [ ] **W7.12** A flow's run, signed out → names where to sign in (ChatGPT step 134-S59; Claude Code step S41) (S31; S41)
- [ ] **W7.13** A flow's Note boxes → one help line under Timeout (S31)

#### 8. Tasks

- [ ] **W8.01** The Tasks place → the head, New task and Search; the list in the order work moves; a waiting task first in its stage; Archived inside Done (S31; 134-S45, S48, S49)
- [ ] **W8.02** The board tab: Your calls, Board, Ideas, Log → the same; the pinned Tasks tab (S31; 134-S18, S20, S22)
- [ ] **W8.03** Card actions: Give to agent, Review with…, Ask for changes…, Stop, Move to…, Archive, Restore, Delete…, Add files → the same (S31)
- [ ] **W8.04** The count on Tasks → the place and the Tasks tab (S31; 134-S8, S12)
- [ ] **W8.05** Add a Task… (All commands) → the same (S31)

#### 9. Transcribe and dictation

- [ ] **W9.01** Add recording, Record → the head's Transcribe a file… and Record (S31; 134-S45, S46)
- [ ] **W9.02** Engine choice, jobs, first-run set-up, model download → the same (S31)
- [ ] **W9.03** Library and All projects; Open, Open saved document, Rename…, Remove transcript, Relink → the same, under Recordings (S31; 134-S45)
- [ ] **W9.04** The gear → at the right of the Recordings label; opens Settings at the transcription card (S31; 134-S46)
- [ ] **W9.05** The transcript workbench → a tab on the desk (S31; S32)
- [ ] **W9.06** Voice dictation in documents → the document's bar (S31; S38)

#### 10. Browser

- [ ] **W10.01** The Browser place, called Recent → Browser, with the project's head and a Recent label (S31; 134-S45, S47, S50)
- [ ] **W10.02** New Browser Tab, Clear history → New page under the head; Clear history beside Recent; the + ▸ Web page; both in All commands (S31; 134-S46, S50)
- [ ] **W10.03** Recent pages: open, remove → each page a row with icon, title and domain; "No pages yet" (S31; 134-S50)
- [ ] **W10.04** The tab's bar: back, forward, reload, address, screenshot for the AI, developer tools → the same, Developer tools in the bar's ⋯ (S31)
- [ ] **W10.05** Share with the agent → the same question on the AI's sheet, not a dialog (S31; 134-S55, S56, S57)
- [ ] **W10.06** Allow control → the same dialog (S31)

#### 11. Ritemark Settings

- [ ] **W11.01** How it opens → You ▸ Settings; Ctrl+, (S31)
- [ ] **W11.02** Appearance: the theme cards → the same; they follow the theme (S31)
- [ ] **W11.03** Agent runtime: bundled or this computer's → the same; This computer's tools (Git, Node) (S31)
- [ ] **W11.04** Claude account: install, repair, sign in with Claude.ai or an API key, sign out, status → the same (S31)
- [ ] **W11.05** ChatGPT account: sign in, sign out, plan and credits; approval and sandbox → the same, ChatGPT in the words, earlier choices kept (S31; 134-S59)
- [ ] **W11.06** OpenCode: auto-approve → the same (S31)
- [ ] **W11.07** API keys: OpenAI, Google AI, Anthropic, OpenRouter, ElevenLabs → the same (S31)
- [ ] **W11.08** Google Docs: connect, reconnect, disconnect, template → the same, with the production client (S31; S32)
- [ ] **W11.09** Agent timeout; debug trace → the same (S31)
- [ ] **W11.10** Chat font size → the same (S31)
- [ ] **W11.11** Updates: check on start, Check now, Install or Download, Skip, Pause 7 days → the same (S31)
- [ ] **W11.12** Component readiness: voice model, Claude, Codex; clear transcription data → the same (S31)
- [ ] **W11.13** New: Usage data, with Privacy and Terms (S31; S33)

#### 12. Updates, feedback and usage data

- [ ] **W12.01** The update notice: install, skip, pause, relaunch → the same (v1.14.0 offered 2.0.0: S8, after publication) (S31)
- [ ] **W12.02** The update status bar item → the same (S31)
- [ ] **W12.03** Send Feedback (All commands) → the same; sends with usage data off (G3) (S31)
- [ ] **W12.04** Usage data on by default → the welcome's switch and Settings; nothing before the welcome is left; no location (S31; S33)
- [ ] **W12.05** Report AI output → the status bar; AI information (S31)

#### 13. Keyboard

- [ ] **W13.01** Ctrl+N new document; Ctrl+Z and Ctrl+Shift+Z in the editor; Ctrl+B bold in the editor, not a column toggle (S31)
- [ ] **W13.02** Ctrl+, → Ritemark Settings (VS Code's settings through Advanced settings) (S31)
- [ ] **W13.03** New: Ctrl+` a new terminal tab; Ctrl+Alt+I Copilot Chat as a tab, only with Copilot Chat (S31)
- [ ] **W13.04** New: Ctrl+T New tab (S31; 134-S52)

### The user docs (S21; parity section 14)
- [ ] S21: no page in `docs/user/` names a 1.x place or word that 2.0 no longer has ("Activity Bar", "Getting Started", "Export menu", the terminal beside the AI)
- [ ] S21: no page says Codex needs a paid ChatGPT plan (`features/ai-agents.md`)
- [ ] `getting-started.md`, `troubleshooting.md` and `features/README.md`: the welcome, Documents, New and the +, and no broken `../guides/getting-started.md` link
- [ ] `setup-ai.md`, `features/ai-agents.md` and `features/keyboard-shortcuts.md`: You ▸ Settings, ⌘,; the model picker in the message box; usage data on the welcome and in Settings; ⌃`, ⌃⌘I, ⌘T
- [ ] `features/agent-library.md`, `features/flows.md`, `features/transcribe.md`, `features/task-board.md`, `features/browser.md`, `features/spreadsheets.md`, `features/export.md` and `features/google-docs.md`: the Agents place, Agents ▸ Flows, the places row, Documents, Home, Share

## After publication (not a gate)

- [ ] The privacy policy (R8): right after the GitHub release and the feed are live, the Development manager sends the Traffic manager "2.0 is live". Traffic sets `lastUpdated` (EN and ET), merges [jarmo-productory/ritemark-web#451](https://github.com/jarmo-productory/ritemark-web/pull/451) (wording approved by Jarmo in the Traffic session: "kinnitan sõnastuse, merge 2.0 päeval"; the same PR fixes "Productory Services OÜ" in llms.txt) and checks /en/privacy and /et/privacy
- [x] S8 on the Mac (23 October): v1.14.0's startup check offers "Ritemark 2.0.0 is available (729.5 MB)" with Download Installer, Later, Skip This Version and Pause 7 Days. Windows not checked
- [x] S29: the feed was made with `--existing-feed-url` naming v1.14.0; 25 entries, and every digest of the draft matched `dist/` before `--draft=false`
- [ ] S30: closeout. Every published asset matches `dist/`, the evidence is in `docs/releases/v2.0.0/evidence/`, and the worktree reads `REVIEW`

## Deferred in writing

| Line | Why | Jarmo's words, date |
|---|---|---|
| | | |

## Sign-off

| Gate | Platform | Artifact (SHA-256 as tested) | Technical (agent) | Jarmo | Notarized + stapled |
|---|---|---|---|---|---|
| Gate 1 | macOS arm64 | `72c76578071a761212ef5aaab15616ddce28e0c40ae37fef735b580ff3f2bfc8` | Passed, 21 Oct: the scripted prep (S1, S4–S6, S9, S18, S33, S34, S47–S50) on a /private/tmp copy | "gate 1 approved", typed in the release session, 21 Oct (he tested RC1 on his own Mac; #503 and #504 are 2.1 by his call) | `b9506d94-fce5-4ff2-96f7-27b04a122422`, 21 Oct, stapled |
| Gate 1 | The base window and its release images (D2) | `frame-screenshots.mjs --compare … --release …`: 32/34 the same, More 1.07% and 1.04% | geometry 34 pass, 0 fail, 2 skipped; project-check 6/6 | "release pildid OK" (through the Development manager, 21 Oct): More's two RC1 captures are the first `frame-baseline/release/` images | n/a |
| Gate 2 | macOS x64 (Rosetta, D4) | `73171e59af71a8f45cff7d5934ef324e9c843a88ebad601b48267f205c362411` | Passed, 21 Oct: CI 39598843953 green; signed against the release commit, provenance verified, 48/0 | "rosetta - approved", typed in the release session, 21 Oct | `a11f044b-a542-4d4c-bfaa-7e775dc041a6`, 21 Oct, stapled |
| Gate 2 | Windows x64 | `5364a56e7d1b5f8c60084f69039b344d28605b0d82b67ff9c7e6c735ade884fe` | CI 39598992733: fresh install, update from v1.14.0 and uninstall clean; the Windows session's Gate 2 on Jarmo's PC, all items pass (`.dev-manager/briefs/windows-gate2-report.md`) | "windows approved", typed in the release session, 22 Oct | n/a |
| Publish | All three, one publication (R8); privacy policy confirmed by the Development manager | <https://github.com/jarmo-productory/ritemark-public/releases/tag/v2.0.0>, published 2026-10-23T04:56:43Z | 8.5 and 10.1: every digest, the feed and `latest` match (`evidence/closeout.md`) | "publish - lets go live", typed in the release session, 23 October; the privacy page live before the Store submit | n/a |

**Gate 1 verdict:** passed, 21 October 2026.
**Gate 2 verdict:** passed, 22 October 2026 (x64 on 21 October, Windows on 22 October).
