# Sprint 134: The project at the centre

Track: SDD (15 user-facing requirements; a new extension subsystem, the webview, small hunks in patches 018 and 019)
Override with: "use plain full track"
Branch: `sprint-134-project-at-the-centre` (created only after approval, and only once Sprint 133 is merged)
Release tier: shell (patches 018 and 019, and 001 if the splash audit keeps its hunk; there is no release from main until 2.0)
Status: Phase 2 (PLAN) drafted 2026-10-18, **awaiting Jarmo's approval**. Not started.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R15 and E1–E7.
- [scenarios.md](scenarios.md): S1–S44, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today (on main and in the proof of concept), workstreams W1–W11, the five audits, one merge.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is [v2.0.0](../release-plan.md), step 3. The design is the Experience lead's experience 3 (Home, projects, switching), experience 29 (empty places), experience 32's frame 5 (What moved), experience 33 (a folder that is not found, switching while Claude works), experience 26's frame 1 (Share) and the comparison's document bar, in `ritemark-dev`: `product/design/experience/`.

## Goal

The project becomes the place a person works in. Each project opens on its own Home, which says what waits for the person and what changed, with Home and Tasks always the first two tabs. On Home the left column lists every project on the computer, with what waits in each, from the first day of 2.0. Switching projects happens in the same window, and each project keeps its own tabs. The document's bar says Saved, and Export becomes Share.

## Linked Issues

- [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107): watched; the bundle is measured before and after (E4).
- No other open issue is in this step (release plan, Issue Intake).

## MVP Scope

| Area | Requirements |
|---|---|
| `.ritemark/project.json`: name, mark, cover, line, written only on a change | R1 |
| The project list, filled on the first 2.0 start | R2 |
| What waits, in each project and across them; the Tasks tab's count | R3, R6 |
| Home, the project's own page | R4 |
| Home and Tasks, always the first two tabs | R5 |
| On Home, the left column holds the projects | R7 |
| The head's menu: Switch project ▸, About this project (`AGENTS.md`, opened or created); File ▸ Switch project | R8 |
| Switching in place; asking first while Claude works (Cancel, Switch and stop, Open in a new window) | R9 |
| The welcome lands on Home; What moved, once | R10, R11 |
| Saved and Share on the document's bar | R12 |
| A folder that is not found, an empty project, a project with no board | R13 |
| Nothing lost; Windows | R14, R15 |
| One projects subsystem, Home in the shared bundle, tests, builds, docs, drift | E1–E7 |

**Not in this sprint:**
- search across projects (Search all projects filters by name);
- switching without a reload;
- sub-projects, recent documents across projects, chosen icons as marks;
- About this project written by Claude;
- a VS Code update.

## What 1.x did, and where it lives in 2.0 (HARD RULE #1)

| 1.x | 2.0 | Requirement |
|---|---|---|
| Home launcher: New document, New table | Home's Start something; the + | R4, R14 |
| Home launcher: New AI conversation | The AI sheet's New chat, beside Home | R14 |
| Home launcher: recent documents | Home's Last changed | R4, R14 |
| Home launcher: Task board | The Tasks tab, second in the row; Home's Waiting for you | R5, R14 |
| Home launcher: Open document…, Open folder… | Add a project…; the head's Open a folder…; ⌘O | R7, R8, R14 |
| Home launcher with no folder: recent folders | The projects list | R7, R14 |
| The head's Switch project… (Sprint 132: VS Code's recent list) | Switch project ▸ with Ritemark's projects | R8 |
| Export: PDF, Word, Google Docs (every state), Copy as Markdown | Share: Send a copy, Google Docs, Copy as Markdown | R12 |
| Opening a folder from VS Code's File menu | Still there; Ritemark's own paths ask first when the AI is working | R9 |

The launcher's code is deleted only after every row above is checked on the branch, and its `home-launcher` flag is set to disabled with a tombstone (`CLAUDE.md`'s flag rule).

## Analytics and privacy

- **No new events in this sprint.** The four from Sprint 133 are enough to see whether people reach a project; Home and switching add none. If Jarmo wants one (for example "project switched"), it goes through Sprint 133's consent gate and carries no name or path.
- **Nothing leaves the computer.** The project list, what waits and the first fill read only what is already on it: VS Code's recent folders, Ritemark's chat store, the boards' files and this computer's hand-off records.
- **The folder holds only what the person chose to change.** `.ritemark/project.json` is written only on a change, and holds the name, line and cover, never a path or an account. About this project's `AGENTS.md` and `CLAUDE.md` are written only when the person picks Create.

## Windows

