# Sprint 136 Technical Plan

The plan for [spec.md](spec.md). It is step 4 of the [v2.0.0 release plan](../release-plan.md). The release commands are the release skill's (`.claude/skills/release/SKILL.md`); this file says what 2.0 adds to them and in which order. When the work needs something else, this file changes first. References are to `main` at `16b5bf0d` (Sprint 135's closeout, #489). VS Code references are to 1.142.0 (`d956e8a6`), read in Sprint 135's worktree.

## What exists today

| Part | Today |
|---|---|
| Main | VS Code 1.142.0, Electron 43.7.7, Node 24.18.0, 18 patches. Merged since Sprint 134: #474 (the update), #476 (patch 004 skips Copilot's SDK shim in from-source builds; `release-preflight.sh` reads the pinned VS Code), #478 (Windows CI's signtool on PATH), #483 (Windows signing signs catalog-only PEs: `d3dcompiler_47.dll`, `dxil.dll`), #484 (`RITEMARK_SOURCE_COMMIT` stamps Ritemark's commit into `product.json`, checked by `validate-build-output.sh` Check 5e; patch 003 drops the agent host prewarm; About shows the commit; #463's code cache), #489 (closeout) |
| Proven on 1.142 | At `d60b9652`: a clean-room arm64 production build passed every app check (a terminal, highlighting, no agent host at launch, `CachedData`, About, `project-check.mjs` 6/6, `frame-geometry.mjs` 0 FAIL, 32 of 34 baseline scenes, More differing without Copilot Chat). macOS x64 CI (run 39467679900) and Windows CI (run 39467716747, the first green signed 2.0 Windows build) passed (Sprint 135's QA evidence, "E5 after the merge") |
| Still open from Sprint 135 | Windows PC round 4 on run 39467716747's installer (brief `ritemark-dev/.dev-manager/briefs/windows-round4-v2.md`, run by Jarmo's Windows session; the manager relays the results); S27 (the three runtimes) on darwin-x64, Windows and darwin-arm64, which needs a signed-in turn; the switch, share and About-this-project answers that need a signed-in AI (Gate 2 items) |
| The release path | The release skill's Steps 0–10 and the `release-manager` agent's two gates; last run for v1.14.0 (published 2026-10-15 from `ed0b6226`; `docs/releases/v1.14.0/evidence/`) |
| The update path for people | `src/update/updateResolver.ts` offers the newest full release with a higher version and an asset for the platform; a full update opens the download in the browser (`updateService.ts`). There is no native shell auto-update (#139) |
| Recent folders | From 1.142 they live in `~/.ritemark-shared/sharedStorage/state.vscdb` for every build and profile on the computer (`workspacesHistoryMainService.ts`, `StorageScope.APPLICATION_SHARED`); while that list is empty, 1.142 reads a profile's old per-profile list once. `--shared-data-dir` overrides the folder (`environmentService.ts`, `appSharedDataHome`). On this Mac, `~/.ritemark-shared` already holds dev and test runs' folders (#475) |
| The frame's checks | `scripts/qa/frame-screenshots.mjs` (scenes, light and dark, `--compare`, exit code = scenes over 0.5%), `frame-geometry.mjs`, `project-check.mjs` and `welcome-check.mjs`, run over CDP against an instance the operator starts. The baseline in `docs/development/frame-baseline/` (approved 18 October, the welcome's frames 19 October, the share question's 1.142 bar 20 October) was taken from dev builds |
| The release checklist | `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`, generated per release at Step 2 to the `release-manager` agent's list (new features, core regression, installation, sign-off). No screenshot comparison |
| Usage data | `consent.ts` `buildChannel`: `dev` for a development-mode extension or a plain version, `prod` for `X.Y.Z-suffix` (installed builds are floored to `X.Y.Z-0`). `posthog.ts` takes `RITEMARK_POSTHOG_PROJECT_KEY`/`_HOST` first, else product.json's key for `prod`. Settings: `ritemark.analytics.enabled` (an answer) and `ritemark.features.analytics` (the kill switch). Nothing marks a test run of an installed build (#480) |
| `build-prod.sh`'s guard | A backup of `extensions/ritemark` (lines 187–194), gulp (211), a size check of `media/webview.js` and `out/extension.js` that restores the whole folder (215–229). It has fired on every Mac build since at least 17 October (#471). Windows CI stages the extension out of `vscode/extensions/` before gulp (`stage-extension-for-shell-build.sh`, `--extension-layout absent`); macOS x64 CI copies it in as a real folder |
| The bundled runtimes | Claude Code 2.1.296 with Agent SDK 0.3.296, Codex 0.162.1, OpenCode 1.19.0 (v1.14.0, #424), in `extensions/ritemark/binaries/agents/manifest.json`. npm on 20 October: 2.1.304 / 0.3.304, 0.163.0, 1.19.3. `check:anthropic-models` OK on 20 October |
| The version | 1.14.0 in the six files the release skill lists |
| The notes | `docs/releases/v2.0.0/release-notes.md` (draft, steps 1–3 and the update); `docs/CHANGELOG.md`'s 2.0.0 section, "Unreleased" |
| The Store | Live as an EXE app (`docs/microsoft-store-submission/STATUS.md`); the v1.14.0 update submitted on 2026-10-17 from `getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`, last seen "Update in review"; a guarded uploader; screenshots from v1.10.1 (`ASSETS.md`). Jarmo submits through his ChatGPT flow |
| Disk | About 31 GB free on 20 October. A release worktree with its builds takes about 11–15 GB |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Extension (R11) | The card's tab title; the "Active:" chip's events and label; Settings' ChatGPT line; dictation's first language; no Documents refresh from a turn; a restored turn's duration; a flow's Claude Code sign-in line | `src/ritemarkEditor.ts`, `src/taskBoard/cardPages.ts`, `src/views/UnifiedViewProvider.ts`, `webview/src/components/ai-sidebar/` (`ChatInput.tsx`, `store.ts`, `conversationProjection.ts`), `src/conversations/types.ts`, `webview/src/components/VoiceDictationButton.tsx`, `webview/src/components/settings/RitemarkSettings.tsx`, the flow executor's Claude Code message |
| Extension (R10) | `RITEMARK_BUILD_CHANNEL=test` reports `test` | `src/analytics/consent.ts` and its test |
| Build (E5) | Gulp runs with the extension's link out of `vscode/extensions/`; a whole-tree digest guard | `scripts/build-prod.sh` (shell-tier), reusing `scripts/tree-sha256.mjs` |
| Release harness (R3, R10, E4) | The permanent screenshot section; the launch rule (`--shared-data-dir`, the test marker); release-only images for More | `.claude/skills/release/SKILL.md`, `.claude/agents/release-manager.md`, `.claude/skills/ritemark-automation/SKILL.md`, `.claude/commands/rundev.md`, `scripts/qa/plan-truth-matrix.sh`, `scripts/qa/frame-screenshots.mjs` (usage text, a release-images option only if needed), `docs/development/frame-baseline/` |
| Bundled runtimes (R4) | Updated to the versions Jarmo approves (D1) | `extensions/ritemark/binaries/agents/manifest.json`, `extensions/ritemark/package.json` (Agent SDK), `scripts/validate-agent-runtime-manifest.mjs`, `docs/development/agent-runtime-compatibility.md` |
| Version (R5) | 2.0.0 in six files | `branding/product.json`, `branding/BRANDING.json`, `branding/VERSION`, `extensions/ritemark/package.json`, `extensions/ritemark/package-lock.json`, `installer/windows/ritemark.iss` |
| Docs (R6, E1) | Notes, changelog, user docs, the checklist, evidence, the parity list | `docs/releases/v2.0.0/`, `docs/CHANGELOG.md`, `docs/user/`, `parity-v1.14.md` |
| Store (R7) | The brief, certification notes, listing copy, screenshots, candidate record, evidence | `docs/microsoft-store-submission/` |

The release tier is **shell**: the release is a full app build, and `build-prod.sh`, the runtime manifest and `installer/windows/ritemark.iss` are shell-tier by path. No VS Code patch changes in this sprint.

## Phase 1 audits

1. **`research/update-path-audit.md`** (R1, E4): every change 2.0 makes once to a v1.14.0 profile, and how each is marked done:
   - the places order and the views moved out of the AI column (002, 018; Sprint 132 W12);
   - terminals moved to the desk (019);
   - the theme set-up run once per profile (Sprint 132's fix);
   - the update welcome and its usage-data carry-over (`ritemark.activation.lastConfirmedVersion`, `ritemark.updatedFrom1x`; Sprint 133);
   - the recent folders' one-time copy into the shared list, and whether the welcome's first-start check, the projects list's first fill and "Open where you left" assume one profile's list (#475);
   - the project list's first fill and What moved (Sprint 134);
   - the extension copies in the user directory, and which one loads (`activationIntegrity.ts`, patch 012);
   - what v1.14.0 sees if it starts on a profile 2.0 has used (S7).
   It lists what each step's QA already proved on a v1.14.0 profile (Sprint 135's S23 among them), so this sprint tests the whole chain once on production builds rather than each part again.
2. **`research/installed-app-cdp.md`** (R2, R3, R10, E4): the frame scripts against an installed, signed app. On the Mac, `open -n -g` (and `--arch x86_64` for the x64 build under Rosetta) with `--remote-debugging-port`, a short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, and `RITEMARK_BUILD_CHANNEL=test` in the environment, which `open` passes on (memory: installed-app isolated CDP repro). The signed, hardened v1.14.0 in Applications answers whether the port opens before any 2.0 candidate exists; the dress rehearsal's build gives the 2.0 scenes. On Windows, the same flags on `Ritemark.exe`, and whether the Windows session can run the scripts on the PC. Quitting with ⌘Q keeps state; how the scenes differ from the dev baseline (More, anything else).
3. **`research/runtime-review.md`** (R4): each runtime's npm `latest` (and Codex's latest GitHub release) against v1.14.0's, with the main changes since; `check:anthropic-models` against Anthropic's catalog of the day; anything that needs Node 24 or Electron 43 or breaks on them; for Codex, whether a new binary brings back the keychain prompt (memory: Codex keychain prompt storm). It ends with the recommendation for D1, and Jarmo answers before the update is written.
4. **Two asks to the Experience lead** (R11), through the Development manager: whether picking a language in dictation's menu only sets it or also starts dictation (#486), and whether the drawings show a task card's tab differently from its title (#477).

## Workstream 1: Lived-in profiles and the update (R1, E3)

- **The profiles.** "Harbour" (scenarios.md) is made with the installed v1.14.0, in the background, with its own short user-data and extensions directories (memory: no pop-up test windows). On the Mac it is scripted over CDP where it can be, as Sprint 132's S45 was; recordings are copied in as files, not recorded. On Windows the Windows session makes the same profile by hand on the PC. Each profile is archived (zipped, outside the repository) so every run starts from the same one.
- **The dress rehearsal (E3).** See Workstream 12.
- **On each candidate.** S1–S7 on the Mac (S3 on an Intel Mac, or under Rosetta), S2 on Windows. Every scripted run gets an empty `--shared-data-dir`, so Harbour's recent folders copy across as a person's will.
- **Jarmo's own Mac (D3, S43).** With his yes: a copy of his profile folder, then `~/.ritemark-shared` moved aside, then the candidate installed over his v1.14.0.
- **Going back (S7).** Recorded in the notes' known issues, never fixed in this sprint.
- **After publication (S8).** A v1.14.0 app on the Mac and on Windows is offered 2.0.0.

## Workstream 2: Signed-build looks (R2)

- On each candidate, per `research/installed-app-cdp.md`: `frame-geometry.mjs` (all four layouts) and `frame-screenshots.mjs --compare`, in Light and Dark, on a fresh profile with the baseline's sample project.
- **More's release-only images (D2).** The dress rehearsal's More scenes are the first look; the first candidate's two More captures (light, dark) are shown to Jarmo with their difference from the dev baseline. With his approval they go into `docs/development/frame-baseline/release/`, and the comparison takes them for More when it runs against a production build. Every other scene compares with the approved baseline. If the script cannot take a second folder for two scenes, it gets the smallest option that can (`--release`), or the two scenes are compared separately; the audit decides.
- **Windows (D2).** Where the Windows session can run the scripts, the first Windows candidate's captures become `release-win32/` with Jarmo's approval. Where it cannot, its screenshots are compared by eye with round 4's and round 5's.
- High contrast, zoom and two desks are looked at by eye on the candidate, with screenshots in the QA evidence.
- On Windows: S11 by the Windows session.
- Another macOS (S12) and Jarmo's Mac pass (S13) at Gate 1.

## Workstream 3: The permanent checklist section (R3)

- **The release skill**, Step 2: "Generate test checklist" gains the rule that every checklist carries "The base window against the baseline", with the launch (its own profile, `--shared-data-dir`, `RITEMARK_BUILD_CHANNEL=test`, a debugging port), the two script runs, and the 0.5% rule, and links to the frame baseline's README.
- **The `release-manager` agent**, "Test Checklist Generation": a fifth item, the base window's comparison on the Mac and on Windows, and the launch rule.
- **`frame-screenshots.mjs`**: its usage text names installed apps as well as dev instances. An option is added only if the audit finds the installed app or More's release images need one.
- **`docs/development/frame-baseline/README.md`**: a section "Comparing a release candidate", with the release images and the launch flags.
- The Codex harness follows through the harness sync (CLAUDE → CODEX); nothing is edited there by hand.
- The dress rehearsal runs the section against its production build first; this sprint's own `TEST-CHECKLIST.md` is the first to carry it (S14).

## Workstream 4: The runtime review and update (R4)

- The review per `research/runtime-review.md`, as a table in the release plan's "Runtime versions" (as v1.14.0's).
- Jarmo decides (D1). An approved update follows the release skill's "Updating the bundled Claude Code" for Claude, and the manifest rows for Codex and OpenCode, each value measured from the published archives.
- Checks: `validate-agent-runtime-manifest.mjs`, `fetch-agent-runtimes.mjs` for every platform, `tsc` and the full `npm test`, the Sprint 127 probes, `verify-agent-runtimes.sh` on the release Mac, the agent runtime matrix workflow, and the compatibility matrix entry (pre-commit Check 11).
- The update is in the first sprint PR, so the dress rehearsal's runtime turn (S18, arm64) and the Windows round's run on it. `check:anthropic-models` runs again at the dress rehearsal and in the candidate's worktree.

## Workstream 5: Version 2.0.0 (R5)

- A release-prep branch from `origin/main` after every other merge. The six files by targeted replacement; the diff read as 7 insertions and 7 deletions across 6 files; the pre-commit validator.
- It merges with Jarmo's admin-merge yes, and is the last merge before the candidate. `main` is frozen from then until publication (release skill).

## Workstream 6: Notes, changelog and user docs (R6)

- The list of PRs from `v1.14.0` to main, read from `git log`; each sorted into the product, the harness or docs.
- The `product-marketer` agent drafts from that list, the step plans and the existing notes draft. Jarmo approves the words. The notes cover the frame, the welcome, the project at the centre, the VS Code update, the runtimes and the fixes (R11); "What moved" for someone updating; known issues (S7's findings, #417, #454, anything a gate defers).
- `docs/CHANGELOG.md`: the 2.0.0 section completed, and dated at publication.
- `docs/user/`: each page the [parity list](../parity-v1.14.md) names in its docs rows (G9) is rewritten for 2.0's places and words; `getting-started.md` follows the welcome; `features/ai-agents.md` carries R11's Codex line.
- The Store's "What's new", the update feed's summary (`--notes-file`) and the GitHub body (absolute image URLs, release skill 8.2) come from the notes.
- The notes merge in the second sprint PR, before the version bump. Corrections found during the freeze are held in an open PR and published from it, as the release skill's freeze rule says.

## Workstream 7: The Microsoft Store (R7)

Following `docs/microsoft-store-submission/PARTNER-CENTER-RUNBOOK.md` and the v1.14.0 record:
- Before the brief: the v1.14.0 update's state in Partner Center, read from Jarmo or the last record.
- After publication, the released installer goes to `windows/v2.0.0/Ritemark-Setup.exe` with the guarded uploader; the anonymous verification and a second refused plan are recorded in `evidence/`.
- A release-candidate record (`release-candidates/v2.0.0-candidate-N.md`) with the URL, size and SHA-256.
- `CERTIFICATION-NOTES-v2.0.0.md`: what changed for a tester (the welcome on first start, the sample project, usage data on by default and turned off on the welcome or in Settings).
- `LISTING-COPY.md` reviewed for 2.0 by the `product-marketer` agent; Jarmo approves.
- Screenshots: six from the installed signed Windows candidate at 1920 × 1080, with the sample project, a disposable profile and the test marker; the scenes as the Experience lead picks them; captions under 200 characters; `ASSETS.md` updated.
- The brief for Jarmo's ChatGPT flow: the package URL and SHA-256 (the only change in the package), What's new, the certification notes, the listing copy and the screenshots. Jarmo submits; the result is recorded in `STATUS.md`.
- After certification: the Store-origin install check, and a v1.14.0 Store install updated.

## Workstream 8: Gates and publication (R8)

The release skill's Steps 0–10, with 2.0's specifics:
- **Step 0** is the dress rehearsal (Workstream 12): `worktree-hygiene.mjs --check`, a new release worktree, `release-preflight.sh`, `check:anthropic-models`, plus its build. The GitHub milestone v2.0.0 holds every issue this sprint fixes or defers.
- **CI first:** `build-windows.yml` (with the repository's visibility toggled to private and back) and `build-macos-x64.yml` dispatched on `main` at the version bump's commit and green before the arm64 candidate.
- **Step 2:** the arm64 build in a new worktree after the bump (the dress rehearsal's removed first, E2); `TEST-CHECKLIST.md` generated with the release plan's Gate 2 list, R3's section, the parity rows, R10's check and E4's line.
- **Gate 1:** Jarmo on the un-notarized arm64 DMG: S1, S9, S12 (where possible), S13, S18 (arm64), S31's Mac rows, S32, S33, S34, S43, and the fixes S35–S41. Then the hardening window, then `notarize-dmg.sh`.
- **Gate 2:** Jarmo and the Windows session on the un-notarized x64 DMG and the Windows installer: S2, S3, S10, S11, S18, S31's Windows rows, the fixes on Windows. Then the hardening window, then x64 notarization.
- **Before publication:** the Development manager confirms the privacy policy's usage-data lines with Traffic (R8).
- **Step 8:** a draft release; `generate-update-feed.mjs --existing-feed-url` naming v1.14.0; the draft's digests against `dist/`; publication of all three platforms; the `latest` feed checked byte for byte.
- **Step 9:** the issue sweep against the milestone; the model catalog feed refreshed only if it was edited by hand (release skill). The marketing handoff goes to the Development manager, who coordinates Social and Traffic as for v1.14.0.
- **Step 10:** the closeout; the evidence in `docs/releases/v2.0.0/evidence/`; the worktree left as `REVIEW` for Jarmo.

## Workstream 9: Parity and usage data on the candidate (R9, R10)

- The parity list is brought up to date at Phase 0: G1 and G2 marked done from Sprint 133's QA evidence, G6 pointed at R11's #459 fix, G7 and G8 marked with Jarmo's answer (D5), G9 at R6.
- Its rows become a section of `TEST-CHECKLIST.md`, with the Mac and Windows rows apart. Each row is ticked on the candidate, or deferred by Jarmo in writing in the checklist.
- S32's rows, which dev builds could not check, are walked on the arm64 candidate, and the ones that differ on Windows on the Windows candidate. The ChatGPT turns follow the 19 October rule for the real `~/.codex` (back up and restore `config.toml` byte for byte; stop on any keychain prompt).
- Usage data (S33): the local stand-in first (Sprint 133's QA used one at `127.0.0.1:9450`), then one live run to PostHog marked `test`, filtered by its time.

## Workstream 10: Docs and closeout (E1, E2)

- The release plan: the sprint table, the tracker, the issue intake and the feature-complete checklist at each phase; the risk register closed at publication.
- `architecture.md`: the 2.0.0 version-history row.
- After publication: the release plan's status "Published", the note that the pause on releases from main has ended, and the v2.0.0 milestone closed.
- `node ./scripts/worktree-hygiene.mjs --report` at the end; cleaning is Jarmo's call.

## Workstream 11: The fixes before the candidate (R11, R10)

All extension-tier, in the first sprint PR, each with its unit test where the code allows one. From the code audit on 20 October:

| Issue | Where | The change |
|---|---|---|
| #477 the card's tab | `ritemarkEditor.ts` `resolveCustomTextEditor` (it never sets `webviewPanel.title`); `cardPages.ts` `cardModeFor` (returns only `{cardId}`) and its `onDidChangeTextDocument` listener; `cardFile.ts` `parseCardFile` | `cardModeFor` also returns the parsed title; the editor sets `webviewPanel.title` for a card page and again when its text changes. VS Code's `CustomEditorInput.getName()` already prefers a webview title, and patch 019's tab row reads `getName()`/`getTitle()` (check on 1.142) |
| #477 the chip's label, #485 the chip | `UnifiedViewProvider.ts` `_sendActiveFile`, `_getActiveFileContext`; the webview's `store.ts` (`active-file-changed`) and `ChatInput.tsx` (`Active:`) | `active-file-changed` gains an optional label (a card's title); the host also sends on `tabGroups.onDidChangeTabGroups`, `window.onDidChangeActiveTextEditor` and `workspace.onDidDeleteFiles`, and drops a file that no longer exists; no file tab in front sends none |
| #482 Codex on Free | `RitemarkSettings.tsx:708`; `docs/user/features/ai-agents.md:142`, `:151` | New words for the line and the two doc rows; the welcome (`welcomeCopy.ts`) and the AI column's sheets were checked and need nothing |
| #486 dictation's language | `VoiceDictationButton.tsx` (fallbacks at lines 26, 39 and 76–77; `handleLanguageSelect` 149–155 and the More languages picker 421–427 start dictation); `ritemarkEditor.ts`'s load message (362–378) | The load message carries `vscode.env.language`; the fallbacks map it to a Whisper code, else `en`; the menu's start follows the Experience lead; the pick is checked across documents and a restart, and kept on the host (globalState) if the webview's storage loses it |
| #487 the left column | `UnifiedViewProvider.ts` `_refreshExplorerForAgentWrites` (3319–3334), called at a Claude turn's end (1146), a Codex or OpenCode turn's end (1206) and a turn Claude starts after background work (3505) | Turns no longer run `workbench.files.action.refreshFilesExplorer` (it opens Documents before refreshing); the file-system nudge stays, and a refresh runs only when Documents is the visible view |
| #488 a restored turn's time | `conversationProjection.ts:46` (`durationMs: 0` for every restored Claude turn); `activityState.ts:117`; `src/conversations/types.ts` (no duration on events); `ConversationController.ts` `completeRuntimeTurn` | The assistant event gains an optional active duration, written when the turn completes; the projection uses it and leaves `metrics` out when there is none, so an older turn shows "Done" |
| #459 a flow's Claude Code step (G6) | The flow executor's Claude Code sign-in message | Name the Settings heading that holds the card, as the ChatGPT step's "Sign in with ChatGPT in Ritemark Settings" does |
| #480 our own runs | `consent.ts` `buildChannel` | `RITEMARK_BUILD_CHANNEL=test` returns `test`; a unit test for it |

The bundles: the webview fixes rebuild `media/webview.js` once, in one PR, so no two open PRs carry clashing bundles (memory: bundles clash). The PR is smoke-tested by the Development manager in a dev build before Jarmo's merge.

## Workstream 12: Test launches, the build guard and the dress rehearsal (E3, E4, E5)

- **E4, the launch rule.** `--shared-data-dir <own folder>` beside `--user-data-dir`, and `RITEMARK_BUILD_CHANNEL=test`, in `.claude/commands/rundev.md` (the dev folder `~/.ritemark-dev-shared`), the `ritemark-automation` skill's launch, `scripts/qa/plan-truth-matrix.sh`, the frame baseline's README and R3's section. The Development manager passes the rule to the sessions that launch builds (the Experience lead, Social, the Windows session). Moving Jarmo's `~/.ritemark-shared` aside is a Gate 1 step with his yes (S43).
- **E5, the build guard.** In `build-prod.sh`: before gulp, the `vscode/extensions/ritemark` link is removed (it is a link on the Mac, so nothing is moved; `apply-patches.sh` already knows the `absent` layout), and it is put back right after gulp and by a `trap` on every other exit; the guard compares `tree-sha256.mjs` digests of `extensions/ritemark` before and after gulp and stops on a difference, printing the changed files; the backup and restore go. `build-prod.sh` step 4 already copies the extension into the app, so the app does not change. The `vscode-development` skill gets the note on gulp's packaging tasks.
- **E3, the dress rehearsal** (the release skill's Step 0), after the first sprint PR merges:
  - a new worktree from `create-release-worktree.sh`; `release-preflight.sh`; `check:anthropic-models`;
  - `build-prod.sh` under the arm64 wrapper, in the background; S44; `validate-build-output.sh`;
  - the app run hidden with the launch rule: Sprint 135's E5 checks, `project-check.mjs`, `frame-geometry.mjs`, R3's section with `--compare` (the first look at More's production scenes), S1, S4, S5, S6 with "Harbour", S18 (arm64), S34;
  - macOS x64 CI and Windows CI dispatched on the same commit (the visibility toggled and back), and Windows round 5 on that installer (S46), with a brief through the Development manager;
  - not signed and never offered as a release. Its findings are fixed on main before the version bump, and its worktree is removed with Jarmo's yes before the candidate's is made (E2).

## Delivery plan

1. **The first sprint PR** (the fixes and the harness): R11, R10's marker, E4's launch rule, E5's build guard, R3's checklist section, and the runtime update if approved (R4). Phase 1's audits ride along. The Development manager smoke-tests it; `qa-validator` reviews it; it merges with Jarmo's admin-merge yes.
2. **The dress rehearsal** on main's new commit (E3, Step 0), with macOS x64 CI, Windows CI and Windows round 5 on the same commit.
3. **The second sprint PR** (the release documents): the notes and changelog, the user docs, the Store documents, the parity list, and any fix the dress rehearsal or round 5 found. It merges with Jarmo's admin-merge yes.
4. **The version bump PR** (W5): the last merge before the candidate.
5. **The candidate:** CI first, then the arm64 build, Gate 1, hardening and notarization, the x64 and Windows builds, Gate 2, hardening and notarization.
6. **Publication:** the draft-first release and the feed, for all three platforms, once the privacy policy is updated.
7. **The Store** brief with the same installer bytes; Jarmo submits.
8. **The closeout PR:** the checklist, the evidence, the release plan, the Store's evidence and status.

A fix found at any gate goes to main as its own PR, and a new candidate starts from a new worktree.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A one-time move on a v1.14.0 profile loses state that no step tested together | The update-path audit; the dress rehearsal before the bump; S1–S5 on every candidate |
| Our own tests write into the recent folders people's 1.x lists migrate from, on Jarmo's Mac or in a test (#475) | E4's `--shared-data-dir` on every launch; Jarmo's `~/.ritemark-shared` moved aside before Gate 1 (S42, S43) |
| Our own tests count as people in the launch week's usage data (#480) | R10's marker on every test launch; the payload checks against a stand-in (S33, S34) |
| The build-guard change alters the built app (#471) | The dress rehearsal's build and both CI runs before the bump; reverted and deferred if the app differs |
| A fix in R11 breaks something next to it | One PR, unit tests, the manager's smoke test, the dress rehearsal, Windows round 5, then the gates |
| Windows round 4 or 5 finds a defect | It is fixed on main before the bump (round 4 in the first sprint PR, round 5 in the second) |
| The signed build looks different from the dev build | More's release images (D2); the frame scripts on the dress rehearsal and each candidate |
| The debugging port does not open on a signed, hardened app | The installed-app audit tries it on the signed v1.14.0 first; if it does not open, the comparison runs on the clean-room production build of the same commit before signing, and the signed app is checked by eye |
| A runtime update breaks on Node 24 or Electron 43, or a new Codex brings back the keychain prompt | The review names the risk; the runtime turn on the dress rehearsal and on all three platforms; the update can be declined (D1) |
| The disk runs out with two release worktrees | One release worktree at a time (E2); removals asked of Jarmo at each step |
| A late fix breaks the freeze | The freeze rule; a new candidate and a new gate for any fix |
| Notarization is refused (an expired Apple agreement, as in v1.13.0) | `notarize-dmg.sh` exits non-zero on any refusal; Jarmo renews the agreement; the DMG is unchanged |
| Smart App Control or SmartScreen treat 2.0's new bytes as unknown | Signed with Azure Trusted Signing as before; the release notes and `docs/user/windows-smart-app-control.md` say what to do |
| The privacy policy is not updated by publication day | It is a precondition of publication (R8), tracked by the Development manager from the sprint's start |
| Store certification fails | The submitted object is never replaced; new bytes get a new versioned URL and a new candidate record |
| Going back to v1.14.0 confuses someone | S7's findings in the known issues |
