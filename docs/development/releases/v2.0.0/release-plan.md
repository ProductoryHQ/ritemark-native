# Release Plan — v2.0.0

**Status:** **Proposed** (2026-10-17), not approved. No sprint has a plan yet, and every sprint plan needs Jarmo's approval before any code. The plan is built on [feasibility.md](feasibility.md)<br>
**Target:** v2.0.0<br>
**GitHub milestone:** none yet. The Development manager opens it once Jarmo approves this plan<br>
**Release type:** **Shell-tier.** A new VS Code patch in `patches/vscode/`, new theme and icon files that ship only with the app, and new defaults for every user. A full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-17<br>
**Source:** Jarmo's decision of 15 October 2026 (`ritemark-dev`: `product/design/experience/migration.md`): 2.0 is one new Ritemark that ships the welcome, the new theme with its surfaces and the project at the centre together, theme first, and patching VS Code is fine. The Experience lead's technical analysis and proof of concept (`product/design/experience/technical/README.md`) went to the Development manager with Jarmo's yes on 16 October, and this plan was written in a session Jarmo asked for on 17 October

## Release Thesis

Ritemark 2.0 is one new Ritemark, with three things together:

- **A calm frame**, in light and dark: a flat ground, the AI on its own sheet, and the document on a raised desk with its tabs at the top of the window.
- **A first window** that asks one question (which AI do you use) and lands the person on a project, with the AI ready beside it.
- **The project at the centre:** each project has its own Home and its tasks, and switching between projects happens in place.

## How 2.0 is built

