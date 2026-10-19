# Sprint 136 Spec: 2.0 as one release

## Purpose

Steps 1–3 build Ritemark 2.0 on main, and Sprint 135 moves it to the current VS Code. This sprint turns main into v2.0.0 and ships it to people. It proves that a v1.14.0 user updates without losing anything, on the Mac and on Windows. It checks the signed builds in Light, Dark and on Windows. It brings the bundled AI runtimes up to date and sets the version. It writes the notes, refreshes the Microsoft Store listing, and runs the shell-tier gates to publication.

It is step 4 of the [v2.0.0 release plan](../release-plan.md). It starts only after Steps 1, 2 and 3 and the VS Code update (Sprint 135) are merged.

## Principles

- **The signed build is the product.** Every check that matters for people runs on the signed candidate, not a dev build. A dev run can show an old stylesheet, and it carries Copilot Chat's dev rows (feasibility §5; the frame baseline's README).
- **Nothing a v1.14.0 user has is lost** (HARD RULE #1). Projects, chats, task boards, recordings, flows, agents, keys, settings and their own theme all come across.
- **The written lists are the contract.** The [v1.14 parity list](../parity-v1.14.md) for what 2.0 must reach, the frame baseline for how it must look, and the release plan's Gate 2 checklist for the update.
- **The release skill's gates do not change for 2.0.** A clean-room worktree from exact `origin/main`, Gate 1, Gate 2, notarization after the hardening window, a draft-first publish and a closeout.
- **Main is frozen from the first candidate until publish.** The version bump is the last merge before the candidate.

## Requirements

### R1: Updating from a lived-in v1.14.0 profile

As someone who used Ritemark 1.14 every day, I want to install 2.0 and find all my work and my settings where 2.0 puts them.

Acceptance criteria:

- The update is tried on the signed candidate, installed over v1.14.0, with a lived-in profile:
  - on the Mac (arm64), by replacing the app in Applications from the DMG;
  - on Windows, by running the installer over v1.14.0;
  - on an Intel Mac with the x64 DMG, where one is at hand (Open Question D7).
- A lived-in profile has several projects, chats in more than one of them, task boards with a waiting card, recordings, a flow, an agent, a Google Docs link, an API key, a terminal in the AI column, a moved view and a theme the person chose (the release plan's Gate 2 checklist).
- On the first start of 2.0:
  - settings the person chose keep winning, their theme included;
  - the places row is on top in Ritemark's order, and the person's later moves are kept;
  - terminals saved in the AI column come back as tabs;
  - the welcome shows once, already signed in, with the usage-data switch as the person answered 1.x's notice (Sprint 133);
  - the project list holds every project, and each opens on its Home (Sprint 134);
  - What moved shows once (Sprint 134).
- No project, chat, card, recording, flow, agent, key, Google Docs link or dictation model is lost or asked for again.
- On the second start, nothing moves again and nothing shows again.
- A profile that once took an extension release keeps working: 2.0's bundled extension loads, and an older copy in the user directory does not.
- Going back is recorded, not supported: v1.14.0 installed over 2.0 starts, deletes nothing, and what looks different is written down (release notes, known issues).
- After publication, a v1.14.0 app offers 2.0.0 through its own update notice and opens the download (`updateResolver.ts`: a full release with a higher version), and a Store install updates through the Store.

### R2: Light, Dark and Windows on the signed builds

As Jarmo, I want 2.0 to look as approved on the builds people install.

Acceptance criteria:

- On the signed (not yet notarized) arm64 and x64 candidates, and on the signed Windows installer:
  - Ritemark Light, Ritemark Dark and high contrast, at 100% and zoomed, with one desk and two, and with each column shown and hidden;
  - `frame-screenshots.mjs` and `frame-geometry.mjs` run against the installed app (R3), and match the baseline or each difference is approved by Jarmo.
- On Windows: the frame without a title row, the menu by mouse and by Alt, the window buttons, dragging and snapping, Ctrl in every shortcut and every tooltip.
- The macOS versions the frame was seen on are recorded: the release Mac, and at least one older macOS where one is at hand (feasibility §5: the traffic lights were seen on one Mac; Open Question D7).
- Jarmo's own Mac pass that Sprint 132 left open is done on the candidate: moving the window by its strips, full screen and back, a sheet dialog, the native menu bar, Help, and VoiceOver on You (Sprint 132's QA evidence, "Not done here").

### R3: A screenshot comparison in every release's checklist

As engineering, I want every shell release from now on to compare the base window with the approved baseline, because the frame rests on VS Code's class names, which can change without warning.

Acceptance criteria:

- Every `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` carries a permanent section, "The base window against the baseline", with:
  - how to launch the installed candidate in the background with its own short profile and a debugging port;
  - the `frame-screenshots.mjs --compare` and `frame-geometry.mjs` runs, on the Mac and on Windows;
  - the rule: a scene over 0.5% is fixed, or Jarmo approves it, before Gate 1 passes.
- The release skill's Step 2 and the `release-manager` agent's "Test Checklist Generation" both name the section, so no release skips it.
- The scripts run against a signed app as they run against a dev instance. Where a signed build differs from the dev baseline by design (Copilot Chat's dev rows in More), the release has its own baseline (Open Question D2).
- The Windows run has its own baseline, because the window buttons and the menu button differ from the Mac.
- `docs/development/frame-baseline/README.md` says how a release candidate is compared.

### R4: The runtime review for the gap since v1.14.0

As Jarmo, I want 2.0 to ship with AI runtimes that run today's models.

Acceptance criteria:

- The review compares each bundled runtime with the latest, over the whole gap since v1.14.0 (Claude Code 2.1.296 with Agent SDK 0.3.296, Codex 0.162.1, OpenCode 1.19.0). It lists the main changes of each, as the v1.14.0 release plan's "Runtime versions" table does.
- `npm run check:anthropic-models` runs on the release source. An ALERT stops the release until Claude Code is updated or Jarmo defers it; a WARNING adds the model or says why not (release skill, "Claude Code and model currency").
- Jarmo decides which runtimes update (Open Question D1). An update follows the release skill's steps, and its evidence goes into `agent-runtime-compatibility.md` (pre-commit Check 11).
- The runtimes are checked on the new Node and Electron that Sprint 135 brings: an authenticated Claude turn, a Codex turn and the OpenCode permission gate, on darwin-arm64, darwin-x64 and Windows (the release plan's "Every release").
- A runtime update merges before the version bump.

### R5: Version 2.0.0

As Jarmo, I want every place that names the version to say 2.0.0.

Acceptance criteria:

- The six version files say 2.0.0 (release skill, Step 1): `branding/product.json` (`ritemarkVersion`), `branding/BRANDING.json`, `branding/VERSION`, `extensions/ritemark/package.json`, `extensions/ritemark/package-lock.json` (both keys) and `installer/windows/ritemark.iss`.
- The diff is 7 insertions and 7 deletions across 6 files, made by targeted replacement.
- The bump is the last merge before the candidate.
- The About dialog, the embedded provenance, the Windows installer and the update feed's new entry all say 2.0.0.

### R6: Release notes, the changelog and the user docs

As someone updating, I want to read in plain words what 2.0 is, what moved and what to expect.

Acceptance criteria:

- `docs/releases/v2.0.0/release-notes.md` covers everything merged since v1.14.0: Steps 1–3, the VS Code update, the runtime update and every fix. It is drafted with the `product-marketer` agent and approved by Jarmo.
- It says what moved for someone updating (the terminal, Copilot Chat, Settings and Help, Home, Export to Share), and its known issues.
- `docs/CHANGELOG.md`'s 2.0.0 section is dated and no longer "Unreleased".
- The pages in `docs/user/` describe 2.0's places and words, as the parity list's docs rows name them.
- The Store's "What's new" and the update feed's summary come from the notes.
- The notes are drafted before the release documents merge (memory: the release review and notes).

### R7: The Microsoft Store listing and screenshots

As someone on Windows who installs from the Store, I want the Store to show and install 2.0.

Acceptance criteria:

- The exact released installer is uploaded to a new versioned URL, `windows/v2.0.0/Ritemark-Setup.exe`, through the guarded uploader, and verified anonymously (HTTP 200, no redirect, size and SHA-256), as v1.14.0 was (`docs/microsoft-store-submission/STATUS.md`).
- In Partner Center, the package URL is replaced, and only that in the package. "What's new", the certification notes (`CERTIFICATION-NOTES-v2.0.0.md`) and the listing copy are written for 2.0.
- New screenshots are taken from the installed signed Windows candidate, with synthetic content and a disposable profile, and their captions reviewed (`ASSETS.md`).
- Jarmo approves the exact URL and SHA-256 at the moment of Submit, and any warning Partner Center raises, each separately.
- After certification, a Store-origin install, launch, edit and save, and uninstall are verified. A v1.14.0 Store install updates to 2.0 with its profile.
- The privacy and terms URLs change only if the web side changed them for 2.0's usage data, on by default with no location since 19 October (Sprint 133's plan, *Analytics and privacy*; Sprint 133's spec, R7).

### R8: The shell-tier gates, publication and closeout

As Jarmo, I want 2.0 released through the same gates as every shell release.

Acceptance criteria:

- The release follows `.claude/skills/release/SKILL.md` in order:
  - Windows and macOS x64 CI proven green on `main` before the candidate;
  - a clean-room release worktree at exact `origin/main`, `release-preflight.sh` and `check:anthropic-models`;
  - the arm64 build, signing and the DMG, with no notarization yet;
  - Gate 1 on the un-notarized DMG, then at least 60 minutes from the DMG's build before notarizing;
  - the x64 and Windows builds dispatched against `main`, with the repository's visibility toggled for the paid runner and back;
  - the x64 DMG signed against `RITEMARK_RELEASE_COMMIT`;
  - Gate 2 on the un-notarized x64 DMG and the Windows installer, then the hardening window and notarization;
  - a draft release with the binaries and a feed generated with `--existing-feed-url` naming v1.14.0, every digest matched, then publication;
  - the post-release issue sweep and the closeout (evidence archived, build output cleared, removal left to Jarmo).
- `main` stays frozen from the first candidate until publication. A fix found at a gate means a new candidate from a new worktree, and the gate starts again.
- The GitHub milestone v2.0.0 exists and is closed at the end, each issue closed or explicitly deferred.
- After publication, the pause on 1.x releases ends: shell and extension releases from main follow the normal rules again.

### R9: Everything v1.14.0 can do, on the signed build

As Jarmo, I want the release plan's feature-complete item proved on the build people install.

Acceptance criteria:

- Every row of the [v1.14 parity list](../parity-v1.14.md) is walked on the signed candidate and ticked, or deferred by Jarmo in writing.
- The rows that a dev build cannot check are walked here: Google Docs with the production client, Retry on a save problem, Excel sheet tabs, PowerPoint notes, the transcript workbench, conversation menus, the prompt queue, approvals and sign-in cards, scheduled agents, and Ritemark's own terminals (Sprint 132's QA evidence, S31 and S44).
- No row in the parity list is still marked as a gap when the candidate is cut.

### R10: Usage data on the signed build

As someone who said no, I want nothing counted, and as Jarmo, I want the four events from the people who said yes.

Acceptance criteria:

- On the signed candidate, the four events (welcome shown, AI signed in, project opened, first message sent) reach PostHog after a yes, with `build_channel: prod`. A release build's bundled extension is floored to `2.0.0-0`, and that suffix is what makes it `prod` (Sprint 133's `consent.ts`, #338).
- None is sent before an answer or after a no, from any part of Ritemark.
- An updated v1.14.0 profile whose notice was closed with OK sends; one that opted out sends nothing.

## Engineering requirements

### E1: Docs

- The release plan: the sprint table, the tracker, the feature-complete checklist and the risk register, kept up to date through the sprint and closed at the end.
- `architecture.md`: the version-history row for 2.0.0.
- The release skill and the `release-manager` agent for R3. The Codex harness follows through the harness sync.
- `docs/releases/v2.0.0/TEST-CHECKLIST.md`, generated at the first candidate, with the release plan's Gate 2 list and R3's section.

### E2: Build hygiene

- Every candidate starts in a new worktree from `./scripts/create-release-worktree.sh`. A spent worktree is never reused.
- The closeout leaves the release worktree as `REVIEW` in `worktree-hygiene.mjs --check`. Removing it is Jarmo's call.

### E3: A dress rehearsal before the candidate

- Before the version bump, a production build from a clean-room worktree at main's commit runs R1's update on the Mac. It is a build check, not a release: it finds an update problem while main can still take a fix.

## Non-Requirements

- **New features or redesigns.** Only fixes for what the gates find.
- **A second VS Code update.** Sprint 135's D2 holds: only recovery releases of the frozen minor until the candidate.
- **Native shell auto-update** ([#139](https://github.com/ProductoryHQ/ritemark-native/issues/139)). v1.14.0 users move to 2.0 through today's update flow.
- **Website and launch work.** They go in a cross-repo release plan in `ritemark-dev/releases/` if Jarmo wants one (Open Question D5).
- **Downgrading from 2.0 to 1.14 as a supported path.** It is tried and recorded only (R1).

## Resolved Questions

- **2026-10-17 (Jarmo):** "We will focus on 2.0 from now on." v1.14.0 is the last 1.x release, and no release is built from main until 2.0.
- **2026-10-17 (release plan):** step 4 covers updating from v1.14.0, Dark and Windows checked, a screenshot comparison in the release checklist, the runtime review, version 2.0.0, notes and the store listing.
- **2026-10-18 (Sprint 135's plan, D2):** 2.0 ships on the VS Code release frozen in Sprint 135, with only recovery releases of the same minor.

## Open Questions

Decisions for Jarmo, each with a recommendation, are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo) (D1–D7).
