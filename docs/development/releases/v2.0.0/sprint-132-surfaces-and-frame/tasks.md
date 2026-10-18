# Sprint 132 Tasks

Nothing here starts before Jarmo approves the sprint plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] `git checkout -b sprint-132-surfaces-and-frame` from `origin/main`; `git branch --show-current` shows it
- [x] VS Code at 1.117.0 (`10c8e557`) with patches 001–017 from reset + clean + apply (copy-on-write clone for the worktree)
- [x] Record patch 002's file list and count (31 files, 88 hunks) in `notes/002-before.md` (`PATCH-RULES.md` §8)
- [x] Drift baseline: the whole stack dry-applied on the newest VS Code release, results in `notes/drift.md` (E6)

## Phase 1: Audits first

- [x] `research/windows-frame-audit.md` (W3): compact `CustomMenubarControl` in a strip; Alt focus; WCO height and colours via `updateWindowControls`; `env(titlebar-area-*)` in the strips; drag regions and double-click; which menus remain on Windows
- [x] `research/zoom-audit.md` (W2, R3): CSS zoom against computed heights for the strips; the traffic lights at each zoom level; overlay webviews
- [x] `research/terminal-tabs-audit.md` (W7, R8): shell integration on zsh, bash and PowerShell (Mac and Windows); the bar without it; renaming new terminals and the names after a restart; how v1.14.0's persistent terminals revive
- [x] Confirm the webview editors' `viewType` prefix for Home and the Task board (W6, R9): `research/confirmations.md`
- [x] Confirm that the overflow keeps always-in-More items after the places that do not fit (W5, R5, R6): `research/confirmations.md`

## Phase 2: The patch rebuild and fold (W1, E1, E2)

