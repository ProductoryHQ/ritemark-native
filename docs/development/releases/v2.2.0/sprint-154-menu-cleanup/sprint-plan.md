# Sprint 154: two menus lose items that don't belong to Ritemark

Track: Lightweight (one shell PR, two menu items, no new surface)<br>
Release tier: shell. Patch 019 (the tab row's empty-area menu, `ritemarkTabMenu.ts`) and patch 003 (the chat items in the text editor's and Documents' context menus).<br>
**Status:** Under way.<br>
**Approval:** the Development manager approved #650 as a lightweight sprint on 5 November 2026, under Jarmo's 2.2 delegation of 1 November (the manager approves 2.2's plans and starts its sprints until 2.2's RC). Release approval stays Jarmo's.<br>
**Release:** [v2.2.0](../release-plan.md)

## Scope

| Issue | What | PR | Branch |
|---|---|---|---|
| [#650](https://github.com/ProductoryHQ/ritemark-native/issues/650) | Editor Actions Position ▸ leaves the tab row's empty-area menu; Copilot's Add File to Chat and Open Inline Chat leave the editor's and Documents' context menus. Every command stays in All commands | — | `sprint-154-menu-cleanup` |

Both items come from the Experience lead's check of #649 (ritemark-dev `486b302`, the Sprint 146 answers, "For later, not this PR"). The PR goes in series with the other patch-019 PRs.

## Checked against `main` (4f229d8e), 5 November, before any change

Both items are still there on `main`'s dev build (captures in `captures-650/before-*`):

1. The tab row's empty-area menu: New tab, Reopen closed tab, New Text File, Open File…, New Terminal, Split ×4, Move/Copy into New Window, **Editor Actions Position ▸**, Configure Tabs.
2. Documents' menu on a file: Send to AI Chat … **Add File to Chat** … . The text editor's menu (a `.txt` file; Markdown opens in Ritemark's own editor): **Add File to Chat**, **Open Inline Chat ⌘I**, Change All Occurrences, …

All commands, before: "Chat: Add File to Chat", "Inline Chat: Open Inline Chat ⌘I", and "View: Move Editor Actions to Tab Bar / to Title Bar", "View: Show Editor Actions".

## Decision 4's test

An item leaves a menu only when its command stays reachable in All commands (HARD RULE #1 for everything else).

| Item | Command(s) | In All commands? | Lever |
|---|---|---|---|
| Editor Actions Position ▸ (tab row's empty area) | `workbench.action.editorActionsDefault`, `…editorActionsTitleBar`, `…hideEditorActions`, `…showEditorActions` (`layoutActions.ts`, all `f1`) | Yes; Ritemark's palette filter names none of them | 019: `RITEMARK_TAB_ROW_MENU_LEAVES_OUT` gains the submenu's ID, the way Tab Bar ▸ went in #649. View ▸ Appearance's copy of the submenu is already hidden with that menu |
| Add File to Chat (editor, Documents) | `workbench.action.chat.attachFile` (core, `chatContextActions.ts`, `f1`) | Yes | 003: its `EditorContext` and `ExplorerContext` menu entries go; its other places (Search, the inline chat menus, the tab menu's filter from #568) are untouched |
| Open Inline Chat (editor) | `inlineChat.start` (core, `inlineChatActions.ts`, `f1`, ⌘I) | Yes, and ⌘I stays | 003: its `EditorContext` entry goes; the chat title bar's entry stays |

Both chat items are VS Code core's, not the built-in Copilot extension's `package.json`, so the change is to their menu registrations, as patch 003 does for the Edit menu's items. Copilot's own Copilot CLI items, which show only while a Copilot CLI session runs, are not in #650 and stay.

## Proof plan

`proof-650.txt` in the worktree root (not committed), PASS/FAIL lines:

- The patch blocks match the tree byte for byte (the stack applied to the pin in a scratch index equals the working tree), and `apply-patches.sh --dry-run` at the pin reports 0 conflicts; `check-patch-stacking` passes.
- The pre-commit hook passes.
- Unit tests: `ritemarkTabMenu.test.ts` (the empty area drops Editor Actions Position ▸, keeps the rest); a 003 test that the two chat actions register no editor or Documents menu entry and stay in the Command Palette menu.
- Live, on a refreshed dev build (transpiled into `vscode/out`), in an isolated instance: no Editor Actions Position in the tab row's empty-area menu; no Add File to Chat or Open Inline Chat in the text editor's and Documents' menus, with Send to AI Chat still in Documents'; All commands still finds all three. Before and after captures of each menu in `captures-650/` for the Experience lead.

## Not covered

- **Windows.** Not run. The change is to menu registrations, the same on both.
- **A signed-in Copilot.** The isolated window has no sign-in; the items showed there anyway, so the before/after needs none.

## Gate 1 rows (at the RC)

- Right-click the tab row's empty area: no Editor Actions Position ▸.
- Right-click a file in Documents and inside a text file: no Add File to Chat or Open Inline Chat; Send to AI Chat still in Documents'. ⌘I still opens Inline Chat where Copilot is set up.

## Planning approval

- [x] The Development manager approves #650 as a lightweight sprint (5 November 2026, Jarmo's 2.2 delegation of 1 November).
- [x] GitHub issue exists: #650.
