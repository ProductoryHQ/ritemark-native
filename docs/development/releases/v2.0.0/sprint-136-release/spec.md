# Sprint 136 Spec: 2.0 as one release

## Purpose

Steps 1–3 built Ritemark 2.0 on main, and Sprint 135 moved it to VS Code 1.142.0 (Electron 43.7.7, Node 24.18.0). All four are merged; main is `16b5bf0d`. This sprint turns main into v2.0.0 and ships it to people.

First it fixes what the 2.0 film rehearsals and Sprint 135 found since the steps merged (R11), and the two build and test hazards 1.142 brought (E4, E5). Then it proves that a v1.14.0 user updates without losing anything, on the Mac and on Windows. It checks the signed builds in Light, Dark and on Windows, brings the bundled AI runtimes up to date and sets the version. It writes the notes, refreshes the Microsoft Store listing, and runs the shell-tier gates to publication.

It is step 4 of the [v2.0.0 release plan](../release-plan.md).

## Principles

- **The signed build is the product.** Every check that matters for people runs on the signed candidate, not a dev build. A dev run can show an old stylesheet, and it carries Copilot Chat's rows in More (feasibility §5; Sprint 135's E5: a production build matches 32 of the baseline's 34 scenes, and More differs because it has no Copilot Chat).
- **Nothing a v1.14.0 user has is lost** (HARD RULE #1). Projects, chats, task boards, recordings, flows, agents, keys, settings, recent folders and their own theme all come across.
- **The written lists are the contract.** The [v1.14 parity list](../parity-v1.14.md) for what 2.0 must reach, the frame baseline for how it must look, and the release plan's Gate 2 checklist for the update.
- **The release skill's gates do not change for 2.0.** A clean-room worktree from exact `origin/main`, CI green first, Gate 1, Gate 2, notarization after the hardening window, a draft-first publish and a closeout.
- **Main is frozen from the version bump until publication.** The bump is the last merge before the candidate, so every fix lands before it.
- **Our own test runs are not people.** No test launch of an installed build sends usage data to PostHog as a person would (R10).

## Requirements

### R1: Updating from a lived-in v1.14.0 profile

As someone who used Ritemark 1.14 every day, I want to install 2.0 and find all my work and my settings where 2.0 puts them.

Acceptance criteria:

- The update is tried on the signed candidate, installed over v1.14.0, with a lived-in profile:
  - on the Mac (arm64), by replacing the app in Applications from the DMG;
  - on Windows, by running the installer over v1.14.0;
  - with the x64 DMG on an Intel Mac where one is at hand, otherwise under Rosetta on the release Mac, and the evidence says which (Open Question D4).
- A lived-in profile has several projects, chats in more than one of them, task boards with a waiting card, recordings, a flow, an agent, a Google Docs link, an API key, a terminal in the AI column, a moved view, recent folders and a theme the person chose (the release plan's Gate 2 checklist).
- On the first start of 2.0:
  - settings the person chose keep winning, their theme included;
  - the places row is on top in Ritemark's order, and the person's later moves are kept;
  - no terminal is in the AI column, and a terminal the profile kept comes back as a tab (v1.14 keeps no terminal across a quit, so this is recorded as not exercisable when there is none; the update-path audit);
  - the welcome shows once, already signed in, with the usage-data switch as the person answered 1.x's notice (Sprint 133);
  - the person's 1.x recent folders are in Open Recent, the welcome's list and the projects list. VS Code 1.142 moves them once into its shared list (`~/.ritemark-shared`, E4) and removes them from the profile, and "Open where you left" reopens their last project;
  - the project list holds every project, and each opens on its Home (Sprint 134);
  - What moved shows on the first Home and stays until Got it, then never again (Sprint 134's R11).
- No project, chat, card, recording, flow, agent, key, Google Docs link or dictation model is lost or asked for again.
- On the second start, nothing moves again and nothing shows again.
- A profile that once took an extension release keeps working: 2.0's bundled extension loads, and an older copy in the user directory does not.
- Going back is recorded, not supported: v1.14.0 installed over 2.0 starts, deletes nothing, and what looks different is written down (release notes, known issues). Its Open Recent is empty, because 2.0's VS Code moved the list into the shared folder (the update-path audit).
- After publication, a v1.14.0 app offers 2.0.0 through its own update notice and opens the download (`updateResolver.ts`: a full release with a higher version), and a Store install updates through the Store.

### R2: Light, Dark and Windows on the signed builds

As Jarmo, I want 2.0 to look as approved on the builds people install.

Acceptance criteria:

- On the signed (not yet notarized) arm64 and x64 candidates, and on the signed Windows installer:
  - Ritemark Light, Ritemark Dark and high contrast, at 100% and zoomed, with one desk and two, and with each column shown and hidden;
  - `frame-screenshots.mjs --compare` and `frame-geometry.mjs` run against the installed app (R3), and match the baseline or each difference is approved by Jarmo.
- More's two scenes differ on every production build, because a production build has no Copilot Chat. They get release-only images from the first candidate, with Jarmo's approval; every other scene compares with the approved baseline (Open Question D2).
- On Windows: the frame without a title row, the menu by mouse and by Alt, the window buttons, dragging and snapping, Ctrl in every shortcut and every tooltip.
- The macOS versions the frame was seen on are recorded: the release Mac, and an older macOS where one is at hand (feasibility §5: the traffic lights were seen on one Mac; Open Question D4).
- Jarmo's own Mac pass that Sprint 132 left open is done on the candidate: moving the window by its strips, full screen and back, a sheet dialog, the native menu bar, Help, and VoiceOver on You (Sprint 132's QA evidence, "Not done here"; Sprint 135's S17 left S4 and S6 for the same reason).

### R3: A screenshot comparison in every release's checklist

As engineering, I want every shell release from now on to compare the base window with the approved baseline, because the frame rests on VS Code's class names, which can change without warning.

Acceptance criteria:

- Every `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` carries a permanent section, "The base window against the baseline", with:
  - how to launch the installed candidate in the background with its own short profile, its own shared data folder (`--shared-data-dir`, E4), usage data marked as a test (R10) and a debugging port;
  - the `frame-screenshots.mjs --compare` and `frame-geometry.mjs` runs, on the Mac and on Windows;
  - the rule: a scene over 0.5% is fixed, or Jarmo approves it, before Gate 1 passes.
- The release skill's Step 2 and the `release-manager` agent's "Test Checklist Generation" both name the section, so no release skips it.
- The scripts run against a signed app as they run against a dev instance. Where a production build differs from the dev baseline by design (More without Copilot Chat), the release compares with its release-only images (Open Question D2).
- The Windows run has its own baseline where the Windows session can run the scripts, because the window buttons and the menu button differ from the Mac. Where it cannot, the Windows screenshots are compared by eye with the last Windows round's (Open Question D2).
- `docs/development/frame-baseline/README.md` says how a release candidate is compared.

### R4: The runtime review for the gap since v1.14.0

As Jarmo, I want 2.0 to ship with AI runtimes that run today's models.

Acceptance criteria:

- The review compares each bundled runtime with the latest, over the gap since v1.14.0, and lists the main changes of each, as the v1.14.0 release plan's "Runtime versions" table does. On 20 October the gap was small:

  | Runtime | Bundled since v1.14.0 | npm latest, 20 October |
  |---|---|---|
  | Claude Code, with its Agent SDK | 2.1.296, SDK 0.3.296 | 2.1.304, SDK 0.3.304 |
  | Codex | 0.162.1 | 0.163.0 |
  | OpenCode | 1.19.0 | 1.19.3 |

- `npm run check:anthropic-models` runs on the release source. An ALERT stops the release until Claude Code is updated or Jarmo defers it; a WARNING adds the model or says why not (release skill, "Claude Code and model currency"). On 20 October it printed OK for the bundled 2.1.296 (catalog v2734: Opus 5.5, Sonnet 5.5, Fable 5.1, Haiku 5.5).
- Jarmo decides which runtimes update (Open Question D1). An update follows the release skill's steps, and its evidence goes into `agent-runtime-compatibility.md` (pre-commit Check 11).
- The runtimes are checked on the Node and Electron that Sprint 135 brought: an authenticated Claude turn, a Codex turn and the OpenCode permission gate, on darwin-arm64, darwin-x64 and Windows (the release plan's "Every release"). This is also Sprint 135's open S27, which no build on 1.142 has run yet.
- A runtime update merges before the dress rehearsal (E3), so the rehearsal's runtime turn runs on it.

### R5: Version 2.0.0

As Jarmo, I want every place that names the version to say 2.0.0.

Acceptance criteria:

- The six version files say 2.0.0 (release skill, Step 1): `branding/product.json` (`ritemarkVersion`), `branding/BRANDING.json`, `branding/VERSION`, `extensions/ritemark/package.json`, `extensions/ritemark/package-lock.json` (both keys) and `installer/windows/ritemark.iss`.
- The diff is 7 insertions and 7 deletions across 6 files, made by targeted replacement.
- The bump is the last merge before the candidate.
- The About dialog, the embedded provenance, the Windows installer and the update feed's new entry all say 2.0.0, and About names the source commit (Sprint 135, #484).

### R6: Release notes, the changelog and the user docs

As someone updating, I want to read in plain words what 2.0 is, what moved and what to expect.

Acceptance criteria:

- `docs/releases/v2.0.0/release-notes.md` covers everything merged since v1.14.0: Steps 1–3, the VS Code update, the runtime update and every fix, this sprint's included. It is drafted with the `product-marketer` agent and approved by Jarmo.
- It says what moved for someone updating (the terminal, Copilot Chat, Settings and Help, Home, Export to Share), and its known issues: going back to 1.14 (S7), a conversation's model not kept across restarts ([#417](https://github.com/ProductoryHQ/ritemark-native/issues/417)), two answers to a file conflict ([#454](https://github.com/ProductoryHQ/ritemark-native/issues/454)), and anything a gate defers.
- `docs/CHANGELOG.md`'s 2.0.0 section is dated and no longer "Unreleased".
- The pages in `docs/user/` describe 2.0's places and words, as the parity list's docs rows name them (G9), and `docs/user/features/ai-agents.md` says any ChatGPT account works with Codex (R11).
- The Store's "What's new" and the update feed's summary come from the notes.
- The notes are drafted before the release documents merge (memory: the release review and notes).

### R7: The Microsoft Store listing and screenshots

As someone on Windows who installs from the Store, I want the Store to show and install 2.0.

Acceptance criteria:

- The exact released installer is uploaded to a new versioned URL, `windows/v2.0.0/Ritemark-Setup.exe`, through the guarded uploader, and verified anonymously (HTTP 200, no redirect, size and SHA-256), as v1.14.0 was (`docs/microsoft-store-submission/STATUS.md`).
- Jarmo submits in Partner Center himself, through his ChatGPT flow; this sprint prepares the brief and verifies the hosted file (Jarmo, 15 and 17 October). The brief holds the package URL and its SHA-256, "What's new", the certification notes (`CERTIFICATION-NOTES-v2.0.0.md`), the listing copy and the screenshots with their captions. In the package, only the URL changes.
- New screenshots are taken from the installed signed Windows candidate, with synthetic content, a disposable profile and usage data marked as a test (R10). The Experience lead picks the scenes; six are planned: the welcome, a project's Home, writing with the AI beside, Tasks with a task that waits, a Word or PDF preview, and Transcribe. Captions are reviewed (`ASSETS.md`).
- The state of the v1.14.0 update in Partner Center is read before the brief is handed over.
- After certification, a Store-origin install, launch, edit and save, and uninstall are verified. A v1.14.0 Store install updates to 2.0 with its profile.
- The privacy and terms URLs change only if the web side changed them for 2.0's usage data (on by default with no location since 19 October; Sprint 133's spec, R7).

### R8: The shell-tier gates, publication and closeout

As Jarmo, I want 2.0 released through the same gates as every shell release.

Acceptance criteria:

- The release follows `.claude/skills/release/SKILL.md` in order:
  - Windows and macOS x64 CI proven green on `main` at the version bump's commit before the candidate. Both were green at `d60b9652` (runs 39467716747 and 39467679900), which proves the workflows on 1.142, not the bump's commit;
  - a clean-room release worktree at exact `origin/main`, `release-preflight.sh` and `check:anthropic-models`;
  - the arm64 build, signing and the DMG, with no notarization yet;
  - Gate 1 on the un-notarized DMG, then at least 60 minutes from the DMG's build before notarizing;
  - the x64 and Windows builds dispatched against `main`, with the repository's visibility toggled for the paid runner and back;
  - the x64 DMG signed against `RITEMARK_RELEASE_COMMIT`;
  - Gate 2 on the un-notarized x64 DMG and the Windows installer, then the hardening window and notarization;
  - a draft release with the binaries and a feed generated with `--existing-feed-url` naming v1.14.0, every digest matched, then publication;
  - the post-release issue sweep and the closeout (evidence archived, build output cleared, removal left to Jarmo).
- One publication for all three platforms, as v1.14.0 was (Jarmo, 15 October). If Windows blocks at Gate 2, Jarmo decides then whether the Mac goes first, with the feed keeping v1.14.0's Windows entry.
- Publication waits until the privacy policy says that usage data is on by default, that it can be turned off on the welcome and in Settings, and that no location is collected (Jarmo, 19 October: "ritemark.app's privacy policy updated at release"). The Development manager confirms it with Traffic.
- `main` stays frozen from the version bump until publication. A fix found at a gate means a new candidate from a new worktree, and the gate starts again.
- Every issue on the GitHub milestone v2.0.0 is closed or explicitly deferred, and the milestone is closed at the end. Today it holds #475, #477, #482, #485–#488; this sprint adds #459, #471 and #480 to it.
- After publication, the pause on 1.x releases ends: shell and extension releases from main follow the normal rules again.

### R9: Everything v1.14.0 can do, on the signed build

As Jarmo, I want the release plan's feature-complete item proved on the build people install.

Acceptance criteria:

- Every row of the [v1.14 parity list](../parity-v1.14.md) is walked on the signed candidate and ticked, or deferred by Jarmo in writing.
- The parity list's gaps are closed before the candidate is cut: G1 and G2 were done in Sprint 133 (its QA evidence) and are marked so; G6's Claude Code half is fixed by R11 ([#459](https://github.com/ProductoryHQ/ritemark-native/issues/459)); G7 and G8 are accepted for 2.0 by Jarmo in writing (Open Question D5); G9 is R6.
- The rows that a dev build cannot check are walked here: Google Docs with the production client, Retry on a save problem, Excel sheet tabs, PowerPoint notes, the transcript workbench, conversation menus, the prompt queue, approvals and sign-in cards, scheduled agents, and Ritemark's own terminals (Sprint 132's QA evidence, S31 and S44).
- Sprint 134's and Sprint 135's items that need a signed-in AI's answer are walked here too: the answers that use About this project (S28, S44), the share question and an answer from the shared page (S55, S57), a switch with a chat working (S31, S33), unread replies (S62), and the page's context and the AI's clicks in the browser (Sprint 135's S26).

### R10: Usage data on the signed build

As someone who said no, I want nothing counted. As Jarmo, I want the four events from the people who said yes, and none from our own tests.

Acceptance criteria:

- On the signed candidate, the four events (welcome shown, AI signed in, project opened, first message sent) are sent after a yes, with `build_channel: prod`. A release build's bundled extension is floored to `2.0.0-0`, and that suffix is what makes it `prod` (`consent.ts`, #338).
- None is sent before an answer or after a no, from any part of Ritemark.
- An updated v1.14.0 profile whose notice was closed with OK sends; one that opted out sends nothing.
- **Our own runs are marked** ([#480](https://github.com/ProductoryHQ/ritemark-native/issues/480)). A run with `RITEMARK_BUILD_CHANNEL=test` in its environment reports `build_channel: test` from an installed build, and, like a run from source, sends only to a key given for that run (`RITEMARK_POSTHOG_PROJECT_KEY`), so it never reaches Ritemark's project by default. Every test launch of an installed build in this sprint sets it, and from then on every release's launch recipe does: the frame scripts, the "Harbour" runs, the dress rehearsal, the gates' scripted checks, the Windows rounds, and the RC captures by the Experience lead, Social and the Store screenshots. A run that does not need usage data turns it off in its fresh profile instead (`"ritemark.features.analytics": false`).
- The payload checks (S33) run against a local stand-in for PostHog (`RITEMARK_POSTHOG_PROJECT_KEY` and `_HOST`), so they see `prod` without reaching PostHog. One live run reaches PostHog marked `test`, with the project key given for that run, to prove delivery. Jarmo's own Gate 1 run on his own profile is a real person's run and is not marked.

### R11: The 2.0 fixes before the candidate

As someone trying 2.0 in its first week, I want none of the small things the film rehearsals and Sprint 135 found. All are extension-tier but one hunk in patch 002 (#487).

Acceptance criteria:

- **A task card shows its title** ([#477](https://github.com/ProductoryHQ/ritemark-native/issues/477)). A card file opened in the Ritemark editor (front matter `ritemark: task/1`) has its card's title on its tab, with the task mark (Phosphor's check-square; `webviewPanel.title` and `iconPath`, set in `ritemarkEditor.ts`'s `resolveCustomTextEditor`), and the title follows an edit of the card. No file id and no extension show. The board's own tab keeps its kanban mark, so the two read apart. The AI column's chip shows the same: the check-square and the title, cut with an ellipsis when long (the Experience lead, 20 October). Every other file keeps its file name and icon.
- **The "Active:" chip follows the document in front** ([#485](https://github.com/ProductoryHQ/ritemark-native/issues/485)). It names the document in front of the active desk, and nothing when no document is in front. A file that is closed or deleted never stays in the chip: it changes to the document now in front, or goes. Switching desks updates it. (`UnifiedViewProvider` listens today only to `tabGroups.onDidChangeTabs`; desk changes, the active text editor and deleted files are added.)
- **Codex works on a free ChatGPT account** ([#482](https://github.com/ProductoryHQ/ritemark-native/issues/482)). Settings' ChatGPT card (`RitemarkSettings.tsx:708`) and `docs/user/features/ai-agents.md` (lines 142 and 151) say that any ChatGPT account works, Free included, and that paid plans get higher limits, with no prices. The welcome and the AI column's sign-in sheets were checked and make no such claim.
- **Dictation starts in the person's language** ([#486](https://github.com/ProductoryHQ/ritemark-native/issues/486)). On a fresh profile the first language follows Ritemark's display language (`vscode.env.language`, sent to the editor with its load message) when Whisper has it, else English, and the recent list starts with that language and English (today `VoiceDictationButton.tsx` falls back to `'et'` and `['et', 'en']`). After that the person's own pick wins. The pick survives closing the document, opening another one and a restart; if the webview's storage doesn't keep it, the extension does. Picking a language in the menu only sets it: dictation starts on the next press of the microphone, and a menu choice never turns the microphone on. The control reads as drawn: the microphone, then the set language and a caret ("ET ⌄"), with the tooltip "Dictate, in Estonian"; the microphone starts dictation, and the caret opens the menu, which ticks the set language (the Experience lead, 20 October).
- **An AI turn never moves the left column** ([#487](https://github.com/ProductoryHQ/ritemark-native/issues/487)). The end of a turn, by any runtime, and the start of a chat leave the left column as the person left it: closed stays closed, and Home stays Home. (The cause: `_refreshExplorerForAgentWrites` in `UnifiedViewProvider.ts` runs `workbench.files.action.refreshFilesExplorer` at three turn ends, and that command opens Documents first. Patch 002 lets it refresh without opening, `{ reveal: false }`.) Files the AI wrote still show in Documents when the person opens it, also when the file watcher missed them (#33).
- **A restored chat keeps its time** ([#488](https://github.com/ProductoryHQ/ritemark-native/issues/488)). A finished turn shows the same "Done in …" after switching projects and back and after a restart; a turn saved before this fix shows "Done". Never "Done in 0.0s" (today `conversationProjection.ts` gives every restored Claude turn a duration of 0).
- **Documents follows changes made outside Ritemark** (found at the dress rehearsal). Since Sprint 132 (#450) Ritemark watched the whole home folder recursively to see `~/.claude/{agents,commands,skills}`; on VS Code 1.142 a flood of events there (Claude Code, Codex and other apps write to the home folder all the time) left the workspace's file watcher delivering nothing, so Documents missed files created or deleted outside Ritemark until Refresh. Ritemark watches only those three folders, and the Agent Library's `~/.claude` watcher reacts only to them. After a home-folder flood a project's files still show (S47).
- **A flow's Claude Code step names the right place to sign in** ([#459](https://github.com/ProductoryHQ/ritemark-native/issues/459), the parity list's G6). Signed out, its error names the Settings heading that holds the sign-in card, as the ChatGPT step already does.
- Each fix has a unit test where the code allows one, and the Development manager smoke-tests the PR before Jarmo's merge.

## Engineering requirements

### E1: Docs

- The release plan: the sprint table, the tracker, the issue intake, the feature-complete checklist and the risk register, kept up to date through the sprint and closed at the end.
- `architecture.md`: the version-history row for 2.0.0.
- The release skill and the `release-manager` agent for R3, R10's launch rule and E4's flag. The Codex harness follows through the harness sync.
- The `ritemark-automation` skill's launch recipe and `.claude/commands/rundev.md`: E4's flag and R10's marker.
- The `vscode-development` skill: E5's note on gulp's packaging tasks in a development tree.
- `docs/releases/v2.0.0/TEST-CHECKLIST.md`, generated at the first candidate, with the release plan's Gate 2 list, R3's section, the parity rows, R10's check and E4's line.

### E2: Build hygiene and disk

- Every candidate starts in a new worktree from `./scripts/create-release-worktree.sh`. A spent worktree is never reused.
- About 31 GB is free, and a release worktree with its builds takes about 11–15 GB. So at most one release worktree is on disk at a time: the dress rehearsal's (E3) is removed, with Jarmo's yes, before the candidate's is made, and a spent candidate's before the next one's.
- The closeout leaves the release worktree as `REVIEW` in `worktree-hygiene.mjs --check`. Removing it is Jarmo's call.

### E3: A dress rehearsal before the version bump

- After this sprint's fixes (R11, R10, E4, E5) and the runtime update (R4) are merged, one clean-room production build of main's commit. It is the release skill's Step 0 on that commit, and a build check, not a release: it finds an update or build problem while main can still take a fix.
- On it: the release preflight and `check:anthropic-models`; E5's whole-tree check; `validate-build-output.sh`; Sprint 135's E5 app checks (no agent host at launch, a terminal, highlighting, the code cache, About's commit); R3's section rehearsed against the production build; R1's update on the Mac with "Harbour" (S1, S4, S5, S6); an authenticated Claude turn (S18, arm64); R10's marker.
- On the same commit: macOS x64 CI and Windows CI, and a Windows PC round on that installer (the fixes on Windows, and S2 with a Windows "Harbour").

### E4: Recent folders on a computer with more than one 2.0 build

From VS Code 1.142 the recent folders are shared by every Ritemark build and profile on a computer (`~/.ritemark-shared`; [#475](https://github.com/ProductoryHQ/ritemark-native/issues/475)).

- Every test and development launch recipe passes VS Code 1.142's own `--shared-data-dir <its own folder>` beside `--user-data-dir` (`environmentService.ts`, `appSharedDataHome`): `.claude/commands/rundev.md`, the `ritemark-automation` skill's launch, `scripts/qa/plan-truth-matrix.sh`, the frame baseline's README and R3's checklist section. No patch is needed.
- Before Jarmo first starts the candidate on his own profile (Open Question D3), `~/.ritemark-shared` on his Mac is moved aside, not deleted, with his yes, so his 1.x recent folders come across as they will for people.
- The update-path audit checks that the welcome's first-start check, the projects list's first fill and "Open where you left" do not assume that recent folders belong to one profile.
- The test checklist carries the line "a fresh profile on a computer with another 2.0 build".

### E5: VS Code's packaging leaves our extension's source alone

On the Mac, VS Code's gulp packaging writes through the `vscode/extensions/ritemark` link into our extension's source, and `build-prod.sh`'s guard has been restoring it from a backup on every build ([#471](https://github.com/ProductoryHQ/ritemark-native/issues/471)).

- `build-prod.sh` takes the link out of `vscode/extensions/` before gulp runs and puts it back on every way out, as Windows CI already builds with the extension absent (`stage-extension-for-shell-build.sh`, `apply-patches.sh --extension-layout absent`).
- The guard compares a digest of the whole `extensions/ritemark` tree (`scripts/tree-sha256.mjs`) before and after gulp. Any difference stops the build and names the changed files; there is no silent restore.
- The built app is unchanged: `validate-build-output.sh` passes, and the app's extension matches its source as today.
- The `vscode-development` skill says never to run gulp's packaging tasks in a development tree while the link is in place.
- It is proved by the dress rehearsal (E3). If the rehearsal's app differs in any way the change didn't mean, the change is reverted and #471 is deferred with today's guard.

## Non-Requirements

- **New features or redesigns.** Only R11's fixes and fixes for what the gates find.
- **A second VS Code update.** Sprint 135's D2 holds: only recovery releases of 1.142 until the candidate. 1.143.0 (expected 21 October) comes after 2.0.
- **Native shell auto-update** ([#139](https://github.com/ProductoryHQ/ritemark-native/issues/139)). v1.14.0 users move to 2.0 through today's update flow.
- **Open issues off the v2.0.0 milestone**, such as [#464](https://github.com/ProductoryHQ/ritemark-native/issues/464), [#461](https://github.com/ProductoryHQ/ritemark-native/issues/461), [#460](https://github.com/ProductoryHQ/ritemark-native/issues/460), [#454](https://github.com/ProductoryHQ/ritemark-native/issues/454), [#434](https://github.com/ProductoryHQ/ritemark-native/issues/434), [#433](https://github.com/ProductoryHQ/ritemark-native/issues/433) and [#417](https://github.com/ProductoryHQ/ritemark-native/issues/417). They stay open for 2.1 or later; the two a person can meet in the first week are known issues in the notes (R6).
- **An automatic shared data folder for development builds** (a patch that gives every unbuilt run its own). E4's launch flag covers this sprint's runs.
- **Website and launch work.** The Development manager coordinates Social and Traffic as for v1.14.0; this sprint hands them the candidate and the notes. The privacy policy is a precondition of publication (R8).
- **Downgrading from 2.0 to 1.14 as a supported path.** It is tried and recorded only (R1).

## Resolved Questions

- **2026-10-15 (Jarmo):** v1.14.0 was published on all three platforms at once, with Social's video and Traffic's website update coordinated by the Development manager. 2.0 does the same (R8).
- **2026-10-15 and 2026-10-17 (Jarmo):** the Microsoft Store stays with Jarmo's ChatGPT flow; the Development manager prepares the submission and verifies the hosted file (R7).
- **2026-10-17 (Jarmo):** "We will focus on 2.0 from now on." v1.14.0 is the last 1.x release, and no release is built from main until 2.0.
- **2026-10-17 (release plan):** step 4 covers updating from v1.14.0, Dark and Windows checked, a screenshot comparison in the release checklist, the runtime review, version 2.0.0, notes and the store listing.
- **2026-10-18 (Sprint 135's plan, D2):** 2.0 ships on the VS Code release frozen in Sprint 135 (1.142.0), with only recovery releases of the same minor.
- **2026-10-19 (Jarmo):** usage data is on by default, with no location, and the privacy policy is updated at release. [#270](https://github.com/ProductoryHQ/ritemark-native/issues/270) is 2.1's first item.
- **2026-10-20 (Jarmo):** equations are [#481](https://github.com/ProductoryHQ/ritemark-native/issues/481) in v2.1.0, and counting the AI chat's use is [#479](https://github.com/ProductoryHQ/ritemark-native/issues/479) in v2.1.0. The share question's baseline scenes show 1.142's browser bar ("replace").

## Open Questions

Decisions for Jarmo, each with a recommendation, are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo) (D1–D5).
