# A2: A restored task card's tab shows its file name (R12; #508)

Run on 26 October 2026 on a dev build of `main` at `84ea15db`, with the patches applied. The instance was hidden, on CDP port 9242, with a throwaway profile (`--user-data-dir`, `--shared-data-dir`, `--use-mock-keychain`, `RITEMARK_BUILD_CHANNEL=test`, usage data off). The workspace was a copy of the sample project.

## The reproducer

`tabwatch.mjs` (the session's scratchpad) reads the tab row over CDP every 150 ms from the moment CDP answers.

1. **A card in a background tab.** Open the card "Draft Module 4 from the brief" from the board; its tab reads the title. Choose Home, quit, relaunch. The tab row at first paint reads `m4d7r2-draft-module-4.md`, and it stays that way for the whole 20 s watched. **This reproduces #508 on main.**
2. **The card as the active tab.** Choose the card's tab and wait for the workbench to save its state. The profile's `memento/workbench.parts.editor` then stores the card's editor with `"title":"Draft Module 4 from the brief"`. Quit, relaunch:
   - at 3162 ms the tab reads `m4d7r2-draft-module-4.md`;
   - at 3862 ms it reads `Draft Module 4 from the brief` (the extension resolved it, #477's `applyCardTab`);
   - 25 s later, the stored title is the file name again.

## Why

- **VS Code saves the title.** `WebviewEditorInputSerializer.toJson()` saves `title: input.getName()`, and for a card that is the card's title.
- **Its restore drops it.** `CustomEditorInputSerializer.deserialize()` passes the saved title only as `webviewTitle`, which goes to the webview overlay. `CustomEditorInput`'s constructor gives its base class `name: init.preferredName ?? ''`, and the deserializer passes no `preferredName`. So a restored custom editor's `getWebviewTitle()` is `''`, and `getName()` falls back to the file's base name (`customEditorInput.ts`, `getName()`).
- **It stays lost.** A tab that is never opened keeps that name. The next state save writes the file name back, so it is lost for good until the card is opened. That matches the RC1 report: "Opening the card once fixed it."
- **The extension only fixes it once the editor resolves.** `applyCardTab()` in `ritemarkEditor.ts` sets `webviewPanel.title` from `cardPages.cardTitleFor(document)`. When `cardPages` isn't ready yet, it writes the base name. That can overwrite a good title on a fast start, as a second, smaller cause.

## Decision

- **Patch 019** (the tab row, shell-tier; *Open Questions* 9, approved): the custom editor's deserializer passes the saved title as `preferredName` when it differs from the resource's base name. A card's tab then keeps its title from the first paint, and other custom editors are unchanged. (When the saved title equals the base name, `preferredName` stays unset, so a file renamed while closed still shows its new name once opened.)
- **The extension** (merge 1): `applyCardTab()` never writes the base name over a title it doesn't know yet. With no title from `cardPages`, it leaves the panel's title alone, and applies the card's title when the board has loaded.
- **The AI's chip:** it names the active editor through the same `cardPages` lookup when the sheet asks, so it follows the tab. S63 checks it.
