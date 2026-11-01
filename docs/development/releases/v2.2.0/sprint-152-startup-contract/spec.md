# Sprint 152 Spec: The startup contract

## Purpose

Ritemark's frame is drawn by the shell, and much of what goes into it comes from the extension, which starts later: 0.5–3
s on a Mac, 9–20 s on a cold Windows start. Things arrive late and move what is already drawn. Sprint 145 fixed four of
them one at a time. This sprint puts one rule in their place, the startup contract
([the proposal](../../../analysis/2026-11-01-startup-contract.md)): the shell knows Ritemark's frame up front and draws
its final geometry at the first frame; the extension only fills in content. It moves Sprint 145's four fixes onto that
rule, closes the members of the family that are left (a project opened for the first time, a window with no folder,
#624's AI view), and adds a check that fails when anything in the frame moves after the first frame.

## Principles

- **Geometry is the shell's, content is the extension's.** Anything that takes room or decides what is in front is
  known to the shell at the first frame. The extension fills what the shell reserved.
- **One description, one mechanism.** The frame's description lives in one place (`ritemarkFrame` in
  `branding/product.json`), and everything drawn before its content exists uses one slot mechanism. No new special case.
- **No new snapshot.** VS Code's own stores (the layout, the parts splash, the places row's placeholders, the themes,
  the cached defaults) stay as they are.
- **Same behaviour where Sprint 145 already fixed it.** Moving a fix onto the contract changes its code, not what a
  person sees.
- **Shown first.** Every row of the proposal's inventory marked *read* is captured on `main` before its code changes
  (A1). Each requirement's check fails on `main` first (E1).
- **Loud when broken.** A build without the manifest fails, an extension release that changes a slot is refused, and a
  released slot is logged.
