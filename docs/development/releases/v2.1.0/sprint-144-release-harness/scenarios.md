# Sprint 144 Scenarios

Each scenario names its requirement. "Here" is the Mac this sprint runs on; "the Windows session" is the "Ritemark on Windows" session on Jarmo's PC, reached through the Development manager.

## Feature: The Windows build on the public repository (R1, E1–E4)

### S1: A release build of main, with the repository public
Given `main` is at commit C and the repository is public
When `gh workflow run build-windows.yml --ref main -f source_commit=C` is dispatched
Then the job runs on `windows-latest`
And every step passes, from the canonical-source gate to the standard-user install, update from v1.14.0, start and uninstall
And the run's artifact holds `Ritemark-Setup.exe`, `Ritemark-Setup.sha256.txt` and the round-trip evidence

### S2: The stars survive the build
Given the repository's `visibility`, `stargazers_count` and `subscribers_count` were read just before S1's dispatch
When S1's run has finished
Then all three read the same
And the repository's audit trail shows no visibility change in between (`gh api repos/ProductoryHQ/ritemark-native --jq .visibility` before and after; no `gh repo edit` in the run's commands or the release steps)

### S3: Provenance names the ritemark-native commit
Given S1's artifact
When `Ritemark-Setup.sha256.txt` is read
Then `source_commit` is C and `workflow_commit` is the harness commit the run used
And the build's embedded provenance passed `build-provenance.mjs --verify` inside the run

### S4: Signing covers what it covered on the 8-core runner
Given S1's run log and the previous green run on `windows-8core` (40079413435, 2.0.1)
When their "Find unsigned Windows binaries" catalogs and "Verify signed payload" results are compared
Then the same set of PE files was signed, catalog-only PEs were handled the same way (#483), and every PE verifies with publisher "Productory Services OÜ"

### S5: A missing signing secret still stops the build (negative)
Given the workflow after R1
When its "Require signing credentials" step meets an empty `AZURE_SIGNING_*` secret
Then it throws "Required repository secret … is missing." before the build starts, as today
(Proven by reading the step, which R1 doesn't touch; not re-run, since emptying a real secret would change the repository's settings.)

### S6: Nobody outside can run the build (negative)
Given a fork's pull request
When it opens against `main`
Then `build-windows.yml` doesn't run (it is `workflow_dispatch` only) and no repository secret reaches the fork's workflows

### S7: The free runner's limits, measured
Given A1's probe run on the scratch branch (unsigned, no secrets, no installer upload)
When its report is read
Then it records the runner's processors, memory and drives, the lowest free disk on each drive and the lowest free memory during the build, and every step's duration
And R1's time limit and working drive come from those numbers

### S8: The budget isn't touched
Given the Actions usage for the month before S1
When S1 has finished
Then "Actions Windows 8-core" minutes haven't grown (`gh api /orgs/ProductoryHQ/settings/billing/usage?year=YYYY&month=MM`)

## Feature: The newest Electron 43 (R3, R4)

### S9: About names the new Electron and Node, on the Mac
Given a production arm64 build from the sprint's merge commit (a release worktree) or a dev launch of the branch
When Help ▸ About opens
Then it reads "Electron: 43.8.3" (or the newer 43.x the patch names) and "Node.js: 24.22.0" (or 24.22.1)
And the extension host's `process.versions.node` is the same

### S10: A wrong checksum stops the build (negative)
Given the patch's `build/checksums/electron.txt` with one Electron zip's hash altered (a scratch copy, never committed)
When the gulp packaging step downloads Electron
Then it fails on the checksum, and no app is packaged

### S11: The native modules load on the new Electron
Given the built app on the Mac (native modules built against the new headers) and S1's Windows install (native modules built against 43.7.7's headers, the same ABI 148)
When a terminal tab opens, a setting is changed and the app restarted, a file is changed outside Ritemark while it's open, and the logs are read
Then the terminal works (node-pty), the setting persists (sqlite), the editor shows the outside change (@parcel/watcher), and the log has no `NODE_MODULE_VERSION` or "was compiled against a different Node.js version" error

