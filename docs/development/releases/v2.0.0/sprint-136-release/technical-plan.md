# Sprint 136 Technical Plan

The plan for [spec.md](spec.md). It is step 4 of the [v2.0.0 release plan](../release-plan.md). The commands are the release skill's (`.claude/skills/release/SKILL.md`); this file says what 2.0 adds to them and in which order. When the work needs something else, this file changes first. References are to `main` at `b1c198af` (after Sprint 132's closeout); Sprint 133 is in flight as [#453](https://github.com/ProductoryHQ/ritemark-native/pull/453), and Sprints 134 and 135 are planned.

## What exists today

| Part | Today |
|---|---|
| The release path | The release skill's Steps 0–10 and the `release-manager` agent's two gates; last run for v1.14.0 (published 2026-10-15 from `ed0b6226`; `docs/releases/v1.14.0/evidence/`) |
| The update path for people | `src/update/updateResolver.ts` offers the newest full release with a higher version and an asset for the platform; a full update opens the download in the browser (`updateService.ts:146–153`). There is no native shell auto-update (#139) |
| The frame's checks | `scripts/qa/frame-screenshots.mjs` (scenes, light and dark, `--compare`, exit code = scenes over 0.5%) and `scripts/qa/frame-geometry.mjs`, run over CDP against a dev instance. The baseline in `docs/development/frame-baseline/`, approved by Jarmo on 18 October, was taken from a dev build: its More scene lists the dev build's Copilot Chat rows, which a production build does not have |
| The release checklist | `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`, generated per release at Step 2 (release skill) to the `release-manager` agent's list (new features, core regression, installation, sign-off). No screenshot comparison |
| A lived-in profile | Sprint 132 made one twice with the installed v1.14.0 in the background (S45: a terminal and Search in the AI column, the Chat view opened, Agent Library dragged to the top, Ritemark Dark by hand) |
| The bundled runtimes | Claude Code 2.1.296 with Agent SDK 0.3.296, Codex 0.162.1, OpenCode 1.19.0 (v1.14.0, #424), in `extensions/ritemark/binaries/agents/manifest.json`; `check:anthropic-models` in `extensions/ritemark/package.json` |
| The version | 1.14.0 in the six files the release skill lists |
| The notes | `docs/releases/v2.0.0/release-notes.md` (draft, step 1; step 2 adds to it in #453); `docs/CHANGELOG.md`'s 2.0.0 section, "Unreleased" |
| The Store | Live as an EXE app (`docs/microsoft-store-submission/STATUS.md`); the v1.14.0 update submitted on 2026-10-17 from `getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`; a guarded uploader; screenshots from v1.10.1 (`ASSETS.md`) |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Release harness | The permanent screenshot section in every checklist; the frame scripts run against an installed app; a release baseline per platform | `.claude/skills/release/SKILL.md`, `.claude/agents/release-manager.md`, `scripts/qa/frame-screenshots.mjs` (usage text, any launch flag the audit needs), `docs/development/frame-baseline/` |
| Bundled runtimes | Updated to the versions Jarmo approves (D1) | `extensions/ritemark/binaries/agents/manifest.json`, `extensions/ritemark/package.json` (Agent SDK), `scripts/validate-agent-runtime-manifest.mjs`, `docs/development/agent-runtime-compatibility.md` |
| Version | 2.0.0 in six files | `branding/product.json`, `branding/BRANDING.json`, `branding/VERSION`, `extensions/ritemark/package.json`, `extensions/ritemark/package-lock.json`, `installer/windows/ritemark.iss` |
| Docs | Notes, changelog, user docs, the checklist, evidence | `docs/releases/v2.0.0/`, `docs/CHANGELOG.md`, `docs/user/` |
| Store | Certification notes, listing copy, screenshots, candidate record, evidence | `docs/microsoft-store-submission/` |
| Product code | Only fixes for what the update run or a gate finds | wherever the defect is |

The release tier is **shell**: the release is a full app build, and the runtime update and `installer/windows/ritemark.iss` are shell-tier by path.

## Phase 1 audits

1. **`research/update-path-audit.md`** (R1): every change 2.0 makes once to a v1.14.0 profile, and how each is marked done:
   - the places order and the views moved out of the AI column (002, 018; Sprint 132 W12);
   - terminals moved to the desk (019);
   - the theme set-up run once per profile (Sprint 132's fix);
   - the update welcome and its usage-data carry-over (`ritemark.activation.lastConfirmedVersion`, `ritemark.updatedFrom1x`; Sprint 133);
   - the project list's first fill and What moved (Sprint 134);
   - the extension copies in the user directory, and which one loads (`activationIntegrity.ts`, patch 012);
   - what v1.14.0 sees if it starts on a profile 2.0 has used (S7).
   The audit lists what each step's QA already proved on a v1.14.0 profile, so this sprint tests the whole chain once on signed builds rather than each part again.
2. **`research/installed-app-cdp.md`** (R2, R3): running `frame-screenshots.mjs` and `frame-geometry.mjs` against an installed, signed app on the Mac (`open -n -g` with `--remote-debugging-port`, a short `--user-data-dir` and `--extensions-dir`; memory: installed-app isolated CDP repro) and on Windows (the same flags on `Ritemark.exe`). It checks that hardened runtime and signing let the debugging port open, that quitting with ⌘Q keeps state, and how the scenes differ from the dev baseline (Copilot Chat's rows in More, anything else).
3. **`research/runtime-review.md`** (R4): each runtime's npm `latest` (and Codex's latest GitHub release) against v1.14.0's, with the main changes since; `check:anthropic-models` against Anthropic's catalog of the day; anything that needs Node 24 or Electron 43 (Sprint 135) or breaks on them. It ends with the recommendation for D1.

## Workstream 1: Lived-in profiles and the update (R1, E3)

- **The profiles.** "Harbour" (scenarios.md) is made with the installed v1.14.0, in the background, with its own short user-data and extensions directories (memory: no pop-up test windows). On the Mac it is scripted over CDP where it can be, as Sprint 132's S45 was; recordings are copied in as files, not recorded. On Windows the Windows session makes the same profile by hand on the PC. Each profile is archived (zipped, outside the repository) so every candidate starts from the same one.
- **The dress rehearsal (E3).** Before the version bump: a production build from a new clean-room worktree at main's commit (a build check, never signed as a release). R1's run on the Mac against it: install over v1.14.0 with "Harbour", then S1, S4, S5 and S6. A defect found here is fixed on main before the candidate.
- **On each candidate.** S1–S7 on the Mac (S3 on an Intel Mac where one is at hand), S2 on Windows.
- **Going back (S7).** Recorded in the notes' known issues, never fixed in this sprint.
- **After publication (S8).** A v1.14.0 app on the Mac and on Windows is offered 2.0.0.

## Workstream 2: Signed-build looks (R2)

- On each candidate, per `research/installed-app-cdp.md`: `frame-geometry.mjs` (all four layouts) and `frame-screenshots.mjs --compare`, in Light and Dark, on a fresh profile with the baseline's sample project.
- **The release baselines (D2).** At the first candidate, the arm64 run's captures are shown to Jarmo with their differences from the dev baseline. With his approval they become `docs/development/frame-baseline/release-darwin/`. The first Windows candidate's captures become `release-win32/` the same way. Later candidates and later releases compare with these. The dev baseline stays for dev runs and VS Code updates.
- High contrast, zoom and two desks are looked at by eye on the candidate, with screenshots in the QA evidence.
- On Windows: S11 by the Windows session.
- Another macOS (S12) and Jarmo's Mac pass (S13) at Gate 1.

## Workstream 3: The permanent checklist section (R3)

- **The release skill**, Step 2: "Generate test checklist" gains the rule that every checklist carries "The base window against the baseline", with the launch, the two script runs, and the 0.5% rule, and links to the frame baseline's README.
- **The `release-manager` agent**, "Test Checklist Generation": a fifth item, the base window's comparison on the Mac and on Windows.
- **`frame-screenshots.mjs`**: its usage text names installed apps as well as dev instances. A launch flag is added only if the audit finds the installed app needs one.
- **`docs/development/frame-baseline/README.md`**: a section "Comparing a release candidate", with the release baselines.
- The Codex harness follows through the harness sync (CLAUDE → CODEX); nothing is edited there by hand.
- This sprint's own `TEST-CHECKLIST.md` is the first to carry the section (S14).

## Workstream 4: The runtime review and update (R4)

- The review per `research/runtime-review.md`, as a table in the release plan's "Runtime versions" (as v1.14.0's).
- Jarmo decides (D1). An approved update follows the release skill's "Updating the bundled Claude Code" for Claude, and the manifest rows for Codex and OpenCode, each value measured from the published archives.
- Checks: `validate-agent-runtime-manifest.mjs`, `fetch-agent-runtimes.mjs` for every platform, `tsc` and the full `npm test`, the Sprint 127 probes, `verify-agent-runtimes.sh` on the release Mac, the agent runtime matrix workflow, and the compatibility matrix entry (pre-commit Check 11).
- The update merges before the version bump. `check:anthropic-models` runs again at Step 0 on the release source.

## Workstream 5: Version 2.0.0 (R5)

- A release-prep branch from `origin/main` after every other merge. The six files by targeted replacement; the diff read as 7 insertions and 7 deletions across 6 files; the pre-commit validator.
- It merges with Jarmo's admin-merge yes, and is the last merge before the candidate. `main` is frozen from then until publication (release skill).

## Workstream 6: Notes, changelog and user docs (R6)

- The list of PRs from `v1.14.0` to main, read from `git log`; each sorted into the product, the harness or docs.
- The `product-marketer` agent drafts from that list, the step plans and the existing step 1 and 2 notes. Jarmo approves the words. The notes cover the frame, the welcome, the project at the centre, the VS Code update, the runtimes and the fixes; "What moved" for someone updating; known issues (S7's findings, #417 if still open, anything a gate defers).
- `docs/CHANGELOG.md`: the 2.0.0 section completed and dated at publication.
- `docs/user/`: each page the [parity list](../parity-v1.14.md) names in its docs rows is rewritten for 2.0's places and words. `getting-started.md` follows the welcome.
- The Store's "What's new", the update feed's summary (`--notes-file`) and the GitHub body (absolute image URLs, release skill 8.2) come from the notes.
- The notes merge before the version bump. Corrections found during the freeze are held in an open PR and published from it, as the release skill's freeze rule says.

## Workstream 7: The Microsoft Store (R7)

Following `docs/microsoft-store-submission/PARTNER-CENTER-RUNBOOK.md` and the v1.14.0 record:
- After publication, the released installer goes to `windows/v2.0.0/Ritemark-Setup.exe` with the guarded uploader; the anonymous verification and a second refused plan are recorded in `evidence/`.
- A release-candidate record (`release-candidates/v2.0.0-candidate-N.md`) with the URL, size and SHA-256.
- `CERTIFICATION-NOTES-v2.0.0.md`: what changed for a tester (the welcome on first start, the sample project, usage data on by default and turned off on the welcome or in Settings).
- `LISTING-COPY.md` reviewed for 2.0 by the `product-marketer` agent; Jarmo approves.
- Screenshots: 5–7 from the installed signed Windows candidate at 1920 × 1080, with the sample project and a disposable profile (D4); captions under 200 characters; `ASSETS.md` updated.
- Partner Center: the package URL only, What's new, certification notes, listing copy and screenshots; validation results recorded honestly; Jarmo's action-time yes for the URL and SHA-256 and for any warning; Submit; the result recorded in `STATUS.md`.
- After certification: the Store-origin install check, and a v1.14.0 Store install updated.

## Workstream 8: Gates and publication (R8)

The release skill's Steps 0–10, with 2.0's specifics:
- **Step 0:** the GitHub milestone v2.0.0 open with its issues; `worktree-hygiene.mjs --check`; a new release worktree; `release-preflight.sh`; `check:anthropic-models`.
- **CI first:** `build-windows.yml` (with the repository's visibility toggled to private and back) and `build-macos-x64.yml` dispatched on `main` at the version bump's commit and green before the arm64 candidate. The weekly Windows canary green on the same Node as Sprint 135 set.
- **Step 2:** the arm64 build in a second new worktree after the bump; `TEST-CHECKLIST.md` generated with the release plan's Gate 2 list, R3's section, R9's rows and R10's check.
- **Gate 1:** Jarmo on the un-notarized arm64 DMG: S1, S9, S12 (where possible), S13, S18 (arm64), S31's Mac rows, S32, S33. Then the hardening window, then `notarize-dmg.sh`.
- **Gate 2:** Jarmo and the Windows session on the un-notarized x64 DMG and the Windows installer: S2, S3, S10, S11, S18, S31's Windows rows. Then the hardening window, then x64 notarization.
- **Step 8:** a draft release; `generate-update-feed.mjs --existing-feed-url` naming v1.14.0; the draft's digests against `dist/`; publication; the `latest` feed checked byte for byte.
- **Step 9:** the issue sweep against the milestone; the model catalog feed refreshed only if it was edited by hand (release skill).
- **Step 10:** the closeout; the evidence in `docs/releases/v2.0.0/evidence/`; the worktree left as `REVIEW` for Jarmo.
- **Release order (D6):** one publication with all three platforms.

## Workstream 9: Parity and usage data on the candidate (R9, R10)

- The parity list's rows become a section of `TEST-CHECKLIST.md`, with the Mac and Windows rows apart. Each row is ticked on the candidate, or deferred by Jarmo in writing in the checklist.
- S32's rows, which dev builds could not check, are walked on the arm64 candidate, and the ones that differ on Windows on the Windows candidate.
- Usage data (S33): a local stand-in for PostHog first (Sprint 133's QA used one at `127.0.0.1:9450`), then PostHog's live events for one yes run, filtered to `build_channel: prod` and the run's time.

## Workstream 10: Docs and closeout (E1, E2)

- The release plan: the sprint table, the tracker and the feature-complete checklist at each phase; the risk register closed at publication.
- `architecture.md`: the 2.0.0 version-history row.
- After publication: the release plan's status "Published", the note that the pause on releases from main has ended, and the v2.0.0 milestone closed.
- `node ./scripts/worktree-hygiene.mjs --report` at the end; cleaning is Jarmo's call.

## Delivery plan

1. **The sprint PR** (before the freeze): the audits, the harness (W3), the runtime update if approved (W4), the notes and changelog drafts, the user docs, the Store documents, and any fix the dress rehearsal found. It merges with Jarmo's admin-merge yes.
2. **The version bump PR** (W5): the last merge before the candidate.
3. **The candidate:** CI first, then the arm64 build, Gate 1, hardening and notarization, the x64 and Windows builds, Gate 2, hardening and notarization.
4. **Publication:** the draft-first release and the feed.
5. **The Store** submission with the same installer bytes.
6. **The closeout PR:** the checklist, the evidence, the release plan, the Store's evidence and status.

A fix found at any gate goes to main as its own PR, and a new candidate starts from a new worktree.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A one-time move on a v1.14.0 profile loses state that no step tested together | The update-path audit; the dress rehearsal before the bump; S1–S5 on every candidate |
| The signed build looks different from the dev build | Release baselines approved by Jarmo (D2); the frame scripts on each candidate |
| The debugging port does not open on a signed, hardened app | The installed-app audit first; if it does not, the comparison runs on the clean-room production build of the same commit before signing, and the signed app is checked by eye |
| A runtime update breaks on Node 24 or Electron 43 | The review names the risk; the runtime checks on all three platforms; the update can be declined (D1) |
| A late fix breaks the freeze | The freeze rule; a new candidate and a new gate for any fix |
| Notarization is refused (an expired Apple agreement, as in v1.13.0) | `notarize-dmg.sh` exits non-zero on any refusal; Jarmo renews the agreement; the DMG is unchanged |
| Smart App Control or SmartScreen treat 2.0's new bytes as unknown | Signed with Azure Trusted Signing as before; the release notes and `docs/user/windows-smart-app-control.md` say what to do |
| Store certification fails | The submitted object is never replaced; new bytes get a new versioned URL and a new candidate record |
| Going back to v1.14.0 confuses someone | S7's findings in the known issues |
