# Sprint 132: Surfaces and frame, theme first

Track: SDD (16 user-facing requirements, Mac and Windows, VS Code patches plus the extension)
Override with: "use plain full track"
Branch: `sprint-132-surfaces-and-frame` (created only after approval)
Release tier: shell (`patches/vscode/002`, `007`, new `018` and `019`; theme and icon files that ship only with the app)
Status: Phase 2 (PLAN) approved by Jarmo on 2026-10-17; Phase 0 (branch) is next

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

- **2026-10-17, after approval and before Phase 0 (engineering):** R8 revised. Ctrl+` (⌃` on the Mac) opens a new terminal tab, and the View menu gets no Terminal entry. Patch 002 removes VS Code's Toggle Terminal shortcut and menu entry today; sending its `terminal.contribution.ts` wholly back to upstream would have brought both back as a toggle for an unused bottom panel. This clarifies R8's "and the shortcut" and adds S46. Found by the Development manager's planning session.

- **2026-10-17, during Phase 3–5 (Jarmo):** "make sure you match stuff with Experience prototype ... even the latest recent changes are important." So, with the Experience lead's kit (`kit/ritemark.css`, `ritemark.js`) and latest drawings as the reference:
  - the prototype's themes, product icons, dark file icons and webview look come over in merge 1 rather than Phase 7; Phase 7 still checks every surface against its drawing;
  - More (⋯) and You open Ritemark's own drawn menus (experiences/home frame 4: "More places", Copilot Chat first; experiences/settings frame 1), not VS Code's plain menu;
  - a new window's columns take the drawn widths (left column 256, AI column 400, the desk 784 at 1440);
  - the places sit 34 apart from 8, as the kit's script lays them out.
- **2026-10-17, during Phase 4 (engineering):** the terminal shortcut is also bound by physical key (`ctrl+[Backquote]`). With an Estonian or other non-US layout, "`" is not a plain key, so the character binding alone never fires.
- **2026-10-17, during Phase 6 (Jarmo, through the Experience lead):** ⌘, (Ctrl+, on Windows) opens Ritemark's settings page ("Ritemark settins"), and You shows "Settings ⌘,", as experiences/settings frame 1 draws it. VS Code's own settings stay in All commands; the route behind Settings > Advanced comes with the Settings redesign.
- **2026-10-17, during Phase 6 (the Experience lead's review of the screenshots):** fixed in merge 1: the project's mark (its initials in a 24 square of ink) before the name; tabs as wide as their names with no 120 floor (the prototype); an empty desk keeps its sheet and its + and shows no letterpress; in the places row only Ritemark's six take a spot, every other place lives in More (which takes the chosen fill while one of them is open); the Agent Library's section headers in ink with no band (dark was unreadable); the project's menu holds project things only, Switch project… first and no All commands (it stays on ⇧⌘P and in the View menu); the open tree row is the desk's colour, radius 4, no border; `.flow.json` files get the flow icon. Moved to step 2: the extension in muted ink, which needs a patch to VS Code's resource label (release plan, step 2).
- **2026-10-17, during Phase 6 (Experience lead's answers, confirmed by Jarmo):** the proof of concept at 4bca3078 is the reference for the frame, theme, sizes and behaviour, and the drawings for what it does not build (the Windows top, More's contents, the terminal's bar, the +'s words); file names keep their extension; the terminal bar's shell name is a plain label in step 1; a fresh window's left column is 248 and the AI's sheet 384 (with the 8 gaps: 256 and 400).

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

- [x] Jarmo approved this sprint plan (2026-10-17: "approved, admin merge 438")
