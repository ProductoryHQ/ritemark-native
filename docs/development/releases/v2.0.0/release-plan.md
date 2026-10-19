# Release Plan — v2.0.0

**Status:** **Proposed** (2026-10-17), with Jarmo's decisions of the same day built in. Step 1's sprint plan, [Sprint 132](sprint-132-surfaces-and-frame/sprint-plan.md), was approved by Jarmo on 2026-10-17; every sprint plan needs his approval before any code. The plan is built on [feasibility.md](feasibility.md)<br>
**Target:** v2.0.0<br>
**GitHub milestone:** none yet. The Development manager opens it, and can close the empty v1.15.0 milestone<br>
**Release type:** **Shell-tier.** A new VS Code patch in `patches/vscode/`, changes to patches 002 and 007, new theme and icon files that ship only with the app, and new defaults for every user. A full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-17<br>
**Source:** Jarmo's decision of 15 October 2026 (`ritemark-dev`: `product/design/experience/migration.md`): 2.0 is one new Ritemark that ships the welcome, the new theme with its surfaces and the project at the centre together, theme first, and patching VS Code is fine. The Experience lead's technical analysis and proof of concept (`product/design/experience/technical/README.md`) went to the Development manager with Jarmo's yes on 16 October. This plan was written in a session Jarmo asked for on 17 October, and Jarmo answered its questions the same day

## Release Thesis

Ritemark 2.0 is one new Ritemark, with three things together:

- **A calm frame**, in light and dark, on the Mac and on Windows alike: a flat ground, the AI on its own sheet, and the document on a raised desk with its tabs at the top of the window.
- **A first window** that asks one question (which AI do you use) and lands the person on a project, with the AI ready beside it.
- **The project at the centre:** each project has its own Home and its tasks, and switching between projects happens in place.

## How 2.0 is built

