# Sprint 172 technical plan

Read-only audit of `origin/main` 2b9d536e: [research/rtms-audit.md](research/rtms-audit.md) has every file, the reasons and the proof plan. This file says how the work lands. Proposed shapes, not final code.

## Architecture overview

Three layers name a deck. The extension's one rule (`src/decks/deckFileName.ts`) decides what is a deck inside Ritemark: the editor, the lists, search, the tools. The release build's `Info.plist` tells macOS what a `.rtms` is and who owns it. The Windows installer tells Explorer the same. No VS Code patch changes: the plist is stamped after the gulp build, and patch 018's name split already takes `.rtms` by its last dot.

## Workstream 1: the one rule and every deck place (R1–R6, R8)

- `src/decks/deckFileName.ts` (no imports, shared by the host, the search worker and the webview): `DECK_EXTENSION = '.rtms'`, `LEGACY_DECK_EXTENSION = '.deck.md'`, `isDeckPath(path)` for both in any case, `deckNameOf(fileName)`, `deckFileName(name)`, `DECK_GLOB = '**/*.{rtms,deck.md}'`, and `splitFileName` (`.rtms` by the last dot, `.deck.md` whole).
- Every `/\.deck\.md$/i` and every `.replace(/\.deck\.md$/i, '')` in the audit's first table becomes `isDeckPath` or `deckNameOf`; every `'**/*.deck.md'` becomes `DECK_GLOB`. After the change, `git grep -n 'deck\\.md' -- extensions/ritemark/src extensions/ritemark/webview/src ':!*test*'` finds only `deckFileName.ts` and words in comments.
- New names (`newDeck.ts`, `DeckLibrary.ts` new topics): always `deckFileName(name)`. An existing file is never renamed; a copy of an old deck is `.rtms` (R3, pending the Experience lead's answer).
- `deckPublish.ts` `pageRows`: the deck beside `<name>.html` is `<name>.rtms` or `<name>.deck.md`, the first that exists.
- `package.json`: `*.rtms` in `ritemark.editor`'s selector (static, so with decks off it opens as a document, R6); `contributes.languages` gains `{ "id": "markdown", "extensions": [".rtms"] }`; the `decks` flag's description names `.rtms`.
- `fileicons/ritemark-icon-theme.json`: `"rtms": "_file_deck"` and `"_file_deck_dark"`, beside `deck.md`.

## Workstream 2: Markdown-only checks (R7)

Each check in the audit's second table marked Yes adds `.rtms`, through `DECK_EXTENSION` where the module can import `deckFileName.ts`: `DocumentSyncCoordinator.isEditable` (the one that matters most: without it a `.rtms` has no sync record, so edits, AI writes and saves go unhandled), search's `EXTENSIONS` (`markdown`), `internalLinkResolver.isMarkdownFile`, `workspaceFileLinks.classifyWorkspaceFileKind` (`markdown`), `stickyTabHealer`, `folderCounts`'s `EXTENSIONS` (`text`, used with decks off), `LLMNodeExecutor`'s text extensions and `FlowEditorProvider`'s Documents filter. The checks marked No (agents, task cards, sample files, Save as Markdown, transcripts, the card title parse) stay `.md` only, and each gets a test row that `.rtms` stays out.

## Workstream 3: the agents (R8)

- `src/ai/capabilityContext.ts` DECKS block: "a `.rtms` file is a slide deck (one made before 2.3 may end `.deck.md`)", and "name a new deck `<name>.rtms`".
- `src/runtime/ritemarkTools.ts`: the path check through `isDeckPath`; the `deckPath` description says "ending in .rtms (an older deck may end .deck.md)"; list_decks' description names `.rtms`. `themeAi.ts` and `themeProtocol.ts` the same.
- Live proof (PR 1): one isolated test window, decks on in that profile only, test keys only through `scripts/qa/with-test-keys.sh`, no sign-in. Claude, then Codex: list decks, read `Day one.rtms`, change slide 2's title; a shot of the deck view after each; the file's diff shows only that line. Then quit at once.

## Workstream 4: the Mac's file type (R9, R11)

- New `scripts/stamp-deck-document-type.sh <path to .app>`: inserts the document type and the exported type (below) into `Contents/Info.plist` with `plutil -insert` (idempotent: it refuses a plist that already has the type, so a rerun fails loudly), copies `branding/icons/deck-badge.icns` into `Contents/Resources/`, and reads every key back.
- Called in `scripts/build-prod.sh` right after the Info.plist version stamp (before Step 6's provenance and before `codesign-app.sh`), and in `.github/workflows/build-macos-x64.yml` step 9c, after its version stamp. The same script both times.
- The script goes on CLAUDE.md's shell-tier list and into `scripts/release-extension-preflight.sh`'s `SHELL_TIER_PATHS`, in the same commit.
- `scripts/validate-build-output.sh` (Gate 1): the keys, `plutil -lint`, the badge file.
- `branding/product.json`: `"*.rtms": "ritemark.editor"` in `workbench.editorAssociations`.
- `branding/icons/deck-badge.icns`, its SVG source and the `iconutil` command in `branding/README.md`: Phosphor's `presentation` glyph, transparent ground, 16, 32, 128, 256 and 512 px at @1x and @2x.

The plist fragment:

```xml
<!-- CFBundleDocumentTypes, appended -->
<dict>
  <key>CFBundleTypeName</key><string>Ritemark Deck</string>
  <key>CFBundleTypeRole</key><string>Editor</string>
  <key>LSHandlerRank</key><string>Owner</string>
  <key>LSItemContentTypes</key><array><string>ai.productory.ritemark.deck</string></array>
</dict>
<!-- UTExportedTypeDeclarations, new -->
<dict>
  <key>UTTypeIdentifier</key><string>ai.productory.ritemark.deck</string>
  <key>UTTypeDescription</key><string>Ritemark Deck</string>
  <key>UTTypeConformsTo</key><array><string>public.plain-text</string></array>
  <key>UTTypeTagSpecification</key><dict>
    <key>public.filename-extension</key><array><string>rtms</string></array>
  </dict>
  <key>UTTypeIcons</key><dict>
    <key>UTTypeIconBadgeName</key><string>deck-badge</string>
    <key>UTTypeIconText</key><string>DECK</string>
  </dict>
</dict>
```

- The proof (first commit of PR 2, before the build wiring): `.github/workflows/deck-type-proof.yml` (`workflow_dispatch`, `macos-latest`) and `scripts/qa/deck-type-proof.swift`, as the audit's §4 says: a stand-in bundle stamped by the same script, registered with `lsregister` on the runner only, then the UTType, the opening app, the drawn icon as PNG, `qlmanage -t` and `mdimport -t -d2`. If the drawn icon has no badge, the badge moves to an asset catalog (`actool`) and the proof runs again; the tier and files stay. Nothing is registered on Jarmo's Mac; locally the script runs only on a bare plist file in the scratchpad.

## Workstream 5: Windows (R10)

- `installer/windows/ritemark.iss`: `#define DeckIconPath "..\..\branding\win32\deck.ico"`; a `[Files]` line installing it to `{app}\resources\deck.ico`; `ChangesAssociations=yes`; a `[Registry]` block with no task: `Software\Classes\.rtms` → `Ritemark.rtms` (`uninsdeletevalue`), `Software\Classes\Ritemark.rtms` "Ritemark Deck" (`uninsdeletekey`), its `DefaultIcon` `{app}\resources\deck.ico`, its `shell\open\command` `"{app}\Ritemark.exe" "%1"`.
- `branding/win32/deck.ico`: 16, 20, 24, 32, 40, 48, 64 and 256 px, drawn to the Experience lead's design.
- The CI round trip's registry probe (`scripts/verify-windows-installer-roundtrip.ps1` / `scripts/windows-standard-user-registry-probe.ps1`): the `.rtms` keys after install, the icon file at `DefaultIcon`'s path, and none of it after uninstall.

## Tests

- Workstream 1–3: unit rows beside the existing ones (the audit's Tests paragraph); the 53 test files that name `.deck.md` stay as the old decks' guard. `npm run test:decks` and the touched files' own tests while working; the full chain once on each final head, to a file.
- Workstream 4: the proof workflow's artifact; the stamp script's own test on a bare plist (`scripts/stamp-deck-document-type.test.sh` or a Node test beside it): inserts, refuses a second run, reads back, `plutil -lint`.
- Workstream 5: ISCC compiles in CI; the round-trip probe.

## Docs

- `docs/development/architecture.md`: the Decks row names `deckFileName.ts` as the one rule and the plist stamp as where the Mac learns the type.
- `docs/releases/v2.3.0/TEST-CHECKLIST.md`: the rows in the audit's §4, and row 0a says `.rtms`.
- `docs/releases/v2.3.0/release-notes.md`: one line in Make slides (see `sprint-plan.md`).
- The demo project: seven decks renamed to `.rtms` with their `from:` lines, `Copilot at work.deck.md` kept.
