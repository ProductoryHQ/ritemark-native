# Sprint 134: The project at the centre

Track: SDD (24 user-facing requirements; a new extension subsystem, the webview, small hunks in patches 003, 009, 018 and 019)
Override with: "use plain full track"
Branch: `sprint-134-project-at-the-centre` (created 2026-10-19 from `origin/main` `eae1dedd`, after Sprint 133's merge, with [#462](https://github.com/ProductoryHQ/ritemark-native/pull/462)'s plan merged in)
Release tier: shell (patches 003, 009, 018 and 019, and 001 if the splash audit keeps its hunk; there is no release from main until 2.0)
Status: **Phase 3 (IMPLEMENT)**. Plan approved by Jarmo on 2026-10-19 ("approved"), with his answers to the three *Decisions for Jarmo* the same day. Drafted 2026-10-18, refreshed the same day with Sprint 132's handover and the [v1.14 parity list](../parity-v1.14.md), and updated on 2026-10-19 with Jarmo's decisions and the Experience lead's answers.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R24 and E1–E7.
- [scenarios.md](scenarios.md): S1–S62, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today (on main and in the proof of concept), workstreams W1–W18, the eight audits, one merge.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is [v2.0.0](../release-plan.md), step 3. The design is the Experience lead's experience 3 (Home, projects, switching), experience 29 (empty places), experience 32's frame 5 (What moved), experience 33 (a folder that is not found, switching while Claude works), experience 26's frame 1 (Share), experience 28's frame 1 (the share question on the AI's sheet) and the comparison's document bar, in `ritemark-dev`: `product/design/experience/`.

## Goal

The project becomes the place a person works in. Each project opens on its own Home, which says what waits for the person and what changed, with Home and Tasks always the first two tabs. On Home the left column lists every project on the computer, with what waits in each, from the first day of 2.0. Every other place carries the project's name at its head. Switching projects happens in the same window, and each project keeps its own tabs. The document's bar says Saved, and Export becomes Share. The browser's share question waits on the AI's sheet instead of blocking the window. All commands drops VS Code's developer commands. Every visible string says ChatGPT, never Codex.

## What the refresh added (18 October)

Sprint 132 handed these to step 3 in its sprint plan and QA evidence:
- **The project's head on Tasks, Browser and Transcribe** (R16), as every place but Home has it in the Experience lead's drawings. Sprint 132 did only the minimum: Browser's title reads "Browser".
- **Tasks under the head** (R17): New task, Search, and the list in the order work moves (experience 6).
- **Browser under the head** (R18): the Recent label with its + and Clear, and "No pages yet" for "No recent URLs".
- **The PDF and Word bars** (R19): Make an editable copy, and Share. The Experience lead's scope of 18 October left both to this step.
- **The File menu** (R8): New tab and Share join Switch project, as Sprint 132's technical plan left them.
- **A folder that has gone stays gone** (R13): Flows' storage no longer recreates it (Sprint 133's QA).
- **The welcome's lists read the project list** (R2), as Sprint 133's plan expects.

The [v1.14 parity list](../parity-v1.14.md) names which of its rows this sprint provides. The ones that need building are in the requirements above.

## What 19 October added

