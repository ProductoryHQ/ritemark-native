# Sprint 136: 2.0 as one release

Track: SDD (a release with many parts: the fixes found since the steps merged, the update from 1.14, signed-build checks, a permanent release check, the runtimes, the version, notes, the Store, the gates)
Override with: "use plain full track"
Branch: `sprint-136-release` from `origin/main` (created only after Jarmo approves this plan); the version bump on its own release-prep branch
Release tier: shell (the release itself; `build-prod.sh`, the runtime manifest and `installer/windows/ritemark.iss` are shell-tier by path)
Status: **Approved by Jarmo on 2026-10-20** ("approves"), with D1–D5 as recommended. Drafted 2026-10-18; refreshed 2026-10-20 after Sprint 135 merged (main `16b5bf0d`), with the new 2.0 issues. Phase 3 started on `sprint-136-release` from `16b5bf0d`; the plan stays on the sprint branch (no docs PR first).

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R11 and E1–E5.
- [scenarios.md](scenarios.md): S1–S46, the manual QA matrix, on top of the [v1.14 parity list](../parity-v1.14.md) and Sprints 132–135's scenarios.
- [technical-plan.md](technical-plan.md): what exists today, workstreams W1–W12, the audits, the delivery plan.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

It is step 4 of the [v2.0.0 release plan](../release-plan.md), after the VS Code update ([Sprint 135](../sprint-135-vscode-update/sprint-plan.md)).

## Goal

v2.0.0 is published for the Mac (Apple silicon and Intel) and for Windows, and in the Microsoft Store, with the small things found since the steps merged fixed first. A v1.14.0 user updates and finds all their work, in the new frame, with the AI ready. Every release from now on compares its window with the approved baseline before Jarmo tests it, and our own test runs no longer count as people.

## Where things stand (20 October)

- **Sprint 135 is merged.** Main is `16b5bf0d`: VS Code 1.142.0, Electron 43.7.7, Node 24.18.0, all 18 patches. Merged in order: #474 (the update), #476, #478, #483, #484 (Ritemark's commit in `product.json`, so 1.142 finds its node modules; no agent host prewarm; About shows the commit) and #489 (the closeout).
- **Proven at `d60b9652`:** a clean-room arm64 production build passed every app check, and macOS x64 CI and Windows CI are green (Windows run 39467716747: the first green signed 2.0 Windows build).
- **Still open from Sprint 135, now this sprint's:** Windows PC round 4 on that installer (Jarmo's Windows session runs it; the Development manager relays the results); the three runtimes on darwin-x64 and Windows (S27), and the runtime turn at Gate 2.
- **The milestone v2.0.0** holds seven issues: #477, #485, #482, #486, #487, #488 and #475. This plan adds #459, #471 and #480 (below).
- `check:anthropic-models` printed OK on 20 October for the bundled Claude Code 2.1.296.

## Linked Issues

