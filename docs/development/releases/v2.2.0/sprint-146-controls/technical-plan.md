# Sprint 146 Technical Plan

The plan for [spec.md](spec.md). The release is 2.2.0 ([release-plan.md](../release-plan.md)). Code shapes here are proposals; when the code needs something else, this file changes first. File references are to `origin/main` at 39b4e37f (31 October 2026). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`. VS Code's own files were read in the main checkout's `vscode/` (this worktree has no submodule checked out), so their line numbers are those of that tree, which may differ by a few lines from the pinned commit. **The code was read for this plan, not run:** no dev instance, build or test was started.

## What exists today

| Part | Today | File |
|---|---|---|
| The shared controls | 19 files: `Icon`, `alert`, `badge`, `button`, `context-menu`, `dialog`, `dropdown-menu`, `filter-chip`, `input`, `label`, `pill`, `progress`, `select`, `slider`, `split-button`, `switch`, `tabs`, `textarea`, `tooltip`; shadcn copies over Radix (React 18, Tailwind 3.3) | `webview/components/ui/`; `webview/package.json:17–31`, `:94` |
| A menu's close | `DropdownMenuContent` passes Radix's default, which focuses the trigger after every close | `webview/components/ui/dropdown-menu.tsx:25–32` |
| #585's rule (draft, not on `main`) | `ui/close-focus.ts`: the last input (pointer or key, capture phase), `focusTriggerOnlyAfterKeyboard` as the default `onCloseAutoFocus` of `DropdownMenuContent` and `SelectContent`; Share's copy moved onto it; `closeFocus.test.ts` | PR #585, commit `f370bb66`, branch `sprint-144-rc4-menu-focus`, based on `d10cade2` |
| Share's own copy | `lastInputRef`, reset on open, set on pointer down and key down; `onCloseAutoFocus` focuses Share only after a keyboard close and when not left outside | `webview/components/header/ExportMenu.tsx:69`, `:83`, `:135–142` |
| Rings, by kind | Tailwind `focus-visible:` utilities (about 60 uses), Tailwind `focus:` (about 50: fields, menu items' highlight, and some non-fields), hand-written `:focus-visible` / `:focus` rules (24, in four stylesheets) | e.g. `button.tsx:17` (4 px), `switch.tsx:14` (3 px), `slider.tsx:20` (1 px), `tabs.tsx:37`, `filter-chip.tsx:7`; `select.tsx:29`, `input.tsx:24`, `textarea.tsx:23` (`focus:ring-1`); `index.css:282` (split parts, 2 px outline), `:645`; `home.css`, `tasks.css`, `welcome.css` |
| Local focus rules | The tooltip opens on focus only when `:focus-visible` matches (Sprint 142 R9); the dialog focuses itself on open so a button's tooltip doesn't pop; the card page keeps the focus on the control that replaced a button | `webview/components/ui/tooltip.tsx:26–38`; `dialog.tsx:58–65`; `tasks/CardPage.tsx:78–102` |
| Popovers | No `ui/popover.tsx`; two screens use Radix's popover directly | `ai-sidebar/ThinkingEffortControl.tsx`, `transcribe/workbench/InsightsLanguageCombobox.tsx` |
| One bundle, many pages | `main.tsx` reads `data-editor-type` and renders one app; page-wide watchers start there | `webview/main.tsx:7–13`, `:73`, `:107` |
| Webview panels | A host panel builds the HTML with the CSP and the root's `data-editor-type` | `src/views/HomePanel.ts:152`, `:597`; `src/taskBoard/boardSurface.ts:226`, `:239` |
| Test hooks by environment | Ritemark already reads test-only variables | `src/voiceDictation/whisperCpp.ts:93` (`RITEMARK_DICTATION_MODE`); `src/analytics/posthog.ts:300–301` |
| The frame's screenshot check | Drives the window over CDP, captures scenes in both themes, compares inside the running instance, `compare.html`, exit code = scenes that differ; switches themes through the palette | `scripts/qa/frame-screenshots.mjs:1–35`, `:104–187` (keys, clicks, the palette, the theme), `:212–240` (a capture); `docs/development/frame-baseline/` (47 files, 4.9 MB) |
| Where Gate 1 runs it | The release skill's Gate 1 step and the release manager's base-window check | `.claude/skills/release/SKILL.md:191`; `.claude/agents/release-manager.md:292` |
| The review process | `REVIEW.md` already holds Step 8's two rules and leaves `frame-baseline/` out; the PR template's Risk section names the tier; incident row 10 is RC3's ring, its check "planned" | `REVIEW.md:20–22`, `:29`; `.github/pull_request_template.md:27–30`; `docs/development/review/incidents.md:31`; `docs/development/review/reviewer-brief.md:46` |
| Tooltips | Ritemark's: ink-strong fill, surface words, 8 radius, arrow; VS Code's workbench hover takes `editorHoverWidget.*`, which neither Ritemark theme sets | `webview/components/ui/tooltip.tsx:64–67`; `themes/ritemark-light.json`, `themes/ritemark-dark.json` (no `editorHoverWidget` key) |
| Native titles | About 110 `title=` uses in 30-odd webview files, props and native attributes together | e.g. `ai-sidebar/ThinkingEffortControl.tsx`, `ai-sidebar/ConversationsPanel.tsx`, `components/DataTable.tsx` |
| Cut labels | The shared split button's main label is `truncate`; Home hides Change image's label at a container of 200; the viewers' toolbar goes icon-only under 560 for its own split button and buttons | `ui/split-button.tsx:85`; `home/home.css:309–317`, `home/HomePage.tsx:331`; `viewers/ViewerToolbar.tsx:25–39`, `:218–277` |
| The first-day card's tooltip | The button's whole words first (#565) | `home/GuidanceCards.tsx:97` |
| File changes' words | VS Code's Git extension's welcome strings (folder, workspace, empty, disabled, parent folders, unsafe, closed, scanning, missing) and the GitHub extension's publish lines | `vscode/extensions/git/package.nls.json:353–491`; `vscode/extensions/github/package.nls.json:14–29`, `package.json:223–232` |
| Who already patches them | 016 rewrites the three `scm.missing.*` strings (no download line); 003 removes the explorer's clone entries from Git's `viewsWelcome`; 018 names File changes | `patches/vscode/016-ritemark-store-acquisition-policy.patch:24–60`; `003-ritemark-menu-cleanup.patch:33–56`; `018-ritemark-surfaces.patch:94–95`, `:5365` |
| The outline on a mouse open | The workbench outlines every `[tabindex]:focus`; a view's welcome content is `tabIndex: 0` and is focused when the view opens | `vscode/src/vs/workbench/browser/media/style.css:282–295`; `…/browser/parts/views/viewPane.ts:164`, `:666–670` |
| A tab's menu | Built in one place from `MenuId.EditorTitleContext`; the five items come from chat (`ChatContextKeys.enabled` only), the files contribution, the editor contribution and the built-in Markdown extension | `vscode/src/vs/workbench/browser/parts/editor/editorTabsControl.ts:428–436` (a 019 file: `019-ritemark-tab-row.patch:348`); `…/contrib/chat/browser/actions/chatContextActions.ts:157–165`; `…/contrib/files/browser/fileActions.contribution.ts:165`; `…/browser/parts/editor/editor.contribution.ts:398`, `:665`; `vscode/extensions/markdown-language-features/package.json:255–261` |
| The terminal tab's menu | Its extra registrations removed at the source, "those stay in the command palette" | `019-ritemark-tab-row.patch:1553–1607` |
| The palette's filter | One filter of command IDs and prefixes where All commands gets its rows | `003-ritemark-menu-cleanup.patch` (`commandsQuickAccess.ts`, `isHiddenFromRitemarkPalette`) |
| The left column's rows and thumb | Rows 8 in from each side, radius 4, hover fill; the thumb the scrollbar's width less 2 at the right edge | `018-ritemark-surfaces.patch:1370–1395`, `:1404` |
| Webview lists on the ground | Thin sliders shown on hover and while scrolling | `webview/index.css:311–320`; `webview/lib/scrollingMark.ts` |
| Opening a card | Every opener calls `useBoardUi.openCard`, which sends `board/open-card`; the host opens the card page | `tasks/boardUi.ts:48`; `BoardColumns.tsx:285`, `IdeasView.tsx:141`, `CallsView.tsx:69`, `LogView.tsx:68`, `TasksList.tsx:405`; `src/taskBoard/boardSurface.ts:139–141` |
| What the board knows of a card | Title, Done when, stage, the description (the Markdown body), files, history, result, ask, review, hand-off, derived move and call | `src/taskBoard/protocol.ts:81–114` |
| The card page's parts | `CardStrip` and `CardHead` take a card and the snapshot | `tasks/CardPage.tsx:111`, `:292` |
| The shared dialog | Radix Dialog, z-80 scrim, at most 480 wide, full-bleed under 640 | `webview/components/ui/dialog.tsx:26–45`, `:69–80` |
| Rendering Markdown read-only | `marked` into `innerHTML`, no sanitizer, in the AI's sheet | `ai-sidebar/RenderedMarkdown.tsx:15–19`, `:104` |
| The board's CSP | Scripts by nonce; images from the webview, `https:` and `data:` | `src/taskBoard/boardSurface.ts:226` |
| The `task-board` flag | Gates the board | `src/features/flags.ts:129` |

## Architecture overview

Ten changes in existing modules, no new subsystem. One new webview page type (`control-catalogue`) with its own small host panel; no host message changes.

| Layer | Requirement | Where |
|---|---|---|
| The shared controls' close rule | R1 | `webview/components/ui/` (`close-focus.ts`, `dropdown-menu.tsx`, `select.tsx`), `header/ExportMenu.tsx` |
| The catalogue | R2 | `webview/components/catalogue/ControlCatalogue.tsx` (new), `webview/main.tsx`; `src/views/ControlCataloguePanel.ts` (new), `src/extension.ts` (one line) |
| The tracker | R3 | `webview/components/ui/input-mode.ts` (#585's `close-focus.ts`, grown and renamed), `webview/main.tsx`, `tailwind.config.ts`, the four stylesheets, `ui/tooltip.tsx`, `ui/select.tsx`, `header/ExportMenu.tsx` |
| The state test | R4 | `scripts/qa/control-states.mjs` (new), `docs/development/control-baseline/` (new), the PR template, `REVIEW.md`, the reviewer brief, the `release` skill, the `release-manager` agent, `incidents.md` |
| Tooltips | R5 | `ui/tooltip.tsx`, or the themes' `editorHoverWidget.*` (and 018) by the lead's choice; screens with native titles |
| Narrow buttons | R6 | `ui/split-button.tsx`, `ui/button.tsx`, `index.css` (`.rm-split`) |
| File changes | R7 | patch 016 (Git's and GitHub's strings), patch 018 (`ritemarkSurfaces.css`, the outline) |
| A tab's menu | R8 | patch 019 (`editorTabsControl.ts`) |
| The hovered row | R9 | patch 018 (`ritemarkSurfaces.css`), or `webview/index.css`, by the audit |
| The card dialog | R10 | `webview/components/tasks/` (`boardUi.ts`, a `CardDialog.tsx`, `CardPage.tsx`'s parts), `ui/dialog.tsx` (a size), maybe `ai-sidebar/RenderedMarkdown.tsx` |

**Release tier: shell**, by patches 016, 018 and 019. The per-item tiers and the five PRs are in the sprint plan.

## Phase 1: audits

Nothing here is code. Each audit is one file in `research/` and comes before the workstream it gates. A requirement whose audit changes it changes in `spec.md` first.

1. **A1, `research/menu-focus-audit.md` (R1: S1–S8).** #585's commit cherry-picked onto `sprint-146-controls` from `origin/main`; nothing under `components/ui/`, `ExportMenu.tsx` or `index.css` changed on `main` since its base `d10cade2` (seven commits, read with `git diff`), so the source applies as it is; the bundles are rebuilt, since Sprint 145 may change the webview first. Then #585's audit table, run live: each trigger by mouse and by keyboard, Light and Dark, with real CDP input on a hidden dev instance. The rows behind a ready AI (the composer, the board's split buttons) use ChatGPT through Jarmo's own sign-in in the scratch project, or say not run.
2. **A2, `research/focus-rings.md` (R3).** Every ring in the webview, sorted: a non-field control's ring (moves behind keyboard mode), a field's focused look (stays), a menu item's highlight (stays: it shows where the keyboard is inside an open menu), a local focus rule (the tooltip's, the dialog's, the card page's, Share's). And one build check that decides the mechanism: whether Tailwind 3.3 lets a plugin in `tailwind.config.ts` redefine the `focus-visible` variant (`addVariant('focus-visible', …)`), read from the CSS it emits for `focus-visible:ring-[4px]`. If it does, the 60-odd utilities change in one place; if not, the fallback is a pointer-mode rule that clears the ring's shadow variables and outline, and the audit says which one is taken.
3. **A3, `research/catalogue-capture.md` (R2, R4: S22–S26).** On one hidden dev instance with a two-cell trial page: the debugging protocol's focus emulation (`Emulation.setFocusEmulationEnabled`) makes a background window's `:focus` states draw; hover and a held press reach a webview through the workbench page's `Input.dispatchMouseEvent`; a cell's rectangle (the webview's offset plus the cell's) captured at device pixels is stable over five runs with motion and the caret off; the theme switch through the palette (`frame-screenshots.mjs`' way) works with the catalogue in front.
4. **A4, `research/tooltip-looks.md` (R5: S28–S31).** The two looks measured in Light and Dark (fill, words, border or shadow, radius, padding, arrow), crops for the Experience lead; what else uses `editorHoverWidget.*` (the text editor's hovers); and the native `title` attributes listed by file and element, apart from components' own `title` props.
5. **A5, `research/narrow-buttons.md` (R6: S32–S35).** Every button that cuts its label: at a 152 px desk (Home), in the board's narrow side bar, in the viewers' and spreadsheet's toolbars, the dictation button, Share. Then the rule tried in the catalogue's narrow cells: first CSS alone (the label in two parts, the first word unbreakable, the button's content wrapping onto a clipped second line when the first word doesn't fit, so no script and no loop); a measured rule (a `ResizeObserver` on the button's room, as `ViewerToolbar.tsx:31–38` does for its toolbar) only if CSS can't.
6. **A6, `research/file-changes-audit.md` (R7: S37–S43).** Every Git and GitHub welcome string, when it shows (its `when` clause) and which of the lead's rule's words it has; which patch owns its lines (016, 003, none); whether any of them is reached on Windows more than on the Mac. For the outline: which element takes the focus when File changes opens from More with a click, whether `:focus-visible` matches it, and the same for each place in the left column.
7. **A7, `research/tab-menu-audit.md` (R8: S44–S48).** Each tab kind's menu as it is (a Markdown document, Home, the Task board, Word, PDF, a web page, a terminal) on a dev build with Copilot Chat installed and on the shipped 2.1.0 without it; each item's command ID and where it registers; whether All commands offers it today.
8. **A8, `research/hover-row-audit.md` (R9: S49).** Each list in the left column with the thumb showing, at 1× and 2×, Light and Dark: the row's right end, the thumb's left edge, and whether they overlap. Read from 018: a workbench row ends 8 from the column's edge and the thumb is the scrollbar's width less 2 at the edge, so a 10-wide scrollbar overlaps a row by 2, which fits the issue; which list Gate 1 saw is not in the issue.
9. **A9, `research/card-dialog.md` (R10: S52–S61).** Which of the card page's parts take a card and the snapshot only, and which need the page's editor; whether the snapshot has everything the page shows; how the card page itself treats raw HTML, remote images and links in a card's text, so the dialog is no less strict.

## Workstream 1: no ring after a mouse pick (R1, PR 1)

- **Carry #585 over.** `git cherry-pick f370bb66` onto `sprint-146-controls` from `origin/main`, keeping its message and authorship. #585 isn't kept as the PR because its branch, `sprint-144-rc4-menu-focus`, doesn't follow the sprint branch rule (`sprint-NN-short-name`, the sprint's folder); its evidence is quoted into PR 1's body and its two crops move into this sprint's `qa/`. #585 closes with a link.
- **Rebuild the bundles** (`npm run build` in `webview`) on the rebased tree, and check `npm test` (with `closeFocus.test.ts`) and `tsc --noEmit` for the webview.
- **Run A1's audit,** fill #585's table, and fix what it finds in the same PR if it's in the shared rule.
- **Nothing else.** The tracker is W3; PR 1 is #585 as reviewed, proven live, so Jarmo's finding is fixed before the catalogue's drawings are in.

## Workstream 2: the catalogue page (R2, PR 2)

- **The page:** `webview/components/catalogue/ControlCatalogue.tsx`, rendered by `main.tsx` for `data-editor-type="control-catalogue"`, lazy like the other pages. One section per control, one row per variant, one column per state. Each cell is a fixed box with its own copy of the control, a focusable start mark before it (so Tab reaches the control from a known place), and room below for an open menu. The page sets its own `transition: none`, `animation: none` and `caret-color: transparent`, which change no state's end look.
- **Props, not data:** each cell renders the control with fixed props (labels, a long label, disabled, busy, on, a narrow width). Nothing comes from the host; `RenderedMarkdown`, agents and folders are not needed.
- **Coverage test:** `catalogueCoverage.test.ts` reads `components/ui/` and the catalogue's list of rows, and fails when a file has no row (in `npm test`, as the webview's other `npx tsx` tests).
- **The host:** `src/views/ControlCataloguePanel.ts`, a webview panel built as `HomePanel` builds its HTML (the same CSP and nonce), opened by `extension.ts` at activation when `process.env.RITEMARK_CONTROL_CATALOGUE === '1'`, and otherwise never registered: no command, menu or palette entry (decision 5). A unit test of the gate.
- **Size:** the page is a few hundred lines of JSX in the one bundle; E4 measures it.

## Workstream 3: the tracker (R3, PR 2)

After A2, and after W2's first capture on `main`'s controls, which records the states that show a ring after a mouse pick today (the failing set).

- **One module:** #585's `ui/close-focus.ts` becomes `ui/input-mode.ts` (its test moves with it): `inputKindOf` as #585 wrote it; `watchInputMode(doc)` writes `data-input-mode="keyboard" | "pointer"` on `<html>` from the capture phase; `inputMode()` and a subscription for code that needs it. Started once in `main.tsx`, beside `watchScrollingMark()`. Default keyboard, as #585's.
- **The ring behind the mode:** by A2's mechanism, `focus-visible:` utilities match only under `:root[data-input-mode="keyboard"]`; the hand-written ring rules in `index.css`, `home.css`, `tasks.css` and `welcome.css` get the same prefix; non-field `focus:` rings (Select's trigger first, `select.tsx:29`) move to the same variant. Fields keep `focus:`.
- **The tooltip:** `focusOpensTooltip` returns `inputMode() === 'keyboard'` for a focus event (its test changes with it); hover is unchanged.
- **The close rule, by decision 1.** Recommended answer: with the ring decided by the mode, the menus' and Select's default `onCloseAutoFocus` goes back to Radix's (the focus returns to the trigger after every close, as the WAI-ARIA menu button pattern and React Aria do), and `focusTriggerOnlyAfterKeyboard` is deleted with its uses. The other answer keeps #585's rule as it is.
- **Share:** `ExportMenu.tsx` keeps what its stand-in trigger needs (the real Share button takes the focus; a click outside leaves it alone) and reads the mode for nothing else; under decision 1's recommended answer it returns the focus to Share after every close not ended outside.
- **The dialog and the card page:** `dialog.tsx`'s open focus (the dialog itself) and `CardPage.tsx`'s kept focus choose where the focus goes, not the ring, so they stay.
- **Tests:** `inputMode.test.ts` (the inputs to modes, modifiers, shortcuts, the default, one watcher per document); `tooltip`'s focus rule; and W4's states as the running check.

## Workstream 4: the state test (R4, PR 2)

After A3.

- **`scripts/qa/control-states.mjs --port <cdp-port> --out <dir> [--compare docs/development/control-baseline] [--only <control>]`.** Like `frame-screenshots.mjs`, it carries its own small CDP plumbing (each script in `scripts/qa/` does), connects to a running instance started with `RITEMARK_CONTROL_CATALOGUE=1`, finds the catalogue's frame, and turns on focus emulation.
- **Each state with real input:** hover is a mouse move onto the control; pressed is a held press, captured, then released off the control; keyboard focus is a click on the cell's start mark and Tab; after a mouse click is a click and the pointer moved off; menu open is a click; after a mouse pick is a click on an item; after Escape and after a keyboard pick are keys. Disabled, busy, on and the long label are props, captured at rest and hovered.
- **Capture and compare:** `Page.captureScreenshot` on the cell's rectangle at device pixels, in Light and Dark (the theme switched through the palette); the comparison inside the instance as `frame-screenshots.mjs` does it, with a small per-cell tolerance set from A3's five runs; `compare.html` and `sheet.html`. Exit code: states that differ or have no image.
- **The approved set:** `docs/development/control-baseline/<theme>-<control>-<variant>-<state>.png` and a README (how to run, how to take a new set, the Experience lead approves each image once, and a changed control's images are approved again in its PR).
- **Wiring:** the PR template's Risk section gains one line (the script's result when `components/ui/`, `index.css` or a control's look changed); `REVIEW.md`'s "What not to report" and `reviewer-brief.md`'s exclusions add `control-baseline/`; the `release` skill's Gate 1 step and `release-manager.md`'s check run it on the candidate beside `frame-screenshots.mjs`; `incidents.md` row 10's last cell names it. The Codex harness gets the agent and skill lines through the harness-equalizer, as for Steps 4–7.
- **Fails first (S22):** with the approved set, a run on a scratch branch that reverts R1's rule exits non-zero and names the mouse-pick states.

## Workstream 5: one tooltip look (R5, PR 3, maybe PR 4)

After A4 and the Experience lead's choice.

- **If Ritemark's tooltip takes the workbench's look:** one class string in `ui/tooltip.tsx:64–67` (fill, words, border or shadow, radius); the arrow as the lead says. Extension-tier, PR 3.
- **If the workbench's hover takes Ritemark's look:** `editorHoverWidget.background`, `.foreground` and `.border` in both themes (extension files that ship only with a shell release, which 2.2 is), and, if its shape changes too, a rule in 018's `ritemarkSurfaces.css` (PR 4, High). The text editor's hovers change with it (A4 lists them).
- **Native titles:** the ones on controls become the shared `Tooltip` in the screens that have them; the rest are listed.
- **Tests:** a render test of the tooltip's classes; the catalogue's tooltip cells approved again.

## Workstream 6: narrow buttons (R6, PR 3)

After A5.

- **The rule in the shared control:** `split-button.tsx`'s main part draws its label in two parts (the first word, then the rest, which takes the ellipsis), and `.rm-split` in `index.css` gets the wrap rule A5 proves; the label stays in the DOM, so it stays the accessible name. A `Button` with an icon and a label opts into the same through one prop or class, used where A5 found a cut label.
- **A label that isn't a string** (a busy state's words through a component) keeps today's cut.
- **The viewers' toolbar** keeps its whole-toolbar rule (`ViewerToolbar.tsx:25`); its split button already shows its icon only there.
- **Tests:** a render test of the split button's label parts; the catalogue's narrow cells (approved); S32–S35 by hand at the widths A5 lists.

## Workstream 7: File changes with no Git (R7, PR 4)

After A6 and the lead's words for the states A6 adds.

- **The words in patch 016.** It already owns Git's `scm.missing.*` lines, which "File changes needs Git" replaces, and `check-patch-stacking.mjs` (pre-commit Check 14) blocks a second patch on its lines. So Git's other welcome strings (`package.nls.json`) and GitHub's publish entries (`extensions/github/package.json`'s two `viewsWelcome` entries, removed, the `github.publish` command kept) join it, through `create-patch.sh`. Its header gains a Sprint 146 paragraph; it keeps its file name; `CLAUDE.md`'s patch table says what it now holds.
- **Set up Git here** is the same link, `command:git.init?%5Btrue%5D`, with Ritemark's words: a line that is only a link still draws as the panel's button (`viewPane.ts`), as 016's header explains.
- **The heading:** VS Code's welcome view draws paragraphs and buttons, not headings. The heading is the first line in the body's style, or, if the lead wants it set apart, one rule in 018 scoped to File changes' welcome content.
- **The outline in patch 018.** By A6: a rule in `ritemarkSurfaces.css` that drops the outline from a view's welcome content (and any other element A6 lists) on `:focus` without `:focus-visible`, so a mouse open draws none and the keyboard still does. If A6 shows Chromium's guess is wrong after a mouse open (as it was for Radix's script focus), the workbench gets a pointer-or-keyboard class of its own in 018, scoped to the left column, before the rule.
- **Tests:** `./scripts/apply-patches.sh --dry-run`; S37–S42 on a dev instance from a CoW-cloned, patched `vscode/`; Windows at Gate 2 (S43).

## Workstream 8: a tab's menu (R8, PR 4)

After A7 and the lead's list.

- **One filter in patch 019:** in `editorTabsControl.ts`'s `onTabContextMenu` (`:428–436`), the menu's actions are taken from `MenuId.EditorTitleContext` and a named list of command IDs is left out (`RITEMARK_TAB_MENU_LEAVES_OUT`, with the reason beside each), as 003's `isHiddenFromRitemarkPalette` does for All commands. Built-in extensions' items (Open Preview, Find File References) are caught without patching their `package.json`. The filter names what goes, so a new item still shows until it is named.
- **The commands stay:** none is unregistered; A7 says which All commands offers.
- **Tests:** `ritemarkTabMenu.test.ts` beside 019's tests (the filter's list; an unnamed item stays), run with `./scripts/test.sh --grep Ritemark`; S44–S47 on the patched dev instance; `layout-invariants.md`'s Terminal row gains its sibling, a document tab's menu.

## Workstream 9: the hovered row (R9, PR 4 or PR 3)

After A8 and the lead's choice.

- **For the workbench's lists** (patch 018): either the row's right end stops at the thumb's left edge while the thumb shows, or the thumb's fill is opaque (the slider's colour laid over the ground's, so it is one tone over any row). One rule in `ritemarkSurfaces.css` beside the slider's, with the 2-short rule kept.
- **For a webview's list** (`index.css`, `html.rm-ground`): the same choice in the webview's CSS, extension-tier, PR 3.
- **Tests:** S49–S51; `frame-screenshots.mjs --compare` with its JOINS lines and `frame-geometry.mjs`, since 018 changes.

## Workstream 10: a card in a dialog (R10, PR 5)

After A9, the lead's drawing and Sprint 145's board PR (its PR 4 changes `boardClient.ts` and the board's rows).

- **One change where cards open:** `useBoardUi.openCard` sets `dialogCardId` on the board's surface (`panel`) and keeps sending `board/open-card` on the side bar's (`sidebar`) and from a card page (`page`), so every opener (`BoardColumns`, `IdeasView`, `CallsView`, `LogView`) gets the dialog with no change of its own. `TasksList` is the side bar's, so it keeps the tab (decision 3).
- **`CardDialog.tsx`:** the shared `DialogContent` with a wider size (a `size` option added to `dialog.tsx`, not a local class), the title and Done when, the state's block and its one action, the files and the history from `CardPage.tsx`'s parts where they need only the card and the snapshot (A9), and the text read-only. Open in separate tab sends `board/open-card` with the card's id and closes the dialog.
- **The text:** shown read-only (decision 2). By A9, either `RenderedMarkdown` with HTML escaped and links through the board's opener, or a plain, pre-wrapped text if the page itself shows no more; never raw HTML into the board's page. Remote images as the card page treats them, or not loaded.
- **It follows the snapshot:** the dialog reads its card from each snapshot by id; a card that is gone closes it and shows the board's notice.
- **Focus:** Radix Dialog gives the focus back to the card on close; the ring follows the mode (R3).
- **Tests:** `boardUi`'s open rule per surface; the dialog's render per card state; the gone card; the text's escaping (S58) as a unit test; S52–S61 on a dev instance with prepared card files (no AI).
- **Review:** Standard by its paths; it also gets `/security-review`, because it shows a file's text from a folder that may be someone else's inside a webview.

## Delivery plan

Five PRs, listed with their tiers in the sprint plan. How each gets there:
- Each branch is made from `origin/main` after approval; `git branch --show-current` shows it before any edit. The documents in this folder are updated in the PR that does the work.
- Each PR's Risk section names its tier and the paths that set it, and, from PR 2 on, `control-states.mjs`' result where a control changed. `REVIEW.md`'s review runs at that tier on the PR's head; every finding is answered; the merge is at the reviewed head. At most three rounds.
- **PR 2's order inside it:** the catalogue and the script first, with a capture of `main`'s controls (the failing set); then the tracker; then the Experience lead approves the images; then the revert run (S22).
- **PR 4** is built on a CoW-cloned, patched `vscode/` in the worktree, through `create-patch.sh` onto 016, 018 and 019, with the drift check at merge, `./scripts/test.sh --grep Ritemark`, and the frame check (`frame-screenshots.mjs --compare`, `frame-geometry.mjs`) because 018 and 019 change.
- **Gate 2 on Windows** carries the proof for PR 4.
- Everything merges before 2.2's first release candidate; `main` is frozen from that build.

## Coordination

- **Sprint 145** changes the Task board (its PR 4: unreadable rows, the optimistic move in `boardClient.ts`) and adds buttons with the shared Button and Tooltip. PR 5 starts after that PR merges; 145's new buttons get the tracker and the narrow rule with everything else, with no change of their own.
- **Sprint 147** (the new Settings) is built from the shared controls, so PR 2 (the tracker and the catalogue) merges before 147's build starts, and 147's new controls get catalogue rows.
- **The Experience lead** approves the catalogue's images and draws #598's dialog first (the release plan), and gives the words and choices in the sprint plan.
- **The "Ritemark on Windows" session** runs the overlay checks of PR 1, 2, 3 and 5, and Gate 2's checks of PR 4.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| Redefining the ring in one place changes 100-odd rings at once | The catalogue and the script come first, with `main`'s capture; every non-field control's states are approved after the change; S20 visits every page |
| Tailwind 3.3 doesn't let a plugin replace `focus-visible:` | A2 decides from the emitted CSS; the fallback clears the ring in pointer mode, and A2 records which is taken |
| A background window's focus states differ from a front window's | Focus emulation; A3 and S25 compare a front and a background run |
| Pixel images flake (fonts, motion, the caret) | Motion and the caret off on the page; A3's five runs set the tolerance; device pixels on the Mac only |
| The catalogue turns into a redesign | It approves today's looks; a change the lead wants becomes an issue unless it is this sprint's item |
| Decision 1's answer changes PR 1's rule again in PR 2 | PR 1 merges #585's rule now; the tracker makes the other rule safe, and the change is the default handler in two files |
| The outline's class is wider than File changes | A6 lists every place; the rule is scoped to the left column, and the keyboard keeps the outline |
| The tab menu's filter hides a useful item | It names what goes, with the lead's list; the commands stay in All commands; S48 |
| Git's words drift on a VS Code update | Patch 016's hunks fail loudly when upstream moves the lines; `update-vscode.sh --check` |
| The dialog and the card page disagree | Both draw from the board's snapshot; the dialog has no write path of its own and uses the board's existing messages; the notes are read there, edited in the tab (decision 2) |
| A card's text draws over the board | No raw HTML; S58; `/security-review` on PR 5 |
| #598 meets Sprint 145's board work | PR 5 starts after 145's board PR; #598 is the first item cut |
| A drawing arrives late | The cut order; PR 1 needs none, PR 2 waits only for the images' approval |
| Disk is tight (3.4 GiB free on 31 October) | The worktree-hygiene report first (a clean is Jarmo's call); a CoW-cloned `vscode/` for PR 4; profiles under `/private/tmp` removed after each run; the baseline is small crops |
| Hidden test windows take keys meant for other windows (#585's note) | CDP input only, `open -n -g -j`, one launch per check, never the system keyboard |
