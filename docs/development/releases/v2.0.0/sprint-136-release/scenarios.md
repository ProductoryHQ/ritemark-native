# Sprint 136 Scenarios

These are the manual QA matrix. Each names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it runs on the signed, not yet notarized candidate, installed as a person installs it, and never on Jarmo's own profile unless the scenario says so.

Every test launch of an installed build (S1–S33's scripted runs, the dress rehearsal, the Windows rounds) uses its own short `--user-data-dir`, its own `--shared-data-dir` (E4) and `RITEMARK_BUILD_CHANNEL=test` (R10), in the background (`open -n -g`). Jarmo's own Gate 1 run is the one exception.

Most of 2.0's behaviour is already pinned down by Sprints 132–135. R9 walks the [v1.14 parity list](../parity-v1.14.md) on the candidate; this file adds what is new about the release and this sprint's fixes.

The lived-in profile, "Harbour", is made with the installed v1.14.0 (W1): three projects ("Leadership programme", "Sales proposal Q4", "Board report 2026"), each opened so it is in the recent folders, chats in two of them, a task board with a card that waits on a decision, two recordings with a transcript, a flow with a schedule, an agent, a Google Docs link, an Anthropic API key, a terminal in the AI column, Search moved into the AI column, Agent Library dragged to the top, and Ritemark Dark chosen by hand. The usage-data notice was closed with OK.

## Feature: Updating from v1.14.0 (R1)

### S1: The Mac, from a lived-in profile
Given v1.14.0 installed in Applications with "Harbour", and Ritemark quit with ⌘Q
When the 2.0 candidate's DMG replaces the app and Ritemark starts with an empty shared data folder
Then the update welcome shows once, already signed in, with the usage-data switch on and "On, as you chose in Ritemark 1."
And its recent projects are Harbour's three, and after "Open when you left" the last of them opens
And the places row is on top in Ritemark's order, the AI column holds only the AI, the terminal is a tab, Search is in More, and the theme is still Ritemark Dark
And the projects list holds all three projects, each opening on its Home, and What moved shows once.

### S2: Windows, from a lived-in profile
Given v1.14.0 installed from the direct download on the Windows PC with a "Harbour" profile made there
When the 2.0 candidate's installer runs over it
Then S1's checks hold, with Ctrl in every shortcut, Reveal in File Explorer, and the frame without a title row.

### S3: The x64 build
Given v1.14.0 x64 and a "Harbour" profile, on an Intel Mac where one is at hand, otherwise on the release Mac under Rosetta (`open --arch x86_64`, D4)
When the x64 candidate's DMG replaces the app
Then S1's checks hold, and the evidence says which machine ran them.

### S4: Nothing is lost (negative)
Given S1, S2 and S3
Then every project, chat, card, recording and transcript, flow and its schedule, agent and Google Docs link is there
And the API key works without being entered again, and dictation needs no new model download
And a chat continues in the same conversation.

### S5: The second start
When Ritemark is quit and started again after S1 and S2
Then no welcome and no What moved show, and nothing in the window moves
When the person drags Transcribe before Browser and restarts
Then Transcribe stays where they put it.

### S6: An earlier extension release in the user directory (negative)
Given a v1.14.0 profile with an older Ritemark extension copy in the user directory
When 2.0 starts
Then 2.0's bundled extension runs (its version in the About dialog and the extension's log), and the older copy is not loaded.

### S7: Going back (recorded only)
Given "Harbour" after S1
When v1.14.0's DMG replaces 2.0 and Ritemark starts
Then v1.14.0 starts and nothing in the profile is deleted
And whatever looks different (the places row, the AI column, the recent folders) is written into the release notes' known issues.

### S8: The update offer, after publication
Given v1.14.0 on the Mac and on Windows, after 2.0 is published
When the person runs Check for updates
Then 2.0.0 is offered with its summary, and Download opens the published DMG or installer
And Skip and Pause behave as in 1.14.

## Feature: Looks on the signed builds (R2)

