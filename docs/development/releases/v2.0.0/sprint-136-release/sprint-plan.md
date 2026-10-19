# Sprint 136: 2.0 as one release

Track: SDD (a release with many parts: the update from 1.14, signed-build checks, a permanent release check, the runtimes, the version, notes, the Store, the gates)
Override with: "use plain full track"
Branch: `sprint-136-release` (created only after approval, and only after Steps 1–3 and Sprint 135 are merged); the version bump on its own release-prep branch
Release tier: shell (the release itself; the runtime update and `installer/windows/ritemark.iss` are shell-tier by path)
Status: Phase 2 (PLAN) **drafted 2026-10-18, awaiting Jarmo's approval**. Not started.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R10 and E1–E3.
- [scenarios.md](scenarios.md): S1–S33, the manual QA matrix, on top of the [v1.14 parity list](../parity-v1.14.md) and Sprints 132–135's scenarios.
- [technical-plan.md](technical-plan.md): what exists today, workstreams W1–W10, the three audits, the delivery plan.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

It is step 4 of the [v2.0.0 release plan](../release-plan.md), after the VS Code update ([Sprint 135](../sprint-135-vscode-update/sprint-plan.md)).

## Goal

v2.0.0 is published for the Mac (Apple silicon and Intel) and for Windows, and in the Microsoft Store. A v1.14.0 user updates and finds all their work, in the new frame, with the AI ready. Every release from now on compares its window with the approved baseline before Jarmo tests it.

## Linked Issues

