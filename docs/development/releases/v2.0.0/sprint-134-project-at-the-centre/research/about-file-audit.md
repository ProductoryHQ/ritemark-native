# About this project: where a file's name is drawn (R8)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (`30d7fa3a`). Line numbers are this branch's. `V` = `vscode/src/vs` (VS Code 1.117.0 at `10c8e557`, the 18 patches applied). `E` = `extensions/ritemark`.

The decision (Jarmo and the Experience lead, 18 October): the project's own `AGENTS.md` reads "About this project" everywhere, never `AGENTS.md`. The tab and the Documents row have the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT". Documents hides a `CLAUDE.md` whose whole content is `@AGENTS.md`.

**Only the root's `AGENTS.md` is About this project.** That is the sensible reading. The project's menu opens the root file (W7). Codex reads nested `AGENTS.md` files as notes for their own folder, and a writer's subfolder may hold an imported folder with its own. Calling those "About this project" would be wrong, and Documents would show two rows with the same name. "The root" here means a workspace folder's root: the folder Ritemark opened as the project.

## 1. The tab

**How the tab gets its name.** The tab row takes each tab's name from `editor.getName()` (`V/workbench/browser/parts/editor/multiEditorTabsControl.ts:1413`). It takes the tooltip from `getHoverTitle`, which 019 makes `getTitle(Verbosity.MEDIUM)`: the path inside the project (`editorTabsControl.ts:453–454`). Then `redrawTabLabel` calls `setResource` with the name, that title, `icon: editor.getIcon()` and Sprint 133's `splitExtension: true` (`:1656–1670`). The single tab control does the same (`singleEditorTabsControl.ts:307–323`).

**The Ritemark editor's `getName()`** returns the webview's title if it has one. Otherwise it returns VS Code's custom label for the file, or else the file's base name (`V/workbench/contrib/customEditor/browser/customEditorInput.ts:186–193`). `getTitle()` also returns the webview's title first (`:244–248`).

**Setting `webviewPanel.title` from the extension does rename the tab.** The setter sends `$setTitle` (`V/workbench/api/common/extHostWebviewPanels.ts:93–98`). That calls `setWebviewTitle` (`api/browser/mainThreadWebviewPanels.ts:187–189`, then `contrib/webviewPanel/browser/webviewEditorInput.ts:101–105`). A custom editor's input is registered with the panels when it resolves (`api/browser/mainThreadCustomEditors.ts:150`). It is still the wrong tool, for three reasons:
- **It is lost on every reload.** `CustomEditorInput` is built with `name: ''` (`customEditorInput.ts:112`). The serialized title only reaches the overlay webview's own title (`:66`). So a restored tab reads `AGENTS.md` until the extension resolves the editor again, and a background tab stays that way until it is clicked. R9 reloads the window and restores the tabs on every switch.
- **The tooltip becomes "About this project" too**, because `getTitle()` returns the webview title.
- **It covers the Ritemark editor only.** Open With ▸ Text Editor gives a text tab, which still reads `AGENTS.md`.

**What works instead: VS Code's custom editor labels.** Both editor kinds ask `ICustomEditorLabelService` for a name: text editors in `V/workbench/common/editor/resourceEditorInput.ts:100–102`, the Ritemark editor in `customEditorInput.ts:192`. The setting `workbench.editor.customLabels.patterns` drives it. A pattern is matched against the path from the root folder's **parent**: `Leadership/AGENTS.md` (`V/workbench/services/editor/common/customEditorLabelService.ts:143`). Case is ignored (`:93`). So this default matches the root's `AGENTS.md` and never `Leadership/docs/AGENTS.md`:

```json
"workbench.editor.customLabels.patterns": { "*/AGENTS.md": "About this project" }
```

`workbench.editor.customLabels.enabled` defaults to true (`V/workbench/browser/workbench.contribution.ts:113–117`). The template passes the service's letter-or-digit check (`customEditorLabelService.ts:81`). The value comes from configuration, so it is there before any editor resolves. It reaches everything that names an open editor by `getName()`:
- the tab, in both editors;
- 019's folded list, "N more tabs" (`V/workbench/browser/parts/editor/ritemarkFoldedTabs.ts:136`);
- the tab's accessible name (`computeEditorAriaLabel`, `multiEditorTabsControl.ts:1417`);
- the window's title (the short title is `getName()`, `resourceEditorInput.ts:148–153`), which the Mac's Window menu shows;
- the save prompt and the tab's drag image;
- Quick Open, which shows "About this project" with `AGENTS.md` as its description (`V/workbench/contrib/search/browser/anythingQuickAccess.ts:1026–1028`).