### S12: The integrated browser and the AI runtimes on the new Electron
Given the build from S9 or S11
When the integrated browser opens a page, the AI is asked to click and fill on it (with the share question answered), and Claude, ChatGPT (Codex) and OpenCode each answer one message
Then each works as on 2.0.1

### S13: The patch is canonical
Given a pristine VS Code at the pin `d956e8a6`
When `./scripts/apply-patches.sh --dry-run` runs, then `./scripts/apply-patches.sh`, then the pre-commit validator
Then all 19 patches apply in order, patch 020 changes only `.npmrc`, `build/checksums/electron.txt` and `cgmanifest.json`, and the validator passes

### S14: The packaged Electron matches the target, or the build fails (R3, negative)
Given `validate-build-output.sh` with R3's check, and a packaged app whose Electron version differs from `vscode/.npmrc`'s target (a scratch copy with the target edited after packaging)
When the script runs for that target
Then it fails, naming both versions
And where A3 found no readable version for a target, it prints that the check runs at Gate 1 or Gate 2 instead

### S15: Electron publishes the fix before the version bump
Given Electron has published a 43.x with Node 24.22.1 and 2.1's version bump hasn't merged
When patch 020's `target` and checksum file move to it and S9, S11 and S13 run again
Then About reads Node 24.22.1 on the Mac and on Windows, and #515 can close with the candidate

### S16: Electron doesn't publish it in time
Given the version bump is next and no 43.x with Node 24.22.1 exists
When the release plan is updated
Then its #515 risk row names the Electron 2.1 ships, the CVEs it still carries and the one outside-URL path (R4), #515 stays open, and the release notes don't claim the fix

## Feature: The done list's Windows checks before the candidate (R5)

### S17: A synced folder on Windows (#499)
Given S1's signed installer on the Windows PC, and a OneDrive (or SharePoint) synced folder with at least one online-only file
When the welcome opens that folder as a project, a document is edited and saved, and the AI edits another
Then the folder opens, the online-only file opens (downloading), the saves ask nothing, and the AI's write raises no conflict (Sprint 137's R11)

### S18: The Windows first window, fresh and after 2.0.1 (#276)
Given S1's installer
When it is installed on a fresh profile, and separately over 2.0.1 with a lived-in profile
Then the first window opens on the welcome (fresh) or Home (update), with the AI in view, not on a terminal or an empty desk