- **Round 1, before the merge:** the extension side (Home, the list, the head's menu, switching) through the test overlay on the latest Windows build from main.
- **Round 2, after the merge:** a Windows build from main for everything, including the shell parts (the Tasks tab's count, the splash, File ▸ Switch project) and projects on other drives and network paths (S41, S42).

## Tests and the production build

- Extension unit tests for the project file, the list, the first fill, what waits, the switch guard, the protocol and the permanent tabs.
- Webview tests for Home's states and escaping, the list's filter and the document bar's Saved.
- A VS Code unit test for the Tasks tab's count.
- CDP checks for the permanent tabs, the count, switching and the splash; Home, the list, the switcher and What moved join the screenshot baseline.
- After the merge, a production build from a clean-room worktree at the merged commit, as a build check; all patches apply on the pin, a second run is clean, the stacking check passes; the drift check.

## Product Decisions

- **2026-10-15 (Jarmo):** Home states the project's name, with a header image the person can change; the first window after the welcome is Home; chats stay private on this computer, never in the project's folder.
- **2026-10-16 (Jarmo):** Home and Tasks pinned as the first two tabs, icons only; "yes, yes, yes" to the projects list on Home and the count on the Tasks tab.
- **2026-10-17 (Jarmo):** "when I click Tasks, the board ALWAYS opens too" (and Home the same); the Home tab comes in step 3 ("ok").
- **2026-10-17 (engineering, on Jarmo's "You decide"):** the project list fills on the first 2.0 start from recent folders, chats and task boards.
- **2026-10-18 (the Experience lead's answers to this plan's design questions):**
  - Start something is on every Home, under Waiting for you;
  - an empty project is experience 29's frame 1; a project with no board its frame 2, with no count on the Tasks tab;
  - a folder that is not found and switching while Claude works are drawn as experience 33: the row keeps its place as Not found; clicking it shows Find it… on Home; any switch that reloads asks first, with Open in a new window as the default;
  - the "Switched to…" note with Go back stays;
  - What moved arrives with Home, once per profile;
  - the bar is `comparison/after-write.png`; Share is experience 26's frame 1 ("Share, not Export").
- **2026-10-18 (Jarmo, via the Experience lead's question form):**
  - About this project is one file, `AGENTS.md`, which both Claude and Codex read, with a `CLAUDE.md` that only points to it, shown everywhere in the UI as "About this project". This sprint builds the project menu's item, which opens the file or offers to create it.
- **2026-10-18 (the Experience lead, About this project's details):** a folder with its own `CLAUDE.md` gets a note with Add the line and Not now, and that `CLAUDE.md` never changes without the click; Documents hides only Ritemark's pointer-only `CLAUDE.md`; the tab and the Documents row read About this project with the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT".
  - The sample project: yes. Ritemark ships one, offered on the welcome (Sprint 133). Here it is an ordinary project, and it gains its line on Home.
  - Usage data for people updating from 1.x: an OK on 1.x's notice carries over as a yes; anyone who opted out or never answered starts off (Sprint 133). Nothing changes here.
- **2026-10-18 (engineering, in this plan):**
  - one merge;
  - the Tasks tab's count is the Tasks place's badge, read in the shell, so the two can never differ; the project's total adds the chats that wait;
  - another project's calls come from the board's own rules (`deriveWho`) and this computer's hand-off records, not the proof of concept's card-only count;
  - a chat counts as waiting only while a window holds it, so a crash does not leave a count behind;
  - the internal recent-folders command is used once, by the first fill;
  - the switcher's submenu and File ▸ Switch project are the two small shell additions the head needs; the splash is the third;
  - no new analytics event.

## Decisions for Jarmo

Each has a recommendation, listed in [spec.md](spec.md#open-questions) too.

1. **What counts as a chat that waits.** I recommend a question or an approval the AI is waiting on, not an unread answer.
2. **Removing 1.x's Home launcher.** I recommend deleting its code once every function on the table above is checked, and setting its `home-launcher` flag to disabled with a tombstone.

## Feature Flag Check

No new flag. 2.0 is built on main with no switch (Jarmo, 17 October). The `task-board` flag keeps working: with it off, Home is first alone and nothing counts tasks (R5, R13). The `home-launcher` flag is retired with the launcher (Decision 2), as `CLAUDE.md` asks when a feature's code goes.

## Success Criteria

- [ ] A project opened for the first time opens on its Home, with Home and Tasks first; coming back brings its tabs back as they were (R5, R9).
- [ ] The list, the switcher, Home, the Tasks tab and the Tasks place agree with each project's board and chats (R3, R6).
- [ ] The project list holds every project from the first 2.0 start; a missing folder is shown, never dropped (R2, R13).
- [ ] Home shows the project's page as drawn, with names as text, and redraws as things change (R4).
- [ ] Close all leaves exactly Home and Tasks (R5).
- [ ] Switching asks first when the AI is working; the reload shows the ground's colour (R9).
- [ ] What moved shows once on an updated profile, never on a fresh one (R11).
- [ ] Saved and Share work, and every Export item works from Share (R12).
- [ ] About this project opens or creates `AGENTS.md`, shown as About this project; a `CLAUDE.md` already in the folder changes only through Add the line (R8).
- [ ] Everything Home's launcher did in v1.14.0 can be done from 2.0's Home (R14).
- [ ] Light, Dark and Windows checked (R15).
- [ ] A production build from a clean-room worktree succeeds after the merge; the drift is recorded (E5, E7).

## Risks

| Risk | Retirement |
|---|---|
| Counting other projects is slow with many projects | Read on show, cached; measured in the audit |
| A crash leaves a chat counted as waiting | Only chats a window holds count |
| The first fill misses boards known from nowhere else | Audit; otherwise they join when next opened |
| Switching through VS Code's own Open Folder stops the AI without asking | Audit; at worst today's behaviour, recorded |
| Removing the launcher loses a function | The table above, checked before the code goes |
| A folder already has its own `CLAUDE.md` (a code project) | Create never writes over it; the note offers Add the line, which keeps every other byte; S44 |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 132 merged:** the rule that keeps pinned Home and Task board tabs first (019), the head's place and menus (018), the tab row.
- **Sprint 133 merged:** the landing (`src/welcome/landing.ts`), a new project (`src/welcome/newProject.ts`), the sample project (`extensions/ritemark/sample-project/`), the update marker `ritemark.updatedFrom1x` and the consent gate.
- **The Experience lead's drawings**, all in: experience 29 for an empty project and a project with no board, experience 33 for a folder that is not found and for switching while Claude works, and the answers of 18 October (spec, *Resolved Questions*).

## Pre-Implementation Gate

- This plan's PR gets the usual automated review, and Jarmo's approval gates Phase 0.
- Phase 1's audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [ ] Jarmo approved this sprint plan
