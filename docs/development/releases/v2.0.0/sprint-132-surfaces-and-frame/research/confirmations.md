# Phase 1 confirmations

Two small checks from Phase 1 of [tasks.md](../tasks.md), read in VS Code 1.117.0 with patches 001–017 (paths under `vscode/src/vs/`).

## 1. The view type of the Home and Task board tabs (W6, R9)

**Confirmed: the prefix is `mainThreadWebview-`, so the rule matches exactly `mainThreadWebview-ritemark.home` and `mainThreadWebview-ritemark.taskBoard`.**

- An extension's `createWebviewPanel(viewType, …)` reaches the workbench through `MainThreadWebviewPanels`, which adds the prefix: `new WebviewViewTypeTransformer('mainThreadWebview-')` (`workbench/api/browser/mainThreadWebviewPanels.ts:82`, `fromExternal` at `:70`).
- The Task board opens with `TaskBoardPanel.viewType = 'ritemark.taskBoard'` (`extensions/ritemark/src/taskBoard/TaskBoardPanel.ts:15`, `:31`). Its editor input's `viewType` is therefore `mainThreadWebview-ritemark.taskBoard`.
- Home has no tab on main yet; step 3 opens it. The proof of concept uses `HomePanel.viewType = 'ritemark.home'` (its `views/HomePanel.ts:64`), so the rule takes `mainThreadWebview-ritemark.home` now and step 3 uses that name.
- A tab restored after a restart keeps the same view type before it is revived: the serializer writes and reads `viewType` as it is (`contrib/webviewPanel/browser/webviewEditorInputSerializer.ts:87`, `:109`), and `LazilyResolvedWebviewEditorInput` is a `WebviewInput` with that view type (`webviewWorkbenchService.ts:114`). So the rule holds for a pinned Task board tab from the moment the window restores, not only once the extension revives it.
- The proof of concept compared with `endsWith('ritemark.taskBoard')`. An exact match is stricter: no other extension's view type can end in the same words and become permanent.

## 2. More keeps its always-in-More items after the places that do not fit (W5, R5, R6)

**Confirmed, with one change in `compositeBar.ts` (002).**

How VS Code fills the row today (`workbench/browser/parts/compositeBar.ts`):
- `updateCompositeSwitcher` (`:528`) takes the pinned places in the model's order and adds them while they fit (`:545–555`); the rest overflow. The active place is put back if it was cut (`:562–574`). When anything overflows, the ⋯ action is added (`:623–641`).
- The ⋯ menu lists `getOverflowingComposites()` (`:649`): every pinned place not shown in the row, **in the model's order** (`:658`). Its menu items run each place's own action (`compositeBarActions.ts:493`), so a click in ⋯ does what a click on the place does.

What 2.0 needs:
- The Copilot Chat launcher (`workbench.view.ritemark.copilotChatLauncher`, registered by patch 003 in `contrib/chat/browser/chatParticipant.contribution.ts:51`, order 0.5) must never sit in the row, and must list **after** the places that do not fit.
- In the model's order it would come early (0.5, beside Tasks), so the order alone does not put it last.

The change, in 002's own lines in `compositeBar.ts`:
- A short list of always-in-More ids (today only the launcher).
- `updateCompositeSwitcher` leaves them out of the places it tries to fit but counts them in `totalComposites`, so ⋯ appears whenever one of them is pinned and visible.
- `getOverflowingComposites` returns the other overflowing places first, then the always-in-More ones.
- With Copilot Chat not installed, patch 007 already unpins and hides the launcher (`hideCopilotChatViewState`), so it is not in the model's pinned items, nothing about it shows, and ⋯ appears only for places that do not fit (S21).

Opening it (patch 007):
- The click runs `ViewContainerActivityAction.run` (`workbench/browser/parts/paneCompositeBar.ts:814–820`, 007's hunk). Today it opens the Chat container in the auxiliary bar. In 2.0 it brings an open Copilot Chat tab forward, or opens a new one with `workbench.action.chat.openInEditor` (`contrib/chat/browser/actions/chatMoveActions.ts:36`). That command opens a new chat editor in the active group when no chat widget is focused (`:121–123`).
- The real Chat container's registered home is the auxiliary bar (`chatParticipant.contribution.ts:40–48`). The AI-column guard (W4) must not move it into the left column, where it would show as a second Chat place beside the launcher; it moves it to the panel, which 2.0 does not show. `technical-plan.md` W4 is updated to say so.