- [x] 002: move the tab height (`editorTabsControl.ts`) and the row height (`explorerViewer.ts`) out, and the height lines of `explorerviewlet.css` and `applyRitemarkTopTabStyles` into 018's stylesheet
- [x] 002: remove the terminal guards from `terminalConfigurationService.ts` (+ its test), `terminalEditorSerializer.ts` and `terminalView.ts`; in `terminal.contribution.ts`, revert the location and `hideIfEmpty` lines but keep the removal of the Toggle Terminal shortcut and View-menu entry
- [x] 002: the 2.0 order in `viewsExtensionPoint.ts` and `compositeBar.ts` (once per profile, W12), with always-in-More items; the left toggle's `when` in `layoutActions.ts`
- [x] 002: header updated; file list and count diffed against `notes/002-before.md`
- [x] 007: the Copilot Chat launcher runs `workbench.action.chat.openInEditor`; `revealCopilotChatViewState` no longer moves the container into the auxiliary bar
- [x] 018 created file by file from the proof of concept (W1's list), with the drops in W1 left out
- [x] 019 created file by file from the proof of concept (W1's list)
- [x] `editorGroupView.ts`: the window's edges come from `findGroup({ direction })`, not from DOM walks
- [x] `scripts/check-patch-stacking.mjs` with the known pairs; pre-commit Check 14 runs it
- [x] `./scripts/apply-patches.sh --dry-run` counts read (not only the labels), a real apply from pristine, a second run clean; `compile-check-ts-native` green (2026-10-17, on a detached checkout of the pin: dry run 19 can apply / 0 conflicts; apply 19; second run 0 applied, 19 already there; source identical to the patch stack)

## Phase 3: The frame (W2, W3, W4)

- [x] `layoutService.ts`: no title row for the main window on the Mac and Windows; the strip constants in one module (R1, R2)
- [x] `ritemarkFrameStrip.ts`: strips, drag regions, controls by mouse, Enter and Space (R1)
- [x] `sidebarPart.ts`, `auxiliaryBarPart.ts`, `editorPart.ts`: content below the strips; the sheets and their gaps; hidden columns' controls on the desk's strip (R1)
- [x] `electron-browser/titlebarPart.ts`, `windowImpl.ts`: the traffic lights placed after Restored, Eventually, a full-screen exit and a zoom; sheets from 44; the macOS 26 sizes and their imports removed (R1)
- [x] Zoom per `research/zoom-audit.md` (R3)
- [x] `statusbarPart.ts` + CSS at 24; rows at 32; remote and problems out of the status bar (R1)
- [x] Windows: the menu button in the left strip, the window buttons over the AI's or the desk's strip, Ctrl words, per `research/windows-frame-audit.md` (R2)
- [x] The AI column: no title rows or icon row; the guard that moves any other container to the sidebar (R4)

## Phase 4: Places, tabs and terminals (W5, W6, W7)

- [x] `package.json`: `workbench.activityBar.location: "top"`; places 32 × 32 with radius 6 and inset 14 in the stylesheet; ⋯ opens Ritemark's menu (R5)
- [x] Copilot Chat in More, opening as a tab; nothing shown without it installed (R6)
- [x] `editorTabsControl.ts`, `multiEditorTabsControl.ts`: tab heights; widths 120–200; hover in the tab's shape; tooltips with the project path (R7)
- [x] `ritemarkNewTab.ts`: the + with Text, Table, Web page and Terminal (R7)
- [x] `ritemarkFoldedTabs.ts`: "N ⌄", its menu and "Close these N tabs"; folding per desk; menus closing on an outside click (R7)
- [x] `editorGroupView.ts`: the rule for pinned Home and Task board tabs (R9)
- [x] `package.json`: `terminal.integrated.defaultLocation: "editor"`, `workbench.editor.pinnedTabSizing: "compact"`, the tab sizing, `breadcrumbs.enabled: false` (R7, R8)
- [x] `ritemarkTerminalTabs.ts`: panel terminals moved to the desk; new terminals named "Terminal", "Terminal 2" (R8)
- [x] `ritemarkTerminalBar.ts` + its hook in `terminalEditor.ts`: Running and Stop (R8)
- [x] The working dot on a busy terminal's tab (R8)
- [x] `extension.ts`: the start-up terminal removed (R8)
- [x] `package.json`: Ctrl+` (⌃` on the Mac) opens a new terminal tab (R8, revised; S46)

## Phase 5: Head, You, menus and updating (W8, W9, W12)

- [x] `ritemarkProjectHead.ts` in `sidebarPart.ts`: the name, chevron, New, Search and Documents at the drawing's positions (R10)
- [x] `menusExtensionPoint.ts`: `ritemark/projectHead` and `ritemark/projectHead/new`; their items contributed from `package.json` (R10)
- [x] `package.json`: `files.exclude` for `**/.ritemark` (R10)
- [x] You: the outline circle; Settings and Help; ARIA as a menu button (R11)
- [x] `desktop.contribution.ts` (`window.menuStyle: custom`), `menu.ts`, `defaultStyles.ts`: Ritemark's menus; the macOS menu bar stays native (R12)
- [x] Updating from v1.14.0: the places order once; terminals, Copilot Chat and other views out of the AI column (R16)

## Phase 6: Merge 1, the frame

- [x] VS Code unit tests: `ritemarkPermanentTabs.test.ts`; the panel-to-desk terminal guard (E3)
- [x] Extension tests: the 2.0 defaults and the head's menus in `package.json` (E3)
- [x] `scripts/qa/frame-geometry.mjs` on a dev instance launched without focus; results in `qa/` (E3)
- [x] Docs: `references/layout-invariants.md`, `architecture.md` (the locked decision and a frame note), `CLAUDE.md`'s patch table and count, `PATCH-RULES.md`'s table (E4)
- [ ] Manual QA on the Mac: S1–S6, S12–S38, S44–S46; evidence in `qa-evidence.md`
- [x] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree
- [x] PR 1 opened; `qa-validator` review; Jarmo's "admin merge" (#443, merged 2026-10-17 as d781a0e1)
- [x] After the merge: a production build from a clean-room worktree at the merged commit (E5) (the Development manager, at d781a0e1: source verified, 19/19 patches on vanilla 1.117.0, both validations and provenance passed, the extension activates with no errors on a fresh profile)
- [x] After the merge: Windows round 1 from main: S7–S11, S28–S33, S37, S38 on a Windows PC; findings in `qa-evidence.md` (R2). Done 2026-10-18 by the Windows session: 11 of 13 pass, then S8 as reworded; S31 partial, S10 for Jarmo by hand
- [x] After the merge: drift check, results in the release plan's risk register (E6) (15 of 19 fail on 1.142.0, in 58 file patches)
- [ ] Release plan tracker updated

## Phase 7: The theme and window sizes (W10, W11)

- [x] Both themes: the ground, the AI's sheet, the desk; no lines between parts; no indigo tab line; `menu.*` keys (R13) (in merge 1, from the prototype, on Jarmo's instruction of 17 October; the surface-by-surface check below is still Phase 7)
- [x] The seven `ritemark.*` colours in `package.json`, with high-contrast values (R13) (in merge 1)
- [x] The product icon theme (50 icons) and the dark file icons (R13) (in merge 1: 65 icon mappings, from the prototype plus the head's menus)
- [x] `ritemarkSurfaces.css` cleaned: theme variables only; each remaining `!important` marked with why (R13). No colour is written in it; of 113 `!important`s, 98 stay, each naming on its line the rule it beats (VS Code's, an inline style, or its own), and 15 went where nothing competes in any state (checked against every loaded stylesheet and in the running app; computed styles identical before and after, frame geometry 44 pass)
- [x] Webviews: `index.css` and the AI sheet's components from `--vscode-ritemark-desk` (R13) (in merge 1, from the prototype)
- [x] Surface by surface against the drawings, both themes (W10's table) (R13). Step 1's scope as the Experience lead set it on 18 October: the page canvas, the file icons, one-line CSV rows, the palette, notifications and Transcribe in the frame's sheet, rows and type; S39 in `qa-evidence.md`
  - [x] The CSV grid is one area again (Jarmo's Mac pass on merge 1: "CSV looses the visual border around the 'area'"; the Experience lead's measurements, ritemark-dev 7f91d55): 16 in from the desk's sides, a hairline round it with radius 8; the formula bar a 32 field 12 under the document bar and the table 12 under it (24 without one); header 32 on the AI's colour; rows 32 with no vertical lines; row numbers 36, right-aligned; Add row inside the border; a short table never stretched; the chosen cell the soft indigo fill; the formula bar names a CSV cell "Row 2 · Item" (cut at 160) and an Excel cell "A3", beside the value's first line; its value field has no grip, grows while it has the keyboard to 5 lines (120) and then scrolls, and goes back to one line; an edit started there stays there (it lost the keyboard after one character before); a read-only .xls has no formula bar and starts 24 under the document bar; an .xlsx stays editable (the Experience lead corrected the drawings, ritemark-dev ebddab0) ([`qa/csv-grid-light.png`](qa/csv-grid-light.png), [`qa/csv-grid-dark.png`](qa/csv-grid-dark.png), [`qa/csv-formula-bar-grown.png`](qa/csv-formula-bar-grown.png), [`qa/xls-read-only.png`](qa/xls-read-only.png))
  - [x] Ritemark Settings lies on the desk's colour, white in Light (Jarmo's Mac pass on merge 1: "Ritemark settings screen must have white bg"; experiences/settings frame 2 draws it on the desk)
- [x] Modal dialogs, Flows and the Agent Library, when their drawings arrive (R13). Approved by the Experience lead in both themes on 18 October. Drawn in experience 31 (ritemark-dev 4be0be5, 17 October). Dialogs done: window.dialogStyle defaults to custom; the sheet, type and buttons as drawn; the terminal's close question in its words, also from the bar's Close; Ritemark Dark's 35 slate colours moved to the kit's dark tokens. The Agent Library done: the column's groups and rows, New and Search in the head, the agent's settings panel. Flows done: the desk bar, the palette, the nodes, the canvas and the right column as drawn; dark primaries in ink on the light indigo. Open with the Experience lead: the Note boxes on the Claude Code and Codex steps, and the {date} chip
  - The Agents place (the Experience lead, 17 October; Experience 31): the column's head is the project head (mark, name, chevron) as on every place but Home, with no "Agents" title row and no "6 skills · 1 flow" line; the search field becomes the Search row under New; Project / User become the This project / All projects switch; the six sections as column groups with muted counts and 32 rows; the view's remaining hard-coded light fills themed.
- [x] The contrast unit test (R13): `src/themeContrast.test.ts`, in `npm test`. It found the Light theme's muted ink #64748B at 4.34:1 on the ground; the Experience lead moved muted to #617187 (4.54 on the ground, ritemark-dev 10f2732), and the status bar takes body ink #475569, as drawn. The theme, the light file icons, the webviews' token and the fallbacks follow
- [x] `ritemarkWindowSizes.ts`: the 1400, 1200 and 960 crossings; a column the person opened left alone (R14). 018, loaded by `desktop.contribution.ts`; 5 unit tests in `ritemarkWindowSizes.test.ts`; S42 and S43 checked in the dev instance
- [x] The fixes from Windows round 1 (R2): a terminal tab's menu is the usual tab items plus Rename (no Move Terminal into Panel, Change Color, Change Icon or Size to Content Width; the Experience lead); no Run in the View menu; View → Copilot Chat and Ctrl+Alt+I open Copilot Chat as a tab, not in the panel; ritemark.app trusted; the terminal bar keeps the shell's name while a command runs. S8 reworded: Alt focuses the menu button, Enter or ↓ opens it (the Development manager)

## Phase 8: Merge 2, the theme and Windows, and closeout

- [ ] `scripts/qa/frame-screenshots.mjs`: the baseline set; Jarmo approves it (E3). Script and set done: 9 scenes in light and dark from a fresh profile, in `docs/development/frame-baseline/` with its sample project; `--compare` diffs inside the running instance (no image library) and writes a side-by-side page. Re-taken on 18 October after the theme pass on a clean fresh profile (the first set carried earlier tabs and the shell's prompt); a second run matches it to the pixel. Waiting for Jarmo's approval
- [x] `scripts/check-vscode-drift.sh`, and `update-vscode.sh`'s checklist with the screenshot check (E4, E6) (the drift script is in merge 1; the checklist's frame step, geometry and screenshots, is in merge 2)
- [x] Manual QA: S39–S43, S44 again, S45 again; evidence in `qa-evidence.md`
- [x] `./scripts/validate-qa.sh`; the pre-commit validator by hand (18 October, at 665f5ff2: both pass; the validator again before each later commit)
- [ ] PR 2 opened; `qa-validator` review; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree (E5); Windows round 2 from main: S7–S11 again, S39 and S42 on Windows
- [ ] After the merge: drift check (E6)
- [ ] Linked issues closed with evidence: [#276](https://github.com/ProductoryHQ/ritemark-native/issues/276), [#430](https://github.com/ProductoryHQ/ritemark-native/issues/430), [#199](https://github.com/ProductoryHQ/ritemark-native/issues/199)
- [x] `docs/CHANGELOG.md` and the v2.0.0 release notes draft (`docs/releases/v2.0.0/release-notes.md`, step 1; the changelog's 2.0.0 section stays Unreleased until 2.0 ships)
- [ ] Release plan: tracker, feature-complete checklist rows and risk register updated
- [x] `node ./scripts/worktree-hygiene.mjs --check` reported (cleaning is Jarmo's call). 18 October: 5 worktrees, none removable; `.worktrees/store-v1120` is BLOCKED by uncommitted changes, the rest are in use
