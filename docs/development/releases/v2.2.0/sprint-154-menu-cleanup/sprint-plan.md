# Sprint 154: right-click menus lose items that don't belong to Ritemark

Track: Lightweight (one shell PR, menu entries only, no new surface)<br>
Release tier: shell. Patch 019 (the tab row's empty-area menu, `ritemarkTabMenu.ts`) and patch 003 (the chat items in the text editor's, Documents' and Search's context menus).<br>
**Status:** In review as draft PR #664, round 2 (`proof-650.txt`: 0 FAIL).<br>
**Approval:** the Development manager approved #650 as a lightweight sprint on 5 November 2026, under Jarmo's 2.2 delegation of 1 November (the manager approves 2.2's plans and starts its sprints until 2.2's RC). Release approval stays Jarmo's.<br>
**Release:** [v2.2.0](../release-plan.md)

## Scope

| Issue | What | PR | Branch |
|---|---|---|---|
| [#650](https://github.com/ProductoryHQ/ritemark-native/issues/650) | Editor Actions Position ▸ leaves the tab row's empty-area menu; Copilot's Add File to Chat and Open Inline Chat leave the editor's and Documents' context menus; round 2: Add File to Chat (Search) and Add Selection to Chat (the editor, with a selection). Every command stays in All commands. Add Folder to Chat (Documents' folders) stays | [#664](https://github.com/ProductoryHQ/ritemark-native/pull/664) | `sprint-154-menu-cleanup` |

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
| Add Folder to Chat (Documents' folders), round 2 | `workbench.action.chat.attachFolder` (core, `chatContextActions.ts`, `f1: false` upstream) | No: upstream has `f1: false`, so its menu is its only way in | Kept as on `main`. `f1: true` was tried (round 2b) and reverted (round 2c): from All commands, with no folder to act on, it attaches the open text file as a folder or does nothing, and it shows even when Copilot Chat is off. Decision 4: a command All commands can't reach meaningfully keeps its menu entry (the coordinator, 5 November) |
| Add File to Chat (Search), round 2 | `workbench.action.chat.attachFile` | Yes | 003: its `SearchContext` entry goes; the tab menu's and the inline chat menus' entries stay |
| Add Selection to Chat (editor, with a selection), round 2 | `workbench.action.chat.attachSelection` (core, `chatContextActions.ts`, `f1`) | Yes | 003: its `EditorContext` entry goes; the inline chat menus' entries stay |
| Generate Code ▸ (editor), round 2 | the `ChatTextEditorMenu` submenu (`chatActions.ts`) | — | Left as it is: it never shows in Ritemark. Only extensions fill that submenu (`editor/context/chat`, a proposed API), none does (the built-in Copilot included), and VS Code draws no empty submenu |

Both chat items are VS Code core's, not the built-in Copilot extension's `package.json`, so the change is to their menu registrations, as patch 003 does for the Edit menu's items. Copilot's own Copilot CLI items, which show only while a Copilot CLI session runs, are not in #650 and stay.

## Proof plan

`proof-650.txt` in the worktree root (not committed), PASS/FAIL lines:

- The patch blocks match the tree byte for byte (the stack applied to the pin in a scratch index equals the working tree), and `apply-patches.sh --dry-run` at the pin reports 0 conflicts; `check-patch-stacking` passes.
- The pre-commit hook passes.
- Unit tests: `ritemarkTabMenu.test.ts` (the empty area drops Editor Actions Position ▸, keeps the rest); a 003 test that the two chat actions register no editor or Documents menu entry and stay in the Command Palette menu.
- Live, on a refreshed dev build (transpiled into `vscode/out`), in an isolated instance: no Editor Actions Position in the tab row's empty-area menu; no Add File to Chat or Open Inline Chat in the text editor's and Documents' menus, with Send to AI Chat still in Documents'; All commands still finds all three. Before and after captures of each menu in `captures-650/` for the Experience lead.

## Round 2 (after the Opus review)

The Experience lead's test (ritemark-dev `fa4c49b`): an item leaves a menu when it hands the file or selection to Copilot where Ritemark's AI is meant; its command stays in All commands. Copilot CLI's items stay.

| Item | Before (main + round 1, `captures-650/round2-before-*`) | Done |
|---|---|---|
| Add Folder to Chat, Documents' folder menu | Shown, after Find in Folder… | Kept (round 2c). The lead approved its removal, but its menu is its only meaningful way in: upstream has it `f1: false`, and from All commands it has no folder to act on (decision 4) |
| Add File to Chat, Search's result menu | Shown, last, after Reveal in Explorer View | Removed (lead approved); All commands keeps it |
| Add Selection to Chat, the text editor's menu with a selection | Shown, first | Removed (the review found it); All commands keeps it |
| Generate Code ▸, the text editor's menu | Never shown, with or without a selection | Left as it is: the submenu is filled only by extensions through the proposed `editor/context/chat` point, none does, and VS Code draws no empty submenu |

Send to AI Chat is Ritemark's item in Documents' menu only (`extensions/ritemark/package.json`, `explorer/context`); the text editor's menu never had it, before or after. `ritemarkChatMenus.test.ts` pins each action's exact menu list, so an entry that comes back fails it (checked by putting the three entries back: 3 failing).

## Not covered

- **Windows.** Not run. The change is to menu registrations, the same on both.
- **A signed-in Copilot.** The isolated window has no sign-in; the items showed there anyway, so the before/after needs none.

## Gate 1 rows (at the RC)

- Right-click the tab row's empty area: no Editor Actions Position ▸.
- Right-click a file in Documents and inside a text file: no Add File to Chat or Open Inline Chat; Send to AI Chat still in Documents'. ⌘I still opens Inline Chat where Copilot is set up.
- Right-click a folder in Documents: Add Folder to Chat still there (kept). Select text in a text file and right-click it: no Add Selection to Chat. Right-click a result in Search: no Add File to Chat.

## Planning approval

- [x] The Development manager approves #650 as a lightweight sprint (5 November 2026, Jarmo's 2.2 delegation of 1 November).
- [x] GitHub issue exists: #650.
- [x] One branch and PR: #664.
