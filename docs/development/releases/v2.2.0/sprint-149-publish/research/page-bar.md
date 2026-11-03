# A1: the page's bar, what patch 010 needs

Sprint 149, Phase 1, gates W2 (PR 2). A read-only code audit, 3 November 2026: nothing was launched. `vscode/…` lines are read from the main checkout's patched submodule at the pin, as the technical plan's were; paths under `vscode/src/vs/`. The lead's answers 1 and 2 set the target: the buttons at the bar's right end, no address row and no back/forward for a local page, links into new tabs, reload on a file change (or the reload button kept).

## Finding in one line

Everything W2 needs is inside the workbench's browser editor and one electron-main handler; all of it is reachable from patch 010's existing files plus `browserEditor.ts` and the main-side `browserView.ts`, and upstream already has an "Open in External Browser" action PR 2 must not duplicate on the bar.

## How the bar is built

| What | Where | What it means for PR 2 |
|---|---|---|
| The bar is three parts: nav toolbar, URL container, actions toolbar | `workbench/contrib/browserView/electron-browser/browserEditor.ts:120` (`BrowserNavigationBar`), `:144–160` (nav, `MenuId.BrowserNavigationToolbar`), `:162–189` (URL container), `:192–203` (actions, `MenuId.BrowserActionsToolbar`), `:205–211` (appended in that order) | The right end is the end of the actions toolbar. |
| Only `actions…` groups render inline; the rest go to ⋯ | `browserEditor.ts:199` (`primaryGroup: (group) => group.startsWith('actions')`) | Both buttons need a group starting with `actions` and an order after today's inline items, or they land in ⋯. |
| Today's inline Ritemark action there | `features/ritemarkBrowserContextFeature.ts:180–183` (patch 009: group `actions`, order 4) | Open in browser and Publish take orders above 4 to sit to its right. |
| Upstream's groups | `browserViewActions.ts:24–29` (`1_tabs`, `2_zoom`, `3_page`, `4_settings`) | All overflow (⋯). |
| **Upstream already has Open in External Browser** | `browserViewActions.ts:185–216`: `Codicon.linkExternal`, group `3_page` (⋯), precondition `CONTEXT_BROWSER_HAS_URL`; `run` opens the tab's URL with `openExternal: true` | For a `file:` page this already opens the system browser from ⋯. PR 2's inline button should either call `ritemark.page.openInSystemBrowser` (PR 1) and hide upstream's item for local pages, or reuse upstream's action inline; not show two. |
| Toolbar context | `browserEditor.ts:205–206` (`actionsToolbar.context = editor`), `menuOptions.shouldForwardArgs` at `:202` | An action's `run` gets the `BrowserEditor`; `getUrl()` (`browserEditor.ts:856`) gives the `file:` URL to pass to the extension command. |
| Context-key pattern | `browserEditor.ts:47–51` (`RawContextKey`s), bound at `:393`, set in `updateNavigationState` `:916–927` | `ritemarkBrowserLocalPage` and `ritemarkBrowserProjectPage` follow the same pattern, set in `updateNavigationState` from `event.url` and the workspace folders. |

## The address row and back/forward

| What | Where | What it means |
|---|---|---|
| Back, Forward, Reload are menu items on the nav toolbar | `browserViewActions.ts:31–50` (Back, order 1), `:63–80` (Forward), `:95–115` (Reload, order 3, Hard Reload as alt) | A `when` of `!ritemarkBrowserLocalPage` on Back and Forward hides them for local pages; Reload can stay (the lead's fallback) by leaving its menu entry alone. |
| The URL container is plain DOM, not a menu | `browserEditor.ts:162–189`; styles `media/browser.css:57` (`.browser-url-container`) | Hiding it needs code in `BrowserNavigationBar` (a class toggled from `updateNavigationState`), not a `when`. Patch 018's CSS owns the bar's look, so the hide should be a class patch 018's CSS can key on. |

## Links into new tabs

| What | Where | What it means |
|---|---|---|
| No `will-navigate` handler on the page | `platform/browserView/electron-main/browserView.ts:288–289` (only `did-navigate` listeners) | A plain link click navigates the tab in place today. |
| The app lets browser views navigate | `code/electron-main/app.ts:447–450` (`isBrowserViewWebContents` → allowed) | Nothing above the view stops it either. |
| New tabs already have a path | `browserView.ts:111–147` (`setWindowOpenHandler` → `onDidRequestNewPage`), workbench side `browserEditor.ts:601–620` (opens the new tab) | For a `file:` page, a `will-navigate` handler in `browserView.ts` can `preventDefault()` and fire the same `onDidRequestNewPage` (or a new event) with the target; the workbench then opens a website as a browser tab, and a project `.html` through the editor resolver (patch 010's `registerEditor`, `010-…patch:179–214`) so it gets its own page tab. This is electron-main code, so it is a shell change in patch 010's file list. |

## Reload on a file change

| What | Where | What it means |
|---|---|---|
| The model reloads on request | `browserEditor.ts:901–903` (`reload(hard)` → `_model.reload`) | The mechanism exists. |
| No file watching in the browser editor | `browserEditor.ts`, `common/browserEditorInput.ts` (no `IFileService`) | PR 2 would inject `IFileService` into `BrowserEditor` and `watch` the page's file while its URL is `file:`, reloading on change (debounced). A clean fit; if PR 2 runs short, Reload stays at the bar's left (it already is: nav toolbar order 3). |

## Not changed

The session (decision 4) and the share-with-AI question. The tab's resource stays `vscode-browser:` (`common/browserEditorInput.ts:161–162`), which is why the context keys are computed from the URL, not from `resourceExtname`.
