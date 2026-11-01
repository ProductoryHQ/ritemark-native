# Sprint 146 Tasks

Nothing here starts before the plan is approved by Jarmo. Tick a box only when the change is on its PR's branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); S numbers are scenarios in [scenarios.md](scenarios.md); A numbers are the audits.

## Phase 0: Branch and starting tree

- [x] Jarmo's approval is on the sprint plan, with his answers to the decisions
- [x] `git checkout -b sprint-146-controls` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-146-controls-catalogue`, `-polish`, `-shell`, `-card-dialog`, each from `origin/main` the same way
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] `node ./scripts/worktree-hygiene.mjs --report` read, and the free disk recorded; nothing removed without Jarmo's word (1 November: 10 GiB free; five worktrees reported removable, about 21 GiB, none removed)
- [ ] Asked: the Experience lead for the drawings, words and choices (sprint plan, *For the Experience lead*); the "Ritemark on Windows" session for the overlay checks and Gate 2's rows

## Phase 1: Audits (each in `research/`, before its code)

- [x] A1 `research/menu-focus-audit.md` (R1, S1–S8): #585's commit cherry-picked; its audit table run live, mouse and keyboard, Light and Dark; the rows behind an AI run or marked not run
- [x] A2 `research/focus-rings.md` (R3): every ring sorted by kind; the Tailwind 3.3 variant check and the mechanism chosen
- [x] A3 `research/catalogue-capture.md` (R2, R4, S22–S26): focus emulation, hover and press into a webview, a cell at device pixels five times, the theme switch
- [ ] A4 `research/tooltip-looks.md` (R5, S28–S31): both looks measured with crops; other users of `editorHoverWidget.*`; the native `title` list
- [ ] A5 `research/narrow-buttons.md` (R6, S32–S35): every cut label; the CSS rule tried, the measured one only if needed
- [ ] A6 `research/file-changes-audit.md` (R7, S37–S43): every Git and GitHub welcome string, its `when`, its owner patch; the focused element on a mouse open, for File changes and each place
- [ ] A7 `research/tab-menu-audit.md` (R8, S44–S48): each tab kind's menu on a dev build with Copilot Chat and on 2.1.0; each item's command and All commands
- [ ] A8 `research/hover-row-audit.md` (R9, S49): each list's row end and thumb edge at 1× and 2×, Light and Dark
- [ ] A9 `research/card-dialog.md` (R10): the card page's parts that need only the card and the snapshot; how the page treats HTML, images and links
- [ ] Where an audit changes a requirement or a tier, `spec.md` and the sprint plan's tier line change first

## Phase 2: PR 1, no ring after a mouse pick (W1, R1)

- [x] `f370bb66` cherry-picked onto `sprint-146-controls`; bundles rebuilt; its two crops moved into this sprint's `qa/`
- [x] `npm test` (with `closeFocus.test.ts`) and the webview's `tsc --noEmit` pass; the test fails on `main`'s `components/ui` (E1)
- [x] A1's table filled; a fault in the shared rule fixed here (the live audit found none; PR 1's review rounds found and fixed several, listed in `research/menu-focus-audit.md`)
- [ ] The Experience lead has seen the screenshots (S1–S4, Light and Dark)
- [ ] PR 1 opened: Risk with its tier, #585's evidence quoted; #585 closed with a link; `/code-review` at medium; every finding answered; merged at the reviewed head

## Phase 3: PR 2, the catalogue, the tracker and the state test (W2, W3, W4; R2–R4)

- [x] `ControlCatalogue.tsx` and its `main.tsx` route; `catalogueCoverage.test.ts` in `npm test` (S10)
- [x] `ControlCataloguePanel.ts` and the launch setting in `extension.ts`; the gate's unit test (S9)
- [x] `scripts/qa/control-states.mjs`, its source test (S23); a first capture of the controls before the tracker kept as the failing set (`research/control-states-runs.md`)
- [x] `ui/input-mode.ts` from `close-focus.ts`; `inputMode.test.ts`; started in `main.tsx` (and `office/main.tsx`)
- [x] The rings behind keyboard mode by A2's mechanism: the Tailwind variant, the stylesheets, Select's and the composer's triggers
- [x] `focusOpensTooltip` reads the mode; its test
- [x] The close rule by decision 1; `ExportMenu.tsx`'s own copy gone (S6, S19)
- [ ] S13–S20 on a dev instance
- [ ] The Experience lead approves every image, Light and Dark; `docs/development/control-baseline/` and its README (the set and the README are in; the approval waits)
- [ ] The revert run exits non-zero; the branch run exits 0 (S22); the background run equals the front run (S25). S22 done (`research/control-states-runs.md`, runs 8 and 9); S25 not run: a front run takes the screen
- [x] Wiring: the PR template's Risk line; `REVIEW.md` and `reviewer-brief.md` leave out `control-baseline/`; the `release` skill and `release-manager.md` run it at Gate 1; `incidents.md` row 10 (S27); the Codex harness through the harness-equalizer (its next run)
- [ ] Windows through the overlay (S21)
- [ ] PR 2 opened and reviewed at Standard; screenshots and `sheet.html` to the Experience lead

## Phase 4: PR 3, tooltips and narrow buttons (W5, W6; R5, R6; R9 if a webview's)

- [ ] The lead's tooltip look in `ui/tooltip.tsx` (or noted for PR 4 if the workbench's hover moves); its render test; the native titles on controls moved to `Tooltip` (S28–S31)
- [ ] The split button's label in two parts and the wrap rule; the `Button` opt-in where A5 found cuts; render tests (S32–S35)
- [ ] R9's webview fix, if A8 puts it there (S49–S51)
- [ ] The catalogue's tooltip, long-label and narrow cells approved again; `control-states.mjs` passes
- [ ] Windows through the overlay; screenshots in Light and Dark to the Experience lead
- [ ] PR 3 opened and reviewed at Standard

## Phase 5: PR 4, the shell patches (W7, W8, W9; R7, R8, R9; R5's hover if it moves)

- [ ] A CoW-cloned, patched `vscode/` in the worktree; `./scripts/apply-patches.sh --dry-run` passes before any change
- [ ] Patch 016: Git's welcome strings and GitHub's publish entries in the lead's words, through `create-patch.sh`; its header (S37–S40)
- [ ] Patch 018: the outline rule for File changes and the places A6 lists (S41, S42); the hovered row's rule if A8 puts it there (S50, S51); the hover's shape if R5's choice needs it
- [ ] Patch 019: the tab menu's filter and `ritemarkTabMenu.test.ts` (S44–S48)
- [ ] `./scripts/test.sh --grep Ritemark`; `frame-screenshots.mjs --compare` with JOINS ok and `frame-geometry.mjs`
- [ ] `CLAUDE.md`'s patch table (016, 018, 019) and `layout-invariants.md` (a document tab's menu, the left column's rows)
- [ ] PR 4 opened: High, `/code-review` at high and `/security-review`; every finding answered; merged at the reviewed head with the drift check
- [ ] Windows proof on 2.2's candidate at Gate 2 (S43, S47)

## Phase 6: PR 5, the card dialog (W10, R10)

- [ ] Sprint 145's board PR merged; the lead's drawing in
- [ ] `boardUi.openCard` by surface; its test (S52, S59)
- [ ] `dialog.tsx`'s wider size; `CardDialog.tsx` from the page's parts; Open in separate tab (S55, S56)
- [ ] The text read-only, with HTML escaped and links through the board's opener; the escaping test (S58)
- [ ] The dialog follows the snapshot and closes for a gone card (S57); focus back to the card (S53, S54)
- [ ] S52–S61 on a dev instance with prepared card files; nothing written (S63)
- [ ] Windows through the overlay; screenshots to the Experience lead
- [ ] PR 5 opened: Standard, plus `/security-review`

## Phase 7: QA and closeout

- [ ] `npm test` and the webview tests pass; `tsc --noEmit` for both; the pre-commit validator on every PR
- [ ] Each check failed on `main` first (S62), recorded in `qa-evidence.md`
- [ ] Records unchanged (S63); `media/webview.js` size after (S64); `architecture.md`, `docs/CHANGELOG.md`, the release notes lines drafted (S65)
- [ ] `control-states.mjs` on `main` after the last merge: exit 0
- [ ] Gate 1 and Gate 2 rows for the release plan: `control-states.mjs` on the candidate, S43, S47, S50
- [ ] Issues closed on merge with their evidence: #576, #566, #598; #567, #568, #594 after their candidate checks; #585 closed as carried into PR 1
- [ ] `qa-evidence.md` written; `release-plan.md`'s tracker rows updated, one per PR