- **Drawings and words from the Experience lead** before the build of what they touch (the proposal's questions).

## The four starts

Every requirement is checked in the starts it touches, on the Mac with the extension host held for 10 s
(`--inspect-brk-extensions`, Sprint 145's S47 method) and then let go, and on Windows at Gate 2:

| Start | How it is made |
| --- | --- |
| **New profile** | A fresh `--user-data-dir`, no folder: the welcome's window |
| **New project** | Open Recent into a folder this profile has never opened |
| **Switch** | Open Recent into a project opened before, left on Home, then one left with a document (145's `--switch-to`) |
| **Relaunch** | Reload Window in a project with a document in front and a terminal on the desk, the extension host held again |

## Requirements

### R1: The shell draws Ritemark's frame from one description

As someone starting Ritemark, I want the frame in its final shape from its first frame, so nothing I see moves.

Acceptance criteria:
- **The manifest:** a `ritemarkFrame` block in `branding/product.json` names the places (id, order, a title and icon for
  the placeholder), each place's head rows (command and menu ids, the label over the content), the AI column's
  container, the permanent tabs (Home, the Task board), the desk's front in a project window (Home), and the welcome's
  view type. Unknown keys are ignored; a missing block reads as no slots.
- **The constants it replaces go:** 002's `RITEMARK_PLACE_ORDERS` and the hard-coded `workbench.view.extension.ritemark-ai`
  (`viewsExtensionPoint.ts`, `layout.ts`, `paneCompositePart.ts`), 018's `HEAD_PLACES` and `WELCOME_VIEW_TYPE`, 019's
  `RITEMARK_PERMANENT_VIEW_TYPES` read the manifest. One source; no copy left behind.
- **The slot:** one module (`ritemarkSlots.ts`, 018). A slot is reserved at the first frame at its final size (the ground
  or the desk's sheet, no words), filled by the extension, or released: a contribution's slot when the extensions are
  read, a content slot when Ritemark failed to start or after 60 s. Each release is logged once:
  `[ritemark] slot released: <name>`.
- **The settings that shape the frame** are in product.json's `configurationDefaults` with the extension's values:
  `workbench.activityBar.location`, `workbench.sideBar.location`, `workbench.editor.tabSizing` and its two widths,
  `workbench.editor.pinnedTabSizing`, `workbench.editor.editorActionsLocation`, `breadcrumbs.enabled`,
  `workbench.iconTheme`, `workbench.productIconTheme`, `workbench.panel.defaultLocation`,
  `terminal.integrated.defaultLocation`, `terminal.integrated.hideOnStartup`. A1 confirms the list; a key it adds or
  drops changes this line first. *A1 kept it:* `workbench.activityBar.location` moves a new profile's frame at
  +0.2 s; the others draw nothing at a new profile's first frame in A1's starts, but arrive at the same moment, so
  they stay. The extension keeps its copies (R7).
- **The settled frame doesn't change:** `frame-screenshots.mjs --compare docs/development/frame-baseline` gives the same
  pixels in every scene, every `JOINS` line ok, and `frame-geometry.mjs` the same numbers, before and after.

### R2: Sprint 145's four fixes run on the contract, with the same behaviour

As someone who already has Sprint 145's fixes, I want them to stay exactly as they are.

Acceptance criteria:
- **The AI column** (#569): in a project window it comes back with the layout as Ritemark AI, its id from the manifest;
  when nothing registers there once the extensions are read, it closes again (the slot's release).
- **A switch lands on Home** (#569): the switch guard's note stays as it is; what it decides is the desk's front rule
  (R3 uses the same rule).
- **Restored terminals** (#501): onto a desk whose front slot isn't filled yet they wait in the panel and open behind
  its first editor that isn't a terminal, or after 60 s (the slot's release). A terminal the person opens still opens in
  front, named as before.
- **The head's rows:** each place's rows keep their room from the first frame, their number from the manifest; a row
  whose command is missing once the extensions are read goes (released, logged).
- **The AI column's loading look:** no progress bar; the ground for its first second; then the turning mark at its
  centre, labelled "The AI is starting" for screen readers, until the view is resolved or fails.
- **Checked:** `project-check.mjs --switch-to <folder> --measure 10` passes 10 of 10 as after Sprint 145; the S47 traces
  (a held extension host, a terminal in the panel, a fresh folder) give the same order as in
  `sprint-145-loose-ends/research/first-start-terminal.md`; `ritemarkTerminalTabs.test.ts` and
  `ritemarkSwitchGuard.test.ts` assert the same behaviour, changed only where a constant moved.

### R3: A project opened for the first time lands on Home from its first frame

As someone opening a folder in Ritemark for the first time, I want Home to be there from the start, not the documents
tree and an empty desk that change a moment later.

What is known (*read*, not seen): Documents is VS Code's default place (`explorerViewlet.ts`), so the left column starts on the tree, and the
extension moves it to Home's place after it starts (`permanentTabs.ts:135`). The desk is empty until the extension opens
Home and the Task board, so 019 draws the empty desk's Text, Table and Web page tiles meanwhile.

Acceptance criteria:
- **Shown first:** A1 captures the new-project start on `main` with the extension host held: what the left column and
  the desk show, frame by frame.
- **The left column:** a project window with no stored place opens on Home's place from the first frame (the ground
  until the projects list draws). A project window with a stored place keeps it.
- **The desk:** Home's and the Task board's tabs are in the tab row from the first frame, pinned, Home in front, as A3
  decides (their serializers bring them back once Ritemark starts). If A3 shows that can't work, the fallback: the desk
  is a plain sheet with no tiles until Home opens, and the two tabs come together.
- No empty desk's tiles in a project window at start. A second desk the person splits keeps its tiles.
- **The extension's own check** (`permanentTabs.ts`) finds Home and the board already there and changes nothing.
- With the `task-board` flag off, Home stands alone, as today.

### R4: A window with no folder is the welcome alone from its first frame

As someone starting Ritemark for the first time, I want the welcome's calm ground from the first moment, not a frame
that changes after ten seconds on a slow PC.

What is known (*read*, not seen): the extension makes the welcome alone after it starts (`welcomeHost.ts:382–390`).
Before that the window is VS Code's empty-window frame, and on a new profile upstream shows the AI column even there
(`layout.ts`, "New users: Show auxiliary bar even in empty workspaces").

Acceptance criteria:
- **Shown first:** A1 captures the new-profile start on `main` with the extension host held.
- In a window with no folder that opens no file, both columns are closed and the workbench is the welcome alone from
  the first frame: the strips keep their boxes and drag regions, their controls, the tab row, the desk's paint and the
  status bar are hidden, the traffic lights or Windows' buttons stay. The welcome's sheet fills it when it opens.
- What the ground shows before the sheet is the Experience lead's (question 1).
- **Released** when another editor comes in front, when Ritemark failed to start, or after 60 s with no welcome: the
  window is then VS Code's empty window, as today before the welcome. Nothing is written to the person's settings.
- A window with no folder opened for files (`ritemark notes.md`, a file dropped on the Dock icon) is not the welcome
  alone.
- The update welcome in a project window (someone coming from 1.x) keeps today's path: the extension decides it, and
  R2's terminal rule covers its worst part.

### R5: The AI column draws once (#624)

As someone opening Ritemark, signed in or not, I want the AI column to draw once: the chat, or the sign-in.

What is known (*measured* in Sprint 145's first-frame captures, `qa/r9-switch-first-frames-*.png`): someone not signed in
sees the empty chat ("What shall we work on?", "Checking Claude…") for about a second before "Almost there!" replaces it.
A start can show "Preparing Agent Chat… Loading the local model catalog and your last selection." (`AISidebar.tsx`'s
not-ready card), which aren't Ritemark's words. The shell's side is done (Sprint 145); this is the extension's side.

A4 (`research/ai-view-start.md`) traced more: not signed in, the column shows "Loading...", the card, the empty chat
and the AI's own sign-in screen within about 1.5 s before "Almost there!", for each AI; on a held start, 0.33 s of bare
ground between the shell's mark and the view's first look.

Acceptance criteria (the Experience lead's answer 5, 1 November):
- **Traced first:** A4 records what the AI view draws from its load to its settled look, signed in and not, for Claude
  Code, Codex and OpenCode, and what tells it which look is the settled one.
- Until the view knows whether to draw the chat or the sign-in, its first frame is the shell's turning mark: the same
  size, colours and words for screen readers, centred in the same box, matched to the pixel, with no bare ground
  between the two marks.
- **The 1 s never starts again:** if the shell's mark was showing, the view's shows from its first frame; if not, it
  shows when 1 s has passed since the column's first frame. In PR 1 the host estimates that moment (the extension
  host's start for a view resolved as part of Ritemark's start, the resolve for a column opened later); PR 2's column
  slot hands over the shell's own (W5).
- Then it draws one look: the chat on its sheet, or "Almost there!" on the ground. No empty chat before the sign-in, and
  no sign-in before the chat.
- No "Loading...", "Preparing Agent Chat…" or "Loading the local model catalog…" on a normal start.
- **A slow check:** after 10 s of the view's own check, one line under the mark (13, `--r-ink-muted`, centred, at most
  280 wide, 12 under the mark) and a ghost Try again 12 under the line: "Still checking whether Claude is ready." (by the
  AI's own name), tooltip "Check again whether Claude is ready"; before the view has read which AI, "The AI is taking
  longer than usual to start.", tooltip "Start the AI again". Try again takes the line away, keeps the mark and starts
  the 10 s over. This replaces the 8 s card ("Agent Chat could not start") and the 15 s card ("Still checking Claude").
- **A start that fails** (`agent:bootstrap-error`) is a settled look of its own: "The AI couldn't start", one sentence on
  what to do, and Try again; its words go to the lead with the screenshots.
- Extension-tier: the webview and the host only, no new message type and no new field (A4: the statuses can't ride on
  the bootstrap, which is local by rule).

### R6: The start never opens a column the person closed (decision 2)

As someone who closed the AI column, I want it to stay as I left it, or come back from the first frame, never half a
minute later.

What is known (*seen* in A1, 5 of 5): the layout restores the column closed, then the extension calls
`ritemark.unifiedView.focus` in every project window when it starts (`extension.ts:802`) and again 4 s later
(`:378–382`), which opens it again (+11.0–11.2 s on a held start).

Decision 2 (the Development manager, on Jarmo's 2.2 delegation, after the Experience lead's answer 9): **it stays
closed.** Acceptance criteria:
- The extension's two start-time calls no longer open a column the layout restored closed. The AI's toggle opens it
  as before. What asks for the AI still opens it: the welcome's landing, a task's conversation, a chat from a
  notification.
- Only the person's own toggle counts as closing: a column the narrow window stepped aside (below 960) comes back once
  the window is wide enough, at the next start too, and is never stored as the person's choice (patch 018's window
  sizes already keep that apart).
- A1 shows it first; the first-frame check's `relaunch --ai-closed` start passes with the column closed at quit.

### R7: An older or newer extension can't move the frame, and a mismatch is loud

As the team, I want an extension-tier release to be unable to break the frame, and to hear about it before it ships.

Acceptance criteria:
- **The release check:** `release-extension-preflight.sh` gains a check that compares every identifier the manifest
  holds with the extension's own source of truth: the view containers and their views and the head rows' commands
  (`package.json`), the head's menu IDs, the permanent tabs' and the desk front's view types (`HOME_TAB_VIEW_TYPE`,
  `BOARD_TAB_VIEW_TYPE` in `src/views/permanentTabs.ts`), the welcome's view type (`WELCOME_VIEW_TYPE` in
  `src/welcome/welcomePanel.ts`), and the frame-shaping defaults (R1), against the manifest in `branding/product.json`
  at its `--ref` (the shell-release tag it already uses). The identifiers that live in code are exported from one
  extension module that the check reads, so none is copied by hand. A release that adds, removes or renames one is
  refused, with the names; `--allow-unshipped` doesn't pass it. Proved on fixtures with a renamed head command and a
  renamed permanent-tab view type. (Codex's review of #626.)
- **The defaults stay equal:** a test in the extension's `npm test` fails when one of R1's frame-shaping keys in
  `package.json` differs from `branding/product.json`'s.
- **A build without the manifest fails:** `validate-build-output.sh` checks the built app's `product.json` for the
  block.
- **An older extension:** a slot it doesn't fill is released at the moment R1 names, and logged. A unit test covers a
  missing row command and a missing container.
- **No manifest:** the reader returns no slots and logs once; a unit test covers it.

### R8: A check that fails when the frame moves after its first frame

As the team, I want one check that sees any member of this family, now and after every VS Code update.

Acceptance criteria:
- `scripts/qa/project-check.mjs --first-frame` samples every 50 ms from the new window's first moment (as `--measure`
  does) the boxes of the left column, the desk, the AI column, the status bar, VS Code's side places bar, the places
  row's items, the head's rows and the tab row's first tabs, and what is in front (the desk's tab, the left column's
  place). **PASS** when every box in the first laid-out sample (after `code/didRemovePartsSplash`) equals its box once
  the window has settled (Ritemark started at least 5 s before, so its start's late moves are inside the run, such as
  the AI column's second call 4 s after activation in builds before R6, then 2 s with no change), and what is in front
  never changed. A box is the
  room an element takes, so a hidden row keeping its room keeps its box. Content inside a box may change. The exit code
  is the number of failures, as today.
- It runs the four starts with the extension host held and let go, and prints, per start, each box that moved, by how
  much and when. A fifth, `relaunch --ai-closed`, is R6's.
- **Fails first:** on `main`, in the starts A1 shows a move: all of them (`research/first-frames.md`, *The failing
  set*: new profile, new project, switch and relaunch, the last two because a stored Ritemark place shows only when the
  extensions are read and a restored terminal tab is nameless for 2.3 s); passes on PR 2's branch; 145's own checks
  pass on both.
- Five runs of each start agree before the check gates anything (a hidden window's timing).
- It is named in Gate 1's frame step (the `release` skill) beside `frame-screenshots.mjs` and `frame-geometry.mjs`, and
  in layout-invariants.md's *When patching layout*.

### R9: The places row on a new profile (cut first)

As someone whose first Ritemark window opens a folder (Open with Ritemark on a new install), I want all six places from
the start.

Acceptance criteria:
- **Shown first** (A1): a new profile's first window opened on a folder draws Documents alone, then the other five
  places once the extensions are read. If A1 doesn't show it, R9 is dropped and the reason recorded. *A1 showed it, 2
  of 2*: VS Code's side bar with Documents at the first frame, Ritemark's seven places on top at +0.3 s, with the AI
  column arriving at the same moment. R9 stays.
- When VS Code has stored no places, the composite bar draws Ritemark's six from the manifest's placeholders (title and
  icon), in order, from the first frame; the extension's registration replaces them in place.

## Engineering requirements

### E1: Each fix has its check, and it fails first

Each requirement's check fails on `main` at the commit the branch starts from and passes on the branch: a unit test where
the cause is in code, the first-frame check where it is in the running app. R2's checks pass on both (same behaviour),
which is what they prove. The evidence goes in `qa-evidence.md`.

### E2: Upstream-merge cost

At most three new hunks in upstream files across 002, 018 and 019, and no upstream file newly touched. The hunk counts
before and after (`grep -c '^@@'`: 002 88, 018 123, 019 55 on `6d082c96`) and `check-patch-stacking.mjs` (pre-commit
Check 14) go in `qa-evidence.md`. A design that needs more stops for a decision.

### E3: Tier

Shell, by `patches/vscode/002-ritemark-ui-layout.patch`, `018-ritemark-surfaces.patch`, `019-ritemark-tab-row.patch`,
`branding/product.json` and `scripts/validate-build-output.sh`. R5, R6 and R8 are extension-tier (`webview/src/`,
`src/`, `scripts/qa/`, `.claude/skills/`). The tier line in the sprint plan changes first if an audit moves a fix.

### E4: Bundle

`media/webview.js` is measured before and after R5 (`notes/bundle.md`).

### E5: Docs

`docs/development/architecture.md` gains *The startup contract* under *The 2.0 frame*. layout-invariants.md gains the
contract's row and rewrites the rows for Ritemark AI, the head's rows, the terminals, a switch that reloads and the
welcome alone to name the manifest and the slot. The patch headers, `docs/development/vscode-patches.md` and `CLAUDE.md`'s
patch table say what 002, 018 and 019 now do. `docs/CHANGELOG.md`. A release-notes line in plain words, through the
`release-notes` skill.

## Non-Requirements

- A Ritemark snapshot of the last session's frame (the proposal's option b).
- A new profile's colours before the theme loads (inventory row 16) and the status bar's items (row 17): measured in A1,
  filed for 2.3 if seen, unless the Experience lead asks for them here.
- How fast any page draws: Home's page, a place's view, a document. The contract decides what the frame shows while they
  load, not their speed.
- The welcome's own steps and words; Settings' start (#593, Sprint 147).
- Any change to what a settled frame looks like.

## Decisions

Three for Jarmo, in the [sprint plan](sprint-plan.md#decisions-for-jarmo): the contract's rule for extension releases;
whether the AI column the person closed stays closed (R6); the sprint's place in 2.2 and in the appetite's cut order.

Open for the Experience lead: the proposal's nine questions
([the proposal](../../../analysis/2026-11-01-startup-contract.md#questions-for-the-experience-lead)).