### S9: The arm64 candidate, light, dark and high contrast
Given the installed arm64 candidate launched in the background with its own short profile, shared data folder and debugging port, on a fresh profile with the baseline's sample project
When `frame-screenshots.mjs --compare` and `frame-geometry.mjs` run
Then every scene is within 0.5% of the approved baseline, More's two scenes of their release-only images (D2), and the geometry gives Sprint 132's numbers
And by eye, Ritemark Light, Ritemark Dark, Light High Contrast and Dark High Contrast show every control and border.

### S10: The x64 candidate
Given the installed x64 candidate on an Intel Mac, or under Rosetta on the release Mac (D4)
Then S9 holds.

### S11: The Windows installer
Given the installed Windows candidate on a fresh profile, 1440 × 900
When the person uses the menu by mouse and by Alt, the window buttons, dragging the strip to a screen edge and snap layouts, and the frame scripts run where the Windows session can run them
Then each works, and the scenes are within 0.5% of the Windows baseline, or match the last Windows round's screenshots by eye (D2).

### S12: Another macOS
Given the arm64 candidate on the oldest macOS at hand (13, 14 or 15; D4)
When the person zooms in and out, goes full screen and back, and restarts
Then the traffic lights stay on the strip's line at every step.

### S13: Jarmo's Mac pass (Sprint 132's open rows)
Given the arm64 candidate on Jarmo's Mac
When Jarmo moves the window by each strip, goes full screen and back, opens a sheet dialog (a save dialog), uses the native menu bar, opens Help from You, and reaches You with VoiceOver
Then each works as Sprint 132's S4, S5, S6, S37 and S38 describe.

## Feature: The screenshot comparison in the checklist (R3)

### S14: The checklist carries it
When `docs/releases/v2.0.0/TEST-CHECKLIST.md` is generated at the first candidate
Then it has the section "The base window against the baseline", with the launch (its own profile, `--shared-data-dir`, `RITEMARK_BUILD_CHANNEL=test`, a debugging port), the two script runs on the Mac and on Windows, and the 0.5% rule
And the release skill's Step 2 and the `release-manager` agent's checklist rules both name it.

### S15: A difference stops the gate (negative)
Given the comparison run on a candidate where one scene differs by more than 0.5% (for a dry run, a theme colour changed by hand in a scratch profile)
Then the script's exit code is not 0, the checklist row is not ticked, and Gate 1 does not pass until the scene is fixed or Jarmo approves it.

## Feature: The runtime review (R4)

### S16: The review
When the review runs
Then a table names each runtime's version in v1.14.0, the latest version and its main changes since, and Jarmo's decision is recorded beside it.

### S17: `check:anthropic-models`
When `npm run check:anthropic-models` runs on the release source
Then it prints OK, or each WARNING is handled and each ALERT is cleared or deferred by Jarmo in writing.

### S18: The runtimes on every platform
Given the dress rehearsal's build for darwin-arm64, and the candidates for darwin-arm64, darwin-x64 and Windows
Then an authenticated Claude turn, a Codex turn and the OpenCode permission gate each work, and `verify-agent-runtimes.sh` passes on the release Mac.

## Feature: Version 2.0.0 (R5)

### S19: Six files, one version
When the version bump's diff is read
Then it changes 7 lines in 6 files and nothing else
And the About dialog, the embedded provenance and the Windows installer say 2.0.0, About names the source commit, and the feed's new entry is 2.0.0.

## Feature: Notes and docs (R6)

