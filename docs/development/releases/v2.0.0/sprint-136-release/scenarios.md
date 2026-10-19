# Sprint 136 Scenarios

These are the manual QA matrix. Each names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it runs on the signed, not yet notarized candidate, installed as a person installs it, and never on Jarmo's own profile unless the scenario says so.

Most of 2.0's behaviour is already pinned down by Sprints 132–135. R9 walks the [v1.14 parity list](../parity-v1.14.md) on the candidate; this file adds what is new about the release.

The lived-in profile, "Harbour", is made with the installed v1.14.0 (W1): three projects ("Leadership programme", "Sales proposal Q4", "Board report 2026"), chats in two of them, a task board with a card that waits on a decision, two recordings with a transcript, a flow with a schedule, an agent, a Google Docs link, an Anthropic API key, a terminal in the AI column, Search moved into the AI column, Agent Library dragged to the top, and Ritemark Dark chosen by hand. The usage-data notice was closed with OK.

## Feature: Updating from v1.14.0 (R1)

### S1: The Mac, from a lived-in profile
Given v1.14.0 installed in Applications with "Harbour", and Ritemark quit with ⌘Q
When the 2.0 candidate's DMG replaces the app and Ritemark starts
Then the update welcome shows once, already signed in, with the usage-data switch on and "On, as you chose in Ritemark 1."
And after "Open when you left", the places row is on top in Ritemark's order, the AI column holds only the AI, the terminal is a tab, Search is in More, and the theme is still Ritemark Dark
And the projects list holds all three projects, each opening on its Home, and What moved shows once.

### S2: Windows, from a lived-in profile
Given v1.14.0 installed from the direct download on the Windows PC with a "Harbour" profile made there
When the 2.0 candidate's installer runs over it
Then S1's checks hold, with Ctrl in every shortcut, Reveal in File Explorer, and the frame without a title row.

### S3: An Intel Mac
Given an Intel Mac with v1.14.0 x64 and a "Harbour" profile (where one is at hand)
When the x64 candidate's DMG replaces the app
Then S1's checks hold. If no Intel Mac is at hand, the evidence says so.

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
And whatever looks different (the places row, the AI column) is written into the release notes' known issues.

### S8: The update offer, after publication
Given v1.14.0 on the Mac and on Windows, after 2.0 is published
When the person runs Check for updates
Then 2.0.0 is offered with its summary, and Download opens the published DMG or installer
And Skip and Pause behave as in 1.14.

## Feature: Looks on the signed builds (R2)

### S9: The arm64 candidate, light, dark and high contrast
Given the installed arm64 candidate launched in the background with its own short profile and a debugging port, on a fresh profile with the baseline's sample project
When `frame-screenshots.mjs --compare` and `frame-geometry.mjs` run
Then every scene is within 0.5% of the release baseline (D2), and the geometry gives Sprint 132's numbers
And by eye, Ritemark Light, Ritemark Dark, Light High Contrast and Dark High Contrast show every control and border.

### S10: The x64 candidate
Given the installed x64 candidate on an Intel Mac (where one is at hand)
Then S9 holds.

### S11: The Windows installer
Given the installed Windows candidate on a fresh profile, 1440 × 900
When the frame scripts run, and the person uses the menu by mouse and by Alt, the window buttons, dragging the strip to a screen edge and snap layouts
Then each works, and the scenes are within 0.5% of the Windows baseline (D2).

### S12: Another macOS
Given the arm64 candidate on the oldest macOS at hand (13, 14 or 15; D7)
When the person zooms in and out, goes full screen and back, and restarts
Then the traffic lights stay on the strip's line at every step.

### S13: Jarmo's Mac pass (Sprint 132's open rows)
Given the arm64 candidate on Jarmo's Mac
When Jarmo moves the window by each strip, goes full screen and back, opens a sheet dialog (a save dialog), uses the native menu bar, opens Help from You, and reaches You with VoiceOver
Then each works as Sprint 132's S4, S5, S6, S37 and S38 describe.

## Feature: The screenshot comparison in the checklist (R3)

### S14: The checklist carries it
When `docs/releases/v2.0.0/TEST-CHECKLIST.md` is generated at the first candidate
Then it has the section "The base window against the baseline", with the launch, the two script runs on the Mac and on Windows, and the 0.5% rule
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
Given the candidates for darwin-arm64, darwin-x64 and Windows
Then an authenticated Claude turn, a Codex turn and the OpenCode permission gate each work, and `verify-agent-runtimes.sh` passes on the release Mac.

## Feature: Version 2.0.0 (R5)

### S19: Six files, one version
When the version bump's diff is read
Then it changes 7 lines in 6 files and nothing else
And the About dialog, the embedded provenance and the Windows installer say 2.0.0, and the feed's new entry is 2.0.0.

## Feature: Notes and docs (R6)

### S20: The notes cover everything
Given the list of PRs merged from `v1.14.0` to the candidate's commit
Then every one that changes the product is in the release notes or in the changelog
And the notes say what moved for someone updating, and the known issues
And the GitHub release body shows every image (absolute URLs) and differs from the notes only by those URLs.

### S21: The user docs
When the tester reads each page in `docs/user/` against the candidate
Then no page names a 1.x place or word that 2.0 no longer has ("Activity Bar", "Getting Started", "Export menu", the terminal beside the AI).

## Feature: The Microsoft Store (R7)

### S22: The installer at its own URL
When the released installer is uploaded to `windows/v2.0.0/Ritemark-Setup.exe`
Then an anonymous download returns HTTP 200 with no redirect, the expected size and the released SHA-256, and a second upload plan refuses the existing key.

### S23: Partner Center
When the package URL, What's new, the certification notes, the listing copy and the screenshots are updated
Then Partner Center's package validation runs, and only Jarmo's action-time yes for the exact URL and SHA-256 submits it
And the result ("Update in review") is recorded.

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
And Claude Login and Codex's repair open their own terminal or say why not.

## Feature: Usage data (R10)

### S33: Yes, no, and 1.x answers
Given a stand-in for PostHog that records each request, or PostHog's live events filtered to this run
When a fresh profile says yes on the welcome, a second fresh profile says no, and "Harbour" (closed with OK) and a v1.14.0 profile that opted out are updated
Then the yes profile and "Harbour" send the four events with `build_channel: prod`
And the no profile and the opted-out profile send nothing at all.