| Issue | In this sprint | Where |
|---|---|---|
| [#477](https://github.com/ProductoryHQ/ritemark-native/issues/477) A task card's tab and AI chip show its file name, not its title | Fix | R11; S35 |
| [#485](https://github.com/ProductoryHQ/ritemark-native/issues/485) The "Active:" chip stays after its file is closed or deleted | Fix, with #477 | R11; S36 |
| [#482](https://github.com/ProductoryHQ/ritemark-native/issues/482) Settings and the user docs say Codex needs ChatGPT Plus or Pro | Fix | R11; S37 |
| [#486](https://github.com/ProductoryHQ/ritemark-native/issues/486) Dictation starts in Estonian for everyone; picking a language starts dictation | Fix; the menu's behaviour from the Experience lead | R11; S38 |
| [#487](https://github.com/ProductoryHQ/ritemark-native/issues/487) The left column opens by itself when an AI turn ends | Fix | R11; S39 |
| [#488](https://github.com/ProductoryHQ/ritemark-native/issues/488) A restored chat shows "Done in 0.0s" | Fix | R11; S40 |
| [#459](https://github.com/ProductoryHQ/ritemark-native/issues/459) A flow's Claude Code step names the wrong place to sign in (the parity list's G6) | Fix (added) | R11; S41 |
| [#480](https://github.com/ProductoryHQ/ritemark-native/issues/480) Our own test runs of installed builds count as people | Fix (added) | R10; S34 |
| [#475](https://github.com/ProductoryHQ/ritemark-native/issues/475) From 1.142 every build on a computer shares the recent folders | Fix for tests; Jarmo's Mac cleared with his yes | E4; S42, S43 |
| [#471](https://github.com/ProductoryHQ/ritemark-native/issues/471) VS Code's packaging overwrites our extension's source during the Mac build | Fix (added) | E5; S44 |
| [#139](https://github.com/ProductoryHQ/ritemark-native/issues/139) Native shell auto-update | Not in 2.0 | v1.14.0 users move to 2.0 through today's update flow |

Every issue on the v2.0.0 milestone is closed or explicitly deferred at the end (R8). The open issues off the milestone that 2.0 touches (#464, #461, #460, #454, #434, #433, #417) stay open for 2.1 or later; #417 and #454 are known issues in the notes.

## MVP Scope

| Area | Requirements |
|---|---|
| The fixes found since the steps merged | R11 |
| Updating from a lived-in v1.14.0 profile, on the Mac and on Windows | R1, E3 |
| Light, Dark and Windows on the signed builds | R2 |
| A screenshot comparison in every release's checklist, for good | R3 |
| The runtime review for the gap since v1.14.0, and `check:anthropic-models` | R4 |
| Version 2.0.0 in all six files | R5 |
| Release notes, the changelog and the user docs, with `product-marketer` | R6 |
| The Microsoft Store listing, screenshots and update | R7 |
| The shell-tier gates, publication and closeout | R8 |
| The parity list and usage data proved on the signed build; our test runs marked | R9, R10 |
| Docs, build hygiene and disk; recent folders across builds; the build guard | E1, E2, E4, E5 |

**Not in this sprint:**
- new features or redesigns (only R11 and fixes for what the gates find);
- a second VS Code update (1.143.0 comes after 2.0; Sprint 135's D2);
- native shell auto-update (#139);
- the issues off the milestone listed above;
- an automatic shared data folder for development builds (a patch; the launch flag covers this sprint);
- website and launch work, which the Development manager coordinates with Social and Traffic, as for v1.14.0.

## How it is delivered

1. **The first sprint PR, the fixes and the harness:** R11, R10's test marker, E4's launch rule, E5's build guard, R3's checklist section, and the runtime update if approved (D1). It merges with Jarmo's admin-merge yes after the Development manager's smoke test.
2. **The dress rehearsal (E3):** the release skill's Step 0 on main's new commit, with a clean-room production build, R1's update with "Harbour" on the Mac, the runtime turn and R3's section; macOS x64 CI and Windows CI on the same commit, and Windows round 5 on that installer.
3. **The second sprint PR, the release documents:** the notes and changelog, the user docs, the Store documents, the parity list, and any fix the dress rehearsal or round 5 found.
4. **The version bump**, the last merge. `main` is frozen from here until publication.
5. **The candidate:** CI proven green at the bump's commit; the arm64 build, Gate 1, the hardening window and notarization; the x64 and Windows builds, Gate 2, the hardening window and notarization.
6. **Publication**, draft first, with the feed, for all three platforms once the privacy policy is updated.
7. **The Store**, with the same installer bytes: this sprint prepares the brief, Jarmo submits.
8. **The closeout PR**: the checklist, the evidence, the release plan.

A fix at any gate goes to main as its own PR, and a new candidate starts from a new worktree.

## Product Decisions

- **2026-10-15 (Jarmo):** v1.14.0 was published on all three platforms at once, with the Development manager coordinating Social's video and Traffic's website update. 2.0 does the same. (This answers the 18 October draft's D5 and D6.)
- **2026-10-15 and 2026-10-17 (Jarmo):** the Store stays with Jarmo's ChatGPT flow; the Development manager prepares the submission and verifies the hosted file.
- **2026-10-17 (Jarmo):** "We will focus on 2.0 from now on." v1.14.0 is the last 1.x release, and no release is built from main until 2.0.
- **2026-10-17 (release plan):** step 4's scope: updating from v1.14.0; Dark and Windows checked; a screenshot comparison of the base window in the release checklist; the runtime review; version 2.0.0, notes and the store listing; the shell-tier gates.
- **2026-10-18 (Sprint 135's plan, D2):** 2.0 ships on the VS Code release frozen in Sprint 135, 1.142.0.
- **2026-10-19 (Jarmo):** usage data is on by default, with no location, and ritemark.app's privacy policy is updated at release, so publication waits for it (R8). #270 is 2.1's first item.
- **2026-10-20 (Jarmo):** "start 136", planning first, with Sprint 135's outcome and the new 2.0 fixes. Equations are #481 and counting the AI chat's use is #479, both in v2.1.0.

## Engineering decisions in this plan (20 October)

- **#480, #459 and #471 join the sprint.** #480 because this sprint's own tests on installed builds would otherwise be the biggest source of false people in launch week. #459 because it is the parity list's last open gap (G6). #471 because the release builds' safety rests today on a size check of two files.
- **#471 is fixed in `build-prod.sh`, not in a patch:** gulp runs with the extension's link out of `vscode/extensions/`, as Windows CI already does, and a whole-tree digest replaces the size check. The dress rehearsal and both CI runs prove it before the version bump; if the built app differs in any way the change did not mean, it is reverted and #471 waits until after 2.0.
- **#475 needs no patch:** VS Code 1.142 has its own `--shared-data-dir` flag, so every test and development launch gets its own folder.
- **#480's marker** is one environment variable, `RITEMARK_BUILD_CHANNEL=test`, that makes an installed build report `build_channel: test`. Payload checks use a local stand-in, and one live run proves delivery.
- **All the webview fixes go in one PR**, so no two open PRs carry clashing `media/webview.js` bundles.
- **The dress rehearsal is the release skill's Step 0**, so its worktree does both jobs, and only one release worktree is on disk at a time (about 31 GB free; a worktree with its builds takes about 11–15 GB).
- The update is proved on signed builds after the dress rehearsal on a production build from main; the frame scripts run against installed apps; the release check becomes permanent in the release skill and the `release-manager` agent; the parity list becomes a section of this release's checklist (18 October, unchanged).

## Decisions for Jarmo

Each has a recommendation, and the plan is written to them. **Jarmo approved the plan with all five as recommended on 2026-10-20** ("approves"). He named no Intel Mac or older macOS, so D4 runs the Intel build under Rosetta on the release Mac until one is at hand.

- **D1: Update the bundled runtimes for 2.0.** Recommended: yes, all three to the latest at the review, as every release does. The gap is small (on 20 October: Claude Code 2.1.296 → 2.1.304 with its Agent SDK, Codex 0.162.1 → 0.163.0, OpenCode 1.19.0 → 1.19.3), and the runtime turn has to run on 1.142 anyway. You see the review's table before the update merges. (R4)
- **D2: More's two screenshots on release builds.** Recommended: the first candidate's two More captures (light and dark) become release-only images with your approval, because a release build has no Copilot Chat in More. Every other scene keeps comparing with the baseline you approved. Windows gets its own baseline if the Windows session can run the scripts on the PC, and is otherwise compared by eye with rounds 4 and 5. (R2, R3)
- **D3: Gate 1 updates your own Mac.** Recommended: yes, after the scripted run on the made-up "Harbour" profile has passed on the candidate, with a copy of your profile folder taken first. Just before you start it, `~/.ritemark-shared` (which today holds folders from our dev and test runs) is moved aside, not deleted, so your 1.x recent folders come across as they will for everyone (#475). Going back to v1.14.0 afterwards works but looks different (S7). (R1, E4)
- **D4: Which machines see the candidate.** Recommended: the release Mac and the Windows PC for every check. The Intel build runs under Rosetta on the release Mac unless an Intel Mac is at hand, and an older macOS (13–15) is used only where one is at hand; the evidence says which. Please say if an Intel Mac or an older macOS is available. (R1, R2, R4)
- **D5: Two small gaps in the parity list.** Recommended: accept both for 2.0. G7: maximising the AI's column is reachable only from All commands, because its title row is gone. G8: VS Code's walkthrough commands, the accessibility one included, open Ritemark's welcome; they teach code editing, and every command they name stays available. (R9)

## Feature Flag Check

No new flag. 2.0 is built on main with no switch (Jarmo, 17 October). HARD RULE #1 holds through the parity list (R9). R11's fixes change behaviour in place and need no flag.

## Success Criteria

- [ ] The fixes found since the steps merged are in, each with its scenario passed on the Mac and on Windows (R11).
- [ ] A lived-in v1.14.0 profile updates on the Mac and on Windows and loses nothing, recent folders included (R1).
- [ ] Light, Dark, high contrast and Windows match the baseline on the signed builds, or Jarmo approved each difference (R2).
- [ ] Every release's checklist carries the screenshot comparison, and the release skill and the `release-manager` agent say so (R3).
- [ ] The runtime review is done, Jarmo's decision is carried out, and `check:anthropic-models` is OK (R4).
- [ ] Version 2.0.0 is in all six files, and the bump was the last merge (R5).
- [ ] The notes and changelog cover everything since v1.14.0, and the user docs describe 2.0 (R6).
- [ ] The Store shows and installs 2.0 (R7).
- [ ] v2.0.0 is published through Gate 1 and Gate 2, notarized after the hardening window, with the feed verified, and closed out (R8).
- [ ] Every parity row is ticked or deferred by Jarmo, on the signed build (R9).
- [ ] The four events arrive only after a yes, as `prod`, and our own test runs arrive as `test` or not at all (R10).
- [ ] Test runs no longer touch the installed app's recent folders, and the Mac build leaves the extension's source alone (E4, E5).

## Risks

| Risk | Retirement |
|---|---|
| A one-time move on a v1.14.0 profile loses state that no step tested together | The update-path audit; the dress rehearsal; S1–S5 on every candidate |
| Our tests pollute the recent folders or the usage data | E4's launch flag and R10's marker on every test launch; Jarmo's `~/.ritemark-shared` moved aside before Gate 1 |
| The build-guard change alters the built app | The dress rehearsal and both CI runs before the bump; reverted and deferred if so |
| A fix breaks something next to it | One PR, unit tests, the manager's smoke test, the dress rehearsal, Windows round 5, the gates |
| The signed build looks different from the dev build | More's release images (D2); the frame scripts on each candidate |
| A runtime update breaks on Node 24 or Electron 43 | The review; the runtime turn on the dress rehearsal and on all three platforms; D1 can decline |
| The disk runs out | One release worktree at a time; each removal asked of Jarmo |
| A late fix breaks the freeze | A new candidate and a new gate for any fix |
| The privacy policy is not ready on the day | A precondition of publication, tracked by the Development manager from the start |
| Notarization or Store certification is refused | `notarize-dmg.sh` stops on any refusal, and the DMG is unchanged; the Store's submitted object is never replaced, and new bytes get a new URL |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Steps 1, 2 and 3 and Sprint 135 merged** (done; main `16b5bf0d`), with main's production build, macOS x64 CI and Windows CI green (done at `d60b9652`).
- **Windows round 4's results**, relayed by the Development manager.
- **Jarmo's answers** to D1–D5.
- **The Experience lead** for dictation's menu, a card's tab if the drawings differ, the Store screenshots' scenes and any visible difference on the signed builds.
- **Traffic**, through the Development manager, for the privacy policy before publication.

## Pre-Implementation Gate

- Jarmo approves this plan in this session ("approved" or "proceed"). A relayed message does not count (ritemark-dev CLAUDE.md, rule 7). The sprint branch is the first action after it.
- Phase 1's audits come before any release step. When an audit changes a requirement, `spec.md` changes first.
- Gate 1 and Gate 2 are Jarmo's, in his own words ("approved", "GATE 1 passed"; "GATE 2 passed"), as the release skill asks. Every admin merge is his too.

## Approval

- [x] Jarmo approved this sprint plan (2026-10-20, "approves", in this sprint's session)
