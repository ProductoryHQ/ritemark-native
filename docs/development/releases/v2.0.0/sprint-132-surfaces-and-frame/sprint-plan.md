# Sprint 132: Surfaces and frame, theme first

Track: SDD (16 user-facing requirements, Mac and Windows, VS Code patches plus the extension)
Override with: "use plain full track"
Branch: `sprint-132-surfaces-and-frame` (created only after approval)
Release tier: shell (`patches/vscode/002`, `007`, new `018` and `019`; theme and icon files that ship only with the app)
Status: Phase 2 (PLAN), awaiting Jarmo's approval

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R16 and E1–E6.
- [scenarios.md](scenarios.md): S1–S45, the manual QA matrix.
- [technical-plan.md](technical-plan.md): workstreams W1–W13, the proof-of-concept map, the two merges.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The research behind it is the release's [feasibility read](../feasibility.md). The release is [v2.0.0](../release-plan.md), step 1.

## Goal

Ritemark's window becomes 2.0's calm frame, on the Mac and on Windows, in light and dark:
- a flat ground;
- the AI on its own sheet;
- the documents on a raised desk, with their tabs at the top;
- the terminal as a tab and Copilot Chat behind More.

Nothing Ritemark 1.14 can do is lost.

## Linked Issues

- [#276](https://github.com/ProductoryHQ/ritemark-native/issues/276): a new profile hides Ritemark AI behind the terminal and shows an empty CHAT side bar.
- [#430](https://github.com/ProductoryHQ/ritemark-native/issues/430): a fresh profile opens an empty CHAT panel in the left side bar.
- [#199](https://github.com/ProductoryHQ/ritemark-native/issues/199): a "New" button at the right edge of the tab row.

## MVP Scope

| Area | Requirements |
|---|---|
| The frame without a title row, on the Mac and on Windows; zoom | R1, R2, R3 |
| The AI column holds only the AI | R4 |
| The places row with ⋯, and Copilot Chat behind it as a tab | R5, R6 |
| The tab row: readable tabs, the + (Text, Table, Web page, Terminal), folding | R7 |
| The terminal as a tab: Running, Stop, the working dot, no start-up terminal | R8 |
| Home and Tasks keep the front of the row (the rule; step 3 pins them by default) | R9 |
| The left column's head, with its menus from the extension | R10 |
| You (Settings, Help) and Ritemark's menus | R11, R12 |
| The full light and dark theme pass, every surface | R13 |
| Window sizes, the simple part | R14 |
| Nothing lost; a v1.14.0 profile moves in | R15, R16 |
| Patches folded, the proof-of-concept code dropped, tests, docs, builds, drift | E1–E6 |

**Not in this sprint:**
- the welcome (step 2);
- the project file and list, Home as the project's page, switching projects, and the document's Saved and Share (step 3);
- the columns coming over the desk;
- a VS Code update (its own sprint, after step 3).

## How it is delivered

The sprint merges into main twice, because a shell change can be seen on Windows only after it merges ([technical-plan.md](technical-plan.md#delivery-plan-two-merges)):

1. **Merge 1, the frame.** The patches folded, the Mac frame, Windows' first cut, the AI column, places and More, the tab row, terminals, the head, You and the menus, and updating from v1.14.0. Then a production build check and Windows round 1.
2. **Merge 2, the theme and Windows.** The full theme pass, window sizes, the fixes from Windows round 1 and the screenshot baseline. Then a production build check and Windows round 2.

Modal dialogs, Flows and the Agent Library wait for their drawings. If those come after merge 2 is ready, those three surfaces follow in a small third PR.

## Product Decisions

- **2026-10-15 (Jarmo):** 2.0 ships the theme, the welcome and the project together; the theme first; patching VS Code is fine.
- **2026-10-16 (Jarmo):**
  - Ritemark's places first: Home, Documents, Tasks, Browser, Agents, Transcribe.
  - Every place stays in the row and what does not fit folds.
  - Tabs fold instead of scrolling.
  - Home and Tasks are the first two tabs.
- **2026-10-17 (Jarmo):**
  - "We will focus on 2.0 from now on": no switch, and no release from main until 2.0.
  - "Terminal must be one type of tab."
  - Windows "mimic as much apple as possible".
  - More is "for activity bar icons that do not fit".
  - Copilot Chat goes behind More.
  - You holds Settings and Help; Ritemark's menus on the Mac too.
- **2026-10-17 (engineering, on Jarmo's "You decide"):**
  - Patches 018 and 019 own sizes and drawing; 002 keeps placement.
  - Windows rounds are built from main.
  - Copilot Chat opens as a tab.
- **2026-10-17 (engineering): the VS Code pin stays at 1.117.0 for this sprint**, and VS Code is updated once, in its own sprint after step 3. VS Code now ships weekly; 1.142.0 came out on 14 October.
  - On 1.142.0, patches 001–017 fail in 46 file patches across 16 of the 17 patches, and the proof of concept's patch in 16 of its 33 files.
  - Part of that is work 2.0 removes: the three Getting Started patches give way to the welcome in step 2, and 002's terminal guards go in this sprint.
  - Updating first would mean fixing those only to delete them, and updating again before release anyway.
  - The drift is measured at each merge (E6), so the update sprint starts from known numbers.
- **2026-10-17 (engineering): window sizes (R14) take the simple part** of `framework.md`'s rules: narrowing, then hiding. The columns coming over the desk stay out. Jarmo raised no objection to the recommendation; this plan's approval confirms it.

## Feature Flag Check

No feature flag. Jarmo decided on 17 October that 2.0 is built straight on main with no switch ("We will focus on 2.0 from now on"), so this sprint changes Ritemark for everyone who builds from main. HARD RULE #1 still holds: nothing is removed without a home, and R15 checks that at each merge.

## Success Criteria

- [ ] On the Mac, the frame is as drawn, and the CDP geometry checks prove its numbers. It holds in light, dark and high contrast, zoomed and not, with one desk and two, and with each column shown and hidden (R1, R3, R13).
- [ ] On Windows, a build from main works on a Windows PC with the same frame: the menu by mouse and Alt, the window buttons, dragging and snapping (R2).
- [ ] The AI column holds only the AI, and nothing a person, an extension or an old profile does puts anything else there (R4).
- [ ] The places row and ⋯ work as drawn; Copilot Chat opens from ⋯ as a tab (R5, R6).
- [ ] Tabs are readable, the + makes any of the four kinds, and many tabs fold instead of scrolling (R7).
- [ ] Every terminal is a tab, with Running, Stop and the working dot, and none opens by itself (R8).
- [ ] A pinned Task board tab cannot be closed, unpinned or moved, and Close all leaves it (R9).
- [ ] The left column's head, You and Ritemark's menus work as drawn, with the head's words from the extension (R10–R12).
- [ ] Every drawn surface matches its drawing in both themes (R13).
- [ ] Narrowing the window narrows the AI, then hides the columns (R14).
- [ ] Every row of the before-and-after inventory works (R15). A lived-in v1.14.0 profile moves in without losing anything (R16).
- [ ] No hunk in 018 or 019 sits on another patch's lines, and the stacking check runs at every commit (E1).
- [ ] A production build from a clean-room worktree succeeds after each merge (E5).
- [ ] The docs and the drift numbers are updated (E4, E6).

## Risks

| Risk | Retirement |
|---|---|
| The Windows frame has never run on Windows | Audit first; Windows round 1 right after merge 1, before the theme pass |
| The patches have never been built for production | `compile-check-ts-native` before each merge; a production build check right after |
| Moving 002's hunks breaks something 1.x users relied on | `PATCH-RULES.md` §8's count and list; the inventory walk (S44) |
| The theme pass is the largest part | Surface by surface against the drawings; three surfaces may follow in a third PR |
| The Running chip depends on the shell's integration | Audit first; without it the bar shows nothing rather than something wrong |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Pre-Implementation Gate

- This plan's PR gets the usual automated review, and Jarmo's approval gates Phase 0.
- Phase 1's three audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol).

## Open Questions

- **The Windows menu's last item:** Exit or Close window? It is drawn as Exit, the Windows word. Exit unless Jarmo says otherwise.
- **The drawings for modal dialogs, Flows and the Agent Library:** the Experience lead's next work.

## Approval

- [ ] Jarmo approved this sprint plan