Jarmo's decisions of 19 October ("all recommendations ok"):
- **The browser's share question on the AI's sheet** (R20, #455), as experience 28's frame 1 draws it. When and whether it asks stays as today; only where it asks changes, and the tabs stay usable while it waits.
- **The command palette without VS Code's developer commands** (R21, #456), as a filter of command IDs in patch 003. An audit writes the list first.
- **ChatGPT, never Codex** (R22), in every visible string. A copy pass only, after an audit that lists every such string.
- **Advanced settings** (R23) at the foot of Ritemark Settings, opening VS Code's own settings (parity gap G4).
- **An agent's colour on its row** (R24). The Agents place's other changes are accepted (parity gap G5).
- **After 2.0:** the Task board tab's and Transcribe's redraws, the AI step, the indigo icon on the open row and tab, and the Flows {date} chip (*Not in this sprint*).

The Experience lead's answers of 19 October:
- **Transcribe's settings button** is a gear at the right of the Recordings label, with the tooltip "Transcribe settings" (R16).
- **Share on a PDF or a Word file** holds Show in Finder, and Open in Preview or Open in Word (R19).

## Linked Issues

- [#455](https://github.com/ProductoryHQ/ritemark-native/issues/455): the browser's share question blocks the tab row until answered (R20).
- [#456](https://github.com/ProductoryHQ/ritemark-native/issues/456): the command palette lists VS Code's developer commands (R21).
- [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107): watched; the bundle is measured before and after (E4).

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
| The project's head on Tasks, Browser and Transcribe; Tasks' and Browser's pages under it | R16, R17, R18 |
| Make an editable copy and Share on the PDF and Word bars: Show in Finder, and Open in Preview or Open in Word | R19 |
| The browser's share question on the AI's sheet; the tabs usable while it waits | R20 |
| All commands without VS Code's developer and debugging commands | R21 |
| ChatGPT, never Codex, in every visible string | R22 |
| Advanced settings at the foot of Ritemark Settings | R23 |
| An agent's chosen colour on its row's icon | R24 |
| One projects subsystem, Home in the shared bundle, tests, builds, docs, drift | E1–E7 |

**Not in this sprint:**
- search across projects (Search all projects filters by name);
- the AI asking to use a page (experience 28, frames 2 and 3): the control question stays today's dialog;
- switching without a reload;
- sub-projects, recent documents across projects, chosen icons as marks;
- About this project written by Claude;
- a VS Code update.

**After 2.0** (Jarmo, 19 October):
- the Task board tab and Transcribe redrawn as experiences 6 and 20 draw them (this sprint gives their places a head, and Tasks its list);
- the AI step: the AI's empty state and the status bar's items;
- the indigo icon on the open row and tab;
- the Flows {date} chip;
- plain-word command names in the palette (experience 22);
- the Settings redesign (experience 15).

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
| The Browser view's New browser tab and Clear history (title row) | At the right of the Recent label; the palette | R18 |
| Transcribe's Add recording, Record and settings button | The head's Transcribe a file… and Record; the settings gear at the right of the Recordings label | R16 |
| Tasks' add field, Your calls panel and Archived section | New task; the waiting tasks first and marked in their stage; Archived inside Done | R17 |
| PDF and Word: Save as Markdown | Make an editable copy | R19 |
| Word: Open in Word | On the bar, as today, and in Share | R19 |
| The browser's "Share with Agent?" dialog, with Don't ask again | The same question on the AI's sheet, with "Share pages I open in Ritemark without asking" | R20 |
| All commands: VS Code's developer and debugging commands | Still registered, run by their menus and shortcuts; no longer in the palette | R21 |
| VS Code's settings (⌘, in 1.14) | Advanced settings at the foot of Ritemark Settings; the palette | R23 |
| Agents: an agent's own colour | Its row's icon, in that colour | R24 |

The launcher's code is deleted only after every row above is checked on the branch, and its `home-launcher` flag is set to disabled with a tombstone (`CLAUDE.md`'s flag rule).

## Analytics and privacy

- **No new events in this sprint.** The four from Sprint 133 are enough to see whether people reach a project; Home and switching add none. If Jarmo wants one (for example "project switched"), it goes through Sprint 133's consent gate and carries no name or path.
- **Nothing leaves the computer.** The project list, what waits and the first fill read only what is already on it: VS Code's recent folders, Ritemark's chat store, the boards' files and this computer's hand-off records.
- **No page reaches the AI before Share.** The share question moves onto the AI's sheet, and the consent boundary stays: nothing about a page goes into a turn until the person shares it (R20).
- **The folder holds only what the person chose to change.** `.ritemark/project.json` is written only on a change, and holds the name, line and cover, never a path or an account. About this project's `AGENTS.md` and `CLAUDE.md` are written only when the person picks Create.

## Windows

- **Round 1, before the merge:** the extension side (Home, the list, the head's menu, switching) through the test overlay on the latest Windows build from main.
- **Round 2, after the merge:** a Windows build from main for everything, including the shell parts (the Tasks tab's count, the splash, the File menu's three items, the heads on Tasks, Browser and Transcribe, the share question, the palette) and projects on other drives and network paths (S41, S42, S52, S58).

## Tests and the production build

- Extension unit tests for the project file, the list, the first fill, what waits, the switch guard, the protocol, the permanent tabs, the share question and an agent's row colour.
- Webview tests for Home's states and escaping, the list's filter, the document bar's Saved, the share question's card and Advanced settings.
- VS Code unit tests for the Tasks tab's count and the palette's filter.
- The Codex audit's search run again at QA; the theme's contrast test with the agent colours.
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
- **2026-10-18 (Sprint 132's handover, the Experience lead):** the project's head on Tasks, Browser and Transcribe comes in step 3 with their content; Browser's + and Clear sit at the right of a "Recent" group label in the column's 11-caps style; Tasks' drawing has New task and its list; Browser's empty text is plain words ("No pages yet"); the PDF bar's words and Share are step 3's.
- **2026-10-18 (engineering, in this plan):**
  - one merge;
  - the Tasks tab's count is the Tasks place's badge, read in the shell, so the two can never differ; the project's total adds the chats that wait;
  - another project's calls come from the board's own rules (`deriveWho`) and this computer's hand-off records, not the proof of concept's card-only count;
  - a chat's question or approval counts as waiting only while a window holds it, so a crash does not leave a count behind (an unread reply, added on 19 October, counts until it is read);
  - the internal recent-folders command is used once, by the first fill;
  - the switcher's submenu and File ▸ Switch project are the two small shell additions the head needs; the splash is the third;
  - no new analytics event.
- **2026-10-19 (Jarmo, "all recommendations ok"):**
  - 2.0's scope adds three items to this sprint: the browser's share question on the AI's sheet (#455), the command palette without VS Code's developer commands (#456), and "ChatGPT, never Codex" in every visible string;
  - an "Advanced settings" link at the foot of Ritemark Settings opens VS Code's own settings (G4);
  - the Agents place's other changes are accepted, and an agent's chosen colour shows on its row's icon again (G5);
  - after 2.0: the Task board tab's redraw (experience 6), Transcribe's redraw (experience 20), the AI step, the indigo icon on the open row and tab, and the Flows {date} chip.
- **2026-10-19 (the Experience lead's answers to the refresh's design questions):**
  - Transcribe's settings button is a small icon button, the gear with the tooltip "Transcribe settings", at the right of the Recordings label, as Browser's + and Clear sit at the right of Recent;
  - Share on a PDF or a Word file holds Show in Finder (Show in File Explorer on Windows) and Open in Preview or Open in Word; Make an editable copy stays on the bar beside Share; no Export or Google Docs.
- **2026-10-19 (engineering, in this plan):**
  - the share question keeps today's rule for when it asks; 009's bridge takes the answer from the sheet, so upstream's dialog never opens for it;
  - the palette's filter drops entries only from All commands; the commands stay registered;
  - the copy pass changes words only, never a key or an identifier, and a model's own name stays;
  - only a colour the person chose is drawn on an agent's row, not one guessed from its name.
- **2026-10-19 (Jarmo, at this plan's approval):** the three *Decisions for Jarmo* below.
- **2026-10-19 (engineering, on Jarmo's answer to Decision 1):**
  - the chat store keeps when each chat was last read, in its record and in `index.json`, so another project's unread replies are counted without opening it;
  - chats made before this build count as read, so the first 2.0 start shows no backlog;
  - a chat that a card runs in is counted through the card's call only, never twice.

## Decisions for Jarmo

Answered by Jarmo on 2026-10-19, with his approval of this plan.

1. **What counts as a chat that waits.** The recommendation was a question or an approval the AI is waiting on, not an unread answer. **Jarmo: "Also unread answers".** A chat waits when the AI waits on a question or an approval, and also when it has a finished reply the person has not read. Unread replies are new state: the chat store has no read marker today (spec R3; technical plan, W3).
2. **Removing 1.x's Home launcher.** **Jarmo: yes, as recommended.** Its code is deleted once every function on the table above is checked, and its `home-launcher` flag is set to disabled with a tombstone.
3. **Tasks' list as experience 6 draws it** (R17). Your calls stops being a panel of its own, and the tasks that wait lead their stage, marked; Archived goes inside Done. **Jarmo: yes, as drawn.** Every task and action stays and the count is unchanged.

## Feature Flag Check

No new flag. 2.0 is built on main with no switch (Jarmo, 17 October). The palette's filter removes no feature: every dropped command stays registered and reachable where it was. The `task-board` flag keeps working: with it off, Home is first alone and nothing counts tasks (R5, R13). The `home-launcher` flag is retired with the launcher (Decision 2), as `CLAUDE.md` asks when a feature's code goes.

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
- [ ] Tasks, Browser and Transcribe carry the project's head, and nothing their title rows did is lost (R16–R18).
- [ ] The PDF and Word bars say Make an editable copy and end in Share (R19).
- [ ] The File menu has New tab, Switch project and Share (R8).
- [ ] The browser's share question is asked on the AI's sheet, and the tabs work while it waits; nothing about a page reaches the AI before Share (R20).
- [ ] All commands lists no VS Code developer or debugging command on the audit's list, and every kept command is there (R21).
- [ ] No visible string names the AI "Codex"; no setting is lost (R22).
- [ ] Advanced settings opens VS Code's settings from the foot of Ritemark Settings (R23).
- [ ] An agent's chosen colour shows on its row, readable in Light and Dark (R24).
- [ ] Every Sprint 134 row of the v1.14 parity list is checked on the branch.
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
| Tasks' new order hides a call | A call leads whatever stage it is in; S49 |
| A title row's action is lost under the head | Each moves into its page first and stays in the palette; S46 |
| A page is shared before the person answers, now that nothing blocks | Shared only with an answer or the stored choice; nothing unshared goes into a turn; S57 |
| The palette's filter hides a command someone needs | The audit's keep rule; the commands stay registered; S58 |
| The copy pass loses a setting | Words only; keys and identifiers listed as staying before any change; S59 |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 132 merged:** the rule that keeps pinned Home and Task board tabs first (019), the head's place and menus (018), the tab row.
- **Sprint 133 merged:** the landing (`src/welcome/landing.ts`), a new project (`src/welcome/newProject.ts`), the sample project (`extensions/ritemark/sample-project/`), the update marker `ritemark.updatedFrom1x` and the consent gate.
- **The Experience lead's drawings**, all in: experience 29 for an empty project and a project with no board, experience 33 for a folder that is not found and for switching while Claude works, experience 28's frame 1 for the share question, and the answers of 18 and 19 October (spec, *Resolved Questions*). Of the refresh's three small design questions, two were answered on 19 October (Transcribe's settings button, Share on a PDF and a Word file). Rows on Browser is still open (spec, *Open Questions*).
- **Sprint 133 merged before the Codex audit**, so the welcome's words are in its list.

## Pre-Implementation Gate

- This plan's PR gets the usual automated review, and Jarmo's approval gates Phase 0.
- Phase 1's audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Jarmo approved this sprint plan: "approved" (2026-10-19). His answers to the three *Decisions for Jarmo*, the same day: unread answers count as waiting too ("Also unread answers"); the launcher's code is deleted after the check ("Yes, delete after the check"); Tasks' list as drawn ("Yes, as drawn").
