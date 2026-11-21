# Sprint 172 audit: where `.rtms` must land

A read-only look at `origin/main` 2b9d536e (21 November 2026), the vscode submodule at d956e8a6 with the canonical patches applied (read from the rundev worktree, never written). Nothing was built, launched or registered. The answers decide the plan's PR split and tier.

## 1. The shell: where the Mac app's file types come from

**Today.** The app's `Info.plist` `CFBundleDocumentTypes` comes from upstream VS Code, `build/lib/electron.ts` (`config.darwinBundleDocumentTypes`, about line 154), packaged by `@vscode/gulp-electron` (`src/darwin.js` `patchInfoPlist`). `.md` is in upstream's "Markdown document" entry with `markdown.icns`. No Ritemark patch touches the document types: patch 005 changes only `companyName` and `copyright` in the same `config`, patch 004 changes `build/gulpfile.vscode.ts` for packaging, and `branding/product.json` has no document-type key. The installed 2.2.0 has no `UTExportedTypeDeclarations` at all.

**What gulp-electron can and can't say.** Each document type gets a name, role, OS types, extensions, an `iconFile` (always written as `CFBundleTypeIconFile`) and optional `utis` (`LSItemContentTypes`). It has no option for `UTExportedTypeDeclarations`, `UTTypeIcons` or `LSHandlerRank`. So a patch to `electron.ts` can't declare the type, and it would force a `CFBundleTypeIconFile` on the deck's entry, which would replace the system-drawn page we want.

**The smallest change: no patch.** One new script, `scripts/stamp-deck-document-type.sh <app>`, run beside the existing version stamp (before the provenance step and before signing) in `scripts/build-prod.sh` (arm64) and `.github/workflows/build-macos-x64.yml` step 9c (x64). It adds to `Contents/Info.plist`:

- a `CFBundleDocumentTypes` entry: `CFBundleTypeName` "Ritemark Deck", `CFBundleTypeRole` Editor, `LSHandlerRank` Owner, `LSItemContentTypes` [`ai.productory.ritemark.deck`], and no `CFBundleTypeIconFile`;
- a `UTExportedTypeDeclarations` entry: `UTTypeIdentifier` `ai.productory.ritemark.deck`, `UTTypeDescription` "Ritemark Deck", `UTTypeConformsTo` [`public.plain-text`], `UTTypeTagSpecification` `public.filename-extension` [`rtms`], and `UTTypeIcons` { `UTTypeIconBadgeName` `deck-badge`, `UTTypeIconText` `DECK` };
- and copies `branding/icons/deck-badge.icns` into `Contents/Resources/`.