- **On main, behind one internal switch.** That is the `ritemark-2` flag and its setting, off by default; the switch needs Jarmo's word. Each sprint merges into main switched off. The 1.x releases in between (v1.15.0 and on) carry it dark and must look and behave exactly as today. Why main and not a long-lived branch, and what the switch cannot hide: [feasibility.md §4](feasibility.md#4-building-20-on-main-behind-one-setting).
- **Theme first, and VS Code changes first.** Sprint 1 carries nearly all the VS Code (shell) changes 2.0 needs. Sprints 2 and 3 are then mostly extension code, which is cheaper to change and can be tried on Windows with the existing test overlay over a 1.x app that already has the patch.
- **Every 1.x shell release from Sprint 1 on** adds one row to its Gate 2 list: a screenshot comparison of the base window, light and dark, Mac and Windows, with the switch off.
- **Main freezes during each 1.x release** as usual; a sprint merge waits for the freeze to end.
- **Sprint numbers** are given when each sprint plan is written (132 is the next free number today). Each sprint is repo-scoped to `ritemark-native` and starts on its own `sprint-NN-short-name` branch after its plan is approved.
- **Nothing from the proof of concept merges as it is.** It is the starting point, measured in [feasibility.md §1](feasibility.md#1-the-proof-of-concept-measured), with what comes over and what does not in [§6](feasibility.md#6-what-comes-over-from-the-proof-of-concept-and-what-does-not).

## Sprints

| Step | Scope | Depends on | Status |
|---|---|---|---|
| 1 — Surfaces and frame, theme first | The switch; the real surfaces patch, folded with patch 002; the frame on the Mac and Windows; the AI column's contents; the tab row; the places row; the full light and dark theme pass; tests and a production build | Jarmo's decisions on the switch, the terminal, Copilot Chat, the Windows frame, More and the layout contract | **Not planned.** Plan needs Jarmo's approval |
| 2 — The welcome | The welcome as a Ritemark page; which AI you use, with each provider's sign-in; setting up a project; landing on it; the usage-data notice on the welcome; the four analytics events | Step 1 merged; Jarmo's decisions on the notice and on who sees the welcome | **Not planned** |
| 3 — The project at the centre | The project file and the project list (filled on the first 2.0 start); what waits in each project; Home as the project's page; Home and Tasks as permanent tabs; the projects list in the left column; the column's head; switching in place; the document's bar | Steps 1 and 2 merged | **Not planned** |
| 4 — 2.0 as one release | The switch removed; migration from 1.x profiles; Dark and Windows checked; a screenshot comparison of the base window in the release checklist; version 2.0.0, notes and the store listing | Steps 1–3 merged; Jarmo's decision on what the switch's removal removes | **Not planned** |

### Step 1 — Surfaces and frame, theme first

**Scope**

- **The switch.**
  - One flag in `src/features/flags.ts` with one application-scoped setting, off by default.
  - A small module in the patch that reads the same setting for the window's page and for the main process.
  - One contribution that registers 2.0's defaults only when the switch is on: the places row on top, breadcrumbs off, tab sizing and compact pinned tabs, `window.menuStyle`, the start-up editor, Home first in a new profile, `.ritemark` hidden in the tree, and the 2.0 themes.
  - A class on the workbench that scopes the stylesheet.
  - A check the extension uses to see that the shell has the patch.
  - Detail: [feasibility.md §4](feasibility.md#the-switch).
- **The real surfaces patch**, built from the proof of concept on main's pinned VS Code:
  - folded with patch 002 by the rule in [feasibility.md §2.2](feasibility.md#22-how-the-real-patch-folds), so that no hunk removes or uses as context a line another patch wrote, with that rule as a small harness check;
  - the proof-of-concept-only code dropped;
  - every upstream hunk behind the switch, with the 1.x value kept;
  - the editor's DOM walks replaced where VS Code gives the same information;
  - possibly split into two patches by domain (the surfaces and frame, and the tab row).
- **The frame on the Mac:**
  - no title row; each column's 44 strip, with its toggle; You, with Settings and Help;
  - the desk and the AI's sheet 8 apart and 8 above the status bar; two desks; hidden columns, whose controls move onto the desk's strip;
  - the traffic lights on the strip's centre line, also through zoom;
  - Ritemark's own menus.
- **The frame on Windows**, as Jarmo decides: the 44 title row kept, or no title row with the menu behind a button and the window controls over the AI's strip. It is seen on a Windows PC, either from a main build or from a branch build added to the harness, as decided.
- **The AI column's other contents**, as decided: the terminal (a desk tab, a switch in the AI's header, or the bottom panel) and Copilot Chat (patch 007's launcher and view). If the terminal becomes a tab, patch 002's three guards and the written invariant go, and Terminal joins the +'s menu.
- **The tab row:**
  - tabs at the top, joined to the desk, as wide as their names (120 to 200);
  - the + for a new tab;
  - the tabs used longest ago folding into "N ⌄";
  - the editor group's rule that keeps Home and Tasks first, pinned and open (ready for step 3; the Task board tab can use it from this step).
- **The places row:** Ritemark's places first (Home, Documents, Tasks, Browser, Agents, Transcribe), the others after them, what does not fit folding into the overflow, and a permanent More if Jarmo keeps it.
- **The left column's head:** its place and drawing in the shell, with its words and menu from the extension. Step 3 fills it.
- **The full theme pass, light and dark:**
  - 2.0's Ritemark Light and Ritemark Dark as their own theme ids, and the 2.0 product icons;
  - the dark file icons, and high contrast;
  - every surface drawn in the new theme: the Markdown editor, CSV, PDF and Office previews, Flows, Transcribe, the task board, the browser, the Agent Library, the Settings page, dialogs, notifications, the command palette and quick picks, menus.
- **Docs:**
  - `references/layout-invariants.md`: the changed and the new rules ([feasibility.md §2.4](feasibility.md#24-layout-invariants-that-change));
  - `architecture.md`: the locked decision on layout ownership and the switch;
  - `CLAUDE.md`'s patch table, and `PATCH-RULES.md`'s patch table brought up to date;
  - `update-vscode.sh`'s checklist, with the screenshot check.
- **Tests:**
  - VS Code unit tests for the editor group's rule;
  - extension unit tests for the switch and the capability check;
  - CDP geometry checks for the frame's numbers;
  - a screenshot comparison of the base window, light and dark, switch off and on.

**Depends on**

- Jarmo's decisions: the switch, the terminal, Copilot Chat, the Windows frame, More and the layout contract (see the end of this plan).
- The Experience lead's drawings for the surfaces not yet drawn (the Settings page, dialogs, notifications, the command palette, Flows, Transcribe, the previews, the browser, the Agent Library), for the Windows top, and for whatever stays in the AI column.
- No 1.x release freeze while it merges.

**Done when**

- **With the switch off**, a fresh profile and a profile from v1.14.0 look and behave as v1.14.0: the screenshot comparison passes, light and dark, on the Mac and on Windows. The extension's tests pass.
- **With the switch on, on the Mac**, the frame is as drawn, and the geometry checks prove its numbers. This holds in light, dark and high contrast, at 100% and zoomed, with one desk and two, and with each column shown and hidden. Keyboard and VoiceOver reach every control in the strips.
- **On Windows**, the chosen frame is seen working on a Windows PC, switch on and off.
- All patches apply on the pinned VS Code, the fold check passes, and a second run of `apply-patches.sh` is clean.
- **A production build** from a clean-room worktree at the merged main commit runs once with the switch off and once with it on. Production builds never run from a sprint worktree, so this check comes right after the merge.
- The docs listed above are updated.

### Step 2 — The welcome

**Scope**

- **The welcome as a Ritemark page** in the shared React bundle, behind the switch. It opens when the window has no folder, with the side columns closed for it. 1.x keeps patch 001's Getting Started page, unchanged. The start-up default that keeps Getting Started from opening comes with step 1's switched defaults.
- **"Which AI do you use, ChatGPT or Claude?"**
  - Each provider's own sign-in, reused: `agent/claudeLogin.ts`, `codex/codexAuth.ts`.
  - Each provider's state is shown as its check arrives (each check takes up to 5 s).
  - Under Other ways to connect, the Anthropic API key that Settings already has. An OpenAI key for ChatGPT exists nowhere today, so adding one is a decision.
- **Set up project:** a folder the person has, or a new folder that Ritemark creates with About this project in it.
- **Landing:** opening the folder reloads the window. The welcome writes where it is going, and after the reload Ritemark opens the documents and the AI, with the project in the AI's first message. In step 3 the landing also opens Home first.
- With the switch on, no terminal opens by itself at start (`extension.ts:598-608`).
- **The usage-data notice** is answered on the welcome sheet itself.
- **Four analytics events:** welcome shown, AI signed in, project opened, first message sent. They go through Ritemark's PostHog (`src/analytics/posthog.ts`), are anonymous, and respect the person's usage-data choice.

**Depends on**

- Step 1 merged: the frame, and the start-up defaults behind the switch.
- Jarmo's decisions: the notice on the welcome and what is counted before it is answered, whether people upgrading from 1.x see the welcome, and the OpenAI key.
- The Experience lead's drawings of the welcome's states (signed in, signed out, offline, checking).

**Done when**

- With the switch on, a fresh profile goes from the welcome to a project with the AI ready. This works with Claude and with ChatGPT, signed in and signed out, with an existing folder and a new one, and with the network off (the words say why).
- The four events reach PostHog with their properties, and none is sent when usage data is off.
- With the switch off, a fresh profile still opens on v1.14.0's Getting Started page.
- Windows is tried through the test overlay on a 1.x app that has step 1's patch.
- The step is extension-tier by path; anything it needs from the shell is already in step 1's patch.

### Step 3 — The project at the centre

**Scope**

- **The project file**, `.ritemark/project.json`: the name, mark, cover and the line about the project. It is written only when the person changes something; otherwise the folder's name and Ritemark's defaults are used. It travels with the folder, as the tasks do.
- **The project list**, in Ritemark's own storage:
  - added to whenever a folder opens;
  - filled on the first 2.0 start from VS Code's recent folders, every project that has chats and every task board, so nobody starts with an empty list;
  - this list replaces the proof of concept's use of an internal VS Code command.
- **What waits, in each project and across them:** chats that need the person (from the chat store) and tasks that wait (from each project's board).
- **Home as the project's page**, built in React with the UI components, with project names and card titles escaped. It redraws when the board's calls or the project's files change.
- **Home and Tasks as the first two tabs, permanent and pinned as icons** (`permanentTabs.ts` on step 1's rule). A fresh window opens on Home, and the Home place always brings Home's tab forward. Main's [#431](https://github.com/ProductoryHQ/ritemark-native/pull/431) already does this for Tasks.
- **The Tasks tab carries the waiting count**, the same number as the Tasks place.
- **On Home the left column holds the projects list.** With the switch off, 1.x keeps Home's launcher, and what the launcher does stays reachable from 2.0's Home.
- **The left column's head**, filled: the switcher menu, New and Search.
- **Switching in place:**
  - the reload stays (VS Code restarts the extension host when the folder changes, and its API offers no way around that);
  - the splash takes the ground's colour;
  - the next project opens on its Home and keeps its own tabs;
  - when the AI is working in the project being left, Ritemark says so before switching;
  - ⌥ click opens the project in a new window.
- **The document's own bar:** Saved, from the sync state the host already sends, and Share, which regroups today's Export menu.

**Depends on**

- Step 1 merged (the editor group's rule, the head's place, the tab row) and step 2 merged (the landing).
- Jarmo's decision on what fills the list on the first 2.0 start: it reads every project's chat store and task board on this computer.
- The Experience lead's drawings for an empty project, a missing folder and a project with no board.

**Done when**

- With the switch on, a project opened for the first time opens on its Home with its own Home and Tasks tabs. Coming back to a project brings back its tabs as they were. The list, the counts and Home agree with each project's board and chats.
- "Close all" leaves exactly Home and Tasks.
- A missing or moved folder is shown as such and is never silently dropped.
- With the switch off, 1.x's Home launcher and Tasks behave as in v1.14.0, also on a profile that ran with the switch on (feasibility.md §4, what 2.0 writes).
- Light, dark and Windows are checked.

### Step 4 — 2.0 as one release

**Scope**

- **The switch removed:** 2.0 becomes what everyone gets. By HARD RULE #1, Jarmo decides what goes with the switch: patch 001's Getting Started page, the separate Home launcher view, the 1.x themes (kept as themes people can still choose, or folded away), and whether the flag stays one release as a kill switch.
- **Migration from 1.x profiles:**
  - settings the person chose keep winning;
  - the places row moves to the top;
  - the project list fills on the first start;
  - a profile from v1.14.0 and one from the last 1.x release are tested.
- **Dark and Windows checked** on the signed builds.
- **The release checklist** (`TEST-CHECKLIST.md`, release skill) gains a permanent screenshot comparison of the base window.
- **Version 2.0.0** in all six version files; release notes and `CHANGELOG.md` (with `product-marketer`); the Microsoft Store listing and screenshots. Website and launch work go in a cross-repo release plan in `ritemark-dev/releases/` if Jarmo wants one.
- **The runtime review** that every release has: the bundled Claude Code, Codex and OpenCode against the latest, plus `check:anthropic-models`.

**Depends on**

- Steps 1–3 merged.
- Jarmo's decisions on what goes with the switch and on the welcome for people upgrading.

**Done when** v2.0.0 is published through the shell-tier gates below, the update feed is updated, and the release is closed out (release skill).

## Not in 2.0

- **The window-size rules:** the AI narrowing below 1400, and the columns coming over the desk below 1200 and 960. Coming over the desk is deep work in VS Code's `layout.ts`. 2.0 ships without these unless Jarmo decides otherwise.
- **Search across projects.** In 2.0, Search filters the projects list by name.
- **Switching projects without a reload.** It would mean rebuilding how VS Code runs extensions.
- **The terminal as a tab**, if Jarmo decides it is not needed for 2.0 and another home is found for it.

## Gates

- **Shell-tier:** a clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, and Windows CI (`release-manager`).
- `main` is frozen from the first release-candidate build until publish. The version bump is the last merge before the candidate.
- Every 1.x shell release while the switch exists: Gate 2 includes the base-window screenshot comparison with the switch off.

### Gate 2 checklist (first draft, completed by each sprint)

- A fresh profile on the Mac and on Windows: the welcome, a provider's sign-in, a new project, landing on Home with the AI ready.
- An upgrade from the last 1.x release with a lived-in profile (several projects, chats, task boards, a moved view, the person's own theme): the person's settings are kept, the project list is filled, and no project or chat is lost.
- Ritemark Light, Ritemark Dark and high contrast; zoomed in and out; one desk and two; each column shown and hidden.
- Many tabs: folding, "N ⌄", Close all leaving Home and Tasks.
- Switching projects with the AI working in the one being left.
- The terminal and Copilot Chat in their decided homes.
- Windows: the frame as decided, the menu by mouse and by Alt, the window controls, snapping.
- Every release: an authenticated Claude turn, a Codex turn and the OpenCode permission gate on x64 and Windows.

## Decisions for Jarmo

These come back to you through the Development manager. The first six are needed before Step 1's plan can be approved.

- **The switch.** Shall 2.0 be built on main behind one internal setting that stays off until 2.0 ships? It is an exception to "every feature is on by default", and it is what lets 1.x releases keep going while 2.0 is built.
- **The terminal.** Today it sits in the AI column, and 2.0's AI column has no row of icons to reach it. Should it become a tab on the desk (opened from the + like a document), stay beside the AI with its own switch in the AI's header, or move to a bottom panel?
- **Copilot Chat.** Its launcher is in the places row, and it opens in the AI column, which has the same problem. Where should it live in 2.0: as one of the agents inside the AI's sheet, as a tab, as a place with its own switch, or behind More or You?
- **Windows' top.**
  - Keep a 44 title row on Windows, so the menu bar and the window controls stay where Windows users expect them (but the top differs from the Mac's), or draw it without a title row like the Mac, with the menu behind a button?
  - And to try it: merge it switched off and build from main for each round, or add an unsigned Windows test build for branches to the release harness first?
- **More in the places row.** Since every place now stays in the row and only the overflow folds, do you still want a More (⋯) that is always there?
- **The layout contract.** Patch 002 owns the layout today, and `architecture.md` locks that. Do you approve that the new patch owns the sizes and drawing while 002 keeps the placement, with the new rules written down?
- **For the welcome (step 2).**
  - May the usage-data notice be answered on the welcome itself, and is anything counted before it is answered?
  - Do people upgrading from 1.x see the welcome once, or go straight to their project?
  - Should ChatGPT get an OpenAI API key option, which Ritemark has never offered?
- **For the project list (step 3).** May the first 2.0 start fill the list by reading every project's chats and task board on this computer?
- **For the release (step 4).** When the switch goes, may patch 001's Getting Started page, the separate Home launcher view and the 1.x look go with it, or should any of them stay (for example, the 1.x themes as a choice)?
- **Window sizes.** Is it fine that 2.0 ships without the rules for narrow windows?

## Design questions for the Experience lead

- What stays in the AI column besides the AI (the terminal or Copilot Chat, if they stay), and how the AI's header switches to them.
- The Windows top, in both forms.
- The theme pass for surfaces not yet drawn: the Settings page, dialogs, notifications, the command palette and quick picks, Flows, Transcribe, the PDF and Office previews, the browser, the Agent Library.
- What More holds, if it stays; high contrast; the welcome for people upgrading from 1.x; an empty project, a missing folder.
