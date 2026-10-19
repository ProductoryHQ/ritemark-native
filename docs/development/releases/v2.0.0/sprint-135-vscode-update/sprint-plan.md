# Sprint 135: VS Code to the current release

Track: SDD (one move with many parts: target, patches, toolchain, native modules, Windows CI, the frame's baseline, rollback)
Override with: "use plain full track"
Branch: `sprint-135-vscode-update` (created only after approval, and only after Steps 1–3 are merged)
Release tier: shell (`vscode`, `patches/vscode/`, `branding/product.json`, `.github/workflows/build-*`, listed scripts)
Status: **Phase 3 (implementation)** on `sprint-135-vscode-update`, from `origin/main` `3c8a7c30` (Steps 1–3 merged). Plan approved by Jarmo on 2026-10-19 ("Approved, all five as recommended"), with D1–D5 as recommended. Target: **1.142.0**, frozen 2026-10-19 by R1's rule (commit `d956e8a6`, Node 24.18.0, Electron 43.7.7; [notes/freeze.md](notes/freeze.md))

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R10 and E1–E3.
- [scenarios.md](scenarios.md): S1–S30, the manual QA matrix, on top of Sprints 132–134's shell scenarios.
- [technical-plan.md](technical-plan.md): workstreams W1–W11, the starting numbers, the per-patch expectations, the rollback recipe, the delivery plan.
- [tasks.md](tasks.md): the implementation checklist by phase.
- [notes/drift.md](notes/drift.md): the planning-time drift on 1.142.0, by file and by hunk.
- This file: intent, decisions, status.

It is the "Update" step of the [v2.0.0 release plan](../release-plan.md). The research behind it is the release's [feasibility read](../feasibility.md) (§2.3, the cost to upstream bumps) and Sprint 132's [drift notes](../sprint-132-surfaces-and-frame/notes/drift.md).

## Goal

Ritemark 2.0 moves from VS Code 1.117.0 (April 2026, Electron 39, Node 22) to the VS Code release of the day the sprint starts: 1.142.0 on 18 October, with Electron 43 and Node 24. Every Ritemark patch comes across, and the window looks and works exactly as Steps 1–3 left it. People notice nothing but what upstream fixed, and 2.0 starts life close to the current release, so later updates stay small.

## Why now, and why once

- VS Code ships weekly. The pin falls about one release behind each week, and at 1.142.0 it is 25 releases behind.
- Sprint 132's plan decided to update once, after Step 3 (engineering, 2026-10-17). By then 2.0 has removed part of what fails today: 002's terminal guards are gone, and Step 2 changes the Getting Started patches.
- Electron 39 is four majors behind 1.142.0's Electron 43, and Electron gives security fixes only to its newest three majors. Shipping 2.0 on 1.117.0 would put a major release on an unsupported Chromium.

## Starting numbers

At planning time, on main `d781a0e1` (patches 001–019), VS Code 1.142.0:

- **15 of 19 patches fail, in 58 file patches.** Sprint 132's merge-1 measurement gave the same.
- **98 of the stack's 347 hunks do not apply.** The other 249 apply as they are.
- **Patch 018**, the frame, fails in 12 of its 29 files (17 of 61 hunks). The files are where VS Code changed the title bar, the window and the parts' layout.
- **016 and 017 are only a cascade:** they apply once 001's hunks are in.
- **One file is gone upstream:** `build/lib/optimize.ts` (001's font loader moves to the esbuild bundle).

The numbers per patch are in [technical-plan.md](technical-plan.md#starting-numbers-planning-time). Phase 0 measures again at the frozen target, on main after Step 3.

## MVP Scope

| Area | Requirements |
|---|---|
| The target picked by rule and frozen | R1, E1 |
| Every patch rebased, classified hunk by hunk against main | R2 |
| Node and Electron from the target; the arm64 build environment | R3 |
| Native modules, in dev and in the built app | R4 |
| Windows CI and a Windows PC | R5 |
| The screenshot comparison against Step 1's baseline | R6 |
| 2.0's frame and Steps 2 and 3's surfaces after the move | R7 |
| Nothing lost; no new VS Code chrome; defaults and `product.json` | R8 |
| Ritemark's features that sit on VS Code (browser, saving, runtimes) | R9 |
| A rollback point | R10 |
| The update tooling fixed; builds; docs | E2, E3 |

**Not in this sprint:**
- a second update before 2.0 ships (D2);
- new features, or adopting upstream features for their own sake;
- renaming, splitting or merging patches;
- bundled runtime updates (Step 4's runtime review);
- the release itself (Step 4).

## How it is delivered

One merge, because the gitlink, the patches and the Node pins cannot land apart: 1.117.0's install refuses Node 24, and the target's refuses Node 22.

1. **On the branch:** freeze and audits first (the frame on the new layout code, the toolchain, the browser bridge, new surfaces and defaults). Then the tooling fixes, the Node pins, the rebase one patch per commit, branding and defaults, native-module checks, the Windows workflows and the docs. Then every Mac check in dev: geometry, screenshots, Sprints 132–134's shell scenarios, the inventory, profiles from before the update, the runtimes, and the rollback rehearsal.
2. **The PR** carries the per-hunk classification and the screenshot differences, with Jarmo's approval of any new baseline. It merges with Jarmo's admin-merge yes.
3. **After the merge:** a clean-room production build at the merged commit, macOS x64 CI, Windows CI and a Windows PC round. Main stays closed to other shell-tier merges until all are green, or until the rollback.

## How the risk to the frame is handled

Patch 018 carries the frame without a title row, and it hooks into the code VS Code changes most: the title bar, the window controls and how the parts lay out. A rebase can apply cleanly and still look wrong, because the stylesheet and the DOM reads fail silently.

- **Audit first.** Upstream's diff for each of 018's and 019's files is read before any rebase. Each change is sorted into moved lines, a changed mechanism, or something upstream now offers that 018 can use.
- **The selector audit.** Every class the stylesheet styles is checked against the target before screenshots.
- **The proof.** `frame-geometry.mjs` must give Sprint 132's numbers, and `frame-screenshots.mjs` must match the baseline, on a fresh profile in both themes, then on Windows.
- **If a mechanism cannot be carried,** the audit names the newest release where it still holds, and Jarmo decides (D3).

## Rollback point

- Main's last commit on 1.117.0 is recorded in the release plan before the merge, with its clean-room build check.
- The update is one squash commit. Reverting it returns the gitlink, the patches, `branding/product.json` and the Node pins together.
- The recipe (technical plan, W11) is rehearsed on a scratch branch before the PR.
- If main's production build, Windows CI or a core scenario cannot be fixed forward, the session asks Jarmo to roll back. The rollback point stops applying once Step 4's release candidate is cut.

## Decisions for Jarmo

Each has a recommendation. The plan is written to the recommendations; a different answer changes the named requirement.

**Answered by Jarmo on 2026-10-19, with his approval of this plan: "Approved, all five as recommended".** Each of D1–D5 below stands as recommended.

- **D1: Which VS Code release, and when it is frozen.** Recommended: the newest stable release on the day the sprint starts. Until the merge, only a recovery release of the same minor may replace it, after the stack is dry-applied on it. A new minor never replaces it. The alternative, waiting for a release that has been out a week or more, buys little: VS Code's recovery releases come within days and are taken anyway. (R1)
- **D2: No second update before 2.0 ships.** Recommended: 2.0 ships on the frozen release. VS Code will be a few releases further on by then, and catching up would mean another rebase and another round of checks right before the release. Until the release candidate is cut, only recovery releases of the frozen minor are taken. A security advisory for Electron or Chromium in between comes to Jarmo as its own decision. (Non-requirement)
- **D3: If the newest release breaks the frame's mechanism.** Recommended: step back to the newest release where the frame's mechanism still holds (named by the frame audit), and 2.0 waits for that. 2.0 does not ship on 1.117.0, whose Electron 39 is out of security support. Redesigning the frame to fit upstream's new code would be its own sprint and its own drawings. (R1, R7)
- **D4: Production and Windows builds after the merge, not before.** Recommended: keep the clean-room rule and Sprint 132's decision as they are. The production build and Windows CI run from main right after the merge. Main stays closed to other shell-tier merges until they are green, with the rollback point if they cannot be made green. The sprint sits between Step 3 and Step 4, when no other shell work is waiting. The alternative, a new "build check" mode that builds a sprint branch without release provenance, adds harness work to two shell-tier scripts and a workflow. (R5, R10)
- **D5: Who approves visible differences.** Recommended: engineering pins back everything a setting can bring back. The Experience lead reviews what remains (the before-and-after screenshots), and only Jarmo's yes replaces the baseline. (R6)

## Product Decisions

- **2026-10-17 (engineering, Sprint 132's plan):** the pin stays at 1.117.0 for Steps 1–3, and one VS Code update sprint follows Step 3.
- **2026-10-17 (engineering, on Jarmo's "You decide"):** each Windows round is built from main, with no separate unsigned branch builds.
- **2026-10-19 (Jarmo, at this plan's approval):** D1–D5 as recommended ("Approved, all five as recommended"). By D1 the target is 1.142.0, the newest stable release that day.
- **2026-10-18 (engineering, this plan):**
  - No patch is renamed, split or merged in this sprint. 007 keeps its file name, and its header and `CLAUDE.md`'s line say what it does now.
  - The rebase runs `git apply --3way` against the pin's blobs, one commit per patch. Patches are regenerated from consecutive commits, so stacked pairs stay correct by construction.
  - `update-vscode.sh`'s `--check` is replaced by `check-vscode-drift.sh`. It used a bare `git stash` and a checkout in the shared submodule.

## Feature Flag Check

No feature flag. A VS Code update cannot sit behind a flag: the whole app runs on the new base. HARD RULE #1 holds: R8's inventory checks that nothing is lost.

## Success Criteria

- [ ] The target was frozen by R1's rule, and `notes/freeze.md` records it (R1).
- [ ] Every patch applies on the target from pristine; a second run is clean; every hunk is classified, and the hunk-level diffs against main are explained (R2).
- [ ] Node and Electron are the target's; the Mac builds run on arm64 Node; every Node pin is in step (R3).
- [ ] Native modules have the right architecture in dev and in each built app (R4).
- [ ] Windows CI is green from main with the installer round trip, and a Windows PC shows 2.0's frame (R5).
- [ ] The screenshots match the baseline, or Jarmo approved each difference (R6).
- [ ] The frame's numbers equal Sprint 132's, and Sprints 132–134's shell scenarios pass (R7).
- [ ] Nothing is lost, no new VS Code chrome shows, defaults and `product.json` are reconciled (R8).
- [ ] The browser, saving and the three runtimes work on all three targets (R9).
- [ ] The rollback point is recorded and rehearsed (R10).
- [ ] The production build at the merged commit succeeds, and the docs are updated (E3).

## Risks

| Risk | Retirement |
|---|---|
| Upstream changed the layout code 018 relies on | The frame audit first; adopt upstream's mechanism where it gives the same numbers; D3 if it cannot be carried |
| The stylesheet and DOM reads break with no apply error | The selector audit; the screenshot comparison on a fresh profile |
| Node 24 and Electron 43 change what the extension relies on | Checks on all three targets; the runtime matrix |
| Windows CI breaks in a new way | The toolchain audit before the merge; the canary in step; the rollback point |
| A production-only crash, as in 1.117 | The `product.json` merge; the minified compile before the PR; the production build right after the merge |
| A one-line intent change hidden in a rebased hunk | The hunk-level diff of every patch against main's |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Pre-Implementation Gate

- This plan's PR gets the usual automated review. Jarmo's approval gates Phase 0, which also waits for Steps 1–3 to be merged.

## Approval

- [x] Jarmo approved this sprint plan: "Approved, all five as recommended" (2026-10-19). His answers to the five *Decisions for Jarmo*, the same day: D1, the newest stable release on the sprint's first day, frozen then, with only recovery releases of the same minor after it; D2, no second update before 2.0 ships; D3, if the frame's mechanism cannot be carried, step back to the newest release where it holds, never 1.117.0; D4, the production build and Windows CI from main right after the merge, with main closed to other shell-tier merges until they are green; D5, engineering pins back what a setting brings back, the Experience lead reviews the rest, and only Jarmo replaces the baseline.
- [x] Steps 1–3 merged: `origin/main` `3c8a7c30` (Sprint 134, #467).