This is the pattern Chrome uses (read from the installed Chrome's `Info.plist`: `UTTypeIcons` with `UTTypeIconBadgeName` "Icon" and `UTTypeIconText` "EXTENSION", conforming types, an extension tag). The script uses `plutil -insert`/`PlistBuddy`, as the version stamp does, and fails the build if a key is missing afterwards.

**Why the stamp, not the gulp build.** A dev build's Electron app (`.build/electron/…app`) gets its plist from the same `electron.ts`; a patch there would make every dev launch claim the type and register as its owner on Jarmo's Mac. The stamp runs only in release builds, so a dev window never claims `.rtms`.

**The badge asset.** `branding/icons/deck-badge.icns`, made with `iconutil` from an iconset of Phosphor's `presentation` glyph (the deck icon of the tabs, Documents and Search) on a transparent ground: 16, 32, 128, 256 and 512 px at @1x and @2x (ten PNGs, the largest 1024 px). The glyph's SVG source sits beside it, and `branding/README.md` gets the regeneration command. The system scales the badge onto its own page and draws DECK under it. Unproven until the runner proof (section 4): that `UTTypeIconBadgeName` finds an `.icns` in `Resources` by its base name. If it doesn't, the fallback is an asset catalog (`Assets.car` compiled with `actool`, which Xcode provides on the build Mac and the runner), and the plan's tier and files stay the same.

**The editor association.** `branding/product.json` `configurationDefaults` `workbench.editorAssociations` gets `"*.rtms": "ritemark.editor"`, beside `*.md` (patch 013 already makes these defaults apply; no patch change).

**Build checks.** `scripts/validate-build-output.sh` (Gate 1) checks the built app's plist: the document type, the exported type with its badge and text, `plutil -lint` clean, and `Resources/deck-badge.icns` present. The provenance step runs after the stamp, as it does for the version stamp, so it covers the edited plist.

**Windows.** `installer/windows/ritemark.iss` registers `.md` and `.markdown` only under the unchecked "Associate with .md files" task, with the app's own icon. For `.rtms`: a `[Registry]` block always (Ritemark owns the type, so no task box): `.rtms` → ProgID `Ritemark.rtms`, its name "Ritemark Deck", `DefaultIcon` the deck icon, `shell\open\command` the app with `"%1"`, all removed on uninstall; `ChangesAssociations=yes` in `[Setup]` so Explorer redraws icons at once. The icon: upstream's win32 packaging copies a fixed list of `resources/win32/*.ico` (`gulpfile.vscode.ts` about line 308), so a new icon there would need patch 004. Instead the installer takes it the way it takes the app icon (`#define IconPath`): `#define DeckIconPath "..\..\branding\win32\deck.ico"` and a `[Files]` line installing it into `{app}\resources\`. No patch. Windows has no system-drawn page, so `deck.ico` is a drawn icon (a design question).

**Shell-tier files, by CLAUDE.md's list.** Shell-tier already: `scripts/build-prod.sh`, `.github/workflows/build-macos-x64.yml` (`.github/workflows/build-`), `scripts/validate-build-output.sh`, `branding/product.json`, `installer/windows/ritemark.iss`. New and shell-tier by decision: `scripts/stamp-deck-document-type.sh`, added to the list in `CLAUDE.md` and to `scripts/release-extension-preflight.sh`'s `SHELL_TIER_PATHS` in the same commit (the list's own rule). Not shell-tier by path but shipped only by a shell release: `branding/icons/deck-badge.icns`, its source, `branding/win32/deck.ico`. Harness: the Windows round-trip probe (`scripts/verify-windows-installer-roundtrip.ps1` or `scripts/windows-standard-user-registry-probe.ps1`) and the proof workflow (section 4).

**Patches: none change.** Patch 018's `ritemarkSplitExtension` splits a label at `.deck.md` when it ends so, else at the last dot. `Talk.rtms` already splits into "Talk" and ".rtms", so Documents and the tabs show ".rtms" muted with no change, and an old `Talk.deck.md` keeps showing ".deck.md". Its test could gain a `.rtms` row, but the test lives in the patch, and a patch change only for a test row is not worth a shell-tier diff. `docs/development/vscode-patches.md` is unchanged.

## 2. The extension: every `.deck.md` and every Markdown-only check

**The one rule.** `src/decks/deckFileName.ts` has no imports and is already shared by the host, the search worker and the webview. It becomes the only place that knows deck names: `DECK_EXTENSION = '.rtms'` (new decks), `LEGACY_DECK_EXTENSION = '.deck.md'` (read, never written), `isDeckPath()` true for both, `deckNameOf(fileName)` (the name without either ending), `deckFileName(name)` (`<name>.rtms`), `DECK_GLOB = '**/*.{rtms,deck.md}'` for `findFiles` and watchers, and `splitFileName` taking `.rtms` by the last dot and `.deck.md` whole, as patch 018 does. Every scattered `/\.deck\.md$/i` becomes a call to it.

**Files that name `.deck.md` (non-test, 38 with `package.json` and the icon theme).**

| File | What it does | Change |
| --- | --- | --- |
| `src/decks/deckFileName.ts` | The rule | As above |
| `src/decks/deckMode.ts` | Opens as a deck: flag, on disk, name, `deck:` version | Comment only; it calls `isDeckPath` |
| `src/decks/newDeck.ts` | New → Deck "Untitled.deck.md", "(copy).deck.md", the deck's name | `deckFileName()`, `deckNameOf()`: "Untitled.rtms", "Untitled 2.rtms", "<name> (copy).rtms" |
| `src/decks/decksHost.ts` | New → Deck; renames moving decks (glob and regex) | `isDeckPath`, `DECK_GLOB` |
| `src/decks/DeckLibrary.ts` | Library topics, `from:` sources, add to a new topic | `isDeckPath`, `deckNameOf`; a new topic is `<topic>.rtms`; an existing `.deck.md` topic keeps its name |
| `src/decks/deckDocuments.ts` | Finds every deck in the project | `DECK_GLOB` |
| `src/decks/SlideLibraryViewProvider.ts` | Watches decks for the library place | `DECK_GLOB`, `isDeckPath` |
| `src/decks/deckProtocol.ts` | Webview message checks: a source and a path must be decks | `isDeckPath` |
| `src/decks/themeProtocol.ts`, `src/decks/themeAi.ts`, `src/decks/themePages.ts` | Theme tools and pages check a deck path | `isDeckPath` |
| `src/decks/deckPublish.ts` | A page is a deck's page only beside `<name>.deck.md` | Beside `<name>.rtms` or `<name>.deck.md` |
| `src/decks/page/pageFile.ts`, `page/pageHtml.ts`, `present/DeckPresenter.ts`, `blocks/slideComments.ts`, `currentSlide.ts`, `librarySearch.ts` | The deck's name for the page, Present, comments, the library search | `deckNameOf` |
| `src/decks/deckFormat.ts`, `deckPages.ts`, `editorSync/protocol.ts`, `extension.ts`, `ritemarkEditor.ts`, `features/flags.ts`, `guidance/GuidanceHost.ts`, `projects/homeState.ts` | Comments and the flag's description | Words name `.rtms` and the older `.deck.md` |
| `src/guidance/folderCounts.ts` | "1 file: 1 deck." with the flag on | Through `isDeckPath`; with the flag off a `.rtms` counts as text, so `.rtms` joins its `EXTENSIONS` as `text` |
| `src/runtime/ritemarkTools.ts` | The deck tools' path check and descriptions ("ending in .deck.md") | `isDeckPath`; the words say `.rtms`, and a deck made before may end `.deck.md` |
| `src/ai/capabilityContext.ts` | The DECKS instructions for every runtime | "a `.rtms` file is a slide deck (an older one may be named `.deck.md`)"; a new deck is `<name>.rtms` |
| `src/search/worker/readers/index.ts` | Which files search reads, and their names | `'.rtms': 'markdown'`; the name through `splitFileName` |
| `webview/src/App.tsx`, `components/search/SearchPanel.tsx`, `extensions/FileLinkSuggestionList.tsx`, `lib/fileIcon.ts` | Comments; the icon follows `isDeckPath` | Comments only |
| `webview/src/components/decks/DeckView.tsx`, `SlideSettings.tsx` | The deck's name from the file name | `deckNameOf` |
| `package.json` | The custom editor's selector; the flag's description | `*.rtms` in `ritemark.editor`'s selector; `.rtms` added to the `markdown` language; words |
| `fileicons/ritemark-icon-theme.json` | `deck.md` → the presentation icon | `rtms` → the same icon, light and dark; `deck.md` stays |
| `src/decks/page/testing/privateDeck.ts`, `webview/src/utils/fidelity-corpus/look-baseline.json` | Test data with `from:` lines | None: an old `from:` path stays valid |

**Markdown-only checks a deck passes today because it ends `.md`.**

| File | The check | Must `.rtms` pass? | Change |
| --- | --- | --- | --- |
| `src/editorSync/DocumentSyncCoordinator.ts` `isEditable` | Only `.csv`, `.md`, `.markdown`, `.mdown`, `.mkd` or no extension get a sync record | **Yes**: without it a `.rtms` opens with no sync record, so an edit, an AI's write and a save go unhandled | Add `.rtms` |
| `webview/src/components/ai-sidebar/ChatInput.tsx` `TEXT_EXTENSIONS` and `classifyFile` | The chat's file picker accepts `.md` and classifies it as text | **Yes**: without it a `.rtms` deck is hidden by the picker and refused when its type is empty or generic, while an old `.deck.md` attaches (Codex on #941) | Add `.rtms` to both, with a test (PR 1) |
| `package.json` `customEditors` `ritemark.editor` | `*.md`, `*.markdown`, `*.csv` | Yes, flag on or off (off, it opens as a document) | Add `*.rtms` |
| `package.json` `languages` | `.rtms` has no language, so VS Code calls it plain text | Yes: it is Markdown, for Open With → Text Editor and the language fallbacks | `{ "id": "markdown", "extensions": [".rtms"] }` |
| `branding/product.json` `workbench.editorAssociations` | `*.md` → Ritemark | Yes (shell PR) | `"*.rtms": "ritemark.editor"` |
| `src/search/worker/readers/index.ts` `EXTENSIONS` | Search reads `.md`, `.markdown`, `.csv`, `.docx`, `.pdf` | Yes: a deck's words are found | `.rtms` → `markdown` |
| `src/internalLinkResolver.ts` `isMarkdownFile` | A link opens in Ritemark's editor only for `.md`, `.markdown`, `.mdx` | Yes: a link to a deck opens the deck | Add `.rtms` |
| `src/workspaceFileLinks.ts` `classifyWorkspaceFileKind` | `.md`, `.markdown` are `markdown` | Yes: a deck is a Markdown file to the chat's links | Add `.rtms` |
| `src/utils/stickyTabHealer.ts` | Heals a `.md` tab stuck in the text editor back into Ritemark | Yes | `\.(md\|markdown\|rtms)$` |
| `src/guidance/folderCounts.ts` `EXTENSIONS` | Counts kinds | Yes, as text when the flag is off | Add `.rtms` |
| `src/flows/nodes/LLMNodeExecutor.ts` | Text files a Flow's LLM node reads | Yes: it is text | Add `.rtms` |
| `src/flows/FlowEditorProvider.ts` | The file picker's Documents filter | Yes | Add `rtms` |
| `fileicons/ritemark-icon-theme.json` | `deck.md` association | Yes | `rtms` |
| `src/runtime/ritemarkTools.ts` | The deck tools' path check | Yes | Through `isDeckPath` |
| `src/views/UnifiedViewProvider.ts` `_fileContextFor` (about line 4200) | Parses an open `.md` for a task card's title | No: a deck is never a card | None |
| `src/guidance/startingPlace.ts` `TEXT_EXTENSIONS` | A text document's words for the ready card | No: a deck is not a text document there | None |
| `src/projects/homeState.ts` `KINDS` | Last changed's kinds | Already: `isDeckPath` answers `deck` first | None |
| `src/agent/discovery.ts`, `src/daemon/Scheduler.ts`, `src/views/AgentLibraryViewProvider.ts`, `src/extension.ts` (the agents watcher) | Agents, skills and commands are `.md` | No | None |
| `src/taskBoard/BoardStore.ts`, `cardPages.ts`, `protocol.ts`, `taskBoardHost.ts` | Task cards are `.md` | No | None |
| `src/welcome/sampleProject.ts`, `src/export/saveAsMarkdown.ts`, `src/transcriptWorkbenchProvider.ts`, `src/speech/insightsMarkdown.ts` | Sample files, Save as Markdown, transcripts | No | None |
| `src/publish/` | Publishes the deck's HTML page, not the deck | Already: the page sits beside the deck | Only `deckPublish.ts` above |
| Comments | Margin notes live in the document's text, whatever its name | Already | None |
| Documents, the tabs (patch 018) | The muted extension | Already: the last dot | None |

**Tests.** 53 test files name `.deck.md`. They stay: an old deck must keep working. New rows go beside them: the rule (`deckFileName` both endings, any case, a file named only `.rtms`), `deckModeOf` for `.rtms`, New → Deck's names, the library's new topic, the tools' path check, search's format, `isEditable`, the link resolver, the sticky-tab healer, the folder counts with the flag on and off.

**The demo project.** `docs/development/sprints/sprint-157-decks/demo-project/` has eight synthetic `.deck.md` files. Seven are renamed to `.rtms` (with their `from:` lines), and `Harbour Logistics/Copilot at work.deck.md` stays, as the deck made before. `docs/development/releases/v2.3.0/decks-print-and-agenda/proof/Training day.deck.md` is proof history and stays.

## 3. The agents

Claude Code, Codex and OpenCode read and write files with their own tools, which take any text file; nothing in the runtimes filters by `.md`. What names the extension is the DECKS block in `capabilityContext.ts` (shared by all runtimes) and the deck tools' descriptions and path check in `ritemarkTools.ts` (one registry, injected into every runtime). Both change in the extension PR. When an agent writes an open `.rtms`, the edit reaches the deck view through the sync coordinator, which is why `isEditable` matters. The live proof: an isolated test window (`scripts/qa/dev-launch-isolated.sh`, decks on in that profile only), test keys only through `scripts/qa/with-test-keys.sh`, no sign-in. Claude and Codex each list decks, read a `.rtms` deck, and change one slide's words; the deck view shows the change, and the file still opens as a deck.

## 4. Proving the Finder parts without touching Jarmo's Mac

Finder's kind, icon, double-click, Quick Look and Spotlight all need LaunchServices to have registered an app that declares the type. Registering any build on Jarmo's Mac changes his LaunchServices database, and a dev build must never become an owner there. So:

**On Jarmo's Mac, before Gate 2: static checks only.** The stamp script runs on a copy of a plist file in the scratchpad, never inside an `.app` bundle (Finder and Spotlight can register a bundle they only see). `plutil -lint`, the keys read back, `iconutil` makes the badge. No `lsregister`, no launch, no Finder window on it.

**On a GitHub macOS runner, before Gate 2: the real system answers.** A small `workflow_dispatch` workflow (`.github/workflows/deck-type-proof.yml`, not a `build-` workflow) runs on an ephemeral `macos-latest` machine. It makes a stand-in bundle (an `Info.plist` with Ritemark's bundle id, a copy of `/usr/bin/true` as its executable), runs the same stamp script on it, registers it there with `lsregister -f`, and makes `sample.rtms`. A Swift script then prints: `UTType(filenameExtension: "rtms")`'s identifier, description and conformance to `public.plain-text`; the app `NSWorkspace` opens the file with; and writes `NSWorkspace.icon(forFile:)` as PNGs at 512 and 64 px (the system-drawn page with the badge and DECK). `qlmanage -t` makes the Quick Look thumbnail, and `mdimport -t -d2 sample.rtms` shows Spotlight's importer and the words it reads. All are uploaded as the run's artifact and committed to the sprint's `proof/`. A few minutes on one runner, well inside the $40 monthly Actions budget.

**At Gate 2, on Jarmo's Mac: only the RC can show it.** Installing the RC as `/Applications/Ritemark.app` is the ordinary install that makes Ritemark the type's owner. The TEST-CHECKLIST rows below are checked there by eye.

**Windows.** Before Gate 2: ISCC compiles the script in CI, and the existing "Verify install and uninstall as a standard user" step's registry probe gains `.rtms`: the ProgID, its name, the icon file present at `DefaultIcon`'s path, the open command, and all of it gone after uninstall. The drawn icon in Explorer and a double-click are seen only on a Windows PC with the RC.

**TEST-CHECKLIST rows for `docs/releases/v2.3.0/TEST-CHECKLIST.md` (Decks).**

- Finder kind and icon: a `.rtms` deck in Finder shows the kind "Ritemark Deck" in Get Info and the list view, and its icon is the system's page with the deck badge and DECK. **Mac**
- A double-click opens the deck: from Finder, with Ritemark closed and with it open, a `.rtms` opens in Ritemark as a deck. **Mac**
- Quick Look and Spotlight: space in Finder shows the deck's text; Spotlight finds a word from one of its slides. **Mac**
- New → Deck makes `Untitled.rtms`, and Documents shows "Untitled" with ".rtms" muted. **Mac, Windows**
- An old `.deck.md` still opens as a deck, and keeps its name after an edit and a save. **Mac, Windows**
- Decks off opens a `.rtms` as an ordinary document in the Ritemark editor. **Mac**
- Windows: after the install, Explorer shows a `.rtms` with the deck icon and the type "Ritemark Deck"; a double-click opens it in Ritemark as a deck; after an uninstall the association is gone. **Windows, Fresh**

## Decision

Ship in 2.3, as three PRs: the extension first, then the Mac's type, then Windows. No patch changes. The one unproven point is the badge resource's form (`.icns` by base name or an asset catalog), answered by the runner proof as PR 2's first commit, with the same tier and files either way.
