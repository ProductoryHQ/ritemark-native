# The startup contract: the frame draws once

**Status:** Proposed, 1 November 2026. It goes to Jarmo with Sprint 152's plan
([sprint-plan.md](../releases/v2.2.0/sprint-152-startup-contract/sprint-plan.md)). Nothing is built before he approves it.<br>
**Scope:** the shell (patches 002, 018 and 019, `branding/product.json`) and how the extension starts (`extensions/ritemark/`).<br>
**Evidence:** Sprint 145's research (`releases/v2.2.0/sprint-145-loose-ends/research/switch-timing.md`,
`first-start-terminal.md`, `log-lines.md`) and its `qa/` captures; the patches; VS Code 1.142's start-up code, read in the
main checkout's `vscode/`. Nothing was run for this proposal. In the inventory, *measured* means a Sprint 145 run showed
it, and *read* means it comes from the code and nobody has seen it yet.

## The problem

Ritemark 2.0's frame is drawn by the shell: the left column with the places and the project's head, the desk with its
tabs, the AI column on the right. Much of what goes into it comes from the extension, which starts later: 0.5–3 s on a
Mac, 9–20 s on a cold Windows start. So things arrive late and move what is already drawn. Sprint 145 fixed four of
these, each with its own wait or placeholder (#569's AI column and landing, #501's terminals, the head's 64 px jog, the
AI column's loading look). #624 is still open, and the inventory below finds more.

Jarmo agreed to the alternative on 1 November: a startup contract. The shell knows Ritemark's layout up front and draws
the final geometry at the first frame. The extension only fills in content.

## When things arrive

Four moments, on the workbench's own clock:

- **Frame one (F).** The layout is restored and laid out, and the parts splash goes (`code/didRemovePartsSplash`, at the
  main container's first layout). Everything VS Code itself knows is drawn.
- **Extensions read (R).** VS Code has scanned the extensions and handled their `package.json` contributions
  (`whenInstalledExtensionsRegistered()`, `code/didLoadExtensions`). From here the extension's view containers,
  commands, menus, configuration defaults and themes exist. The scan only **starts** after frame one:
  `nativeExtensionService.ts` (lines 137–142) waits for `LifecyclePhase.Ready`, then for the window to be idle, before
  it initializes, and the scanner starts there (`_doResolveExtensions`).
- **Ritemark started (A).** The extension's `activate()` has run. Its `activationEvents` include `*`, so it starts
  with every window.
- **Page drawn (P).** A webview has drawn its content: the AI view, Home's page, a place's view, a document.

| | Mac, dev build, a project switch (145, A3) | Windows, cold first start after an update (145, S45, profile A) | Windows, warm start (S45) |
| --- | --- | --- | --- |
| F | 2.15–2.5 s after the page starts (Home in front at 2283–2517 ms) | the window at 3.2 s | 0.9–1.0 s |
| R | about 0.2 s after F (the tree at 2.15 s, New and Search filled at 2.31 s) | **not measured** | not measured |
| A | 0.4–0.5 s after the editors restore | 13.7 s | 2.7–5.0 s |
| P | Home's page 3.6–4.9 s after the page starts | the welcome in front at 20.2 s | 1.7–6.5 s |

A dev build is slower than a release. R on a cold Windows start is the main unknown: if Defender's reading of new files
slows the scan as it slows the extension host, "until the extensions are read" can last seconds there. Sprint 152
measures it first (A2).

## Inventory: what is drawn at start that depends on the extension

| # | What | Comes from | Arrives | Today | Under this proposal |
| --- | --- | --- | --- | --- | --- |
| 1 | Column widths, which columns show | VS Code's layout state per workspace; the parts splash draws the last session's widths before the workbench exists (`partsSplash.ts`, `layoutInfo`) | F | Right in a project opened before; a new project takes 018's 256 and 400 | VS Code, unchanged |
| 2 | The AI column's box in a project window | 002 `layout.ts` restores `workbench.view.extension.ritemark-ai` with the layout | F | Fixed by 145 (#569). Before it, hidden until A, and Home laid out twice (*measured*) | The AI column's slot |
| 3 | The AI column's view | The extension's webview `ritemark.unifiedView` | P | The ground, the turning mark after 1 s, no progress bar (018, 145). Then the view's own in-between: the empty chat ("What shall we work on?", "Checking Claude…") for about a second before "Almost there!", or "Preparing Agent Chat… Loading the local model catalog and your last selection." (`AISidebar.tsx`'s not-ready card) (#624, *measured* in 145's `r9-switch-first-frames-*.png`) | The slot's fill rule; #624 in the extension |
| 4 | The places row's Ritemark places | VS Code's composite bar draws the pinned and placeholder places it stored (`paneCompositeBar.ts`, `workbench.activity.placeholderViewlets`) before the extensions are read; 002 orders them | F once a profile has run; R on a profile with nothing stored | Right after a profile's first window. A profile whose first window opens a folder directly would show Documents alone, then the other five at R (*read*) | The places' slots, from the manifest |
| 5 | The left column's place in a project opened for the first time | Documents is VS Code's default place (`explorerViewlet.ts`, `isDefault`), and 002 keeps it a place while its tree isn't registered; the extension moves a window that had no tab of its own to Home's place after A (`permanentTabs.ts:135`) | A | Documents' tree, then Home's projects list (*read*) | The left column's place: Home from F |
| 6 | A place's content | Documents: VS Code's tree. Home, Tasks, Browser, Agents, Transcribe: the extension's webview views | P | The ground until the view draws; no "Drag a view here to display." (018, 145) | The slot's fill rule |
| 7 | The head's rows (New, Search, …) | 018's `HEAD_PLACES` names each place's rows; their words and icons are the extension's commands, registered at R | R | Fixed by 145: an empty row keeps its room until R. Before it, the tree moved down 64 about 0.2 s after F (*measured*) | The head rows' slots |
| 8 | The project's mark and name | 018, from the workspace | F | Right | Shell, unchanged |
| 9 | The desk's front after a switch | 018's landing note puts Home in front as the editors restore | F | Fixed by 145 (#569). Before it, the document in front for about 0.5 s (*measured*) | The desk's front |
| 10 | Restored terminals | 019 moves them from the panel to the desk; onto an empty desk they wait for its first other editor | — | Fixed by 145 (#501). Before it, a terminal in front for up to 10.9 s on Windows (*measured*) | The desk's front |
| 11 | Home and the Task board in a project opened for the first time | The extension opens both after A (`permanentTabs.ts`). Until then the desk is empty, so 019 draws the empty desk's Text, Table and Web page tiles | A | Tiles, then two tabs and Home (*read*) | The desk's front: Home and the board from F |
| 12 | A restored tab's name, and its page | VS Code's serialized editor gives the name at F (a task card's since Sprint 142, #508); the page needs the extension | F, then P | The name is right; the page says "Loading..." until the extension answers (`project-check.mjs`'s own notes) | The slot's fill rule; a question for the Experience lead |
| 13 | A window with no folder: the welcome alone | The extension opens the welcome and closes both columns after A (`welcomeHost.ts:382–390`); 018 then hides the strips' controls, the tab row, the desk's paint and the status bar | A | Before A, VS Code's frame for an empty window. For a new profile upstream shows the AI column even there ("New users: Show auxiliary bar even in empty workspaces", `layout.ts`), so it shows and then closes (*read*). On a cold Windows start that can last 10 s or more | The welcome alone from F |
| 14 | The AI column after the person closed it | The layout restores it closed, then the extension calls `ritemark.unifiedView.focus` in every project window at A (`extension.ts:802`) and again 4 s later (`:378–382`) | A, A + 4 s | Opens again 0.5–14 s after F (*read*). Sprint 144 added the call when the layout itself started the column hidden; 145 fixed that cause | Sprint 152, decision 2 |
| 15 | Settings that shape the frame: the places row on top, tab sizes, no editor actions, no breadcrumbs, terminals as tabs, the themes | The extension's `configurationDefaults`, registered at R. VS Code keeps the last ones for the next start (`DefaultConfiguration`'s cached defaults) | F once a profile has run; R on a new profile | A new profile's first window draws VS Code's own defaults until R (*read*) | Also in product.json's `configurationDefaults`, which apply at F (patch 013) |
| 16 | Colours, file icons, product icons | The extension's themes, loaded at R. VS Code keeps the last ones (`colorThemeData`, the icon themes' stored data) | F once a profile has run | A new profile has the splash's ground (patch 001), then unknown until R | Measured only (A1) |
| 17 | Ritemark's status bar items (the AI's status, Send feedback, the word count, the update) | The extension, after A | A | Unknown whether the items beside them move | Measured only (A1); a question for the Experience lead |

### What VS Code already carries over

Most of the frame is right on a profile that has run before, because VS Code already keeps the last session in six
places: the parts splash's widths and colours, the layout state, the places row's placeholders, the theme and icon
themes, the extensions' configuration defaults, and each restored tab's name. The family of faults lives where
Ritemark's frame needs something VS Code doesn't keep, or where the start deliberately differs from the last session: a
new profile, a project opened for the first time, a switch that lands on Home, a window with no folder, and anything an
extension-tier release changes.

## Options

### (a) A static description of Ritemark's frame in the shell

- **(a1) A table the shell owns.** The shell already knows Ritemark's frame, in pieces: 002's `RITEMARK_PLACE_ORDERS`
  (`viewsExtensionPoint.ts`) and the hard-coded `workbench.view.extension.ritemark-ai` (`layout.ts`,
  `paneCompositePart.ts`), 018's `HEAD_PLACES` (`ritemarkProjectHead.ts`) and `WELCOME_VIEW_TYPE`
  (`ritemarkWelcomeAlone.ts`), 019's `RITEMARK_PERMANENT_VIEW_TYPES` (`editorGroupView.ts`). It is available at F, it
  doesn't depend on how slow the extension is, and it is reviewed as shell. Its cost: it repeats ids the extension's
  `package.json` also states, so it needs a check that the two agree.
- **(a2) The extension's `package.json` contributions.** Not available at frame one: VS Code starts scanning after F
  (above). Using them means waiting for R, which is what 145's jog fix does for the head's rows; that is a wait, not a
  contract. Reading the file sooner would need a new synchronous read in the renderer before the layout, and it would
  read the bundled copy while an extension-tier release runs the copy in the user's extensions folder. Rejected as the
  frame-one source. It stays the source of words and icons from R on, as today.

### (b) The last session's geometry restored at frame one

VS Code already does this for most of the frame (above). A Ritemark snapshot on top would fail exactly where the faults
are left:

- a new profile and a project opened for the first time have no snapshot;
- a switch that lands on Home is meant to differ from the last session;
- the first start after an update that changed the frame would draw the old frame and move once, at the start people
  watch most closely;
- it stores passing states, such as a narrow window that hid a column;
- it hides faults: QA judges the frame on fresh profiles ([the frame baseline](../frame-baseline/), "judge chrome on
  fresh profiles"), where no snapshot exists.

It would also be a new stored format to version. Rejected as a new store; VS Code's own stores stay.

### (c) One reserved-slot mechanism instead of four special cases

One rule for anything drawn before its content exists: a box at its final size, empty until filled, and one way for it
to go when nothing will fill it. It replaces four pieces of code with one, with one test and one loading look. Alone,
though, it doesn't say which slots exist at frame one. Slots named by the extension would exist only at R. It needs
(a1)'s table.

### Weighed

| | (a1) shell table | (a2) contributions | (b) snapshot | (c) slots alone | (a1) + (c) |
| --- | --- | --- | --- | --- | --- |
| Right at F | Yes | No: R at best | Only if a last session exists | No: slots known at R | Yes |
| New profile, new project | Yes | No | No | No | Yes |
| A switch onto Home | Yes, with 145's note | No | No: differs from the last session | No | Yes |
| Version skew | Needs a check | Follows the extension, so moves follow it too | Wrong once after every update | Follows the extension | Needs a check, which the release script runs |
| Upstream-merge cost | Small: data plus the consumers already patched | Small | A new store and its reader | Small | Small (below) |
| Loud when broken | Yes, with the release check | No | No: a stale snapshot looks right | Partly | Yes |
| Reversible | Yes | Yes | Leaves a stored format behind | Yes | Yes |

## Recommendation

**(a1) and (c) together: a frame manifest the shell owns, drawn through one slot mechanism.** VS Code's own stores stay
as they are, and no new snapshot is added. In three sentences: the shell holds one description of Ritemark's frame, the
places, the head's rows, the AI column, Home and the Task board, and draws it at its final geometry from the first
frame. The extension only fills what the shell reserved, and a slot it has nothing for goes once, at a known moment, and
says so in the log. An extension-tier release can change words, icons and content, never a slot, and the release script
refuses one that tries.

- **The manifest:** a `ritemarkFrame` block in `branding/product.json`, read through `product` (available at F, as patch
  013's `configurationDefaults` are). It names the places (id, order, and a title and icon for the placeholder), each
  place's head rows (command and menu ids, the label over the content), the AI column's container, the permanent tabs
  (Home, the Task board), the desk's front in a project window (Home), and the welcome's view type. It takes the place
  of the constants listed under (a1). `product.json` is shell-tier by path and plain JSON, so the release script and the
  extension's tests can read it. If the audit finds a consumer that can't read `product` where it needs it, the fallback
  is one TypeScript file created by 002, which 018 and 019 import.
- **The settings that shape the frame** (row 15) go into product.json's `configurationDefaults` too, with the values
  the extension has. The extension keeps its copies until every shell it can run on carries them, and a test keeps the
  two equal (*Version skew*).
- **The slot:** one small module in 018 (`ritemarkSlots.ts`). A slot is a named box the shell draws at its final size
  at F. It is **reserved** (the ground or the desk's sheet, no words), then **filled** by the extension's content, or
  **released** when the extension has nothing for it. Every consumer stays in the patch that owns its kind and reads
  the manifest and the slot.

## The contract

### What the shell promises at frame one

In a project window:

- the three columns at their final widths and visibility: the layout's, or 256 and 400 for a new project;
- the places row: Home, Documents, Tasks, Browser, Agents, Transcribe, then More, in that order, with their icons;
- the left column on its place: the last one, or Home's in a project opened for the first time, with the head's rows'
  room;
- the AI column holding Ritemark AI;
- the tab row with Home first and the Task board second, pinned. In front: Home after a switch and in a project opened
  for the first time, otherwise the tab that was in front. Never a restored terminal.

In a window with no folder that opens no file: the welcome alone, the ground with the traffic lights or Windows'
buttons.

Everywhere: the strips at 44, the desks, the AI's sheet, the status bar's box.

### What the extension may add later

- Content in a reserved slot: a view's page, a document's page, Home's page, the welcome's sheet.
- The words and icons of what the shell reserved (the head's rows, the places' names), drawn in place.
- Counts and badges, such as the Tasks count.
- Status bar items at the bar's right end, if the Experience lead agrees (question 7).
- Whatever a person asks for: a new tab, a chat, a column opened or closed with a click.

A view draws once. Until it knows its settled look it draws nothing, and the shell's ground and turning mark show. Then
it draws that look. It never shows an in-between screen that another replaces a moment later (#624).

### What may never move

- The columns' widths and visibility, the desk's box and the strips, from F until the person changes them.
- The places' order and number, and the number of rows in each place's head.
- What is in front on the desk, until the person acts.

So adding, removing or resizing a place, a head row, a column or a permanent tab is a shell release. That is already the
rule for the head ("An extension release can reword a row; a new row needs a shell release", layout-invariants.md); the
contract makes it the rule for the whole frame.

### The one allowed move: a slot released

When the extension that runs has nothing for a reserved slot (an older extension without a row's command, or Ritemark
failed to start), the slot goes:

- a slot that comes from a contribution (a head row, a place, the AI column's container) at R, as 145's rows already do;
- a slot that waits for content (the desk's front, the welcome alone) when Ritemark failed to start, or after 60 s,
  VS Code's own limit for the extension host to start, which 145's terminal wait already uses.

The shell logs each release once (`[ritemark] slot released: <name>`), so a test run sees it. It is never the normal
path: the release script stops an extension release that would cause one.

## Version skew

An extension-tier release replaces the extension without a shell release, so the extension a shell runs can be newer
than the one it was built with.

| Case | What happens |
| --- | --- |
| The same release | Every slot is filled. The normal case |
| A newer extension on an older shell | The shell draws its own manifest. Words, icons and content change freely. A slot the new extension adds would show at R or not at all (a new head row never shows, as today; a new place goes to More, 002's rule). The release script stops such a release first: a new check in `release-extension-preflight.sh` compares the extension's view containers, views, head-row commands and frame-shaping defaults with the manifest in `branding/product.json` at the shell-release tag it already uses (`--ref`), and refuses a release that adds, removes or renames one. Only a shell release passes it |
| An older extension on a newer shell | Doesn't normally happen: VS Code runs the bundled copy whenever its version is the same or newer than the user folder's copy (`extensionsUtil.ts`, `dedupExtensions`). Tolerated anyway: a slot it doesn't fill is released at R |
| A shell built without the block | The reader finds no slots and the shell draws as VS Code does, which would undo 145's fixes. So it is loud: `validate-build-output.sh` fails a build whose `product.json` lacks the block |
| A frame-shaping setting the extension changes | Its copy and product.json's must stay equal (a test in `npm test`). An extension release that changes one is stopped by the same preflight check |

## Upstream-merge cost

Today 002 has 88 hunks, 018 has 123 and 019 has 55 (`grep -c '^@@'`). Sprint 145's four fixes sit in hunks of four
upstream files (`layout.ts`, `paneCompositePart.ts`, `editorPart.ts`, `webviewViewPane.ts`) and in Ritemark's own files
(`ritemarkProjectHead.ts`, `ritemarkSwitchGuard.ts`, `ritemarkTerminalTabs.ts`).

- **New files cost nothing at an upstream merge.** The manifest's reader and the slot module are new files, and the
  data is in `product.json`.
- **Existing hunks change shape, not number:** `layout.ts`, `editorPart.ts`, `webviewViewPane.ts`.
- **New hunks:** the default place for a project opened for the first time (`layout.ts`, beside 145's), the places'
  placeholders when nothing is stored (`paneCompositeBar.ts`, which 018 already touches), and the welcome alone's
  columns at F (`layout.ts`, beside the empty-window rules). No upstream file is newly touched.
- **Budget:** at most three new hunks in upstream files across 002, 018 and 019. The sprint reports the counts before
  and after, and `check-patch-stacking.mjs` (pre-commit Check 14) keeps each hunk in the patch that owns its kind: the
  reader in 002 (placement), the slots' drawing in 018, the terminals in 019.

What it saves later: a place's order, a head row's command or a renamed command is a `product.json` line, not a patch
hunk. And when an upstream update changes how VS Code starts (when it scans, what it restores first), one check shows
it: the first-frame check below.

## How it is tested

- **The first-frame check.** `scripts/qa/project-check.mjs` gains `--first-frame`, built on `--measure`'s 50 ms
  sampling from the new window's first moment. At each sample it records the boxes of the columns, the desk, the places
  row's items, the head's rows and the tab row's first tabs, and what is in front. It passes when every box in the first
  laid-out sample equals its box once the window has settled (Ritemark started, its views drawn, then 2 s with no
  change), and what is in front never changes. It runs four starts: a new profile with no folder, a project opened for
  the first time, a switch, and a relaunch. Each start holds the extension host (`--inspect-brk-extensions`, 145's S47
  method) for 10 s and then lets it go, the Mac's stand-in for a cold Windows start. It must fail on `main` first where
  the inventory says something moves (rows 5, 11, 13), pass on the branch, and keep 145's starts passing.
- **Unit tests** in the patched tree: the reader (no block, unknown keys), the slot (reserved, filled, released at R and
  at 60 s), and 145's tests (`ritemarkTerminalTabs.test.ts`, `ritemarkSwitchGuard.test.ts`) asserting the same
  behaviour.
- **The settled frame doesn't change:** `frame-screenshots.mjs --compare docs/development/frame-baseline` gives the same
  pixels in every scene with every `JOINS` line ok, and `frame-geometry.mjs` gives the same numbers. The contract
  changes the first frames, not the settled one.
- **The release check:** the preflight run on a fixture whose head command is renamed fails.
- **Windows:** Gate 2 on 2.2's candidate: a cold first start after an install and after an update, with the "Ritemark on
  Windows" session's tab trace and the workbench's marks.

## What it replaces from Sprint 145

| Sprint 145's fix | Where | Under the contract |
| --- | --- | --- |
| The AI column restored with the layout (#569) | 002 `layout.ts`: the hard-coded id, and closing the column again when nothing registered | The AI column's slot, its id from the manifest; closing it again is the slot's release at R. Same behaviour |
| A switch lands on Home (#569) | 018 `ritemarkSwitchGuard.ts` (the note) and `editorPart.ts` | The note stays: only it carries the switch across the reload. What it decides becomes the desk's front rule, which now also covers a project opened for the first time (row 11) |
| Restored terminals wait (#501) | 019 `ritemarkTerminalTabs.ts`, `RITEMARK_RESTORED_TERMINALS_WAIT_MS` | The desk's front rule: nothing restored takes the front before the front slot is filled; its 60 s bound is the slot's release. Same behaviour |
| The head's rows keep their room (the jog) | 018 `ritemarkProjectHead.ts`, `extensionsRead` | The head rows' slots, their number from the manifest, released at R as now |
| The AI column's loading look | 018 `webviewViewPane.ts`, `ritemarkSurfaces.css` | The column slot's loading look. Whether the places' views get it too is the Experience lead's call (question 4) |

And the members Sprint 145 didn't reach: rows 3 (#624), 5, 11, 13, 14 and 15, and row 4 where it happens.

## Checked against the locked decisions and the layout invariants

- **VS Code as a submodule, changes as patches:** the code goes in 002, 018 and 019, the data in `branding/product.json`.
  No direct `vscode/` edit.
- **Layout invariants owned by 002, 018 and 019:** each piece goes in the patch that owns its kind (the manifest's
  reader is placement, 002; the slots' drawing is 018; the terminals and the tab row are 019). Every row of
  `layout-invariants.md` holds; the rows for Ritemark AI, the head's rows, the terminals and a switch that reloads are
  rewritten to name the manifest and the slot, and a new row states the contract.
- **"The head's words are the extension's, its places are the shell's"** (layout-invariants.md): the contract is this
  rule made general.
- **Release tiers:** frame changes stay shell-tier, and the preflight now proves it for the extension's side too.
- **Features on by default; never stub or remove:** nothing is removed. The frame-shaping defaults are copied into
  `product.json`, not moved. The extension's start-time focus call (row 14) changes only with Jarmo's answer.
- **The webview stays sandboxed:** #624 changes only what the AI view draws while it waits.
- **darwin-arm64 first:** the check runs on the Mac with a held extension host; Windows, where the waits are longest,
  is proved at Gate 2.
- **The architecture skill's questions:** it adds a contract across the extension and VS Code boundary, so
  `architecture.md` gets a section for it. No new dependency. It extends existing patterns (018's head, VS Code's own
  placeholders) rather than adding a parallel one. It is reversible: no stored format changes. It is loud when broken:
  the build check, the release check, the log line.

## Unknown, and how Sprint 152 finds out

- **When the extensions are read on a cold Windows start:** A2, the workbench's marks on an installed 2.1.0, by the
  "Ritemark on Windows" session.
- **Rows 4, 5, 11, 13, 14, 16 and 17 are read from the code, not seen:** A1 captures each start on `main`, with the
  extension host held.
- **Whether the shell can put Home's and the Task board's tabs on the desk before Ritemark starts,** for their
  serializers to bring back (both have one since 2.0: `projectsHost.ts:205`, `taskBoardHost.ts:304`), and what happens
  with no serializer: A3. The fallback is a plain desk with no tiles until Home opens.
- **#624's states:** A4 traces what the AI view draws from its load to its settled look, signed in and not, for each AI.

## Questions for the Experience lead

What each column shows at frame one, and while it waits, in each state. Sprint 152 draws nothing new before these are
answered.

1. **A new profile's first window** (no folder, before the welcome's sheet draws, up to 20 s on a cold PC): the ground
   alone, or the ground with the welcome's empty sheet at its final size? If the theme isn't loaded yet (A1 shows it),
   which colours?
2. **A project opened for the first time:** the left column on Home's place shows the ground until the projects list
   draws; the desk shows Home's and the Task board's tabs with a plain sheet under them, no tiles; the AI column as
   today. Is that right, or should the tabs wait until Home draws?
3. **A switch:** Home in front from the first frame and the AI column on the ground, as Sprint 145 left it. Under Home's
   tab, until Home's page draws: a plain sheet, or the turning mark after a second as in the AI column?
4. **A relaunch, the cold start:** the restored document's tab is in front with its name. Until its page draws: a plain
   sheet, VS Code's "Loading...", or the turning mark after a second? And the left column's places other than
   Documents (Home, Tasks, Browser, Agents, Transcribe): the ground, or the mark after a second?
5. **Not signed in:** the AI column stays ground with the mark until the view knows, then draws "Almost there!" once.
   When the view takes over from the shell, does it draw the same mark in the same place, so nothing jumps? If the check
   is slow, after how long and in which words does it say so (today "Still checking …")?
6. **The places row on a new profile:** all six places with their icons from the first frame, or all of them together
   once the extension is read?
7. **The status bar:** may Ritemark's items arrive after the extension starts, at the bar's right end, or should their
   room be kept?
8. **A row an older extension doesn't have:** may it go once the extensions are read (one move, rare), or stay as empty
   room until the next start?
9. **The AI column the person closed** (row 14): does it stay closed at the next start, or does Ritemark always bring
   the AI back beside the project? (Jarmo decides; the lead's view first.)