### S20: The notes cover everything
Given the list of PRs merged from `v1.14.0` to the candidate's commit
Then every one that changes the product is in the release notes or in the changelog
And the notes say what moved for someone updating, and the known issues (S7, #417, #454, anything a gate deferred)
And the GitHub release body shows every image (absolute URLs) and differs from the notes only by those URLs.

### S21: The user docs
When the tester reads each page in `docs/user/` against the candidate
Then no page names a 1.x place or word that 2.0 no longer has ("Activity Bar", "Getting Started", "Export menu", the terminal beside the AI)
And no page says Codex needs a paid ChatGPT plan.

## Feature: The Microsoft Store (R7)

### S22: The installer at its own URL
When the released installer is uploaded to `windows/v2.0.0/Ritemark-Setup.exe`
Then an anonymous download returns HTTP 200 with no redirect, the expected size and the released SHA-256, and a second upload plan refuses the existing key.

### S23: The brief and Partner Center
When the Store brief (the package URL and SHA-256, What's new, the certification notes, the listing copy, the screenshots and captions) is handed to Jarmo
Then he submits it through his ChatGPT flow, Partner Center's package validation runs, and the result ("Update in review") is recorded in `STATUS.md`.

### S24: After certification
When the Store publishes 2.0
Then a Store-origin install launches, edits and saves a document, and uninstalls
And a v1.14.0 Store install updates to 2.0 with its profile, as S2.

## Feature: The gates (R8)

### S25: CI first
Before the arm64 candidate is built
Then `build-windows.yml` and `build-macos-x64.yml` are green on `main` at the version bump's commit.

### S26: The candidate's source
When `create-release-worktree.sh` and `release-preflight.sh` run
Then the worktree is detached at exact `origin/main`, every patch applies on the pinned VS Code, and the build's provenance names that commit.

### S27: Gate 1, then hardening
Given the signed, not notarized arm64 DMG
When Jarmo approves Gate 1
Then notarization starts no sooner than 60 minutes after the DMG was built, and only if nothing new was found.

### S28: A fix during the gate (negative)
Given a defect found at Gate 1 or Gate 2
Then the fix merges to main, a new candidate is built in a new worktree, and the gate and the hardening window start again.

### S29: Draft first
When the release is created
Then it is a draft until the binaries and the feed are uploaded and every digest matches `dist/`
And the feed keeps every older entry (it was generated with `--existing-feed-url` naming v1.14.0).

### S30: Closeout
After publication
Then every published asset matches `dist/`, the evidence is in `docs/releases/v2.0.0/evidence/`, and the release worktree reads `REVIEW`.

## Feature: Everything v1.14.0 can do (R9)

### S31: The parity list on the candidate
When the tester walks every row of the parity list on the arm64 candidate, and the Windows rows on the Windows candidate
Then every row is ticked, or deferred by Jarmo in writing
And no row is still marked as a gap.

### S32: What a dev build could not check
On the candidate
Then Google Docs connects with the production client, a save problem offers Retry, an Excel file shows its sheet tabs, a PowerPoint file shows its notes, the transcript workbench opens a transcript, a conversation's menu renames and pins it, the prompt queue takes a second message, an approval card asks and works, a sign-in card signs in, and a scheduled agent runs
And Claude Login and Codex's repair open their own terminal or say why not
And with real sign-ins: a new chat with Claude, then with ChatGPT, uses a line written in About this project; the share question, then a question about the shared page answered from it; a switch of project with a chat working; a reply that finishes behind another chat counts as unread; the AI reads a page's context and clicks and fills on it.

## Feature: Usage data (R10)

### S33: Yes, no, and 1.x answers
Given a local stand-in for PostHog that records each request (`RITEMARK_POSTHOG_PROJECT_KEY` and `_HOST`)
When a fresh profile says yes on the welcome, a second fresh profile says no, and "Harbour" (closed with OK) and a v1.14.0 profile that opted out are updated
Then the yes profile and "Harbour" send the four events with `build_channel: prod`
And the no profile and the opted-out profile send nothing at all
And one live run to PostHog, marked `test`, arrives in PostHog's live events.

### S34: Our own runs are marked (#480)
Given the installed candidate launched with `RITEMARK_BUILD_CHANNEL=test` and a fresh profile that says yes
Then every event it sends carries `build_channel: test`
When the same build starts without the variable
Then its events carry `build_channel: prod`
And a fresh profile seeded with `"ritemark.features.analytics": false` sends nothing, from any part of Ritemark.

## Feature: The fixes before the candidate (R11)

### S35: A task card's tab (#477)
Given a project whose board has "Draft Module 4 from the brief", stored as `.ritemark/tasks/m4d7r2-draft-module-4.md`
When the card is opened from Tasks
Then its tab reads "Draft Module 4 from the brief", and the AI's chip reads "Active: Draft Module 4 from the brief"
When the card's title is changed on the board
Then the open tab follows
And a plain Markdown file, `Brief.md`, keeps "Brief.md" on its tab and in the chip.

### S36: The chip follows the document in front (#485, negative)
Given `settings-e5.json` open, and the chip reading "Active: settings-e5.json"
When the file is closed with another document behind it
Then the chip names that document
When the last document is closed, or a document is deleted while open
Then the chip is gone, and the next message names no file
When the person moves between two desks with a document in each
Then the chip names the document in front of the active desk.

### S37: Codex on a free account (#482)
When the tester reads Settings' ChatGPT card signed out, the welcome's ChatGPT row, and the AI column's ChatGPT sign-in sheet
Then none says a paid plan is needed or names a price, and Settings says any ChatGPT account works, Free included, with higher limits on paid plans.

### S38: Dictation's first language (#486)
Given a fresh profile with Ritemark's display language English
Then the editor's dictation button shows EN, and the recent list holds English
Given a fresh profile with a display language Whisper has (for example Estonian or German)
Then the button shows that language, and the recent list holds it and English
When the person picks Finnish, closes the document, opens another one and restarts Ritemark
Then Finnish is still set
And picking a language in the menu does what the Experience lead decided, and the menu shows which language is set.

### S39: The left column stays where it is (#487, negative)
Given the left column closed, and a chat with Claude about Participants.csv
When the turn ends
Then the left column is still closed, and the table keeps its width
Given the left column open on Home
When a chat starts and its turn ends, with Claude, then with ChatGPT
Then the left column still shows Home
When the person then opens Documents
Then the files the AI wrote are listed.

### S40: A restored chat's time (#488)
Given a turn that shows "Done in 8s"
When the person switches to another project and back, and then restarts Ritemark
Then it still shows "Done in 8s"
And a conversation saved before this fix shows "Done", never "Done in 0.0s".

### S41: A flow's Claude Code step, signed out (#459, G6)
Given Claude Code signed out and a flow with a Claude Code step
When the flow runs
Then its error names the Settings heading that holds Claude's sign-in card, and that heading exists.

## Feature: Recent folders and the build (E4, E5)

### S42: A fresh profile on a computer with another 2.0 build (#475)
Given the installed candidate and a dev build that have both opened folders on this Mac
When the candidate starts on a fresh profile with its own `--shared-data-dir`
Then Open Recent, the welcome's list and the projects list are empty
And the installed app's own recent list (`~/.ritemark-shared/sharedStorage/state.vscdb`) is the same before and after the run.

### S43: Jarmo's own Mac before Gate 1 (#475, D3)
Given Jarmo's yes, a copy of his profile folder, and `~/.ritemark-shared` moved aside (not deleted)
When he installs the candidate over his v1.14.0 and starts it
Then his 1.x recent folders are in Open Recent and the projects list, and "Open where you left" reopens his last project.

### S44: The build leaves our source alone (#471)
When `build-prod.sh` runs in the dress rehearsal's worktree
Then it prints no "corrupted during build" warning, the digest of `extensions/ritemark` is the same before and after gulp, `vscode/extensions/ritemark` is a link again afterwards, and `validate-build-output.sh` passes
When a file under `extensions/ritemark` is changed by hand while gulp runs (a dry run in a scratch build)
Then the build stops and names that file.

### S45: The dress rehearsal (E3)
Given main after this sprint's fixes and the runtime update merged
When a clean-room production build of main's commit is made and run in the background
Then Sprint 135's E5 app checks pass (no agent host at launch, a terminal answers, code is coloured, the code cache fills, About names the commit), S1, S4, S5, S6 and S18 (arm64) pass with "Harbour", and R3's section runs against it
And macOS x64 CI and Windows CI are green on the same commit.

### S46: Windows on the dress rehearsal's installer
Given the Windows installer from S45's CI run, on the Windows PC
When the Windows session runs this sprint's fixes (S35–S41, with Ctrl) and S2 with a Windows "Harbour"
Then each passes, or its defect is fixed on main before the version bump.