- [#139](https://github.com/ProductoryHQ/ritemark-native/issues/139): not in 2.0. v1.14.0 users move to 2.0 through today's update flow (release plan, Issue Intake).
- Every issue on the v2.0.0 milestone is closed or explicitly deferred at the end (R8).

## MVP Scope

| Area | Requirements |
|---|---|
| Updating from a lived-in v1.14.0 profile, on the Mac and on Windows | R1, E3 |
| Light, Dark and Windows on the signed builds | R2 |
| A screenshot comparison in every release's checklist, for good | R3 |
| The runtime review for the gap since v1.14.0, and `check:anthropic-models` | R4 |
| Version 2.0.0 in all six files | R5 |
| Release notes, the changelog and the user docs, with `product-marketer` | R6 |
| The Microsoft Store listing, screenshots and update | R7 |
| The shell-tier gates, publication and closeout | R8 |
| The parity list and usage data proved on the signed build | R9, R10 |
| Docs and build hygiene | E1, E2 |

**Not in this sprint:**
- new features or redesigns (only fixes for what the gates find);
- a second VS Code update (Sprint 135's D2);
- native shell auto-update (#139);
- website and launch work, unless Jarmo wants a cross-repo plan (D5).

## How it is delivered

1. **The sprint PR, before the freeze:** the audits, the release check (R3), the runtime update if approved, the notes and changelog, the user docs, the Store documents, and any fix the dress rehearsal found.
2. **The version bump**, the last merge before the candidate. `main` is frozen from here until publication.
3. **The candidate:** CI proven green first; the arm64 build, Gate 1, the hardening window and notarization; the x64 and Windows builds, Gate 2, the hardening window and notarization.
4. **Publication**, draft first, with the feed.
5. **The Store update**, with the same installer bytes.
6. **The closeout PR**: the checklist, the evidence, the release plan.

A fix at any gate goes to main as its own PR, and a new candidate starts from a new worktree.

## Product Decisions

- **2026-10-17 (Jarmo):** "We will focus on 2.0 from now on." v1.14.0 is the last 1.x release, and no release is built from main until 2.0.
- **2026-10-17 (release plan):** step 4's scope: updating from v1.14.0; Dark and Windows checked; a screenshot comparison of the base window in the release checklist; the runtime review; version 2.0.0, notes and the store listing; the shell-tier gates.
- **2026-10-18 (Sprint 135's plan, D2, recommended):** 2.0 ships on the VS Code release frozen in Sprint 135.
- **2026-10-18 (engineering, in this plan):**
  - the update is proved on signed builds, after one dress rehearsal on a production build from main;
  - the frame scripts run against installed apps, with a release baseline per platform once Jarmo approves it;
  - the release check becomes permanent in the release skill and the `release-manager` agent, not only in this release's checklist;
  - the parity list becomes a section of this release's checklist.

## Decisions for Jarmo

Each has a recommendation. The plan is written to the recommendations; a different answer changes the named requirement.

- **D1: Update the bundled runtimes for 2.0.** Recommended: update all three to the latest at the review (Claude Code with its matching Agent SDK, Codex, OpenCode 1.x), as v1.13.0 and v1.14.0 did. The gap since v1.14.0 is the whole of 2.0's build, the runtimes then run on Sprint 135's Node 24 and Electron 43, and an old Claude Code cannot run new Claude models. The update merges before the version bump. (R4)
- **D2: A release baseline for signed builds.** Recommended: the first candidate's captures become a release baseline per platform, the Mac at Gate 1 and Windows at Gate 2, with your approval. The approved baseline was taken from a dev build, whose More lists Copilot Chat's dev rows, and Windows has its own top. The dev baseline stays for dev runs and VS Code updates. (R2, R3)
- **D3: Gate 1 updates your own Mac.** Recommended: yes, after the scripted run on the made-up "Harbour" profile has passed and a copy of your profile folder is taken. Gate 1 installs the candidate over your v1.14.0, so your own profile is the most lived-in test there is. Going back to v1.14.0 afterwards works but looks different (S7). (R1)
- **D4: The Store's screenshots.** Recommended: six new screenshots from the signed Windows candidate, with the sample project ("Leadership programme"): the welcome, a project's Home, writing with the AI beside, Tasks with a task that waits, a Word or PDF preview, and Transcribe. The Store update goes in the day 2.0 is published, with the same installer bytes. (R7)
- **D5: A cross-repo plan for the website and launch.** Recommended: yes, a thin one in `ritemark-dev/releases/v2.0.0/`, kept by the Development manager. ritemark.app's download page, screenshots and docs should say 2.0 on the day it ships. ritemark.app's privacy policy must say, before 2.0 ships, that usage data is on by default, that it can be turned off (on the welcome and in Settings), and that no location is collected (GeoIP is off for every event); `build_channel` may need a line too (Jarmo, 19 October, usage data on by default; Sprint 133's spec, R7). It starts when this sprint starts. (Non-requirement here)
- **D6: One publication for all three platforms.** Recommended: yes. 2.0 changes the frame on Windows as much as on the Mac, and the Store update follows the Windows build. If Windows blocks at Gate 2, you decide on a Mac-first publication, with the feed keeping v1.14.0's Windows entry (memory: Mac-first release). (R8)
- **D7: Which machines see the candidate.** Recommended: the release Mac and the Windows PC for every check; an Intel Mac and an older macOS (13–15) only where one is at hand, and the evidence says which were seen. The frame's traffic lights have been seen on one Mac only (feasibility §5). (R1, R2)

## Feature Flag Check

No new flag. 2.0 is built on main with no switch (Jarmo, 17 October). HARD RULE #1 holds through the parity list (R9).

## Success Criteria

- [ ] A lived-in v1.14.0 profile updates on the Mac and on Windows and loses nothing (R1).
- [ ] Light, Dark, high contrast and Windows match the baseline on the signed builds, or Jarmo approved each difference (R2).
- [ ] Every release's checklist carries the screenshot comparison, and the release skill and the `release-manager` agent say so (R3).
- [ ] The runtime review is done, Jarmo's decision is carried out, and `check:anthropic-models` is OK (R4).
- [ ] Version 2.0.0 is in all six files, and the bump was the last merge (R5).
- [ ] The notes and changelog cover everything since v1.14.0, and the user docs describe 2.0 (R6).
- [ ] The Store shows and installs 2.0 (R7).
- [ ] v2.0.0 is published through Gate 1 and Gate 2, notarized after the hardening window, with the feed verified, and closed out (R8).
- [ ] Every parity row is ticked or deferred by Jarmo, on the signed build (R9).
- [ ] The four events arrive only after a yes, as `prod` (R10).

## Risks

| Risk | Retirement |
|---|---|
| A one-time move on a v1.14.0 profile loses state that no step tested together | The update-path audit; the dress rehearsal; S1–S5 on every candidate |
| The signed build looks different from the dev build | Release baselines (D2); the frame scripts on each candidate |
| A runtime update breaks on Node 24 or Electron 43 | The review; the runtime checks on all three platforms; D1 can decline |
| A late fix breaks the freeze | A new candidate and a new gate for any fix |
| Notarization is refused | `notarize-dmg.sh` stops on any refusal; the DMG is unchanged |
| Store certification fails | The submitted object is never replaced; new bytes get a new URL |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Steps 1, 2 and 3 merged** (Sprints 132, 133 and 134), each with its issues closed or deferred, and **Sprint 135 merged**, with main's production build, macOS x64 CI and Windows CI green.
- **The parity list** with no row still marked as a gap.
- **Jarmo's answers** to D1–D7.
- **The Experience lead** for the Store screenshots' scenes and any visible difference on the signed builds.

## Pre-Implementation Gate

- This plan's PR gets the usual automated review. Jarmo's approval gates Phase 0, which also waits for Steps 1–3 and Sprint 135 to be merged.
- Phase 1's audits come before any release step. When an audit changes a requirement, `spec.md` changes first.
- Gate 1 and Gate 2 are Jarmo's, in his own words ("approved", "GATE 1 passed"; "GATE 2 passed"), as the release skill asks.

## Approval

- [ ] Jarmo approved this sprint plan