It goes into `E/package.json`'s `configurationDefaults`, beside `files.exclude` (`:906`). Defaults from an extension are cached and applied at startup from the second start on (`V/workbench/services/configuration/browser/configuration.ts:64`, `:105–132`). product.json's defaults apply from the very first start, through 013. A live check on a fresh profile settles which place it needs (L2).

**The tab's icon.** For a file, `editor.getIcon()` is undefined, so the label service draws the file icon theme's icon for the file name (`V/editor/common/services/getIconClasses.ts:57–64`). See section 3.

**The tab's tooltip** today is `AGENTS.md`, the path inside the project. That holds in both editors: `resourceEditorInput.ts:157–162` and `customEditorInput.ts:232–235`. Any file decoration's tooltip follows it after " • ". The decided tooltip needs the label service's case below (section 2), which the tabs share.

**The same file in the plain text editor** is covered by both of the above, since both work from the file, not from the editor.

## 2. Documents

**The row.** `renderStat` calls `setResource({ resource, name: label }, { …, splitExtension: true })` (`V/workbench/contrib/files/browser/views/explorerViewer.ts:1013–1021`). The name is the file's own name. The Explorer never asks the custom labels, so section 1's setting does not reach it. `labels.ts`'s `render()` builds the label (`V/workbench/browser/labels.ts:615–738`). Sprint 133's hunk sits at `:650–658`.

**One more case in 018's resource-label code covers the row and the tabs.** It keys on the same opt-in as Sprint 133's split. Only the Explorer's rows (`explorerViewer.ts:1020`) and the two tab controls (`multiEditorTabsControl.ts:1670`, `singleEditorTabsControl.ts:323`) pass `splitExtension`. Search, Source Control, quick picks and every other label keep their names. The case goes after the block that sets the path as the title (`labels.ts:664–679`), which would otherwise overwrite it for the Explorer. It goes before the decorations (`:697`):

```ts
// Ritemark 2.0 (Sprint 134, R8): the project's own AGENTS.md, at a workspace folder's root, is About this
// project in the rows and tabs that ask for Ritemark's names. Any other AGENTS.md keeps its name.
if (this.options?.splitExtension && resource && this.options.fileKind !== FileKind.FOLDER && this.options.fileKind !== FileKind.ROOT_FOLDER
	&& basename(resource).toLowerCase() === 'agents.md' && isEqual(dirname(resource), this.contextService.getWorkspaceFolder(resource)?.uri)) {
	if (typeof name === 'string' && name.toLowerCase() === 'agents.md') {
		name = localize('ritemark.aboutProject', "About this project");
		iconLabelOptions.matches = undefined; // the Explorer's find matched the file's name, not this one
	}
	iconLabelOptions.splitExtension = false;
	iconLabelOptions.title = localize('ritemark.aboutProject.tooltip', "AGENTS.md, read by Claude and ChatGPT");
}
```

018's own `const name` (`:652`) becomes `let`. The final `setLabel` (`:734`) passes `name` instead of `this.label.name`. `basename` joins 018's import line (`:8`). A tab already named by the custom label is not renamed again; it gets the tooltip. If someone turns custom labels off, the case still renames the tab.

**How the shell knows the file: a fixed rule, not an extension-supplied value.**
- **A fixed rule in the patch** (above). `ResourceLabelWidget` already has `IWorkspaceContextService` (`labels.ts:323`). It decides synchronously, so it is right on the first frame, on a restored background tab, and before the extension activates. The cost is that the file's name lives in the shell as well as in `aboutFile.ts`. It is a fixed product name, not a setting.
- **An extension-supplied value** (a context key holding the URI, or a command). The widget would need `IContextKeyService`, and `ResourceLabels` would need a listener to redraw every label when the key changes (beside `labels.ts:150–214`). The extension activates with `*` (`E/package.json:19–21`), which is still after the workbench draws. So Documents and the tabs would read `AGENTS.md` and then flip, on every load and on every project switch. More code and a visible flicker.

