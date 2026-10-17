# Sprint 132 Tasks

Nothing here starts before Jarmo approves the sprint plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] `git checkout -b sprint-132-surfaces-and-frame` from `origin/main`; `git branch --show-current` shows it
- [x] VS Code at 1.117.0 (`10c8e557`) with patches 001–017 from reset + clean + apply (copy-on-write clone for the worktree)
- [x] Record patch 002's file list and count (31 files, 88 hunks) in `notes/002-before.md` (`PATCH-RULES.md` §8)
- [x] Drift baseline: the whole stack dry-applied on the newest VS Code release, results in `notes/drift.md` (E6)

## Phase 1: Audits first

- [ ] `research/windows-frame-audit.md` (W3): compact `CustomMenubarControl` in a strip; Alt focus; WCO height and colours via `updateWindowControls`; `env(titlebar-area-*)` in the strips; drag regions and double-click; which menus remain on Windows
- [ ] `research/zoom-audit.md` (W2, R3): CSS zoom against computed heights for the strips; the traffic lights at each zoom level; overlay webviews
- [ ] `research/terminal-tabs-audit.md` (W7, R8): shell integration on zsh, bash and PowerShell (Mac and Windows); the bar without it; renaming new terminals and the names after a restart; how v1.14.0's persistent terminals revive
- [ ] Confirm the webview editors' `viewType` prefix for Home and the Task board (W6, R9)
- [ ] Confirm that the overflow keeps always-in-More items after the places that do not fit (W5, R5, R6)

## Phase 2: The patch rebuild and fold (W1, E1, E2)

