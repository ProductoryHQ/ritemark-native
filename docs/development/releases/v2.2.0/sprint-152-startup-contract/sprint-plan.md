# Sprint 152: The startup contract

Track: SDD, lean (an architecture change across the shell and the extension, edge-case-heavy in four starts and in
version skew; four artifacts, with the scenarios as the four starts in [spec.md](spec.md#the-four-starts), because every
requirement is checked in the same four)
Override with: "use plain full track"
Branch: `sprint-152-startup-contract`, made from `origin/main` at Phase 3, after approval. PR 2 has its own branch,
`sprint-152-startup-contract-shell` (*Pull requests* below). This plan was written on `plan/sprint-152-startup-contract`.
Release tier: shell, by `patches/vscode/002-ritemark-ui-layout.patch`, `018-ritemark-surfaces.patch`,
`019-ritemark-tab-row.patch`, `branding/product.json` and `scripts/validate-build-output.sh` (PR 2). PR 1 is
extension-tier (`webview/src/`, `src/`, `scripts/qa/`, `.claude/skills/`). 2.2 is a shell release
([release-plan.md](../release-plan.md)), so neither adds a release step. If an audit moves a fix into or out of a patch,
this line changes first.
Status: **Approved**, 1 November 2026, by the Development manager on Jarmo's 2.2 delegation (*Approval* below). The architecture it builds is
[docs/development/analysis/2026-11-01-startup-contract.md](../../../analysis/2026-11-01-startup-contract.md), proposed
with it. The code named below was read for the plan, not run.

## SDD Artifacts

- [The proposal](../../../analysis/2026-11-01-startup-contract.md): the inventory, the options, the recommendation, the
  contract in plain words, version skew, the upstream-merge cost, the tests, and the Experience lead's questions.
- [spec.md](spec.md): the behaviour contract, R1–R9 and E1–E5, and the four starts.
- [technical-plan.md](technical-plan.md): what exists today, the four audits that come first, workstreams W1–W7, the
  pull requests, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.
- `research/` is not created yet. Phase 1 writes one file per audit there, before the code it gates.

## Goal

The frame draws once. In every start (a new profile, a project opened for the first time, a switch, a relaunch) the shell
draws Ritemark's frame in its final shape from the first frame, and the extension only fills it in. Sprint 145's four
fixes move onto that one rule with the same behaviour; the family's members that are left close; the AI column draws once
(#624); an extension-tier release can't move the frame; and one check fails whenever anything in the frame moves after
its first frame.

## Linked Issues

| Issue | What | Req | Seen so far | Release tier |
| --- | --- | --- | --- | --- |
| [#624](https://github.com/ProductoryHQ/ritemark-native/issues/624) | The AI column has one loading look: the empty chat flashes before "Almost there!", and "Preparing Agent Chat…" isn't Ritemark's | R5 | In Sprint 145's first-frame captures (`r9-switch-first-frames-*.png`); the Experience lead's check of #622. Placed after 2.2 by the lead; added to this sprint at the Development manager's request (1 November), being the same family | extension |
| [#569](https://github.com/ProductoryHQ/ritemark-native/issues/569), [#501](https://github.com/ProductoryHQ/ritemark-native/issues/501) | Fixed in Sprint 145 by #622 (merged 1 November; both issues still open on GitHub): the AI column and the landing after a switch; restored terminals. This sprint keeps their behaviour and moves their code onto the contract | R2 | Measured before and after in Sprint 145's research | shell |
| No issue | A project opened for the first time: the tree, then Home's place; an empty desk's tiles, then Home | R3 | Read in the code, not seen (inventory rows 5, 11) | shell |
| No issue | A window with no folder: VS Code's frame, then the welcome alone | R4 | Read, not seen (row 13) | shell |
| No issue | The AI column the person closed opens again when Ritemark starts | R6 | Read, not seen (row 14) | extension, or shell by decision 2 |
| No issue | The frame-shaping settings and the places row on a new profile | R1, R9 | Read, not seen (rows 4, 15) | shell |

A row A1 doesn't show is dropped with its reason; one it shows and this sprint leaves for 2.3 is filed with its capture.

## What reading the code added

The full reading is in the proposal and [technical-plan.md](technical-plan.md#what-exists-today). What decided the
design:

- **The extension's `package.json` can't be the frame-one source.** VS Code starts scanning extensions only after the
  first frame (`nativeExtensionService.ts:137–142`), so contributions exist about 0.2 s later on a Mac and an unknown
  time later on a cold Windows PC. Sprint 145's head rows already wait for that moment.
- **VS Code already keeps the last session** in six places (the parts splash, the layout, the places row's placeholders,
  the themes, the extensions' cached defaults, restored tabs' names). That is why a returning profile mostly draws right,
  and why a Ritemark snapshot would only repeat it and still miss a new profile, a new project and a switch.
- **The shell already knows Ritemark's frame**, in constants spread across 002, 018 and 019. The manifest gathers them.
- **product.json is read at the first frame** (patch 013's `configurationDefaults`), and it is copied whole into the
  build, so it can hold the manifest and the frame-shaping settings.
- **The family is bigger than Sprint 145's four.** A project opened for the first time, a window with no folder, the AI
  column the person closed, and a new profile's settings all move after the first frame by the code (rows 5, 11, 13–15).

## MVP Scope

| Area | Requirement | Proven by |
| --- | --- | --- |
| The manifest and the slot; the frame-shaping settings in product.json; the settled frame unchanged | R1 | Unit tests; `frame-screenshots.mjs --compare` and `frame-geometry.mjs` unchanged |
| Sprint 145's four on the contract, same behaviour | R2 | `project-check.mjs --measure 10`; the S47 traces; 145's unit tests |
| A new project lands on Home from the first frame | R3 | The first-frame check's new-project start, failing on `main` first |
| A window with no folder is the welcome alone from the first frame | R4 | The new-profile start, failing on `main` first |
| The AI column draws once (#624) | R5 | Webview tests; A4's starts again; screenshots to the lead |
| A closed AI column at start, by decision 2 | R6 | The relaunch start with the column closed at quit |
| Version skew: the release check, the defaults test, the build check, the released slot logged | R7 | A fixture refused; unit tests |
| The first-frame check in four starts, in Gate 1 | R8 | Fails on `main` where A1 shows a move, passes on PR 2 |
| The places row on a new profile (cut first) | R9 | The new-profile start opened on a folder, if A1 shows it |
| Fails first; upstream-merge budget; tier; bundle; docs | E1–E5 | `qa-evidence.md` |

**Not in this sprint:** a Ritemark snapshot of the last session; a new profile's colours before the theme loads and the
status bar's items (measured in A1, filed for 2.3 if seen); how fast any page draws; the welcome's own steps; Settings'
start (#593, Sprint 147).

## Pull requests

Two, so the shell change gets its High review alone and #624 doesn't wait for it.

| PR | Branch | Holds | Release tier | Review tier |
| --- | --- | --- | --- | --- |
| 1 | `sprint-152-startup-contract` | Phase 1's research (A1–A4); the first-frame check (R8); the AI column draws once (R5, #624); R6 by decision 2; this sprint's doc updates (the plan lands first, in its own PR) | extension | Standard (`webview/src/`, `src/`, `scripts/qa/`, `.claude/skills/`); the AI column's start to the Experience lead with screenshots |
| 2 | `sprint-152-startup-contract-shell` | R1, R2, R3, R4, R7, R9 and E5 | shell | High: `/code-review` at high and `/security-review`; up to three rounds, the third only when the second found something Important (`REVIEW.md`, since #625). Built and checked on a CoW-cloned, patched `vscode/`; the drift check at merge |

**Order:** PR 1 first, after approval: it records `main`'s failing set before any shell code, and #624 needs no patch.
PR 2 after Sprint 146's shell PR (its PR 4) has merged, since both change 018 and 019, and after the Experience lead has
answered questions 1–4, 6 and 8.

**Cut order if the sprint runs long** (the first goes first):

1. R9, the places row on a new profile (rare: only a new profile's first window opened on a folder).
2. R4, the welcome alone from the first frame: today's path stays (the extension makes it alone once it starts).
3. R3's tabs before Ritemark starts: the plain-desk fallback instead (Home's place and no tiles stay).

Not cut: R1, R2, R5, R7, R8. If 2.2's appetite moves PR 2 to 2.3 (decision 3), PR 1 still ships: #624 and the check,
with the starts that still move recorded as known.

## Windows

- **PR 1** runs on Windows through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`),
  by the "Ritemark on Windows" session, before the merge: the AI column's start, signed in and not.
- **A2** runs now, on the installed 2.1.0: when the extensions are read on a cold start.
- **PR 2 can't go through the overlay:** Windows CI builds only the exact `main` commit. Its proof is 2.2's candidate at
  Gate 2: a cold first start after an install (the welcome alone) and after an update, a new project, a switch, a
  relaunch with a restored terminal, with the session's tab trace and the workbench's marks.

## Product Decisions

Engineering, in this plan (approved with it):

- The manifest lives in `branding/product.json`; the fallback is a TypeScript table in 002, if A1–A3 find a consumer
  that can't read `product`.
- No new snapshot store; VS Code's own stores stay.
- The frame-shaping settings are copied into product.json, not moved: the extension keeps its copies, kept equal by a
  test, until every shell it can run on carries them.
- The switch guard's note stays: only it carries a switch across the reload.
- #624 joins this sprint (the Development manager, 1 November), though the Experience lead had placed it after 2.2.

## Decisions for Jarmo

Three, each with a recommendation. [spec.md](spec.md#decisions) points here.

1. **An extension release can't change the frame.** Adding, removing or resizing a place, a row in a place's head, a
   column or a permanent tab needs a shell release, and the release script refuses an extension release that tries.
   Words, icons and what's inside the frame still change in an extension release. **Recommended: yes.** It is already
   the rule for the head's rows; this makes it the rule for the whole frame, and it is what keeps the contract true
   between shell releases.
2. **The AI column you closed.** Today Ritemark opens it again a moment after it starts, even if you closed it. Either
   way it will no longer open late. **Recommended: it stays closed until you open it**, as you left it, one click away
   on the AI's toggle. The other way, the AI column is always there at start, from the first frame.
3. **Its place in 2.2.** After Sprint 146's shell PR, alongside 147: 146 changes the same two patches (018, 019), and 147
   is extension work that touches neither them nor the AI view. In the appetite's cut order, PR 2 (the shell half) goes
   to 2.3 right after 151, before 150; PR 1 (#624 and the check) stays. **Recommended: yes.** Sprint 145 already fixed
   the four faults people met, so PR 2 is the rule that keeps them fixed and closes the rarer starts; it can wait for
   2.3 if 2.2 is tight, where the first-frame check would show what it leaves.

## For the Experience lead

The nine questions are at the end of [the proposal](../../../analysis/2026-11-01-startup-contract.md#questions-for-the-experience-lead):
what each column shows at the first frame and while it waits, for a new profile, a new project, a switch, a cold start
and someone not signed in; the places row on a new profile; the status bar; a row an older extension lacks; the AI
column the person closed. Questions 1–4, 6 and 8 come before PR 2's code; question 5 before PR 1's #624 work; 7 and 9
before the merges. Screenshots before each merge: PR 1 (the AI column's start, signed in and not, Light and Dark), PR 2
(the four starts' first frames).

## Feature Flag Check

No feature flag. The contract changes when the frame is drawn, not what a person can do, and there is no flag in the
shell. HARD RULE #1 holds: the welcome alone, the landing, the terminals' wait, the head's rows and the AI column's
loading look keep working, moved onto one mechanism; the extension's `configurationDefaults` stay; the AI view's error
card stays, in Ritemark's words. R6 changes behaviour only with Jarmo's answer to decision 2. #624's view stays under no
flag, as today.

## Testing

- **The Mac, here:** unit tests (`npm test`, the webview's `npx tsx` tests, `./scripts/test.sh --grep Ritemark` in a
  patched `vscode/`), and scripted dev instances: hidden (`open -n -g -j`), one launch per check, `--use-mock-keychain`,
  scratch AI homes, a short profile under `/private/tmp`, a CDP port checked to be free.
- **The held extension host:** `--inspect-brk-extensions`, let go over the inspector after 10 s, each inspector checked
  to be a child of the instance (Sprint 145's S47 method). It is the Mac's stand-in for a cold Windows start.
- **CDP input only**, so a hidden window never takes keys meant for another.
- **An AI only where a row needs one:** #624's starts need a signed-in AI and a profile with none; ChatGPT through
  Jarmo's own sign-in in the scratch project, as Sprint 143 did; Claude and OpenCode only if signed in on the test Mac,
  otherwise the row says not run.
- **PR 2** on a CoW-cloned, patched `vscode/` in the worktree, with the first-frame check, `frame-screenshots.mjs
  --compare`, `frame-geometry.mjs` and `project-check.mjs --measure 10`.
- **Not here:** Windows (the overlay session for PR 1, Gate 2 for PR 2), a release build's timing (Gate 1).

## Success Criteria

- [ ] The proposal's inventory is seen: every *read* row captured on `main`, or dropped with its reason (A1).
- [ ] The frame's description is in one place, and the constants it replaces are gone (R1).
- [ ] Sprint 145's four behave as after Sprint 145, by their own checks (R2).
- [ ] A project opened for the first time has Home's place, Home's and the board's tabs (or the plain desk) from the
      first frame, and no tiles (R3).
- [ ] A window with no folder is the welcome alone from the first frame, and released if no welcome comes (R4).
- [ ] The AI column draws once, the chat or the sign-in, with no "Preparing Agent Chat…" on a normal start (R5).
- [ ] The AI column at start follows decision 2 from the first frame (R6).
- [ ] An extension release that changes a slot is refused; a build without the manifest fails; a released slot is
      logged (R7).
- [ ] The first-frame check passes in all four starts on PR 2, failed on `main` where A1 showed a move, and is in Gate 1
      (R8).
- [ ] The settled frame is unchanged: the same pixels in every baseline scene, every `JOINS` ok (R1).
- [ ] At most three new hunks in upstream files, no upstream file newly touched (E2).

## Risks

| Risk | Retirement |
| --- | --- |
| Sprint 145's fixes regress as they move | R2's checks before and after |
| Home's tab can't be shown before Ritemark starts | A3 first; the plain-desk fallback |
| The welcome alone in a window that never gets the welcome | Files to open known at the first frame; release on a failed start or after 60 s |
| Slow extension reading on Windows | A2 first; content slots bounded at 60 s |
| Patch growth | E2's budget; new files carry the code |
| 146's shell PR and PR 2 change the same patches | PR 2 starts after it merges |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The Experience lead** for the proposal's questions and the screenshots' approval.
- **The "Ritemark on Windows" session** for A2, PR 1's overlay check and Gate 2's rows for PR 2.
- **Sprint 146's shell PR** merged before PR 2's code.

## Pre-Implementation Gate

- This plan and the proposal are approved (*Approval* below), under Jarmo's own delegation of 2.2's approvals to the
  Development manager, recorded in ritemark-dev `decisions/log.md` (c45d69c). A message from the manager to another
  session carries that approval only by quoting the log's row (ritemark-dev `CLAUDE.md`, rule 7).
- Phase 1's audits come before their workstreams' code: A1 before W1 gates anything and before W6; A2 before W4's release
  bounds; A3 before W6's desk; A4 before W2. When an audit changes a requirement, `spec.md` changes first.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [x] Approved on 1 November 2026 by the Development manager, on Jarmo's delegation of every 2.2 sprint until the
      release candidate: "võta nii et kõik sprindid on 2.2 osas approved until RC - ei vaja heakskiitu. I trust you. When needed use admin merge and clean worktrees" (ritemark-dev `decisions/log.md`, c45d69c).
- [x] Decision 1: yes, as recommended. Decision 3: yes, as recommended (after 146's shell PR, alongside 147; in the
      cut order PR 2 moves to 2.3 right after 151, PR 1 stays).
- [ ] Decision 2 (the AI column you closed): decided by the manager after the Experience lead's view on question 9,
      before PR 1's R6 work, and recorded here and in the decision log.
- [x] Sprint start: PR 1 starts now; PR 2 after Sprint 146's PR 4 merges.