**Case.** The Mac's and Windows' file systems ignore case. On them, Claude and Codex asking for `AGENTS.md` read an `agents.md`. The case above, the custom label's glob and the icon theme all ignore case. `aboutFile.ts` should do the same: open the file that is there, and never create a second one.

**Smaller effects on the row:**
- Its accessible name stays `AGENTS.md`, because the tree's accessibility provider returns `element.name` (`explorerViewer.ts:1191–1193`). One line in 018 could return the plain name when `element.parent?.isRoot`. Recommended, but not required by R8.
- It sorts by its file name (`FileSorter`, `:1443`), so it sits among the A's where `AGENTS.md` would.
- Type-to-find in the tree matches the file name (`explorerView.ts:490–496`). Rename shows `AGENTS.md`, the true name.

## 3. The icon

**Ritemark's file icon theme already has the book-open icon.** The theme is `E/fileicons/ritemark-icon-theme.json` (`E/package.json:969–975`). Its `_file_readme` and `_file_readme_dark` are `icons/book-open.svg` and `icons/dark/book-open.svg` (lines 33 and 72), drawn in the same Phosphor style as the theme's other icons. They are mapped to `readme.md`, `readme`, `changelog.md`, `license` and `license.md` in the dark map (`:171–175`) and the light map (`:245–249`). The change is to add `"agents.md"` to both `fileNames` maps. A file name beats the `md` extension and the markdown language in a theme, as `readme.md` already shows.

**A theme rule applies to every `AGENTS.md`.** Theme file names are lowercased (`V/workbench/services/themes/browser/fileIconThemeData.ts:363–377`). A rule can name a parent folder (`handleParentFolder`, `:486–495`) but not "the root". So a subfolder's `AGENTS.md` gets the book too, without the new name. That is acceptable: it is the same kind of file, a note the agents read. README, CHANGELOG and LICENSE already share the book today. If the Experience lead wants the book on About this project alone, the labels case would also have to swap the icon classes. That is more code; I don't recommend it.

**The menu's icon.** The project's menu draws codicons through Ritemark's product icon theme, which maps them to Phosphor's regular font (`E/producticons/ritemark-product-icon-theme.json`). It has no `book` today. The bundled `Phosphor-Regular.woff2` is byte for byte the font in `@phosphor-icons/web`. There, `ph-book-open` is `\e0e6` (`E/node_modules/@phosphor-icons/web/src/regular/style.css:677–678`). Adding `"book": { "fontId": "phosphor-400", "fontCharacter": "\\e0e6" }` lets the menu item use `$(book)`. It also changes VS Code's few uses of the `book` codicon to the same glyph.

**The folded list draws its own icon.** `iconOf` maps by extension, so `.md` gets `file-text` (`ritemarkFoldedTabs.ts:33–43`). One line in 019 returning `Codicon.book` for `agents.md` would match the tab. That is optional. Without it, the list shows "About this project" with the text icon.

## 4. The tooltip

**Today:**
- The Documents row shows the full path: `~/Projects/<project>/AGENTS.md` on the Mac, where file paths are tildified (`V/workbench/contrib/files/browser/files.contribution.ts:49`), and `C:\…\AGENTS.md` on Windows (`labels.ts:664–679`).
- The tab shows `AGENTS.md`, the path inside the project (019, `editorTabsControl.ts:453–454`).
- Both add any file decoration's tooltip after " • " (`labels.ts:697–710`). The decoration service joins the providers' tooltips with " • " (`V/workbench/services/decorations/browser/decorationsService.ts:193`).

**A `FileDecorationProvider` reaches the tab as well as the tree.** The tabs always pass a `fileDecorations` object (`multiEditorTabsControl.ts:1663–1666`), so `labels.ts` fetches the decoration for them too. But a provider can only add to the title, never replace it. The row would read "~/Projects/<project>/AGENTS.md • AGENTS.md, read by Claude and ChatGPT". Ritemark registers no provider today, and none is needed.

