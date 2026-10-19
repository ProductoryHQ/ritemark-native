# Ritemark 2.0 — the v1.14 parity list

**Status:** written 2026-10-18 from the code. Docs only. It serves the release plan's feature-complete item: "Everything v1.14.0 can do is reachable in 2.0, checked against a written list". Sprint 134 checks its rows on its branch, and Sprint 136 walks every row on the signed candidate.<br>
**Rule:** HARD RULE #1. Whatever v1.14.0 does keeps a place in 2.0. A function may leave the interface only by a decision that is written down.<br>
**Read from:**
- v1.14.0's code at the tag `v1.14.0` (`ed0b6226`): `extensions/ritemark/` (the extension, its `package.json` and the webview) and patches 001–017.
- Main at `b1c198af` (Sprint 132 merged, with its closeout).
- Sprint 133's branch, `origin/sprint-133-welcome` at `1ce98c6c` ([#453](https://github.com/ProductoryHQ/ritemark-native/pull/453), in flight).
- [Sprint 134's plan](sprint-134-project-at-the-centre/sprint-plan.md), refreshed the same day.
- The Experience lead's inventory of 1.14 (`ritemark-dev`: `product/design/experience/comparison/README.md`, "Every function, today and now") and Sprint 132's walk of it ([qa-evidence.md](sprint-132-surfaces-and-frame/qa-evidence.md), S44).
- `docs/user/`.

## How to read it

Each row names something a person can do in v1.14.0, where it is in 2.0, and which step gives it that place.

| Step | Meaning |
|---|---|
| **Main** | On main now: Sprint 132, or unchanged since 1.14 and walked in Sprint 132's S44 |
| **S133** | Sprint 133, the welcome ([#453](https://github.com/ProductoryHQ/ritemark-native/pull/453), in flight) |
| **S134** | Sprint 134, the project at the centre (planned) |
| **S136** | Sprint 136, the release (planned): checked on the signed build |

| Status | Meaning |
|---|---|
| Done | Reachable on main today |
| In flight | Done on Sprint 133's branch, not merged |
| Planned | A requirement in Sprint 134's or Sprint 136's plan |
| Left out | Leaves the interface by a written decision, named in the row |
| **Gap** | No home yet, or narrower than 1.14 with no decision. The row names the plan that should take it |

A row marked "check" was not run in a dev build. Sprint 136 checks it on the signed candidate (its R9).

## Gaps at a glance

Each gap is in its section below, with its evidence.

| # | Gap | Owner | Recommendation |
|---|---|---|---|
| G1 | The Getting started and Blog links on 1.14's first page. Sprint 133 retires the page; Help opens only the support pages | Sprint 133 (#453) | Add Getting started to the Help menu beside Support, and let the support pages link the blog; or Jarmo accepts Support as their home |
| G2 | Git's line ("Ritemark found Git" or "needs Git") showed on every 1.14 first page. Sprint 133 shows it only for this computer's runtime | Sprint 133 (#453) | Show Git's line in Settings' "This computer's tools" whatever the runtime, because File changes needs Git either way |
| G3 | Send feedback works only with usage data on. Usage data is off by default from Sprint 133 | Jarmo, then Sprint 133 | Let Send feedback work with usage data off: pressing Send is the person's own choice, and it carries only what they write |
| G4 | VS Code's own settings have no visible way in: ⌘, opens Ritemark Settings since Sprint 132. Feature switches, update mode and channel, excluded folders and the transcription export folder live only there | The Settings redesign (not planned for 2.0) | A small "Advanced settings" link at the foot of Ritemark Settings before Sprint 136, as Sprint 132's plan expected of the redesign |
| G5 | The Agents place changed more than Jarmo's yes covered: the count line is gone; the empty state's two buttons became one line; Sort is reachable only through Search; descriptions, badges and "used by" moved into tooltips; an agent's own colour no longer shows | The Development manager, with Jarmo | Ask Jarmo to accept, since every function is reachable; for the colour, show it on the row's icon or retire the setting with his yes |
| G6 | A flow's run says "sign in under Agent Runtime", but the sign-in cards sit under API Keys | A small fix PR | Name the right heading, or link to the card |
| G7 | Maximize the AI's column: its title row is gone, so it is reachable only from the palette | The AI's sheet pass (not planned for 2.0) | Accept for 2.0 (the palette has it), unless the AI's sheet gains the expand button the drawings show |
| G8 | Sprint 133 sends every walkthrough command, including VS Code's accessibility walkthrough, to the welcome | Sprint 133 (#453) | Accept: the walkthroughs teach code editing. Jarmo confirms with Sprint 133 |
| G9 | `docs/user/` describes 1.14's places and words in a dozen pages, and two links are broken | Sprint 136 (R6) | Rewrite the pages with the release notes |

Step 3's own gaps are in [Sprint 134's plan](sprint-134-project-at-the-centre/sprint-plan.md) as requirements: the project's head on Tasks, Browser and Transcribe, Tasks' and Browser's pages, the PDF and Word bars, New tab and Share in the File menu, the welcome's lists, a gone folder that stays gone, and opening a single document in R14's table.

## 1. The window

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| Home: the launcher in the activity bar | Home, first place in the row; Home's own page and the projects list replace the launcher | Main, S134 | Done; Planned (R4, R7, R14) |
| Home: New document | Home's Start something; the +; New ▸ Text; File ▸ New Document; ⌘N | Main, S134 | Done; Planned (R4) |
| Home: New AI conversation | The AI sheet's New chat, beside Home | Main | Done |
| Home: Task board | The Tasks place opens the board; the pinned Tasks tab; Home's Waiting for you | Main, S134 | Done; Planned (R5) |
| Home: Open document… | File ▸ Open… (⌘O, Ctrl+O) | Main | Done (Sprint 134's R14 names it) |
| Home: New table | Home's Start something; the +; New ▸ Table; File ▸ New Table | Main, S134 | Done |
| Home: Open folder… | The head's Open a folder…; Add a project…; File menu | Main, S134 | Done; Planned (R7) |
| Home: recent documents | Home's Last changed | S134 | Planned (R4) |
| Home: recent folders (no folder open) | The projects list; File ▸ Open Recent; the welcome's lists | S133, S134 | In flight; Planned (R2, R7) |
| The file list (Explorer, called Folder) | Documents, with the project's head, New and Search | Main | Done |
| New file, New folder | New, under the head | Main | Done |
| Search across files | Search, under the head; More ▸ Search | Main | Done |
| Refresh the file list | All commands only | Main | Left out (the comparison, decided with Jarmo on 14 October) |
| Open editors | The tabs; All commands | Main | Left out (the comparison: merged into the tabs) |
| A file's right-click menu | Same menu | Main | Done |
| Send to AI Chat | A file's right-click menu | Main | Done |
| Source control | More ▸ File changes; View menu | Main | Done |
| Extensions | More ▸ Extensions; View menu | Main | Done |
| `.ritemark` (tasks, flows) in the tree | Hidden; reached through Tasks and Agents | Main | Left out (release plan, step 1 defaults) |
| The terminal beside the AI, opened at start | A tab on the desk, from the + and ⌃` (Ctrl+`); none at start | Main | Done (Jarmo, 17 October) |
| View ▸ Advanced ▸ Terminal | The + and ⌃` | Main | Left out (Sprint 132, R8 revised) |
| Ctrl+Shift+` new terminal | Same | Main | Done |
| Copilot Chat in the activity bar | More ▸ Copilot Chat, opening as a tab; View ▸ Copilot Chat; ⌃⌘I (Ctrl+Alt+I), only while Copilot Chat is usable | Main | Done (Jarmo, 17 October) |
| The settings gear at the foot of the bar | You ▸ Settings; ⌘, (Ctrl+,) | Main | Done |
| The AI panel's settings gear | You ▸ Settings; ⌘, | Main | Done |
| Show and hide the side columns | One toggle per strip | Main | Done |
| The AI column's Maximize and "…" | All commands | Main | **Gap G7** |
| The window title | The project's name in the left column's head; Home's page | Main, S134 | Done on Documents and Agents; Planned for Tasks, Browser and Transcribe (R16) |
| The breadcrumb | The tab's tooltip shows the path in the project | Main | Left out (the comparison) |
| Status bar: remote and problems | Problems in the View menu | Main | Left out (the comparison) |
| Status bar: words, AI ready or offline, update ready, scheduled runs, notifications, Report AI issue | Same | Main | Done |
| The empty editor's letterpress and shortcut hints | An empty desk keeps its sheet and its +; Sprint 133 adds Text, Table and Web page tiles | Main, S133 | Left out (the Experience lead's review of 17 October) |
| VS Code's settings page (⌘, in 1.14) | All commands ("Preferences: Open Settings") | Main | **Gap G4** |

## 2. Menus

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| The Mac menu bar: File, Edit, View, Help | Same, native | Main | Done; check the native bar (Jarmo's Mac pass, Sprint 136 S13) |
| The Windows menu bar | The same menus behind the menu button in the left strip; Alt focuses it | Main | Done (Windows rounds 1 and 2) |
| File ▸ New Document, New Table | Same | Main | Done |
| File ▸ Open…, Open Folder…, Open Recent, Save, Close | Same | Main | Done |
| File ▸ New tab, Switch project, Share | New in the drawings. VS Code's own File ▸ Share (vscode.dev links) is already gone in 1.14 (patch 003); this Share is the document's | S134 | Planned (R8) |
| View ▸ File Browser | View ▸ Documents | Main | Done |
| View ▸ Run (Ctrl+Shift+D) | The shortcut and All commands | Main | Left out (Windows round 1 fix: Run is for code) |
| View ▸ Chat | View ▸ Copilot Chat | Main | Done |
| View ▸ Problems, Output, Debug Console | Same; they open VS Code's bottom panel, as in 1.14 | Main | Done |
| Help ▸ Support, View License, Toggle Developer Tools, About | Same; Support no longer asks about an outside site | Main | Done |
| — | You ▸ Settings and Help | Main | New |
| — | More (⋯): places that do not fit, Copilot Chat | Main | New |

## 3. The first window

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| Getting Started opens in an empty window | The welcome, alone in the window | S133 | In flight (R1, R12) |
| Getting Started: New document, New table, New flow | The +; New ▸ Text, Table, Flow; the empty desk's tiles | Main, S133 | Done; In flight |
| Getting Started: Open folder | The welcome's step 2; the head's Open a folder… | Main, S133 | Done; In flight |
| Getting Started: recent files and folders (up to six) | The welcome's lists (three); the projects list; File ▸ Open Recent (workspaces too) | S133, S134 | In flight; Planned (R2) |
| Getting Started: Support articles link | Help ▸ Support; You ▸ Help | Main | Done |
| Getting Started: Getting started and Blog links | None | S133 | **Gap G1** |
| Launch check: ChatGPT and Claude signed in, "Click here to log in" | The welcome's cards; Settings' account cards | Main, S133 | Done (Settings); In flight (welcome) |
| Launch check: Git found or needed | Settings and the welcome, only for this computer's runtime | S133 | **Gap G2** |
| Launch check: Node, when needed (patch 017) | Settings and the welcome, for this computer's runtime | S133 | In flight (R5, R12) |
| The usage-data notice (OK, Opt Out, Privacy Policy, Terms of Use) | The welcome's switch, off until yes; Settings ▸ Usage data, with both links; a 1.x OK carried over | S133 | In flight (R7) |
| Walkthroughs (Help ▸ Welcome: Open Walkthrough…, accessibility) | The welcome | S133 | **Gap G8** |
| The AI sheet focused at start | Kept for project windows; not while the welcome shows | S133 | In flight |
| The AI's onboarding wizard and setup views | Unchanged, for anyone who skipped the welcome | Main | Done |

## 4. The document editor

Unchanged on main apart from colours and fixes (Sprint 132's S44, #450).

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| Contents (outline), jump to a heading | The document's bar | Main | Done |
| Properties: title, author, date, tags, status, description, custom | The document's bar, side panel | Main | Done |
| Comments: count, overview, send assigned comments to the AI | The document's bar | Main | Done |
| Agent settings for agent files | The document's bar | Main | Done |
| Dictation: mic, language, more languages, settings, model download | The document's bar | Main | Done; on Mac and Windows |
| Save problem: Review changes, Retry | The document's bar, in Saved's place | Main, S134 | Done; Retry is a check |
| — | Saved on the document's bar | S134 | Planned (R12) |
| Export PDF, Export Word, Copy as Markdown | Share: Send a copy, Copy as Markdown | S134 | Planned (R12) |
| Google Docs: Connect, Create, Sync, Open, Remove link, Reconnect | Share ▸ Google Docs, each state | S134 | Planned (R12); check the production client |
| Word count | Status bar | Main | Done |
| Typing shortcuts, headings, undo and redo, lists, autosave | Same | Main | Done |
| Slash menu, block handle, selection menu, link dialog, @ file links, ⌘-click | Same | Main | Done |
| Tables, images, code blocks, Mermaid, draw.io | Same | Main | Done |
| Margin comments with @ an agent | Same | Main | Done |
| Find with count | Same | Main | Done |
| Conflict dialog: compare, use disk version, keep mine | Same; Use disk version fixed (#450) | Main | Done |

## 5. Other kinds of file

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| CSV and Excel grid: edit, sort, column menu, rows and columns, cell bar | A tab on the desk; sorted delete and number sort fixed | Main | Done |
| Excel sheet tabs, formula bar; .xls read-only, .xlsx editable | Same | Main | Done; sheet tabs are a check |
| Open in Excel or Numbers | The bar | Main | Done |
| PDF: page, zoom, fit, find | The bar | Main | Done |
| PDF and Word: Save as Markdown | Make an editable copy | S134 | Planned (R19) |
| — | Share on the PDF and Word bars | S134 | Planned (R19) |
| Word: pages, zoom, find, Open in Word | The bar | Main | Done |
| PowerPoint: slides, notes, zoom, find, Open in PowerPoint | The bar | Main | Done; notes are a check |
| draw.io editor, flow editor, transcript workbench | Tabs on the desk | Main | Done; the workbench is a check |
| HTML: open as text, open in the browser | A file's right-click menu | Main | Done |

## 6. The AI

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| The AI panel in the right side bar | The AI's sheet, alone in its column | Main | Done |
| New conversation; pinned, working, needs-you and recent; All conversations | The sheet's chat rail | Main | Done |
| Conversations: pin, rename, delete, move to this project | Same | Main | Done; the menus are a check |
| Example prompts | The empty sheet, naming the AI in use | Main, S133 | Done; In flight (words) |
| Message box: send, stop, resize | Same | Main | Done |
| The AI and model: Claude, ChatGPT, OpenCode | Same picker | Main | Done |
| Manual, Auto, Plan only | Same | Main | Done |
| Thinking effort | Same, inside the sheet | Main | Done |
| Attach files and images; context chips; @ agents and / commands; drag and paste | Same; new agents show without a reload (#450) | Main | Done |
| Prompt queue | Same | Main | Done; a check |
| Status line, activity, helpers, changed files, plan, questions | Same | Main | Done |
| Approvals and plan reviews | Same | Main | Done; a check |
| Sign-in, setup, repair and recovery cards; offline and compatibility notices | Same; the welcome too | Main, S133 | Done; a check |
| "You are interacting with AI" | Same | Main | Done |
| AI information | Same | Main | Done |
| Report AI output | Status bar; AI information | Main | Done |

## 7. Agents, flows and scheduled agents

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| Agent Library: Instructions, Agents, Skills, Commands, Scheduled, Flows | The Agents place, with the project's head | Main | Done |
| Collapsing a section; the + on each section | New in the head: Agent, Skill, Command (new), Flow | Main | Left out (Jarmo, 18 October: "agents ok") |
| The count line; the empty state's New skill and New agent | One muted line; New in the head | Main | **Gap G5** |
| Search and Sort, always shown | Search in the head opens the field; Sort sits inside it | Main | **Gap G5** |
| Descriptions, the Claude/Codex badge, a flow's "used by" | Each row's tooltip | Main | **Gap G5** |
| An agent's own icon and colour | One icon per kind; the colour setting no longer shows | Main | **Gap G5** |
| Project / User | This project / All projects | Main | Done |
| A row's menu: Launch Chat, Open, Duplicate, Reveal, Move scope, Delete… | Same | Main | Done |
| The agent's settings panel | Same, redrawn | Main | Done |
| Scheduled agents: consent, runs, approve, open result | Agents ▸ Scheduled; status bar; notifications | Main | Done; a check |
| Flows: create, edit, run, schedule, six kinds of step | Agents ▸ Flows; New ▸ Flow; the flow editor redrawn | Main | Done |
| A flow's run when Claude Code or Codex is not signed in | It says where to sign in, naming the wrong heading | Main | **Gap G6** |
| A flow's Note boxes | One help line under Timeout | Main | Done (the Experience lead) |

## 8. Tasks

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| The Tasks place: add field, Your calls, Doing, To do, Ideas, Done, Archived | The project's head, New task and Search, then the list in the order work moves | Main, S134 | Done; Planned (R16, R17) |
| The board tab: Your calls, Board, Ideas, Log | Same; the pinned Tasks tab; Tasks opens it | Main, S134 | Done; Planned (R5) |
| Card actions: Give to agent, Review with…, Ask for changes…, Stop, Move to…, Archive, Restore, Delete…, Add files | Same | Main | Done |
| The count on Tasks | The place and, in step 3, the Tasks tab | Main, S134 | Done; Planned (R6) |
| Add a Task… (palette) | Same | Main | Done |

## 9. Transcribe and dictation

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| Add recording, Record | The head's Transcribe a file… and Record | Main, S134 | Done; Planned (R16) |
| Engine choice, jobs, first-run set-up, model download | Same | Main | Done |
| Library and All projects; Open, Open saved document, Rename…, Remove transcript, Relink | Same, under "Recordings" | Main, S134 | Done; Planned (R16) |
| The gear | Opens Settings at the transcription card | Main, S134 | Done; its place under the head is Planned (R16) |
| The transcript workbench | A tab on the desk | Main | Done; a check |
| Voice dictation in documents (Mac and Windows) | The document's bar | Main | Done |

## 10. Browser

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| The Browser place, called "Recent" | "Browser", with the project's head and a Recent label | Main, S134 | Done; Planned (R16, R18) |
| New Browser Tab, Clear history | At the right of the Recent label; the + ▸ Web page | Main, S134 | Done; Planned (R18) |
| Recent pages: open, remove; "No recent URLs" | Same; "No pages yet" | Main, S134 | Done; Planned (R18) |
| The tab's bar: back, forward, reload, address, screenshot for the AI, developer tools | Same | Main | Done |
| Share with the agent; allow control | The same dialogs | Main | Done |

## 11. Ritemark Settings

Behaviour is the same on main; the page lies on white and follows a theme changed elsewhere.

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| How it opens: the AI panel's gear, the bar's gear | You ▸ Settings; ⌘, | Main | Done |
| Appearance: the theme cards | Same | Main | Done |
| Agent runtime: bundled or this computer's, what is active | Same; "This computer's tools" (Git, Node) | Main, S133 | Done; In flight |
| Claude account: install, repair, sign in with Claude.ai or an API key, sign out, status | Same | Main | Done |
| ChatGPT account: sign in, sign out, plan and credits; Codex approval and sandbox | Same | Main | Done |
| OpenCode: auto-approve | Same | Main | Done |
| API keys: OpenAI, Google AI, Anthropic, OpenRouter, ElevenLabs | Same | Main | Done |
| Google Docs: connect, reconnect, disconnect, template | Same | Main | Done; the production client is a check |
| Agent timeout; debug trace | Same | Main | Done |
| Chat font size | Same | Main | Done |
| Updates: check on start, Check now, Install or Download, Skip, Pause 7 days | Same | Main | Done |
| Component readiness: voice model, Claude, Codex; clear transcription data | Same | Main | Done |
| — | Usage data, with Privacy and Terms | S133 | In flight |

## 12. Updates, feedback and usage data

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| The update notice: install, skip, pause, relaunch | Same; v1.14.0 is offered 2.0.0 as a full release | Main, S136 | Done; Planned (Sprint 136, R1) |
| The update status bar item | Same | Main | Done |
| Send Feedback (All commands) | Same place; works only with usage data on | S133 | **Gap G3** |
| Usage data on by default, with a notice | Off until yes, on the welcome and in Settings | S133 | In flight (Jarmo, 17 and 18 October) |
| Report AI output | Status bar; AI information | Main | Done |

## 13. Keyboard

| What v1.14.0 does | Where in 2.0 | Step | Status |
|---|---|---|---|
| ⌘N new document; ⌘Z and ⇧⌘Z handled by the editor; ⌘B is bold in the editor, not the side bar toggle | Same | Main | Done |
| ⌘, opened VS Code's settings | Opens Ritemark Settings | Main | Done (Jarmo, 17 October); see G4 |
| — | ⌃` (Ctrl+`) a new terminal tab; ⌃⌘I (Ctrl+Alt+I) Copilot Chat as a tab | Main | New |
| — | ⌘T (Ctrl+T) New tab | S134 | Planned (R8) |

## 14. The user docs

`docs/user/` on main is the same as in v1.14.0 except `task-board.md`. These pages name places and words 2.0 changes. Sprint 136 rewrites them with the notes (G9; its R6).

| Page | What it says | 2.0 |
|---|---|---|
| `getting-started.md` | "Getting Started", Open Folder, the explorer's New File | The welcome; Documents; New; the + |
| `troubleshooting.md` | The welcome page's Git and Node lines; a link to `../guides/getting-started.md` | The welcome's step 2 and Settings; the link is broken |
| `features/README.md` | A link to `../guides/getting-started.md` | Broken |
| `setup-ai.md` | "Settings (gear icon)"; a Settings panel inside Flows | You ▸ Settings, ⌘,; no Flows panel |
| `features/ai-agents.md` | The model "dropdown at the top of the AI sidebar"; Opt Out; ⌘, for `ritemark.analytics.enabled` | The picker in the message box; usage data on the welcome and in Settings |
| `features/agent-library.md` | Collapsible sections, + per section, the empty state's buttons, Project/User, always-shown search and sort | The Agents place |
| `features/flows.md` | A Flows icon in the activity bar, a Flows panel, its gear | Agents ▸ Flows; New ▸ Flow |
| `features/transcribe.md` | "Activity Bar", "Folder view" | The places row; Documents |
| `features/task-board.md` | "the activity bar on the left"; "Task board on the Home tab" | The places row; Home changes in step 3 |
| `features/browser.md` | "Explorer"; no Browser place | Documents; the Browser place; + ▸ Web page |
| `features/spreadsheets.md` | "explorer" | Documents |
| `features/export.md`, `features/google-docs.md` | The Export menu, with a template choice it never had | Share (step 3) |
| `features/keyboard-shortcuts.md` | — | Add ⌘, (Ritemark Settings), ⌃` (a terminal tab), ⌃⌘I (Copilot Chat), ⌘T (New tab) |

Still right on main: dictation, comments, previews, editor, document properties (until step 3's bar), blocks, formatting, known issues and installation.

## Drawn but not planned for 2.0

These are not parity gaps: v1.14.0's functions stay reachable without them. They are redraws the Experience lead drew that no 2.0 plan takes yet. The Development manager decides with Jarmo whether 2.0 needs any of them.
- The Task board tab redrawn (experience 6: its bar, and the tasks that wait inside Doing on the board).
- Transcribe redrawn (experience 20: the recording's card at the foot of the left column, the transcript as a document, insights in the AI's sheet).
- The browser's share question asked on the AI's sheet (experience 28).
- The AI's empty state and the status bar's items ("the AI step" in Sprint 132's scope of 18 October).
- The indigo icon on the open tree row (a font icon theme).
- The command palette without VS Code's developer commands (experience 22).
- The Settings redesign (experience 15), with "Codex" and "Sign in with OpenAI" in plain words, and G4.
- The `{date}` chip in a flow's prompt.