### S19: The first start after 1.14 with a terminal (#501)
Given a v1.14.0 install whose AI column had a terminal at quit
When S1's installer updates it and the app starts the first time
Then the time a restored terminal is in front before the welcome is recorded (2.0's retest: 6–14 s); if it is in front at all after the welcome appears, #501 is a 2.1 bug with that recording

### S20: A synced folder on the Mac (#499, with the manager's OK)

*Moved to Gate 2 on the RC (the manager, 27 October): macOS's File Provider consent is per app, so it is answered on the signed candidate by Jarmo; the work tenant's OneDrive stays out. See `qa-evidence.md`.*

Given a dev build here, and a new empty folder "Ritemark 2.1 sync test" inside this Mac's OneDrive folder and one inside its Google Drive folder
When the welcome opens each as a project, a document is created, edited and saved, and the AI edits it
Then each opens, the saves ask nothing, and the AI's write raises no conflict
And the test folders are left in place for Jarmo to remove (nothing is deleted here)

## Feature: The AI sheet's sign-in card (P1)

### S21: The sign-in buttons match the rest of Ritemark
Given a dev launch with Claude and ChatGPT installed and neither signed in, the AI's sheet open, in Light and then Dark
When the sign-in card shows
Then "Sign in with Claude.ai", "Use API key" and "Sign in with ChatGPT" are the shared `Button`, each icon the colour of its words, at rest, on hover and with the pointer down
And each shows its tooltip on hover

### S22: Re-check, Install and Retry
Given the step-1 card with one AI not installed, and then an install that failed
When the card shows
Then Install, Retry and Re-check are the shared `Button` (link style), with tooltips, and still do what they did (S23)

### S23: The handlers are unchanged
Given `OnboardingWizard` rendered in a unit test with spies for every callback
When each button is clicked
Then the same callback fires as before the change, once

## Feature: Settings' AI cards (P2)

### S24: No "Experimental" on the main AIs
Given Settings ▸ API Keys in Light and Dark
When the Claude Account and ChatGPT Account cards show
Then neither has a badge, and "Connected" still shows for a signed-in AI
And every feature that worked before still works (no flag changed)

## Feature: The status bar's AI item (P3)

### S25: A fresh profile that chose Skip
Given a fresh profile, online, whose welcome ended with Skip
When the first window settles
Then the item reads "No AI yet", tooltip "Sign in to an AI to work with it here"
And a click opens the AI's sheet on its sign-in card

### S26: Signing in names the AI
Given S25's window
When the person signs in to ChatGPT on the sheet
Then within two seconds the item reads "ChatGPT ready", tooltip "Signed in to ChatGPT"

### S27: Two AIs, two chats
Given Claude and ChatGPT both signed in, a chat with Claude and a chat with ChatGPT open
When the person switches between them, and then starts a new chat
Then the item reads "Claude ready" or "ChatGPT ready" for the chat in front, and for the new chat the AI it starts with

### S28: OpenCode by key
Given only an OpenCode provider key saved, and OpenCode the default
When the window starts, and then the key is removed in Settings
Then the item reads "OpenCode ready", and then "No AI yet"

### S29: Offline comes first
Given "Claude ready"
When the internet goes and the probe fails twice
Then the item reads "Offline", in body ink, no warning background, tooltip "No internet. Your documents work as usual and save on this computer."
And when the internet comes back, "Claude ready" again

### S30: A sign-in that ended
Given a chat with Claude whose last turn failed with a sign-in error (forced in a test profile with its own isolated Claude home, never the person's)
When the turn ends
Then the item reads "Claude: sign in again", and after a message goes through, "Claude ready"

### S31: Right before the sheet opens
Given a window whose AI sheet hasn't been opened since start
When the item first shows
Then it already names the default AI's state, never "AI Ready"

### S32: The words (negative)
Given the unit test of the item's states
When every state is rendered
Then no text or tooltip contains "AI", "service" or "connected", except "No AI yet"; and "needs a paid plan" is rendered only from a plan-refusal input, which nothing sends today

## Feature: The Flow editor's step panel (P4)

### S33: The fields are whole
Given the P4 harness at 784 × 800 and 784 × 824 with the branch's rebuilt bundle, an LLM step selected
When the panel shows, and is scrolled to its end
Then no field is crossed by the panel's edge, and the Delete row comes after Max Tokens

### S34: The model picker is usable at once
Given the harness with the host's answer after 150 ms
When an LLM step is selected, and then an Image step
Then each picker is enabled by 250 ms

### S35: The saved model during a refresh
Given a step whose saved model is in the list
When the panel asks the host for models again
Then the picker stays enabled with the saved model shown, and "Loading models..." doesn't appear

### S36: The real app
Given a dev launch at 1440 × 900 with both side columns, a flow with an LLM step
When the step is selected
Then S33 and S34 hold in the real window, in Light and Dark

## Feature: The project switch (P5)

### S37: Measure the switch
Given a dev build at 1440 × 900 with the AI column open, two projects each with a document open
When `project-check.mjs --switch-to` switches ten times, stamping every 50 ms
Then the record shows, per switch, how long a document's "Loading..." was in front, when Home came forward, and when the AI column became visible, beside the extension host's timestamps

### S38: After an extension-side fix
Given P5's fix on the branch (only if S37 shows the cause is Ritemark's timers)
When S37 runs again
Then in 10 of 10 switches Home is in front with no "Loading..." frame, and the AI column is visible within 300 ms of Home

### S39: The welcome is still alone (negative)
Given a fresh profile
When the welcome opens
Then the AI column doesn't appear beside it (Sprint 133's rule), whatever P5 changed

### S40: On the candidate
Given 2.1's candidate (Gate 1) and S37's script
When ten switches are measured
Then #569 closes if the AI column follows Home by under 300 ms and no "Loading..." frame shows; otherwise it is a 2.1 bug with the record