**So the labels case sets the title outright** (section 2). In a folder under Git, Git's decoration still follows it, as in "AGENTS.md, read by Claude and ChatGPT • Untracked". That is honest, and I'd keep it (L3).

## 5. Hiding the pointer-only `CLAUDE.md`

**`files.exclude` can't do it.**
- It matches names, not content. Its sibling clause (`"CLAUDE.md": { "when": "AGENTS.md" }`) would also hide a person's own `CLAUDE.md` beside an `AGENTS.md`.
- An extension can write a setting only to the user's settings or to the folder's `.vscode/settings.json` (Global, Workspace, WorkspaceFolder). The user's settings apply to every project, and the folder is ruled out.
- Extensions get no in-memory scope. `configurationDefaults` are fixed, which is how `.ritemark` is hidden (`E/package.json:906–908`).

**So it is a filter case in 018's `explorerViewer.ts`, where 018 already hides `.ritemark` (`:1415–1418`).** There are two ways to know which file is the pointer:

- **(a) A list the extension supplies** (a context key with the pointer's URI). `FilesFilter` would inject `IContextKeyService`, listen for the key, and check it. The rule stays only in `aboutFile.ts`. But the pointer shows until the extension activates, then disappears. That happens on every load and every switch, a row that jumps seconds after the tree draws. The extension would also have to watch `CLAUDE.md` for edits.
- **(b) The filter reads the root `CLAUDE.md` itself**, the way it already reads `.gitignore`. `filter()` sees the file (`:1387–1395`), starts an async read, and fires `onDidChange` when it has the answer (`processIgnoreFile`, `:1352–1385`). The read is bounded, with the file service's `length` option (`V/platform/files/common/files.ts:1355`, `:369`), so 1 KB is plenty. The verdict is kept per file. The existing `onDidFilesChange` listener (`:1256`) clears it when the file changes, appears or goes. If the verdict is unknown, or the read fails, the file stays visible, so a person's own file is never hidden by mistake.

**I recommend (b).** It needs no extension code and no watcher. It works while the extension host is starting or has crashed. Its delay is one small read, not the extension's activation. The rule:
- the file is the root's (`stat.parent?.isRoot`) and is named `CLAUDE.md`, ignoring case;
- its text, trimmed, is exactly `@AGENTS.md`. `trim()` removes spaces, tabs, CR, LF and a byte-order mark;
- the root also has an `AGENTS.md` (`stat.parent.getChild('AGENTS.md')`, which follows the platform's case rule, `V/workbench/contrib/files/common/explorerModel.ts:308–310`). A pointer to nothing stays visible, so the person can see the leftover.

The check joins `isHiddenResource` (`explorerViewer.ts:1411`). Then an open pointer shows while it is open, as VS Code does for any hidden file. The one-line rule repeats `aboutFile.ts`'s. Both are tested with the same cases: surrounding whitespace, CRLF, a byte-order mark, and one more line, which must stay visible.

**Search, Quick Open and Source Control show it as it is.** I recommend leaving them so:
- Source Control must list every new or changed file truthfully. The pointer has to be committed for Claude to read it on another computer.
- Search finds text. A one-line `@AGENTS.md` hit is honest and rare.
- Quick Open lists the file only when someone types for it.
- Hiding it there would need `search.exclude`-level changes, which can't read content either. The spec says Documents, and (b) affects Documents alone.

## 6. Home's Last changed and the AI's sheet

**Home** is drawn by the host (`HomePanel.ts`, new in W4; technical plan, Last changed). It names each row itself. For the root `AGENTS.md` it takes the plain name and the book-open icon from `aboutFile.ts`. It must also **leave out the pointer-only `CLAUDE.md`**. It is a `.md`, so without that, Create would put `CLAUDE.md` at the top of Last changed the moment it writes it. The sample project would show it too.

**Where the AI's sheet names a file:**
- the composer's chip, "Active: …" (`E/webview/src/components/ai-sidebar/ChatInput.tsx:1200–1201`, through `getDisplayPath`, `:130–145`);
- a sent prompt's "Context: …" line (`ChatBubbles.tsx:15–18`, `:36–41`);
- path chips for files dropped on the composer (`ChatInput.tsx:1269–1284`). They hold absolute paths (`extractPath`, `:116`);
- "Modified N files" (`FilesSummary.tsx:20–26`, from `AgentResponse.tsx:326`);
- the activity rows (`ActivityCard.tsx`), links in answers (`chatLinks.ts`), and the AI's own words.

The host sends the active file as a path inside the project, `vscode.workspace.asRelativePath(uri)` (`E/src/views/UnifiedViewProvider.ts:3169`, sent at `:1601` and `:3052`). For the root file in a one-folder window, that path is exactly `AGENTS.md`. The same path goes into the prompt as `File: …` (`store.ts:1414`), and it must stay the real path.

**Recommended, the minimal answer:**
- The **Active chip** and the **Context line** say "About this project". They name the document in front, which the tab already calls that. A small pure helper in the webview treats the relative path `AGENTS.md` (ignoring case) as the About file. Each chip's hover keeps the path. Old turns get the same name, since they store the same relative path.
- **Everything else keeps the path.** Those places report what the agent did to a file, and the AI writes "AGENTS.md" in its answers anyway. The tooltip ("AGENTS.md, read by Claude and ChatGPT") teaches the link. Path chips would need the project's root, since they hold absolute paths. They are left as they are, as a follow-up if wanted.

## 7. The project's menu

Confirmed: the menu is all the extension's.
- Its entries come from `ritemark/projectHead` in `E/package.json` (`:698–705`), with their words and icons from each command's `title` and `icon` (`:43–72`).
- The commands are registered in `E/src/views/projectHeadCommands.ts` (`:25–32`, `:57–64`).
- The shell only draws the menu: `V/workbench/browser/parts/sidebar/ritemarkProjectHead.ts:35` and `:90`, `V/workbench/services/actions/common/menusExtensionPoint.ts:555`, with each item's icon at `ritemarkMenu.ts:110`.

About this project is a new command with the title "About this project" and `$(book)`, at `1_project@3`, after Reveal. It runs `aboutFile.ts`'s open-or-create, not a VS Code command, so its `runs` is an extension command. No shell change.

## Other places the name shows

- **Share ▸ PDF and Word** suggest `AGENTS.pdf` and `AGENTS.docx` (`E/src/export/pdfExporter.ts:31`, `wordExporter.ts:80`). R8 doesn't list them. "About this project.pdf" would be one line each through `aboutFile.ts`. That is the Experience lead's call.
- **Search results and Source Control** keep `AGENTS.md`, as above.
- **Breadcrumbs** are off (`E/package.json:900`).

## Summary

| Place | Mechanism | Where (file:line) | Shell hunk needed | Live check needed |
|---|---|---|---|---|
| The project's menu | A new command, "About this project", `$(book)`, in `ritemark/projectHead` | `E/package.json:43–72`, `:698–705`; `E/src/views/projectHeadCommands.ts:25–32` | No | No |
| The tab's name (both editors, restored tabs, folded list, Quick Open, window title) | `workbench.editor.customLabels.patterns` default `{"*/AGENTS.md": "About this project"}` | `E/package.json` `configurationDefaults` (`:906`); read at `resourceEditorInput.ts:100–102`, `customEditorInput.ts:192`, matched at `customEditorLabelService.ts:143` | No | Yes: L1, L2 |
| The Documents row's name | One more case in 018's resource-label code, on the `splitExtension` opt-in, by a fixed rule (root `AGENTS.md`) | `V/workbench/browser/labels.ts:652`, after `:679`, `:734` | Yes, 018 (`labels.ts`) | Yes: L1, L6 |
| Tooltip (row and tab) | The same case sets the title to "AGENTS.md, read by Claude and ChatGPT" | `labels.ts`, as above | Yes, the same 018 case | Yes: L3 |
| Icon (row, tab, Quick Open) | Icon theme `fileNames`: `"agents.md"` → `_file_readme` / `_file_readme_dark` | `E/fileicons/ritemark-icon-theme.json:171–175`, `:245–249` | No | Yes: L4 |
| Icon (menu) | Product icon theme: `book` → Phosphor `\e0e6` | `E/producticons/ritemark-product-icon-theme.json` | No | Yes: L4 |
| Icon (folded list) | `iconOf` returns `Codicon.book` for `agents.md` | `V/workbench/browser/parts/editor/ritemarkFoldedTabs.ts:38–42` | Optional, 019 (one line) | Yes: L4 |
| Hiding the pointer `CLAUDE.md` | `FilesFilter` reads the root `CLAUDE.md` (≤ 1 KB), hides it when its trimmed text is `@AGENTS.md` and the root has an `AGENTS.md` | `V/workbench/contrib/files/browser/views/explorerViewer.ts:1256`, `:1387–1395`, `:1411` | Yes, 018 (`explorerViewer.ts`) | Yes: L5 |
| Row's accessible name | Plain name when `element.parent?.isRoot` | `explorerViewer.ts:1191–1193` | Optional, 018 (one line) | No |
| Home's Last changed | `HomePanel.ts` names the row from `aboutFile.ts`, and leaves out the pointer | `E/src/projects/aboutFile.ts`, `HomePanel.ts` (both new) | No | No |
| The AI's sheet | A webview helper names the Active chip and the Context line; the rest keep the path | `ChatInput.tsx:1200–1201`; `ChatBubbles.tsx:36–41` | No | No |

**Live checks** (CDP on a dev build, with a project holding a root `AGENTS.md` and a `docs/AGENTS.md`):
- **L1:** the tab, the folded list, Quick Open and the Window menu read About this project for the root file, in the Ritemark editor and in Open With ▸ Text Editor. `docs/AGENTS.md` keeps its name. A background About tab reads the plain name after Reload Window and after a switch, before it is clicked.
- **L2:** on a fresh profile's first start, the tab never shows `AGENTS.md` first. If it does, the default moves to `branding/product.json` (013).
- **L3:** the row's and the tab's tooltips, in a plain folder and in a Git folder.
- **L4:** the book-open icon in the row, the tab, the menu and the folded list, in Light and Dark, at the same size and alignment as its neighbours.
- **L5:** Create's pointer never shows in Documents, and after Reload Window and a switch no row appears and then goes. A pointer saved with CRLF or a byte-order mark is hidden. Adding a line to it shows it at once. Deleting `AGENTS.md` shows it.
- **L6:** typing "agents" in the tree's find shows the row without stray highlights.

## Recommendation

- **Tabs:** name them with the custom-label default. It is VS Code's own feature for this. It matches the root's file only, survives reloads, and reaches every place that names an open editor, with no code.
- **Documents and both tooltips:** add one fixed-rule case to 018's resource-label code, keyed on Sprint 133's opt-in. This is the hunk the technical plan expected (W7; the risk table's "one more case in 018's resource-label hunk").
- **Hiding the pointer:** a second, separate case in 018's `FilesFilter`, which reads the root `CLAUDE.md` itself.
- **The icon:** one name in the file icon theme, plus `book` in the product icon theme for the menu.
- **Home and the sheet's two chips:** the extension and the webview name the file themselves.

That is **two shell changes, both in 018**: `labels.ts` (about 12 lines) and `explorerViewer.ts`'s filter (about 25 lines). Two one-liners are optional: the folded list's icon in 019, and the row's accessible name in 018. 018's header and `CLAUDE.md`'s patch table gain a line for each. The stacking rule holds: no other patch touches `labels.ts` or `FilesFilter`.

## What this changes in spec R8

1. **"A `CLAUDE.md` that Ritemark wrote"** becomes "a `CLAUDE.md` whose whole content is `@AGENTS.md`". Ritemark can't tell who wrote a file, and the technical plan's rule is already content-only. It is hidden only while the root has an `AGENTS.md`.
2. **Home's Last changed leaves out the pointer too**, not only Documents.
3. **The pointer is hidden in Documents only.** Search, Quick Open and Source Control show it.
4. **The book-open icon shows on every `AGENTS.md`**, in any folder, as it already does on README files. Only the root's file is renamed. Matching ignores case, as the Mac's and Windows' file systems do.
5. **In a Git folder, the tooltip carries Git's status after it**, for example "… • Untracked".
6. **"Everywhere" means** the menu, the tab (and the folded list, Quick Open and the window's title), Documents, Home, and the AI's Active and Context chips. Search, Source Control, the AI's activity and changed-file lists, and Share's suggested file names keep `AGENTS.md`, unless the Experience lead asks otherwise.