- [ ] 002: move the tab height (`editorTabsControl.ts`) and the row height (`explorerViewer.ts`) out, and the height lines of `explorerviewlet.css` and `applyRitemarkTopTabStyles` into 018's stylesheet
- [ ] 002: remove the terminal guards from `terminalConfigurationService.ts` (+ its test), `terminalEditorSerializer.ts` and `terminalView.ts`; in `terminal.contribution.ts`, revert the location and `hideIfEmpty` lines but keep the removal of the Toggle Terminal shortcut and View-menu entry
- [ ] 002: the 2.0 order in `viewsExtensionPoint.ts` and `compositeBar.ts` (once per profile, W12), with always-in-More items; the left toggle's `when` in `layoutActions.ts`
- [ ] 002: header updated; file list and count diffed against `notes/002-before.md`
- [ ] 007: the Copilot Chat launcher runs `workbench.action.chat.openInEditor`; `revealCopilotChatViewState` no longer moves the container into the auxiliary bar
- [ ] 018 created file by file from the proof of concept (W1's list), with the drops in W1 left out
- [ ] 019 created file by file from the proof of concept (W1's list)
- [ ] `editorGroupView.ts`: the window's edges come from `findGroup({ direction })`, not from DOM walks
- [ ] `scripts/check-patch-stacking.mjs` with the known pairs; pre-commit Check 14 runs it
- [ ] `./scripts/apply-patches.sh --dry-run` counts read (not only the labels), a real apply from pristine, a second run clean; `compile-check-ts-native` green

## Phase 3: The frame (W2, W3, W4)

- [ ] `layoutService.ts`: no title row for the main window on the Mac and Windows; the strip constants in one module (R1, R2)
- [ ] `ritemarkFrameStrip.ts`: strips, drag regions, controls by mouse, Enter and Space (R1)
- [ ] `sidebarPart.ts`, `auxiliaryBarPart.ts`, `editorPart.ts`: content below the strips; the sheets and their gaps; hidden columns' controls on the desk's strip (R1)
- [ ] `electron-browser/titlebarPart.ts`, `windowImpl.ts`: the traffic lights placed after Restored, Eventually, a full-screen exit and a zoom; sheets from 44; the macOS 26 sizes and their imports removed (R1)
- [ ] Zoom per `research/zoom-audit.md` (R3)
- [ ] `statusbarPart.ts` + CSS at 24; rows at 32; remote and problems out of the status bar (R1)
- [ ] Windows: the menu button in the left strip, the window buttons over the AI's or the desk's strip, Ctrl words, per `research/windows-frame-audit.md` (R2)
- [ ] The AI column: no title rows or icon row; the guard that moves any other container to the sidebar (R4)

## Phase 4: Places, tabs and terminals (W5, W6, W7)

- [ ] `package.json`: `workbench.activityBar.location: "top"`; places 32 × 32 with radius 6 and inset 14 in the stylesheet; ⋯ opens Ritemark's menu (R5)
- [ ] Copilot Chat in More, opening as a tab; nothing shown without it installed (R6)
- [ ] `editorTabsControl.ts`, `multiEditorTabsControl.ts`: tab heights; widths 120–200; hover in the tab's shape; tooltips with the project path (R7)
- [ ] `ritemarkNewTab.ts`: the + with Text, Table, Web page and Terminal (R7)
- [ ] `ritemarkFoldedTabs.ts`: "N ⌄", its menu and "Close these N tabs"; folding per desk; menus closing on an outside click (R7)
- [ ] `editorGroupView.ts`: the rule for pinned Home and Task board tabs (R9)
- [ ] `package.json`: `terminal.integrated.defaultLocation: "editor"`, `workbench.editor.pinnedTabSizing: "compact"`, the tab sizing, `breadcrumbs.enabled: false` (R7, R8)
- [ ] `ritemarkTerminalTabs.ts`: panel terminals moved to the desk; new terminals named "Terminal", "Terminal 2" (R8)
- [ ] `ritemarkTerminalBar.ts` + its hook in `terminalEditor.ts`: Running and Stop (R8)
- [ ] The working dot on a busy terminal's tab (R8)
- [ ] `extension.ts`: the start-up terminal removed (R8)
- [ ] `package.json`: Ctrl+` (⌃` on the Mac) opens a new terminal tab (R8, revised; S46)

## Phase 5: Head, You, menus and updating (W8, W9, W12)

- [ ] `ritemarkProjectHead.ts` in `sidebarPart.ts`: the name, chevron, New, Search and Documents at the drawing's positions (R10)
- [ ] `menusExtensionPoint.ts`: `ritemark/projectHead` and `ritemark/projectHead/new`; their items contributed from `package.json` (R10)
- [ ] `package.json`: `files.exclude` for `**/.ritemark` (R10)
- [ ] You: the outline circle; Settings and Help; ARIA as a menu button (R11)
- [ ] `desktop.contribution.ts` (`window.menuStyle: custom`), `menu.ts`, `defaultStyles.ts`: Ritemark's menus; the macOS menu bar stays native (R12)
- [ ] Updating from v1.14.0: the places order once; terminals, Copilot Chat and other views out of the AI column (R16)

## Phase 6: Merge 1, the frame

- [ ] VS Code unit tests: `ritemarkPermanentTabs.test.ts`; the panel-to-desk terminal guard (E3)
- [ ] Extension tests: the 2.0 defaults and the head's menus in `package.json` (E3)
- [ ] `scripts/qa/frame-geometry.mjs` on a dev instance launched without focus; results in `qa/` (E3)
- [ ] Docs: `references/layout-invariants.md`, `architecture.md` (the locked decision and a frame note), `CLAUDE.md`'s patch table and count, `PATCH-RULES.md`'s table (E4)
- [ ] Manual QA on the Mac: S1–S6, S12–S38, S44–S46; evidence in `qa-evidence.md`
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree
- [ ] PR 1 opened; `qa-validator` review; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After the merge: Windows round 1 from main: S7–S11, S28–S33, S37, S38 on a Windows PC; findings in `qa-evidence.md` (R2)
- [ ] After the merge: drift check, results in the release plan's risk register (E6)
- [ ] Release plan tracker updated

## Phase 7: The theme and window sizes (W10, W11)

- [ ] Both themes: the ground, the AI's sheet, the desk; no lines between parts; no indigo tab line; `menu.*` keys (R13)
- [ ] The seven `ritemark.*` colours in `package.json`, with high-contrast values (R13)
- [ ] The product icon theme (50 icons) and the dark file icons (R13)
- [ ] `ritemarkSurfaces.css` cleaned: theme variables only; each remaining `!important` marked with why (R13)
- [ ] Webviews: `index.css` and the AI sheet's components from `--vscode-ritemark-desk` (R13)
- [ ] Surface by surface against the drawings, both themes (W10's table) (R13)
- [ ] Modal dialogs, Flows and the Agent Library, when their drawings arrive (R13)
- [ ] The contrast unit test (R13)
- [ ] `ritemarkWindowSizes.ts`: the 1400, 1200 and 960 crossings; a column the person opened left alone (R14)
- [ ] The fixes from Windows round 1 (R2)

## Phase 8: Merge 2, the theme and Windows, and closeout

- [ ] `scripts/qa/frame-screenshots.mjs`: the baseline set; Jarmo approves it (E3)
- [ ] `scripts/check-vscode-drift.sh`, and `update-vscode.sh`'s checklist with the screenshot check (E4, E6)
- [ ] Manual QA: S39–S43, S44 again, S45 again; evidence in `qa-evidence.md`
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator by hand
- [ ] PR 2 opened; `qa-validator` review; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree (E5); Windows round 2 from main: S7–S11 again, S39 and S42 on Windows
- [ ] After the merge: drift check (E6)
- [ ] Linked issues closed with evidence: [#276](https://github.com/ProductoryHQ/ritemark-native/issues/276), [#430](https://github.com/ProductoryHQ/ritemark-native/issues/430), [#199](https://github.com/ProductoryHQ/ritemark-native/issues/199)
- [ ] `docs/CHANGELOG.md` and the v2.0.0 release notes draft
- [ ] Release plan: tracker, feature-complete checklist rows and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --check` reported (cleaning is Jarmo's call)