- **Main becomes 2.0, step by step, with no switch.** Jarmo, 17 October: "We will focus on 2.0 from now on." v1.14.0 is the last 1.x release. From the first 2.0 merge, no release is built from main until 2.0, neither shell nor extension, because an extension release ships the extension's code and `package.json` from main too. Why there is no switch, and what pausing 1.x costs: [feasibility.md §4](feasibility.md#4-building-20-on-main).
- **Main stays buildable and usable at every merge**, so each step can be tried in a dev build and in a Windows build from main.
- **Features stay** (HARD RULE #1). Whatever a 1.x surface does keeps a place in 2.0 when the surface is replaced: Home's launcher, the Getting Started page and its launch check, the terminal, Copilot Chat.
- **Theme first, and VS Code changes first.** Step 1 carries nearly all the VS Code (shell) changes 2.0 needs. Steps 2 and 3 are then mostly extension code, which is cheaper to change and can be tried on Windows with the existing test overlay.
- **While 1.x is paused:**
  - New models still reach v1.14.0 users through the model catalog feed, as long as the bundled runtimes can run them.
  - Runtime updates wait for 2.0.
  - An urgent fix for v1.14.0 would need an exception to the clean-room release rule. Jarmo decides if one is ever needed.
- **Sprint numbers** are given when each sprint plan is written (132 is the next free number today). Each sprint is repo-scoped to `ritemark-native` and starts on its own `sprint-NN-short-name` branch after its plan is approved.
- **Nothing from the proof of concept merges as it is.** It is the starting point, measured in [feasibility.md §1](feasibility.md#1-the-proof-of-concept-measured), with what comes over and what does not in [§6](feasibility.md#6-what-comes-over-from-the-proof-of-concept-and-what-does-not).

## Sprints

| Step | Scope | Depends on | Status |
|---|---|---|---|
| 1 — Surfaces and frame, theme first | The real surfaces patch, folded with patch 002; the frame without a title row on the Mac and on Windows; the terminal as a tab; Copilot Chat behind More; the tab row; the places row; the full light and dark theme pass; tests and a production build | The Experience lead's drawings (all in but modal dialogs, Flows and the Agent Library) | **Plan approved** 2026-10-17: [Sprint 132](sprint-132-surfaces-and-frame/sprint-plan.md) |
| 2 — The welcome | The welcome as a Ritemark page; which AI you use, with each provider's sign-in; setting up a project; landing on it; the usage-data choice on the welcome; the four analytics events; the welcome once for people updating from 1.x | Step 1 merged | **Plan drafted, awaiting approval** (2026-10-18): [Sprint 133](sprint-133-welcome/sprint-plan.md) |
| 3 — The project at the centre | The project file and the project list (filled on the first 2.0 start); what waits in each project; Home as the project's page; Home and Tasks as permanent tabs; the projects list in the left column; the column's head; switching in place; the document's bar | Steps 1 and 2 merged | **Plan drafted, awaiting approval** (2026-10-18): [Sprint 134](sprint-134-project-at-the-centre/sprint-plan.md) |
| Update — VS Code to the current release | One update of the pinned VS Code (1.117.0 today; 1.142.0 is out) to the release of that day: every patch rebased; the Node and Electron versions that come with it, the arm64 build environment, the native-module check and Windows CI; the screenshot baseline compared | Steps 1–3 merged | **Plan drafted, awaiting approval** 2026-10-18: [Sprint 135](sprint-135-vscode-update/sprint-plan.md) |
| 4 — 2.0 as one release | Updating from v1.14.0; Dark and Windows checked; a screenshot comparison of the base window in the release checklist; the runtime review; version 2.0.0, notes and the store listing | Steps 1–3 and the VS Code update merged | **Plan drafted, awaiting approval** (2026-10-18): [Sprint 136](sprint-136-release/sprint-plan.md) |

### Step 1 — Surfaces and frame, theme first

**Scope**

- **The real surfaces patch**, built from the proof of concept on main's pinned VS Code:
  - folded with patch 002 by the rule in [feasibility.md §2.2](feasibility.md#22-how-the-real-patch-folds): the new patch owns sizes and drawing, and 002 keeps what sits where (decided by engineering, Jarmo: "You decide");
  - no hunk removes or uses as context a line another patch wrote, with that rule as a small harness check;
  - the proof-of-concept-only code dropped;
  - the editor's DOM walks replaced where VS Code gives the same information;
  - possibly split into two patches by domain (the surfaces and frame, and the tab row).
- **The frame on the Mac:**
  - no title row; each column's 44 strip, with its toggle; You, with Settings and Help;
  - the desk and the AI's sheet 8 apart and 8 above the status bar; two desks; hidden columns, whose controls move onto the desk's strip;
  - the traffic lights on the strip's centre line, also through zoom;
  - Ritemark's own menus.
- **The frame on Windows, as close to the Mac as possible** (Jarmo: "try to mimic as much apple as possible"):
  - no title row;
  - the menu behind a button at the start of the left column's strip;
  - minimize, maximize and close at the right end of the AI's strip, or of the desk's strip when the AI is hidden;
  - each round built from main and tried on a Windows PC (decided by engineering: no separate unsigned branch builds).
- **The terminal is a tab** (Jarmo: "Terminal must be one type of tab"):
  - patch 002's three guards and the written invariant go, so the terminal opens as a tab on the desk, from the +;
  - terminals saved in the AI column come back as tabs;
  - no terminal opens by itself at start (`extension.ts:598-608`).
- **Copilot Chat goes behind More** (Jarmo). Chosen from More, it opens as a tab on the desk (engineering's choice), so the AI column holds only Ritemark's AI. Patch 007's launcher and its move of Copilot Chat into the AI column change.
- **The tab row:**
  - tabs at the top, joined to the desk, as wide as their names (120 to 200);
  - the +, for a Text, Table, Web page or Terminal tab;
  - the tabs used longest ago folding into "N ⌄";
  - the editor group's rule that keeps Home and Tasks first, pinned and open (ready for step 3; the Task board tab can use it from this step).
- **The places row:** Ritemark's places first (Home, Documents, Tasks, Browser, Agents, Transcribe), then the others. The ⋯ at the end holds the places that do not fit, and Copilot Chat (Jarmo: "we need it for activity bar icons that do not fit to visible area").
- **The left column's head:** its place and drawing in the shell, with its words and menu from the extension. Step 3 fills it.
- **Narrow windows:** below 1400 points the AI column narrows to 320, below 1200 the left column hides itself, and below 960 the AI does too. The columns sliding over the desk stay out of 2.0. This is Sprint 132's R14; Jarmo confirms it with that plan.
- **The full theme pass, light and dark:**
  - Ritemark Light and Ritemark Dark changed in place, with the 50 product icons, the dark file icons and high contrast;
  - every surface drawn in the new theme: the Markdown editor, CSV, PDF and Office previews, Flows, Transcribe, the task board, the browser, the Agent Library, the Settings page, dialogs, notifications, the command palette and quick picks, menus;
  - the new defaults (the places row on top, breadcrumbs off, tab sizing, `.ritemark` hidden in the tree, Ritemark's menus) in `package.json`, `product.json` and the patch.
- **Docs:**
  - `references/layout-invariants.md`: the changed and the new rules ([feasibility.md §2.4](feasibility.md#24-layout-invariants-that-change));
  - `architecture.md`: the locked decision on layout ownership;
  - `CLAUDE.md`'s patch table, and `PATCH-RULES.md`'s patch table brought up to date;
  - `update-vscode.sh`'s checklist, with the screenshot check.
- **Tests:**
  - VS Code unit tests for the editor group's rule;
  - CDP geometry checks for the frame's numbers;
  - a screenshot comparison of the base window, light and dark, as the baseline for the later steps and for VS Code updates;
  - a check that everything v1.14.0 can do is still reachable.

**Depends on**

- The Experience lead's drawings: the terminal as a tab, the Windows top (menu button and window controls), the ⋯ menu with Copilot Chat, and the surfaces not yet drawn (the Settings page, dialogs, notifications, the command palette, Flows, Transcribe, the previews, the browser, the Agent Library).
- Jarmo's yes or no on the narrow-window rule.
- Whether the VS Code pin moves to the current release before the new patch is built (engineering's call in this step's plan; see Risks and Blockers).

**Done when**

- **On the Mac**, the frame is as drawn, and the geometry checks prove its numbers. This holds in light, dark and high contrast, at 100% and zoomed, with one desk and two, and with each column shown and hidden. Keyboard and VoiceOver reach every control in the strips.
- **On Windows**, a build from main works on a Windows PC with the same frame. The menu works by mouse and by Alt; the window controls, dragging and snapping work.
- **The terminal** opens as a tab, restores as a tab after a restart, and never lands in the AI column. **Copilot Chat** opens from More as a tab.
- **Everything v1.14.0 can do is still reachable.**
- All patches apply on the pinned VS Code, the fold check passes, and a second run of `apply-patches.sh` is clean.
- **A production build** from a clean-room worktree at the merged main commit succeeds. It is a build check, not a release; production builds never run from a sprint worktree.
- The docs listed above are updated.

### Step 2 — The welcome

**Scope**

- **The welcome as a Ritemark page** in the shared React bundle. It opens when the window has no folder, with the side columns closed for it. It replaces patch 001's Getting Started page. The launch check's rows (patch 017) keep a place, on the welcome or in Settings, so nothing it reports is lost.
- **"Which AI do you use, ChatGPT or Claude?"**
  - Each provider's own sign-in, reused: `agent/claudeLogin.ts`, `codex/codexAuth.ts`.
  - Each provider's state is shown as its check arrives (each check takes up to 5 s).
  - Under Other ways to connect, the Anthropic API key that Settings already has.
  - Recommended: no OpenAI key for ChatGPT in 2.0, confirmed in this step's plan.
- **Set up project:** a folder the person has, a new folder that Ritemark creates, or the sample project, which Ritemark ships and copies into the person's Documents (Jarmo, 18 October). A new folder starts empty: About this project is one file, `AGENTS.md` with a `CLAUDE.md` that points to it (Jarmo, 18 October), and step 3's project menu offers it.
- **Landing:** opening the folder reloads the window. The welcome writes where it is going, and after the reload Ritemark opens the documents and the AI, with the project in the AI's first message. In step 3 the landing also opens Home first.
- **The usage-data choice is part of the welcome sheet**, and nothing is counted until the person says yes (Jarmo, 17 October). It replaces today's separate notice. Refined for people updating from 1.x (Jarmo, 18 October): an OK on 1.x's notice carries over as the yes, so the update sheet shows the switch on, and they can turn it off there; anyone who opted out or never answered starts off. 1.x stored only that its notice was closed, not which button closed it, so any notice closed without Opt Out counts as the OK (Jarmo, 18 October; [Sprint 133's technical plan](sprint-133-welcome/technical-plan.md), W1).
- **Four analytics events:** welcome shown, AI signed in, project opened, first message sent. They go through Ritemark's PostHog (`src/analytics/posthog.ts`), are anonymous, and are sent only after a yes.
- **People updating from 1.x see the welcome once** (Jarmo, 17 October). It shows them as already signed in; they confirm and pick a project.
- **A file's extension in muted ink** in the tree and on tabs (the body colour on the chosen tab and the open row), as the framework draws it. It needs VS Code's resource label to render the name and the extension apart, a patch, so it waits for this step (the Experience lead's review of Sprint 132, 17 October).

**Depends on**

- Step 1 merged.
- The Experience lead's drawings of the welcome's states: signed in, signed out, offline, checking, and updating from 1.x.

**Done when**

- A fresh profile goes from the welcome to a project with the AI ready. This works with Claude and with ChatGPT, signed in and signed out, with an existing folder and a new one, and with the network off (the words say why).
- A profile from v1.14.0 sees the welcome once, already signed in, and never again.
- The four events reach PostHog with their properties after a yes. None is sent before an answer or after a no.
- Windows is tried through the test overlay on a Windows build from main.

### Step 3 — The project at the centre

**Scope**

- **The project file**, `.ritemark/project.json`: the name, mark, cover and the line about the project. It is written only when the person changes something; otherwise the folder's name and Ritemark's defaults are used. It travels with the folder, as the tasks do.
- **The project list**, in Ritemark's own storage:
  - added to whenever a folder opens;
  - filled on the first 2.0 start from VS Code's recent folders, every project that has chats and every task board (decided by engineering: all of it is already on the computer, and nothing leaves it);
  - this list replaces the proof of concept's use of an internal VS Code command.
- **What waits, in each project and across them:** chats that need the person (from the chat store) and tasks that wait (from each project's board).
- **Home as the project's page**, built in React with the UI components, with project names and card titles escaped. It redraws when the board's calls or the project's files change. What Home's 1.x launcher does (a new document, a new AI conversation, recent work, the Task board) is on it.
- **Home and Tasks as the first two tabs, permanent and pinned as icons** (`permanentTabs.ts` on step 1's rule). A fresh window opens on Home, and the Home place always brings Home's tab forward. Main's [#431](https://github.com/ProductoryHQ/ritemark-native/pull/431) already does this for Tasks.
- **The Tasks tab carries the waiting count**, the same number as the Tasks place.
- **On Home the left column holds the projects list**, in place of the launcher view.
- **The left column's head**, filled: the switcher menu, About this project (Jarmo, 18 October: one file, `AGENTS.md`, opened or created from the menu), New and Search.
- **Switching in place:**
  - the reload stays (VS Code restarts the extension host when the folder changes, and its API offers no way around that);
  - the splash takes the ground's colour;
  - the next project opens on its Home and keeps its own tabs;
  - when the AI is working in the project being left, Ritemark says so before switching;
  - ⌥ click opens the project in a new window.
- **The document's own bar:** Saved, from the sync state the host already sends, and Share, which regroups today's Export menu.
- **What Sprint 132 handed over** (Sprint 134's plan, refreshed on 18 October): the project's head on Tasks, Browser and Transcribe; Tasks' and Browser's pages under it; Make an editable copy and Share on the PDF and Word bars; New tab and Share in the File menu.

**Depends on**

- Step 1 merged (the editor group's rule, the head's place, the tab row) and step 2 merged (the landing).
- The Experience lead's drawings for an empty project, a missing folder and a project with no board.

**Done when**

- A project opened for the first time opens on its Home with its own Home and Tasks tabs. Coming back to a project brings back its tabs as they were. The list, the counts and Home agree with each project's board and chats.
- "Close all" leaves exactly Home and Tasks.
- A missing or moved folder is shown as such and is never silently dropped.
- Everything Home's launcher did in v1.14.0 can be done from 2.0's Home.
- Light, dark and Windows are checked.

### Step 4 — 2.0 as one release

**Scope**

- **Updating from v1.14.0:**
  - settings the person chose keep winning;
  - the places row moves to the top, and terminals restore as tabs;
  - the welcome shows once;
  - the project list fills on the first start;
  - tested with a lived-in v1.14.0 profile.
- **Dark and Windows checked** on the signed builds.
- **The release checklist** (`TEST-CHECKLIST.md`, release skill) gains a permanent screenshot comparison of the base window.
- **The runtime review** that every release has: the bundled Claude Code, Codex and OpenCode against the latest, plus `check:anthropic-models`. This one covers the whole gap since v1.14.0.
- **Version 2.0.0** in all six version files; release notes and `CHANGELOG.md` (with `product-marketer`); the Microsoft Store listing and screenshots. Website and launch work go in a cross-repo release plan in `ritemark-dev/releases/` if Jarmo wants one.

**Depends on** steps 1–3 and the VS Code update merged.

**Plan:** [Sprint 136](sprint-136-release/sprint-plan.md), drafted on 18 October, awaiting Jarmo's approval.

**Done when** v2.0.0 is published through the shell-tier gates below, the update feed is updated, and the release is closed out (release skill).

## Issue Intake

Open issues on 2026-10-17 that 2.0 touches. With 1.x paused, any fix that merges into main before v2.0.0 ships in 2.0, so the milestone takes bugs as they are picked up, too.

| Issue | Decision | Step | Notes |
|---|---|---|---|
| [#276](https://github.com/ProductoryHQ/ritemark-native/issues/276) A new profile hides Ritemark AI behind the terminal and shows an empty CHAT side bar | Include | 1 | Solved by the terminal as a tab and Copilot Chat behind More: the AI column holds only Ritemark's AI |
| [#430](https://github.com/ProductoryHQ/ritemark-native/issues/430) A fresh profile opens an empty CHAT panel in the left side bar | Include | 1 | Same cause as #276 (Copilot Chat's view); proven on a fresh profile |
| [#199](https://github.com/ProductoryHQ/ritemark-native/issues/199) Tab row: a "New" button at the right edge | Include | 1 | The + at the right end of the tab row: Text, Table, Web page, Terminal |
| [#429](https://github.com/ProductoryHQ/ritemark-native/issues/429) The first launch sometimes opens a `.md` twice | Include | 2 | The welcome owns the first window; checked on a fresh profile |
| [#338](https://github.com/ProductoryHQ/ritemark-native/issues/338) Analytics: mark non-production runs | Include | 2 | The four welcome events must leave dev and test runs out |
| [#401](https://github.com/ProductoryHQ/ritemark-native/issues/401) Windows: the extension host is unresponsive for about 8 s after activation on a fresh profile | Decide in step 2's plan | 2 | It is the welcome's first impression on Windows |
| [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) Webview bundle size | Watch | 2, 3 | The welcome and Home join the shared bundle; measure the bundle before and after |
| [#139](https://github.com/ProductoryHQ/ritemark-native/issues/139) Native shell auto-update | Not in 2.0 | — | v1.14.0 users move to 2.0 through today's update flow |

## Sprint / Issue / PR Tracker

| Step | Planned branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| Plan and feasibility read | `claude/docs-v2-feasibility-plan-bf53c8` | [#435](https://github.com/ProductoryHQ/ritemark-native/pull/435) | — | **Merged 2026-10-17** as `9de4f267` | Pre-commit validator passed | n/a |
| 1 — Surfaces and frame: [Sprint 132](sprint-132-surfaces-and-frame/sprint-plan.md) | `sprint-132-surfaces-and-frame` | Plan: [#438](https://github.com/ProductoryHQ/ritemark-native/pull/438); merge 1 (the frame): [#443](https://github.com/ProductoryHQ/ritemark-native/pull/443); merge 2 (the theme, window sizes, the Windows fixes): [#447](https://github.com/ProductoryHQ/ritemark-native/pull/447); S44's older defects: [#450](https://github.com/ProductoryHQ/ritemark-native/pull/450); new Text and Table in the project: [#451](https://github.com/ProductoryHQ/ritemark-native/pull/451); the closeout | #276, #430, #199 (closed at merge 2) | Merge 1 **merged 2026-10-17** as `d781a0e1`; merge 2 **merged 2026-10-18** as `cb59f4cd`, #450 as `f492948b`, #451 as `de2b7d6b`; the closeout PR fixes Ctrl+Alt+I without Copilot Chat (Windows round 2) and records the rest. Jarmo approved the frame baseline ("baseline ok") and the Agents sections that do not collapse ("agents ok") | Mac QA in [qa-evidence.md](sprint-132-surfaces-and-frame/qa-evidence.md); the production build check (E5) passed at merge 1 and at merge 2 (`f492948b`); Windows round 1 done 2026-10-18 (11 of 13 pass, fixes on merge 2); Windows round 2 done 2026-10-18 at `f492948b` (all pass but Ctrl+Alt+I, fixed in the closeout; S39's screenshots wait for the Experience lead); Jarmo's own Mac pass still to do | Changelog at 2.0.0 |
| 2 — The welcome: [Sprint 133](sprint-133-welcome/sprint-plan.md) | `sprint-133-welcome` | Plan: [#446](https://github.com/ProductoryHQ/ritemark-native/pull/446) | #429, #338, #401 (decided in the plan) | Plan drafted 2026-10-18, awaiting Jarmo's approval; starts after Sprint 132 is merged | — | — |
| 3 — The project at the centre: [Sprint 134](sprint-134-project-at-the-centre/sprint-plan.md) | `sprint-134-project-at-the-centre` | Plan: [#446](https://github.com/ProductoryHQ/ritemark-native/pull/446) | — | Plan drafted 2026-10-18, awaiting Jarmo's approval; starts after Sprint 133 is merged | — | — |
| Update — VS Code: [Sprint 135](sprint-135-vscode-update/sprint-plan.md) | `sprint-135-vscode-update` | Plan: [#445](https://github.com/ProductoryHQ/ritemark-native/pull/445) | — | Plan drafted 2026-10-18, awaiting Jarmo's approval; starts after Steps 1–3 merge | — | — |
| 4 — 2.0 as one release: [Sprint 136](sprint-136-release/sprint-plan.md) | `sprint-136-release`, then the release worktree and the version bump | Plan: this docs PR | — | Plan drafted 2026-10-18, awaiting Jarmo's approval; starts after Steps 1–3 and Sprint 135 merge | — | — |

## Feature-Complete Checklist

- [ ] Steps 1, 2 and 3 merged, each with its issues closed or explicitly deferred with evidence.
- [ ] Everything v1.14.0 can do is reachable in 2.0, checked against a written list (including Home's launcher, the Getting Started launch check, the terminal and Copilot Chat). The list: [parity-v1.14.md](parity-v1.14.md).
- [ ] The base window matches the drawings on the Mac and on Windows, light and dark. Jarmo approves the screenshot baseline.
- [ ] An update from a lived-in v1.14.0 profile tested on the Mac and on Windows.
- [ ] The four analytics events verified, sent only after a yes and never from dev runs.
- [ ] Docs updated: `layout-invariants.md`, `architecture.md`, `CLAUDE.md`'s patch table, `PATCH-RULES.md`.
- [ ] Runtime review done for the gap since v1.14.0, and `check:anthropic-models` OK.
- [ ] Version 2.0.0 in all six version files; release notes and `CHANGELOG.md` cover everything merged since v1.14.0.
- [ ] Windows and macOS x64 CI green on `main` before the candidate is cut.
- [ ] No open blocker in the risk register below.

## Risks and Blockers

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| The frame without a title row has never run on Windows, and each Windows round needs a merge and a paid build | High | Plan a Windows round right after step 1's first merge, before the theme pass is finished | Open |
| The surfaces patch has never been built for production | High | A production build from a clean-room worktree right after step 1 merges | Open |
| VS Code moves on while 2.0 is built. It now ships weekly: the pin is 1.117.0, and 1.142.0 came out on 14 October. On 1.142.0, patches 001–017 fail in 46 file patches across 16 of the 17 patches, and the proof of concept's patch in 16 of its 33 files | Medium | Decided by engineering (Sprint 132's plan): the pin stays for steps 1–3, and one VS Code update sprint follows step 3. By then, 2.0 has removed part of what fails today (the Getting Started patches in step 2, 002's terminal guards in step 1). The drift is measured at each merge and recorded here. Phase 0 (patches 001–017): 13 of 17 patches fail on 1.142.0, in 46 file patches. Sprint 132 merge 1 (d781a0e1, patches 001–019): 15 of 19, in 58 file patches; 018 and 019 add 15, 002 sheds 3. Merge 2 (f492948b): 15 of 19, in 60 file patches; 018 adds 2 (`notificationsViewer.ts`, `desktop.contribution.ts`) ([drift notes](sprint-132-surfaces-and-frame/notes/drift.md)) | Open |
| No fixes reach v1.14.0 users until 2.0 | Medium | An urgent fix only by Jarmo's exception to the clean-room rule (a release worktree from the v1.14.0 tag); new models keep arriving through the catalog feed | Open |
| The bundled runtimes stay at their v1.14.0 versions; a new model may need a newer runtime | Medium | The catalog feed hides models the bundled runtime cannot run; step 4's runtime review | Open |
| Three surfaces are not drawn in the new theme yet: modal dialogs, Flows, the Agent Library | Low | The Experience lead draws them next. Sprint 132 does them last, in a third PR if needed | **Closed** 2026-10-18: drawn in experience 31 and built in Sprint 132's merge 2; the Experience lead approved all three in both themes |
| The stylesheet and the editor's DOM walks break visibly at a VS Code update, not at apply time | Medium | The screenshot comparison in `update-vscode.sh`'s checklist; VS Code's own layout information instead of DOM walks where it exists | Open |
| Habits and saved state move: terminals saved in the AI column, Copilot Chat out of the row | Low | Terminals restore as tabs; the update test covers both | Open |
| The webview bundle grows with the welcome and Home ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)) | Low | Measure in steps 2 and 3 | Open |

## Not in 2.0

- **The columns coming over the desk** in narrow windows (below 1200 and 960). This is deep work in VS Code's `layout.ts`.
- **Search across projects.** In 2.0, Search filters the projects list by name.
- **Switching projects without a reload.** It would mean rebuilding how VS Code runs extensions.

## Gates

- **Shell-tier:** a clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, and Windows CI (`release-manager`).
- No release from main between the first 2.0 merge and v2.0.0, unless Jarmo makes an exception for an urgent v1.14.0 fix.
- `main` is frozen from the first release-candidate build until publish. The version bump is the last merge before the candidate.

### Gate 2 checklist (first draft, completed by each sprint)

- **A fresh profile** on the Mac and on Windows: the welcome, a provider's sign-in, the usage-data choice, a new project and the sample project, landing on Home with the AI ready.
- **An update from v1.14.0** with a lived-in profile (several projects, chats, task boards, a terminal in the AI column, a moved view, the person's own theme):
  - the welcome shows once, with the usage-data switch as the person answered 1.x's notice;
  - the person's settings are kept;
  - the terminal comes back as a tab;
  - the project list is filled;
  - no project or chat is lost.
- **Looks:** Ritemark Light, Ritemark Dark and high contrast; zoomed in and out; one desk and two; each column shown and hidden.
- **Tabs:** many tabs folding into "N ⌄"; Close all leaving Home and Tasks; a terminal tab; Copilot Chat from More.
- **Switching projects** with the AI working in the one being left.
- **Windows:** the frame without a title row, the menu by mouse and by Alt, the window controls, dragging and snapping.
- **Every release:** an authenticated Claude turn, a Codex turn and the OpenCode permission gate on x64 and Windows.

## Decisions

**Jarmo, 17 October:**

- **Focus on 2.0, with no switch:** "We will focus on 2.0 from now on." 1.x releases pause and main becomes 2.0 step by step.
- **The terminal:** "Terminal must be one type of tab."
- **Windows:** "try to mimic as much apple as possible", so there is no title row on Windows either.
- **More:** "we need it for activity bar icons that do not fit to visible area."
- **Copilot Chat:** behind More.
- **Usage data:** the choice is on the welcome, and nothing is counted until yes.
- **Updating from 1.x:** the welcome shows once.

**Jarmo, 18 October (via the Experience lead's question form):**

- **About this project:** one file, `AGENTS.md`, which both Claude and Codex read, with a `CLAUDE.md` that only points to it, shown everywhere as "About this project". The project's menu opens it or offers to create it (step 3).
- **The sample project:** yes. Ritemark ships one, and the welcome offers "Try the sample project" (step 2).
- **Usage data for people updating from 1.x:** an OK on 1.x's notice carries over as a yes, shown on and changeable on the update sheet; anyone who opted out or never answered starts off (step 2). This refines the 17 October rule.

**Jarmo, 19 October ("all recommendations ok"):** step 3 ([Sprint 134](sprint-134-project-at-the-centre/sprint-plan.md)) adds the browser's share question on the AI's sheet (#455), the palette without VS Code's developer commands (#456), "ChatGPT, never Codex" in every visible string, Advanced settings (G4) and an agent's colour on its row (G5). The Task board and Transcribe redraws, the AI step, the indigo icon on the open row and tab, and the Flows {date} chip come after 2.0.

**Engineering, on Jarmo's "You decide":**

- **Patch ownership:** the new patch owns sizes and drawing, and patch 002 keeps what sits where.
- **Windows testing:** each Windows round is built from main, with no separate unsigned branch builds.
- **Copilot Chat:** chosen from More, it opens as a tab.
- **The VS Code pin:** it stays at 1.117.0 for steps 1–3, and one update sprint follows step 3 (Sprint 132's plan; Risks and Blockers).
- **The project list:** it fills on the first 2.0 start from recent folders, chats and task boards.

**Still open, with a recommendation**, for the step that needs them:

- **Narrow windows (step 1):** the simple part is in Sprint 132's plan (R14), and its approval confirms it.
- **A ChatGPT API key on the welcome (step 2):** leave it out of 2.0 and add it if people ask.
- **An urgent fix for v1.14.0 while 2.0 is built:** only if one is needed.
- **The Windows menu's last item (Sprint 132):** Exit, as drawn, unless Jarmo prefers Close window.

## Design questions for the Experience lead

- The terminal as a tab: its icon and name in the tab row, its place in the +'s menu, and how a running terminal looks.
- The Windows top without a title row: the menu button in the left strip, and the window controls at the right end of the AI's or the desk's strip.
- The ⋯ menu, with the places that do not fit and Copilot Chat.
- The welcome for someone updating from 1.x who is already signed in; the usage-data choice on the welcome sheet.
- The theme pass for surfaces not yet drawn: the Settings page, dialogs, notifications, the command palette and quick picks, Flows, Transcribe, the PDF and Office previews, the browser, the Agent Library.
- An empty project, a missing folder, a project with no board.
