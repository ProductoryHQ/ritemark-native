# A7: a tab's menu (R8, #568)

1–2 November 2026, on the Mac, for PR 4, on the dev instances of [pr4-shell-checks.md](pr4-shell-checks.md). Each menu was opened with a real right-click on the tab and read from Ritemark's own menu (`window.menuStyle` is custom, patch 018), in Ritemark Light; the document and Home again in Ritemark Dark. The dev build has the built-in Copilot Chat, so Add File to Chat shows; a production build without Copilot Chat doesn't show it (`ChatContextKeys.enabled`).

## Where the five items come from

| Item | Command | Registered by | Shows on |
| --- | --- | --- | --- |
| Add File to Chat | `workbench.action.chat.attachFile` | `contrib/chat/browser/actions/chatContextActions.ts:157` (`MenuId.EditorTitleContext`, while chat is on, for `file`/`vscode-remote` resources) | a document, the spreadsheet, a PDF |
| Reveal in Explorer View | `revealInExplorer` | `contrib/files/browser/fileActions.contribution.ts:167` (`IsFileSystemResource`) | a document, the spreadsheet, a PDF |
| Open Preview | `markdown.showPreview` | the built-in Markdown extension's `package.json` (`editor/title/context`, Markdown files) | a Markdown document |
| Reopen Editor With… | `workbench.action.reopenWithEditor` | `browser/parts/editor/editor.contribution.ts:399` (`ActiveEditorAvailableEditorIdsContext`) | a document, the spreadsheet, a PDF, Home, the Task board |
| Find File References | `markdown.findAllFileReferences` (and `typescript.findAllFileReferences` on a script's tab) | the built-in Markdown and TypeScript extensions' `package.json` | a Markdown document (a script file's tab) |

The tab row builds the menu in one place, `EditorTabsControl.onTabContextMenu` (patch 019's file), from `MenuId.EditorTitleContext`.

## Each tab kind's menu

`main`, then PR 4 (the Experience lead's list, section 6: drop four, rename Reveal in Explorer View to Show in Documents; every tab but the terminal's):

| Tab | `main` | PR 4 |
| --- | --- | --- |
| Markdown document (`Brief.md`) | Close, Close Others, Close to the Right, Close Saved, Close All · Copy Path, Copy Relative Path · **Open Preview, Reopen Editor With…** · **Add File to Chat** · Reveal in Finder, **Reveal in Explorer View** · Pin · Split Right, Split & Move · Move into New Window, Copy into New Window · **Find File References** | Close … Close All · Copy Path, Copy Relative Path · Reveal in Finder, **Show in Documents** · Pin · Split Right, Split & Move · Move into New Window, Copy into New Window |
| Spreadsheet (`Budget.csv`), PDF (`sample.pdf`) | the same less Open Preview and Find File References | Close … · Copy Path, Copy Relative Path · Reveal in Finder, Show in Documents · Pin · Split… · Move/Copy into New Window |
| Home, the Task board | Close … · **Reopen Editor With…** · Unpin · Split… · Move/Copy into New Window | Close … · Unpin · Split… · Move/Copy into New Window (no Show in Documents: they aren't files) |
| A web page | Close … (Close All Browser Tabs while in front) · Pin · Split… · Move/Copy into New Window | unchanged |
| Terminal | Close … · Rename… · Pin · Split… · Move/Copy into New Window | unchanged |
| Word | not run (no `.docx` in the sample); it is the same custom-editor kind as the PDF and the spreadsheet | — |

Show in Documents opens Documents with the file chosen in the tree (checked live on `Brief.md`).

Screenshots (`qa/`): `pr4-r8-document-{light,dark}-main.png` and `pr4-r8-document-{light,dark}.png`, `pr4-r8-home-light-main.png` and `pr4-r8-home-light.png`, `pr4-r8-pdf-light.png`, `pr4-r8-terminal-light.png`, `pr4-r8-show-in-documents-light.png`.

## Still in All commands (decision 4)

Read live from All commands on PR 4 with `Brief.md` in front in Ritemark's editor:

| Dropped from the tab menu | All commands |
| --- | --- |
| Add File to Chat | Chat: Add File to Chat |
| Reopen Editor With… | View: Reopen Editor With… (and View: Reopen Editor with Text Editor) |
| Open Preview | **Not offered while Ritemark's editor is in front**: its palette entry asks for a Markdown *text* editor (`editorLangId =~ /^(markdown|…)$/`). Markdown: Toggle Preview is offered. By that `when`, Markdown: Open Preview is offered once the document is in the text view (View: Reopen Editor with Text Editor); not checked live |
| Find File References | **The same**: Markdown: Find File References asks for a Markdown text editor |
| (File changes) Publish to GitHub | Publish to GitHub |

PR 4 changes neither the palette nor any `when`, so All commands offers exactly what it offered on `main`. Two of the four dropped items were reachable from Ritemark's editor only through the tab's menu; after PR 4 they are reached through the text view. That is the Experience lead's call (Open Preview "a second, developer's view", Find File References "a code tool"); it is named here because decision 4 was put to Jarmo as "they stay in All commands".

## The filter

`ritemarkTabMenu.ts` (patch 019): `RITEMARK_TAB_MENU_LEAVES_OUT`, the five command IDs with the lead's reason beside each, and `ritemarkTabMenuActions`, which drops them, names `revealInExplorer` Show in Documents (the same command, run with the menu's own arguments) and tidies the separators a dropped group leaves. `onTabContextMenu` passes the menu's actions through it instead of handing the context menu the menu ID. It names what goes, so an item no one has named still shows (the test's "A New Thing"). Test: `vscode/src/vs/workbench/test/browser/parts/editor/ritemarkTabMenu.test.ts` (5 cases, in `./scripts/test.sh --grep Ritemark`); it also pins `REOPEN_WITH_COMMAND_ID`, so an upstream rename fails it. The others are other components' IDs (chat, files, two extensions): patch 019's header asks the VS Code update to check them.
